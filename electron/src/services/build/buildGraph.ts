import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { BuildArtifact, BuildStep, BuildStepContext, BuildStepResult } from './types';
import type { BuildStepProviderRegistry } from './providerRegistry';

export class BuildGraphValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BuildGraphValidationError';
  }
}

export class BuildGraphCancelledError extends Error {
  constructor(message = '构建生成已取消。') {
    super(message);
    this.name = 'BuildGraphCancelledError';
  }
}

interface OutputSnapshot { path: string; existed: boolean; bytes?: Buffer }

export interface BuildGraphExecutionOptions {
  workspaceRoot: string;
  projectRoot: string;
  outputRoot: string;
  target: BuildStepContext['target'];
  signal?: AbortSignal;
  report?(progress: number, message?: string): void;
  log?(message: string, level?: 'info' | 'warning' | 'error'): void;
}

export function orderBuildSteps(
  steps: readonly BuildStep[],
  registry: BuildStepProviderRegistry,
  outputRoot: string,
  projectRoot = outputRoot
): BuildStep[] {
  const byId = new Map<string, BuildStep>();
  const outputOwners = new Map<string, string>();
  for (const step of steps) {
    validateBuildStep(step, registry, outputRoot, projectRoot);
    if (byId.has(step.id)) throw new BuildGraphValidationError(`构建步骤 ID 重复：${step.id}`);
    for (const output of step.outputs) {
      const outputPath = path.resolve(outputRoot, output.path).toLowerCase();
      const owner = outputOwners.get(outputPath);
      if (owner) throw new BuildGraphValidationError(`构建产物路径冲突：${output.path} 同时由 ${owner} 和 ${step.id} 声明。`);
      outputOwners.set(outputPath, step.id);
    }
    byId.set(step.id, step);
  }
  const state = new Map<string, 'visiting' | 'visited'>();
  const result: BuildStep[] = [];
  const visit = (id: string, trail: string[]) => {
    const current = state.get(id);
    if (current === 'visited') return;
    if (current === 'visiting') throw new BuildGraphValidationError(`构建步骤存在循环依赖：${[...trail, id].join(' -> ')}`);
    const step = byId.get(id);
    if (!step) throw new BuildGraphValidationError(`构建步骤依赖不存在：${id}`);
    state.set(id, 'visiting');
    step.dependsOn.forEach(dependency => visit(dependency, [...trail, id]));
    state.set(id, 'visited');
    result.push(step);
  };
  [...byId.keys()].forEach(id => visit(id, []));
  return result;
}

export async function executeBuildGraph(
  steps: readonly BuildStep[],
  registry: BuildStepProviderRegistry,
  options: BuildGraphExecutionOptions
): Promise<{ artifacts: BuildArtifact[]; logs: string[]; diagnostics: string[] }> {
  const ordered = orderBuildSteps(steps, registry, options.outputRoot, options.projectRoot);
  const signal = options.signal || new AbortController().signal;
  const logs: string[] = [];
  const diagnostics: string[] = [];
  const snapshots = await snapshotOutputs(ordered, options.outputRoot);
  const artifacts: BuildArtifact[] = [];
  const log = (message: string, level: 'info' | 'warning' | 'error' = 'info') => {
    logs.push(message);
    options.log?.(message, level);
  };
  try {
    for (const [index, step] of ordered.entries()) {
      assertNotAborted(signal);
      const provider = registry.get(step.provider);
      const stageRoot = await createStepStageRoot(options.outputRoot, step.id);
      await Promise.all(step.outputs.map(output => fs.mkdir(path.dirname(path.resolve(stageRoot, output.path)), { recursive: true })));
      const context: BuildStepContext = {
        signal,
        workspaceRoot: options.workspaceRoot,
        projectRoot: options.projectRoot,
        outputRoot: stageRoot,
        target: options.target,
        step,
        report: (progress, message) => options.report?.(((index + Math.max(0, Math.min(100, progress) / 100)) / Math.max(1, ordered.length)) * 100, message),
        log
      };
      options.report?.((index / Math.max(1, ordered.length)) * 100, `开始：${step.id}`);
      log(`执行构建步骤：${step.id}`);
      try {
        const result: BuildStepResult = (await provider.run(step, context)) || {};
        assertNotAborted(signal);
        const committedArtifacts = await commitStepOutputs(step, result.artifacts || [], stageRoot, options.outputRoot);
        result?.logs?.forEach(message => log(message));
        result?.diagnostics?.forEach(message => diagnostics.push(message));
        artifacts.push(...committedArtifacts);
        options.report?.(((index + 1) / Math.max(1, ordered.length)) * 100, `已完成：${step.id}`);
      } finally {
        await fs.rm(stageRoot, { recursive: true, force: true });
      }
    }
    await cleanupStagingRoot(options.outputRoot);
    return { artifacts: uniqueArtifacts(artifacts), logs, diagnostics };
  } catch (error) {
    await restoreOutputs(snapshots);
    await cleanupStagingRoot(options.outputRoot);
    if (signal.aborted) throw new BuildGraphCancelledError(error instanceof Error ? error.message : undefined);
    throw error;
  }
}

async function createStepStageRoot(outputRoot: string, stepId: string): Promise<string> {
  const stageParent = path.join(path.resolve(outputRoot), '.lingbuilder-step-staging');
  await fs.mkdir(stageParent, { recursive: true });
  const safeId = stepId.replace(/[^a-zA-Z0-9._-]/gu, '_');
  return await fs.mkdtemp(path.join(stageParent, `${safeId}-`));
}

async function cleanupStagingRoot(outputRoot: string): Promise<void> {
  await fs.rm(path.join(path.resolve(outputRoot), '.lingbuilder-step-staging'), { recursive: true, force: true });
}

async function commitStepOutputs(
  step: BuildStep,
  reportedArtifacts: readonly BuildArtifact[],
  stageRoot: string,
  outputRoot: string
): Promise<BuildArtifact[]> {
  const reportedByPath = new Map(reportedArtifacts.map(artifact => [artifact.relativePath.replace(/\\/gu, '/').toLowerCase(), artifact]));
  const committed: BuildArtifact[] = [];
  for (const output of step.outputs) {
    const stagedPath = path.resolve(stageRoot, output.path);
    const targetPath = path.resolve(outputRoot, output.path);
    if (!await isFile(stagedPath)) {
      throw new BuildGraphValidationError(
        `构建步骤 ${step.id} 未生成声明产物：${output.path}`
      );
    }
    const relativeStage = path.relative(stageRoot, stagedPath);
    if (!relativeStage || relativeStage.startsWith('..') || path.isAbsolute(relativeStage)) {
      throw new BuildGraphValidationError(`构建步骤 ${step.id} 产物越过临时目录：${output.path}`);
    }
    await replaceFileAtomically(stagedPath, targetPath);
    const artifact = await describeArtifact(targetPath, outputRoot, output.kind);
    // Keep provider diagnostics/artifact metadata useful while making the
    // committed path authoritative. A provider cannot smuggle undeclared
    // outputs into the result because only declared outputs are committed.
    const reported = reportedByPath.get(output.path.replace(/\\/gu, '/').toLowerCase());
    committed.push(reported ? { ...artifact, kind: reported.kind === output.kind ? reported.kind : output.kind } : artifact);
  }
  return committed;
}

async function replaceFileAtomically(sourcePath: string, targetPath: string): Promise<void> {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  const temporaryPath = `${targetPath}.${process.pid}.${Date.now()}.commit.tmp`;
  await fs.copyFile(sourcePath, temporaryPath);
  try {
    await fs.rename(temporaryPath, targetPath);
  } catch (error) {
    await fs.rm(temporaryPath, { force: true });
    throw error;
  }
}

async function isFile(filePath: string): Promise<boolean> {
  try {
    return (await fs.stat(filePath)).isFile();
  } catch {
    return false;
  }
}

export function validateBuildStep(step: BuildStep, registry: BuildStepProviderRegistry, outputRoot: string, projectRoot = outputRoot): void {
  if (!step || typeof step !== 'object') throw new BuildGraphValidationError('构建步骤必须是对象。');
  if (!step.id || !/^[a-zA-Z0-9._-]+$/u.test(step.id)) throw new BuildGraphValidationError(`构建步骤 ID 无效：${step.id}`);
  if (typeof step.provider !== 'string' || !step.provider.trim()) throw new BuildGraphValidationError(`构建步骤 ${step.id} 缺少 Provider。`);
  const provider = registry.get(step.provider);
  if (!step.providerVersion?.trim()) throw new BuildGraphValidationError(`构建步骤缺少 Provider 版本：${step.id}`);
  if (step.providerVersion !== provider.version) {
    throw new BuildGraphValidationError(`构建步骤 ${step.id} 的 Provider 版本不匹配：要求 ${step.provider}@${step.providerVersion}，当前为 ${provider.version}。`);
  }
  if (!['resolve', 'generate', 'materialize', 'compile', 'link', 'package'].includes(step.phase)) throw new BuildGraphValidationError(`构建步骤阶段无效：${step.id}`);
  if (!Array.isArray(step.dependsOn) || step.dependsOn.some(item => typeof item !== 'string' || !item.trim())) throw new BuildGraphValidationError(`构建步骤依赖无效：${step.id}`);
  if (!Array.isArray(step.inputs) || !Array.isArray(step.outputs) || step.outputs.length === 0) {
    throw new BuildGraphValidationError(`构建步骤输入/输出无效或缺少产物声明：${step.id}`);
  }
  if (!step.options || typeof step.options !== 'object' || Array.isArray(step.options)) throw new BuildGraphValidationError(`构建步骤 options 必须是结构化对象：${step.id}`);
  for (const output of step.outputs) {
    if (!output || typeof output !== 'object' || typeof output.path !== 'string' || !['source', 'header', 'content', 'descriptor', 'runtime'].includes(output.kind)) {
      throw new BuildGraphValidationError(`构建步骤输出声明无效：${step.id}`);
    }
    assertSafeRelativePath(output.path, outputRoot, `构建步骤 ${step.id} 输出`);
  }
  for (const input of step.inputs) {
    if (!input || typeof input !== 'object' || typeof input.path !== 'string' || !input.path.trim()) {
      throw new BuildGraphValidationError(`构建步骤输入声明无效：${step.id}`);
    }
    if (path.isAbsolute(input.path)) throw new BuildGraphValidationError(`构建步骤 ${step.id} 输入不能使用绝对路径：${input.path}`);
    if (input.path.split(/[\\/]/u).includes('..')) throw new BuildGraphValidationError(`构建步骤 ${step.id} 输入路径越界：${input.path}`);
    if (input.root !== undefined && (path.isAbsolute(input.root) || input.root.split(/[\\/]/u).includes('..'))) {
      throw new BuildGraphValidationError(`构建步骤 ${step.id} 输入根目录不安全：${input.root}`);
    }
    if (!input.glob) {
      const inputPath = path.resolve(projectRoot, input.root || '.', input.path);
      const outputPath = step.outputs.find(output => path.resolve(outputRoot, output.path).toLowerCase() === inputPath.toLowerCase());
      if (outputPath) throw new BuildGraphValidationError(`构建步骤 ${step.id} 输出不能覆盖输入源码：${outputPath.path}`);
    }
  }
}

function assertSafeRelativePath(value: string, root: string, label: string): void {
  if (!value || path.isAbsolute(value)) throw new BuildGraphValidationError(`${label}必须是工作区相对路径：${value}`);
  const resolved = path.resolve(root, value);
  const relative = path.relative(path.resolve(root), resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new BuildGraphValidationError(`${label}越界：${value}`);
}

async function snapshotOutputs(steps: readonly BuildStep[], outputRoot: string): Promise<OutputSnapshot[]> {
  const paths = new Set(steps.flatMap(step => step.outputs.map(output => path.resolve(outputRoot, output.path))));
  return Promise.all([...paths].map(async target => {
    try { return { path: target, existed: true, bytes: await fs.readFile(target) }; }
    catch { return { path: target, existed: false }; }
  }));
}

async function restoreOutputs(snapshots: readonly OutputSnapshot[]): Promise<void> {
  for (const snapshot of snapshots) {
    if (snapshot.existed && snapshot.bytes) {
      await fs.mkdir(path.dirname(snapshot.path), { recursive: true });
      const temporary = `${snapshot.path}.${process.pid}.rollback.tmp`;
      await fs.writeFile(temporary, snapshot.bytes);
      await fs.rename(temporary, snapshot.path);
    } else {
      await fs.rm(snapshot.path, { force: true });
    }
  }
}

function uniqueArtifacts(artifacts: readonly BuildArtifact[]): BuildArtifact[] {
  const byPath = new Map<string, BuildArtifact>();
  artifacts.forEach(artifact => byPath.set(path.resolve(artifact.absolutePath), artifact));
  return [...byPath.values()];
}

export async function describeArtifact(filePath: string, outputRoot: string, kind: BuildArtifact['kind']): Promise<BuildArtifact> {
  const absolutePath = path.resolve(filePath);
  const relativePath = path.relative(path.resolve(outputRoot), absolutePath);
  if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) throw new BuildGraphValidationError(`产物越界：${filePath}`);
  const bytes = await fs.readFile(absolutePath);
  return { relativePath: relativePath.split(path.sep).join('/'), absolutePath, kind, size: bytes.byteLength, sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
}

function assertNotAborted(signal: AbortSignal): void {
  if (signal.aborted) throw signal.reason instanceof Error ? signal.reason : new BuildGraphCancelledError();
}
