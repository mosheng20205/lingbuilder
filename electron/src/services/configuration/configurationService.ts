import {
  ConfigurationChangeEvent,
  ConfigurationDiagnostic,
  ConfigurationDisposable,
  ConfigurationInspection,
  ConfigurationPersistenceError,
  ConfigurationPropertySchema,
  ConfigurationSchema,
  ConfigurationStorageAdapter,
  ConfigurationTarget,
  ConfigurationValidationError,
  ConfigurationValue,
  ConfigurationValueType,
  PersistedConfigurationDocument
} from './types';

const CURRENT_SCHEMA_VERSION = 1;

export interface ConfigurationServiceOptions {
  schema: ConfigurationSchema;
  userStorage?: ConfigurationStorageAdapter;
  workspaceStorage?: ConfigurationStorageAdapter;
}

export class ConfigurationService {
  private readonly schema: ConfigurationSchema;
  private readonly storages: Partial<Record<ConfigurationTarget, ConfigurationStorageAdapter>>;
  private readonly values: Record<ConfigurationTarget, Map<string, ConfigurationValue>> = {
    user: new Map(),
    workspace: new Map()
  };
  private readonly listeners = new Set<(event: ConfigurationChangeEvent) => void>();
  private readonly diagnostics: ConfigurationDiagnostic[] = [];
  private initialized = false;
  private initializationPromise?: Promise<void>;
  private operationQueue: Promise<void> = Promise.resolve();

  constructor(options: ConfigurationServiceOptions) {
    this.schema = cloneSchema(options.schema);
    this.storages = {
      user: options.userStorage,
      workspace: options.workspaceStorage
    };
    this.validateSchema();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initializationPromise ||= this.enqueue(async () => {
      if (this.initialized) return;
      await Promise.all([
        this.loadTarget('user'),
        this.loadTarget('workspace')
      ]);
      this.initialized = true;
    });
    await this.initializationPromise;
  }

  get<T extends ConfigurationValue = ConfigurationValue>(key: string): T {
    this.assertInitialized();
    return cloneValue(this.inspect<T>(key).value);
  }

  inspect<T extends ConfigurationValue = ConfigurationValue>(key: string): ConfigurationInspection<T> {
    this.assertInitialized();
    const property = this.getSchemaProperty(key);
    const userValue = this.values.user.get(key);
    const workspaceValue = this.values.workspace.get(key);
    const source = workspaceValue !== undefined
      ? 'workspace'
      : userValue !== undefined
        ? 'user'
        : 'default';
    const effectiveValue = workspaceValue ?? userValue ?? property.default;

    return {
      key,
      defaultValue: cloneValue(property.default) as T,
      userValue: cloneOptionalValue(userValue) as T | undefined,
      workspaceValue: cloneOptionalValue(workspaceValue) as T | undefined,
      value: cloneValue(effectiveValue) as T,
      source
    };
  }

  async update(key: string, value: ConfigurationValue, target: ConfigurationTarget): Promise<void> {
    await this.initialize();
    return await this.enqueue(async () => {
      const property = this.getSchemaProperty(key);
      const validationErrors = validateValue(value, property, key);
      if (validationErrors.length > 0) {
        throw new ConfigurationValidationError(key, validationErrors);
      }

      const layer = this.values[target];
      const oldLayerValue = layer.get(key);
      if (oldLayerValue !== undefined && deepEqual(oldLayerValue, value)) return;
      const oldEffectiveValue = this.getEffectiveValue(key);
      const nextLayer = new Map(layer);
      nextLayer.set(key, cloneValue(value));
      await this.persistTarget(target, nextLayer);
      this.values[target] = nextLayer;
      const newEffectiveValue = this.getEffectiveValue(key);
      this.emitChange({
        key,
        target,
        oldValue: cloneOptionalValue(oldLayerValue),
        newValue: cloneValue(value),
        oldEffectiveValue: cloneValue(oldEffectiveValue),
        newEffectiveValue: cloneValue(newEffectiveValue),
        effectiveChanged: !deepEqual(oldEffectiveValue, newEffectiveValue)
      });
    });
  }

  async delete(key: string, target: ConfigurationTarget): Promise<void> {
    await this.initialize();
    return await this.enqueue(async () => {
      this.getSchemaProperty(key);
      const layer = this.values[target];
      const oldLayerValue = layer.get(key);
      if (oldLayerValue === undefined) return;
      const oldEffectiveValue = this.getEffectiveValue(key);
      const nextLayer = new Map(layer);
      nextLayer.delete(key);
      await this.persistTarget(target, nextLayer);
      this.values[target] = nextLayer;
      const newEffectiveValue = this.getEffectiveValue(key);
      this.emitChange({
        key,
        target,
        oldValue: cloneValue(oldLayerValue),
        newValue: undefined,
        oldEffectiveValue: cloneValue(oldEffectiveValue),
        newEffectiveValue: cloneValue(newEffectiveValue),
        effectiveChanged: !deepEqual(oldEffectiveValue, newEffectiveValue)
      });
    });
  }

  onDidChange(listener: (event: ConfigurationChangeEvent) => void): ConfigurationDisposable {
    this.listeners.add(listener);
    let disposed = false;
    return {
      dispose: () => {
        if (disposed) return;
        disposed = true;
        this.listeners.delete(listener);
      }
    };
  }

  getDiagnostics(): ConfigurationDiagnostic[] {
    return this.diagnostics.map(diagnostic => ({ ...diagnostic }));
  }

  private async loadTarget(target: ConfigurationTarget): Promise<void> {
    const storage = this.storages[target];
    if (!storage) return;
    let rawDocument: unknown;
    try {
      rawDocument = await storage.read();
    } catch (error) {
      this.addReadDiagnostic(target, error);
      return;
    }
    if (rawDocument === undefined) return;

    const decoded = this.decodeDocument(rawDocument, target);
    if (!decoded) return;
    const normalized = new Map<string, ConfigurationValue>();
    let discardedValues = false;

    for (const [key, value] of Object.entries(decoded.values)) {
      const property = this.schema[key];
      if (!property) {
        discardedValues = true;
        this.diagnostics.push({
          code: 'UNKNOWN_KEY',
          severity: 'warning',
          target,
          key,
          message: `${targetLabel(target)}设置包含未知项“${key}”，已忽略。`
        });
        continue;
      }
      const validationErrors = validateValue(value, property, key);
      if (validationErrors.length > 0) {
        discardedValues = true;
        this.diagnostics.push({
          code: 'INVALID_VALUE',
          severity: 'warning',
          target,
          key,
          message: `${targetLabel(target)}设置“${key}”无效，已回退到较低优先级：${validationErrors.join('；')}`
        });
        continue;
      }
      normalized.set(key, cloneValue(value));
    }

    this.values[target] = normalized;
    if (decoded.migrated || discardedValues) {
      try {
        await this.persistTarget(target, normalized);
      } catch (error) {
        this.addWriteDiagnostic(target, error);
      }
    }
  }

  private decodeDocument(
    rawDocument: unknown,
    target: ConfigurationTarget
  ): { values: Record<string, ConfigurationValue>; migrated: boolean } | undefined {
    if (!isPlainObject(rawDocument)) {
      this.diagnostics.push({
        code: 'INVALID_DOCUMENT',
        severity: 'error',
        target,
        message: `${targetLabel(target)}设置文件结构无效，已使用默认设置。`
      });
      return undefined;
    }

    if (!Object.prototype.hasOwnProperty.call(rawDocument, 'schemaVersion')) {
      const legacyValues = toConfigurationRecord(rawDocument);
      if (!legacyValues) {
        this.diagnostics.push({
          code: 'INVALID_DOCUMENT',
          severity: 'error',
          target,
          message: `${targetLabel(target)}旧版设置文件包含无法读取的值，已使用默认设置。`
        });
        return undefined;
      }
      this.diagnostics.push({
        code: 'LEGACY_MIGRATED',
        severity: 'info',
        target,
        message: `已将${targetLabel(target)}旧版设置迁移到版本 ${CURRENT_SCHEMA_VERSION}。`
      });
      return { values: legacyValues, migrated: true };
    }

    const version = rawDocument.schemaVersion;
    if (version === 0) {
      const legacyContainer = isPlainObject(rawDocument.values)
        ? rawDocument.values
        : isPlainObject(rawDocument.settings)
          ? rawDocument.settings
          : undefined;
      const legacyValues = toConfigurationRecord(legacyContainer);
      if (!legacyValues) {
        this.diagnostics.push({
          code: 'INVALID_DOCUMENT',
          severity: 'error',
          target,
          message: `${targetLabel(target)}版本 0 设置文件结构无效，已使用默认设置。`
        });
        return undefined;
      }
      this.diagnostics.push({
        code: 'LEGACY_MIGRATED',
        severity: 'info',
        target,
        message: `已将${targetLabel(target)}设置从版本 0 迁移到版本 ${CURRENT_SCHEMA_VERSION}。`
      });
      return { values: legacyValues, migrated: true };
    }

    if (version !== CURRENT_SCHEMA_VERSION) {
      this.diagnostics.push({
        code: 'UNSUPPORTED_VERSION',
        severity: 'error',
        target,
        message: `${targetLabel(target)}设置版本 ${String(version)} 不受支持，原文件未被修改。`
      });
      return undefined;
    }

    const values = toConfigurationRecord(rawDocument.values);
    if (!values) {
      this.diagnostics.push({
        code: 'INVALID_DOCUMENT',
        severity: 'error',
        target,
        message: `${targetLabel(target)}设置文件缺少有效的 values 对象，已使用默认设置。`
      });
      return undefined;
    }
    return { values, migrated: false };
  }

  private async persistTarget(
    target: ConfigurationTarget,
    values: Map<string, ConfigurationValue>
  ): Promise<void> {
    const storage = this.storages[target];
    if (!storage) return;
    const document: PersistedConfigurationDocument = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      values: Object.fromEntries(
        [...values.entries()].map(([key, value]) => [key, cloneValue(value)])
      )
    };
    try {
      await storage.write(document);
    } catch (error) {
      this.addWriteDiagnostic(target, error);
      throw error;
    }
  }

  private validateSchema(): void {
    for (const [key, property] of Object.entries(this.schema)) {
      if (!key.trim()) throw new Error('设置 schema 不能包含空键名。');
      const errors = validateValue(property.default, property, key);
      if (errors.length > 0) {
        throw new ConfigurationValidationError(key, [`默认值不符合 schema：${errors.join('；')}`]);
      }
      if (property.pattern !== undefined) {
        try {
          new RegExp(property.pattern, 'u');
        } catch {
          throw new Error(`设置“${key}”的 schema 包含无效正则表达式。`);
        }
      }
    }
  }

  private getSchemaProperty(key: string): ConfigurationPropertySchema {
    if (typeof key !== 'string' || !key.trim() || !this.schema[key]) {
      throw new ConfigurationValidationError(String(key), ['设置项未在 schema 中注册']);
    }
    return this.schema[key];
  }

  private getEffectiveValue(key: string): ConfigurationValue {
    return this.values.workspace.get(key)
      ?? this.values.user.get(key)
      ?? this.schema[key].default;
  }

  private emitChange(event: ConfigurationChangeEvent): void {
    for (const listener of [...this.listeners]) {
      try {
        listener(cloneChangeEvent(event));
      } catch {
        // One extension/listener must not prevent other configuration consumers.
      }
    }
  }

  private addReadDiagnostic(target: ConfigurationTarget, error: unknown): void {
    const isCorrupt = error instanceof ConfigurationPersistenceError && error.code === 'CORRUPT_JSON';
    this.diagnostics.push({
      code: isCorrupt ? 'CORRUPT_FILE' : 'READ_FAILED',
      severity: 'error',
      target,
      message: error instanceof Error
        ? error.message
        : `读取${targetLabel(target)}设置失败，已使用默认设置。`
    });
  }

  private addWriteDiagnostic(target: ConfigurationTarget, error: unknown): void {
    this.diagnostics.push({
      code: 'WRITE_FAILED',
      severity: 'error',
      target,
      message: error instanceof Error
        ? error.message
        : `保存${targetLabel(target)}设置失败。`
    });
  }

  private assertInitialized(): void {
    if (!this.initialized) {
      throw new Error('ConfigurationService 尚未初始化，请先调用 initialize()。');
    }
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operationQueue.then(operation, operation);
    this.operationQueue = result.then(() => undefined, () => undefined);
    return result;
  }
}

export function createConfigurationService(options: ConfigurationServiceOptions): ConfigurationService {
  return new ConfigurationService(options);
}

function validateValue(
  value: unknown,
  schema: Omit<ConfigurationPropertySchema, 'default'>,
  valuePath: string
): string[] {
  const errors: string[] = [];
  const allowedTypes = Array.isArray(schema.type) ? schema.type : [schema.type];
  if (!allowedTypes.some(type => matchesType(value, type))) {
    errors.push(`${valuePath} 应为 ${allowedTypes.map(typeLabel).join(' 或 ')}`);
    return errors;
  }

  if (schema.enum && !schema.enum.some(candidate => deepEqual(candidate, value))) {
    errors.push(`${valuePath} 不在允许值列表中`);
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) errors.push(`${valuePath} 必须是有限数字`);
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push(`${valuePath} 不能小于 ${schema.minimum}`);
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push(`${valuePath} 不能大于 ${schema.maximum}`);
    }
  }

  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push(`${valuePath} 长度不能小于 ${schema.minLength}`);
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push(`${valuePath} 长度不能大于 ${schema.maxLength}`);
    }
    if (schema.pattern !== undefined && !new RegExp(schema.pattern, 'u').test(value)) {
      errors.push(`${valuePath} 格式不符合要求`);
    }
  }

  if (Array.isArray(value) && schema.items) {
    value.forEach((item, index) => {
      errors.push(...validateValue(item, schema.items!, `${valuePath}[${index}]`));
    });
  }

  if (isPlainObject(value)) {
    const properties = schema.properties ?? {};
    for (const requiredKey of schema.required ?? []) {
      if (!Object.prototype.hasOwnProperty.call(value, requiredKey)) {
        errors.push(`${valuePath}.${requiredKey} 为必填项`);
      }
    }
    for (const [key, item] of Object.entries(value)) {
      const propertySchema = properties[key];
      if (propertySchema) {
        errors.push(...validateValue(item, propertySchema, `${valuePath}.${key}`));
      } else if (schema.additionalProperties === false) {
        errors.push(`${valuePath}.${key} 不是允许的属性`);
      } else if (isPlainObject(schema.additionalProperties)) {
        errors.push(...validateValue(item, schema.additionalProperties as Omit<ConfigurationPropertySchema, 'default'>, `${valuePath}.${key}`));
      }
    }
  }

  return errors;
}

function matchesType(value: unknown, type: ConfigurationValueType): boolean {
  if (type === 'null') return value === null;
  if (type === 'array') return Array.isArray(value);
  if (type === 'object') return isPlainObject(value);
  if (type === 'integer') return typeof value === 'number' && Number.isInteger(value);
  return typeof value === type;
}

function typeLabel(type: ConfigurationValueType): string {
  return ({
    null: '空值',
    boolean: '布尔值',
    number: '数字',
    integer: '整数',
    string: '字符串',
    array: '数组',
    object: '对象'
  } as const)[type];
}

function targetLabel(target: ConfigurationTarget): string {
  return target === 'workspace' ? '工作区' : '用户';
}

function toConfigurationRecord(value: unknown): Record<string, ConfigurationValue> | undefined {
  if (!isPlainObject(value)) return undefined;
  for (const item of Object.values(value)) {
    if (!isConfigurationValue(item)) return undefined;
  }
  return cloneValue(value as Record<string, ConfigurationValue>);
}

function isConfigurationValue(value: unknown): value is ConfigurationValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isConfigurationValue);
  if (isPlainObject(value)) return Object.values(value).every(isConfigurationValue);
  return false;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function cloneSchema(schema: ConfigurationSchema): ConfigurationSchema {
  return Object.fromEntries(
    Object.entries(schema).map(([key, property]) => [key, cloneValue(property as unknown as ConfigurationValue)])
  ) as unknown as ConfigurationSchema;
}

function cloneValue<T extends ConfigurationValue>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(item => cloneValue(item)) as T;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, cloneValue(item)])
  ) as T;
}

function cloneOptionalValue<T extends ConfigurationValue>(value: T | undefined): T | undefined {
  return value === undefined ? undefined : cloneValue(value);
}

function cloneChangeEvent(event: ConfigurationChangeEvent): ConfigurationChangeEvent {
  return {
    ...event,
    oldValue: cloneOptionalValue(event.oldValue),
    newValue: cloneOptionalValue(event.newValue),
    oldEffectiveValue: cloneValue(event.oldEffectiveValue),
    newEffectiveValue: cloneValue(event.newEffectiveValue)
  };
}

function deepEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((item, index) => deepEqual(item, right[index]));
  }
  if (isPlainObject(left) && isPlainObject(right)) {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    return leftKeys.length === rightKeys.length
      && leftKeys.every(key => Object.prototype.hasOwnProperty.call(right, key) && deepEqual(left[key], right[key]));
  }
  return false;
}
