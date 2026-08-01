import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { ModuleCodeGeneratorContribution } from '../modules/types';
import { BuildGraphValidationError, executeBuildGraph, orderBuildSteps } from './buildGraph';
import { BuildStepProviderRegistry } from './providerRegistry';
import type { BuildPipelineRequest, BuildPipelineResult, BuildProviderPlanContext, BuildStep } from './types';

export class BuildPipelineService {
  constructor(private readonly registry: BuildStepProviderRegistry) {}

  async planCodeGenerators(request: BuildPipelineRequest): Promise<BuildStep[]> {
    const signal = request.signal || new AbortController().signal;
    const context: BuildProviderPlanContext = {
      signal,
      workspaceRoot: path.resolve(request.workspaceRoot),
      projectRoot: path.resolve(request.projectRoot || request.workspaceRoot),
      outputRoot: path.resolve(request.outputRoot),
      target: request.target,
      report: request.report,
      log: request.log
    };
    const steps: BuildStep[] = [];
    for (const module of request.modules) {
      const declarations = module.manifest.build?.codeGenerators || [];
      const declarationIds = new Set<string>();
      for (const declaration of declarations) {
        validateCodeGeneratorDeclaration(declaration, request.target);
        if (declarationIds.has(declaration.id)) {
          throw new BuildGraphValidationError(`模块 ${module.manifest.id} 的代码生成器 ID 重复：${declaration.id}`);
        }
        declarationIds.add(declaration.id);
        const provider = this.registry.get(declaration.provider);
        if (declaration.version && declaration.version !== provider.version) {
          throw new BuildGraphValidationError(`代码生成器 ${declaration.id} 要求 Provider ${declaration.provider}@${declaration.version}，当前为 ${provider.version}。`);
        }
        if (!provider.plan) throw new BuildGraphValidationError(`Provider ${declaration.provider} 未提供代码生成计划能力。`);
        const planned = await provider.plan(declaration, context);
        const localStepIds = new Set(planned.map(step => step.id));
        for (const step of planned) {
          const normalized = normalizeStep(step, module.manifest.id, declaration.id, provider.version, localStepIds);
          steps.push(normalized);
        }
      }
    }
    return orderBuildSteps(steps, this.registry, request.outputRoot, request.projectRoot || request.workspaceRoot);
  }

  async run(request: BuildPipelineRequest): Promise<BuildPipelineResult> {
    const steps = await this.planCodeGenerators(request);
    const fingerprint = await fingerprintBuildSteps(steps, request);
    const cacheKey = request.cacheKey || request.projectId;
    if (request.cache && await request.cache.isFresh(cacheKey, fingerprint)) {
      const artifacts = await describeExistingStepArtifacts(steps, request.outputRoot);
      const logs = ['代码生成增量缓存命中：输入、Provider 版本、选项、目标平台和工具链均未变化。'];
      request.log?.(logs[0]);
      request.report?.(100, logs[0]);
      return { steps, artifacts, diagnostics: [], logs, fingerprint, incrementalHit: true };
    }
    const result = await executeBuildGraph(steps, this.registry, {
      workspaceRoot: path.resolve(request.workspaceRoot),
      projectRoot: path.resolve(request.projectRoot || request.workspaceRoot),
      outputRoot: path.resolve(request.outputRoot),
      target: request.target,
      signal: request.signal,
      report: request.report,
      log: request.log
    });
    if (request.cache) await request.cache.record(cacheKey, fingerprint, result.artifacts.map(artifact => artifact.absolutePath));
    return { steps, ...result, fingerprint, incrementalHit: false };
  }
}

export function validateCodeGeneratorDeclaration(declaration: ModuleCodeGeneratorContribution, target: BuildPipelineRequest['target']): void {
  if (!declaration || typeof declaration !== 'object') throw new BuildGraphValidationError('代码生成器声明必须是对象。');
  if (!/^[a-z0-9][a-z0-9._-]{2,100}$/u.test(declaration.id || '')) throw new BuildGraphValidationError(`代码生成器 ID 无效：${declaration.id}`);
  if (!/^[a-z0-9][a-z0-9._-]{2,100}$/u.test(declaration.provider || '')) throw new BuildGraphValidationError(`代码生成器 Provider 无效：${declaration.provider}`);
  if (declaration.version !== undefined && (typeof declaration.version !== 'string' || !declaration.version.trim())) throw new BuildGraphValidationError(`代码生成器 ${declaration.id} 的 Provider 版本无效。`);
  if (!target || !['windows', 'linux', 'macos'].includes(target.platform) || !['win32', 'x64', 'arm64', 'any'].includes(target.arch) || !['msvc', 'gcc', 'clang', 'cmake', 'any'].includes(target.toolchain)) {
    throw new BuildGraphValidationError('代码生成器目标平台、架构或工具链不受支持。');
  }
  if (!declaration.inputs || typeof declaration.inputs !== 'object' || Array.isArray(declaration.inputs)
      || !Array.isArray(declaration.inputs.include) || declaration.inputs.include.length === 0) {
    throw new BuildGraphValidationError(`代码生成器 ${declaration.id} 至少需要一个输入 glob。`);
  }
  if (declaration.inputs.exclude !== undefined && !Array.isArray(declaration.inputs.exclude)) {
    throw new BuildGraphValidationError(`代码生成器 ${declaration.id} 的 inputs.exclude 必须是数组。`);
  }
  if (!Array.isArray(declaration.outputs) || declaration.outputs.length === 0) throw new BuildGraphValidationError(`代码生成器 ${declaration.id} 缺少输出声明。`);
  const outputPaths = new Set<string>();
  const targetId = target.id || `${target.platform}-${target.toolchain}-${target.arch}`;
  if (declaration.targetIds && declaration.targetIds.length > 0 && !declaration.targetIds.includes(targetId)) {
    throw new BuildGraphValidationError(`代码生成器 ${declaration.id} 不支持目标 ${targetId}。`);
  }
  for (const pattern of [...declaration.inputs.include, ...(declaration.inputs.exclude || [])]) {
    if (typeof pattern !== 'string' || !pattern.trim() || path.isAbsolute(pattern) || pattern.split(/[\\/]/u).includes('..')) {
      throw new BuildGraphValidationError(`代码生成器 ${declaration.id} 的输入路径不安全：${String(pattern)}`);
    }
  }
  if (declaration.inputs.root !== undefined
      && (typeof declaration.inputs.root !== 'string' || !declaration.inputs.root.trim()
        || path.isAbsolute(declaration.inputs.root) || declaration.inputs.root.split(/[\\/]/u).includes('..'))) {
    throw new BuildGraphValidationError(`代码生成器 ${declaration.id} 的输入根目录不安全。`);
  }
  for (const output of declaration.outputs) {
    if (!output || !output.path || path.isAbsolute(output.path) || output.path.split(/[\\/]/u).includes('..')) {
      throw new BuildGraphValidationError(`代码生成器 ${declaration.id} 的输出路径不安全。`);
    }
    if (!['source', 'header', 'content', 'descriptor', 'runtime'].includes(output.kind)) {
      throw new BuildGraphValidationError(`代码生成器 ${declaration.id} 的输出类型不受支持：${String(output.kind)}`);
    }
    const normalizedOutputPath = output.path.replace(/\\/gu, '/').toLowerCase();
    if (outputPaths.has(normalizedOutputPath)) throw new BuildGraphValidationError(`代码生成器 ${declaration.id} 的输出路径重复：${output.path}`);
    outputPaths.add(normalizedOutputPath);
  }
  if (declaration.targetIds !== undefined
      && (!Array.isArray(declaration.targetIds) || declaration.targetIds.some(targetId => typeof targetId !== 'string' || !targetId.trim()))) {
    throw new BuildGraphValidationError(`代码生成器 ${declaration.id} 的 targetIds 必须是非空文本数组。`);
  }
  const outputDirectory = declaration.options?.outputDirectory;
  if (outputDirectory !== undefined && (typeof outputDirectory !== 'string' || !outputDirectory.trim() || path.isAbsolute(outputDirectory) || outputDirectory.split(/[\\/]/u).includes('..'))) {
    throw new BuildGraphValidationError(`代码生成器 ${declaration.id} 的 outputDirectory 不安全。`);
  }
  if (declaration.options !== undefined
      && (!declaration.options || typeof declaration.options !== 'object' || Array.isArray(declaration.options))) {
    throw new BuildGraphValidationError(`代码生成器 ${declaration.id} 的 options 必须是结构化对象。`);
  }
  if (declaration.options) validateProviderOptions(declaration.options, declaration.id);
}

function validateProviderOptions(options: Record<string, unknown>, generatorId: string, trail = ''): void {
  for (const [key, value] of Object.entries(options)) {
    if (['command', 'commands', 'executable', 'exe', 'shell', 'powershell', 'script', 'javascript', 'cwd', 'workingdirectory'].includes(key.toLowerCase())) {
      throw new BuildGraphValidationError(`代码生成器 ${generatorId} 的 options.${trail ? `${trail}.` : ''}${key} 不允许注入命令或脚本。`);
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) validateProviderOptions(value as Record<string, unknown>, generatorId, trail ? `${trail}.${key}` : key);
  }
}

function normalizeStep(step: BuildStep, moduleId: string, generatorId: string, providerVersion: string, localStepIds: ReadonlySet<string>): BuildStep {
  const prefix = `${moduleId}.${generatorId}`;
  return {
    ...step,
    id: step.id.startsWith(`${prefix}.`) ? step.id : `${prefix}.${step.id}`,
    providerVersion,
    dependsOn: step.dependsOn.map(dependency => localStepIds.has(dependency) ? `${prefix}.${dependency}` : dependency),
    inputs: step.inputs.map(input => ({ ...input, path: input.path.replace(/\\/gu, '/') })),
    outputs: step.outputs.map(output => ({ ...output, path: output.path.replace(/\\/gu, '/') })),
    options: { ...step.options }
  };
}

export interface BuildPipelineCache {
  isFresh(key: string, fingerprint: string): Promise<boolean>;
  record(key: string, fingerprint: string, outputs: readonly string[]): Promise<void>;
}

export async function fingerprintBuildSteps(
  steps: readonly BuildStep[],
  request: Pick<BuildPipelineRequest, 'workspaceRoot' | 'projectRoot' | 'target'>
): Promise<string> {
  const inputRecords: Array<{ path: string; exists: boolean; sha256?: string; size?: number; mtimeMs?: number }> = [];
  const projectRoot = path.resolve(request.projectRoot || request.workspaceRoot);
  for (const input of steps.flatMap(step => step.inputs)) {
    const root = path.resolve(projectRoot, input.root || '.');
    const target = path.resolve(root, input.path);
    const relative = path.relative(projectRoot, target);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new BuildGraphValidationError(`构建输入越界：${input.path}`);
    try {
      const stat = await fs.stat(target);
      const bytes = await fs.readFile(target);
      inputRecords.push({ path: relative.replace(/\\/gu, '/'), exists: true, size: stat.size, mtimeMs: stat.mtimeMs, sha256: crypto.createHash('sha256').update(bytes).digest('hex') });
    } catch {
      inputRecords.push({ path: relative.replace(/\\/gu, '/'), exists: false });
    }
  }
  inputRecords.sort((left, right) => left.path.localeCompare(right.path));
  const descriptor = {
    target: request.target,
    inputs: inputRecords,
    steps: steps.map(step => ({
      id: step.id,
      provider: step.provider,
      providerVersion: step.providerVersion,
      phase: step.phase,
      dependsOn: step.dependsOn,
      outputs: step.outputs,
      options: step.options
    }))
  };
  return crypto.createHash('sha256').update(stableStringify(descriptor)).digest('hex');
}

async function describeExistingStepArtifacts(steps: readonly BuildStep[], outputRoot: string) {
  const artifacts = [];
  for (const step of steps) {
    for (const output of step.outputs) {
      const absolutePath = path.resolve(outputRoot, output.path);
      try {
        const stat = await fs.stat(absolutePath);
        if (!stat.isFile()) continue;
        const bytes = await fs.readFile(absolutePath);
        artifacts.push({
          relativePath: path.relative(path.resolve(outputRoot), absolutePath).replace(/\\/gu, '/'),
          absolutePath,
          kind: output.kind,
          size: bytes.byteLength,
          sha256: crypto.createHash('sha256').update(bytes).digest('hex')
        });
      } catch {
        // Cache freshness already checked the recorded outputs; a missing optional
        // declaration should not make a successful build look like a failure.
      }
    }
  }
  return artifacts;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}
