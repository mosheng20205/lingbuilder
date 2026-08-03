import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  SOLUTION_PROJECT_TEMPLATES,
  createSolutionService,
  type CreateSolutionProjectPlan,
  type CreateSolutionProjectRequest,
  type LingBuilderSolutionProject,
  type SolutionProjectTemplateId,
  type SolutionProjectTemplate,
  type SolutionService
} from './solutionService';
import { createModuleService, type ModuleService, type ProjectModuleEnablePlan } from '../modules/moduleService';

const RECEIPT_DIRECTORY = path.join('.lingbuilder', 'ai-bridge', 'project-create-receipts');
const NAVIGATION_FILE = path.join('.lingbuilder', 'ai-bridge', 'workbench-navigation.json');
const RECEIPT_ID_PATTERN = /^[a-f0-9-]{16,80}$/iu;

export interface ProjectCreationRequest extends CreateSolutionProjectRequest {
  templateId?: SolutionProjectTemplateId;
  enabledModuleIds?: string[];
  openInWorkbench?: boolean;
  approved?: boolean;
}

export interface ProjectCreationFilePreview {
  relativePath: string;
  kind: 'source' | 'config' | 'designer';
  content: string;
  bytes: number;
}

export interface ProjectCreationPreview {
  ok: true;
  applied: false;
  operation: 'project.create';
  template: SolutionProjectTemplate;
  project: LingBuilderSolutionProject;
  designerProject: CreateSolutionProjectPlan['designerProject'];
  files: ProjectCreationFilePreview[];
  modules: {
    requestedModuleIds: string[];
    dependencyModuleIds: string[];
    addedModuleIds: string[];
    reusedModuleIds: string[];
  };
  navigation: ProjectCreationNavigation;
  message: string;
}

export interface ProjectCreationNavigation {
  openInWorkbench: boolean;
  projectId: string;
  filePath: string;
  windowId: string;
}

export interface ProjectCreationReceipt {
  receiptId: string;
  projectId: string;
  createdAt: string;
  templateId: SolutionProjectTemplateId;
  previousStartupProjectIds: string[];
  navigationRequestId?: string;
  files: Array<{ relativePath: string; sha256: string; size: number }>;
}

export interface ProjectCreationResult extends Omit<ProjectCreationPreview, 'applied' | 'message'> {
  applied: true;
  receipt: ProjectCreationReceipt;
  solution: Awaited<ReturnType<SolutionService['getSolution']>>;
  message: string;
}

export interface ProjectCreationUndoResult {
  ok: true;
  receiptId: string;
  projectId: string;
  removedPaths: string[];
  message: string;
}

export class ProjectCreationService {
  private readonly solutionService: SolutionService;
  private readonly moduleService: ModuleService;
  private readonly workspaceRoot: string;

  constructor(
    workspaceRoot: string,
    dependencies: { solutionService?: SolutionService; moduleService?: ModuleService } = {}
  ) {
    this.workspaceRoot = path.resolve(workspaceRoot);
    this.solutionService = dependencies.solutionService || createSolutionService(this.workspaceRoot);
    this.moduleService = dependencies.moduleService || createModuleService(this.workspaceRoot);
  }

  listTemplates(): readonly SolutionProjectTemplate[] {
    return SOLUTION_PROJECT_TEMPLATES.map(template => ({ ...template }));
  }

  async preview(request: ProjectCreationRequest = {}): Promise<ProjectCreationPreview> {
    const prepared = await this.prepare(request);
    return this.toPreview(prepared.plan, prepared.modulePlan, prepared.request);
  }

  async create(request: ProjectCreationRequest = {}): Promise<ProjectCreationResult> {
    const prepared = await this.prepare(request);
    const preview = this.toPreview(prepared.plan, prepared.modulePlan, prepared.request);
    const solutionBefore = await this.solutionService.getSolution();
    let createdProject: LingBuilderSolutionProject | undefined;
    let navigationRequestId: string | undefined;

    try {
      const created = await this.solutionService.createProject(prepared.request);
      if (created.project.id !== prepared.plan.project.id) {
        throw new Error('项目创建期间解决方案发生变化，已拒绝写入不一致的项目。');
      }
      createdProject = created.project;

      if (prepared.request.enabledModuleIds?.length) {
        await this.moduleService.enableModulesForProject(created.project.id, prepared.request.enabledModuleIds);
      }

      const files = await captureProjectFiles(this.workspaceRoot, created.project);
      const receipt: ProjectCreationReceipt = {
        receiptId: crypto.randomUUID(),
        projectId: created.project.id,
        createdAt: new Date().toISOString(),
        templateId: prepared.plan.template.id,
        previousStartupProjectIds: [...solutionBefore.startupProjectIds],
        files
      };

      if (prepared.request.openInWorkbench !== false) {
        navigationRequestId = receipt.receiptId;
        receipt.navigationRequestId = navigationRequestId;
        await writeNavigationRequest(this.workspaceRoot, {
          requestId: navigationRequestId,
          action: 'open-project',
          projectId: created.project.id,
          filePath: preview.navigation.filePath,
          windowId: preview.navigation.windowId,
          createdAt: receipt.createdAt
        });
      }
      await writeReceipt(this.workspaceRoot, receipt);

      return {
        ...preview,
        applied: true,
        receipt,
        solution: created.solution,
        message: `已创建项目“${created.project.name}”，可继续通过 AI 编辑、诊断和构建。`
      };
    } catch (error) {
      if (createdProject) {
        await this.solutionService.deleteProject(createdProject.id, { deleteFiles: true }).catch(() => undefined);
      }
      if (navigationRequestId) await removeNavigationRequest(this.workspaceRoot, navigationRequestId).catch(() => undefined);
      throw error;
    }
  }

  async undo(receiptId: string): Promise<ProjectCreationUndoResult> {
    if (!RECEIPT_ID_PATTERN.test(receiptId.trim())) throw new Error('项目创建撤销凭据无效。');
    const receipt = await readReceipt(this.workspaceRoot, receiptId.trim());
    const solution = await this.solutionService.getSolution();
    const project = solution.projects.find(item => item.id === receipt.projectId);
    if (!project) throw new Error(`项目“${receipt.projectId}”已经不存在，不能重复撤销。`);
    if (solution.projects.some(item => (item.references || []).includes(project.id))) {
      throw new Error(`项目“${project.id}”已被其它项目引用，请先移除引用后再撤销。`);
    }

    const currentFiles = await captureProjectFiles(this.workspaceRoot, project);
    if (!sameFileSnapshot(receipt.files, currentFiles)) {
      throw new Error('项目创建后的文件已经被修改或新增，已阻止撤销以避免覆盖用户代码。');
    }

    const removed = await this.solutionService.deleteProject(project.id, { deleteFiles: true });
    const restoreProjectId = receipt.previousStartupProjectIds.find(id => removed.solution.projects.some(item => item.id === id));
    if (restoreProjectId) await this.solutionService.updateProject(restoreProjectId, { startupProjectIds: receipt.previousStartupProjectIds });
    await fs.rm(receiptPath(this.workspaceRoot, receipt.receiptId), { force: true });
    if (receipt.navigationRequestId) await removeNavigationRequest(this.workspaceRoot, receipt.navigationRequestId);

    return {
      ok: true,
      receiptId: receipt.receiptId,
      projectId: project.id,
      removedPaths: removed.removedPaths,
      message: `已撤销项目“${project.name}”的 AI 创建事务。`
    };
  }

  private async prepare(request: ProjectCreationRequest): Promise<{ request: ProjectCreationRequest; plan: CreateSolutionProjectPlan; modulePlan: ProjectModuleEnablePlan }> {
    const normalizedRequest: ProjectCreationRequest = {
      ...request,
      name: request.name?.trim() || request.name,
      projectId: request.projectId?.trim() || request.projectId,
      templateId: request.templateId || 'blank-window',
      enabledModuleIds: normalizeModuleIds(request.enabledModuleIds)
    };
    const plan = await this.solutionService.previewCreateProject(normalizedRequest);
    const modulePlan = await this.moduleService.planEnableModulesForNewProject(plan.project.id, normalizedRequest.enabledModuleIds || []);
    return { request: normalizedRequest, plan, modulePlan };
  }

  private toPreview(plan: CreateSolutionProjectPlan, modulePlan: ProjectModuleEnablePlan, request: ProjectCreationRequest): ProjectCreationPreview {
    const mainSource = plan.files.find(file => file.kind === 'source' && file.relativePath.endsWith('.lcpp'));
    return {
      ok: true,
      applied: false,
      operation: 'project.create',
      template: plan.template,
      project: plan.project,
      designerProject: plan.designerProject,
      files: plan.files.map(file => ({
        relativePath: file.relativePath,
        kind: file.kind,
        content: file.content,
        bytes: Buffer.byteLength(file.content, 'utf8')
      })),
      modules: {
        requestedModuleIds: modulePlan.requestedModuleIds,
        dependencyModuleIds: modulePlan.dependencyModuleIds,
        addedModuleIds: modulePlan.addedModuleIds,
        reusedModuleIds: modulePlan.reusedModuleIds
      },
      navigation: {
        openInWorkbench: request.openInWorkbench !== false,
        projectId: plan.project.id,
        filePath: mainSource?.relativePath || plan.files[0].relativePath,
        windowId: plan.designerProject.windows[0]?.id || 'main-window'
      },
      message: `预览：将创建项目“${plan.project.name}”并写入 ${plan.files.length} 个项目文件。`
    };
  }
}

function normalizeModuleIds(value: string[] | undefined): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 64) throw new Error('一次创建项目最多指定 64 个模块。');
  const ids = [...new Set(value.map(item => String(item).trim()).filter(Boolean))];
  if (ids.some(id => !/^[a-z0-9][a-z0-9._-]{1,127}$/iu.test(id))) throw new Error('项目模块 ID 格式无效。');
  return ids;
}

async function captureProjectFiles(workspaceRoot: string, project: LingBuilderSolutionProject): Promise<ProjectCreationReceipt['files']> {
  const roots = [project.sourceRoot, project.configRoot, path.posix.dirname(project.designerPath)];
  const files = new Map<string, { sha256: string; size: number }>();
  for (const relativeRoot of roots) await collectFiles(workspaceRoot, relativeRoot, files);
  return [...files.entries()]
    .map(([relativePath, value]) => ({ relativePath, ...value }))
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

async function collectFiles(workspaceRoot: string, relativeRoot: string, files: Map<string, { sha256: string; size: number }>): Promise<void> {
  const absoluteRoot = resolveWorkspacePath(workspaceRoot, relativeRoot);
  let entries;
  try { entries = await fs.readdir(absoluteRoot, { withFileTypes: true }); } catch (error: any) { if (error?.code === 'ENOENT') return; throw error; }
  for (const entry of entries) {
    if (entry.isSymbolicLink()) throw new Error(`项目创建路径包含不允许的符号链接：${path.posix.join(relativeRoot, entry.name)}`);
    const relativePath = path.posix.join(relativeRoot.replace(/\\/gu, '/'), entry.name);
    const absolutePath = resolveWorkspacePath(workspaceRoot, relativePath);
    if (entry.isDirectory()) await collectFiles(workspaceRoot, relativePath, files);
    else if (entry.isFile()) {
      const content = await fs.readFile(absolutePath);
      files.set(relativePath, { sha256: crypto.createHash('sha256').update(content).digest('hex'), size: content.byteLength });
    }
  }
}

function sameFileSnapshot(expected: ProjectCreationReceipt['files'], actual: ProjectCreationReceipt['files']): boolean {
  return expected.length === actual.length && expected.every((file, index) => {
    const current = actual[index];
    return current?.relativePath === file.relativePath && current.sha256 === file.sha256 && current.size === file.size;
  });
}

async function writeReceipt(workspaceRoot: string, receipt: ProjectCreationReceipt): Promise<void> {
  const target = receiptPath(workspaceRoot, receipt.receiptId);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
}

async function readReceipt(workspaceRoot: string, receiptId: string): Promise<ProjectCreationReceipt> {
  try {
    return JSON.parse(await fs.readFile(receiptPath(workspaceRoot, receiptId), 'utf8')) as ProjectCreationReceipt;
  } catch (error: any) {
    if (error?.code === 'ENOENT') throw new Error(`未找到项目创建撤销凭据：${receiptId}`);
    throw new Error(`项目创建撤销凭据读取失败：${error?.message || String(error)}`);
  }
}

function receiptPath(workspaceRoot: string, receiptId: string): string {
  return resolveWorkspacePath(workspaceRoot, path.posix.join(RECEIPT_DIRECTORY.replace(/\\/gu, '/'), `${receiptId}.json`));
}

async function writeNavigationRequest(workspaceRoot: string, request: {
  requestId: string;
  action: 'open-project';
  projectId: string;
  filePath: string;
  windowId: string;
  createdAt: string;
}): Promise<void> {
  const target = resolveWorkspacePath(workspaceRoot, NAVIGATION_FILE);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, `${JSON.stringify(request, null, 2)}\n`, 'utf8');
}

async function removeNavigationRequest(workspaceRoot: string, requestId: string): Promise<void> {
  const target = resolveWorkspacePath(workspaceRoot, NAVIGATION_FILE);
  try {
    const current = JSON.parse(await fs.readFile(target, 'utf8')) as { requestId?: string };
    if (current.requestId === requestId) await fs.rm(target, { force: true });
  } catch (error: any) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

function resolveWorkspacePath(workspaceRoot: string, relativePath: string): string {
  const root = path.resolve(workspaceRoot);
  const target = path.resolve(root, relativePath);
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) throw new Error(`项目创建路径越界：${relativePath}`);
  return target;
}

export function createProjectCreationService(workspaceRoot: string, dependencies?: { solutionService?: SolutionService; moduleService?: ModuleService }): ProjectCreationService {
  return new ProjectCreationService(workspaceRoot, dependencies);
}
