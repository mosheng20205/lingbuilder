import type {
  LingBuilderModuleManifest,
  ModuleCommandValueType,
  ModuleCommandBinding,
  ModuleCommandBindingParameter,
  ModuleCommandContribution,
  ModuleTypeContribution
} from './types';
import { createModuleBindingSnippetArgument, isWideStringAbiBindingType, normalizeControlReferenceCallSnippet, normalizeControlReferenceParameter } from './bindingValueType';

const CEF3_ALPHA_VERSION = '3.0.0-alpha.3';
const CORE_DEPENDENCY = [{ moduleId: 'lingbuilder.cef3.browser', minimumVersion: CEF3_ALPHA_VERSION }];
const OBJECT_DEPENDENCY = [...CORE_DEPENDENCY, { moduleId: 'lingbuilder.cef3.objects', minimumVersion: CEF3_ALPHA_VERSION }];
const TARGET = [{
  id: 'windows-msvc-x64' as const,
  platform: 'windows' as const,
  arch: 'x64' as const,
  toolchain: 'msvc' as const
}];

type Parameter = ModuleCommandBindingParameter;

function api(
  name: string,
  officialAlias: string,
  parameters: Parameter[],
  returnType: ModuleCommandValueType,
  description: string,
  options: { runtimeName?: string; example?: string; visibility?: 'default' | 'advanced' } = {}
): { command: ModuleCommandContribution; binding: ModuleCommandBinding } {
  const normalizedParameters = parameters.map(parameter => normalizeControlReferenceParameter(parameter, { controlTypes: ['CefBrowser'] }));
  const argumentText = normalizedParameters.map(createModuleBindingSnippetArgument).join(', ');
  const normalizedExample = normalizeControlReferenceCallSnippet(options.example, normalizedParameters);
  return {
    command: {
      name,
      aliases: [officialAlias],
      signature: `${name}(${normalizedParameters.map(parameter => parameter.name).join(', ')})`,
      description,
      insertText: normalizedExample || `${name}(${argumentText})`,
      returnType: returnType === 'void' ? '空' : returnType === 'wideString' ? '文本型'
        : returnType === 'longLong' || returnType === 'handle' ? '长整数型'
          : returnType === 'double' ? '双精度小数型'
            : returnType === 'int' || returnType === 'bool' ? '整数型' : returnType,
      visibility: options.visibility
    },
    binding: {
      command: name,
      runtimeName: options.runtimeName || name,
      parameters: normalizedParameters,
      returnType,
      encoding: normalizedParameters.some(parameter => isWideStringAbiBindingType(parameter.type)) ? 'wide' : undefined,
      example: normalizedExample
    }
  };
}

function module(
  id: string,
  name: string,
  category: LingBuilderModuleManifest['category'],
  description: string,
  entries: ReturnType<typeof api>[],
  needsObjects = false,
  types: ModuleTypeContribution[] = []
): LingBuilderModuleManifest {
  return {
    schemaVersion: 2,
    id,
    name,
    version: CEF3_ALPHA_VERSION,
    category,
    description,
    author: 'LingBuilder',
    tags: ['内置', 'CEF3', 'CEF150', 'x64'],
    dependencies: needsObjects ? OBJECT_DEPENDENCY : CORE_DEPENDENCY,
    contributes: { commands: entries.map(entry => entry.command), types: types.length ? types : undefined },
    targets: TARGET,
    bindings: { commands: entries.map(entry => entry.binding) }
  };
}

const eventEntries = [
  api('CEF3事件_取最近事件', 'LB_CEF3_GetLastEvent', [{ name: '控件名', type: 'controlRef' }], 'wideString', '取得指定浏览器最近事件名。', { runtimeName: 'CEF3_取最近事件' }),
  api('CEF3事件_取数据', 'LB_CEF3_GetEventData', [{ name: '控件名', type: 'controlRef' }], 'wideString', '取得当前或最近事件的主要文本。', { runtimeName: 'CEF3_取事件数据' }),
  api('CEF3事件_取字段', 'LB_CEF3_GetEventField', [{ name: '控件名', type: 'controlRef' }, { name: '字段名', type: 'wideString' }], 'wideString', '读取当前事件的结构化字段。', { runtimeName: 'CEF3_取事件字段' }),
  api('CEF3事件_设置结果', 'LB_CEF3_SetEventAction', [{ name: '控件名', type: 'controlRef' }, { name: '动作', type: 'int' }], 'int', '设置当前同步事件动作。', { runtimeName: 'CEF3_设置事件结果' }),
  api('CEF3事件_设置返回文本', 'LB_CEF3_SetEventResultText', [{ name: '控件名', type: 'controlRef' }, { name: '文本', type: 'wideString' }], 'int', '设置当前同步事件返回文本。', { runtimeName: 'CEF3_设置事件返回文本' }),
  api('CEF3事件_绑定', 'LB_CEF3_BindEvent', [{ name: '控件名', type: 'controlRef' }, { name: '事件名', type: 'wideString' }, { name: '处理器', type: 'handler', description: '必须使用 &处理器名' }], 'int', '把浏览器事件绑定到当前类的无参数处理器。', { runtimeName: 'CEF3_绑定事件', example: 'CEF3事件_绑定(浏览器1, "加载完成", &$1)' })
];

const objectEntries = [
  api('CEF3任务_取状态', 'LB_CEF3_TaskGetStatus', [{ name: '任务ID', type: 'longLong' }], 'int', '取得异步任务状态。', { visibility: 'advanced' }),
  api('CEF3任务_取结果', 'LB_CEF3_TaskGetResult', [{ name: '任务ID', type: 'longLong' }], 'wideString', '取得异步任务UTF-16结果。', { visibility: 'advanced' }),
  api('CEF3任务_取错误', 'LB_CEF3_TaskGetError', [{ name: '任务ID', type: 'longLong' }], 'wideString', '取得异步任务中文错误。', { visibility: 'advanced' }),
  api('CEF3任务_取消', 'LB_CEF3_TaskCancel', [{ name: '任务ID', type: 'longLong' }], 'int', '取消尚未完成的任务。', { visibility: 'advanced' }),
  api('CEF3任务_释放', 'LB_CEF3_TaskRelease', [{ name: '任务ID', type: 'longLong' }], 'int', '释放异步任务及其结果。', { visibility: 'advanced' }),
  api('CEF3缓冲_从十六进制', 'LB_CEF3_BufferCreate', [{ name: '十六进制', type: 'wideString' }], 'longLong', '从偶数长度十六进制文本创建 Bridge 受管缓冲并返回类型化句柄。', { visibility: 'advanced' }),
  api('CEF3缓冲_复制', 'CefBinaryValue::Copy', [{ name: '缓冲句柄', type: 'longLong' }], 'longLong', '复制受管二进制缓冲并返回独立句柄。', { visibility: 'advanced' }),
  api('CEF3缓冲_是否有效', 'CefBinaryValue::IsValid', [{ name: '缓冲句柄', type: 'longLong' }], 'int', '判断受管缓冲句柄是否有效。', { visibility: 'advanced' }),
  api('CEF3缓冲_是否被拥有', 'CefBinaryValue::IsOwned', [{ name: '缓冲句柄', type: 'longLong' }], 'int', 'Bridge缓冲始终独立拥有，合法句柄返回0。', { visibility: 'advanced' }),
  api('CEF3缓冲_是否同一对象', 'CefBinaryValue::IsSame', [{ name: '缓冲句柄', type: 'longLong' }, { name: '另一缓冲句柄', type: 'longLong' }], 'int', '判断两个受管句柄是否引用同一缓冲。', { visibility: 'advanced' }),
  api('CEF3缓冲_是否相等', 'CefBinaryValue::IsEqual', [{ name: '缓冲句柄', type: 'longLong' }, { name: '另一缓冲句柄', type: 'longLong' }], 'int', '逐字节比较两个受管缓冲。', { visibility: 'advanced' }),
  api('CEF3缓冲_从文件', 'LB_CEF3_BufferLoadFile', [{ name: '路径', type: 'wideString' }], 'longLong', '从允许文件根目录内读取文件并创建受管缓冲；越界路径返回0。', { visibility: 'advanced' }),
  api('CEF3缓冲_取大小', 'LB_CEF3_BufferGetSize', [{ name: '缓冲句柄', type: 'longLong' }], 'longLong', '返回受管缓冲字节数，无效或类型错误返回-1。', { visibility: 'advanced' }),
  api('CEF3缓冲_到十六进制', 'LB_CEF3_BufferToHex', [{ name: '缓冲句柄', type: 'longLong' }], 'wideString', '把受管缓冲转换为小写十六进制文本。', { visibility: 'advanced' }),
  api('CEF3缓冲_保存文件', 'LB_CEF3_BufferSaveFile', [{ name: '缓冲句柄', type: 'longLong' }, { name: '路径', type: 'wideString' }], 'int', '把受管缓冲写入允许文件根目录；拒绝目录穿越和任意路径写入。', { visibility: 'advanced' }),
  api('CEF3缓冲_释放', 'LB_CEF3_BufferRelease', [{ name: '缓冲句柄', type: 'longLong' }], 'int', '释放受管缓冲；重复释放返回稳定错误码。', { visibility: 'advanced' }),
  api('CEF3值_创建', 'CefValue::Create', [], 'longLong', '创建独立拥有的CEF值对象并返回类型化受管句柄。', { visibility: 'advanced' }),
  api('CEF3值_复制', 'CefValue::Copy', [{ name: '值句柄', type: 'longLong' }], 'longLong', '深复制CEF值并返回独立受管句柄。', { visibility: 'advanced' }),
  api('CEF3值_是否有效', 'CefValue::IsValid', [{ name: '值句柄', type: 'longLong' }], 'int', '判断CEF值当前是否有效。', { visibility: 'advanced' }),
  api('CEF3值_是否被拥有', 'CefValue::IsOwned', [{ name: '值句柄', type: 'longLong' }], 'int', '判断CEF值是否被其它CEF对象拥有。', { visibility: 'advanced' }),
  api('CEF3值_是否只读', 'CefValue::IsReadOnly', [{ name: '值句柄', type: 'longLong' }], 'int', '判断CEF值是否只读。', { visibility: 'advanced' }),
  api('CEF3值_是否同一对象', 'CefValue::IsSame', [{ name: '值句柄', type: 'longLong' }, { name: '另一值句柄', type: 'longLong' }], 'int', '判断两个句柄是否引用同一CEF值对象。', { visibility: 'advanced' }),
  api('CEF3值_是否相等', 'CefValue::IsEqual', [{ name: '值句柄', type: 'longLong' }, { name: '另一值句柄', type: 'longLong' }], 'int', '深度比较两个CEF值的内容。', { visibility: 'advanced' }),
  api('CEF3值_取类型', 'CefValue::GetType', [{ name: '值句柄', type: 'longLong' }], 'int', '取得CEF值类型枚举。', { visibility: 'advanced' }),
  api('CEF3值_设为空', 'CefValue::SetNull', [{ name: '值句柄', type: 'longLong' }], 'int', '把CEF值设为空。', { visibility: 'advanced' }),
  api('CEF3值_设逻辑', 'CefValue::SetBool', [{ name: '值句柄', type: 'longLong' }, { name: '值', type: 'bool' }], 'int', '设置CEF逻辑值。', { visibility: 'advanced' }),
  api('CEF3值_设整数', 'CefValue::SetInt', [{ name: '值句柄', type: 'longLong' }, { name: '值', type: 'int' }], 'int', '设置CEF整数值。', { visibility: 'advanced' }),
  api('CEF3值_设小数', 'CefValue::SetDouble', [{ name: '值句柄', type: 'longLong' }, { name: '值', type: 'double' }], 'int', '设置CEF双精度值。', { visibility: 'advanced' }),
  api('CEF3值_设文本', 'CefValue::SetString', [{ name: '值句柄', type: 'longLong' }, { name: '值', type: 'wideString' }], 'int', '设置UTF-16文本值。', { visibility: 'advanced' }),
  api('CEF3值_设缓冲', 'CefValue::SetBinary', [{ name: '值句柄', type: 'longLong' }, { name: '缓冲句柄', type: 'longLong' }], 'int', '复制受管缓冲并设置为CEF二进制值。', { visibility: 'advanced' }),
  api('CEF3值_设字典', 'CefValue::SetDictionary', [{ name: '值句柄', type: 'longLong' }, { name: '字典句柄', type: 'longLong' }], 'int', '深复制字典并设置为CEF字典值。', { visibility: 'advanced' }),
  api('CEF3值_设列表', 'CefValue::SetList', [{ name: '值句柄', type: 'longLong' }, { name: '列表句柄', type: 'longLong' }], 'int', '深复制列表并设置为CEF列表值。', { visibility: 'advanced' }),
  api('CEF3值_取逻辑', 'CefValue::GetBool', [{ name: '值句柄', type: 'longLong' }], 'int', '取得CEF逻辑值，类型不匹配时返回稳定负错误码。', { visibility: 'advanced' }),
  api('CEF3值_取整数', 'CefValue::GetInt', [{ name: '值句柄', type: 'longLong' }], 'int', '取得CEF整数值。', { visibility: 'advanced' }),
  api('CEF3值_取小数', 'CefValue::GetDouble', [{ name: '值句柄', type: 'longLong' }], 'double', '取得CEF双精度值。', { visibility: 'advanced' }),
  api('CEF3值_取文本', 'CefValue::GetString', [{ name: '值句柄', type: 'longLong' }], 'wideString', '取得CEF UTF-16文本值。', { visibility: 'advanced' }),
  api('CEF3值_取缓冲', 'CefValue::GetBinary', [{ name: '值句柄', type: 'longLong' }], 'longLong', '复制CEF二进制值并返回独立受管缓冲句柄。', { visibility: 'advanced' }),
  api('CEF3值_取字典', 'CefValue::GetDictionary', [{ name: '值句柄', type: 'longLong' }], 'longLong', '深复制CEF字典值并返回独立受管字典句柄。', { visibility: 'advanced' }),
  api('CEF3值_取列表', 'CefValue::GetList', [{ name: '值句柄', type: 'longLong' }], 'longLong', '深复制CEF列表值并返回独立受管列表句柄。', { visibility: 'advanced' }),
  api('CEF3值_到JSON', 'LB_CEF3_ValueToJson', [{ name: '值句柄', type: 'longLong' }], 'wideString', '把CEF值安全序列化为JSON。', { visibility: 'advanced' }),
  api('CEF3值_释放', 'LB_CEF3_ValueRelease', [{ name: '值句柄', type: 'longLong' }], 'int', '释放CEF值受管句柄。', { visibility: 'advanced' }),
  api('CEF3字典_创建', 'CefDictionaryValue::Create', [], 'longLong', '创建CEF字典受管句柄。', { visibility: 'advanced' }),
  api('CEF3字典_复制', 'CefDictionaryValue::Copy', [{ name: '字典句柄', type: 'longLong' }, { name: '排除空子项', type: 'bool' }], 'longLong', '深复制CEF字典，可选择排除空子对象。', { visibility: 'advanced' }),
  api('CEF3字典_是否有效', 'CefDictionaryValue::IsValid', [{ name: '字典句柄', type: 'longLong' }], 'int', '判断CEF字典当前是否有效。', { visibility: 'advanced' }),
  api('CEF3字典_是否被拥有', 'CefDictionaryValue::IsOwned', [{ name: '字典句柄', type: 'longLong' }], 'int', '判断CEF字典是否被其它CEF对象拥有。', { visibility: 'advanced' }),
  api('CEF3字典_是否只读', 'CefDictionaryValue::IsReadOnly', [{ name: '字典句柄', type: 'longLong' }], 'int', '判断CEF字典是否只读。', { visibility: 'advanced' }),
  api('CEF3字典_是否同一对象', 'CefDictionaryValue::IsSame', [{ name: '字典句柄', type: 'longLong' }, { name: '另一字典句柄', type: 'longLong' }], 'int', '判断两个句柄是否引用同一CEF字典。', { visibility: 'advanced' }),
  api('CEF3字典_是否相等', 'CefDictionaryValue::IsEqual', [{ name: '字典句柄', type: 'longLong' }, { name: '另一字典句柄', type: 'longLong' }], 'int', '深度比较两个CEF字典的内容。', { visibility: 'advanced' }),
  api('CEF3字典_取数量', 'CefDictionaryValue::GetSize', [{ name: '字典句柄', type: 'longLong' }], 'longLong', '取得字典键数量。', { visibility: 'advanced' }),
  api('CEF3字典_是否存在', 'CefDictionaryValue::HasKey', [{ name: '字典句柄', type: 'longLong' }, { name: '键', type: 'wideString' }], 'int', '判断字典键是否存在。', { visibility: 'advanced' }),
  api('CEF3字典_取键列表', 'CefDictionaryValue::GetKeys', [{ name: '字典句柄', type: 'longLong' }], 'wideString', '以JSON数组返回全部字典键。', { visibility: 'advanced' }),
  api('CEF3字典_取类型', 'CefDictionaryValue::GetType', [{ name: '字典句柄', type: 'longLong' }, { name: '键', type: 'wideString' }], 'int', '取得指定键的CEF值类型。', { visibility: 'advanced' }),
  api('CEF3字典_设值', 'CefDictionaryValue::SetValue', [{ name: '字典句柄', type: 'longLong' }, { name: '键', type: 'wideString' }, { name: '值句柄', type: 'longLong' }], 'int', '深复制值并写入字典，避免跨所有权边界悬空。', { visibility: 'advanced' }),
  api('CEF3字典_取值', 'CefDictionaryValue::GetValue', [{ name: '字典句柄', type: 'longLong' }, { name: '键', type: 'wideString' }], 'longLong', '返回字典值的独立深复制受管句柄。', { visibility: 'advanced' }),
  api('CEF3字典_删除', 'CefDictionaryValue::Remove', [{ name: '字典句柄', type: 'longLong' }, { name: '键', type: 'wideString' }], 'int', '删除指定字典键。', { visibility: 'advanced' }),
  api('CEF3字典_清空', 'CefDictionaryValue::Clear', [{ name: '字典句柄', type: 'longLong' }], 'int', '清空CEF字典。', { visibility: 'advanced' }),
  api('CEF3字典_到JSON', 'LB_CEF3_DictionaryToJson', [{ name: '字典句柄', type: 'longLong' }], 'wideString', '把CEF字典深复制并序列化为JSON。', { visibility: 'advanced' }),
  api('CEF3字典_释放', 'LB_CEF3_DictionaryRelease', [{ name: '字典句柄', type: 'longLong' }], 'int', '释放CEF字典受管句柄。', { visibility: 'advanced' }),
  api('CEF3列表_创建', 'CefListValue::Create', [], 'longLong', '创建CEF列表受管句柄。', { visibility: 'advanced' }),
  api('CEF3列表_复制', 'CefListValue::Copy', [{ name: '列表句柄', type: 'longLong' }], 'longLong', '深复制CEF列表并返回独立受管句柄。', { visibility: 'advanced' }),
  api('CEF3列表_是否有效', 'CefListValue::IsValid', [{ name: '列表句柄', type: 'longLong' }], 'int', '判断CEF列表当前是否有效。', { visibility: 'advanced' }),
  api('CEF3列表_是否被拥有', 'CefListValue::IsOwned', [{ name: '列表句柄', type: 'longLong' }], 'int', '判断CEF列表是否被其它CEF对象拥有。', { visibility: 'advanced' }),
  api('CEF3列表_是否只读', 'CefListValue::IsReadOnly', [{ name: '列表句柄', type: 'longLong' }], 'int', '判断CEF列表是否只读。', { visibility: 'advanced' }),
  api('CEF3列表_是否同一对象', 'CefListValue::IsSame', [{ name: '列表句柄', type: 'longLong' }, { name: '另一列表句柄', type: 'longLong' }], 'int', '判断两个句柄是否引用同一CEF列表。', { visibility: 'advanced' }),
  api('CEF3列表_是否相等', 'CefListValue::IsEqual', [{ name: '列表句柄', type: 'longLong' }, { name: '另一列表句柄', type: 'longLong' }], 'int', '深度比较两个CEF列表的内容。', { visibility: 'advanced' }),
  api('CEF3列表_取数量', 'CefListValue::GetSize', [{ name: '列表句柄', type: 'longLong' }], 'longLong', '取得列表元素数量。', { visibility: 'advanced' }),
  api('CEF3列表_设数量', 'CefListValue::SetSize', [{ name: '列表句柄', type: 'longLong' }, { name: '数量', type: 'longLong' }], 'int', '调整CEF列表大小。', { visibility: 'advanced' }),
  api('CEF3列表_取类型', 'CefListValue::GetType', [{ name: '列表句柄', type: 'longLong' }, { name: '索引', type: 'longLong' }], 'int', '取得指定索引的CEF值类型。', { visibility: 'advanced' }),
  api('CEF3列表_设值', 'CefListValue::SetValue', [{ name: '列表句柄', type: 'longLong' }, { name: '索引', type: 'longLong' }, { name: '值句柄', type: 'longLong' }], 'int', '深复制值并写入列表。', { visibility: 'advanced' }),
  api('CEF3列表_取值', 'CefListValue::GetValue', [{ name: '列表句柄', type: 'longLong' }, { name: '索引', type: 'longLong' }], 'longLong', '返回列表值的独立深复制受管句柄。', { visibility: 'advanced' }),
  api('CEF3列表_删除', 'CefListValue::Remove', [{ name: '列表句柄', type: 'longLong' }, { name: '索引', type: 'longLong' }], 'int', '删除指定索引。', { visibility: 'advanced' }),
  api('CEF3列表_清空', 'CefListValue::Clear', [{ name: '列表句柄', type: 'longLong' }], 'int', '清空CEF列表。', { visibility: 'advanced' }),
  api('CEF3列表_到JSON', 'LB_CEF3_ListToJson', [{ name: '列表句柄', type: 'longLong' }], 'wideString', '把CEF列表深复制并序列化为JSON。', { visibility: 'advanced' }),
  api('CEF3列表_释放', 'LB_CEF3_ListRelease', [{ name: '列表句柄', type: 'longLong' }], 'int', '释放CEF列表受管句柄。', { visibility: 'advanced' }),
  api('CEF3菜单_创建', 'CefMenuModel::CreateMenuModel', [], 'longLong', '在CEF UI线程创建菜单模型并返回受管句柄。', { visibility: 'advanced' }),
  api('CEF3菜单_是否子菜单', 'CefMenuModel::IsSubMenu', [{ name: '菜单句柄', type: 'longLong' }], 'int', '判断菜单是否为子菜单。', { visibility: 'advanced' }),
  api('CEF3菜单_清空', 'CefMenuModel::Clear', [{ name: '菜单句柄', type: 'longLong' }], 'int', '清空菜单项目。', { visibility: 'advanced' }),
  api('CEF3菜单_取数量', 'CefMenuModel::GetCount', [{ name: '菜单句柄', type: 'longLong' }], 'longLong', '取得菜单项目数量。', { visibility: 'advanced' }),
  api('CEF3菜单_添加分隔线', 'CefMenuModel::AddSeparator', [{ name: '菜单句柄', type: 'longLong' }], 'int', '在菜单末尾添加分隔线。', { visibility: 'advanced' }),
  api('CEF3菜单_添加项目', 'CefMenuModel::AddItem', [{ name: '菜单句柄', type: 'longLong' }, { name: '命令ID', type: 'int' }, { name: '标题', type: 'wideString' }], 'int', '添加普通菜单项目。', { visibility: 'advanced' }),
  api('CEF3菜单_添加勾选项目', 'CefMenuModel::AddCheckItem', [{ name: '菜单句柄', type: 'longLong' }, { name: '命令ID', type: 'int' }, { name: '标题', type: 'wideString' }], 'int', '添加勾选菜单项目。', { visibility: 'advanced' }),
  api('CEF3菜单_添加单选项目', 'CefMenuModel::AddRadioItem', [{ name: '菜单句柄', type: 'longLong' }, { name: '命令ID', type: 'int' }, { name: '标题', type: 'wideString' }, { name: '组ID', type: 'int' }], 'int', '添加单选菜单项目。', { visibility: 'advanced' }),
  api('CEF3菜单_添加子菜单', 'CefMenuModel::AddSubMenu', [{ name: '菜单句柄', type: 'longLong' }, { name: '命令ID', type: 'int' }, { name: '标题', type: 'wideString' }], 'longLong', '添加子菜单并返回独立受管句柄。', { visibility: 'advanced' }),
  api('CEF3菜单_按索引插入分隔线', 'CefMenuModel::InsertSeparatorAt', [{ name: '菜单句柄', type: 'longLong' }, { name: '索引', type: 'longLong' }], 'int', '在指定索引插入分隔线。', { visibility: 'advanced' }),
  api('CEF3菜单_按索引插入项目', 'CefMenuModel::InsertItemAt', [{ name: '菜单句柄', type: 'longLong' }, { name: '索引', type: 'longLong' }, { name: '命令ID', type: 'int' }, { name: '标题', type: 'wideString' }], 'int', '在指定索引插入普通项目。', { visibility: 'advanced' }),
  api('CEF3菜单_按索引插入勾选项目', 'CefMenuModel::InsertCheckItemAt', [{ name: '菜单句柄', type: 'longLong' }, { name: '索引', type: 'longLong' }, { name: '命令ID', type: 'int' }, { name: '标题', type: 'wideString' }], 'int', '在指定索引插入勾选项目。', { visibility: 'advanced' }),
  api('CEF3菜单_按索引插入单选项目', 'CefMenuModel::InsertRadioItemAt', [{ name: '菜单句柄', type: 'longLong' }, { name: '索引', type: 'longLong' }, { name: '命令ID', type: 'int' }, { name: '标题', type: 'wideString' }, { name: '组ID', type: 'int' }], 'int', '在指定索引插入单选项目。', { visibility: 'advanced' }),
  api('CEF3菜单_按索引插入子菜单', 'CefMenuModel::InsertSubMenuAt', [{ name: '菜单句柄', type: 'longLong' }, { name: '索引', type: 'longLong' }, { name: '命令ID', type: 'int' }, { name: '标题', type: 'wideString' }], 'longLong', '在指定索引插入子菜单并返回受管句柄。', { visibility: 'advanced' }),
  api('CEF3菜单_删除项目', 'CefMenuModel::Remove', [{ name: '菜单句柄', type: 'longLong' }, { name: '命令ID', type: 'int' }], 'int', '按命令ID删除菜单项目。', { visibility: 'advanced' }),
  api('CEF3菜单_按索引删除', 'CefMenuModel::RemoveAt', [{ name: '菜单句柄', type: 'longLong' }, { name: '索引', type: 'longLong' }], 'int', '按索引删除菜单项目。', { visibility: 'advanced' }),
  api('CEF3菜单_取索引', 'CefMenuModel::GetIndexOf', [{ name: '菜单句柄', type: 'longLong' }, { name: '命令ID', type: 'int' }], 'int', '取得命令ID对应索引。', { visibility: 'advanced' }),
  api('CEF3菜单_按索引取命令ID', 'CefMenuModel::GetCommandIdAt', [{ name: '菜单句柄', type: 'longLong' }, { name: '索引', type: 'longLong' }], 'int', '取得指定索引的命令ID。', { visibility: 'advanced' }),
  api('CEF3菜单_按索引设命令ID', 'CefMenuModel::SetCommandIdAt', [{ name: '菜单句柄', type: 'longLong' }, { name: '索引', type: 'longLong' }, { name: '命令ID', type: 'int' }], 'int', '修改指定索引的命令ID。', { visibility: 'advanced' }),
  api('CEF3菜单_取标题', 'CefMenuModel::GetLabel', [{ name: '菜单句柄', type: 'longLong' }, { name: '命令ID', type: 'int' }], 'wideString', '按命令ID取得菜单标题。', { visibility: 'advanced' }),
  api('CEF3菜单_按索引取标题', 'CefMenuModel::GetLabelAt', [{ name: '菜单句柄', type: 'longLong' }, { name: '索引', type: 'longLong' }], 'wideString', '按索引取得菜单标题。', { visibility: 'advanced' }),
  api('CEF3菜单_设标题', 'CefMenuModel::SetLabel', [{ name: '菜单句柄', type: 'longLong' }, { name: '命令ID', type: 'int' }, { name: '标题', type: 'wideString' }], 'int', '按命令ID修改菜单标题。', { visibility: 'advanced' }),
  api('CEF3菜单_按索引设标题', 'CefMenuModel::SetLabelAt', [{ name: '菜单句柄', type: 'longLong' }, { name: '索引', type: 'longLong' }, { name: '标题', type: 'wideString' }], 'int', '按索引修改菜单标题。', { visibility: 'advanced' }),
  api('CEF3菜单_取类型', 'CefMenuModel::GetType', [{ name: '菜单句柄', type: 'longLong' }, { name: '命令ID', type: 'int' }], 'int', '取得菜单项目类型枚举。', { visibility: 'advanced' }),
  api('CEF3菜单_按索引取类型', 'CefMenuModel::GetTypeAt', [{ name: '菜单句柄', type: 'longLong' }, { name: '索引', type: 'longLong' }], 'int', '按索引取得菜单项目类型。', { visibility: 'advanced' }),
  api('CEF3菜单_取组ID', 'CefMenuModel::GetGroupId', [{ name: '菜单句柄', type: 'longLong' }, { name: '命令ID', type: 'int' }], 'int', '取得单选项目组ID。', { visibility: 'advanced' }),
  api('CEF3菜单_按索引取组ID', 'CefMenuModel::GetGroupIdAt', [{ name: '菜单句柄', type: 'longLong' }, { name: '索引', type: 'longLong' }], 'int', '按索引取得单选项目组ID。', { visibility: 'advanced' }),
  api('CEF3菜单_设组ID', 'CefMenuModel::SetGroupId', [{ name: '菜单句柄', type: 'longLong' }, { name: '命令ID', type: 'int' }, { name: '组ID', type: 'int' }], 'int', '修改单选项目组ID。', { visibility: 'advanced' }),
  api('CEF3菜单_按索引设组ID', 'CefMenuModel::SetGroupIdAt', [{ name: '菜单句柄', type: 'longLong' }, { name: '索引', type: 'longLong' }, { name: '组ID', type: 'int' }], 'int', '按索引修改单选项目组ID。', { visibility: 'advanced' }),
  api('CEF3菜单_取子菜单', 'CefMenuModel::GetSubMenu', [{ name: '菜单句柄', type: 'longLong' }, { name: '命令ID', type: 'int' }], 'longLong', '按命令ID取得子菜单受管句柄。', { visibility: 'advanced' }),
  api('CEF3菜单_按索引取子菜单', 'CefMenuModel::GetSubMenuAt', [{ name: '菜单句柄', type: 'longLong' }, { name: '索引', type: 'longLong' }], 'longLong', '按索引取得子菜单受管句柄。', { visibility: 'advanced' }),
  api('CEF3菜单_是否可见', 'CefMenuModel::IsVisible', [{ name: '菜单句柄', type: 'longLong' }, { name: '命令ID', type: 'int' }], 'int', '判断菜单项目是否可见。', { visibility: 'advanced' }),
  api('CEF3菜单_按索引是否可见', 'CefMenuModel::IsVisibleAt', [{ name: '菜单句柄', type: 'longLong' }, { name: '索引', type: 'longLong' }], 'int', '按索引判断菜单项目是否可见。', { visibility: 'advanced' }),
  api('CEF3菜单_设置可见', 'CefMenuModel::SetVisible', [{ name: '菜单句柄', type: 'longLong' }, { name: '命令ID', type: 'int' }, { name: '可见', type: 'bool' }], 'int', '设置菜单项目可见状态。', { visibility: 'advanced' }),
  api('CEF3菜单_按索引设置可见', 'CefMenuModel::SetVisibleAt', [{ name: '菜单句柄', type: 'longLong' }, { name: '索引', type: 'longLong' }, { name: '可见', type: 'bool' }], 'int', '按索引设置菜单项目可见状态。', { visibility: 'advanced' }),
  api('CEF3菜单_是否启用', 'CefMenuModel::IsEnabled', [{ name: '菜单句柄', type: 'longLong' }, { name: '命令ID', type: 'int' }], 'int', '判断菜单项目是否启用。', { visibility: 'advanced' }),
  api('CEF3菜单_按索引是否启用', 'CefMenuModel::IsEnabledAt', [{ name: '菜单句柄', type: 'longLong' }, { name: '索引', type: 'longLong' }], 'int', '按索引判断菜单项目是否启用。', { visibility: 'advanced' }),
  api('CEF3菜单_设置启用', 'CefMenuModel::SetEnabled', [{ name: '菜单句柄', type: 'longLong' }, { name: '命令ID', type: 'int' }, { name: '启用', type: 'bool' }], 'int', '设置菜单项目启用状态。', { visibility: 'advanced' }),
  api('CEF3菜单_按索引设置启用', 'CefMenuModel::SetEnabledAt', [{ name: '菜单句柄', type: 'longLong' }, { name: '索引', type: 'longLong' }, { name: '启用', type: 'bool' }], 'int', '按索引设置菜单项目启用状态。', { visibility: 'advanced' }),
  api('CEF3菜单_是否勾选', 'CefMenuModel::IsChecked', [{ name: '菜单句柄', type: 'longLong' }, { name: '命令ID', type: 'int' }], 'int', '判断勾选或单选项目是否选中。', { visibility: 'advanced' }),
  api('CEF3菜单_按索引是否勾选', 'CefMenuModel::IsCheckedAt', [{ name: '菜单句柄', type: 'longLong' }, { name: '索引', type: 'longLong' }], 'int', '按索引判断项目是否勾选。', { visibility: 'advanced' }),
  api('CEF3菜单_设置勾选', 'CefMenuModel::SetChecked', [{ name: '菜单句柄', type: 'longLong' }, { name: '命令ID', type: 'int' }, { name: '勾选', type: 'bool' }], 'int', '设置勾选或单选项目状态。', { visibility: 'advanced' }),
  api('CEF3菜单_按索引设置勾选', 'CefMenuModel::SetCheckedAt', [{ name: '菜单句柄', type: 'longLong' }, { name: '索引', type: 'longLong' }, { name: '勾选', type: 'bool' }], 'int', '按索引设置项目勾选状态。', { visibility: 'advanced' }),
  api('CEF3菜单_是否有快捷键', 'CefMenuModel::HasAccelerator', [{ name: '菜单句柄', type: 'longLong' }, { name: '命令ID', type: 'int' }], 'int', '判断项目是否有键盘快捷键。', { visibility: 'advanced' }),
  api('CEF3菜单_按索引是否有快捷键', 'CefMenuModel::HasAcceleratorAt', [{ name: '菜单句柄', type: 'longLong' }, { name: '索引', type: 'longLong' }], 'int', '按索引判断项目是否有键盘快捷键。', { visibility: 'advanced' }),
  api('CEF3菜单_设置快捷键', 'CefMenuModel::SetAccelerator', [{ name: '菜单句柄', type: 'longLong' }, { name: '命令ID', type: 'int' }, { name: '键码', type: 'int' }, { name: 'Shift', type: 'bool' }, { name: 'Ctrl', type: 'bool' }, { name: 'Alt', type: 'bool' }], 'int', '设置项目键盘快捷键。', { visibility: 'advanced' }),
  api('CEF3菜单_按索引设置快捷键', 'CefMenuModel::SetAcceleratorAt', [{ name: '菜单句柄', type: 'longLong' }, { name: '索引', type: 'longLong' }, { name: '键码', type: 'int' }, { name: 'Shift', type: 'bool' }, { name: 'Ctrl', type: 'bool' }, { name: 'Alt', type: 'bool' }], 'int', '按索引设置项目键盘快捷键。', { visibility: 'advanced' }),
  api('CEF3菜单_删除快捷键', 'CefMenuModel::RemoveAccelerator', [{ name: '菜单句柄', type: 'longLong' }, { name: '命令ID', type: 'int' }], 'int', '删除项目键盘快捷键。', { visibility: 'advanced' }),
  api('CEF3菜单_按索引删除快捷键', 'CefMenuModel::RemoveAcceleratorAt', [{ name: '菜单句柄', type: 'longLong' }, { name: '索引', type: 'longLong' }], 'int', '按索引删除项目键盘快捷键。', { visibility: 'advanced' }),
  api('CEF3菜单_取快捷键JSON', 'CefMenuModel::GetAccelerator', [{ name: '菜单句柄', type: 'longLong' }, { name: '命令ID', type: 'int' }], 'wideString', '以JSON返回键码及Shift/Ctrl/Alt状态。', { visibility: 'advanced' }),
  api('CEF3菜单_按索引取快捷键JSON', 'CefMenuModel::GetAcceleratorAt', [{ name: '菜单句柄', type: 'longLong' }, { name: '索引', type: 'longLong' }], 'wideString', '按索引以JSON返回快捷键。', { visibility: 'advanced' }),
  api('CEF3菜单_设置颜色', 'CefMenuModel::SetColor', [{ name: '菜单句柄', type: 'longLong' }, { name: '命令ID', type: 'int' }, { name: '颜色类型', type: 'int' }, { name: '颜色', type: 'longLong' }], 'int', '设置项目显式CEF颜色值。', { visibility: 'advanced' }),
  api('CEF3菜单_按索引设置颜色', 'CefMenuModel::SetColorAt', [{ name: '菜单句柄', type: 'longLong' }, { name: '索引', type: 'int' }, { name: '颜色类型', type: 'int' }, { name: '颜色', type: 'longLong' }], 'int', '按索引设置显式CEF颜色值；索引-1表示默认颜色。', { visibility: 'advanced' }),
  api('CEF3菜单_取颜色', 'CefMenuModel::GetColor', [{ name: '菜单句柄', type: 'longLong' }, { name: '命令ID', type: 'int' }, { name: '颜色类型', type: 'int' }], 'longLong', '取得项目显式CEF颜色值。', { visibility: 'advanced' }),
  api('CEF3菜单_按索引取颜色', 'CefMenuModel::GetColorAt', [{ name: '菜单句柄', type: 'longLong' }, { name: '索引', type: 'int' }, { name: '颜色类型', type: 'int' }], 'longLong', '按索引取得显式CEF颜色值。', { visibility: 'advanced' }),
  api('CEF3菜单_设置字体', 'CefMenuModel::SetFontList', [{ name: '菜单句柄', type: 'longLong' }, { name: '命令ID', type: 'int' }, { name: '字体描述', type: 'wideString' }], 'int', '设置项目CEF字体描述。', { visibility: 'advanced' }),
  api('CEF3菜单_按索引设置字体', 'CefMenuModel::SetFontListAt', [{ name: '菜单句柄', type: 'longLong' }, { name: '索引', type: 'int' }, { name: '字体描述', type: 'wideString' }], 'int', '按索引设置CEF字体描述；索引-1表示默认字体。', { visibility: 'advanced' }),
  api('CEF3菜单_释放', 'LB_CEF3_MenuRelease', [{ name: '菜单句柄', type: 'longLong' }], 'int', '在CEF UI线程释放菜单受管句柄。', { visibility: 'advanced' }),
  api('CEF3图像_创建', 'CefImage::CreateImage', [], 'longLong', '在CEF UI线程创建空图像并返回类型化受管句柄。', { visibility: 'advanced' }),
  api('CEF3图像_是否为空', 'CefImage::IsEmpty', [{ name: '图像句柄', type: 'longLong' }], 'int', '判断图像是否不含任何缩放表示。', { visibility: 'advanced' }),
  api('CEF3图像_是否相同', 'CefImage::IsSame', [{ name: '图像句柄', type: 'longLong' }, { name: '另一图像句柄', type: 'longLong' }], 'int', '比较两个CEF图像对象。', { visibility: 'advanced' }),
  api('CEF3图像_添加位图', 'CefImage::AddBitmap', [
    { name: '图像句柄', type: 'longLong' }, { name: '缩放', type: 'double' },
    { name: '像素宽度', type: 'int' }, { name: '像素高度', type: 'int' },
    { name: '颜色类型', type: 'int' }, { name: '透明类型', type: 'int' },
    { name: '像素缓冲', type: 'longLong' }
  ], 'int', '从受管BGRA/RGBA像素缓冲添加缩放表示，缓冲大小必须为宽×高×4。', { visibility: 'advanced' }),
  api('CEF3图像_添加PNG', 'CefImage::AddPNG', [{ name: '图像句柄', type: 'longLong' }, { name: '缩放', type: 'double' }, { name: 'PNG缓冲', type: 'longLong' }], 'int', '从受管PNG缓冲添加缩放表示。', { visibility: 'advanced' }),
  api('CEF3图像_添加JPEG', 'CefImage::AddJPEG', [{ name: '图像句柄', type: 'longLong' }, { name: '缩放', type: 'double' }, { name: 'JPEG缓冲', type: 'longLong' }], 'int', '从受管JPEG缓冲添加缩放表示。', { visibility: 'advanced' }),
  api('CEF3图像_取宽度', 'CefImage::GetWidth', [{ name: '图像句柄', type: 'longLong' }], 'longLong', '取得图像的设备无关宽度。', { visibility: 'advanced' }),
  api('CEF3图像_取高度', 'CefImage::GetHeight', [{ name: '图像句柄', type: 'longLong' }], 'longLong', '取得图像的设备无关高度。', { visibility: 'advanced' }),
  api('CEF3图像_是否有表示', 'CefImage::HasRepresentation', [{ name: '图像句柄', type: 'longLong' }, { name: '缩放', type: 'double' }], 'int', '判断指定缩放表示是否存在。', { visibility: 'advanced' }),
  api('CEF3图像_删除表示', 'CefImage::RemoveRepresentation', [{ name: '图像句柄', type: 'longLong' }, { name: '缩放', type: 'double' }], 'int', '删除指定缩放表示。', { visibility: 'advanced' }),
  api('CEF3图像_取表示信息', 'CefImage::GetRepresentationInfo', [{ name: '图像句柄', type: 'longLong' }, { name: '缩放', type: 'double' }], 'wideString', '以JSON返回最接近缩放表示的实际缩放、像素宽度和高度。', { visibility: 'advanced' }),
  api('CEF3图像_取位图缓冲', 'CefImage::GetAsBitmap', [{ name: '图像句柄', type: 'longLong' }, { name: '缩放', type: 'double' }, { name: '颜色类型', type: 'int' }, { name: '透明类型', type: 'int' }], 'longLong', '导出指定缩放表示为受管位图缓冲。', { visibility: 'advanced' }),
  api('CEF3图像_取PNG缓冲', 'CefImage::GetAsPNG', [{ name: '图像句柄', type: 'longLong' }, { name: '缩放', type: 'double' }, { name: '保留透明', type: 'bool' }], 'longLong', '导出指定缩放表示为受管PNG缓冲。', { visibility: 'advanced' }),
  api('CEF3图像_取JPEG缓冲', 'CefImage::GetAsJPEG', [{ name: '图像句柄', type: 'longLong' }, { name: '缩放', type: 'double' }, { name: '质量', type: 'int' }], 'longLong', '导出指定缩放表示为受管JPEG缓冲，质量范围0到100。', { visibility: 'advanced' }),
  api('CEF3图像_释放', 'LB_CEF3_ImageRelease', [{ name: '图像句柄', type: 'longLong' }], 'int', '在CEF UI线程释放图像对象受管句柄。', { visibility: 'advanced' }),
  api('CEF3导航项_取当前可见', 'CefBrowserHost::GetVisibleNavigationEntry', [{ name: '控件名', type: 'controlRef' }], 'longLong', '在CEF UI线程快照当前可见导航项并返回类型化受管句柄。', { visibility: 'advanced' }),
  api('CEF3导航项_读取历史', 'CefBrowserHost::GetNavigationEntries', [{ name: '控件名', type: 'controlRef' }, { name: '仅当前项', type: 'bool' }], 'longLong', '异步读取导航历史并返回结果为JSON数组的任务ID。', { visibility: 'advanced' }),
  api('CEF3导航项_是否有效', 'CefNavigationEntry::IsValid', [{ name: '导航项句柄', type: 'longLong' }], 'int', '判断导航项快照是否有效。', { visibility: 'advanced' }),
  api('CEF3导航项_取地址', 'CefNavigationEntry::GetURL', [{ name: '导航项句柄', type: 'longLong' }], 'wideString', '取得导航项实际URL。', { visibility: 'advanced' }),
  api('CEF3导航项_取显示地址', 'CefNavigationEntry::GetDisplayURL', [{ name: '导航项句柄', type: 'longLong' }], 'wideString', '取得适合显示的URL。', { visibility: 'advanced' }),
  api('CEF3导航项_取原始地址', 'CefNavigationEntry::GetOriginalURL', [{ name: '导航项句柄', type: 'longLong' }], 'wideString', '取得重定向前的原始URL。', { visibility: 'advanced' }),
  api('CEF3导航项_取标题', 'CefNavigationEntry::GetTitle', [{ name: '导航项句柄', type: 'longLong' }], 'wideString', '取得导航项页面标题。', { visibility: 'advanced' }),
  api('CEF3导航项_取跳转类型', 'CefNavigationEntry::GetTransitionType', [{ name: '导航项句柄', type: 'longLong' }], 'int', '取得导航跳转类型枚举。', { visibility: 'advanced' }),
  api('CEF3导航项_是否含提交数据', 'CefNavigationEntry::HasPostData', [{ name: '导航项句柄', type: 'longLong' }], 'int', '判断本次导航是否包含POST数据。', { visibility: 'advanced' }),
  api('CEF3导航项_取完成时间', 'CefNavigationEntry::GetCompletionTime', [{ name: '导航项句柄', type: 'longLong' }], 'double', '取得最后成功完成导航的Unix秒时间，未完成时为0。', { visibility: 'advanced' }),
  api('CEF3导航项_取HTTP状态码', 'CefNavigationEntry::GetHttpStatusCode', [{ name: '导航项句柄', type: 'longLong' }], 'int', '取得最后成功导航响应的HTTP状态码。', { visibility: 'advanced' }),
  api('CEF3导航项_释放', 'LB_CEF3_NavigationEntryRelease', [{ name: '导航项句柄', type: 'longLong' }], 'int', '释放导航项快照受管句柄。', { visibility: 'advanced' }),
  api('CEF3证书_取当前', 'CefSSLStatus::GetX509Certificate', [{ name: '控件名', type: 'controlRef' }], 'longLong', '在CEF UI线程读取当前可见导航项的TLS证书并返回不可变受管快照。', { visibility: 'advanced' }),
  api('CEF3证书_是否安全连接', 'CefSSLStatus::IsSecureConnection', [{ name: '证书句柄', type: 'longLong' }], 'int', '判断证书快照对应导航是否为安全TLS连接。', { visibility: 'advanced' }),
  api('CEF3证书_取证书状态', 'CefSSLStatus::GetCertStatus', [{ name: '证书句柄', type: 'longLong' }], 'longLong', '取得证书验证问题位掩码。', { visibility: 'advanced' }),
  api('CEF3证书_取SSL版本', 'CefSSLStatus::GetSSLVersion', [{ name: '证书句柄', type: 'longLong' }], 'int', '取得TLS连接版本枚举。', { visibility: 'advanced' }),
  api('CEF3证书_取内容状态', 'CefSSLStatus::GetContentStatus', [{ name: '证书句柄', type: 'longLong' }], 'longLong', '取得页面安全内容状态位掩码。', { visibility: 'advanced' }),
  api('CEF3证书_取主体', 'CefX509Certificate::GetSubject', [{ name: '证书句柄', type: 'longLong' }], 'longLong', '取得证书主体受管快照句柄。', { visibility: 'advanced' }),
  api('CEF3证书_取颁发者', 'CefX509Certificate::GetIssuer', [{ name: '证书句柄', type: 'longLong' }], 'longLong', '取得证书颁发者受管快照句柄。', { visibility: 'advanced' }),
  api('CEF3证书_取序列号缓冲', 'CefX509Certificate::GetSerialNumber', [{ name: '证书句柄', type: 'longLong' }], 'longLong', '复制证书DER序列号并返回受管缓冲。', { visibility: 'advanced' }),
  api('CEF3证书_取DER缓冲', 'CefX509Certificate::GetDEREncoded', [{ name: '证书句柄', type: 'longLong' }], 'longLong', '复制DER编码证书并返回受管缓冲。', { visibility: 'advanced' }),
  api('CEF3证书_取PEM缓冲', 'CefX509Certificate::GetPEMEncoded', [{ name: '证书句柄', type: 'longLong' }], 'longLong', '复制PEM编码证书并返回受管缓冲。', { visibility: 'advanced' }),
  api('CEF3证书_取生效时间', 'CefX509Certificate::GetValidStart', [{ name: '证书句柄', type: 'longLong' }], 'longLong', '取得证书生效Unix秒时间。', { visibility: 'advanced' }),
  api('CEF3证书_取失效时间', 'CefX509Certificate::GetValidExpiry', [{ name: '证书句柄', type: 'longLong' }], 'longLong', '取得证书失效Unix秒时间。', { visibility: 'advanced' }),
  api('CEF3证书_取颁发链数量', 'CefX509Certificate::GetIssuerChainSize', [{ name: '证书句柄', type: 'longLong' }], 'longLong', '取得证书颁发链项目数量。', { visibility: 'advanced' }),
  api('CEF3证书_取DER颁发链项', 'CefX509Certificate::GetDEREncodedIssuerChain', [{ name: '证书句柄', type: 'longLong' }, { name: '索引', type: 'longLong' }], 'longLong', '复制指定DER颁发链项并返回受管缓冲。', { visibility: 'advanced' }),
  api('CEF3证书_取PEM颁发链项', 'CefX509Certificate::GetPEMEncodedIssuerChain', [{ name: '证书句柄', type: 'longLong' }, { name: '索引', type: 'longLong' }], 'longLong', '复制指定PEM颁发链项并返回受管缓冲。', { visibility: 'advanced' }),
  api('CEF3证书_释放', 'LB_CEF3_CertificateRelease', [{ name: '证书句柄', type: 'longLong' }], 'int', '释放证书受管快照。', { visibility: 'advanced' }),
  api('CEF3证书主体_取显示名', 'CefX509CertPrincipal::GetDisplayName', [{ name: '主体句柄', type: 'longLong' }], 'wideString', '取得证书主体显示名。', { visibility: 'advanced' }),
  api('CEF3证书主体_取通用名', 'CefX509CertPrincipal::GetCommonName', [{ name: '主体句柄', type: 'longLong' }], 'wideString', '取得证书主体通用名。', { visibility: 'advanced' }),
  api('CEF3证书主体_取地区名', 'CefX509CertPrincipal::GetLocalityName', [{ name: '主体句柄', type: 'longLong' }], 'wideString', '取得证书主体地区名。', { visibility: 'advanced' }),
  api('CEF3证书主体_取省州名', 'CefX509CertPrincipal::GetStateOrProvinceName', [{ name: '主体句柄', type: 'longLong' }], 'wideString', '取得证书主体省或州名。', { visibility: 'advanced' }),
  api('CEF3证书主体_取国家名', 'CefX509CertPrincipal::GetCountryName', [{ name: '主体句柄', type: 'longLong' }], 'wideString', '取得证书主体国家名。', { visibility: 'advanced' }),
  api('CEF3证书主体_取组织JSON', 'CefX509CertPrincipal::GetOrganizationNames', [{ name: '主体句柄', type: 'longLong' }], 'wideString', '取得组织名称UTF-16 JSON数组。', { visibility: 'advanced' }),
  api('CEF3证书主体_取组织单位JSON', 'CefX509CertPrincipal::GetOrganizationUnitNames', [{ name: '主体句柄', type: 'longLong' }], 'wideString', '取得组织单位名称UTF-16 JSON数组。', { visibility: 'advanced' }),
  api('CEF3证书主体_释放', 'LB_CEF3_CertificatePrincipalRelease', [{ name: '主体句柄', type: 'longLong' }], 'int', '释放证书主体受管快照。', { visibility: 'advanced' })
];

const sessionEntries = [
  api('CEF3会话_取缓存目录', 'LB_CEF3_GetProfilePath', [{ name: '控件名', type: 'controlRef' }], 'wideString', '取得实例实际使用的独立缓存目录。'),
  api('CEF3会话_取代理', 'LB_CEF3_GetProxy', [{ name: '控件名', type: 'controlRef' }], 'wideString', '取得实例创建时应用的代理地址。'),
  api('CEF3会话_取上下文', 'CefBrowserHost::GetRequestContext', [{ name: '控件名', type: 'controlRef' }], 'longLong', '取得浏览器独立RequestContext的类型化受管句柄。', { visibility: 'advanced' }),
  api('CEF3会话_上下文取缓存目录', 'CefRequestContext::GetCachePath', [{ name: '上下文句柄', type: 'longLong' }], 'wideString', '从RequestContext读取实际缓存目录。', { visibility: 'advanced' }),
  api('CEF3会话_是否有首选项', 'CefPreferenceManager::HasPreference', [{ name: '上下文句柄', type: 'longLong' }, { name: '名称', type: 'wideString' }], 'int', '在CEF UI线程判断当前隔离会话是否存在指定Preference。', { visibility: 'advanced' }),
  api('CEF3会话_首选项是否可写', 'CefPreferenceManager::CanSetPreference', [{ name: '上下文句柄', type: 'longLong' }, { name: '名称', type: 'wideString' }], 'int', '判断指定Preference能否在运行时修改。', { visibility: 'advanced' }),
  api('CEF3会话_取首选项', 'CefPreferenceManager::GetPreference', [{ name: '上下文句柄', type: 'longLong' }, { name: '名称', type: 'wideString' }], 'longLong', '读取Preference副本并返回CEF值受管句柄。', { visibility: 'advanced' }),
  api('CEF3会话_取全部首选项', 'CefPreferenceManager::GetAllPreferences', [{ name: '上下文句柄', type: 'longLong' }, { name: '包含默认值', type: 'bool' }], 'longLong', '读取全部Preference副本并返回CEF字典受管句柄。', { visibility: 'advanced' }),
  api('CEF3会话_设置首选项', 'CefPreferenceManager::SetPreference', [{ name: '上下文句柄', type: 'longLong' }, { name: '名称', type: 'wideString' }, { name: '值句柄', type: 'longLong' }], 'int', '设置隔离会话Preference；值句柄为0时恢复默认。', { visibility: 'advanced' }),
  api('CEF3会话_清理HTTP缓存', 'CefRequestContext::ClearHttpCache', [{ name: '上下文句柄', type: 'longLong' }], 'longLong', '异步清理当前隔离会话的HTTP缓存并返回任务ID。', { visibility: 'advanced' }),
  api('CEF3会话_清理证书例外', 'CefRequestContext::ClearCertificateExceptions', [{ name: '上下文句柄', type: 'longLong' }], 'longLong', '异步清理当前隔离会话的证书例外并返回任务ID。', { visibility: 'advanced' }),
  api('CEF3会话_清理HTTP认证', 'CefRequestContext::ClearHttpAuthCredentials', [{ name: '上下文句柄', type: 'longLong' }], 'longLong', '异步清理当前隔离会话保存的HTTP认证凭据。', { visibility: 'advanced' }),
  api('CEF3会话_关闭全部连接', 'CefRequestContext::CloseAllConnections', [{ name: '上下文句柄', type: 'longLong' }], 'longLong', '异步关闭当前隔离会话的活动与空闲连接。', { visibility: 'advanced' }),
  api('CEF3会话_Cookie读取全部', 'CefCookieManager::VisitAllCookies', [{ name: '上下文句柄', type: 'longLong' }], 'longLong', '异步读取当前隔离会话全部Cookie，任务结果为UTF-16 JSON数组。', { visibility: 'advanced' }),
  api('CEF3会话_Cookie按地址读取', 'CefCookieManager::VisitUrlCookies', [{ name: '上下文句柄', type: 'longLong' }, { name: '地址', type: 'wideString' }, { name: '包含HttpOnly', type: 'bool' }], 'longLong', '异步读取指定地址Cookie。', { visibility: 'advanced' }),
  api('CEF3会话_Cookie设置', 'CefCookieManager::SetCookie', [
    { name: '上下文句柄', type: 'longLong' }, { name: '地址', type: 'wideString' },
    { name: '名称', type: 'wideString' }, { name: '值', type: 'wideString' },
    { name: '域', type: 'wideString' }, { name: '路径', type: 'wideString' },
    { name: '安全', type: 'bool' }, { name: 'HttpOnly', type: 'bool' },
    { name: '过期Unix秒', type: 'longLong' }
  ], 'longLong', '异步写入Cookie；过期时间小于等于0时创建会话Cookie。', { visibility: 'advanced' }),
  api('CEF3会话_Cookie删除', 'CefCookieManager::DeleteCookies', [{ name: '上下文句柄', type: 'longLong' }, { name: '地址', type: 'wideString' }, { name: '名称', type: 'wideString' }], 'longLong', '异步删除匹配Cookie，任务结果包含删除数量。', { visibility: 'advanced' }),
  api('CEF3会话_Cookie落盘', 'CefCookieManager::FlushStore', [{ name: '上下文句柄', type: 'longLong' }], 'longLong', '异步把当前会话Cookie写入独立存储。', { visibility: 'advanced' }),
  api('CEF3会话_释放上下文', 'LB_CEF3_RequestContextRelease', [{ name: '上下文句柄', type: 'longLong' }], 'int', '释放RequestContext受管句柄。', { visibility: 'advanced' })
];

const networkEntries = [
  api('CEF3网络_设置代理', 'LB_CEF3_SetProxy', [{ name: '控件名', type: 'controlRef' }, { name: '代理地址', type: 'wideString' }], 'int', '在浏览器创建前设置实例RequestContext代理；空文本表示直连。', { runtimeName: 'CEF3_设置代理', visibility: 'advanced' }),
  api('CEF3网络_证书状态是否错误', 'cef_is_cert_status_error', [{ name: '证书状态', type: 'int' }], 'bool', '判断CEF证书状态位掩码是否包含错误；0表示CERT_STATUS_NONE。', { visibility: 'advanced' })
];

const transferEntries = [
  api('CEF3传输_开始下载', 'CefBrowserHost::StartDownload', [{ name: '控件名', type: 'controlRef' }, { name: '地址', type: 'wideString' }], 'int', '使用当前实例会话开始下载。'),
  api('CEF3传输_打印', 'CefBrowserHost::Print', [{ name: '控件名', type: 'controlRef' }], 'int', '打开当前页面的原生打印流程。'),
  api('CEF3传输_从缓冲创建读取流', 'CefStreamReader::CreateForData', [{ name: '缓冲句柄', type: 'longLong' }], 'CEF3读取流句柄', '从Bridge受管缓冲创建可跨线程使用的CEF读取流。读取流会保留源缓冲，即使源缓冲句柄已释放也能继续读取。', { runtimeName: 'LB_CEF3_StreamReaderCreateForBuffer', visibility: 'advanced' }),
  api('CEF3传输_从文件创建读取流', 'CefStreamReader::CreateForFile', [{ name: '路径', type: 'wideString' }], 'CEF3读取流句柄', '在当前项目允许的文件根目录内打开文件并创建受管CEF读取流；越界、空路径或无法打开的文件返回0。', { runtimeName: 'LB_CEF3_StreamReaderCreateForFile', visibility: 'advanced' }),
  api('CEF3传输_从缓冲创建读取处理器', 'CefReadHandler', [{ name: '缓冲句柄', type: 'longLong' }, { name: '可能阻塞', type: 'bool' }], 'CEF3读取处理器句柄', '从受管缓冲创建可供CEF异步读取的线程安全读取处理器；处理器保留源缓冲，可能阻塞仅作为CEF线程调度提示。', { runtimeName: 'LB_CEF3_ReadHandlerCreateForBuffer', visibility: 'advanced' }),
  api('CEF3传输_读取处理器读取', 'CefReadHandler::Read', [{ name: '读取处理器句柄', type: 'CEF3读取处理器句柄' }, { name: '最大字节数', type: 'longLong' }], 'longLong', '从读取处理器读取至多64MiB并返回新的受管缓冲句柄；通过CEF3缓冲_释放释放结果。', { runtimeName: 'LB_CEF3_ReadHandlerRead', visibility: 'advanced' }),
  api('CEF3传输_定位读取处理器', 'CefReadHandler::Seek', [{ name: '读取处理器句柄', type: 'CEF3读取处理器句柄' }, { name: '偏移量', type: 'longLong' }, { name: '基准', type: 'int' }], 'int', '按官方Seek语义定位读取处理器：基准0为开头、1为当前位置、2为结尾；无法定位返回负错误码。', { runtimeName: 'LB_CEF3_ReadHandlerSeek', visibility: 'advanced' }),
  api('CEF3传输_取读取处理器位置', 'CefReadHandler::Tell', [{ name: '读取处理器句柄', type: 'CEF3读取处理器句柄' }], 'longLong', '返回读取处理器当前字节偏移。', { runtimeName: 'LB_CEF3_ReadHandlerTell', visibility: 'advanced' }),
  api('CEF3传输_读取处理器是否结束', 'CefReadHandler::Eof', [{ name: '读取处理器句柄', type: 'CEF3读取处理器句柄' }], 'bool', '返回读取处理器是否已到达受管缓冲结尾。', { runtimeName: 'LB_CEF3_ReadHandlerEof', visibility: 'advanced' }),
  api('CEF3传输_读取处理器是否可能阻塞', 'CefReadHandler::MayBlock', [{ name: '读取处理器句柄', type: 'CEF3读取处理器句柄' }], 'bool', '返回创建读取处理器时声明的可能阻塞提示。', { runtimeName: 'LB_CEF3_ReadHandlerMayBlock', visibility: 'advanced' }),
  api('CEF3传输_从读取处理器创建流', 'CefStreamReader::CreateForHandler', [{ name: '读取处理器句柄', type: 'CEF3读取处理器句柄' }], 'CEF3读取流句柄', '将受管读取处理器接入真实CefStreamReader；流与处理器共享位置，并在任一端释放后由CEF引用计数保持安全生命周期。', { runtimeName: 'LB_CEF3_StreamReaderCreateForHandler', visibility: 'advanced' }),
  api('CEF3传输_释放读取处理器', 'CefReadHandler::Release', [{ name: '读取处理器句柄', type: 'CEF3读取处理器句柄' }], 'int', '释放受管读取处理器句柄；已创建的读取流会继续保持CEF对处理器的引用。', { runtimeName: 'LB_CEF3_HandleRelease', visibility: 'advanced' }),
  api('CEF3传输_从文件创建写入流', 'CefStreamWriter::CreateForFile', [{ name: '路径', type: 'wideString' }], 'CEF3写入流句柄', '在当前项目允许的文件根目录内创建或截断文件并返回受管CEF写入流；越界、空路径或无法创建的文件返回0。', { runtimeName: 'LB_CEF3_StreamWriterCreateForFile', visibility: 'advanced' }),
  api('CEF3传输_创建写入处理器', 'CefWriteHandler', [{ name: '可能阻塞', type: 'bool' }], 'CEF3写入处理器句柄', '创建线程安全的内存写入处理器；总容量限制为64MiB，可能阻塞仅作为CEF线程调度提示。', { runtimeName: 'LB_CEF3_WriteHandlerCreate', visibility: 'advanced' }),
  api('CEF3传输_写入处理器写入', 'CefWriteHandler::Write', [{ name: '写入处理器句柄', type: 'CEF3写入处理器句柄' }, { name: '缓冲句柄', type: 'longLong' }, { name: '起始偏移', type: 'longLong' }, { name: '写入字节数', type: 'longLong' }], 'longLong', '从受管缓冲的指定范围写入内存处理器；单次和总容量均不超过64MiB，返回实际写入字节数。', { runtimeName: 'LB_CEF3_WriteHandlerWrite', visibility: 'advanced' }),
  api('CEF3传输_定位写入处理器', 'CefWriteHandler::Seek', [{ name: '写入处理器句柄', type: 'CEF3写入处理器句柄' }, { name: '偏移量', type: 'longLong' }, { name: '基准', type: 'int' }], 'int', '按官方Seek语义定位写入处理器：基准0为开头、1为当前位置、2为当前内存结尾；越界返回负错误码。', { runtimeName: 'LB_CEF3_WriteHandlerSeek', visibility: 'advanced' }),
  api('CEF3传输_取写入处理器位置', 'CefWriteHandler::Tell', [{ name: '写入处理器句柄', type: 'CEF3写入处理器句柄' }], 'longLong', '返回写入处理器当前字节偏移。', { runtimeName: 'LB_CEF3_WriteHandlerTell', visibility: 'advanced' }),
  api('CEF3传输_刷新写入处理器', 'CefWriteHandler::Flush', [{ name: '写入处理器句柄', type: 'CEF3写入处理器句柄' }], 'int', '刷新写入处理器；内存处理器不落盘，成功返回0。', { runtimeName: 'LB_CEF3_WriteHandlerFlush', visibility: 'advanced' }),
  api('CEF3传输_写入处理器是否可能阻塞', 'CefWriteHandler::MayBlock', [{ name: '写入处理器句柄', type: 'CEF3写入处理器句柄' }], 'bool', '返回创建写入处理器时声明的可能阻塞提示。', { runtimeName: 'LB_CEF3_WriteHandlerMayBlock', visibility: 'advanced' }),
  api('CEF3传输_取写入处理器缓冲', 'CefWriteHandler::Snapshot', [{ name: '写入处理器句柄', type: 'CEF3写入处理器句柄' }], 'longLong', '复制写入处理器当前内存内容为新的受管缓冲句柄；通过CEF3缓冲_释放释放结果。', { runtimeName: 'LB_CEF3_WriteHandlerGetBuffer', visibility: 'advanced' }),
  api('CEF3传输_从写入处理器创建流', 'CefStreamWriter::CreateForHandler', [{ name: '写入处理器句柄', type: 'CEF3写入处理器句柄' }], 'CEF3写入流句柄', '将受管写入处理器接入真实CefStreamWriter；流与处理器共享位置，适合供CEF回调写入受管内存。', { runtimeName: 'LB_CEF3_StreamWriterCreateForHandler', visibility: 'advanced' }),
  api('CEF3传输_释放写入处理器', 'CefWriteHandler::Release', [{ name: '写入处理器句柄', type: 'CEF3写入处理器句柄' }], 'int', '释放受管写入处理器句柄；已创建的写入流会继续保持CEF对处理器的引用。', { runtimeName: 'LB_CEF3_HandleRelease', visibility: 'advanced' }),
  api('CEF3传输_写入流', 'CefStreamWriter::Write', [{ name: '写入流句柄', type: 'CEF3写入流句柄' }, { name: '缓冲句柄', type: 'longLong' }, { name: '起始偏移', type: 'longLong' }, { name: '写入字节数', type: 'longLong' }], 'longLong', '从受管缓冲的指定范围写入至多64MiB，返回实际写入字节数；越界或句柄错误返回负错误码。', { runtimeName: 'LB_CEF3_StreamWriterWrite', visibility: 'advanced' }),
  api('CEF3传输_定位写入流', 'CefStreamWriter::Seek', [{ name: '写入流句柄', type: 'CEF3写入流句柄' }, { name: '偏移量', type: 'longLong' }, { name: '基准', type: 'int' }], 'int', '按官方Seek语义定位写入流：基准0为开头、1为当前位置、2为结尾；返回0表示成功。', { runtimeName: 'LB_CEF3_StreamWriterSeek', visibility: 'advanced' }),
  api('CEF3传输_取写入流位置', 'CefStreamWriter::Tell', [{ name: '写入流句柄', type: 'CEF3写入流句柄' }], 'longLong', '返回写入流当前字节偏移。', { runtimeName: 'LB_CEF3_StreamWriterTell', visibility: 'advanced' }),
  api('CEF3传输_刷新写入流', 'CefStreamWriter::Flush', [{ name: '写入流句柄', type: 'CEF3写入流句柄' }], 'int', '将写入流的待写数据刷新到文件；返回0表示成功。', { runtimeName: 'LB_CEF3_StreamWriterFlush', visibility: 'advanced' }),
  api('CEF3传输_写入流是否可能阻塞', 'CefStreamWriter::MayBlock', [{ name: '写入流句柄', type: 'CEF3写入流句柄' }], 'bool', '返回CEF对当前写入流可能执行阻塞文件操作的提示；文件写入流通常返回真。', { runtimeName: 'LB_CEF3_StreamWriterMayBlock', visibility: 'advanced' }),
  api('CEF3传输_释放写入流', 'CefStreamWriter::Release', [{ name: '写入流句柄', type: 'CEF3写入流句柄' }], 'int', '释放受管写入流句柄；释放前应先刷新写入流，重复释放返回稳定错误码。', { runtimeName: 'LB_CEF3_HandleRelease', visibility: 'advanced' }),
  api('CEF3传输_读取流', 'CefStreamReader::Read', [{ name: '读取流句柄', type: 'CEF3读取流句柄' }, { name: '最大字节数', type: 'longLong' }], 'longLong', '读取至多64MiB数据并返回新的受管缓冲句柄；返回的缓冲需通过CEF3缓冲_释放释放。', { runtimeName: 'LB_CEF3_StreamReaderRead', visibility: 'advanced' }),
  api('CEF3传输_定位读取流', 'CefStreamReader::Seek', [{ name: '读取流句柄', type: 'CEF3读取流句柄' }, { name: '偏移量', type: 'longLong' }, { name: '基准', type: 'int' }], 'int', '按官方Seek语义定位读取流：基准0为开头、1为当前位置、2为结尾；返回0表示成功。', { runtimeName: 'LB_CEF3_StreamReaderSeek', visibility: 'advanced' }),
  api('CEF3传输_取读取流位置', 'CefStreamReader::Tell', [{ name: '读取流句柄', type: 'CEF3读取流句柄' }], 'longLong', '返回读取流当前字节偏移。', { runtimeName: 'LB_CEF3_StreamReaderTell', visibility: 'advanced' }),
  api('CEF3传输_读取流是否结束', 'CefStreamReader::Eof', [{ name: '读取流句柄', type: 'CEF3读取流句柄' }], 'bool', '返回当前读取位置是否已到流末尾。', { runtimeName: 'LB_CEF3_StreamReaderEof', visibility: 'advanced' }),
  api('CEF3传输_读取流是否可能阻塞', 'CefStreamReader::MayBlock', [{ name: '读取流句柄', type: 'CEF3读取流句柄' }], 'bool', '返回CEF对当前读取流可能执行阻塞文件操作的提示；内存缓冲读取流通常返回假。', { runtimeName: 'LB_CEF3_StreamReaderMayBlock', visibility: 'advanced' }),
  api('CEF3传输_释放读取流', 'CefStreamReader::Release', [{ name: '读取流句柄', type: 'CEF3读取流句柄' }], 'int', '释放受管读取流句柄和其保留的源缓冲引用；重复释放返回稳定错误码。', { runtimeName: 'LB_CEF3_HandleRelease', visibility: 'advanced' })
];

const transferTypes: ModuleTypeContribution[] = [
  { name: 'CEF3读取流句柄', kind: 'opaque', cppType: 'uint64_t', description: '由CEF3传输_从缓冲创建读取流或CEF3传输_从文件创建读取流返回的受管CefStreamReader句柄；不能转换为原生指针。' },
  { name: 'CEF3写入流句柄', kind: 'opaque', cppType: 'uint64_t', description: '由CEF3传输_从文件创建写入流或CEF3传输_从写入处理器创建流返回的受管CefStreamWriter句柄；只能配合写入流接口使用，不能转换为原生指针。' },
  { name: 'CEF3读取处理器句柄', kind: 'opaque', cppType: 'uint64_t', description: '由CEF3传输_从缓冲创建读取处理器返回的受管CefReadHandler句柄；只能用于读取处理器和从读取处理器创建流接口。' },
  { name: 'CEF3写入处理器句柄', kind: 'opaque', cppType: 'uint64_t', description: '由CEF3传输_创建写入处理器返回的受管CefWriteHandler句柄；只能用于写入处理器和从写入处理器创建流接口。' }
];

const automationEntries = [
  api('CEF3自动化_执行JS异步', 'Runtime.evaluate', [{ name: '控件名', type: 'controlRef' }, { name: '脚本', type: 'wideString' }], 'longLong', '通过DevTools Runtime.evaluate异步执行JavaScript，返回受管任务ID。', { visibility: 'advanced' }),
  api('CEF3Hook_注册脚本', 'CefRenderProcessHandler::OnContextCreated', [
    { name: '控件名', type: 'controlRef' }, { name: '名称', type: 'wideString' },
    { name: '脚本', type: 'wideString' }, { name: '地址匹配', type: 'wideString' },
    { name: '全部框架', type: 'bool' }, { name: '立即执行当前上下文', type: 'bool' }
  ], 'longLong', '注册持久JSHook；它会在匹配Frame的V8上下文创建时执行，并在导航后自动重建。', { visibility: 'advanced' }),
  api('CEF3Hook_移除脚本', 'LB_CEF3_JsHookRemove', [{ name: 'Hook句柄', type: 'longLong' }], 'int', '移除指定JSHook并释放受管句柄。', { visibility: 'advanced' }),
  api('CEF3Hook_清空脚本', 'LB_CEF3_JsHookClear', [{ name: '控件名', type: 'controlRef' }], 'int', '清空指定浏览器的全部已注册JSHook。', { visibility: 'advanced' }),
  api('CEF3Hook_取脚本列表', 'LB_CEF3_JsHookList', [{ name: '控件名', type: 'controlRef' }], 'wideString', '返回JSHook句柄、名称、地址匹配和Frame范围JSON。', { visibility: 'advanced' }),
  api('CEF3Hook_回复页面消息', 'LB_CEF3_JsHookReply', [
    { name: '控件名', type: 'controlRef' }, { name: '请求ID', type: 'longLong' },
    { name: '是否成功', type: 'bool' }, { name: '返回文本', type: 'wideString' }
  ], 'int', '回复页面 LingBuilder调用宿主(name, payload) 产生的Promise请求。', { visibility: 'advanced' })
];

const devtoolsEntries = [
  api('CEF3开发工具_打开', 'CefBrowserHost::ShowDevTools', [{ name: '控件名', type: 'controlRef' }], 'int', '打开指定实例的开发者工具；设计器禁止开发者工具时返回0。'),
  api('CEF3开发工具_关闭', 'CefBrowserHost::CloseDevTools', [{ name: '控件名', type: 'controlRef' }], 'int', '关闭指定实例的开发者工具。'),
  api('CEF3开发工具_是否打开', 'CefBrowserHost::HasDevTools', [{ name: '控件名', type: 'controlRef' }], 'int', '返回指定实例是否已打开开发者工具。'),
  api('CEF3开发工具_执行协议方法', 'CefBrowserHost::ExecuteDevToolsMethod', [
    { name: '控件名', type: 'controlRef' }, { name: '方法名', type: 'wideString' },
    { name: '参数JSON', type: 'wideString' }
  ], 'longLong', '执行 DevTools Protocol 方法并返回受管任务句柄；参数必须是 JSON 对象，结果使用 CEF3任务_取结果读取。', { runtimeName: 'CEF3开发工具_执行协议方法', visibility: 'advanced', example: 'CEF3开发工具_执行协议方法(浏览器1, "Runtime.enable", "{}")' }),
  api('CEF3开发工具_订阅代理附加', 'CefDevToolsMessageObserver::OnDevToolsAgentAttached', [{ name: '控件名', type: 'controlRef' }, { name: '启用', type: 'bool' }], 'int', '启用后将 DevTools 代理附加通知投递为“开发工具代理已附加”浏览器事件。', { runtimeName: 'CEF3开发工具_订阅代理附加', visibility: 'advanced' }),
  api('CEF3开发工具_订阅代理分离', 'CefDevToolsMessageObserver::OnDevToolsAgentDetached', [{ name: '控件名', type: 'controlRef' }, { name: '启用', type: 'bool' }], 'int', '启用后将 DevTools 代理分离通知投递为“开发工具代理已分离”浏览器事件。', { runtimeName: 'CEF3开发工具_订阅代理分离', visibility: 'advanced' }),
  api('CEF3开发工具_订阅协议事件', 'CefDevToolsMessageObserver::OnDevToolsEvent', [{ name: '控件名', type: 'controlRef' }, { name: '启用', type: 'bool' }], 'int', '启用后将 DevTools Protocol 事件投递为“开发工具协议事件”；参数 JSON 会复制到 paramsJson 字段。', { runtimeName: 'CEF3开发工具_订阅协议事件', visibility: 'advanced' }),
  api('CEF3开发工具_订阅协议消息', 'CefDevToolsMessageObserver::OnDevToolsMessage', [{ name: '控件名', type: 'controlRef' }, { name: '启用', type: 'bool' }], 'int', '启用后将原始 DevTools Protocol 消息投递为“开发工具协议消息”；观察器始终返回未处理，不会拦截 CEF 后续回调。', { runtimeName: 'CEF3开发工具_订阅协议消息', visibility: 'advanced' })
];

const viewsEntries = [
  api('CEF3视图_打开Chrome窗口', 'CefBrowserHost::CreateBrowser', [{ name: '控件名', type: 'controlRef' }, { name: '地址', type: 'wideString' }], 'int', '使用实例会话创建Chrome Runtime独立顶层窗口。', { runtimeName: 'CEF3_打开原生UI浏览器' })
];

const platformEntries = [
  api('CEF3平台_执行任务', 'CefTask::Execute', [{ name: '任务句柄', type: 'longLong' }], 'int', '执行受管任务回调并将任务标记为成功；CEF任务运行器内部也通过同一回调完成任务。', { runtimeName: 'LB_CEF3_TaskExecute', visibility: 'advanced' }),
  api('CEF3平台_任务运行器延迟投递', 'CefTaskRunner::PostDelayedTask', [{ name: '任务运行器句柄', type: 'longLong' }, { name: '任务句柄', type: 'longLong' }, { name: '延迟毫秒数', type: 'longLong' }], 'bool', '向指定CEF任务运行器投递受管任务；任务在目标线程延迟执行，返回值表示是否成功受理。', { runtimeName: 'LB_CEF3_TaskRunnerPostDelayedTask', visibility: 'advanced' }),
  api('CEF3平台_任务运行器投递', 'CefTaskRunner::PostTask', [{ name: '任务运行器句柄', type: 'longLong' }, { name: '任务句柄', type: 'longLong' }], 'bool', '向指定CEF任务运行器立即异步投递受管任务；任务在目标线程执行，返回值表示是否成功受理。', { runtimeName: 'LB_CEF3_TaskRunnerPostTask', visibility: 'advanced' }),
  api('CEF3平台_全局任务投递', 'cef_post_task', [{ name: 'CEF线程ID', type: 'int' }, { name: '任务句柄', type: 'longLong' }], 'bool', '向指定公开CEF线程立即异步投递受管任务；任务在目标线程执行，返回值表示是否成功受理。', { runtimeName: 'LB_CEF3_PostTask', visibility: 'advanced' }),
  api('CEF3平台_全局延迟任务投递', 'cef_post_delayed_task', [{ name: 'CEF线程ID', type: 'int' }, { name: '任务句柄', type: 'longLong' }, { name: '延迟毫秒数', type: 'longLong' }], 'bool', '向指定公开CEF线程投递受管任务；任务在目标线程延迟执行，返回值表示是否成功受理。', { runtimeName: 'LB_CEF3_PostDelayedTask', visibility: 'advanced' }),
  api('CEF3平台_取版本', 'cef_version_info', [], 'wideString', '返回编译时CEF与Chromium版本。'),
  api('CEF3平台_取退出代码', 'cef_get_exit_code', [], 'int', '返回CEF最近一次子进程或进程入口处理使用的退出代码；正常浏览器进程通常为0。', { visibility: 'advanced' }),
  api('CEF3平台_是否从右到左', 'cef_is_rtl', [], 'bool', '判断当前CEF应用文本方向是否为从右到左；结果来自CEF当前区域设置。', { visibility: 'advanced' }),
  api('CEF3平台_取系统跟踪时间', 'cef_now_from_system_trace_time', [], 'longLong', '返回CEF系统跟踪时钟值，用于与Trace事件时间戳进行同步比较。', { visibility: 'advanced' }),
  api('CEF3平台_开始跟踪', 'cef_begin_tracing', [{ name: '类别', type: 'wideString' }], 'longLong', '在CEF UI线程异步启动指定类别的性能跟踪并返回受管任务句柄；任务成功结果为 {"started":true}。同一时刻只能存在一个跟踪会话。', { runtimeName: 'LB_CEF3_BeginTracing', visibility: 'advanced' }),
  api('CEF3平台_结束跟踪', 'cef_end_tracing', [{ name: '输出文件', type: 'wideString' }], 'longLong', '在CEF UI线程异步结束当前性能跟踪并返回受管任务句柄；空文本由CEF创建临时跟踪文件，任务成功结果为 {"tracingFile":"..."}，调用方负责删除该文件。', { runtimeName: 'LB_CEF3_EndTracing', visibility: 'advanced' }),
  api('CEF3平台_取MIME扩展名', 'CefGetExtensionsForMimeType', [{ name: 'MIME类型', type: 'wideString' }], 'wideString', '以JSON数组返回指定小写MIME类型关联的扩展名。', { visibility: 'advanced' }),
  api('CEF3平台_取MIME类型', 'CefGetMimeType', [{ name: '扩展名', type: 'wideString' }], 'wideString', '返回扩展名对应的MIME类型；扩展名前的点号可省略。', { visibility: 'advanced' }),
  api('CEF3平台_设置可嵌套任务', 'CefSetNestableTasksAllowed', [{ name: '允许', type: 'bool' }], 'int', '在CEF UI线程进入确定可重入的原生消息循环前启用，退出后必须立即关闭；打印等不可重入流程禁止启用。', { visibility: 'advanced' }),
  api('CEF3平台_取任务管理器', 'cef_task_manager_get', [], 'longLong', '取得CEF全局任务管理器的类型化受管句柄；调用会自动调度到CEF UI线程。', { visibility: 'advanced' }),
  api('CEF3平台_任务管理器取任务数量', 'CefTaskManager::GetTasksCount', [{ name: '任务管理器句柄', type: 'longLong' }], 'longLong', '取得当前由CEF任务管理器跟踪的任务数量。', { visibility: 'advanced' }),
  api('CEF3平台_任务管理器取任务ID数组', 'CefTaskManager::GetTaskIdsList', [{ name: '任务管理器句柄', type: 'longLong' }], 'wideString', '返回当前任务ID的JSON整数数组；不暴露CEF原生数组指针。', { visibility: 'advanced' }),
  api('CEF3平台_任务管理器按浏览器取任务ID', 'CefTaskManager::GetTaskIdForBrowserId', [{ name: '任务管理器句柄', type: 'longLong' }, { name: '浏览器ID', type: 'int' }], 'longLong', '按CEF浏览器ID取得其主任务ID；无效或不存在时返回-1。', { visibility: 'advanced' }),
  api('CEF3平台_任务管理器终止任务', 'CefTaskManager::KillTask', [{ name: '任务管理器句柄', type: 'longLong' }, { name: '任务ID', type: 'longLong' }], 'bool', '尝试终止指定任务；任务不存在、不可终止或线程不正确时返回假。', { visibility: 'advanced' }),
  api('CEF3平台_任务管理器取任务信息', 'CefTaskManager::GetTaskInfo', [{ name: '任务管理器句柄', type: 'longLong' }, { name: '任务ID', type: 'longLong' }], 'wideString', '返回任务固定字段JSON：类型、标题、可终止、CPU、内存和GPU占用。', { visibility: 'advanced' }),
  api('CEF3平台_取当前线程任务运行器', 'CefTaskRunner::GetForCurrentThread', [], 'longLong', '取得当前CEF线程的任务运行器；非CEF线程返回0并设置错误。', { visibility: 'advanced' }),
  api('CEF3平台_取指定线程任务运行器', 'CefTaskRunner::GetForThread', [{ name: 'CEF线程ID', type: 'int' }], 'longLong', '取得指定CEF线程的任务运行器；线程ID必须是公开的CEF线程枚举值。', { visibility: 'advanced' }),
  api('CEF3平台_任务运行器是否属于当前线程', 'CefTaskRunner::BelongsToCurrentThread', [{ name: '任务运行器句柄', type: 'longLong' }], 'bool', '判断受管任务运行器是否属于当前调用线程。', { visibility: 'advanced' }),
  api('CEF3平台_任务运行器是否属于指定线程', 'CefTaskRunner::BelongsToThread', [{ name: '任务运行器句柄', type: 'longLong' }, { name: 'CEF线程ID', type: 'int' }], 'bool', '判断受管任务运行器是否属于指定的公开CEF线程。', { visibility: 'advanced' }),
  api('CEF3平台_任务运行器是否同一对象', 'CefTaskRunner::IsSame', [{ name: '任务运行器句柄', type: 'longLong' }, { name: '另一任务运行器句柄', type: 'longLong' }], 'bool', '判断两个受管任务运行器句柄是否指向同一CEF任务运行器。', { visibility: 'advanced' }),
  api('CEF3平台_创建专用线程', 'CefThread::CreateThread', [
    { name: '显示名称', type: 'wideString' }, { name: '优先级', type: 'int' },
    { name: '消息循环类型', type: 'int' }, { name: '可停止', type: 'bool' },
    { name: 'COM初始化模式', type: 'int' }
  ], 'longLong', '在CEF UI线程创建受管专用线程。优先级为0到3，消息循环为0默认、1 UI、2 IO，COM模式为0无、1 STA、2 MTA；STA必须使用UI消息循环。', { runtimeName: 'LB_CEF3_ThreadCreate', visibility: 'advanced' }),
  api('CEF3平台_线程取系统ID', 'CefThread::GetPlatformThreadId', [{ name: '线程句柄', type: 'longLong' }], 'longLong', '取得专用线程的Windows线程ID；停止后仍返回同一个ID。', { runtimeName: 'LB_CEF3_ThreadGetPlatformThreadId', visibility: 'advanced' }),
  api('CEF3平台_线程取任务运行器', 'CefThread::GetTaskRunner', [{ name: '线程句柄', type: 'longLong' }], 'longLong', '取得专用线程的受管任务运行器句柄，可用于立即或延迟投递任务。', { runtimeName: 'LB_CEF3_ThreadGetTaskRunner', visibility: 'advanced' }),
  api('CEF3平台_线程是否运行', 'CefThread::IsRunning', [{ name: '线程句柄', type: 'longLong' }], 'bool', '在创建该线程的CEF UI线程查询专用线程是否仍在运行。', { runtimeName: 'LB_CEF3_ThreadIsRunning', visibility: 'advanced' }),
  api('CEF3平台_停止专用线程', 'CefThread::Stop', [{ name: '线程句柄', type: 'longLong' }], 'int', '在创建该线程的CEF UI线程停止并等待专用线程退出；不可停止线程会返回明确的不支持错误。', { runtimeName: 'LB_CEF3_ThreadStop', visibility: 'advanced' }),
  api('CEF3平台_释放专用线程', 'LB_CEF3_HandleRelease', [{ name: '线程句柄', type: 'longLong' }], 'int', '释放受管线程句柄；可停止线程尚未停止时由Bridge在创建线程上安全停止后释放。', { runtimeName: 'LB_CEF3_HandleRelease', visibility: 'advanced' }),
  api('CEF3平台_组件取ID', 'CefComponent::GetID', [{ name: '组件句柄', type: 'longLong' }], 'wideString', '读取组件快照的唯一标识；组件对象可由组件更新器查询接口产生。', { visibility: 'advanced' }),
  api('CEF3平台_组件取名称', 'CefComponent::GetName', [{ name: '组件句柄', type: 'longLong' }], 'wideString', '读取组件快照的人类可读名称；组件尚未安装时返回空文本。', { visibility: 'advanced' }),
  api('CEF3平台_组件取状态', 'CefComponent::GetState', [{ name: '组件句柄', type: 'longLong' }], 'int', '读取组件快照的CEF状态枚举值；组件状态定义见CEF组件状态说明。', { visibility: 'advanced' }),
  api('CEF3平台_组件取版本', 'CefComponent::GetVersion', [{ name: '组件句柄', type: 'longLong' }], 'wideString', '读取组件快照的版本文本；组件尚未安装时返回空文本。', { visibility: 'advanced' }),
  api('CEF3平台_组件更新器按ID取组件', 'CefComponentUpdater::GetComponentByID', [{ name: '组件更新器句柄', type: 'longLong' }, { name: '组件ID', type: 'wideString' }], 'longLong', '按组件ID取得组件快照受管句柄；不存在或服务不可用时返回0并设置错误。', { visibility: 'advanced' }),
  api('CEF3平台_组件更新器取数量', 'CefComponentUpdater::GetComponentCount', [{ name: '组件更新器句柄', type: 'longLong' }], 'longLong', '取得组件更新器当前注册组件数量；服务不可用时返回0。', { visibility: 'advanced' }),
  api('CEF3平台_组件更新器取组件数组', 'CefComponentUpdater::GetComponents', [{ name: '组件更新器句柄', type: 'longLong' }], 'CEF3组件数组', '返回组件快照数组JSON；每项包含ID、名称、版本和状态，不暴露CEF原生指针。', { visibility: 'advanced' }),
  api('CEF3平台_组件更新器更新', 'CefComponentUpdater::Update', [{ name: '组件更新器句柄', type: 'longLong' }, { name: '组件ID', type: 'wideString' }, { name: '优先级', type: 'int' }], 'longLong', '异步触发组件按需更新；优先级0为后台，1为前台，返回受管任务句柄。', { visibility: 'advanced' }),
  api('CEF3平台_设置启动命令开关', 'CefApp::OnBeforeCommandLineProcessing', [{ name: '进程类型', type: 'wideString' }, { name: '开关名', type: 'wideString' }, { name: '开关值', type: 'wideString' }], 'int', '在CEF初始化前登记启动命令开关；进程类型为空时应用到浏览器及全部子进程，初始化时由OnBeforeCommandLineProcessing安全写入。', { visibility: 'advanced' }),
  api('CEF3平台_创建可等待事件', 'cef_waitable_event_create', [{ name: '自动重置', type: 'bool' }, { name: '初始已触发', type: 'bool' }], 'longLong', '创建线程同步用的受管等待事件；等待操作不得在CEF UI或IO线程阻塞。', { visibility: 'advanced' }),
  api('CEF3平台_可等待事件重置', 'CefWaitableEvent::Reset', [{ name: '事件句柄', type: 'longLong' }], 'int', '将受管等待事件置为未触发状态。', { visibility: 'advanced' }),
  api('CEF3平台_可等待事件触发', 'CefWaitableEvent::Signal', [{ name: '事件句柄', type: 'longLong' }], 'int', '将受管等待事件置为已触发状态，并唤醒等待线程。', { visibility: 'advanced' }),
  api('CEF3平台_可等待事件是否已触发', 'CefWaitableEvent::IsSignaled', [{ name: '事件句柄', type: 'longLong' }], 'bool', '查询受管等待事件是否已触发；自动重置事件查询后会恢复未触发状态。', { visibility: 'advanced' }),
  api('CEF3平台_可等待事件限时等待', 'CefWaitableEvent::TimedWait', [{ name: '事件句柄', type: 'longLong' }, { name: '最大毫秒', type: 'longLong' }], 'bool', '等待事件最多指定毫秒；UI和IO线程禁止阻塞调用。', { visibility: 'advanced' }),
  api('CEF3平台_可等待事件等待', 'CefWaitableEvent::Wait', [{ name: '事件句柄', type: 'longLong' }], 'int', '等待事件直到被触发；UI和IO线程禁止阻塞调用。', { visibility: 'advanced' }),
  api('CEF3命令行_创建', 'CefCommandLine::CreateCommandLine', [], 'longLong', '创建可写的CEF命令行对象并返回类型化受管句柄；可在CEF初始化前调用。', { visibility: 'advanced' }),
  api('CEF3命令行_是否有效', 'CefCommandLine::IsValid', [{ name: '命令行句柄', type: 'longLong' }], 'int', '判断类型化命令行句柄及底层CEF对象是否有效。', { visibility: 'advanced' }),
  api('CEF3命令行_是否只读', 'CefCommandLine::IsReadOnly', [{ name: '命令行句柄', type: 'longLong' }], 'int', '判断CEF命令行对象是否只读；全局命令行对象为只读。', { visibility: 'advanced' }),
  api('CEF3命令行_复制', 'CefCommandLine::Copy', [{ name: '命令行句柄', type: 'longLong' }], 'longLong', '复制命令行内容并返回新的独立可写受管句柄。', { visibility: 'advanced' }),
  api('CEF3命令行_从参数数组初始化', 'CefCommandLine::InitFromArgv', [{ name: '命令行句柄', type: 'longLong' }, { name: '参数数组', type: 'CEF3文本数组' }], 'int', '以参数数组初始化可写命令行；首项必须是程序名。Windows Bridge会按系统argv引用规则构造命令行文本，等价适配官方仅在非Windows支持的InitFromArgv。', { visibility: 'advanced' }),
  api('CEF3命令行_从文本初始化', 'CefCommandLine::InitFromString', [{ name: '命令行句柄', type: 'longLong' }, { name: '命令行文本', type: 'wideString' }], 'int', '在Windows上解析GetCommandLineW格式的UTF-16命令行文本。', { visibility: 'advanced' }),
  api('CEF3命令行_取完整文本', 'CefCommandLine::GetCommandLineString', [{ name: '命令行句柄', type: 'longLong' }], 'wideString', '返回CEF命令行对象表示的完整命令行文本。', { visibility: 'advanced' }),
  api('CEF3命令行_取程序', 'CefCommandLine::GetProgram', [{ name: '命令行句柄', type: 'longLong' }], 'wideString', '返回命令行的程序部分。', { visibility: 'advanced' }),
  api('CEF3命令行_设置程序', 'CefCommandLine::SetProgram', [{ name: '命令行句柄', type: 'longLong' }, { name: '程序', type: 'wideString' }], 'int', '设置可写命令行对象的程序部分。', { visibility: 'advanced' }),
  api('CEF3命令行_是否有开关', 'CefCommandLine::HasSwitches', [{ name: '命令行句柄', type: 'longLong' }], 'int', '判断命令行是否包含任意开关。', { visibility: 'advanced' }),
  api('CEF3命令行_是否有指定开关', 'CefCommandLine::HasSwitch', [{ name: '命令行句柄', type: 'longLong' }, { name: '开关名', type: 'wideString' }], 'int', '按不带前缀的ASCII名称判断命令行是否包含指定开关。', { visibility: 'advanced' }),
  api('CEF3命令行_添加开关', 'CefCommandLine::AppendSwitch', [{ name: '命令行句柄', type: 'longLong' }, { name: '开关名', type: 'wideString' }], 'int', '向可写命令行末尾添加无值开关；名称由CEF规范化为小写。', { visibility: 'advanced' }),
  api('CEF3命令行_添加带值开关', 'CefCommandLine::AppendSwitchWithValue', [{ name: '命令行句柄', type: 'longLong' }, { name: '开关名', type: 'wideString' }, { name: '开关值', type: 'wideString' }], 'int', '向可写命令行末尾添加带值开关；名称由CEF规范化为小写，开关值允许为空文本。', { visibility: 'advanced' }),
  api('CEF3命令行_取开关值', 'CefCommandLine::GetSwitchValue', [{ name: '命令行句柄', type: 'longLong' }, { name: '开关名', type: 'wideString' }], 'wideString', '读取指定开关的UTF-16值；开关不存在或没有值时返回空文本。', { visibility: 'advanced' }),
  api('CEF3命令行_移除开关', 'CefCommandLine::RemoveSwitch', [{ name: '命令行句柄', type: 'longLong' }, { name: '开关名', type: 'wideString' }], 'int', '从可写命令行中移除指定开关；不存在时保持成功。', { visibility: 'advanced' }),
  api('CEF3命令行_是否有参数', 'CefCommandLine::HasArguments', [{ name: '命令行句柄', type: 'longLong' }], 'int', '判断命令行中是否存在非开关参数。', { visibility: 'advanced' }),
  api('CEF3命令行_添加参数', 'CefCommandLine::AppendArgument', [{ name: '命令行句柄', type: 'longLong' }, { name: '参数', type: 'wideString' }], 'int', '向可写命令行末尾添加一个UTF-16参数；允许显式添加空参数。', { visibility: 'advanced' }),
  api('CEF3命令行_重置', 'CefCommandLine::Reset', [{ name: '命令行句柄', type: 'longLong' }], 'int', '清空可写命令行的全部开关和参数，但保留程序部分。', { visibility: 'advanced' }),
  api('CEF3命令行_取参数向量', 'CefCommandLine::GetArgv', [{ name: '命令行句柄', type: 'longLong' }], 'CEF3文本数组', '返回原始命令行向量，依次包含程序、开关、分隔符和普通参数。', { visibility: 'advanced' }),
  api('CEF3命令行_取参数列表', 'CefCommandLine::GetArguments', [{ name: '命令行句柄', type: 'longLong' }], 'CEF3文本数组', '返回全部非开关参数，不包含程序和开关。', { visibility: 'advanced' }),
  api('CEF3命令行_取开关列表', 'CefCommandLine::GetSwitches', [{ name: '命令行句柄', type: 'longLong' }], 'CEF3命令行开关数组', '返回名称已规范化为小写的开关记录数组；无值开关的值为空文本。', { visibility: 'advanced' }),
  api('CEF3命令行_前置包装器', 'CefCommandLine::PrependWrapper', [{ name: '命令行句柄', type: 'longLong' }, { name: '包装器', type: 'wideString' }], 'int', '在可写命令行前插入调试器等包装命令，例如“gdb --args”。', { visibility: 'advanced' }),
  api('CEF3命令行_取全局', 'CefCommandLine::GetGlobalCommandLine', [], 'longLong', '取得CEF进程全局命令行的只读受管句柄；修改操作会返回只读错误。', { visibility: 'advanced' }),
  api('CEF3命令行_释放', 'LB_CEF3_CommandLineRelease', [{ name: '命令行句柄', type: 'longLong' }], 'int', '释放CEF命令行受管句柄；释放后继续使用会返回明确错误。', { visibility: 'advanced' }),
  api('CEF3平台_取Chrome实验开关', 'CefPreferenceManager::GetChromeVariationsAsSwitches', [], 'wideString', '以JSON数组返回当前Chrome Variations命令行开关。', { visibility: 'advanced' }),
  api('CEF3平台_取Chrome实验说明', 'CefPreferenceManager::GetChromeVariationsAsStrings', [], 'wideString', '以JSON数组返回当前Chrome Variations可读说明。', { visibility: 'advanced' })
];

const platformTypes: ModuleTypeContribution[] = [
  { name: 'CEF3文本数组', kind: 'array', elementType: '文本型', description: '由Bridge受管列表转换得到的UTF-16文本数组。' },
  {
    name: 'CEF3命令行开关',
    kind: 'record',
    description: '命令行开关的名称和值。',
    fields: [
      { name: '名称', type: '文本型', description: '不含前缀且已规范化为小写的开关名。' },
      { name: '值', type: '文本型', description: '开关值；无值开关为空文本。' }
    ]
  },
  { name: 'CEF3命令行开关数组', kind: 'array', elementType: 'CEF3命令行开关', description: '命令行开关记录数组。' }
  , { name: 'CEF3任务ID数组', kind: 'array', elementType: '整数型', description: '由任务管理器返回的稳定任务ID数组。' }
  , { name: 'CEF3任务信息', kind: 'record', description: 'CEF任务管理器返回的固定任务信息字段。', fields: [
      { name: 'ID', type: '整数型', description: '任务唯一ID。' },
      { name: '类型', type: '整数型', description: 'CEF任务类型枚举值。' },
      { name: '可终止', type: '逻辑型', description: '任务是否允许终止。' },
      { name: '标题', type: '文本型', description: '任务显示标题。' },
      { name: 'CPU占用', type: '双精度小数型', description: '任务进程CPU占用。' },
      { name: '处理器数量', type: '整数型', description: '系统可用处理器数量。' },
      { name: '内存字节数', type: '整数型', description: '任务内存占用，-1表示不可用。' },
      { name: 'GPU内存字节数', type: '整数型', description: 'GPU内存占用，-1表示不可用。' },
      { name: 'GPU内存已合并', type: '逻辑型', description: 'GPU资源是否包含其它进程。' }
    ] }
  , { name: 'CEF3组件记录', kind: 'record', description: '组件更新器返回的组件快照字段。', fields: [
      { name: 'ID', type: '文本型', description: '组件唯一标识。' },
      { name: '名称', type: '文本型', description: '组件人类可读名称，未安装时可能为空。' },
      { name: '版本', type: '文本型', description: '组件版本文本，未安装时可能为空。' },
      { name: '状态', type: '整数型', description: 'CEF组件状态枚举值。' }
    ] }
  , { name: 'CEF3组件数组', kind: 'array', elementType: 'CEF3组件记录', description: '组件更新器返回的组件快照数组。' }
];

export const CEF3_SUBMODULES: LingBuilderModuleManifest[] = [
  module('lingbuilder.cef3.events', 'CEF3事件模块', '界面', '提供浏览器事件数据、同步决策和处理器引用绑定。', eventEntries),
  module('lingbuilder.cef3.objects', 'CEF3受管对象模块', '系统', '提供任务、缓冲、Value、Dictionary、List、Image、NavigationEntry和证书类型化对象的安全生命周期接口。', objectEntries),
  module('lingbuilder.cef3.session', 'CEF3会话模块', '网络', '提供每实例RequestContext、缓存和Cookie隔离会话能力。', sessionEntries, true),
  module('lingbuilder.cef3.network', 'CEF3网络模块', '网络', '提供实例级代理及后续请求/响应扩展入口。', networkEntries),
  module('lingbuilder.cef3.transfer', 'CEF3传输模块', '网络', '提供下载、打印、受管二进制流和读写处理器能力。', transferEntries, true, transferTypes),
  module('lingbuilder.cef3.automation', 'CEF3自动化模块', '系统', '提供异步JavaScript任务及后续DOM/V8能力。', automationEntries, true),
  module('lingbuilder.cef3.devtools', 'CEF3开发者工具模块', '系统', '提供受设计器策略控制的DevTools入口。', devtoolsEntries),
  module('lingbuilder.cef3.views', 'CEF3视图模块', '界面', '提供Chrome Runtime独立窗口入口。', viewsEntries),
  module('lingbuilder.cef3.platform', 'CEF3平台工具模块', '系统', '提供CEF版本与平台工具能力。', platformEntries, false, platformTypes)
];
