export type Win32ControlModuleId = 'lingbuilder.win32.basic' | 'lingbuilder.win32.common-controls' | 'lingbuilder.new_emoji.ui';

export type Win32ControlPropertyType =
  | 'text'
  | 'hotkey'
  | 'number'
  | 'boolean'
  | 'enum'
  | 'color'
  | 'file'
  | 'stringList'
  | 'columns'
  | 'treeNodes'
  | 'tabs'
  | 'date'
  | 'controlRef';

export type Win32ControlPropertyValue = string | number | boolean | string[] | Array<Record<string, unknown>> | null;

export interface Win32ControlPropertyDefinition {
  key: string;
  label: string;
  type: Win32ControlPropertyType;
  defaultValue: Win32ControlPropertyValue;
  options?: Array<{ value: string; label: string }>;
  min?: number;
  max?: number;
  description?: string;
}

export interface Win32ControlEventDefinition {
  name: string;
  label: string;
  handlerSuffix: string;
  notification: 'command' | 'notify' | 'scroll' | 'focus' | 'mouse' | 'window';
}

export interface Win32ControlDefinition {
  type: string;
  label: string;
  moduleId: Win32ControlModuleId;
  category: '基础' | '输入' | '集合' | '导航' | '日期' | '外壳' | '容器' | '媒体' | '上传' | '非可视';
  icon: string;
  nativeClass: string;
  nativeAdapter: string;
  defaultProps: {
    content: string;
    width: number;
    height: number;
    background?: string;
    foreground?: string;
  };
  properties: Win32ControlPropertyDefinition[];
  events: Win32ControlEventDefinition[];
  isContainer?: boolean;
  isVisual?: boolean;
  legacyOnly?: boolean;
  requiredLibraries?: string[];
}

const option = (value: string, label = value) => ({ value, label });
const text = (key: string, label: string, defaultValue = ''): Win32ControlPropertyDefinition => ({ key, label, type: 'text', defaultValue });
const hotkey = (key: string, label: string, defaultValue = ''): Win32ControlPropertyDefinition => ({ key, label, type: 'hotkey', defaultValue });
const number = (key: string, label: string, defaultValue = 0, min?: number, max?: number): Win32ControlPropertyDefinition => ({ key, label, type: 'number', defaultValue, min, max });
const bool = (key: string, label: string, defaultValue = false): Win32ControlPropertyDefinition => ({ key, label, type: 'boolean', defaultValue });
const color = (key: string, label: string, defaultValue: string): Win32ControlPropertyDefinition => ({ key, label, type: 'color', defaultValue });
const enumProp = (key: string, label: string, defaultValue: string, values: string[]): Win32ControlPropertyDefinition => ({
  key, label, type: 'enum', defaultValue, options: values.map(value => option(value))
});
const event = (
  name: string,
  label: string,
  handlerSuffix: string,
  notification: Win32ControlEventDefinition['notification']
): Win32ControlEventDefinition => ({ name, label, handlerSuffix, notification });

const COMMON_MOUSE_EVENTS = [
  event('MouseDown', '鼠标按下', '鼠标被按下', 'mouse'),
  event('MouseEnter', '鼠标移入', '鼠标移入', 'mouse'),
  event('MouseLeave', '鼠标移出', '鼠标移出', 'mouse')
];
const COMMON_FOCUS_EVENTS = [
  event('GotFocus', '获得焦点', '获得焦点', 'focus'),
  event('LostFocus', '失去焦点', '失去焦点', 'focus')
];
const ITEMS: Win32ControlPropertyDefinition = { key: 'items', label: '项目集合', type: 'stringList', defaultValue: [] };
const IMAGE_SOURCE: Win32ControlPropertyDefinition = { key: 'imageSource', label: '图片源', type: 'file', defaultValue: '' };
const GIF_SOURCE: Win32ControlPropertyDefinition = { key: 'gifSource', label: 'GIF 文件', type: 'file', defaultValue: '' };
const IMAGE_STRETCH: Win32ControlPropertyDefinition = { key: 'stretch', label: '填充方式', type: 'enum', defaultValue: 'uniform', options: [option('none', '原始大小'), option('fill', '拉伸填满'), option('uniform', '等比适应'), option('uniformToFill', '等比填满')] };
const TEXT_ALIGN: Win32ControlPropertyDefinition = {
  key: 'textAlign',
  label: '文本对齐',
  type: 'enum',
  defaultValue: 'left',
  options: [option('left', '左对齐'), option('center', '居中'), option('right', '右对齐')]
};
const STATUS_TEXT_ALIGN: Win32ControlPropertyDefinition = {
  key: 'textAlign',
  label: '文字对齐方式',
  type: 'enum',
  defaultValue: 'left',
  options: [option('left', '居左'), option('center', '居中'), option('right', '居右')]
};

function control(definition: Omit<Win32ControlDefinition, 'isVisual'>): Win32ControlDefinition {
  return { ...definition, isVisual: true };
}

function nonVisual(definition: Omit<Win32ControlDefinition, 'isVisual'>): Win32ControlDefinition {
  return { ...definition, isVisual: false };
}

export const WIN32_CONTROL_DEFINITIONS: Win32ControlDefinition[] = [
  control({ type: 'Button', label: '按钮', moduleId: 'lingbuilder.win32.basic', category: '基础', icon: 'SquareDot', nativeClass: 'BUTTON', nativeAdapter: 'button', defaultProps: { content: '新按钮', width: 120, height: 35, background: '#007ACC' }, properties: [enumProp('buttonStyle', '按钮样式', 'push', ['push', 'default', 'toggle', 'split', 'commandLink']), number('cornerRadius', '圆角大小', 6, 0, 100), bool('checked', '按下状态')], events: [event('Click', '被单击', '被单击', 'command'), ...COMMON_MOUSE_EVENTS, ...COMMON_FOCUS_EVENTS] }),
  control({ type: 'TextBox', label: '编辑框', moduleId: 'lingbuilder.win32.basic', category: '输入', icon: 'Keyboard', nativeClass: 'EDIT', nativeAdapter: 'edit', defaultProps: { content: '请输入内容...', width: 160, height: 34, background: '#2D2D30' }, properties: [bool('multiline', '多行'), bool('password', '密码输入'), bool('readOnly', '只读'), bool('numeric', '仅数字'), TEXT_ALIGN, { key: 'verticalAlign', label: '垂直对齐', type: 'enum', defaultValue: 'center', options: [option('top', '顶部'), option('center', '居中'), option('bottom', '底部')] }, enumProp('scrollBars', '滚动条', 'none', ['none', 'horizontal', 'vertical', 'both'])], events: [event('TextChanged', '内容被改变', '内容被改变', 'command'), ...COMMON_FOCUS_EVENTS] }),
  control({ type: 'Label', label: '标签/静态控件', moduleId: 'lingbuilder.win32.basic', category: '基础', icon: 'Type', nativeClass: 'STATIC', nativeAdapter: 'static', defaultProps: { content: '新文本标签', width: 180, height: 32 }, properties: [enumProp('staticStyle', '静态样式', 'text', ['text', 'bitmap', 'icon', 'frame']), TEXT_ALIGN, IMAGE_SOURCE], events: [...COMMON_MOUSE_EVENTS] }),
  control({ type: 'CheckBox', label: '复选框', moduleId: 'lingbuilder.win32.basic', category: '输入', icon: 'CheckSquare', nativeClass: 'BUTTON', nativeAdapter: 'checkbox', defaultProps: { content: '选项复选框', width: 150, height: 24 }, properties: [bool('checked', '默认选中'), bool('threeState', '三态模式')], events: [event('Checked', '被选中', '被选中', 'command'), event('Unchecked', '被取消选中', '被取消选中', 'command')] }),
  control({ type: 'RadioButton', label: '单选框', moduleId: 'lingbuilder.win32.basic', category: '输入', icon: 'CircleDot', nativeClass: 'BUTTON', nativeAdapter: 'radio', defaultProps: { content: '单选选项', width: 150, height: 24 }, properties: [bool('checked', '默认选中'), text('groupName', '分组名称')], events: [event('Checked', '被选中', '被选中', 'command'), event('Unchecked', '被取消选中', '被取消选中', 'command')] }),
  control({ type: 'ListBox', label: '列表框', moduleId: 'lingbuilder.win32.basic', category: '集合', icon: 'List', nativeClass: 'LISTBOX', nativeAdapter: 'listbox', defaultProps: { content: '', width: 180, height: 120, background: '#0F172A' }, properties: [ITEMS, number('selectedIndex', '默认选中项', 0, -1), bool('sorted', '自动排序'), bool('multiple', '允许多选'), number('itemHeight', '表项高度', 28, 16, 96), number('itemSpacing', '表项间距', 0, 0, 24), number('contentPadding', '内容内边距', 4, 0, 24), { key: 'scrollBarVisibility', label: '滚动条显示', type: 'enum', defaultValue: 'auto', options: [option('auto', '自动'), option('visible', '始终显示'), option('hidden', '隐藏')] }, number('scrollBarWidth', '滚动条粗细', 8, 4, 24), color('scrollBarTrackColor', '滚动条轨道颜色', '#172033'), color('scrollBarThumbColor', '滚动条滑块颜色', '#0E7490'), bool('showBorder', '显示边框', true), number('borderWidth', '边框粗细', 1, 0, 8), color('borderColor', '边框颜色', '#334155'), color('selectionStartColor', '选中起始颜色', '#7C3AED'), color('selectionEndColor', '选中结束颜色', '#0891B2'), color('selectionBorderColor', '选中边框颜色', '#38BDF8'), number('selectionCornerRadius', '选中圆角', 4, 0, 24)], events: [event('SelectionChanged', '选择项被改变', '选择项被改变', 'command'), event('DoubleClick', '被双击', '被双击', 'command')] }),
  control({ type: 'ComboBox', label: '组合框', moduleId: 'lingbuilder.win32.basic', category: '集合', icon: 'List', nativeClass: 'COMBOBOX', nativeAdapter: 'combobox', defaultProps: { content: '选择项', width: 160, height: 40 }, properties: [ITEMS, number('selectedIndex', '默认选中项', 0, -1), number('dropDownHeight', '下拉列表高度', 160, 40, 600), number('itemHeight', '表项高度', 28, 16, 96), bool('sorted', '自动排序'), bool('editable', '允许编辑'), color('borderColor', '边框颜色', '#334155'), color('selectionStartColor', '选中起始颜色', '#7C3AED'), color('selectionEndColor', '选中结束颜色', '#0891B2'), color('selectionBorderColor', '选中边框颜色', '#38BDF8')], events: [event('SelectionChanged', '选择项被改变', '选择项被改变', 'command'), event('TextChanged', '内容被改变', '内容被改变', 'command')] }),
  control({ type: 'GroupBox', label: '分组框', moduleId: 'lingbuilder.win32.basic', category: '容器', icon: 'Box', nativeClass: 'STATIC', nativeAdapter: 'groupbox', defaultProps: { content: '分组', width: 260, height: 160 }, properties: [{ key: 'titleAlign', label: '标题对齐', type: 'enum', defaultValue: 'left', options: [option('left', '居左'), option('center', '居中'), option('right', '居右')] }, bool('showBorder', '显示边框', true), number('borderWidth', '边框粗细', 1, 0, 8), color('borderColor', '边框颜色', '#64748B')], events: [], isContainer: true }),
  control({ type: 'ScrollBar', label: '滚动条', moduleId: 'lingbuilder.win32.basic', category: '输入', icon: 'MoveVertical', nativeClass: 'SCROLLBAR', nativeAdapter: 'scrollbar', defaultProps: { content: '', width: 20, height: 140 }, properties: [enumProp('orientation', '方向', 'vertical', ['horizontal', 'vertical']), number('minimum', '最小值', 0), number('maximum', '最大值', 100), number('value', '当前值', 0)], events: [event('ValueChanged', '数值被改变', '数值被改变', 'scroll')] }),
  control({ type: 'Image', label: '图片框', moduleId: 'lingbuilder.win32.basic', category: '媒体', icon: 'Image', nativeClass: 'STATIC', nativeAdapter: 'image', defaultProps: { content: '', width: 180, height: 140 }, properties: [IMAGE_SOURCE, IMAGE_STRETCH], events: [...COMMON_MOUSE_EVENTS] }),
  control({ type: 'AnimatedImage', label: '动态图像控件', moduleId: 'lingbuilder.win32.basic', category: '媒体', icon: 'Film', nativeClass: 'STATIC', nativeAdapter: 'animated-image', defaultProps: { content: '', width: 180, height: 140 }, properties: [GIF_SOURCE, IMAGE_STRETCH, bool('autoPlay', '自动播放', true), bool('loop', '循环播放', true)], events: [...COMMON_MOUSE_EVENTS, event('Finished', '播放完毕', '播放完毕', 'command')] }),
  control({ type: 'ProgressBar', label: '进度条', moduleId: 'lingbuilder.win32.basic', category: '基础', icon: 'Minus', nativeClass: 'msctls_progress32', nativeAdapter: 'progress', defaultProps: { content: '50', width: 300, height: 20 }, properties: [number('minimum', '最小值', 0), number('maximum', '最大值', 100), number('value', '当前值', 50), bool('marquee', '不确定进度')], events: [] }),
  control({ type: 'Grid', label: '网格容器（旧项目兼容）', moduleId: 'lingbuilder.win32.basic', category: '容器', icon: 'LayoutGrid', nativeClass: 'STATIC', nativeAdapter: 'container', defaultProps: { content: '', width: 360, height: 220 }, properties: [bool('showBorder', '显示边框', true)], events: [event('Loaded', '创建完毕', '创建完毕', 'window')], isContainer: true, legacyOnly: true }),

  control({ type: 'ListView', label: '列表视图', moduleId: 'lingbuilder.win32.common-controls', category: '集合', icon: 'Table', nativeClass: 'SysListView32', nativeAdapter: 'listview', defaultProps: { content: '', width: 320, height: 180 }, properties: [{ key: 'columns', label: '列集合', type: 'columns', defaultValue: [] }, { key: 'items', label: '行项目', type: 'columns', defaultValue: [] }, { key: 'view', label: '视图模式', type: 'enum', defaultValue: 'details', options: [option('icon', '大图标'), option('smallIcon', '小图标'), option('list', '列表'), option('details', '详细信息')] }, bool('gridLines', '显示网格线', true), bool('multiple', '允许多选'), color('borderColor', '边框颜色', '#64748B'), number('borderWidth', '边框粗细', 1, 0, 8), number('headerHeight', '表头高度', 28, 16, 96), number('itemHeight', '表项高度', 28, 16, 96), text('imageListId', '图像列表 ID')], events: [event('SelectionChanged', '选择项被改变', '选择项被改变', 'notify'), event('DoubleClick', '被双击', '被双击', 'notify'), event('ColumnClick', '列被单击', '列被单击', 'notify')] }),
  control({ type: 'TreeView', label: '树形视图', moduleId: 'lingbuilder.win32.common-controls', category: '集合', icon: 'ListTree', nativeClass: 'SysTreeView32', nativeAdapter: 'treeview', defaultProps: { content: '', width: 260, height: 200 }, properties: [{ key: 'nodes', label: '节点集合', type: 'treeNodes', defaultValue: [] }, number('borderWidth', '边框线粗细', 1, 0, 8), color('borderColor', '边框线颜色', '#64748B'), number('nodeSpacing', '节点间距', 2, 0, 24), number('nodePadding', '节点内间距', 3, 0, 24), bool('showLines', '显示连接线', true), bool('checkBoxes', '显示复选框'), text('imageListId', '图像列表 ID')], events: [event('SelectionChanged', '选择节点被改变', '选择节点被改变', 'notify'), event('Expanded', '节点被展开', '节点被展开', 'notify'), event('Collapsed', '节点被折叠', '节点被折叠', 'notify'), event('DoubleClick', '被双击', '被双击', 'notify')] }),
  control({ type: 'TabControl', label: '选项卡', moduleId: 'lingbuilder.win32.common-controls', category: '容器', icon: 'PanelsTopLeft', nativeClass: 'SysTabControl32', nativeAdapter: 'tab', defaultProps: { content: '', width: 360, height: 240, background: '#FFFFFF', foreground: '#202020' }, properties: [{ key: 'tabs', label: '标签页', type: 'tabs', defaultValue: [{ id: 'page1', title: '标签页 1' }] }, number('selectedIndex', '当前页', 0, 0), bool('hideHeader', '隐藏表头'), text('imageListId', '图像列表 ID')], events: [event('SelectionChanged', '标签页被改变', '标签页被改变', 'notify')], isContainer: true }),
  control({ type: 'Header', label: '表头', moduleId: 'lingbuilder.win32.common-controls', category: '集合', icon: 'Columns3', nativeClass: 'SysHeader32', nativeAdapter: 'header', defaultProps: { content: '', width: 320, height: 28 }, properties: [{ key: 'columns', label: '列集合', type: 'columns', defaultValue: [] }, text('imageListId', '图像列表 ID')], events: [event('ColumnClick', '列被单击', '列被单击', 'notify'), event('ColumnResized', '列宽被改变', '列宽被改变', 'notify')] }),
  control({ type: 'ComboBoxEx', label: '增强组合框', moduleId: 'lingbuilder.win32.common-controls', category: '集合', icon: 'ListPlus', nativeClass: 'ComboBoxEx32', nativeAdapter: 'comboboxex', defaultProps: { content: '', width: 180, height: 55 }, properties: [ITEMS, number('selectedIndex', '默认选中项', 0, -1), number('dropDownHeight', '下拉列表高度', 160, 40, 600), text('imageListId', '图像列表 ID')], events: [event('SelectionChanged', '选择项被改变', '选择项被改变', 'command')] }),
  control({ type: 'SysLink', label: '超链接', moduleId: 'lingbuilder.win32.common-controls', category: '基础', icon: 'Link', nativeClass: 'SysLink', nativeAdapter: 'syslink', defaultProps: { content: '打开链接', width: 160, height: 28 }, properties: [text('url', '链接地址', 'https://example.com')], events: [event('Click', '链接被单击', '链接被单击', 'notify')] }),
  control({ type: 'DateTimePicker', label: '日期时间选择器', moduleId: 'lingbuilder.win32.common-controls', category: '日期', icon: 'CalendarClock', nativeClass: 'SysDateTimePick32', nativeAdapter: 'datetime', defaultProps: { content: '', width: 180, height: 40 }, properties: [{ key: 'value', label: '当前日期', type: 'date', defaultValue: '' }, enumProp('format', '显示格式', 'shortDate', ['shortDate', 'longDate', 'time', 'custom']), text('customFormat', '自定义格式'), number('calendarHeight', '下拉月历高度', 300, 200)], events: [event('ValueChanged', '日期被改变', '日期被改变', 'notify')] }),
  control({ type: 'MonthCalendar', label: '月历', moduleId: 'lingbuilder.win32.common-controls', category: '日期', icon: 'CalendarDays', nativeClass: 'SysMonthCal32', nativeAdapter: 'monthcalendar', defaultProps: { content: '', width: 300, height: 300 }, properties: [{ key: 'value', label: '当前日期', type: 'date', defaultValue: '' }, bool('multiSelect', '允许范围选择')], events: [event('ValueChanged', '日期被改变', '日期被改变', 'notify')] }),
  control({ type: 'ColorPicker', label: '颜色选择器', moduleId: 'lingbuilder.win32.common-controls', category: '输入', icon: 'Palette', nativeClass: 'BUTTON', nativeAdapter: 'color-picker', defaultProps: { content: '选择颜色', width: 180, height: 34, background: '#1E293B', foreground: '#E2E8F0' }, properties: [color('currentColor', '当前颜色', '#3B82F6'), text('dialogTitle', '对话框标题', '请选择颜色'), bool('showColorText', '显示颜色值', true)], events: [event('ColorChanged', '颜色被改变', '颜色被改变', 'command'), event('Opened', '选择窗口被打开', '选择窗口被打开', 'command'), event('Confirmed', '选择被确认', '选择被确认', 'command'), event('Cancelled', '选择被取消', '选择被取消', 'command'), event('Closed', '选择窗口被关闭', '选择窗口被关闭', 'command')] }),
  control({ type: 'TrackBar', label: '滑块', moduleId: 'lingbuilder.win32.common-controls', category: '输入', icon: 'SlidersHorizontal', nativeClass: 'msctls_trackbar32', nativeAdapter: 'trackbar', defaultProps: { content: '', width: 220, height: 36 }, properties: [number('minimum', '最小值', 0), number('maximum', '最大值', 100), number('value', '当前值', 50), number('tickFrequency', '刻度间隔', 10, 1)], events: [event('ValueChanged', '数值被改变', '数值被改变', 'scroll')] }),
  control({ type: 'UpDown', label: '数值调节器', moduleId: 'lingbuilder.win32.common-controls', category: '输入', icon: 'ChevronsUpDown', nativeClass: 'msctls_updown32', nativeAdapter: 'updown', defaultProps: { content: '', width: 24, height: 32 }, properties: [number('minimum', '最小值', 0), number('maximum', '最大值', 100), number('value', '当前值', 0), { key: 'buddyControl', label: '关联编辑框', type: 'controlRef', defaultValue: '' }], events: [event('ValueChanged', '数值被改变', '数值被改变', 'notify')] }),
  control({ type: 'HotKey', label: '热键输入框', moduleId: 'lingbuilder.win32.common-controls', category: '输入', icon: 'Command', nativeClass: 'msctls_hotkey32', nativeAdapter: 'hotkey', defaultProps: { content: '', width: 160, height: 30 }, properties: [hotkey('hotKey', '默认热键')], events: [event('ValueChanged', '热键被改变', '热键被改变', 'command')] }),
  control({ type: 'IPAddress', label: 'IP 地址框', moduleId: 'lingbuilder.win32.common-controls', category: '输入', icon: 'Network', nativeClass: 'SysIPAddress32', nativeAdapter: 'ipaddress', defaultProps: { content: '127.0.0.1', width: 180, height: 30 }, properties: [text('address', 'IP 地址', '127.0.0.1'), { key: 'verticalAlign', label: '文字垂直对齐方式', type: 'enum', defaultValue: 'center', options: [option('top', '顶部对齐'), option('center', '居中'), option('bottom', '底部对齐')] }, number('borderWidth', '边框粗细', 1, 0, 8), color('borderColor', '边框颜色', '#64748B')], events: [event('ValueChanged', '地址被改变', '地址被改变', 'notify')] }),
  control({ type: 'ToolBar', label: '工具栏', moduleId: 'lingbuilder.win32.common-controls', category: '外壳', icon: 'PanelTop', nativeClass: 'ToolbarWindow32', nativeAdapter: 'toolbar', defaultProps: { content: '', width: 480, height: 34 }, properties: [{ key: 'buttons', label: '按钮集合', type: 'columns', defaultValue: [] }, text('imageListId', '图像列表 ID')], events: [event('Click', '按钮被单击', '工具栏按钮被单击', 'command')] }),
  control({ type: 'StatusBar', label: '状态栏', moduleId: 'lingbuilder.win32.common-controls', category: '外壳', icon: 'PanelBottom', nativeClass: 'msctls_statusbar32', nativeAdapter: 'statusbar', defaultProps: { content: '就绪', width: 480, height: 24 }, properties: [{ key: 'parts', label: '分区集合', type: 'columns', defaultValue: [] }, STATUS_TEXT_ALIGN], events: [event('DoubleClick', '分区被双击', '状态栏分区被双击', 'notify')] }),
  nonVisual({ type: 'ToolTip', label: '工具提示', moduleId: 'lingbuilder.win32.common-controls', category: '非可视', icon: 'MessageSquareText', nativeClass: 'tooltips_class32', nativeAdapter: 'tooltip', defaultProps: { content: '提示文字', width: 120, height: 30 }, properties: [{ key: 'targetControl', label: '目标控件', type: 'controlRef', defaultValue: '' }, number('initialDelay', '显示延迟', 500, 0)], events: [] }),
  nonVisual({ type: 'FileDialog', label: '文件对话框', moduleId: 'lingbuilder.win32.common-controls', category: '非可视', icon: 'FolderOpen', nativeClass: 'IFileOpenDialog', nativeAdapter: 'file-dialog-resource', defaultProps: { content: '选择文件', width: 0, height: 0 }, properties: [text('title', '窗口标题', '选择文件'), text('filter', '文件类型', '所有文件|*.*'), bool('multiple', '允许多选'), bool('allowDrop', '允许拖拽')], events: [event('FilesSelected', '文件已选择', '文件已选择', 'notify'), event('FilesDropped', '文件被拖入', '文件被拖入', 'notify'), event('Cancelled', '选择被取消', '选择被取消', 'notify')] }),
  nonVisual({ type: 'ImageList', label: '图像列表资源', moduleId: 'lingbuilder.win32.common-controls', category: '非可视', icon: 'Images', nativeClass: 'HIMAGELIST', nativeAdapter: 'imagelist', defaultProps: { content: '', width: 0, height: 0 }, properties: [{ key: 'images', label: '图片集合', type: 'stringList', defaultValue: [] }, number('imageWidth', '图片宽度', 16, 1), number('imageHeight', '图片高度', 16, 1)], events: [] }),
  control({ type: 'ReBar', label: 'Rebar 容器（旧项目兼容）', moduleId: 'lingbuilder.win32.common-controls', category: '容器', icon: 'Rows3', nativeClass: 'ReBarWindow32', nativeAdapter: 'rebar', defaultProps: { content: '', width: 480, height: 42 }, properties: [{ key: 'bands', label: '带区集合', type: 'columns', defaultValue: [] }, bool('autoBindChildren', '自动绑定子控件', true), bool('locked', '锁定带区'), bool('showGrippers', '显示拖动柄', true), bool('fixedHeight', '固定带区高度'), bool('showBandBorders', '显示带区边框')], events: [event('BandDragStarted', '开始拖动带区', '带区开始拖动', 'notify'), event('BandDragEnded', '结束拖动带区', '带区结束拖动', 'notify'), event('HeightChanged', '高度被改变', '高度被改变', 'notify'), event('LayoutChanged', '布局被改变', '布局被改变', 'notify')], isContainer: true, legacyOnly: true }),
  control({ type: 'Pager', label: '分页容器（旧项目兼容）', moduleId: 'lingbuilder.win32.common-controls', category: '容器', icon: 'GalleryHorizontal', nativeClass: 'SysPager', nativeAdapter: 'pager', defaultProps: { content: '', width: 320, height: 120 }, properties: [{ key: 'orientation', label: '方向', type: 'enum', defaultValue: 'horizontal', options: [option('horizontal', '水平'), option('vertical', '垂直')] }], events: [event('Scroll', '被滚动', '被滚动', 'notify')], isContainer: true, legacyOnly: true }),
  control({ type: 'RichEdit', label: '富文本框', moduleId: 'lingbuilder.win32.common-controls', category: '输入', icon: 'TextCursorInput', nativeClass: 'RICHEDIT50W', nativeAdapter: 'richedit', defaultProps: { content: '富文本内容', width: 320, height: 180 }, properties: [bool('readOnly', '只读'), bool('wordWrap', '自动换行', true), bool('multiline', '多行', true), { key: 'scrollBars', label: '滚动条', type: 'enum', defaultValue: 'vertical', options: [option('none', '无'), option('horizontal', '水平'), option('vertical', '垂直'), option('both', '水平和垂直')] }, text('rtfText', 'RTF 格式化文本')], events: [event('TextChanged', '内容被改变', '内容被改变', 'command'), event('SelectionChanged', '选择区被改变', '选择区被改变', 'notify'), ...COMMON_FOCUS_EVENTS], requiredLibraries: ['ole32.lib'] }),
  control({ type: 'Animation', label: '动画控件', moduleId: 'lingbuilder.win32.common-controls', category: '媒体', icon: 'Film', nativeClass: 'STATIC', nativeAdapter: 'media-foundation-animation', defaultProps: { content: '', width: 240, height: 160, background: '#000000' }, properties: [{ key: 'aviSource', label: 'AVI 文件', type: 'file', defaultValue: '' }, bool('autoPlay', '自动播放', true), bool('loop', '循环播放', true)], events: [event('Finished', '播放完毕', '播放完毕', 'command')], requiredLibraries: ['mfplat.lib', 'mfplay.lib', 'mfuuid.lib'] }),
  control({ type: 'VideoPlayer', label: '视频播放器', moduleId: 'lingbuilder.win32.common-controls', category: '媒体', icon: 'Clapperboard', nativeClass: 'STATIC', nativeAdapter: 'media-foundation-video', defaultProps: { content: '视频播放器', width: 420, height: 236, background: '#000000', foreground: '#CBD5E1' }, properties: [{ key: 'videoSource', label: '视频文件', type: 'file', defaultValue: '' }, bool('autoPlay', '自动播放', true), bool('loop', '循环播放'), number('volume', '音量', 100, 0, 100)], events: [event('MediaOpened', '媒体已打开', '媒体已打开', 'notify'), event('PlaybackEnded', '播放完毕', '播放完毕', 'notify'), event('Error', '播放错误', '播放错误', 'notify')], requiredLibraries: ['mfplat.lib', 'mfplay.lib', 'mfuuid.lib'] }),
  control({ type: 'FlatScrollBar', label: '平面滚动条', moduleId: 'lingbuilder.win32.common-controls', category: '输入', icon: 'MoveVertical', nativeClass: 'SCROLLBAR', nativeAdapter: 'flatscrollbar', defaultProps: { content: '', width: 20, height: 140 }, properties: [enumProp('orientation', '方向', 'vertical', ['horizontal', 'vertical']), number('minimum', '最小值', 0), number('maximum', '最大值', 100), number('value', '当前值', 0)], events: [event('ValueChanged', '数值被改变', '数值被改变', 'scroll')] }),
  nonVisual({ type: 'PropertySheet', label: '属性页窗口', moduleId: 'lingbuilder.win32.common-controls', category: '非可视', icon: 'PanelTopOpen', nativeClass: '#32770', nativeAdapter: 'propertysheet', defaultProps: { content: '属性', width: 420, height: 320 }, properties: [{ key: 'tabs', label: '属性页', type: 'tabs', defaultValue: [] }], events: [event('Applied', '应用', '属性被应用', 'notify')] })
];

WIN32_CONTROL_DEFINITIONS.forEach(definition => {
  if (definition.isVisual !== false && !definition.properties.some(property => property.key === 'toolTip')) {
    definition.properties.push(text('toolTip', '工具提示文字'));
    definition.properties.push(number('toolTipDelay', '工具提示延迟', 500, 0));
  }
});

export type Win32ControlType = typeof WIN32_CONTROL_DEFINITIONS[number]['type'];

const definitionsByType = new Map(WIN32_CONTROL_DEFINITIONS.map(definition => [definition.type, definition]));

export function getWin32ControlDefinition(type: string): Win32ControlDefinition | undefined {
  return definitionsByType.get(type);
}

export function getWin32ControlsForModule(moduleId: Win32ControlModuleId): Win32ControlDefinition[] {
  return WIN32_CONTROL_DEFINITIONS.filter(definition => definition.moduleId === moduleId && !definition.legacyOnly);
}

export function getCreatableWin32ControlDefinitions(): Win32ControlDefinition[] {
  return WIN32_CONTROL_DEFINITIONS.filter(definition => !definition.legacyOnly);
}

export function createDefaultControlProperties(type: string, legacyContent = ''): Record<string, Win32ControlPropertyValue> {
  const definition = getWin32ControlDefinition(type);
  const properties = Object.fromEntries((definition?.properties || []).map(property => [property.key, property.defaultValue]));
  if (!definition) return properties;
  if (type === 'ProgressBar') properties.value = Number.parseInt(legacyContent, 10) || 50;
  if (type === 'Image') properties.imageSource = legacyContent && !legacyContent.startsWith('【') ? legacyContent : '';
  if (type === 'AnimatedImage') properties.gifSource = legacyContent && !legacyContent.startsWith('【') ? legacyContent : '';
  if (type === 'ComboBox' && legacyContent) properties.items = [legacyContent];
  if (type === 'IPAddress' && legacyContent) properties.address = legacyContent;
  return properties;
}

export function getPrimaryWin32ControlEvent(type: string): Win32ControlEventDefinition | undefined {
  return getWin32ControlDefinition(type)?.events[0];
}
