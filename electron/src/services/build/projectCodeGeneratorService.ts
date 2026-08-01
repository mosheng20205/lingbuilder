import fs from 'node:fs/promises';
import path from 'node:path';
import type { InstalledModule, ModuleTargetArch, ModuleTargetPlatform, ModuleTargetToolchain } from '../modules/types';
import type { GeneratedProjectTextFile } from '../windowDesigner/generatedProjectFileService';
import { describeArtifact } from './buildGraph';
import type { BuildArtifact, BuildPipelineRequest, BuildPipelineResult, BuildTarget } from './types';
import { BuildPipelineService } from './buildPipeline';

export interface ProjectCodeGeneratorOptions {
  service: BuildPipelineService;
  workspaceRoot: string;
  projectRoot: string;
  outputRoot: string;
  exportRoot: string;
  projectId: string;
  modules: readonly InstalledModule[];
  target: BuildTarget;
  signal?: AbortSignal;
  cache?: BuildPipelineRequest['cache'];
  cacheKey?: string;
  report?(progress: number, message?: string): void;
  log?(message: string, level?: 'info' | 'warning' | 'error'): void;
}

export interface ProjectCodeGeneratorResult extends BuildPipelineResult {
  textFiles: GeneratedProjectTextFile[];
  outputFiles: string[];
  exportFiles: string[];
}

/**
 * Runs host-owned generators and mirrors their declared artifacts into the
 * portable export directory. No module-provided command line is executed here.
 */
export async function runProjectCodeGenerators(options: ProjectCodeGeneratorOptions): Promise<ProjectCodeGeneratorResult> {
  const result = await options.service.run({
    workspaceRoot: path.resolve(options.workspaceRoot),
    projectRoot: path.resolve(options.projectRoot),
    outputRoot: path.resolve(options.outputRoot),
    projectId: options.projectId,
    target: options.target,
    modules: options.modules,
    signal: options.signal,
    cache: options.cache,
    cacheKey: options.cacheKey,
    report: options.report,
    log: options.log
  });
  const outputRoot = path.resolve(options.outputRoot);
  const exportRoot = path.resolve(options.exportRoot);
  const textFiles: GeneratedProjectTextFile[] = [];
  const outputFiles: string[] = [];
  const exportFiles: string[] = [];
  const inputArtifacts: BuildArtifact[] = [];
  const copiedInputPaths = new Set<string>();
  const generatedPaths = new Set(result.artifacts.map(artifact => artifact.relativePath.replace(/\\/gu, '/').toLowerCase()));
  for (const artifact of result.artifacts) {
    const relativePath = assertArtifactPath(artifact, outputRoot);
    const sourcePath = path.resolve(outputRoot, relativePath);
    const exportPath = path.resolve(exportRoot, relativePath);
    if (sourcePath !== exportPath) {
      await fs.mkdir(path.dirname(exportPath), { recursive: true });
      await fs.copyFile(sourcePath, exportPath);
    }
    outputFiles.push(sourcePath);
    exportFiles.push(exportPath);
    if (artifact.kind === 'source' || artifact.kind === 'header' || artifact.kind === 'content') {
      textFiles.push({ relativePath, content: await fs.readFile(sourcePath, 'utf8') });
    }
  }

  // Keep declarative generator inputs (especially .proto imports) in both the
  // build tree and the portable export. This makes an exported project
  // reproducible without reaching back into the original workspace.
  const projectRoot = path.resolve(options.projectRoot);
  for (const input of result.steps.flatMap(step => step.inputs)) {
    if (input.glob || !input.path.toLowerCase().endsWith('.proto')) continue;
    const inputRoot = path.resolve(projectRoot, input.root || '.');
    const inputPath = path.resolve(inputRoot, input.path);
    const relativeToProject = path.relative(projectRoot, inputPath).replace(/\\/gu, '/');
    if (!relativeToProject || relativeToProject === '..' || relativeToProject.startsWith('../') || path.isAbsolute(relativeToProject)) {
      throw new Error(`代码生成输入路径越界：${input.path}`);
    }
    if (copiedInputPaths.has(relativeToProject.toLowerCase())) continue;
    copiedInputPaths.add(relativeToProject.toLowerCase());
    if (generatedPaths.has(relativeToProject.toLowerCase())) {
      throw new Error(`代码生成输入不能覆盖生成产物：${relativeToProject}`);
    }
    let sourceStat;
    try {
      sourceStat = await fs.stat(inputPath);
    } catch {
      continue;
    }
    if (!sourceStat.isFile()) continue;
    const outputPath = path.resolve(outputRoot, relativeToProject);
    const exportPath = path.resolve(exportRoot, relativeToProject);
    await copyFileAtomically(inputPath, outputPath, inputPath === outputPath);
    await copyFileAtomically(inputPath, exportPath, inputPath === exportPath);
    const artifact = await describeArtifact(outputPath, outputRoot, 'content');
    inputArtifacts.push(artifact);
    textFiles.push({ relativePath: artifact.relativePath, content: await fs.readFile(outputPath, 'utf8') });
    outputFiles.push(outputPath);
    exportFiles.push(exportPath);
  }
  return { ...result, artifacts: [...result.artifacts, ...inputArtifacts], textFiles, outputFiles, exportFiles };
}

async function copyFileAtomically(sourcePath: string, targetPath: string, samePath: boolean): Promise<void> {
  if (samePath) return;
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  const temporaryPath = `${targetPath}.${process.pid}.input.tmp`;
  await fs.copyFile(sourcePath, temporaryPath);
  await fs.rename(temporaryPath, targetPath).catch(async error => {
    await fs.rm(temporaryPath, { force: true });
    throw error;
  });
}

function assertArtifactPath(artifact: BuildArtifact, outputRoot: string): string {
  const relativePath = artifact.relativePath.replace(/\\/gu, '/');
  if (!relativePath || path.posix.isAbsolute(relativePath) || relativePath.split('/').includes('..')) {
    throw new Error(`代码生成产物路径不安全：${artifact.relativePath}`);
  }
  const resolved = path.resolve(outputRoot, relativePath);
  const relative = path.relative(outputRoot, resolved);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`代码生成产物越界：${artifact.relativePath}`);
  }
  return relativePath;
}

export function createWindowsMsvcBuildTarget(arch: ModuleTargetArch = 'win32'): BuildTarget {
  return {
    id: `windows-msvc-${arch === 'x64' ? 'x64' : 'win32'}`,
    platform: 'windows' as ModuleTargetPlatform,
    arch,
    toolchain: 'msvc' as ModuleTargetToolchain
  };
}
