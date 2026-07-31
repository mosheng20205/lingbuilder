import type {
  LingBuilderModuleManifest,
  ModuleBindingValueType,
  ModuleCommandBinding,
  ModuleCommandContribution
} from './types';

const CEF3_ALPHA_VERSION = '3.0.0-alpha.2';
const CORE_DEPENDENCY = [{ moduleId: 'lingbuilder.cef3.browser', minimumVersion: CEF3_ALPHA_VERSION }];
const OBJECT_DEPENDENCY = [...CORE_DEPENDENCY, { moduleId: 'lingbuilder.cef3.objects', minimumVersion: CEF3_ALPHA_VERSION }];
const TARGET = [{
  id: 'windows-msvc-x64' as const,
  platform: 'windows' as const,
  arch: 'x64' as const,
  toolchain: 'msvc' as const
}];

type Parameter = { name: string; type: ModuleBindingValueType; description?: string };

function api(
  name: string,
  officialAlias: string,
  parameters: Parameter[],
  returnType: ModuleBindingValueType,
  description: string,
  options: { runtimeName?: string; example?: string; visibility?: 'default' | 'advanced' } = {}
): { command: ModuleCommandContribution; binding: ModuleCommandBinding } {
  const argumentText = parameters.map((parameter, index) => {
    if (parameter.type === 'handler') return `&$${index + 1}`;
    if (parameter.type === 'wideString' || parameter.type === 'utf8String') return `"$${index + 1}"`;
    if (parameter.type === 'bool') return index === 0 ? '真' : '假';
    return `$${index + 1}`;
  }).join(', ');
  return {
    command: {
      name,
      aliases: [officialAlias],
      signature: `${name}(${parameters.map(parameter => parameter.name).join(', ')})`,
      description,
      insertText: options.example || `${name}(${argumentText})`,
      returnType: returnType === 'void' ? '空' : returnType === 'wideString' ? '文本型'
        : returnType === 'longLong' || returnType === 'handle' ? '长整数型'
          : returnType === 'double' ? '双精度小数型' : '整数型',
      visibility: options.visibility
    },
    binding: {
      command: name,
      runtimeName: options.runtimeName || name,
      parameters,
      returnType,
      encoding: parameters.some(parameter => parameter.type === 'wideString' || parameter.type === 'handler') ? 'wide' : undefined,
      example: options.example
    }
  };
}

function module(
  id: string,
  name: string,
  category: LingBuilderModuleManifest['category'],
  description: string,
  entries: ReturnType<typeof api>[],
  needsObjects = false
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
    contributes: { commands: entries.map(entry => entry.command) },
    targets: TARGET,
    bindings: { commands: entries.map(entry => entry.binding) }
  };
}

const eventEntries = [
  api('CEF3事件_取最近事件', 'LB_CEF3_GetLastEvent', [{ name: '控件名', type: 'wideString' }], 'wideString', '取得指定浏览器最近事件名。', { runtimeName: 'CEF3_取最近事件' }),
  api('CEF3事件_取数据', 'LB_CEF3_GetEventData', [{ name: '控件名', type: 'wideString' }], 'wideString', '取得当前或最近事件的主要文本。', { runtimeName: 'CEF3_取事件数据' }),
  api('CEF3事件_取字段', 'LB_CEF3_GetEventField', [{ name: '控件名', type: 'wideString' }, { name: '字段名', type: 'wideString' }], 'wideString', '读取当前事件的结构化字段。', { runtimeName: 'CEF3_取事件字段' }),
  api('CEF3事件_设置结果', 'LB_CEF3_SetEventAction', [{ name: '控件名', type: 'wideString' }, { name: '动作', type: 'int' }], 'int', '设置当前同步事件动作。', { runtimeName: 'CEF3_设置事件结果' }),
  api('CEF3事件_设置返回文本', 'LB_CEF3_SetEventResultText', [{ name: '控件名', type: 'wideString' }, { name: '文本', type: 'wideString' }], 'int', '设置当前同步事件返回文本。', { runtimeName: 'CEF3_设置事件返回文本' }),
  api('CEF3事件_绑定', 'LB_CEF3_BindEvent', [{ name: '控件名', type: 'wideString' }, { name: '事件名', type: 'wideString' }, { name: '处理器', type: 'handler', description: '必须使用 &处理器名' }], 'int', '把浏览器事件绑定到当前类的无参数处理器。', { runtimeName: 'CEF3_绑定事件', example: 'CEF3事件_绑定("浏览器1", "加载完成", &$1)' })
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
  api('CEF3导航项_取当前可见', 'CefBrowserHost::GetVisibleNavigationEntry', [{ name: '控件名', type: 'wideString' }], 'longLong', '在CEF UI线程快照当前可见导航项并返回类型化受管句柄。', { visibility: 'advanced' }),
  api('CEF3导航项_读取历史', 'CefBrowserHost::GetNavigationEntries', [{ name: '控件名', type: 'wideString' }, { name: '仅当前项', type: 'bool' }], 'longLong', '异步读取导航历史并返回结果为JSON数组的任务ID。', { visibility: 'advanced' }),
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
  api('CEF3证书_取当前', 'CefSSLStatus::GetX509Certificate', [{ name: '控件名', type: 'wideString' }], 'longLong', '在CEF UI线程读取当前可见导航项的TLS证书并返回不可变受管快照。', { visibility: 'advanced' }),
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
  api('CEF3会话_取缓存目录', 'LB_CEF3_GetProfilePath', [{ name: '控件名', type: 'wideString' }], 'wideString', '取得实例实际使用的独立缓存目录。'),
  api('CEF3会话_取代理', 'LB_CEF3_GetProxy', [{ name: '控件名', type: 'wideString' }], 'wideString', '取得实例创建时应用的代理地址。'),
  api('CEF3会话_取上下文', 'CefBrowserHost::GetRequestContext', [{ name: '控件名', type: 'wideString' }], 'longLong', '取得浏览器独立RequestContext的类型化受管句柄。', { visibility: 'advanced' }),
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
  api('CEF3网络_设置代理', 'LB_CEF3_SetProxy', [{ name: '控件名', type: 'wideString' }, { name: '代理地址', type: 'wideString' }], 'int', '在浏览器创建前设置实例RequestContext代理；空文本表示直连。', { runtimeName: 'CEF3_设置代理', visibility: 'advanced' })
];

const transferEntries = [
  api('CEF3传输_开始下载', 'CefBrowserHost::StartDownload', [{ name: '控件名', type: 'wideString' }, { name: '地址', type: 'wideString' }], 'int', '使用当前实例会话开始下载。'),
  api('CEF3传输_打印', 'CefBrowserHost::Print', [{ name: '控件名', type: 'wideString' }], 'int', '打开当前页面的原生打印流程。')
];

const automationEntries = [
  api('CEF3自动化_执行JS异步', 'Runtime.evaluate', [{ name: '控件名', type: 'wideString' }, { name: '脚本', type: 'wideString' }], 'longLong', '通过DevTools Runtime.evaluate异步执行JavaScript，返回受管任务ID。', { visibility: 'advanced' })
];

const devtoolsEntries = [
  api('CEF3开发工具_打开', 'CefBrowserHost::ShowDevTools', [{ name: '控件名', type: 'wideString' }], 'int', '打开指定实例的开发者工具；设计器禁止开发者工具时返回0。'),
  api('CEF3开发工具_关闭', 'CefBrowserHost::CloseDevTools', [{ name: '控件名', type: 'wideString' }], 'int', '关闭指定实例的开发者工具。'),
  api('CEF3开发工具_是否打开', 'CefBrowserHost::HasDevTools', [{ name: '控件名', type: 'wideString' }], 'int', '返回指定实例是否已打开开发者工具。')
];

const viewsEntries = [
  api('CEF3视图_打开Chrome窗口', 'CefBrowserHost::CreateBrowser', [{ name: '控件名', type: 'wideString' }, { name: '地址', type: 'wideString' }], 'int', '使用实例会话创建Chrome Runtime独立顶层窗口。', { runtimeName: 'CEF3_打开原生UI浏览器' })
];

const platformEntries = [
  api('CEF3平台_取版本', 'cef_version_info', [], 'wideString', '返回编译时CEF与Chromium版本。'),
  api('CEF3平台_取MIME扩展名', 'CefGetExtensionsForMimeType', [{ name: 'MIME类型', type: 'wideString' }], 'wideString', '以JSON数组返回指定小写MIME类型关联的扩展名。', { visibility: 'advanced' }),
  api('CEF3平台_取Chrome实验开关', 'CefPreferenceManager::GetChromeVariationsAsSwitches', [], 'wideString', '以JSON数组返回当前Chrome Variations命令行开关。', { visibility: 'advanced' }),
  api('CEF3平台_取Chrome实验说明', 'CefPreferenceManager::GetChromeVariationsAsStrings', [], 'wideString', '以JSON数组返回当前Chrome Variations可读说明。', { visibility: 'advanced' })
];

export const CEF3_SUBMODULES: LingBuilderModuleManifest[] = [
  module('lingbuilder.cef3.events', 'CEF3事件模块', '界面', '提供浏览器事件数据、同步决策和处理器引用绑定。', eventEntries),
  module('lingbuilder.cef3.objects', 'CEF3受管对象模块', '系统', '提供任务、缓冲、Value、Dictionary、List、Image、NavigationEntry和证书类型化对象的安全生命周期接口。', objectEntries),
  module('lingbuilder.cef3.session', 'CEF3会话模块', '网络', '提供每实例RequestContext、缓存和Cookie隔离会话能力。', sessionEntries, true),
  module('lingbuilder.cef3.network', 'CEF3网络模块', '网络', '提供实例级代理及后续请求/响应扩展入口。', networkEntries),
  module('lingbuilder.cef3.transfer', 'CEF3传输模块', '网络', '提供下载和打印能力。', transferEntries),
  module('lingbuilder.cef3.automation', 'CEF3自动化模块', '系统', '提供异步JavaScript任务及后续DOM/V8能力。', automationEntries, true),
  module('lingbuilder.cef3.devtools', 'CEF3开发者工具模块', '系统', '提供受设计器策略控制的DevTools入口。', devtoolsEntries),
  module('lingbuilder.cef3.views', 'CEF3视图模块', '界面', '提供Chrome Runtime独立窗口入口。', viewsEntries),
  module('lingbuilder.cef3.platform', 'CEF3平台工具模块', '系统', '提供CEF版本与平台工具能力。', platformEntries)
];
