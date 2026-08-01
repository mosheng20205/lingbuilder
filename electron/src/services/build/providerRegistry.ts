import type { BuildStepProvider } from './types';

export class DuplicateBuildProviderError extends Error {
  constructor(public readonly providerId: string) {
    super(`构建 Provider 已注册：${providerId}`);
    this.name = 'DuplicateBuildProviderError';
  }
}
export class UnknownBuildProviderError extends Error {
  constructor(public readonly providerId: string) {
    super(`未注册的构建 Provider：${providerId}`);
    this.name = 'UnknownBuildProviderError';
  }
}

export class BuildStepProviderRegistry {
  private readonly providers = new Map<string, BuildStepProvider>();

  register(provider: BuildStepProvider): () => void {
    const id = provider.id.trim();
    if (!id) throw new Error('构建 Provider ID 不能为空。');
    if (!/^[-a-z0-9._]+$/u.test(id)) throw new Error(`构建 Provider ID 无效：${id}`);
    if (!provider.version.trim()) throw new Error(`构建 Provider ${id} 缺少版本。`);
    if (this.providers.has(id)) throw new DuplicateBuildProviderError(id);
    this.providers.set(id, provider);
    return () => {
      if (this.providers.get(id) === provider) this.providers.delete(id);
    };
  }

  get(id: string): BuildStepProvider {
    const provider = this.providers.get(id.trim());
    if (!provider) throw new UnknownBuildProviderError(id);
    return provider;
  }

  has(id: string): boolean { return this.providers.has(id.trim()); }

  list(): BuildStepProvider[] {
    return [...this.providers.values()].sort((left, right) => left.id.localeCompare(right.id));
  }
}

export function createBuildStepProviderRegistry(providers: readonly BuildStepProvider[] = []): BuildStepProviderRegistry {
  const registry = new BuildStepProviderRegistry();
  providers.forEach(provider => registry.register(provider));
  return registry;
}
