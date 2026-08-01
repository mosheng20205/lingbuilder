import { normalizeControlReferenceCallSnippet, normalizeControlReferenceSnippet } from './bindingValueType';
import { validateModuleManifest } from './manifest';
import type {
  LingBuilderModuleManifest,
  ModuleCommandBindingParameter,
  ModuleControlRuntimeRepresentation
} from './types';

export interface ControlReferenceAuditRecord {
  moduleId: string;
  command: string;
  parameterIndex: number;
  parameterName: string;
  type: ModuleCommandBindingParameter['type'];
  controlTypes: string[];
  controlKinds: string[];
  scope: string;
  runtimeRepresentation: string;
}

export interface ControlReferenceCommandAuditRecord {
  moduleId: string;
  command: string;
  runtimeName: string;
  parameterCount: number;
  controlReferenceParameterIndexes: number[];
}

export interface ControlReferenceAuditResult {
  moduleCount: number;
  commandCount: number;
  parameterCount: number;
  controlReferenceCount: number;
  commandDigest: string;
  parameterDigest: string;
  commands: ControlReferenceCommandAuditRecord[];
  parameters: ControlReferenceAuditRecord[];
  violations: string[];
}

const CONTROL_SEMANTIC_NAME = /(?:控件|组件|浏览器|表格控件|列表视图控件|图像列表|属性页|菜单组件)/u;

const TEXT_PARAMETER_ALLOWLIST = new Map<string, string>([
  ['lingbuilder.std.text/文本_寻找/1/目标', '待查找的普通文本。'],
  ['lingbuilder.std.text/文本_是否包含/1/目标', '待匹配的普通文本。'],
  ['lingbuilder.std.encoding/编码_转换/2/目标编码', '字符编码名称。'],
  ['lingbuilder.fs.core/文件_复制/1/目标', '目标文件路径。'],
  ['lingbuilder.fs.core/文件_移动/1/目标', '目标文件路径。'],
  ['lingbuilder.system.shell/系统_打开/0/目标', 'Shell 路径或 URI。'],
  ['lingbuilder.image.core/图像_转换格式/1/目标', '目标图像文件路径。'],
  ['lingbuilder.image.core/图像_缩放/1/目标', '目标图像文件路径。'],
  ['lingbuilder.image.core/图像_裁剪/1/目标', '目标图像文件路径。'],
  ['lingbuilder.image.core/图像_旋转90度/1/目标', '目标图像文件路径。'],
  ['lingbuilder.image.capture/截图_主屏到PNG/0/目标路径', '输出文件路径。'],
  ['lingbuilder.image.capture/截图_区域到PNG/0/目标路径', '输出文件路径。'],
  ['lingbuilder.image.capture/截图_窗口到PNG/0/目标路径', '输出文件路径。'],
  ['lingbuilder.image.bitmap/位图_置像素ARGB/1/目标', '目标像素数据句柄的文本兼容参数。'],
  ['lingbuilder.image.icon/图标_提取大图标到PNG/2/目标路径', '输出文件路径。'],
  ['lingbuilder.image.icon/图标_提取小图标到PNG/2/目标路径', '输出文件路径。'],
  ['lingbuilder.archive/压缩_ZIP解压/1/目标目录', '解压目录路径。'],
  ['lingbuilder.win32.common-controls/表格_添加列按钮/2/按钮ID', 'DataGrid 单元格内部按钮 ID，不是设计器控件。'],
  ['lingbuilder.win32.common-controls/表格_设置按钮显示/3/按钮ID', 'DataGrid 单元格内部按钮 ID，不是设计器控件。'],
  ['lingbuilder.win32.common-controls/表格_设置按钮启用/3/按钮ID', 'DataGrid 单元格内部按钮 ID，不是设计器控件。'],
  ['lingbuilder.win32.common-controls/表格_设置按钮文字/3/按钮ID', 'DataGrid 单元格内部按钮 ID，不是设计器控件。'],
  ['lingbuilder.win32.common-controls/表格_设置按钮样式/3/按钮ID', 'DataGrid 单元格内部按钮 ID，不是设计器控件。']
]);

const SUPPORTED_RUNTIME_REPRESENTATIONS = new Set<ModuleControlRuntimeRepresentation>([
  'wideName',
  'stableId',
  'nativeHandle'
]);

export function auditControlReferenceManifests(
  manifests: readonly LingBuilderModuleManifest[]
): ControlReferenceAuditResult {
  const violations: string[] = [];
  const commands: ControlReferenceCommandAuditRecord[] = [];
  const parameters: ControlReferenceAuditRecord[] = [];
  const moduleIds = new Set<string>();

  manifests.forEach(manifest => {
    if (moduleIds.has(manifest.id)) violations.push(`模块 ID 重复：${manifest.id}`);
    moduleIds.add(manifest.id);
    validateModuleManifest(manifest).diagnostics.forEach(diagnostic => violations.push(`${manifest.id}: ${diagnostic}`));
    const contributions = new Map((manifest.contributes?.commands || []).map(command => [command.name, command]));
    const bindings = manifest.bindings?.commands || [];
    bindings.forEach(binding => {
      const bindingParameters = binding.parameters || [];
      commands.push({
        moduleId: manifest.id,
        command: binding.command,
        runtimeName: binding.runtimeName,
        parameterCount: bindingParameters.length,
        controlReferenceParameterIndexes: bindingParameters.flatMap((parameter, index) => parameter.type === 'controlRef' ? [index] : [])
      });
      const contribution = contributions.get(binding.command);
      if (!contribution) violations.push(`${manifest.id}/${binding.command}: binding 缺少 contributes.commands。`);
      bindingParameters.forEach((parameter, parameterIndex) => {
        const key = `${manifest.id}/${binding.command}/${parameterIndex}/${parameter.name}`;
        const record: ControlReferenceAuditRecord = {
          moduleId: manifest.id,
          command: binding.command,
          parameterIndex,
          parameterName: parameter.name,
          type: parameter.type,
          controlTypes: [...(parameter.controlTypes || [])].sort(),
          controlKinds: [...(parameter.controlKinds || [])].sort(),
          scope: parameter.scope || '',
          runtimeRepresentation: parameter.runtimeRepresentation || ''
        };
        parameters.push(record);
        if (parameter.type === 'controlRef') {
          if (!parameter.controlKinds?.length) violations.push(`${key}: controlRef 缺少 controlKinds。`);
          if (!parameter.scope) violations.push(`${key}: controlRef 缺少 scope。`);
          if (!parameter.runtimeRepresentation) violations.push(`${key}: controlRef 缺少 runtimeRepresentation。`);
          else if (!SUPPORTED_RUNTIME_REPRESENTATIONS.has(parameter.runtimeRepresentation)) violations.push(`${key}: controlRef 运行时表示不受支持。`);
        } else if ((parameter.type === 'wideString' || parameter.type === 'utf8String') && CONTROL_SEMANTIC_NAME.test(parameter.name)) {
          if (!TEXT_PARAMETER_ALLOWLIST.has(key)) violations.push(`${key}: 参数名称具有设计器对象语义，必须声明为 controlRef 或加入带理由的文本参数白名单。`);
        }
      });
      if (!bindingParameters.some(parameter => parameter.type === 'controlRef')) return;
      if (normalizeControlReferenceCallSnippet(contribution?.insertText, bindingParameters) !== contribution?.insertText) {
        violations.push(`${manifest.id}/${binding.command}: 补全 insertText 含带引号 controlRef。`);
      }
      if (normalizeControlReferenceCallSnippet(binding.example, bindingParameters) !== binding.example) {
        violations.push(`${manifest.id}/${binding.command}: binding example 含带引号 controlRef。`);
      }
    });
    const bindingByCommand = new Map(bindings.map(binding => [binding.command, binding]));
    (manifest.contributes?.snippets || []).forEach((snippet, snippetIndex) => {
      if (normalizeControlReferenceSnippet(snippet.insertText, [...bindingByCommand.values()]) !== snippet.insertText) {
        violations.push(`${manifest.id}/snippet[${snippetIndex}]: 代码片段含带引号 controlRef（包括嵌套命令）。`);
      }
    });
  });

  commands.sort(compareCommandRecords);
  parameters.sort(compareParameterRecords);
  return {
    moduleCount: manifests.length,
    commandCount: commands.length,
    parameterCount: parameters.length,
    controlReferenceCount: parameters.filter(parameter => parameter.type === 'controlRef').length,
    commandDigest: stableDigest(commands),
    parameterDigest: stableDigest(parameters),
    commands,
    parameters,
    violations: [...new Set(violations)].sort()
  };
}

export function getControlReferenceTextParameterAllowlist(): ReadonlyMap<string, string> {
  return TEXT_PARAMETER_ALLOWLIST;
}

function compareCommandRecords(left: ControlReferenceCommandAuditRecord, right: ControlReferenceCommandAuditRecord): number {
  return `${left.moduleId}/${left.command}`.localeCompare(`${right.moduleId}/${right.command}`);
}

function compareParameterRecords(left: ControlReferenceAuditRecord, right: ControlReferenceAuditRecord): number {
  return `${left.moduleId}/${left.command}/${left.parameterIndex}`.localeCompare(`${right.moduleId}/${right.command}/${right.parameterIndex}`);
}

function stableDigest(value: unknown): string {
  const text = JSON.stringify(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}
