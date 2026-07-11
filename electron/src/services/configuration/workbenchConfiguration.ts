import path from 'node:path';

import {
  validateShortcutOverrides,
  WORKBENCH_DEFAULT_COMMAND_BINDINGS
} from '../commands';
import { ConfigurationService } from './configurationService';
import { createJsonFileConfigurationStorageAdapter } from './storageAdapters';
import {
  ConfigurationDiagnostic,
  ConfigurationInspection,
  ConfigurationPersistenceError,
  ConfigurationSchema,
  ConfigurationTarget,
  ConfigurationValidationError,
  ConfigurationValue
} from './types';

export const WORKBENCH_CONFIGURATION_KEYS = [
  'editor.fontSize',
  'editor.experienceMode',
  'files.autoSave',
  'files.autoSaveDelay',
  'workbench.colorTheme',
  'workbench.sidebar.visible',
  'workbench.panel.visible',
  'workbench.aiPanel.visible',
  'keyboard.shortcuts'
] as const;

export type WorkbenchConfigurationKey = typeof WORKBENCH_CONFIGURATION_KEYS[number];

export type WorkbenchConfigurationCategory = '编辑器' | '工作台' | '键盘快捷键';

export interface WorkbenchConfigurationEnumOption {
  value: string;
  label: string;
  description: string;
}

export interface WorkbenchConfigurationMetadata {
  key: WorkbenchConfigurationKey;
  category: WorkbenchConfigurationCategory;
  title: string;
  description: string;
  targets: readonly ConfigurationTarget[];
  enumOptions?: readonly WorkbenchConfigurationEnumOption[];
  minimum?: number;
  maximum?: number;
}

export const WORKBENCH_CONFIGURATION_SCHEMA: ConfigurationSchema = {
  'editor.fontSize': {
    type: 'integer',
    default: 13,
    minimum: 10,
    maximum: 24,
    description: '中文代码编辑器字号，单位为像素。'
  },
  'editor.experienceMode': {
    type: 'string',
    default: 'beginner',
    enum: ['beginner', 'professional', 'native'],
    description: '中文代码编辑器的使用体验模式。'
  },
  'files.autoSave': {
    type: 'string', default: 'off', enum: ['off', 'afterDelay'],
    description: '是否在编辑停止一段时间后自动保存。'
  },
  'files.autoSaveDelay': {
    type: 'integer', default: 1200, minimum: 300, maximum: 10000,
    description: '自动保存延迟，单位为毫秒。'
  },
  'workbench.colorTheme': {
    type: 'string',
    default: 'dark',
    enum: ['dark', 'light'],
    description: '工作台当前使用的颜色主题。'
  },
  'workbench.sidebar.visible': {
    type: 'boolean',
    default: true,
    description: '是否显示左侧资源管理器。'
  },
  'workbench.panel.visible': {
    type: 'boolean',
    default: true,
    description: '是否显示底部面板。'
  },
  'workbench.aiPanel.visible': {
    type: 'boolean',
    default: true,
    description: '是否显示右侧 AI 助手面板。'
  },
  'keyboard.shortcuts': {
    type: 'object',
    default: {},
    additionalProperties: {
      type: 'string',
      minLength: 1,
      pattern: '^(?:(?=.*(?:Ctrl|Meta|Alt)\\+)(?:(?:Ctrl|Meta|Alt|Shift)\\+)+[^+\\s]+|(?:Shift\\+)?F(?:[1-9]|1\\d|2[0-4]))$'
    },
    description: '命令标识到快捷键文本的自定义映射。'
  }
};

const USER_AND_WORKSPACE_TARGETS = ['user', 'workspace'] as const;

export const WORKBENCH_CONFIGURATION_METADATA: readonly WorkbenchConfigurationMetadata[] = [
  {
    key: 'editor.fontSize',
    category: '编辑器',
    title: '编辑器字号',
    description: '设置中文代码编辑器字号（10-24 像素）。',
    targets: USER_AND_WORKSPACE_TARGETS,
    minimum: 10,
    maximum: 24
  },
  {
    key: 'editor.experienceMode',
    category: '编辑器',
    title: '编辑器体验模式',
    description: '选择新手、专业 Monaco 编辑器或原生 C++ 预览体验。',
    targets: USER_AND_WORKSPACE_TARGETS,
    enumOptions: [
      { value: 'beginner', label: '新手', description: '提供结构化中文代码编辑与引导。' },
      { value: 'professional', label: '专业', description: '使用完整 Monaco 中文代码编辑器。' },
      { value: 'native', label: '原生预览', description: '查看确定性生成的原生 C++ 结果。' }
    ]
  },
  {
    key: 'files.autoSave', category: '编辑器', title: '自动保存',
    description: '选择关闭或在编辑停止后保存。', targets: USER_AND_WORKSPACE_TARGETS,
    enumOptions: [
      { value: 'off', label: '关闭', description: '仅手动保存。' },
      { value: 'afterDelay', label: '延迟后', description: '在指定延迟后自动保存。' }
    ]
  },
  {
    key: 'files.autoSaveDelay', category: '编辑器', title: '自动保存延迟',
    description: '自动保存前等待的毫秒数（300-10000）。', targets: USER_AND_WORKSPACE_TARGETS,
    minimum: 300, maximum: 10000
  },
  {
    key: 'workbench.colorTheme',
    category: '工作台',
    title: '颜色主题',
    description: '切换工作台暗色或亮色主题。',
    targets: USER_AND_WORKSPACE_TARGETS,
    enumOptions: [
      { value: 'dark', label: '暗色', description: '使用暗色工作台配色。' },
      { value: 'light', label: '亮色', description: '使用亮色工作台配色。' }
    ]
  },
  {
    key: 'workbench.sidebar.visible',
    category: '工作台',
    title: '显示侧边栏',
    description: '控制左侧资源管理器是否可见。',
    targets: USER_AND_WORKSPACE_TARGETS
  },
  {
    key: 'workbench.panel.visible',
    category: '工作台',
    title: '显示底部面板',
    description: '控制终端、输出和问题等底部面板是否可见。',
    targets: USER_AND_WORKSPACE_TARGETS
  },
  {
    key: 'workbench.aiPanel.visible',
    category: '工作台',
    title: '显示 AI 助手',
    description: '控制右侧 AI 助手面板是否可见。',
    targets: USER_AND_WORKSPACE_TARGETS
  },
  {
    key: 'keyboard.shortcuts',
    category: '键盘快捷键',
    title: '自定义快捷键',
    description: '使用命令标识为键、快捷键文本为值的对象覆盖默认快捷键。',
    targets: USER_AND_WORKSPACE_TARGETS
  }
];

export interface WorkbenchConfigurationSnapshotItem {
  metadata: WorkbenchConfigurationMetadata;
  inspection: ConfigurationInspection;
}

export interface WorkbenchConfigurationSnapshot {
  schemaVersion: 1;
  settings: WorkbenchConfigurationSnapshotItem[];
  diagnostics: ConfigurationDiagnostic[];
}

export interface WorkbenchConfigurationServiceOptions {
  workspaceRoot: string;
  userSettingsPath: string;
}

interface WorkbenchConfigurationPaths {
  workspaceRoot: string;
  workspaceSettingsPath: string;
  userSettingsPath: string;
}

export class WorkbenchConfigurationService extends ConfigurationService {
  readonly workspaceRoot: string;
  readonly workspaceSettingsPath: string;
  readonly userSettingsPath: string;

  constructor(paths: WorkbenchConfigurationPaths) {
    super({
      schema: WORKBENCH_CONFIGURATION_SCHEMA,
      userStorage: createJsonFileConfigurationStorageAdapter({
        id: 'workbench-user-settings',
        resolveFilePath: () => paths.userSettingsPath
      }),
      workspaceStorage: createJsonFileConfigurationStorageAdapter({
        id: 'workbench-workspace-settings',
        resolveFilePath: () => paths.workspaceSettingsPath
      })
    });
    this.workspaceRoot = paths.workspaceRoot;
    this.workspaceSettingsPath = paths.workspaceSettingsPath;
    this.userSettingsPath = paths.userSettingsPath;
  }

  snapshot(): WorkbenchConfigurationSnapshot {
    return {
      schemaVersion: 1,
      settings: WORKBENCH_CONFIGURATION_METADATA.map(metadata => ({
        metadata: cloneMetadata(metadata),
        inspection: this.inspect(metadata.key)
      })),
      diagnostics: this.getDiagnostics()
    };
  }

  serializeSnapshot(space?: number): string {
    return JSON.stringify(this.snapshot(), null, space);
  }

  get<T extends ConfigurationValue = ConfigurationValue>(key: WorkbenchConfigurationKey): T {
    return super.get<T>(key);
  }

  inspect<T extends ConfigurationValue = ConfigurationValue>(key: WorkbenchConfigurationKey): ConfigurationInspection<T> {
    return super.inspect<T>(key);
  }

  async update(
    key: WorkbenchConfigurationKey,
    value: ConfigurationValue,
    target: ConfigurationTarget
  ): Promise<void> {
    let nextValue = value;
    if (
      key === 'keyboard.shortcuts'
      && isStringRecord(value)
      && Object.values(value).every(shortcut => shortcut.trim().length > 0)
    ) {
      const validation = validateShortcutOverrides(value, WORKBENCH_DEFAULT_COMMAND_BINDINGS);
      const details = Array.from(new Set(Object.entries(validation.errors).map(
        ([commandId, message]) => `${commandId}：${message}`
      )));
      if (details.length > 0) throw new ConfigurationValidationError(key, details);
      nextValue = validation.normalized;
    }
    await super.update(key, nextValue, target);
  }

  async delete(key: WorkbenchConfigurationKey, target: ConfigurationTarget): Promise<void> {
    await super.delete(key, target);
  }
}

export function createWorkbenchConfigurationService(
  options: WorkbenchConfigurationServiceOptions
): WorkbenchConfigurationService {
  const workspaceRoot = validateAbsolutePath(options?.workspaceRoot, '工作区根目录');
  const userSettingsPath = validateAbsolutePath(options?.userSettingsPath, '用户设置文件');
  const workspaceSettingsPath = path.join(workspaceRoot, '.lingbuilder', 'settings.json');

  return new WorkbenchConfigurationService({
    workspaceRoot,
    workspaceSettingsPath,
    userSettingsPath
  });
}

function validateAbsolutePath(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim() || value.includes('\0') || !path.isAbsolute(value)) {
    throw new ConfigurationPersistenceError(
      'UNSAFE_PATH',
      `${label}必须是有效的绝对路径。`
    );
  }
  return path.resolve(value);
}

function cloneMetadata(metadata: WorkbenchConfigurationMetadata): WorkbenchConfigurationMetadata {
  return {
    ...metadata,
    targets: [...metadata.targets],
    enumOptions: metadata.enumOptions?.map(option => ({ ...option }))
  };
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return Boolean(value)
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.values(value as Record<string, unknown>).every(item => typeof item === 'string');
}
