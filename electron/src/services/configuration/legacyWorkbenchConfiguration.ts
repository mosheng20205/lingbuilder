import type { ConfigurationValue } from './types';
import type {
  WorkbenchConfigurationKey,
  WorkbenchConfigurationSnapshot
} from './workbenchConfiguration';

export const LEGACY_EDITOR_FONT_SIZE_KEY = 'lingbuilder.editor.fontSize';
export const LEGACY_EDITOR_EXPERIENCE_MODE_KEY = 'lingbuilder.editorExperienceMode';

export interface LegacyWorkbenchValues {
  editorFontSize: string | null;
  editorExperienceMode: string | null;
}

export interface LegacyWorkbenchMigrationUpdate {
  key: WorkbenchConfigurationKey;
  value: ConfigurationValue;
}

export interface LegacyWorkbenchMigrationPlan {
  updates: LegacyWorkbenchMigrationUpdate[];
  storageKeysToClear: string[];
}

/** 将旧 renderer localStorage 偏好迁移为可复制、可分作用域的用户配置。 */
export function planLegacyWorkbenchConfigurationMigration(
  snapshot: WorkbenchConfigurationSnapshot,
  legacy: LegacyWorkbenchValues
): LegacyWorkbenchMigrationPlan {
  const updates: LegacyWorkbenchMigrationUpdate[] = [];
  const storageKeysToClear: string[] = [];

  if (legacy.editorFontSize !== null) {
    storageKeysToClear.push(LEGACY_EDITOR_FONT_SIZE_KEY);
    const fontSetting = snapshot.settings.find(item => item.metadata.key === 'editor.fontSize');
    const parsed = Number.parseInt(legacy.editorFontSize, 10);
    if (fontSetting?.inspection.userValue === undefined && Number.isFinite(parsed)) {
      updates.push({ key: 'editor.fontSize', value: Math.max(10, Math.min(24, Math.round(parsed))) });
    }
  }

  if (legacy.editorExperienceMode !== null) {
    storageKeysToClear.push(LEGACY_EDITOR_EXPERIENCE_MODE_KEY);
    const modeSetting = snapshot.settings.find(item => item.metadata.key === 'editor.experienceMode');
    if (
      modeSetting?.inspection.userValue === undefined
      && ['beginner', 'professional', 'native'].includes(legacy.editorExperienceMode)
    ) {
      updates.push({ key: 'editor.experienceMode', value: legacy.editorExperienceMode });
    }
  }

  return { updates, storageKeysToClear };
}
