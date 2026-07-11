import fs from 'node:fs/promises';
import path from 'node:path';

import {
  ConfigurationPersistenceError,
  ConfigurationStorageAdapter,
  PersistedConfigurationDocument
} from './types';

export class MemoryConfigurationStorageAdapter implements ConfigurationStorageAdapter {
  private document: unknown | undefined;

  constructor(
    public readonly id: string,
    initialDocument?: unknown
  ) {
    this.document = cloneUnknown(initialDocument);
  }

  async read(): Promise<unknown | undefined> {
    return cloneUnknown(this.document);
  }

  async write(document: PersistedConfigurationDocument): Promise<void> {
    this.document = cloneUnknown(document);
  }

  /** Test/host inspection helper; the returned value cannot mutate storage. */
  snapshot(): unknown | undefined {
    return cloneUnknown(this.document);
  }
}

export interface ConfigurationFileSystem {
  readFile(filePath: string, encoding: 'utf8'): Promise<string>;
  writeFile(filePath: string, content: string, encoding: 'utf8'): Promise<void>;
  mkdir(directoryPath: string, options: { recursive: true }): Promise<unknown>;
  rename(sourcePath: string, targetPath: string): Promise<void>;
  unlink(filePath: string): Promise<void>;
}

export interface JsonFileConfigurationStorageOptions {
  id: string;
  /**
   * Must be supplied by the host after applying its user/workspace path policy.
   * The adapter deliberately does not accept an untrusted relative path.
   */
  resolveFilePath: () => string | Promise<string>;
  fileSystem?: ConfigurationFileSystem;
}

export class JsonFileConfigurationStorageAdapter implements ConfigurationStorageAdapter {
  readonly id: string;
  private readonly resolveFilePath: () => string | Promise<string>;
  private readonly fileSystem: ConfigurationFileSystem;
  private writeSequence = 0;

  constructor(options: JsonFileConfigurationStorageOptions) {
    if (!options.id?.trim()) {
      throw new ConfigurationPersistenceError('UNSAFE_PATH', '设置存储缺少有效标识。');
    }
    if (typeof options.resolveFilePath !== 'function') {
      throw new ConfigurationPersistenceError(
        'UNSAFE_PATH',
        '必须由宿主注入经过安全策略校验的设置文件路径。'
      );
    }
    this.id = options.id;
    this.resolveFilePath = options.resolveFilePath;
    this.fileSystem = options.fileSystem ?? fs;
  }

  async read(): Promise<unknown | undefined> {
    const filePath = await this.getSafeFilePath();
    let content: string;
    try {
      content = await this.fileSystem.readFile(filePath, 'utf8');
    } catch (error: any) {
      if (error?.code === 'ENOENT') return undefined;
      throw new ConfigurationPersistenceError(
        'READ_FAILED',
        `读取设置文件失败：${getErrorMessage(error)}`,
        error
      );
    }

    try {
      return JSON.parse(stripUtf8Bom(content));
    } catch (error) {
      throw new ConfigurationPersistenceError(
        'CORRUPT_JSON',
        `设置文件“${path.basename(filePath)}”不是合法 JSON，已保留原文件并改用默认设置。`,
        error
      );
    }
  }

  async write(document: PersistedConfigurationDocument): Promise<void> {
    const filePath = await this.getSafeFilePath();
    const directoryPath = path.dirname(filePath);
    const temporaryPath = `${filePath}.${process.pid}.${++this.writeSequence}.tmp`;
    const content = `${JSON.stringify(document, null, 2)}\n`;

    try {
      await this.fileSystem.mkdir(directoryPath, { recursive: true });
      await this.fileSystem.writeFile(temporaryPath, content, 'utf8');
      await this.fileSystem.rename(temporaryPath, filePath);
    } catch (error) {
      try {
        await this.fileSystem.unlink(temporaryPath);
      } catch {
        // The temporary file may not have been created. Keep the original error.
      }
      throw new ConfigurationPersistenceError(
        'WRITE_FAILED',
        `保存设置文件失败：${getErrorMessage(error)}`,
        error
      );
    }
  }

  private async getSafeFilePath(): Promise<string> {
    let resolved: string;
    try {
      resolved = await this.resolveFilePath();
    } catch (error) {
      throw new ConfigurationPersistenceError(
        'UNSAFE_PATH',
        `设置文件路径未通过安全校验：${getErrorMessage(error)}`,
        error
      );
    }
    if (typeof resolved !== 'string' || !resolved.trim() || resolved.includes('\0') || !path.isAbsolute(resolved)) {
      throw new ConfigurationPersistenceError(
        'UNSAFE_PATH',
        '设置文件路径不安全：宿主必须提供经过校验的绝对路径。'
      );
    }
    return path.resolve(resolved);
  }
}

export function createMemoryConfigurationStorageAdapter(
  id: string,
  initialDocument?: unknown
): MemoryConfigurationStorageAdapter {
  return new MemoryConfigurationStorageAdapter(id, initialDocument);
}

export function createJsonFileConfigurationStorageAdapter(
  options: JsonFileConfigurationStorageOptions
): JsonFileConfigurationStorageAdapter {
  return new JsonFileConfigurationStorageAdapter(options);
}

function cloneUnknown<T>(value: T): T {
  if (value === undefined || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(item => cloneUnknown(item)) as T;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, cloneUnknown(item)])
  ) as T;
}

function stripUtf8Bom(value: string): string {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
