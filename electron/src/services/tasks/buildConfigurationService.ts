import fs from 'node:fs/promises';
import path from 'node:path';

export type BuildMode = 'Debug' | 'Release';
export type BuildArchitecture = 'Win32' | 'x64';
export interface BuildConfiguration { schemaVersion: 1; mode: BuildMode; architecture: BuildArchitecture }
export const DEFAULT_BUILD_CONFIGURATION: BuildConfiguration = { schemaVersion: 1, mode: 'Debug', architecture: 'Win32' };
export interface ModuleCompatibleBuildConfiguration {
  configuration: BuildConfiguration;
  changed: boolean;
  messages: string[];
}

const MODULE_ARCHITECTURE_REQUIREMENTS: Readonly<Record<string, BuildArchitecture>> = {
  'lingbuilder.cef3.browser': 'x64',
  'lingbuilder.fbro.browser': 'x64'
};

export class BuildConfigurationService {
  private readonly filePath: string;
  constructor(private readonly workspaceRoot: string) { this.filePath = path.join(workspaceRoot, '.lingbuilder', 'build-configuration.json'); }
  async read(): Promise<BuildConfiguration> {
    try { return validateBuildConfiguration(JSON.parse(await fs.readFile(this.filePath, 'utf8'))); }
    catch (error: any) { if (error?.code === 'ENOENT' || error instanceof SyntaxError) return { ...DEFAULT_BUILD_CONFIGURATION }; throw error; }
  }
  async write(value: unknown): Promise<BuildConfiguration> {
    const configuration = validateBuildConfiguration(value);
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.${process.pid}.tmp`;
    await fs.writeFile(temporary, JSON.stringify(configuration, null, 2), 'utf8'); await fs.rename(temporary, this.filePath);
    return configuration;
  }

  async ensureCompatibleWithModules(moduleIds: readonly string[]): Promise<ModuleCompatibleBuildConfiguration> {
    const resolved = resolveModuleCompatibleBuildConfiguration(await this.read(), moduleIds);
    if (resolved.changed) await this.write(resolved.configuration);
    return resolved;
  }
}

export function resolveModuleCompatibleBuildConfiguration(
  configuration: BuildConfiguration,
  moduleIds: readonly string[]
): ModuleCompatibleBuildConfiguration {
  const requiredArchitectures = new Set(moduleIds.map(moduleId => MODULE_ARCHITECTURE_REQUIREMENTS[moduleId]).filter(Boolean));
  if (requiredArchitectures.size === 0) {
    return { configuration: { ...configuration }, changed: false, messages: [] };
  }
  if (requiredArchitectures.size > 1) {
    throw new Error(`已启用模块要求互不兼容的构建架构：${[...requiredArchitectures].join('、')}。`);
  }
  const architecture = [...requiredArchitectures][0];
  if (architecture === configuration.architecture) {
    return { configuration: { ...configuration }, changed: false, messages: [] };
  }
  return {
    configuration: { ...configuration, architecture },
    changed: true,
    messages: [`${moduleIds.includes('lingbuilder.fbro.browser') ? 'FBro' : 'CEF3'} 浏览器模块仅支持 x64，构建架构已自动从 ${configuration.architecture} 切换为 ${architecture}。`]
  };
}

export function validateBuildConfiguration(value: any): BuildConfiguration {
  if (!value || (value.mode !== 'Debug' && value.mode !== 'Release') || (value.architecture !== 'Win32' && value.architecture !== 'x64')) {
    throw new Error('构建配置必须为 Debug/Release 和 Win32/x64 的有效组合。');
  }
  return { schemaVersion: 1, mode: value.mode, architecture: value.architecture };
}

export function getBuildCompilerFlags(configuration: BuildConfiguration, compiler: 'msvc' | 'g++' | 'clang++'): string[] {
  const debug = configuration.mode === 'Debug';
  if (compiler === 'msvc') return debug
    ? ['/Od', '/Zi', '/D_DEBUG', '/RTC1', '/MDd']
    : ['/O2', '/DNDEBUG', '/GL', '/MD'];
  const architecture = configuration.architecture === 'x64' ? '-m64' : '-m32';
  return debug ? [architecture, '-O0', '-g', '-D_DEBUG'] : [architecture, '-O2', '-DNDEBUG'];
}

export const getModuleTargetId = (configuration: BuildConfiguration) => `windows-msvc-${configuration.architecture === 'x64' ? 'x64' : 'win32'}`;
export const getBuildOutputSegment = (configuration: BuildConfiguration) => path.join(configuration.architecture, configuration.mode);
