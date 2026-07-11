export type ConfigurationPrimitive = null | boolean | number | string;

export type ConfigurationValue =
  | ConfigurationPrimitive
  | ConfigurationValue[]
  | { [key: string]: ConfigurationValue };

export type ConfigurationValueType =
  | 'null'
  | 'boolean'
  | 'number'
  | 'integer'
  | 'string'
  | 'array'
  | 'object';

export interface ConfigurationPropertySchema {
  type: ConfigurationValueType | ConfigurationValueType[];
  default: ConfigurationValue;
  description?: string;
  enum?: ConfigurationValue[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  items?: Omit<ConfigurationPropertySchema, 'default'>;
  properties?: Record<string, Omit<ConfigurationPropertySchema, 'default'>>;
  required?: string[];
  additionalProperties?: boolean | Omit<ConfigurationPropertySchema, 'default'>;
}

export type ConfigurationSchema = Record<string, ConfigurationPropertySchema>;

export type ConfigurationTarget = 'user' | 'workspace';

export interface ConfigurationInspection<T extends ConfigurationValue = ConfigurationValue> {
  key: string;
  defaultValue: T;
  userValue: T | undefined;
  workspaceValue: T | undefined;
  value: T;
  source: 'default' | ConfigurationTarget;
}

export interface ConfigurationChangeEvent<T extends ConfigurationValue = ConfigurationValue> {
  key: string;
  target: ConfigurationTarget;
  oldValue: T | undefined;
  newValue: T | undefined;
  oldEffectiveValue: T;
  newEffectiveValue: T;
  effectiveChanged: boolean;
}

export interface ConfigurationDiagnostic {
  code:
    | 'CORRUPT_FILE'
    | 'READ_FAILED'
    | 'WRITE_FAILED'
    | 'LEGACY_MIGRATED'
    | 'UNSUPPORTED_VERSION'
    | 'INVALID_DOCUMENT'
    | 'UNKNOWN_KEY'
    | 'INVALID_VALUE';
  severity: 'info' | 'warning' | 'error';
  message: string;
  target?: ConfigurationTarget;
  key?: string;
}

export interface ConfigurationDisposable {
  dispose(): void;
}

export interface PersistedConfigurationDocument {
  schemaVersion: 1;
  values: Record<string, ConfigurationValue>;
}

export interface ConfigurationStorageAdapter {
  readonly id: string;
  read(): Promise<unknown | undefined>;
  write(document: PersistedConfigurationDocument): Promise<void>;
}

export class ConfigurationValidationError extends Error {
  constructor(
    public readonly key: string,
    public readonly details: string[]
  ) {
    super(`设置“${key}”的值无效：${details.join('；')}`);
    this.name = 'ConfigurationValidationError';
  }
}

export type ConfigurationPersistenceErrorCode =
  | 'CORRUPT_JSON'
  | 'READ_FAILED'
  | 'WRITE_FAILED'
  | 'UNSAFE_PATH';

export class ConfigurationPersistenceError extends Error {
  constructor(
    public readonly code: ConfigurationPersistenceErrorCode,
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'ConfigurationPersistenceError';
  }
}
