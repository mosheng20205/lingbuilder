import type { ModuleCodeGeneratorContribution, ModuleTargetArch, ModuleTargetPlatform, ModuleTargetToolchain } from '../modules/types';

export type BuildStepPhase = 'resolve' | 'generate' | 'materialize' | 'compile' | 'link' | 'package';
export type BuildArtifactKind = 'source' | 'header' | 'content' | 'descriptor' | 'runtime';

export interface BuildTarget {
  platform: ModuleTargetPlatform;
  arch: ModuleTargetArch;
  toolchain: ModuleTargetToolchain;
  id?: string;
}

export interface BuildInput {
  path: string;
  /** A glob is evaluated relative to root; a normal path is a single file. */
  glob?: boolean;
  root?: string;
}

export interface BuildOutput {
  path: string;
  kind: BuildArtifactKind;
}

export interface BuildStep {
  id: string;
  provider: string;
  providerVersion: string;
  phase: BuildStepPhase;
  dependsOn: string[];
  inputs: BuildInput[];
  outputs: BuildOutput[];
  options: Record<string, unknown>;
}

export interface BuildArtifact {
  relativePath: string;
  absolutePath: string;
  kind: BuildArtifactKind;
  size: number;
  sha256: string;
}

export interface BuildStepResult {
  artifacts?: BuildArtifact[];
  diagnostics?: string[];
  logs?: string[];
}

export interface BuildStepContext {
  readonly signal: AbortSignal;
  readonly workspaceRoot: string;
  readonly projectRoot: string;
  readonly outputRoot: string;
  readonly target: BuildTarget;
  readonly step: BuildStep;
  report(progress: number, message?: string): void;
  log(message: string, level?: 'info' | 'warning' | 'error'): void;
}

export interface BuildProviderPlanContext {
  readonly signal: AbortSignal;
  readonly workspaceRoot: string;
  readonly projectRoot: string;
  readonly outputRoot: string;
  readonly target: BuildTarget;
  report(progress: number, message?: string): void;
  log(message: string, level?: 'info' | 'warning' | 'error'): void;
}

export interface BuildStepProvider {
  readonly id: string;
  readonly version: string;
  plan?(declaration: ModuleCodeGeneratorContribution, context: BuildProviderPlanContext): Promise<readonly BuildStep[]> | readonly BuildStep[];
  run(step: BuildStep, context: BuildStepContext): Promise<BuildStepResult | void>;
}

export interface BuildPipelineRequest {
  workspaceRoot: string;
  projectRoot?: string;
  outputRoot: string;
  projectId: string;
  target: BuildTarget;
  modules: readonly { manifest: { id: string; build?: { codeGenerators?: ModuleCodeGeneratorContribution[] } } }[];
  signal?: AbortSignal;
  report?(progress: number, message?: string): void;
  log?(message: string, level?: 'info' | 'warning' | 'error'): void;
  cache?: {
    isFresh(key: string, fingerprint: string): Promise<boolean>;
    record(key: string, fingerprint: string, outputs: readonly string[]): Promise<void>;
  };
  cacheKey?: string;
}

export interface BuildPipelineResult {
  steps: BuildStep[];
  artifacts: BuildArtifact[];
  diagnostics: string[];
  logs: string[];
  fingerprint?: string;
  incrementalHit?: boolean;
}
