export type MonacoFilePathOwner = object;

interface MonacoFilePathBinding {
  filePath: string;
  revision: number;
}

/**
 * Tracks the workspace path behind each live Monaco model URI.
 *
 * A model can be shown by more than one editor group, so bindings are owned by
 * editor instances instead of being deleted globally when one editor switches
 * files. Rebinding an owner atomically releases its previous URI, which also
 * prevents a renamed or replaced model from retaining a stale clangd path.
 */
export class MonacoFilePathRegistry {
  private readonly modelBindings = new Map<string, Map<MonacoFilePathOwner, MonacoFilePathBinding>>();
  private readonly ownerModels = new Map<MonacoFilePathOwner, string>();
  private revision = 0;

  bind(owner: MonacoFilePathOwner, modelUri: string, filePath: string): void {
    const previousModelUri = this.ownerModels.get(owner);
    if (previousModelUri && previousModelUri !== modelUri) {
      this.removeOwnerBinding(owner, previousModelUri);
    }

    const bindings = this.modelBindings.get(modelUri) || new Map<MonacoFilePathOwner, MonacoFilePathBinding>();
    // Reinsert updates the deterministic "latest live binding wins" order for
    // the brief render where two owners disagree during a file rename.
    bindings.delete(owner);
    bindings.set(owner, { filePath, revision: ++this.revision });
    this.modelBindings.set(modelUri, bindings);
    this.ownerModels.set(owner, modelUri);
  }

  resolve(modelUri: string): string | undefined {
    const bindings = this.modelBindings.get(modelUri);
    if (!bindings?.size) return undefined;

    let latest: MonacoFilePathBinding | undefined;
    for (const binding of bindings.values()) {
      if (!latest || binding.revision > latest.revision) latest = binding;
    }
    return latest?.filePath;
  }

  release(owner: MonacoFilePathOwner): void {
    const modelUri = this.ownerModels.get(owner);
    if (!modelUri) return;
    this.removeOwnerBinding(owner, modelUri);
  }

  private removeOwnerBinding(owner: MonacoFilePathOwner, modelUri: string): void {
    const bindings = this.modelBindings.get(modelUri);
    bindings?.delete(owner);
    if (bindings?.size === 0) this.modelBindings.delete(modelUri);
    this.ownerModels.delete(owner);
  }
}
