const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const STATUS = new Set(['implemented', 'mapped', 'internal', 'notApplicable', 'planned']);
const TRANSLATION_STATUS = new Set(['translated', 'needsReview', 'notRequired']);
/* 已有生成运行时中的真实高层映射；迁入 DLL 前只能标记 mapped，不能伪称 Bridge implemented。 */
const RUNTIME_MAPPINGS = new Map([
  ['cef_browser_host_create_browser', 'CefBrowserHost::CreateBrowser'],
  ['cef_request_context_create_context', 'CefRequestContext::CreateContext'],
  ['cef_browser_t.can_go_back', 'CanGoBack'], ['cef_browser_t.go_back', 'GoBack'],
  ['cef_browser_t.can_go_forward', 'CanGoForward'], ['cef_browser_t.go_forward', 'GoForward'],
  ['cef_browser_t.is_loading', 'IsLoading'], ['cef_browser_t.reload', 'Reload'],
  ['cef_browser_t.stop_load', 'StopLoad'], ['cef_browser_t.get_main_frame', 'GetMainFrame'],
  ['cef_browser_t.get_host', 'GetHost'], ['cef_browser_t.get_identifier', 'GetIdentifier'],
  ['cef_browser_host_t.close_browser', 'CloseBrowser'], ['cef_browser_host_t.set_audio_muted', 'SetAudioMuted'],
  ['cef_browser_host_t.start_download', 'StartDownload'], ['cef_browser_host_t.print', 'GetHost()->Print'],
  ['cef_browser_host_t.show_dev_tools', 'ShowDevTools'], ['cef_browser_host_t.close_dev_tools', 'CloseDevTools'],
  ['cef_browser_host_t.has_dev_tools', 'HasDevTools'],
  ['cef_browser_host_t.execute_dev_tools_method', 'ExecuteDevToolsMethod'],
  ['cef_browser_host_t.add_dev_tools_message_observer', 'AddDevToolsMessageObserver'],
  ['cef_dev_tools_message_observer_t.on_dev_tools_method_result', 'OnDevToolsMethodResult'],
  ['cef_preference_manager_t.set_preference', 'SetPreference'],
  ['cef_frame_t.load_url', 'LoadURL']
]);

const BRIDGE_IMPLEMENTATIONS = new Map([
  ['cef_execute_process', ['LB_CEF3_ExecuteSubProcess', 'CEF3_初始化']],
  ['cef_initialize', ['LB_CEF3_Initialize', 'CEF3_初始化']],
  ['cef_shutdown', ['LB_CEF3_Shutdown', 'CEF3_关闭']],
  ['cef_browser_host_create_browser', ['LB_CEF3_BrowserCreate', 'CEF3_创建']],
  ['cef_request_context_create_context', ['LB_CEF3_BrowserCreate', 'CEF3_创建']],
  ['cef_browser_t.can_go_back', ['LB_CEF3_BrowserCanGoBack', 'CEF3_是否可后退']],
  ['cef_browser_t.go_back', ['LB_CEF3_BrowserGoBack', 'CEF3_后退']],
  ['cef_browser_t.can_go_forward', ['LB_CEF3_BrowserCanGoForward', 'CEF3_是否可前进']],
  ['cef_browser_t.go_forward', ['LB_CEF3_BrowserGoForward', 'CEF3_前进']],
  ['cef_browser_t.is_loading', ['LB_CEF3_BrowserIsLoading', 'CEF3_是否加载中']],
  ['cef_browser_t.reload', ['LB_CEF3_BrowserReload', 'CEF3_刷新']],
  ['cef_browser_t.stop_load', ['LB_CEF3_BrowserStopLoad', 'CEF3_停止']],
  ['cef_browser_host_t.close_browser', ['LB_CEF3_BrowserClose', 'CEF3_关闭']],
  ['cef_browser_host_t.was_resized', ['LB_CEF3_BrowserResize', 'CEF3_调整全部大小']],
  ['cef_browser_host_t.set_audio_muted', ['LB_CEF3_BrowserSetAudioMuted', 'CEF3_创建']],
  ['cef_browser_host_t.start_download', ['LB_CEF3_BrowserStartDownload', 'CEF3传输_开始下载']],
  ['cef_browser_host_t.print', ['LB_CEF3_BrowserPrint', 'CEF3传输_打印']],
  ['cef_browser_host_t.show_dev_tools', ['LB_CEF3_BrowserShowDevTools', 'CEF3开发工具_打开']],
  ['cef_browser_host_t.close_dev_tools', ['LB_CEF3_BrowserCloseDevTools', 'CEF3开发工具_关闭']],
  ['cef_browser_host_t.has_dev_tools', ['LB_CEF3_BrowserHasDevTools', 'CEF3开发工具_是否打开']],
  ['cef_browser_host_t.execute_dev_tools_method', ['LB_CEF3_BrowserEvaluateJavaScript', 'CEF3自动化_执行JS异步']],
  ['cef_browser_host_t.add_dev_tools_message_observer', ['LB_CEF3_BrowserEvaluateJavaScript', 'CEF3自动化_执行JS异步']],
  ['cef_dev_tools_message_observer_t.on_dev_tools_method_result', ['LB_CEF3_BrowserEvaluateJavaScript', 'CEF3自动化_执行JS异步']],
  ['cef_display_handler_t.on_title_change', ['LB_CEF3_BrowserCreate', 'CEF3_取标题']],
  ['cef_display_handler_t.on_address_change', ['LB_CEF3_BrowserCreate', 'CEF3_取地址']],
  ['cef_life_span_handler_t.on_after_created', ['LB_CEF3_BrowserCreate', 'CEF3事件_绑定']],
  ['cef_life_span_handler_t.do_close', ['LB_CEF3_BrowserCreate', 'CEF3事件_绑定']],
  ['cef_life_span_handler_t.on_before_close', ['LB_CEF3_BrowserCreate', 'CEF3事件_绑定']],
  ['cef_load_handler_t.on_loading_state_change', ['LB_CEF3_BrowserCreate', 'CEF3事件_绑定']],
  ['cef_load_handler_t.on_load_error', ['LB_CEF3_BrowserCreate', 'CEF3事件_绑定']],
  ['cef_preference_manager_t.set_preference', ['LB_CEF3_BrowserCreate', 'CEF3网络_设置代理']],
  ['cef_frame_t.load_url', ['LB_CEF3_BrowserLoadUrl', 'CEF3_导航']],
  ['cef_value_create', ['LB_CEF3_ValueCreate', 'CEF3值_创建']],
  ['cef_value_t.copy', ['LB_CEF3_ValueCopy', 'CEF3值_复制']],
  ['cef_value_t.is_valid', ['LB_CEF3_ValueIsValid', 'CEF3值_是否有效']],
  ['cef_value_t.is_owned', ['LB_CEF3_ValueIsOwned', 'CEF3值_是否被拥有']],
  ['cef_value_t.is_read_only', ['LB_CEF3_ValueIsReadOnly', 'CEF3值_是否只读']],
  ['cef_value_t.is_same', ['LB_CEF3_ValueIsSame', 'CEF3值_是否同一对象']],
  ['cef_value_t.is_equal', ['LB_CEF3_ValueIsEqual', 'CEF3值_是否相等']],
  ['cef_value_t.get_type', ['LB_CEF3_ValueGetType', 'CEF3值_取类型']],
  ['cef_value_t.set_null', ['LB_CEF3_ValueSetNull', 'CEF3值_设为空']],
  ['cef_value_t.set_bool', ['LB_CEF3_ValueSetBool', 'CEF3值_设逻辑']],
  ['cef_value_t.set_int', ['LB_CEF3_ValueSetInt', 'CEF3值_设整数']],
  ['cef_value_t.set_double', ['LB_CEF3_ValueSetDouble', 'CEF3值_设小数']],
  ['cef_value_t.set_string', ['LB_CEF3_ValueSetString', 'CEF3值_设文本']],
  ['cef_value_t.set_binary', ['LB_CEF3_ValueSetBuffer', 'CEF3值_设缓冲']],
  ['cef_value_t.set_dictionary', ['LB_CEF3_ValueSetDictionary', 'CEF3值_设字典']],
  ['cef_value_t.set_list', ['LB_CEF3_ValueSetList', 'CEF3值_设列表']],
  ['cef_value_t.get_bool', ['LB_CEF3_ValueGetBool', 'CEF3值_取逻辑']],
  ['cef_value_t.get_int', ['LB_CEF3_ValueGetInt', 'CEF3值_取整数']],
  ['cef_value_t.get_double', ['LB_CEF3_ValueGetDouble', 'CEF3值_取小数']],
  ['cef_value_t.get_string', ['LB_CEF3_ValueGetString', 'CEF3值_取文本']],
  ['cef_value_t.get_binary', ['LB_CEF3_ValueGetBuffer', 'CEF3值_取缓冲']],
  ['cef_value_t.get_dictionary', ['LB_CEF3_ValueGetDictionary', 'CEF3值_取字典']],
  ['cef_value_t.get_list', ['LB_CEF3_ValueGetList', 'CEF3值_取列表']],
  ['cef_binary_value_create', ['LB_CEF3_ValueSetBuffer', 'CEF3值_设缓冲']],
  ['cef_binary_value_t.get_size', ['LB_CEF3_ValueGetBuffer', 'CEF3值_取缓冲']],
  ['cef_binary_value_t.get_data', ['LB_CEF3_ValueGetBuffer', 'CEF3值_取缓冲']],
  ['cef_binary_value_t.copy', ['LB_CEF3_BufferClone', 'CEF3缓冲_复制']],
  ['cef_binary_value_t.is_valid', ['LB_CEF3_BufferIsValid', 'CEF3缓冲_是否有效']],
  ['cef_binary_value_t.is_owned', ['LB_CEF3_BufferIsOwned', 'CEF3缓冲_是否被拥有']],
  ['cef_binary_value_t.is_same', ['LB_CEF3_BufferIsSame', 'CEF3缓冲_是否同一对象']],
  ['cef_binary_value_t.is_equal', ['LB_CEF3_BufferIsEqual', 'CEF3缓冲_是否相等']],
  ['cef_binary_value_t.get_raw_data', ['LB_CEF3_BufferCopy', 'CEF3缓冲_到十六进制']],
  ['cef_dictionary_value_create', ['LB_CEF3_DictionaryCreate', 'CEF3字典_创建']],
  ['cef_dictionary_value_t.is_valid', ['LB_CEF3_DictionaryIsValid', 'CEF3字典_是否有效']],
  ['cef_dictionary_value_t.is_owned', ['LB_CEF3_DictionaryIsOwned', 'CEF3字典_是否被拥有']],
  ['cef_dictionary_value_t.is_read_only', ['LB_CEF3_DictionaryIsReadOnly', 'CEF3字典_是否只读']],
  ['cef_dictionary_value_t.is_same', ['LB_CEF3_DictionaryIsSame', 'CEF3字典_是否同一对象']],
  ['cef_dictionary_value_t.is_equal', ['LB_CEF3_DictionaryIsEqual', 'CEF3字典_是否相等']],
  ['cef_dictionary_value_t.get_size', ['LB_CEF3_DictionaryGetSize', 'CEF3字典_取数量']],
  ['cef_dictionary_value_t.has_key', ['LB_CEF3_DictionaryHasKey', 'CEF3字典_是否存在']],
  ['cef_dictionary_value_t.get_keys', ['LB_CEF3_DictionaryGetKeysJson', 'CEF3字典_取键列表']],
  ['cef_dictionary_value_t.get_type', ['LB_CEF3_DictionaryGetType', 'CEF3字典_取类型']],
  ['cef_dictionary_value_t.set_value', ['LB_CEF3_DictionarySetValue', 'CEF3字典_设值']],
  ['cef_dictionary_value_t.get_value', ['LB_CEF3_DictionaryGetValue', 'CEF3字典_取值']],
  ['cef_dictionary_value_t.remove', ['LB_CEF3_DictionaryRemove', 'CEF3字典_删除']],
  ['cef_dictionary_value_t.clear', ['LB_CEF3_DictionaryClear', 'CEF3字典_清空']],
  ['cef_dictionary_value_t.copy', ['LB_CEF3_DictionaryCopy', 'CEF3字典_复制']],
  ['cef_dictionary_value_t.set_null', ['LB_CEF3_DictionarySetValue', 'CEF3字典_设值']],
  ['cef_dictionary_value_t.set_bool', ['LB_CEF3_DictionarySetValue', 'CEF3字典_设值']],
  ['cef_dictionary_value_t.set_int', ['LB_CEF3_DictionarySetValue', 'CEF3字典_设值']],
  ['cef_dictionary_value_t.set_double', ['LB_CEF3_DictionarySetValue', 'CEF3字典_设值']],
  ['cef_dictionary_value_t.set_string', ['LB_CEF3_DictionarySetValue', 'CEF3字典_设值']],
  ['cef_dictionary_value_t.set_binary', ['LB_CEF3_DictionarySetValue', 'CEF3字典_设值']],
  ['cef_dictionary_value_t.set_dictionary', ['LB_CEF3_DictionarySetValue', 'CEF3字典_设值']],
  ['cef_dictionary_value_t.set_list', ['LB_CEF3_DictionarySetValue', 'CEF3字典_设值']],
  ['cef_dictionary_value_t.get_bool', ['LB_CEF3_DictionaryGetValue', 'CEF3字典_取值']],
  ['cef_dictionary_value_t.get_int', ['LB_CEF3_DictionaryGetValue', 'CEF3字典_取值']],
  ['cef_dictionary_value_t.get_double', ['LB_CEF3_DictionaryGetValue', 'CEF3字典_取值']],
  ['cef_dictionary_value_t.get_string', ['LB_CEF3_DictionaryGetValue', 'CEF3字典_取值']],
  ['cef_dictionary_value_t.get_binary', ['LB_CEF3_DictionaryGetValue', 'CEF3字典_取值']],
  ['cef_dictionary_value_t.get_dictionary', ['LB_CEF3_DictionaryGetValue', 'CEF3字典_取值']],
  ['cef_dictionary_value_t.get_list', ['LB_CEF3_DictionaryGetValue', 'CEF3字典_取值']],
  ['cef_list_value_create', ['LB_CEF3_ListCreate', 'CEF3列表_创建']],
  ['cef_list_value_t.is_valid', ['LB_CEF3_ListIsValid', 'CEF3列表_是否有效']],
  ['cef_list_value_t.is_owned', ['LB_CEF3_ListIsOwned', 'CEF3列表_是否被拥有']],
  ['cef_list_value_t.is_read_only', ['LB_CEF3_ListIsReadOnly', 'CEF3列表_是否只读']],
  ['cef_list_value_t.is_same', ['LB_CEF3_ListIsSame', 'CEF3列表_是否同一对象']],
  ['cef_list_value_t.is_equal', ['LB_CEF3_ListIsEqual', 'CEF3列表_是否相等']],
  ['cef_list_value_t.get_size', ['LB_CEF3_ListGetSize', 'CEF3列表_取数量']],
  ['cef_list_value_t.set_size', ['LB_CEF3_ListSetSize', 'CEF3列表_设数量']],
  ['cef_list_value_t.get_type', ['LB_CEF3_ListGetType', 'CEF3列表_取类型']],
  ['cef_list_value_t.set_value', ['LB_CEF3_ListSetValue', 'CEF3列表_设值']],
  ['cef_list_value_t.get_value', ['LB_CEF3_ListGetValue', 'CEF3列表_取值']],
  ['cef_list_value_t.remove', ['LB_CEF3_ListRemove', 'CEF3列表_删除']],
  ['cef_list_value_t.clear', ['LB_CEF3_ListClear', 'CEF3列表_清空']],
  ['cef_list_value_t.copy', ['LB_CEF3_ListCopy', 'CEF3列表_复制']],
  ['cef_list_value_t.set_null', ['LB_CEF3_ListSetValue', 'CEF3列表_设值']],
  ['cef_list_value_t.set_bool', ['LB_CEF3_ListSetValue', 'CEF3列表_设值']],
  ['cef_list_value_t.set_int', ['LB_CEF3_ListSetValue', 'CEF3列表_设值']],
  ['cef_list_value_t.set_double', ['LB_CEF3_ListSetValue', 'CEF3列表_设值']],
  ['cef_list_value_t.set_string', ['LB_CEF3_ListSetValue', 'CEF3列表_设值']],
  ['cef_list_value_t.set_binary', ['LB_CEF3_ListSetValue', 'CEF3列表_设值']],
  ['cef_list_value_t.set_dictionary', ['LB_CEF3_ListSetValue', 'CEF3列表_设值']],
  ['cef_list_value_t.set_list', ['LB_CEF3_ListSetValue', 'CEF3列表_设值']],
  ['cef_list_value_t.get_bool', ['LB_CEF3_ListGetValue', 'CEF3列表_取值']],
  ['cef_list_value_t.get_int', ['LB_CEF3_ListGetValue', 'CEF3列表_取值']],
  ['cef_list_value_t.get_double', ['LB_CEF3_ListGetValue', 'CEF3列表_取值']],
  ['cef_list_value_t.get_dictionary', ['LB_CEF3_ListGetValue', 'CEF3列表_取值']],
  ['cef_menu_model_create', ['LB_CEF3_MenuCreate', 'CEF3菜单_创建']],
  ['cef_menu_model_t.is_sub_menu', ['LB_CEF3_MenuIsSubMenu', 'CEF3菜单_是否子菜单']],
  ['cef_menu_model_t.clear', ['LB_CEF3_MenuClear', 'CEF3菜单_清空']],
  ['cef_menu_model_t.get_count', ['LB_CEF3_MenuGetCount', 'CEF3菜单_取数量']],
  ['cef_menu_model_t.add_separator', ['LB_CEF3_MenuAddSeparator', 'CEF3菜单_添加分隔线']],
  ['cef_menu_model_t.add_item', ['LB_CEF3_MenuAddItem', 'CEF3菜单_添加项目']],
  ['cef_menu_model_t.add_check_item', ['LB_CEF3_MenuAddCheckItem', 'CEF3菜单_添加勾选项目']],
  ['cef_menu_model_t.add_radio_item', ['LB_CEF3_MenuAddRadioItem', 'CEF3菜单_添加单选项目']],
  ['cef_menu_model_t.add_sub_menu', ['LB_CEF3_MenuAddSubMenu', 'CEF3菜单_添加子菜单']],
  ['cef_menu_model_t.insert_separator_at', ['LB_CEF3_MenuInsertSeparatorAt', 'CEF3菜单_按索引插入分隔线']],
  ['cef_menu_model_t.insert_item_at', ['LB_CEF3_MenuInsertItemAt', 'CEF3菜单_按索引插入项目']],
  ['cef_menu_model_t.insert_check_item_at', ['LB_CEF3_MenuInsertCheckItemAt', 'CEF3菜单_按索引插入勾选项目']],
  ['cef_menu_model_t.insert_radio_item_at', ['LB_CEF3_MenuInsertRadioItemAt', 'CEF3菜单_按索引插入单选项目']],
  ['cef_menu_model_t.insert_sub_menu_at', ['LB_CEF3_MenuInsertSubMenuAt', 'CEF3菜单_按索引插入子菜单']],
  ['cef_menu_model_t.remove', ['LB_CEF3_MenuRemove', 'CEF3菜单_删除项目']],
  ['cef_menu_model_t.remove_at', ['LB_CEF3_MenuRemoveAt', 'CEF3菜单_按索引删除']],
  ['cef_menu_model_t.get_index_of', ['LB_CEF3_MenuGetIndexOf', 'CEF3菜单_取索引']],
  ['cef_menu_model_t.get_command_id_at', ['LB_CEF3_MenuGetCommandIdAt', 'CEF3菜单_按索引取命令ID']],
  ['cef_menu_model_t.set_command_id_at', ['LB_CEF3_MenuSetCommandIdAt', 'CEF3菜单_按索引设命令ID']],
  ['cef_menu_model_t.get_label', ['LB_CEF3_MenuGetLabel', 'CEF3菜单_取标题']],
  ['cef_menu_model_t.get_label_at', ['LB_CEF3_MenuGetLabelAt', 'CEF3菜单_按索引取标题']],
  ['cef_menu_model_t.set_label', ['LB_CEF3_MenuSetLabel', 'CEF3菜单_设标题']],
  ['cef_menu_model_t.set_label_at', ['LB_CEF3_MenuSetLabelAt', 'CEF3菜单_按索引设标题']],
  ['cef_menu_model_t.get_type', ['LB_CEF3_MenuGetType', 'CEF3菜单_取类型']],
  ['cef_menu_model_t.get_type_at', ['LB_CEF3_MenuGetTypeAt', 'CEF3菜单_按索引取类型']],
  ['cef_menu_model_t.get_group_id', ['LB_CEF3_MenuGetGroupId', 'CEF3菜单_取组ID']],
  ['cef_menu_model_t.get_group_id_at', ['LB_CEF3_MenuGetGroupIdAt', 'CEF3菜单_按索引取组ID']],
  ['cef_menu_model_t.set_group_id', ['LB_CEF3_MenuSetGroupId', 'CEF3菜单_设组ID']],
  ['cef_menu_model_t.set_group_id_at', ['LB_CEF3_MenuSetGroupIdAt', 'CEF3菜单_按索引设组ID']],
  ['cef_menu_model_t.get_sub_menu', ['LB_CEF3_MenuGetSubMenu', 'CEF3菜单_取子菜单']],
  ['cef_menu_model_t.get_sub_menu_at', ['LB_CEF3_MenuGetSubMenuAt', 'CEF3菜单_按索引取子菜单']],
  ['cef_menu_model_t.is_visible', ['LB_CEF3_MenuIsVisible', 'CEF3菜单_是否可见']],
  ['cef_menu_model_t.is_visible_at', ['LB_CEF3_MenuIsVisibleAt', 'CEF3菜单_按索引是否可见']],
  ['cef_menu_model_t.set_visible', ['LB_CEF3_MenuSetVisible', 'CEF3菜单_设置可见']],
  ['cef_menu_model_t.set_visible_at', ['LB_CEF3_MenuSetVisibleAt', 'CEF3菜单_按索引设置可见']],
  ['cef_menu_model_t.is_enabled', ['LB_CEF3_MenuIsEnabled', 'CEF3菜单_是否启用']],
  ['cef_menu_model_t.is_enabled_at', ['LB_CEF3_MenuIsEnabledAt', 'CEF3菜单_按索引是否启用']],
  ['cef_menu_model_t.set_enabled', ['LB_CEF3_MenuSetEnabled', 'CEF3菜单_设置启用']],
  ['cef_menu_model_t.set_enabled_at', ['LB_CEF3_MenuSetEnabledAt', 'CEF3菜单_按索引设置启用']],
  ['cef_menu_model_t.is_checked', ['LB_CEF3_MenuIsChecked', 'CEF3菜单_是否勾选']],
  ['cef_menu_model_t.is_checked_at', ['LB_CEF3_MenuIsCheckedAt', 'CEF3菜单_按索引是否勾选']],
  ['cef_menu_model_t.set_checked', ['LB_CEF3_MenuSetChecked', 'CEF3菜单_设置勾选']],
  ['cef_menu_model_t.set_checked_at', ['LB_CEF3_MenuSetCheckedAt', 'CEF3菜单_按索引设置勾选']],
  ['cef_menu_model_t.has_accelerator', ['LB_CEF3_MenuHasAccelerator', 'CEF3菜单_是否有快捷键']],
  ['cef_menu_model_t.has_accelerator_at', ['LB_CEF3_MenuHasAcceleratorAt', 'CEF3菜单_按索引是否有快捷键']],
  ['cef_menu_model_t.set_accelerator', ['LB_CEF3_MenuSetAccelerator', 'CEF3菜单_设置快捷键']],
  ['cef_menu_model_t.set_accelerator_at', ['LB_CEF3_MenuSetAcceleratorAt', 'CEF3菜单_按索引设置快捷键']],
  ['cef_menu_model_t.remove_accelerator', ['LB_CEF3_MenuRemoveAccelerator', 'CEF3菜单_删除快捷键']],
  ['cef_menu_model_t.remove_accelerator_at', ['LB_CEF3_MenuRemoveAcceleratorAt', 'CEF3菜单_按索引删除快捷键']],
  ['cef_menu_model_t.get_accelerator', ['LB_CEF3_MenuGetAcceleratorJson', 'CEF3菜单_取快捷键JSON']],
  ['cef_menu_model_t.get_accelerator_at', ['LB_CEF3_MenuGetAcceleratorAtJson', 'CEF3菜单_按索引取快捷键JSON']],
  ['cef_menu_model_t.set_color', ['LB_CEF3_MenuSetColor', 'CEF3菜单_设置颜色']],
  ['cef_menu_model_t.set_color_at', ['LB_CEF3_MenuSetColorAt', 'CEF3菜单_按索引设置颜色']],
  ['cef_menu_model_t.get_color', ['LB_CEF3_MenuGetColor', 'CEF3菜单_取颜色']],
  ['cef_menu_model_t.get_color_at', ['LB_CEF3_MenuGetColorAt', 'CEF3菜单_按索引取颜色']],
  ['cef_menu_model_t.set_font_list', ['LB_CEF3_MenuSetFontList', 'CEF3菜单_设置字体']],
  ['cef_menu_model_t.set_font_list_at', ['LB_CEF3_MenuSetFontListAt', 'CEF3菜单_按索引设置字体']],
  ['cef_image_create', ['LB_CEF3_ImageCreate', 'CEF3图像_创建']],
  ['cef_image_t.is_empty', ['LB_CEF3_ImageIsEmpty', 'CEF3图像_是否为空']],
  ['cef_image_t.is_same', ['LB_CEF3_ImageIsSame', 'CEF3图像_是否相同']],
  ['cef_image_t.add_bitmap', ['LB_CEF3_ImageAddBitmap', 'CEF3图像_添加位图']],
  ['cef_image_t.add_png', ['LB_CEF3_ImageAddPng', 'CEF3图像_添加PNG']],
  ['cef_image_t.add_jpeg', ['LB_CEF3_ImageAddJpeg', 'CEF3图像_添加JPEG']],
  ['cef_image_t.get_width', ['LB_CEF3_ImageGetWidth', 'CEF3图像_取宽度']],
  ['cef_image_t.get_height', ['LB_CEF3_ImageGetHeight', 'CEF3图像_取高度']],
  ['cef_image_t.has_representation', ['LB_CEF3_ImageHasRepresentation', 'CEF3图像_是否有表示']],
  ['cef_image_t.remove_representation', ['LB_CEF3_ImageRemoveRepresentation', 'CEF3图像_删除表示']],
  ['cef_image_t.get_representation_info', ['LB_CEF3_ImageGetRepresentationInfo', 'CEF3图像_取表示信息']],
  ['cef_image_t.get_as_bitmap', ['LB_CEF3_ImageGetAsBitmap', 'CEF3图像_取位图缓冲']],
  ['cef_image_t.get_as_png', ['LB_CEF3_ImageGetAsPng', 'CEF3图像_取PNG缓冲']],
  ['cef_image_t.get_as_jpeg', ['LB_CEF3_ImageGetAsJpeg', 'CEF3图像_取JPEG缓冲']],
  ['cef_browser_host_t.get_visible_navigation_entry', ['LB_CEF3_BrowserGetVisibleNavigationEntry', 'CEF3导航项_取当前可见']],
  ['cef_browser_host_t.get_navigation_entries', ['LB_CEF3_BrowserGetNavigationEntries', 'CEF3导航项_读取历史']],
  ['cef_navigation_entry_visitor_t.visit', ['LB_CEF3_BrowserGetNavigationEntries', 'CEF3导航项_读取历史']],
  ['cef_navigation_entry_t.is_valid', ['LB_CEF3_NavigationEntryIsValid', 'CEF3导航项_是否有效']],
  ['cef_navigation_entry_t.get_url', ['LB_CEF3_NavigationEntryGetUrl', 'CEF3导航项_取地址']],
  ['cef_navigation_entry_t.get_display_url', ['LB_CEF3_NavigationEntryGetDisplayUrl', 'CEF3导航项_取显示地址']],
  ['cef_navigation_entry_t.get_original_url', ['LB_CEF3_NavigationEntryGetOriginalUrl', 'CEF3导航项_取原始地址']],
  ['cef_navigation_entry_t.get_title', ['LB_CEF3_NavigationEntryGetTitle', 'CEF3导航项_取标题']],
  ['cef_navigation_entry_t.get_transition_type', ['LB_CEF3_NavigationEntryGetTransitionType', 'CEF3导航项_取跳转类型']],
  ['cef_navigation_entry_t.has_post_data', ['LB_CEF3_NavigationEntryHasPostData', 'CEF3导航项_是否含提交数据']],
  ['cef_navigation_entry_t.get_completion_time', ['LB_CEF3_NavigationEntryGetCompletionTime', 'CEF3导航项_取完成时间']],
  ['cef_navigation_entry_t.get_http_status_code', ['LB_CEF3_NavigationEntryGetHttpStatusCode', 'CEF3导航项_取HTTP状态码']],
  ['cef_sslstatus_t.get_x509_certificate', ['LB_CEF3_BrowserGetCurrentCertificate', 'CEF3证书_取当前']],
  ['cef_sslstatus_t.is_secure_connection', ['LB_CEF3_CertificateIsSecureConnection', 'CEF3证书_是否安全连接']],
  ['cef_sslstatus_t.get_cert_status', ['LB_CEF3_CertificateGetCertStatus', 'CEF3证书_取证书状态']],
  ['cef_sslstatus_t.get_sslversion', ['LB_CEF3_CertificateGetSslVersion', 'CEF3证书_取SSL版本']],
  ['cef_sslstatus_t.get_content_status', ['LB_CEF3_CertificateGetContentStatus', 'CEF3证书_取内容状态']],
  ['cef_x509_certificate_t.get_subject', ['LB_CEF3_CertificateGetSubject', 'CEF3证书_取主体']],
  ['cef_x509_certificate_t.get_issuer', ['LB_CEF3_CertificateGetIssuer', 'CEF3证书_取颁发者']],
  ['cef_x509_certificate_t.get_serial_number', ['LB_CEF3_CertificateGetSerialNumber', 'CEF3证书_取序列号缓冲']],
  ['cef_x509_certificate_t.get_derencoded', ['LB_CEF3_CertificateGetDerEncoded', 'CEF3证书_取DER缓冲']],
  ['cef_x509_certificate_t.get_pemencoded', ['LB_CEF3_CertificateGetPemEncoded', 'CEF3证书_取PEM缓冲']],
  ['cef_x509_certificate_t.get_valid_start', ['LB_CEF3_CertificateGetValidStart', 'CEF3证书_取生效时间']],
  ['cef_x509_certificate_t.get_valid_expiry', ['LB_CEF3_CertificateGetValidExpiry', 'CEF3证书_取失效时间']],
  ['cef_x509_certificate_t.get_issuer_chain_size', ['LB_CEF3_CertificateGetIssuerChainSize', 'CEF3证书_取颁发链数量']],
  ['cef_x509_certificate_t.get_derencoded_issuer_chain', ['LB_CEF3_CertificateGetDerIssuerChainItem', 'CEF3证书_取DER颁发链项']],
  ['cef_x509_certificate_t.get_pemencoded_issuer_chain', ['LB_CEF3_CertificateGetPemIssuerChainItem', 'CEF3证书_取PEM颁发链项']],
  ['cef_x509_cert_principal_t.get_display_name', ['LB_CEF3_CertificatePrincipalGetDisplayName', 'CEF3证书主体_取显示名']],
  ['cef_x509_cert_principal_t.get_common_name', ['LB_CEF3_CertificatePrincipalGetCommonName', 'CEF3证书主体_取通用名']],
  ['cef_x509_cert_principal_t.get_locality_name', ['LB_CEF3_CertificatePrincipalGetLocalityName', 'CEF3证书主体_取地区名']],
  ['cef_x509_cert_principal_t.get_state_or_province_name', ['LB_CEF3_CertificatePrincipalGetStateOrProvinceName', 'CEF3证书主体_取省州名']],
  ['cef_x509_cert_principal_t.get_country_name', ['LB_CEF3_CertificatePrincipalGetCountryName', 'CEF3证书主体_取国家名']],
  ['cef_x509_cert_principal_t.get_organization_names', ['LB_CEF3_CertificatePrincipalGetOrganizationNamesJson', 'CEF3证书主体_取组织JSON']],
  ['cef_x509_cert_principal_t.get_organization_unit_names', ['LB_CEF3_CertificatePrincipalGetOrganizationUnitNamesJson', 'CEF3证书主体_取组织单位JSON']],
  ['cef_browser_host_t.get_request_context', ['LB_CEF3_BrowserGetRequestContext', 'CEF3会话_取上下文']],
  ['cef_request_context_t.get_cache_path', ['LB_CEF3_RequestContextGetCachePath', 'CEF3会话_上下文取缓存目录']],
  ['cef_preference_manager_t.has_preference', ['LB_CEF3_RequestContextHasPreference', 'CEF3会话_是否有首选项']],
  ['cef_preference_manager_t.can_set_preference', ['LB_CEF3_RequestContextCanSetPreference', 'CEF3会话_首选项是否可写']],
  ['cef_preference_manager_t.get_preference', ['LB_CEF3_RequestContextGetPreference', 'CEF3会话_取首选项']],
  ['cef_preference_manager_t.get_all_preferences', ['LB_CEF3_RequestContextGetAllPreferences', 'CEF3会话_取全部首选项']],
  ['cef_preference_manager_t.set_preference', ['LB_CEF3_RequestContextSetPreference', 'CEF3会话_设置首选项']],
  ['cef_request_context_t.get_cookie_manager', ['LB_CEF3_CookieVisitAll', 'CEF3会话_Cookie读取全部']],
  ['cef_request_context_t.clear_http_cache', ['LB_CEF3_RequestContextClearHttpCache', 'CEF3会话_清理HTTP缓存']],
  ['cef_request_context_t.clear_certificate_exceptions', ['LB_CEF3_RequestContextClearCertificateExceptions', 'CEF3会话_清理证书例外']],
  ['cef_request_context_t.clear_http_auth_credentials', ['LB_CEF3_RequestContextClearHttpAuthCredentials', 'CEF3会话_清理HTTP认证']],
  ['cef_request_context_t.close_all_connections', ['LB_CEF3_RequestContextCloseAllConnections', 'CEF3会话_关闭全部连接']],
  ['cef_cookie_manager_t.visit_all_cookies', ['LB_CEF3_CookieVisitAll', 'CEF3会话_Cookie读取全部']],
  ['cef_cookie_manager_t.visit_url_cookies', ['LB_CEF3_CookieVisitUrl', 'CEF3会话_Cookie按地址读取']],
  ['cef_cookie_manager_t.set_cookie', ['LB_CEF3_CookieSet', 'CEF3会话_Cookie设置']],
  ['cef_cookie_manager_t.delete_cookies', ['LB_CEF3_CookieDelete', 'CEF3会话_Cookie删除']],
  ['cef_cookie_manager_t.flush_store', ['LB_CEF3_CookieFlush', 'CEF3会话_Cookie落盘']],
  ['cef_cookie_visitor_t.visit', ['LB_CEF3_CookieVisitAll', 'CEF3会话_Cookie读取全部']],
  ['cef_set_cookie_callback_t.on_complete', ['LB_CEF3_CookieSet', 'CEF3会话_Cookie设置']],
  ['cef_delete_cookies_callback_t.on_complete', ['LB_CEF3_CookieDelete', 'CEF3会话_Cookie删除']],
  ['cef_completion_callback_t.on_complete', ['LB_CEF3_RequestContextClearHttpCache', 'CEF3会话_清理HTTP缓存']],
  ['cef_get_extensions_for_mime_type', ['LB_CEF3_GetExtensionsForMimeType', 'CEF3平台_取MIME扩展名']],
  ['cef_preference_manager_get_chrome_variations_as_switches', ['LB_CEF3_GetChromeVariationsAsSwitches', 'CEF3平台_取Chrome实验开关']],
  ['cef_preference_manager_get_chrome_variations_as_strings', ['LB_CEF3_GetChromeVariationsAsStrings', 'CEF3平台_取Chrome实验说明']],
  ['cef_life_span_handler_t.do_close', ['LB_CEF3_BrowserCreate', 'CEF3事件_绑定']],
  ['cef_life_span_handler_t.on_before_popup', ['LB_CEF3_BrowserCreate', 'CEF3事件_绑定']],
  ['cef_life_span_handler_t.on_before_popup_aborted', ['LB_CEF3_BrowserCreate', 'CEF3事件_绑定']],
  ['cef_life_span_handler_t.on_before_dev_tools_popup', ['LB_CEF3_BrowserCreate', 'CEF3事件_绑定']],
  ['cef_display_handler_t.on_favicon_urlchange', ['LB_CEF3_BrowserCreate', 'CEF3事件_绑定']],
  ['cef_display_handler_t.on_fullscreen_mode_change', ['LB_CEF3_BrowserCreate', 'CEF3事件_绑定']],
  ['cef_display_handler_t.on_tooltip', ['LB_CEF3_BrowserCreate', 'CEF3事件_绑定']],
  ['cef_display_handler_t.on_status_message', ['LB_CEF3_BrowserCreate', 'CEF3事件_绑定']],
  ['cef_display_handler_t.on_console_message', ['LB_CEF3_BrowserCreate', 'CEF3事件_绑定']],
  ['cef_display_handler_t.on_auto_resize', ['LB_CEF3_BrowserCreate', 'CEF3事件_绑定']],
  ['cef_display_handler_t.on_loading_progress_change', ['LB_CEF3_BrowserCreate', 'CEF3事件_绑定']],
  ['cef_display_handler_t.on_cursor_change', ['LB_CEF3_BrowserCreate', 'CEF3事件_绑定']],
  ['cef_display_handler_t.on_media_access_change', ['LB_CEF3_BrowserCreate', 'CEF3事件_绑定']],
  ['cef_display_handler_t.on_contents_bounds_change', ['LB_CEF3_BrowserCreate', 'CEF3事件_绑定']],
  ['cef_display_handler_t.get_root_window_screen_rect', ['LB_CEF3_BrowserCreate', 'CEF3事件_绑定']],
  ['cef_focus_handler_t.on_take_focus', ['LB_CEF3_BrowserCreate', 'CEF3事件_绑定']],
  ['cef_focus_handler_t.on_set_focus', ['LB_CEF3_BrowserCreate', 'CEF3事件_绑定']],
  ['cef_focus_handler_t.on_got_focus', ['LB_CEF3_BrowserCreate', 'CEF3事件_绑定']],
  ['cef_keyboard_handler_t.on_pre_key_event', ['LB_CEF3_BrowserCreate', 'CEF3事件_绑定']],
  ['cef_keyboard_handler_t.on_key_event', ['LB_CEF3_BrowserCreate', 'CEF3事件_绑定']]
]);

const INTERNAL_HIGH_LEVEL_MAPPINGS = new Map([
  ['cef_browser_t.get_main_frame', '由CEF3_导航和自动化Frame命令在Bridge内部取得主Frame。'],
  ['cef_browser_t.get_host', '由CEF3浏览器宿主、下载、打印和DevTools高层命令内部使用。'],
  ['cef_browser_t.get_identifier', '浏览器ID通过版本化事件JSON提供，不暴露CefBrowser对象。'],
  ['cef_browser_process_handler_t.on_register_custom_preferences', '自定义Preference必须在CEF初始化阶段由Bridge配置注册；运行期通过CEF3会话_Preference命令访问。'],
  ['cef_preference_registrar_t.add_preference', '由Bridge初始化配置及OnRegisterCustomPreferences内部调用，不向运行期DSL暴露注册器。'],
  ['cef_cookie_manager_get_global_manager', 'LingBuilder强制每浏览器独立RequestContext；使用CEF3会话_取上下文和Cookie命令访问实例存储。'],
  ['cef_preference_manager_get_global', 'LingBuilder禁止绕过会话隔离修改全局Preference；使用CEF3会话_取上下文及Preference命令。'],
  ['CefCertificateUtilWin.CefCertificateUtilWin', 'Windows证书转换属于Bridge内部实现；DSL使用CEF3证书及证书主体受管快照命令。']
]);

const MODULE_OVERRIDES = new Map([
  ['cef_get_extensions_for_mime_type', 'lingbuilder.cef3.platform'],
  ['cef_preference_manager_get_chrome_variations_as_switches', 'lingbuilder.cef3.platform'],
  ['cef_preference_manager_get_chrome_variations_as_strings', 'lingbuilder.cef3.platform']
]);

const MODULE_RULES = [
  ['lingbuilder.cef3.osr', /accessibility|render_handler|shared_memory|drag_data/iu],
  ['lingbuilder.cef3.views', /(?:^|\/)views\//iu],
  ['lingbuilder.cef3.devtools', /devtools/iu],
  ['lingbuilder.cef3.objects', /cef_x509_certificate|cef_ssl_status/iu],
  ['lingbuilder.cef3.objects', /cef_image/iu],
  ['lingbuilder.cef3.transfer', /download|print|stream|image/iu],
  ['lingbuilder.cef3.automation', /dom|v8|frame|process_message|render_process/iu],
  ['lingbuilder.cef3.network', /request|response|resource|scheme|urlrequest|server|media_router|ssl/iu],
  ['lingbuilder.cef3.session', /cookie|request_context|preference|certificate|extension/iu],
  ['lingbuilder.cef3.events', /handler|callback|observer|delegate/iu],
  ['lingbuilder.cef3.objects', /values|menu_model|navigation_entry|registration|shared_process/iu],
  ['lingbuilder.cef3.platform', /command_line|file_util|i18n|origin|parser|path_util|task|thread|trace|waitable|xml|zip|resource_bundle|component/iu]
];

const NOT_APPLICABLE_PATTERNS = [
  /cef_api_hash|cef_api_versions|cef_config|cef_pack_resources|cef_pack_strings|cef_version(?:_info)?/iu,
  /cef_sandbox_win/iu
];

const WRAPPER_CAPABILITIES = [
  { header: 'wrapper/cef_message_router.h', owner: 'CefMessageRouter', moduleId: 'lingbuilder.cef3.automation', chineseName: 'CEF3自动化_消息路由', alternative: '使用类型化跨进程消息与查询任务。' },
  { header: 'wrapper/cef_resource_manager.h', owner: 'CefResourceManager', moduleId: 'lingbuilder.cef3.network', chineseName: 'CEF3网络_资源管理器', alternative: '使用自定义Scheme与类型化资源处理器。' },
  { header: 'wrapper/cef_stream_resource_handler.h', owner: 'CefStreamResourceHandler', moduleId: 'lingbuilder.cef3.network', chineseName: 'CEF3网络_流资源处理器', alternative: '使用受管缓冲或Stream响应资源请求。' },
  { header: 'wrapper/cef_xml_object.h', owner: 'CefXmlObject', moduleId: 'lingbuilder.cef3.platform', chineseName: 'CEF3平台_XML对象', alternative: '使用UTF-16 JSON/XML转换接口。' },
  { header: 'wrapper/cef_zip_archive.h', owner: 'CefZipArchive', moduleId: 'lingbuilder.cef3.platform', chineseName: 'CEF3平台_ZIP归档', alternative: '使用受控路径和受管缓冲读取ZIP。' },
  { header: 'wrapper/cef_certificate_util_win.h', owner: 'CefCertificateUtilWin', moduleId: 'lingbuilder.cef3.session', chineseName: 'CEF3会话_证书转换', alternative: '使用证书受管句柄与DER缓冲。' }
];

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = path.resolve(__dirname, '..', '..');
  const sdkRoot = path.resolve(args.sdk || process.env.CEF3_SDK_ROOT || path.join(repoRoot, '.lingbuilder', 'modules', 'lingbuilder.cef3.sdk', 'sdk'));
  const includeRoot = path.join(sdkRoot, 'include');
  const capiRoot = path.join(includeRoot, 'capi');
  const outputPath = path.resolve(args.output || path.join(repoRoot, 'electron', 'src', 'services', 'modules', 'cef3ApiCoverage.generated.json'));
  const markdownPath = path.resolve(args.markdown || path.join(repoRoot, 'CEF3_API_COVERAGE.md'));
  const generatedRuntime = await fs.readFile(path.join(repoRoot, 'electron', 'src', 'services', 'windowDesigner', 'lingCppWin32Project.ts'), 'utf8');
  const bridgeHeader = await fs.readFile(path.join(repoRoot, 'electron', 'native', 'cef3-bridge', 'LingBuilderCefBridge.h'), 'utf8');
  await assertFile(path.join(includeRoot, 'cef_version.h'), 'CEF3 SDK 缺少 include/cef_version.h');
  await assertFile(path.join(capiRoot, 'cef_app_capi.h'), 'CEF3 SDK 缺少机器可读 C API 头文件');

  const allHeaders = (await walk(includeRoot)).filter(file => file.endsWith('.h')).sort();
  const capiHeaders = allHeaders.filter(file => file.startsWith(`${capiRoot}${path.sep}`));
  const cppExportHeaders = allHeaders.filter(file => path.dirname(file) === includeRoot);
  const entries = [];
  for (const file of capiHeaders) {
    const source = await fs.readFile(file, 'utf8');
    const relativeHeader = path.relative(includeRoot, file).replaceAll('\\', '/');
    entries.push(...extractStructCallbacks(source, relativeHeader));
    entries.push(...extractExports(source, relativeHeader));
  }
  for (const file of cppExportHeaders) {
    const source = await fs.readFile(file, 'utf8');
    const relativeHeader = path.relative(includeRoot, file).replaceAll('\\', '/');
    for (const entry of extractExports(source, relativeHeader)) {
      entry.sourceKind = 'cpp-export';
      entries.push(entry);
    }
  }
  entries.push(...await createWrapperCapabilities(includeRoot));
  const unique = new Map();
  for (const item of entries) {
    const key = `${item.header}\n${item.owner}\n${item.officialSignature}`;
    if (!unique.has(key)) unique.set(key, item);
  }
  const signatures = [...unique.values()].sort((left, right) =>
    left.header.localeCompare(right.header, 'en') || left.owner.localeCompare(right.owner, 'en') || left.officialName.localeCompare(right.officialName, 'en'));
  for (const entry of signatures) Object.assign(entry, classify(entry));
  for (const [symbol, locator] of RUNTIME_MAPPINGS) {
    if (!generatedRuntime.includes(locator)) throw new Error(`CEF3 mapped 条目缺少真实实现定位：${symbol} -> ${locator}`);
  }
  for (const [symbol, [bridgeSymbol]] of BRIDGE_IMPLEMENTATIONS) {
    if (!bridgeHeader.includes(`${bridgeSymbol}(`)) throw new Error(`CEF3 implemented 条目缺少Bridge导出：${symbol} -> ${bridgeSymbol}`);
  }

  const versionSource = await fs.readFile(path.join(includeRoot, 'cef_version.h'), 'utf8');
  const cefVersion = readDefine(versionSource, 'CEF_VERSION');
  const chromeMajor = readDefine(versionSource, 'CHROME_VERSION_MAJOR');
  const summary = signatures.reduce((result, entry) => {
    result.status[entry.implementationStatus] = (result.status[entry.implementationStatus] || 0) + 1;
    result.modules[entry.moduleId] = (result.modules[entry.moduleId] || 0) + 1;
    result.translation[entry.translationStatus] = (result.translation[entry.translationStatus] || 0) + 1;
    if (entry.publicSurface) result.publicSignatures += 1;
    return result;
  }, { status: {}, modules: {}, translation: {}, publicSignatures: 0 });
  const excludedHeaders = await createExcludedHeaderRecords(includeRoot, allHeaders, WRAPPER_CAPABILITIES.map(item => item.header));
  const catalog = {
    schemaVersion: 2,
    baseline: { cefVersion, chromiumMajor: Number(chromeMajor), platform: 'windows-msvc-x64', architecture: 'x64' },
    generatedFrom: ['include/capi/**/*.h', 'include/*.h CEF_EXPORT', 'selected include/wrapper capabilities'],
    headerCount: capiHeaders.length,
    scannedHeaderCount: allHeaders.length,
    signatureCount: signatures.length,
    summary,
    excludedHeaders,
    headers: capiHeaders.map(file => {
      const header = path.relative(includeRoot, file).replaceAll('\\', '/');
      return { header, signatureCount: signatures.filter(entry => entry.header === header).length };
    }),
    signatures
  };
  validateCatalog(catalog);
  const json = `${JSON.stringify(catalog, null, 2)}\n`;
  if (args.check) {
    const existing = await fs.readFile(outputPath, 'utf8').catch(() => '');
    if (existing !== json) throw new Error('CEF3 覆盖清单已漂移，请运行 npm run module:cef3-coverage。');
  } else {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, json, 'utf8');
    await fs.writeFile(markdownPath, renderMarkdown(catalog), 'utf8');
  }
  if (args.complete && ((summary.status.planned || 0) > 0 || (summary.translation.needsReview || 0) > 0)) {
    throw new Error(`CEF3 安全全覆盖尚未完成：仍有 ${summary.status.planned || 0} 个 planned、${summary.translation.needsReview || 0} 个中文名待复核。`);
  }
  console.log(`CEF3 coverage: ${catalog.headerCount} headers, ${catalog.signatureCount} signatures, `
    + Object.entries(summary.status).map(([key, value]) => `${key}=${value}`).join(', '));
}

function extractStructCallbacks(source, header) {
  const result = [];
  const structPattern = /typedef\s+struct\s+(_cef_[a-z0-9_]+_t)\s*\{([\s\S]*?)\}\s*(cef_[a-z0-9_]+_t)\s*;/giu;
  for (const match of source.matchAll(structPattern)) {
    const owner = match[3];
    const body = stripComments(match[2]);
    const callbackPattern = /([a-z_][a-z0-9_\s*]+?)\(CEF_CALLBACK\*\s*([a-z_][a-z0-9_]*)\)\s*\(([\s\S]*?)\)\s*;/giu;
    for (const callback of body.matchAll(callbackPattern)) {
      const officialName = callback[2];
      const officialSignature = normalize(`${callback[1]} (CEF_CALLBACK* ${officialName})(${callback[3]})`);
      result.push(createEntry(header, owner, officialName, officialSignature, 'method'));
    }
  }
  return result;
}

function extractExports(source, header) {
  const result = [];
  const cleaned = stripComments(source);
  const pattern = /CEF_EXPORT\s+([\s\S]*?\([^;{}]*?\))\s*;/gu;
  for (const match of cleaned.matchAll(pattern)) {
    const signature = normalize(match[1]);
    const nameMatch = signature.match(/([a-z_][a-z0-9_]*)\s*\(/iu);
    if (!nameMatch) continue;
    result.push(createEntry(header, 'global', nameMatch[1], signature, 'function'));
  }
  return result;
}

function createEntry(header, owner, officialName, officialSignature, kind) {
  const signatureHash = sha256(`${owner}\n${officialSignature}`);
  return {
    functionId: `cef3.${path.basename(header, '.h').toLowerCase()}.${owner.toLowerCase()}.${officialName.toLowerCase()}.${signatureHash.slice(0, 12)}`,
    signatureHash,
    header,
    owner,
    kind,
    sourceKind: header.startsWith('capi/') ? 'capi' : 'cpp-export',
    officialName,
    officialSignature
  };
}

function classify(entry) {
  const symbol = entry.owner === 'global' ? entry.officialName : `${entry.owner}.${entry.officialName}`;
  const text = `${entry.header}/${entry.owner}/${entry.officialName}`;
  const moduleId = MODULE_OVERRIDES.get(symbol)
    || MODULE_RULES.find(([, pattern]) => pattern.test(text))?.[0]
    || 'lingbuilder.cef3.browser';
  if (/^capi\/test\//iu.test(entry.header)) {
    return classificationFields(entry, {
      moduleId: 'lingbuilder.cef3.platform', chineseName: `CEF3测试_${entry.officialName}`,
      classification: 'notApplicable', implementationStatus: 'notApplicable', publicSurface: false,
      classificationReason: 'CEF上游翻译器或API版本测试接口，不属于应用运行时公开能力。',
      alternative: '使用正式CEF API及LingBuilder覆盖/ABI回归测试。', wrapperSymbol: '',
      thread: 'test-only', execution: 'internal', ownership: 'none', testStatus: 'classified', translationStatus: 'notRequired'
    });
  }
  if (NOT_APPLICABLE_PATTERNS.some(pattern => pattern.test(text))) {
    return classificationFields(entry, {
      moduleId: 'lingbuilder.cef3.platform', chineseName: `CEF3平台_${entry.officialName}`,
      englishAliases: [entry.officialName], classification: 'notApplicable', implementationStatus: 'notApplicable',
      classificationReason: '版本、资源ID、编译配置或宿主沙箱集成符号，不作为 .lcpp 运行时命令。',
      alternative: '通过Bridge版本查询、模块清单和受控子进程启动接口使用对应高层能力。',
      publicSurface: false, wrapperSymbol: '', thread: 'platform', execution: 'internal', ownership: 'none',
      testStatus: 'classified', translationStatus: 'notRequired'
    });
  }
  const mappedLocator = RUNTIME_MAPPINGS.get(symbol);
  const bridgeImplementation = BRIDGE_IMPLEMENTATIONS.get(symbol);
  if (bridgeImplementation) {
    const [bridgeSymbol, commandName] = bridgeImplementation;
    return classificationFields(entry, {
      moduleId, chineseName: createChineseName(moduleId, entry.officialName), englishAliases: [entry.officialName],
      commandNames: [commandName], classification: 'highLevel', implementationStatus: 'implemented', publicSurface: true,
      classificationReason: '已迁入LingBuilderCefBridge稳定C ABI，并由现有中文高层命令调用。', alternative: '',
      wrapperSymbol: bridgeSymbol, implementationLocator: `electron/native/cef3-bridge/LingBuilderCefBridge.cpp#${bridgeSymbol}`,
      thread: inferThread(entry), execution: inferExecution(entry), ownership: inferOwnership(entry),
      testStatus: 'compiled-native-bridge', testLocator: 'electron/native/cef3-bridge/LingBuilderCefBridgeTests.cpp',
      translationStatus: 'translated'
    });
  }
  const internalAlternative = INTERNAL_HIGH_LEVEL_MAPPINGS.get(symbol);
  if (internalAlternative) {
    return classificationFields(entry, {
      moduleId, chineseName: createChineseName(moduleId, entry.officialName), englishAliases: [entry.officialName],
      classification: 'internal', implementationStatus: 'internal', publicSurface: false,
      classificationReason: '该接口只返回CEF内部对象，禁止跨Bridge暴露裸宿主或Frame对象。',
      alternative: internalAlternative, wrapperSymbol: '', thread: inferThread(entry), execution: 'internal',
      ownership: 'none', testStatus: 'classified', translationStatus: 'notRequired'
    });
  }
  return classificationFields(entry, {
    moduleId,
    chineseName: createChineseName(moduleId, entry.officialName),
    englishAliases: [entry.officialName],
    classification: mappedLocator ? 'highLevel' : 'advancedSafe',
    implementationStatus: mappedLocator ? 'mapped' : 'planned',
    publicSurface: true,
    classificationReason: mappedLocator
      ? '当前生成运行时已有真实高层调用；迁入 LingBuilderCefBridge.dll 后才可升级为 implemented。'
      : '需要通过类型化句柄、任务、JSON或受管缓冲实现。',
    alternative: '',
    wrapperSymbol: mappedLocator ? `generated:${mappedLocator}` : `LB_CEF3V3_${entry.signatureHash.slice(0, 16)}`,
    implementationLocator: mappedLocator ? `electron/src/services/windowDesigner/lingCppWin32Project.ts#${mappedLocator}` : '',
    thread: inferThread(entry), execution: inferExecution(entry), ownership: inferOwnership(entry),
    testStatus: mappedLocator ? 'compiled-native-runtime' : 'missing',
    testLocator: mappedLocator ? 'electron/tests/modules.test.ts' : '',
    translationStatus: 'needsReview'
  });
}

function classificationFields(entry, fields) {
  const decision = entry.kind === 'method' && !/^void\b/iu.test(entry.officialSignature);
  return {
    englishAliases: [entry.officialName],
    commandNames: [],
    inputCodecs: inferInputCodecs(entry.officialSignature),
    outputCodec: inferOutputCodec(entry.officialSignature),
    responseSchema: decision ? `cef3.event.${entry.officialName}.v1` : 'none',
    timeoutMs: decision ? 2000 : 0,
    defaultAction: inferDefaultAction(entry),
    implementationLocator: '',
    testLocator: '',
    excludedCategory: fields.implementationStatus === 'notApplicable' ? inferExcludedCategory(entry) : '',
    ...fields
  };
}

function inferInputCodecs(signature) {
  const callbackParameters = signature.match(/\)\s*\((.*)\)\s*$/u);
  const open = callbackParameters ? -1 : signature.indexOf('(');
  const close = signature.lastIndexOf(')');
  if (!callbackParameters && (open < 0 || close <= open)) return [];
  const parameters = callbackParameters ? callbackParameters[1] : signature.slice(open + 1, close);
  if (!parameters.trim() || /^void$/iu.test(parameters.trim())) return [];
  return parameters.split(',').map(parameter => inferCodec(parameter));
}

function inferOutputCodec(signature) {
  const before = signature.slice(0, Math.max(0, signature.indexOf('('))).replace(/\(CEF_CALLBACK\*\s*[a-z0-9_]+\)$/iu, '').trim();
  return inferCodec(before || 'void');
}

function inferCodec(value) {
  if (/\bvoid\b/iu.test(value) && !/\*/u.test(value)) return 'void';
  if (/cef_string|wchar_t|char16/iu.test(value)) return 'utf16';
  if (/void\s*\*|bytes|buffer/iu.test(value)) return 'managedBuffer';
  if (/callback|handler|visitor|delegate/iu.test(value)) return 'callback';
  if (/\*|cef_[a-z0-9_]+_t/iu.test(value)) return 'typedHandle';
  if (/double|float/iu.test(value)) return 'double';
  if (/bool/iu.test(value)) return 'bool';
  if (/int|size_t|uint|long/iu.test(value)) return 'integer';
  return 'pod';
}

function inferDefaultAction(entry) {
  const name = entry.officialName;
  if (/certificate|permission|media_access|auth_credentials/iu.test(name)) return 'deny';
  if (/before_browse|resource|cookie|redirect|protocol/iu.test(name)) return 'continue';
  return 'default';
}

function inferExcludedCategory(entry) {
  if (/^capi\/test\//iu.test(entry.header)) return 'test';
  if (/sandbox/iu.test(`${entry.header}/${entry.officialName}`)) return 'sandbox';
  return 'build-or-version';
}

function createChineseName(moduleId, officialName) {
  const prefixes = {
    'lingbuilder.cef3.browser': 'CEF3', 'lingbuilder.cef3.events': 'CEF3事件',
    'lingbuilder.cef3.objects': 'CEF3对象', 'lingbuilder.cef3.session': 'CEF3会话',
    'lingbuilder.cef3.network': 'CEF3网络', 'lingbuilder.cef3.transfer': 'CEF3传输',
    'lingbuilder.cef3.automation': 'CEF3自动化', 'lingbuilder.cef3.devtools': 'CEF3开发工具',
    'lingbuilder.cef3.osr': 'CEF3离屏', 'lingbuilder.cef3.views': 'CEF3视图',
    'lingbuilder.cef3.platform': 'CEF3平台'
  };
  return `${prefixes[moduleId] || 'CEF3高级'}_${officialName}`;
}

function inferThread(entry) {
  const text = `${entry.header}/${entry.owner}/${entry.officialName}`;
  if (/render_process|v8|dom/iu.test(text)) return 'cef-renderer';
  if (/resource|urlrequest|cookie/iu.test(text)) return 'cef-io-or-ui';
  if (/file|stream|zip|xml/iu.test(text)) return 'cef-file-or-caller';
  return 'cef-ui-or-caller';
}

function inferExecution(entry) {
  return /callback|visitor|download|print|resolve|execute|create|read|write|visit/iu.test(`${entry.owner}/${entry.officialName}`)
    ? 'asyncTask' : 'sync';
}

function inferOwnership(entry) {
  if (/\*|_t\b/u.test(entry.officialSignature)) return 'typedHandle';
  return 'value';
}

async function createWrapperCapabilities(includeRoot) {
  const result = [];
  for (const capability of WRAPPER_CAPABILITIES) {
    const absolute = path.join(includeRoot, ...capability.header.split('/'));
    const source = await fs.readFile(absolute, 'utf8');
    const officialSignature = `wrapper capability ${capability.owner}`;
    const entry = createEntry(capability.header, capability.owner, capability.owner, officialSignature, 'capability');
    entry.sourceKind = 'wrapper-capability';
    entry.sourceHash = sha256(source);
    Object.assign(entry, classificationFields(entry, {
      moduleId: capability.moduleId,
      chineseName: capability.chineseName,
      englishAliases: [capability.owner],
      classification: 'highLevel',
      implementationStatus: 'planned',
      publicSurface: true,
      classificationReason: 'CEF C++ wrapper提供C API之外的组合能力，需要Bridge高层安全封装。',
      alternative: capability.alternative,
      wrapperSymbol: `LB_CEF3V3_${entry.signatureHash.slice(0, 16)}`,
      thread: 'cef-ui-or-caller', execution: 'asyncTask', ownership: 'typedHandle',
      testStatus: 'missing', translationStatus: 'translated'
    }));
    result.push(entry);
  }
  return result;
}

async function createExcludedHeaderRecords(includeRoot, allHeaders, capabilityHeaders) {
  const capabilitySet = new Set(capabilityHeaders);
  const records = [];
  for (const file of allHeaders) {
    const header = path.relative(includeRoot, file).replaceAll('\\', '/');
    let category = '';
    let reason = '';
    if (/^(?:base|internal|test)\//iu.test(header)) {
      category = header.split('/')[0].toLowerCase();
      reason = category === 'test' ? 'CEF上游C++测试辅助头，不属于应用运行时API。'
        : category === 'base' ? 'CEF内部基础设施或线程/内存原语，由Bridge内部使用。'
          : 'CEF内部实现头，不形成稳定DSL契约。';
    } else if (/^wrapper\//iu.test(header) && !capabilitySet.has(header)) {
      category = 'wrapper-internal';
      reason = 'C++ wrapper辅助实现，无独立DSL能力；对应高层能力由Bridge或已登记wrapper capability提供。';
    }
    if (!category) continue;
    records.push({ header, category, reason, sourceHash: sha256(await fs.readFile(file)) });
  }
  return records;
}

function validateCatalog(catalog) {
  if (!catalog.baseline.cefVersion.startsWith('150.')) throw new Error(`CEF 基线必须冻结为150，实际为 ${catalog.baseline.cefVersion}`);
  if (catalog.baseline.platform !== 'windows-msvc-x64') throw new Error('CEF3 覆盖基线只允许 windows-msvc-x64。');
  const ids = new Set();
  for (const entry of catalog.signatures) {
    if (ids.has(entry.functionId)) throw new Error(`CEF3 functionId 重复：${entry.functionId}`);
    ids.add(entry.functionId);
    if (!STATUS.has(entry.implementationStatus)) throw new Error(`CEF3 状态无效：${entry.implementationStatus}`);
    if (!TRANSLATION_STATUS.has(entry.translationStatus)) throw new Error(`CEF3 中文状态无效：${entry.functionId}`);
    if (!entry.moduleId || !entry.signatureHash || !entry.officialSignature) throw new Error(`CEF3 覆盖条目不完整：${entry.functionId}`);
    if (!Array.isArray(entry.inputCodecs) || !entry.outputCodec || entry.timeoutMs < 0 || !entry.defaultAction) {
      throw new Error(`CEF3 codec/事件契约不完整：${entry.functionId}`);
    }
    if ((entry.implementationStatus === 'implemented' || entry.implementationStatus === 'mapped') && !entry.wrapperSymbol) {
      throw new Error(`CEF3 已实现条目缺少 Bridge 符号：${entry.functionId}`);
    }
    if ((entry.implementationStatus === 'internal' || entry.implementationStatus === 'notApplicable')
      && (!entry.classificationReason || !entry.alternative)) {
      throw new Error(`CEF3 排除条目缺少理由或替代：${entry.functionId}`);
    }
  }
}

function renderMarkdown(catalog) {
  const rows = Object.entries(catalog.summary.modules).sort().map(([moduleId, count]) => `| \`${moduleId}\` | ${count} |`).join('\n');
  const statuses = Object.entries(catalog.summary.status).sort().map(([status, count]) => `| ${status} | ${count} |`).join('\n');
  return `# CEF3 API 安全覆盖清单\n\n`
    + `> 自动生成，请勿手工编辑。基线：CEF ${catalog.baseline.cefVersion} / Chromium ${catalog.baseline.chromiumMajor} / Windows MSVC x64。\n\n`
    + `- 扫描头文件：${catalog.scannedHeaderCount}\n- C API 头文件：${catalog.headerCount}\n- 覆盖记录：${catalog.signatureCount}\n- 公开能力记录：${catalog.summary.publicSignatures}\n- 已记录排除头：${catalog.excludedHeaders.length}\n\n`
    + `## 状态\n\n| 状态 | 数量 |\n| --- | ---: |\n${statuses}\n\n`
    + `## 中文复核\n\n| 状态 | 数量 |\n| --- | ---: |\n${Object.entries(catalog.summary.translation).sort().map(([status, count]) => `| ${status} | ${count} |`).join('\n')}\n\n`
    + `## 模块分布\n\n| 模块 | 签名数 |\n| --- | ---: |\n${rows}\n\n`
    + `完整机器可读目录位于 \`electron/src/services/modules/cef3ApiCoverage.generated.json\`。`
    + `只有 \`npm run module:cef3-coverage:complete\` 通过后，才允许宣称 CEF3 安全全覆盖完成。\n`;
}

async function walk(root) {
  const result = [];
  for (const entry of await fs.readdir(root, { withFileTypes: true })) {
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) result.push(...await walk(absolute));
    else result.push(absolute);
  }
  return result;
}

async function assertFile(file, message) {
  const stat = await fs.stat(file).catch(() => null);
  if (!stat?.isFile()) throw new Error(message);
}

function parseArgs(argv) {
  const result = { check: false, complete: false };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--check') result.check = true;
    else if (argv[index] === '--complete') result.complete = true;
    else if (argv[index] === '--sdk') result.sdk = argv[++index];
    else if (argv[index] === '--output') result.output = argv[++index];
    else if (argv[index] === '--markdown') result.markdown = argv[++index];
  }
  return result;
}

function stripComments(value) { return value.replace(/\/\*[\s\S]*?\*\//gu, ' ').replace(/\/\/[^\r\n]*/gu, ' '); }
function normalize(value) { return value.replace(/\s+/gu, ' ').trim(); }
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function readDefine(source, name) {
  const match = source.match(new RegExp(`^#define\\s+${name}\\s+(.+)$`, 'mu'));
  if (!match) throw new Error(`CEF版本头缺少 ${name}`);
  return match[1].trim().replace(/^"|"$/gu, '');
}
function toPascal(value) { return value.split('_').filter(Boolean).map(part => part[0].toUpperCase() + part.slice(1)).join(''); }

module.exports = { extractStructCallbacks, extractExports, normalize, classify };
if (require.main === module) {
  main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
}
