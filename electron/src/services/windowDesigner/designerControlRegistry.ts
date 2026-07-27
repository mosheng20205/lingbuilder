import type { InstalledModule, ModuleDesignerControlContribution } from '../modules/types';
import type { LingControl, LingControlType } from './types';
import { getWin32ControlDefinition, type Win32ControlDefinition } from './win32ControlRegistry';

export const NEW_EMOJI_DESIGNER_BACKEND = 'new-emoji';
export const WIN32_DESIGNER_BACKEND = 'win32';

export interface DesignerControlDefinition {
  id: string;
  moduleId: string;
  backend: string;
  previewType: LingControlType;
  contribution?: ModuleDesignerControlContribution;
  builtin?: Win32ControlDefinition;
  label: string;
  category: string;
  isContainer: boolean;
  isVisual: boolean;
}

export class DesignerControlRegistry {
  private readonly byId = new Map<string, DesignerControlDefinition>();

  constructor(installedModules: readonly InstalledModule[] = []) {
    for (const module of installedModules) this.registerModule(module);
  }

  registerModule(module: InstalledModule): void {
    for (const contribution of module.manifest.contributes?.designerControls || []) {
      const id = contribution.namespacedType || `${module.manifest.id}/${contribution.type}`;
      this.byId.set(id, {
        id,
        moduleId: module.manifest.id,
        backend: contribution.backend || module.manifest.designer?.backend || WIN32_DESIGNER_BACKEND,
        previewType: (contribution.previewType || contribution.type) as LingControlType,
        contribution,
        label: contribution.label,
        category: contribution.category || module.manifest.name,
        isContainer: contribution.isContainer === true,
        isVisual: contribution.isVisual !== false
      });
    }
  }

  get(id: string | undefined): DesignerControlDefinition | undefined {
    if (!id) return undefined;
    const moduleDefinition = this.byId.get(id);
    if (moduleDefinition) return moduleDefinition;
    const builtin = getWin32ControlDefinition(id as LingControlType);
    if (!builtin) return undefined;
    return {
      id,
      moduleId: builtin.moduleId,
      backend: WIN32_DESIGNER_BACKEND,
      previewType: id as LingControlType,
      builtin,
      label: builtin.label,
      category: builtin.category,
      isContainer: builtin.isContainer === true,
      isVisual: builtin.isVisual !== false
    };
  }

  forBackend(backend: string): DesignerControlDefinition[] {
    return [...this.byId.values()]
      .filter(definition => definition.backend === backend && definition.isVisual)
      .sort((left, right) => left.category.localeCompare(right.category, 'zh-CN') || left.label.localeCompare(right.label, 'zh-CN'));
  }

  definitionForControl(control: Pick<LingControl, 'type' | 'designerType'>): DesignerControlDefinition | undefined {
    return this.get(control.designerType || control.type);
  }
}

export function migrateDesignerBackend(
  backend: string | undefined,
  newEmojiEnabled: boolean
): string {
  return backend || (newEmojiEnabled ? 'new-emoji' : 'win32');
}
