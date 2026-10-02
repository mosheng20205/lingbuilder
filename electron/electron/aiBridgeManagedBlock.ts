/**
 * LingBuilder 托管 MCP 配置块生成器（原 codexDesktopIntegrationService 内联实现）。
 * Codex 桌面版一键适配 UI 已移除，本生成器保留为灵码 Skill（skill-kit/SKILL.md）
 * 托管配置块的唯一产品权威形态：tests/skillKit.test.ts 以它的输出逐要素校验 SKILL.md，
 * 改动这里必须同步推进 skill-kit manifest 的 sequence。
 */
import path from 'node:path';

const BLOCK_START = '# >>> LingBuilder ChatGPT/Codex desktop MCP (managed)';
const BLOCK_END = '# <<< LingBuilder ChatGPT/Codex desktop MCP (managed)';
const SERVER_HEADER = '[mcp_servers.lingbuilder_desktop]';

export function createManagedBlock(options: {
  runtimeExecutable: string;
  cliEntryPath: string;
  permission: 'readonly' | 'preview' | 'yolo';
}): string {
  return [
    BLOCK_START,
    SERVER_HEADER,
    `command = ${tomlString(path.resolve(options.runtimeExecutable))}`,
    `args = [${[
      path.resolve(options.cliEntryPath),
      'ai-server',
      '--workspace',
      '.',
      '--permission',
      options.permission,
      '--mcp',
      '--stdio-only'
    ].map(tomlString).join(', ')}]`,
    'env = { ELECTRON_RUN_AS_NODE = "1" }',
    'enabled = true',
    'required = false',
    'default_tools_approval_mode = "writes"',
    BLOCK_END
  ].join('\n');
}

function tomlString(value: string): string {
  return JSON.stringify(value);
}
