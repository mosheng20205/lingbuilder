<!-- 本文档由 electron/scripts/generate-builtin-module-docs.ts 从模块清单自动生成（npm run module:builtin-docs）。手工编辑会被覆盖；要接管维护，请把 contributes.docs 写回模块清单并从 builtinModuleDocuments.ts 移除该模块，再改写本文档。 -->

# FBro VIP 指纹模块使用说明

| 项目 | 内容 |
| --- | --- |
| 模块 ID | `lingbuilder.fbro.vip` |
| 版本 | 2.3.0 |
| 分类 | 系统 |
| 命令数 | 200 |

提供不泄露授权信息的结构化 VIP 指纹入口。

> 本模块是 FBro 指纹浏览器（`lingbuilder.fbro.browser`）的子能力模块：浏览器的创建、导航与生命周期入口命令见主模块文档，本模块命令通常与主模块创建的实例或会话配合使用，具体以各命令说明为准。

## 启用方式

本模块为 LingBuilder 内置模块，随 IDE 一起分发，无需单独安装。在「模块」面板或解决方案树的模块节点确认其处于「已启用」状态后，即可在当前项目的 `.lcpp` 代码中直接调用下列命令；未启用时语言服务会给出带启用路径的中文诊断。

## 命令参考（共 200 条）

### 授权状态

#### FBroVIP_授权状态_是否已配置授权密钥

- 签名：`FBroVIP_授权状态_是否已配置授权密钥(控件名, 参数JSON)`
- 返回值：文本型
- 说明：官方接口：DLLEXPORT BOOL TEXPORTS FBroBrowser_IsLicenceKey()。返回脱敏授权 JSON，由调用方读取对应字段；不会返回或记录授权 Key。
- 别名：`FBroBrowser_IsLicenceKey`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_授权状态_是否已配置授权密钥(FBro浏览器1, "{}")
```


#### FBroVIP_授权状态_取授权到期时间

- 签名：`FBroVIP_授权状态_取授权到期时间(控件名, 参数JSON)`
- 返回值：文本型
- 说明：官方接口：DLLEXPORT CefRefPtr<FBroString> TEXPORTS FBroHsBrowser_GetExpirationTime()。返回脱敏授权 JSON，由调用方读取对应字段；不会返回或记录授权 Key。
- 别名：`FBroHsBrowser_GetExpirationTime`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_授权状态_取授权到期时间(FBro浏览器1, "{}")
```


#### FBroVIP_授权状态_取授权功能

- 签名：`FBroVIP_授权状态_取授权功能(控件名, 参数JSON)`
- 返回值：文本型
- 说明：官方接口：DLLEXPORT CefRefPtr<FBroString> TEXPORTS FBroHsBrowser_GetFunctionStr()。返回脱敏授权 JSON，由调用方读取对应字段；不会返回或记录授权 Key。
- 别名：`FBroHsBrowser_GetFunctionStr`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_授权状态_取授权功能(FBro浏览器1, "{}")
```


#### FBroVIP_授权状态_取机器码

- 签名：`FBroVIP_授权状态_取机器码(控件名, 参数JSON)`
- 返回值：文本型
- 说明：官方接口：DLLEXPORT CefRefPtr<FBroString> TEXPORTS FBroHsBrowser_GetMachineCode()。返回脱敏授权 JSON，由调用方读取对应字段；不会返回或记录授权 Key。
- 别名：`FBroHsBrowser_GetMachineCode`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_授权状态_取机器码(FBro浏览器1, "{}")
```


#### FBroVIP_授权状态_取授权注册时间

- 签名：`FBroVIP_授权状态_取授权注册时间(控件名, 参数JSON)`
- 返回值：文本型
- 说明：官方接口：DLLEXPORT CefRefPtr<FBroString> TEXPORTS FBroHsBrowser_GetRegistrationTime()。返回脱敏授权 JSON，由调用方读取对应字段；不会返回或记录授权 Key。
- 别名：`FBroHsBrowser_GetRegistrationTime`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_授权状态_取授权注册时间(FBro浏览器1, "{}")
```


#### FBroVIP_授权状态_取授权版本

- 签名：`FBroVIP_授权状态_取授权版本(控件名, 参数JSON)`
- 返回值：文本型
- 说明：官方接口：DLLEXPORT CefRefPtr<FBroString> TEXPORTS FBroHsBrowser_GetVersionStr()。返回脱敏授权 JSON，由调用方读取对应字段；不会返回或记录授权 Key。
- 别名：`FBroHsBrowser_GetVersionStr`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_授权状态_取授权版本(FBro浏览器1, "{}")
```


#### FBroVIP_授权状态_设置授权密钥

- 签名：`FBroVIP_授权状态_设置授权密钥(控件名, 参数JSON)`
- 返回值：文本型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsBrowser_SetLicenceKey(const CefString& keydata)。该原始入口涉及授权 Key、代理凭据或初始化时序，已由“浏览器凭据设置中心”或现有安全高级入口替代；不会把 Key 写入 .lcpp。
- 别名：`FBroHsBrowser_SetLicenceKey`（兼容旧写法，生成代码使用主名）。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_授权状态_设置授权密钥(FBro浏览器1, "{}")
```


#### FBroVIP_授权状态_取在线授权错误

- 签名：`FBroVIP_授权状态_取在线授权错误(控件名, 参数JSON)`
- 返回值：文本型
- 说明：官方接口：DLLEXPORT CefRefPtr<FBroString> TEXPORTS FBroHsOnlineLicenseControl_GetError()。返回脱敏授权 JSON，由调用方读取对应字段；不会返回或记录授权 Key。
- 别名：`FBroHsOnlineLicenseControl_GetError`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_授权状态_取在线授权错误(FBro浏览器1, "{}")
```


#### FBroVIP_授权状态_取开发者工具授权

- 签名：`FBroVIP_授权状态_取开发者工具授权(控件名, 参数JSON)`
- 返回值：文本型
- 说明：官方接口：DLLEXPORT CefRefPtr<FBroString> TEXPORTS FBroHsOnlineLicenseControl_GetShowLicenseDevTool()。返回脱敏授权 JSON，由调用方读取对应字段；不会返回或记录授权 Key。
- 别名：`FBroHsOnlineLicenseControl_GetShowLicenseDevTool`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_授权状态_取开发者工具授权(FBro浏览器1, "{}")
```


#### FBroVIP_授权状态_取授权结束日期

- 签名：`FBroVIP_授权状态_取授权结束日期(控件名, 参数JSON)`
- 返回值：文本型
- 说明：官方接口：DLLEXPORT CefRefPtr<FBroString> TEXPORTS FBroHsOnlineLicenseControl_GetShowLicenseEndDate()。返回脱敏授权 JSON，由调用方读取对应字段；不会返回或记录授权 Key。
- 别名：`FBroHsOnlineLicenseControl_GetShowLicenseEndDate`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_授权状态_取授权结束日期(FBro浏览器1, "{}")
```


#### FBroVIP_授权状态_取授权功能范围

- 签名：`FBroVIP_授权状态_取授权功能范围(控件名, 参数JSON)`
- 返回值：文本型
- 说明：官方接口：DLLEXPORT CefRefPtr<FBroString> TEXPORTS FBroHsOnlineLicenseControl_GetShowLicenseFunction()。返回脱敏授权 JSON，由调用方读取对应字段；不会返回或记录授权 Key。
- 别名：`FBroHsOnlineLicenseControl_GetShowLicenseFunction`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_授权状态_取授权功能范围(FBro浏览器1, "{}")
```


#### FBroVIP_授权状态_取授权开始日期

- 签名：`FBroVIP_授权状态_取授权开始日期(控件名, 参数JSON)`
- 返回值：文本型
- 说明：官方接口：DLLEXPORT CefRefPtr<FBroString> TEXPORTS FBroHsOnlineLicenseControl_GetShowLicenseStartDate()。返回脱敏授权 JSON，由调用方读取对应字段；不会返回或记录授权 Key。
- 别名：`FBroHsOnlineLicenseControl_GetShowLicenseStartDate`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_授权状态_取授权开始日期(FBro浏览器1, "{}")
```


#### FBroVIP_授权状态_取授权系统版本

- 签名：`FBroVIP_授权状态_取授权系统版本(控件名, 参数JSON)`
- 返回值：文本型
- 说明：官方接口：DLLEXPORT CefRefPtr<FBroString> TEXPORTS FBroHsOnlineLicenseControl_GetShowLicenseSysVersion()。返回脱敏授权 JSON，由调用方读取对应字段；不会返回或记录授权 Key。
- 别名：`FBroHsOnlineLicenseControl_GetShowLicenseSysVersion`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_授权状态_取授权系统版本(FBro浏览器1, "{}")
```


#### FBroVIP_授权状态_取授权类型

- 签名：`FBroVIP_授权状态_取授权类型(控件名, 参数JSON)`
- 返回值：文本型
- 说明：官方接口：DLLEXPORT CefRefPtr<FBroString> TEXPORTS FBroHsOnlineLicenseControl_GetShowLicenseType()。返回脱敏授权 JSON，由调用方读取对应字段；不会返回或记录授权 Key。
- 别名：`FBroHsOnlineLicenseControl_GetShowLicenseType`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_授权状态_取授权类型(FBro浏览器1, "{}")
```


#### FBroVIP_授权状态_设置在线授权密钥

- 签名：`FBroVIP_授权状态_设置在线授权密钥(控件名, 参数JSON)`
- 返回值：文本型
- 说明：官方接口：DLLEXPORT BOOL TEXPORTS FBroHsOnlineLicenseControl_SetKey(const CefString& key)。该原始入口涉及授权 Key、代理凭据或初始化时序，已由“浏览器凭据设置中心”或现有安全高级入口替代；不会把 Key 写入 .lcpp。
- 别名：`FBroHsOnlineLicenseControl_SetKey`（兼容旧写法，生成代码使用主名）。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_授权状态_设置在线授权密钥(FBro浏览器1, "{}")
```


### Bridge 自动管理

#### FBroVIP_Bridge自动管理_取VIP控件状态

- 签名：`FBroVIP_Bridge自动管理_取VIP控件状态(控件名, 参数JSON)`
- 返回值：文本型
- 说明：官方接口：DLLEXPORT CefRefPtr<FBroVIPControl> TEXPORTS FBroHsBrowser_GetVIPControl(CefRefPtr<CefBrowser> browser)。该项由 LingBuilder FBro Bridge 自动管理，详情命令返回托管说明，不暴露 SDK 对象、CefRefPtr 或生命周期指针。
- 别名：`FBroHsBrowser_GetVIPControl`（兼容旧写法，生成代码使用主名）。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_Bridge自动管理_取VIP控件状态(FBro浏览器1, "{}")
```


#### FBroVIP_Bridge自动管理_取所属浏览器状态

- 签名：`FBroVIP_Bridge自动管理_取所属浏览器状态(控件名, 参数JSON)`
- 返回值：文本型
- 说明：官方接口：DLLEXPORT CefRefPtr<CefBrowser> TEXPORTS FBroHsVIPControl_GetBrowser(CefRefPtr<FBroVIPControl> vipcontrol)。该项由 LingBuilder FBro Bridge 自动管理，详情命令返回托管说明，不暴露 SDK 对象、CefRefPtr 或生命周期指针。
- 别名：`FBroHsVIPControl_GetBrowser`（兼容旧写法，生成代码使用主名）。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_Bridge自动管理_取所属浏览器状态(FBro浏览器1, "{}")
```


#### FBroVIP_Bridge自动管理_检查VIP控件可用性

- 签名：`FBroVIP_Bridge自动管理_检查VIP控件可用性(控件名, 参数JSON)`
- 返回值：文本型
- 说明：官方接口：DLLEXPORT BOOL TEXPORTS FBroHsVIPControl_IsNULL(CefRefPtr<FBroVIPControl> vipcontrol)。该项由 LingBuilder FBro Bridge 自动管理，详情命令返回托管说明，不暴露 SDK 对象、CefRefPtr 或生命周期指针。
- 别名：`FBroHsVIPControl_IsNULL`（兼容旧写法，生成代码使用主名）。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_Bridge自动管理_检查VIP控件可用性(FBro浏览器1, "{}")
```


#### FBroVIP_Bridge自动管理_设置VIP事件适配器

- 签名：`FBroVIP_Bridge自动管理_设置VIP事件适配器(控件名, 参数JSON)`
- 返回值：文本型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroSetVipEvent(CefRefPtr<FBroVIPEvent> vip_event)。该项由 LingBuilder FBro Bridge 自动管理，详情命令返回托管说明，不暴露 SDK 对象、CefRefPtr 或生命周期指针。
- 别名：`FBroSetVipEvent`（兼容旧写法，生成代码使用主名）。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_Bridge自动管理_设置VIP事件适配器(FBro浏览器1, "{}")
```


### DOM

#### FBroVIP_DOM_禁用

- 签名：`FBroVIP_DOM_禁用(控件名, 参数JSON)`
- 返回值：长整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsDevToolsDOM_disable(CefRefPtr<CefBrowser> browser)。命令名已固定官方动作，调用时只需传参数JSON，不再手工填写分发命令字符串；异步结果使用 FBro任务_* 读取。
- 别名：`FBroHsDevToolsDOM_disable`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_DOM_禁用(FBro浏览器1, "{}")
```


#### FBroVIP_DOM_丢弃搜索结果

- 签名：`FBroVIP_DOM_丢弃搜索结果(控件名, 参数JSON)`
- 返回值：长整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsDevToolsDOM_discardSearchResults(CefRefPtr<CefBrowser> browser, const CefString& searchId)。命令名已固定官方动作，调用时只需传参数JSON，不再手工填写分发命令字符串；异步结果使用 FBro任务_* 读取。
- 别名：`FBroHsDevToolsDOM_discardSearchResults`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_DOM_丢弃搜索结果(FBro浏览器1, "{}")
```


#### FBroVIP_DOM_启用

- 签名：`FBroVIP_DOM_启用(控件名, 参数JSON)`
- 返回值：长整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsDevToolsDOM_enable(CefRefPtr<CefBrowser> browser, const CefString& includeWhitespace)。命令名已固定官方动作，调用时只需传参数JSON，不再手工填写分发命令字符串；异步结果使用 FBro任务_* 读取。
- 别名：`FBroHsDevToolsDOM_enable`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_DOM_启用(FBro浏览器1, "{}")
```


#### FBroVIP_DOM_聚焦元素

- 签名：`FBroVIP_DOM_聚焦元素(控件名, 参数JSON)`
- 返回值：长整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsDevToolsDOM_focusElement(CefRefPtr<CefBrowser> browser, int nodeId)。命令名已固定官方动作，调用时只需传参数JSON，不再手工填写分发命令字符串；异步结果使用 FBro任务_* 读取。
- 别名：`FBroHsDevToolsDOM_focusElement`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_DOM_聚焦元素(FBro浏览器1, "{}")
```


#### FBroVIP_DOM_取属性

- 签名：`FBroVIP_DOM_取属性(控件名, 参数JSON)`
- 返回值：长整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsDevToolsDOM_getAttributes(CefRefPtr<CefBrowser> browser, int nodeId, CefRefPtr<FBroHsGeneralResultCallback> object, HANDLE callback, M_POINTER arg)。命令名已固定官方动作，调用时只需传参数JSON，不再手工填写分发命令字符串；异步结果使用 FBro任务_* 读取。
- 别名：`FBroHsDevToolsDOM_getAttributes`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_DOM_取属性(FBro浏览器1, "{}")
```


#### FBroVIP_DOM_取节点容器

- 签名：`FBroVIP_DOM_取节点容器(控件名, 参数JSON)`
- 返回值：长整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsDevToolsDOM_getContainerForNode(CefRefPtr<CefBrowser> browser, int nodeId, const CefString& containerName, CefRefPtr<FBroHsGeneralResultCallback> object, HANDLE callback, M_POINTER arg)。命令名已固定官方动作，调用时只需传参数JSON，不再手工填写分发命令字符串；异步结果使用 FBro任务_* 读取。
- 别名：`FBroHsDevToolsDOM_getContainerForNode`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_DOM_取节点容器(FBro浏览器1, "{}")
```


#### FBroVIP_DOM_取文档

- 签名：`FBroVIP_DOM_取文档(控件名, 参数JSON)`
- 返回值：长整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsDevToolsDOM_getDocument(CefRefPtr<CefBrowser> browser, int depth, BOOL pierce, CefRefPtr<FBroHsGeneralResultCallback> object, HANDLE callback, M_POINTER arg)。命令名已固定官方动作，调用时只需传参数JSON，不再手工填写分发命令字符串；异步结果使用 FBro任务_* 读取。
- 别名：`FBroHsDevToolsDOM_getDocument`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_DOM_取文档(FBro浏览器1, "{}")
```


#### FBroVIP_DOM_取外部HTML

- 签名：`FBroVIP_DOM_取外部HTML(控件名, 参数JSON)`
- 返回值：长整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsDevToolsDOM_getOuterHTML(CefRefPtr<CefBrowser> browser, int nodeId, CefRefPtr<FBroHsGeneralResultCallback> object, HANDLE callback, M_POINTER arg)。命令名已固定官方动作，调用时只需传参数JSON，不再手工填写分发命令字符串；异步结果使用 FBro任务_* 读取。
- 别名：`FBroHsDevToolsDOM_getOuterHTML`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_DOM_取外部HTML(FBro浏览器1, "{}")
```


#### FBroVIP_DOM_取搜索结果

- 签名：`FBroVIP_DOM_取搜索结果(控件名, 参数JSON)`
- 返回值：长整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsDevToolsDOM_getSearchResults(CefRefPtr<CefBrowser> browser, const CefString& searchId, int fromIndex, int toIndex, CefRefPtr<FBroHsGeneralResultCallback> object, HANDLE callback, M_POINTER arg)。命令名已固定官方动作，调用时只需传参数JSON，不再手工填写分发命令字符串；异步结果使用 FBro任务_* 读取。
- 别名：`FBroHsDevToolsDOM_getSearchResults`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_DOM_取搜索结果(FBro浏览器1, "{}")
```


#### FBroVIP_DOM_执行搜索

- 签名：`FBroVIP_DOM_执行搜索(控件名, 参数JSON)`
- 返回值：长整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsDevToolsDOM_performSearch(CefRefPtr<CefBrowser> browser, const CefString& query, BOOL includeUserAgentShadowDOM, CefRefPtr<FBroHsGeneralResultCallback> object, HANDLE callback, M_POINTER arg)。命令名已固定官方动作，调用时只需传参数JSON，不再手工填写分发命令字符串；异步结果使用 FBro任务_* 读取。
- 别名：`FBroHsDevToolsDOM_performSearch`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_DOM_执行搜索(FBro浏览器1, "{}")
```


#### FBroVIP_DOM_查询选择器

- 签名：`FBroVIP_DOM_查询选择器(控件名, 参数JSON)`
- 返回值：长整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsDevToolsDOM_querySelector(CefRefPtr<CefBrowser> browser, int nodeId, const CefString& selector, CefRefPtr<FBroHsGeneralResultCallback> object, HANDLE callback, M_POINTER arg)。命令名已固定官方动作，调用时只需传参数JSON，不再手工填写分发命令字符串；异步结果使用 FBro任务_* 读取。
- 别名：`FBroHsDevToolsDOM_querySelector`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_DOM_查询选择器(FBro浏览器1, "{}")
```


#### FBroVIP_DOM_查询全部选择器

- 签名：`FBroVIP_DOM_查询全部选择器(控件名, 参数JSON)`
- 返回值：长整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsDevToolsDOM_querySelectorAll(CefRefPtr<CefBrowser> browser, int nodeId, const CefString& selector, CefRefPtr<FBroHsGeneralResultCallback> object, HANDLE callback, M_POINTER arg)。命令名已固定官方动作，调用时只需传参数JSON，不再手工填写分发命令字符串；异步结果使用 FBro任务_* 读取。
- 别名：`FBroHsDevToolsDOM_querySelectorAll`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_DOM_查询全部选择器(FBro浏览器1, "{}")
```


#### FBroVIP_DOM_删除属性

- 签名：`FBroVIP_DOM_删除属性(控件名, 参数JSON)`
- 返回值：长整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsDevToolsDOM_removeAttribute(CefRefPtr<CefBrowser> browser, int nodeId, const CefString& name)。命令名已固定官方动作，调用时只需传参数JSON，不再手工填写分发命令字符串；异步结果使用 FBro任务_* 读取。
- 别名：`FBroHsDevToolsDOM_removeAttribute`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_DOM_删除属性(FBro浏览器1, "{}")
```


#### FBroVIP_DOM_删除节点

- 签名：`FBroVIP_DOM_删除节点(控件名, 参数JSON)`
- 返回值：长整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsDevToolsDOM_removeNode(CefRefPtr<CefBrowser> browser, int nodeId)。命令名已固定官方动作，调用时只需传参数JSON，不再手工填写分发命令字符串；异步结果使用 FBro任务_* 读取。
- 别名：`FBroHsDevToolsDOM_removeNode`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_DOM_删除节点(FBro浏览器1, "{}")
```


#### FBroVIP_DOM_按文本设置属性

- 签名：`FBroVIP_DOM_按文本设置属性(控件名, 参数JSON)`
- 返回值：长整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsDevToolsDOM_setAttributesAsText(CefRefPtr<CefBrowser> browser, int nodeId, const CefString& text, const CefString& name)。命令名已固定官方动作，调用时只需传参数JSON，不再手工填写分发命令字符串；异步结果使用 FBro任务_* 读取。
- 别名：`FBroHsDevToolsDOM_setAttributesAsText`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_DOM_按文本设置属性(FBro浏览器1, "{}")
```


#### FBroVIP_DOM_设置属性值

- 签名：`FBroVIP_DOM_设置属性值(控件名, 参数JSON)`
- 返回值：长整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsDevToolsDOM_setAttributeValue(CefRefPtr<CefBrowser> browser, int nodeId, const CefString& name, const CefString& value)。命令名已固定官方动作，调用时只需传参数JSON，不再手工填写分发命令字符串；异步结果使用 FBro任务_* 读取。
- 别名：`FBroHsDevToolsDOM_setAttributeValue`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_DOM_设置属性值(FBro浏览器1, "{}")
```


#### FBroVIP_DOM_设置节点名

- 签名：`FBroVIP_DOM_设置节点名(控件名, 参数JSON)`
- 返回值：长整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsDevToolsDOM_setNodeName(CefRefPtr<CefBrowser> browser, int nodeId, const CefString& name, CefRefPtr<FBroHsGeneralResultCallback> object, HANDLE callback, M_POINTER arg)。命令名已固定官方动作，调用时只需传参数JSON，不再手工填写分发命令字符串；异步结果使用 FBro任务_* 读取。
- 别名：`FBroHsDevToolsDOM_setNodeName`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_DOM_设置节点名(FBro浏览器1, "{}")
```


#### FBroVIP_DOM_设置节点值

- 签名：`FBroVIP_DOM_设置节点值(控件名, 参数JSON)`
- 返回值：长整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsDevToolsDOM_setNodeValue(CefRefPtr<CefBrowser> browser, int nodeId, const CefString& value)。命令名已固定官方动作，调用时只需传参数JSON，不再手工填写分发命令字符串；异步结果使用 FBro任务_* 读取。
- 别名：`FBroHsDevToolsDOM_setNodeValue`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_DOM_设置节点值(FBro浏览器1, "{}")
```


#### FBroVIP_DOM_设置外部HTML

- 签名：`FBroVIP_DOM_设置外部HTML(控件名, 参数JSON)`
- 返回值：长整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsDevToolsDOM_setOuterHTML(CefRefPtr<CefBrowser> browser, int nodeId, const CefString& outerHTML)。命令名已固定官方动作，调用时只需传参数JSON，不再手工填写分发命令字符串；异步结果使用 FBro任务_* 读取。
- 别名：`FBroHsDevToolsDOM_setOuterHTML`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_DOM_设置外部HTML(FBro浏览器1, "{}")
```


### 网络与代理

#### FBroVIP_网络代理_设置启动代理

- 签名：`FBroVIP_网络代理_设置启动代理(控件名, 参数JSON)`
- 返回值：文本型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPCommandLine_SetProxy(CefRefPtr<CefCommandLine> cmd, const CefString& url, const CefString& user, const CefString& password)。该原始入口涉及授权 Key、代理凭据或初始化时序，已由“浏览器凭据设置中心”或现有安全高级入口替代；不会把 Key 写入 .lcpp。
- 别名：`FBroHsVIPCommandLine_SetProxy`（兼容旧写法，生成代码使用主名）。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_网络代理_设置启动代理(FBro浏览器1, "{}")
```


#### FBroVIP_网络代理_设置清空S5认证

- 签名：`FBroVIP_网络代理_设置清空S5认证(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_ClearS5Auth(CefRefPtr<FBroVIPControl> vipcontrol)。这是独立的安全指纹命令；参数JSON为路径 clearS5Auth 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_ClearS5Auth`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_网络代理_设置清空S5认证(FBro浏览器1, "{}")
```


#### FBroVIP_网络代理_设置S5代理认证

- 签名：`FBroVIP_网络代理_设置S5代理认证(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetS5Auth(CefRefPtr<FBroVIPControl> vipcontrol, const CefString& url, const CefString& username, const CefString& password, BOOL closeMsg)。这是独立的安全指纹命令；参数JSON为路径 s5Auth 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetS5Auth`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_网络代理_设置S5代理认证(FBro浏览器1, "{}")
```


#### FBroVIP_网络代理_设置SSL密码套件

- 签名：`FBroVIP_网络代理_设置SSL密码套件(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetSSLCipher(CefRefPtr<FBroVIPControl> vipcontrol, int min_version, int max_version, const CefString& cipher_command)。这是独立的安全指纹命令；参数JSON为路径 sslCipher 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetSSLCipher`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_网络代理_设置SSL密码套件(FBro浏览器1, "{}")
```


#### FBroVIP_网络代理_设置WebRTC地址

- 签名：`FBroVIP_网络代理_设置WebRTC地址(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetVirWebrtcIP(CefRefPtr<FBroVIPControl> vipcontrol, const CefString& publicip, const CefString& localip, const CefString& host,BOOL disable)。这是独立的安全指纹命令；参数JSON为路径 webrtc 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetVirWebrtcIP`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_网络代理_设置WebRTC地址(FBro浏览器1, "{}")
```


#### FBroVIP_网络代理_设置全局S5代理认证

- 签名：`FBroVIP_网络代理_设置全局S5代理认证(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPGlobal_SetS5Auth(const CefString& username, const CefString& password, BOOL closeMsg)。这是独立的安全指纹命令；参数JSON为路径 s5Auth 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPGlobal_SetS5Auth`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_网络代理_设置全局S5代理认证(FBro浏览器1, "{}")
```


### DevTools 与输入

#### FBroVIP_DevTools输入_添加消息观察器

- 签名：`FBroVIP_DevTools输入_添加消息观察器(控件名, 参数JSON)`
- 返回值：长整数型
- 说明：官方接口：DLLEXPORT BOOL TEXPORTS FBroHsVIPControl_AddDevToolsMessageObserver(CefRefPtr<FBroVIPControl> vipcontrol, CefRefPtr<FBroHsDevToolsMessageObserver> event)。命令名已固定官方动作，调用时只需传参数JSON，不再手工填写分发命令字符串；异步结果使用 FBro任务_* 读取。
- 别名：`FBroHsVIPControl_AddDevToolsMessageObserver`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_DevTools输入_添加消息观察器(FBro浏览器1, "{}")
```


#### FBroVIP_DevTools输入_添加标签页

- 签名：`FBroVIP_DevTools输入_添加标签页(控件名, 参数JSON)`
- 返回值：长整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_AddTabAt(CefRefPtr<FBroVIPControl> vipcontrol, const CefString& url, int index, BOOL foreground, CefRefPtr<CefDictionaryValue> extrainfo, CefRefPtr<FBroHsBroEvent> hsbroevent, Event_Disable_Control* eventContrl, const CefString& user_flag)。命令名已固定官方动作，调用时只需传参数JSON，不再手工填写分发命令字符串；异步结果使用 FBro任务_* 读取。
- 别名：`FBroHsVIPControl_AddTabAt`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_DevTools输入_添加标签页(FBro浏览器1, "{}")
```


#### FBroVIP_DevTools输入_删除消息观察器

- 签名：`FBroVIP_DevTools输入_删除消息观察器(控件名, 参数JSON)`
- 返回值：长整数型
- 说明：官方接口：DLLEXPORT BOOL TEXPORTS FBroHsVIPControl_DeleteDevToolsMessageObserver(CefRefPtr<FBroVIPControl> vipcontrol)。命令名已固定官方动作，调用时只需传参数JSON，不再手工填写分发命令字符串；异步结果使用 FBro任务_* 读取。
- 别名：`FBroHsVIPControl_DeleteDevToolsMessageObserver`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_DevTools输入_删除消息观察器(FBro浏览器1, "{}")
```


#### FBroVIP_DevTools输入_发送键盘事件

- 签名：`FBroVIP_DevTools输入_发送键盘事件(控件名, 参数JSON)`
- 返回值：长整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_DispatchKeyEvent(CefRefPtr<FBroVIPControl> vipcontrol, const CefString& type, int modifiers, const CefString& text, const CefString& unmodifiedText, const CefString& keyIdentifier, const CefString& code, const CefString& key, int windowsVirtualKeyCode, int nativeVirtualKeyCode, BOOL autoRepeat, BOOL isKeypad, BOOL isSystemKey, int location)。命令名已固定官方动作，调用时只需传参数JSON，不再手工填写分发命令字符串；异步结果使用 FBro任务_* 读取。
- 别名：`FBroHsVIPControl_DispatchKeyEvent`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_DevTools输入_发送键盘事件(FBro浏览器1, "{}")
```


#### FBroVIP_DevTools输入_发送鼠标事件

- 签名：`FBroVIP_DevTools输入_发送鼠标事件(控件名, 参数JSON)`
- 返回值：长整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_DispatchMouseEvent(CefRefPtr<FBroVIPControl> vipcontrol, const CefString& type, int x, int y, int modifiers, const CefString& button, int buttons, int clickCount, int deltaX, int deltaY, const CefString& pointerType)。命令名已固定官方动作，调用时只需传参数JSON，不再手工填写分发命令字符串；异步结果使用 FBro任务_* 读取。
- 别名：`FBroHsVIPControl_DispatchMouseEvent`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_DevTools输入_发送鼠标事件(FBro浏览器1, "{}")
```


#### FBroVIP_DevTools输入_发送触摸事件

- 签名：`FBroVIP_DevTools输入_发送触摸事件(控件名, 参数JSON)`
- 返回值：长整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_DispatchTouchEvent(CefRefPtr<FBroVIPControl> vipcontrol, int type, E_DEV_TOUCHPOINT* touchPoints, int modifiers)。命令名已固定官方动作，调用时只需传参数JSON，不再手工填写分发命令字符串；异步结果使用 FBro任务_* 读取。
- 别名：`FBroHsVIPControl_DispatchTouchEvent`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_DevTools输入_发送触摸事件(FBro浏览器1, "{}")
```


#### FBroVIP_DevTools输入_执行DevTools方法

- 签名：`FBroVIP_DevTools输入_执行DevTools方法(控件名, 参数JSON)`
- 返回值：长整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_ExecuteDevToolsMethod(CefRefPtr<FBroVIPControl> vipcontrol, int message_id, const CefString& method, CefRefPtr<CefDictionaryValue> params)。命令名已固定官方动作，调用时只需传参数JSON，不再手工填写分发命令字符串；异步结果使用 FBro任务_* 读取。
- 别名：`FBroHsVIPControl_ExecuteDevToolsMethod`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_DevTools输入_执行DevTools方法(FBro浏览器1, "{}")
```


#### FBroVIP_DevTools输入_取页面上下文ID

- 签名：`FBroVIP_DevTools输入_取页面上下文ID(控件名, 参数JSON)`
- 返回值：长整数型
- 说明：官方接口：DLLEXPORT CefRefPtr<CefListValue> TEXPORTS FBroHsVIPControl_PageGetContextID(CefRefPtr<FBroVIPControl> vipcontrol)。命令名已固定官方动作，调用时只需传参数JSON，不再手工填写分发命令字符串；异步结果使用 FBro任务_* 读取。
- 别名：`FBroHsVIPControl_PageGetContextID`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_DevTools输入_取页面上下文ID(FBro浏览器1, "{}")
```


#### FBroVIP_DevTools输入_启用Runtime

- 签名：`FBroVIP_DevTools输入_启用Runtime(控件名, 参数JSON)`
- 返回值：长整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_RuntimeEnable(CefRefPtr<FBroVIPControl> vipcontrol, BOOL enable)。命令名已固定官方动作，调用时只需传参数JSON，不再手工填写分发命令字符串；异步结果使用 FBro任务_* 读取。
- 别名：`FBroHsVIPControl_RuntimeEnable`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_DevTools输入_启用Runtime(FBro浏览器1, "{}")
```


#### FBroVIP_DevTools输入_执行表达式

- 签名：`FBroVIP_DevTools输入_执行表达式(控件名, 参数JSON)`
- 返回值：长整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_RuntimeEvaluate(CefRefPtr<FBroVIPControl> vipcontrol, const CefString& expression, BOOL includeCommandLineAPI, int contextId, BOOL silent, BOOL userGesture, int timeout, BOOL disableBreaks, BOOL replMode, CefRefPtr<FBroHsGeneralResultCallback> object, HANDLE callback, M_POINTER arg)。命令名已固定官方动作，调用时只需传参数JSON，不再手工填写分发命令字符串；异步结果使用 FBro任务_* 读取。
- 别名：`FBroHsVIPControl_RuntimeEvaluate`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_DevTools输入_执行表达式(FBro浏览器1, "{}")
```


#### FBroVIP_DevTools输入_按框架执行表达式

- 签名：`FBroVIP_DevTools输入_按框架执行表达式(控件名, 参数JSON)`
- 返回值：长整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_RuntimeEvaluate_FrameID(CefRefPtr<FBroVIPControl> vipcontrol, const CefString& expression, BOOL includeCommandLineAPI, int type, int frameNum, const CefString& frameId, BOOL silent, BOOL userGesture, int timeout, BOOL disableBreaks, BOOL replMode, CefRefPtr<FBroHsGeneralResultCallback> object, HANDLE callback, M_POINTER arg)。命令名已固定官方动作，调用时只需传参数JSON，不再手工填写分发命令字符串；异步结果使用 FBro任务_* 读取。
- 别名：`FBroHsVIPControl_RuntimeEvaluate_FrameID`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_DevTools输入_按框架执行表达式(FBro浏览器1, "{}")
```


#### FBroVIP_DevTools输入_发送DevTools消息

- 签名：`FBroVIP_DevTools输入_发送DevTools消息(控件名, 参数JSON)`
- 返回值：长整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SendDevToolsMessage(CefRefPtr<FBroVIPControl> vipcontrol, const CefString& message)。命令名已固定官方动作，调用时只需传参数JSON，不再手工填写分发命令字符串；异步结果使用 FBro任务_* 读取。
- 别名：`FBroHsVIPControl_SendDevToolsMessage`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_DevTools输入_发送DevTools消息(FBro浏览器1, "{}")
```


### 资源替换

#### FBroVIP_资源替换_添加实例资源缓冲替换

- 签名：`FBroVIP_资源替换_添加实例资源缓冲替换(控件名, 参数JSON)`
- 返回值：长整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_AddResourceHandlerChangeData(CefRefPtr<FBroVIPControl> vipcontrol, int find_type, const CefString& url, const CefString& mini_type, CefRefPtr<FBroDoubleString> header_map, void* change_data, size_t data_size)。命令名已固定官方动作，调用时只需传参数JSON，不再手工填写分发命令字符串；异步结果使用 FBro任务_* 读取。
- 别名：`FBroHsVIPControl_AddResourceHandlerChangeData`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_资源替换_添加实例资源缓冲替换(FBro浏览器1, "{}")
```


#### FBroVIP_资源替换_添加实例资源文件替换

- 签名：`FBroVIP_资源替换_添加实例资源文件替换(控件名, 参数JSON)`
- 返回值：长整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_AddResourceHandlerChangeFile(CefRefPtr<FBroVIPControl> vipcontrol, int find_type, const CefString& url, const CefString& mini_type, CefRefPtr<FBroDoubleString> header_map, const CefString& file_path)。命令名已固定官方动作，调用时只需传参数JSON，不再手工填写分发命令字符串；异步结果使用 FBro任务_* 读取。
- 别名：`FBroHsVIPControl_AddResourceHandlerChangeFile`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_资源替换_添加实例资源文件替换(FBro浏览器1, "{}")
```


#### FBroVIP_资源替换_清空实例资源替换

- 签名：`FBroVIP_资源替换_清空实例资源替换(控件名, 参数JSON)`
- 返回值：长整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_DeleteResourceHandlerAllData(CefRefPtr<FBroVIPControl> vipcontrol)。命令名已固定官方动作，调用时只需传参数JSON，不再手工填写分发命令字符串；异步结果使用 FBro任务_* 读取。
- 别名：`FBroHsVIPControl_DeleteResourceHandlerAllData`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_资源替换_清空实例资源替换(FBro浏览器1, "{}")
```


#### FBroVIP_资源替换_删除实例资源替换

- 签名：`FBroVIP_资源替换_删除实例资源替换(控件名, 参数JSON)`
- 返回值：长整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_DeleteResourceHandlerChangeData(CefRefPtr<FBroVIPControl> vipcontrol, const CefString& url)。命令名已固定官方动作，调用时只需传参数JSON，不再手工填写分发命令字符串；异步结果使用 FBro任务_* 读取。
- 别名：`FBroHsVIPControl_DeleteResourceHandlerChangeData`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_资源替换_删除实例资源替换(FBro浏览器1, "{}")
```


#### FBroVIP_资源替换_添加缓冲替换

- 签名：`FBroVIP_资源替换_添加缓冲替换(控件名, 参数JSON)`
- 返回值：长整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPResourceHandler_AddChangeData(int find_type, const CefString& url, const CefString& mini_type, CefRefPtr<FBroDoubleString> header_map, void* change_data, size_t data_size)。命令名已固定官方动作，调用时只需传参数JSON，不再手工填写分发命令字符串；异步结果使用 FBro任务_* 读取。
- 别名：`FBroHsVIPResourceHandler_AddChangeData`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_资源替换_添加缓冲替换(FBro浏览器1, "{}")
```


#### FBroVIP_资源替换_添加文件替换

- 签名：`FBroVIP_资源替换_添加文件替换(控件名, 参数JSON)`
- 返回值：长整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPResourceHandler_AddChangeFile(int find_type, const CefString& url, const CefString& mini_type, CefRefPtr<FBroDoubleString> header_map, const CefString& file_path)。命令名已固定官方动作，调用时只需传参数JSON，不再手工填写分发命令字符串；异步结果使用 FBro任务_* 读取。
- 别名：`FBroHsVIPResourceHandler_AddChangeFile`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_资源替换_添加文件替换(FBro浏览器1, "{}")
```


#### FBroVIP_资源替换_清空替换规则

- 签名：`FBroVIP_资源替换_清空替换规则(控件名, 参数JSON)`
- 返回值：长整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPResourceHandler_DeleteAllData()。命令名已固定官方动作，调用时只需传参数JSON，不再手工填写分发命令字符串；异步结果使用 FBro任务_* 读取。
- 别名：`FBroHsVIPResourceHandler_DeleteAllData`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_资源替换_清空替换规则(FBro浏览器1, "{}")
```


#### FBroVIP_资源替换_删除替换规则

- 签名：`FBroVIP_资源替换_删除替换规则(控件名, 参数JSON)`
- 返回值：长整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPResourceHandler_DeleteChangeData(const CefString& url)。命令名已固定官方动作，调用时只需传参数JSON，不再手工填写分发命令字符串；异步结果使用 FBro任务_* 读取。
- 别名：`FBroHsVIPResourceHandler_DeleteChangeData`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_资源替换_删除替换规则(FBro浏览器1, "{}")
```


### 响应过滤

#### FBroVIP_响应过滤_添加实例响应替换

- 签名：`FBroVIP_响应过滤_添加实例响应替换(控件名, 参数JSON)`
- 返回值：长整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_AddResponseFilterChangeData(CefRefPtr<FBroVIPControl> vipcontrol, int find_type, const CefString& url, int change_type, const CefString& key, const CefString& change_data)。命令名已固定官方动作，调用时只需传参数JSON，不再手工填写分发命令字符串；异步结果使用 FBro任务_* 读取。
- 别名：`FBroHsVIPControl_AddResponseFilterChangeData`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_响应过滤_添加实例响应替换(FBro浏览器1, "{}")
```


#### FBroVIP_响应过滤_清空实例响应替换

- 签名：`FBroVIP_响应过滤_清空实例响应替换(控件名, 参数JSON)`
- 返回值：长整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_DeleteResponseFilterAllData(CefRefPtr<FBroVIPControl> vipcontrol)。命令名已固定官方动作，调用时只需传参数JSON，不再手工填写分发命令字符串；异步结果使用 FBro任务_* 读取。
- 别名：`FBroHsVIPControl_DeleteResponseFilterAllData`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_响应过滤_清空实例响应替换(FBro浏览器1, "{}")
```


#### FBroVIP_响应过滤_删除实例响应替换

- 签名：`FBroVIP_响应过滤_删除实例响应替换(控件名, 参数JSON)`
- 返回值：长整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_DeletResponseFiltereChangeData(CefRefPtr<FBroVIPControl> vipcontrol, const CefString& url)。命令名已固定官方动作，调用时只需传参数JSON，不再手工填写分发命令字符串；异步结果使用 FBro任务_* 读取。
- 别名：`FBroHsVIPControl_DeletResponseFiltereChangeData`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_响应过滤_删除实例响应替换(FBro浏览器1, "{}")
```


#### FBroVIP_响应过滤_添加缓冲替换

- 签名：`FBroVIP_响应过滤_添加缓冲替换(控件名, 参数JSON)`
- 返回值：长整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPResponseFilter_AddChangeData(int find_type, const CefString& url, int change_type, const CefString& key, const CefString& change_data)。命令名已固定官方动作，调用时只需传参数JSON，不再手工填写分发命令字符串；异步结果使用 FBro任务_* 读取。
- 别名：`FBroHsVIPResponseFilter_AddChangeData`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_响应过滤_添加缓冲替换(FBro浏览器1, "{}")
```


#### FBroVIP_响应过滤_清空替换规则

- 签名：`FBroVIP_响应过滤_清空替换规则(控件名, 参数JSON)`
- 返回值：长整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPResponseFilter_DeleteAllData()。命令名已固定官方动作，调用时只需传参数JSON，不再手工填写分发命令字符串；异步结果使用 FBro任务_* 读取。
- 别名：`FBroHsVIPResponseFilter_DeleteAllData`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_响应过滤_清空替换规则(FBro浏览器1, "{}")
```


#### FBroVIP_响应过滤_删除替换规则

- 签名：`FBroVIP_响应过滤_删除替换规则(控件名, 参数JSON)`
- 返回值：长整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPResponseFilter_DeleteChangeData(const CefString& url)。命令名已固定官方动作，调用时只需传参数JSON，不再手工填写分发命令字符串；异步结果使用 FBro任务_* 读取。
- 别名：`FBroHsVIPResponseFilter_DeleteChangeData`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_响应过滤_删除替换规则(FBro浏览器1, "{}")
```


### 浏览器指纹

#### FBroVIP_浏览器指纹_设置清空全部数据

- 签名：`FBroVIP_浏览器指纹_设置清空全部数据(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_ClearAllData(CefRefPtr<FBroVIPControl> vipcontrol)。这是独立的安全指纹命令；参数JSON为路径 clearAllData 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_ClearAllData`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_浏览器指纹_设置清空全部数据(FBro浏览器1, "{}")
```


#### FBroVIP_浏览器指纹_设置启用WebSocket客户端钩子

- 签名：`FBroVIP_浏览器指纹_设置启用WebSocket客户端钩子(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_EnableWebsocketClientHook(CefRefPtr<FBroVIPControl> vipcontrol)。这是独立的安全指纹命令；参数JSON为路径 enableWebsocketClientHook 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_EnableWebsocketClientHook`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_浏览器指纹_设置启用WebSocket客户端钩子(FBro浏览器1, "{}")
```


#### FBroVIP_浏览器指纹_设置接受语言

- 签名：`FBroVIP_浏览器指纹_设置接受语言(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetVirAcceptlanguages(CefRefPtr<FBroVIPControl> vipcontrol, const CefString& indata)。这是独立的安全指纹命令；参数JSON为路径 acceptLanguages 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetVirAcceptlanguages`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_浏览器指纹_设置接受语言(FBro浏览器1, "{}")
```


#### FBroVIP_浏览器指纹_设置应用代码名

- 签名：`FBroVIP_浏览器指纹_设置应用代码名(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetVirAppCodeName(CefRefPtr<FBroVIPControl> vipcontrol, const CefString& indata)。这是独立的安全指纹命令；参数JSON为路径 appCodeName 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetVirAppCodeName`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_浏览器指纹_设置应用代码名(FBro浏览器1, "{}")
```


#### FBroVIP_浏览器指纹_设置应用名

- 签名：`FBroVIP_浏览器指纹_设置应用名(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetVirAppName(CefRefPtr<FBroVIPControl> vipcontrol, const CefString& indata)。这是独立的安全指纹命令；参数JSON为路径 appName 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetVirAppName`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_浏览器指纹_设置应用名(FBro浏览器1, "{}")
```


#### FBroVIP_浏览器指纹_设置应用版本

- 签名：`FBroVIP_浏览器指纹_设置应用版本(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetVirAppVersion(CefRefPtr<FBroVIPControl> vipcontrol, const CefString& indata)。这是独立的安全指纹命令；参数JSON为路径 appVersion 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetVirAppVersion`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_浏览器指纹_设置应用版本(FBro浏览器1, "{}")
```


#### FBroVIP_浏览器指纹_设置Cookie启用状态

- 签名：`FBroVIP_浏览器指纹_设置Cookie启用状态(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetVirCookieEnabled(CefRefPtr<FBroVIPControl> vipcontrol, BOOL indata)。这是独立的安全指纹命令；参数JSON为路径 cookieEnabled 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetVirCookieEnabled`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_浏览器指纹_设置Cookie启用状态(FBro浏览器1, "{}")
```


#### FBroVIP_浏览器指纹_设置设备内存

- 签名：`FBroVIP_浏览器指纹_设置设备内存(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetVirDeviceMemory(CefRefPtr<FBroVIPControl> vipcontrol, int indata)。这是独立的安全指纹命令；参数JSON为路径 deviceMemory 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetVirDeviceMemory`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_浏览器指纹_设置设备内存(FBro浏览器1, "{}")
```


#### FBroVIP_浏览器指纹_设置硬件并发数

- 签名：`FBroVIP_浏览器指纹_设置硬件并发数(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetVirHardwareConcurrency(CefRefPtr<FBroVIPControl> vipcontrol, int indata)。这是独立的安全指纹命令；参数JSON为路径 hardwareConcurrency 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetVirHardwareConcurrency`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_浏览器指纹_设置硬件并发数(FBro浏览器1, "{}")
```


#### FBroVIP_浏览器指纹_设置Java启用状态

- 签名：`FBroVIP_浏览器指纹_设置Java启用状态(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetVirJavaEnabled(CefRefPtr<FBroVIPControl> vipcontrol, BOOL indata)。这是独立的安全指纹命令；参数JSON为路径 javaEnabled 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetVirJavaEnabled`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_浏览器指纹_设置Java启用状态(FBro浏览器1, "{}")
```


#### FBroVIP_浏览器指纹_设置语言列表

- 签名：`FBroVIP_浏览器指纹_设置语言列表(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetVirLanguages(CefRefPtr<FBroVIPControl> vipcontrol, const CefString& indata)。这是独立的安全指纹命令；参数JSON为路径 languages 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetVirLanguages`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_浏览器指纹_设置语言列表(FBro浏览器1, "{}")
```


#### FBroVIP_浏览器指纹_设置在线状态

- 签名：`FBroVIP_浏览器指纹_设置在线状态(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetVirOnLine(CefRefPtr<FBroVIPControl> vipcontrol, BOOL indata)。这是独立的安全指纹命令；参数JSON为路径 online 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetVirOnLine`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_浏览器指纹_设置在线状态(FBro浏览器1, "{}")
```


#### FBroVIP_浏览器指纹_设置平台

- 签名：`FBroVIP_浏览器指纹_设置平台(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetVirPlatform(CefRefPtr<FBroVIPControl> vipcontrol, const CefString& indata)。这是独立的安全指纹命令；参数JSON为路径 platform 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetVirPlatform`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_浏览器指纹_设置平台(FBro浏览器1, "{}")
```


#### FBroVIP_浏览器指纹_设置产品名

- 签名：`FBroVIP_浏览器指纹_设置产品名(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetVirProduct(CefRefPtr<FBroVIPControl> vipcontrol, const CefString& indata)。这是独立的安全指纹命令；参数JSON为路径 product 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetVirProduct`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_浏览器指纹_设置产品名(FBro浏览器1, "{}")
```


#### FBroVIP_浏览器指纹_设置产品子版本

- 签名：`FBroVIP_浏览器指纹_设置产品子版本(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetVirProductSub(CefRefPtr<FBroVIPControl> vipcontrol, const CefString& indata)。这是独立的安全指纹命令；参数JSON为路径 productSub 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetVirProductSub`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_浏览器指纹_设置产品子版本(FBro浏览器1, "{}")
```


#### FBroVIP_浏览器指纹_设置厂商

- 签名：`FBroVIP_浏览器指纹_设置厂商(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetVirVendor(CefRefPtr<FBroVIPControl> vipcontrol, const CefString& indata)。这是独立的安全指纹命令；参数JSON为路径 vendor 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetVirVendor`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_浏览器指纹_设置厂商(FBro浏览器1, "{}")
```


#### FBroVIP_浏览器指纹_设置厂商子版本

- 签名：`FBroVIP_浏览器指纹_设置厂商子版本(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetVirVendorSub(CefRefPtr<FBroVIPControl> vipcontrol, const CefString& indata)。这是独立的安全指纹命令；参数JSON为路径 vendorSub 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetVirVendorSub`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_浏览器指纹_设置厂商子版本(FBro浏览器1, "{}")
```


#### FBroVIP_浏览器指纹_设置WebDriver标记

- 签名：`FBroVIP_浏览器指纹_设置WebDriver标记(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetVirWebdriver(CefRefPtr<FBroVIPControl> vipcontrol, BOOL indata)。这是独立的安全指纹命令；参数JSON为路径 webdriver 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetVirWebdriver`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_浏览器指纹_设置WebDriver标记(FBro浏览器1, "{}")
```


### 调用统计

#### FBroVIP_调用统计_清空调用次数

- 签名：`FBroVIP_调用统计_清空调用次数(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_ClearFingerCount(CefRefPtr<FBroVIPControl> vipcontrol)。复用受控 VIP 调用统计接口。
- 别名：`FBroHsVIPControl_ClearFingerCount`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_调用统计_清空调用次数(FBro浏览器1, "{}")
```


#### FBroVIP_调用统计_取调用次数

- 签名：`FBroVIP_调用统计_取调用次数(控件名, 参数JSON)`
- 返回值：文本型
- 说明：官方接口：DLLEXPORT CefRefPtr<FBroString> TEXPORTS FBroHsVIPControl_GetFingerCount(CefRefPtr<FBroVIPControl> vipcontrol)。复用受控 VIP 调用统计接口。
- 别名：`FBroHsVIPControl_GetFingerCount`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_调用统计_取调用次数(FBro浏览器1, "{}")
```


### 屏幕与视口

#### FBroVIP_屏幕视口_页面截图

- 签名：`FBroVIP_屏幕视口_页面截图(控件名, 参数JSON)`
- 返回值：文本型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_PageCaptureScreenshot(CefRefPtr<FBroVIPControl> vipcontrol, const CefString& format, int quality, VIEWPORT_POINT viewport, BOOL fromSurface, BOOL captureBeyondViewport, CefRefPtr<FBroHsGeneralResultCallback> object, HANDLE callback, M_POINTER arg)。该项由 LingBuilder FBro Bridge 自动管理，详情命令返回托管说明，不暴露 SDK 对象、CefRefPtr 或生命周期指针。
- 别名：`FBroHsVIPControl_PageCaptureScreenshot`（兼容旧写法，生成代码使用主名）。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_屏幕视口_页面截图(FBro浏览器1, "{}")
```


#### FBroVIP_屏幕视口_设置设备像素比

- 签名：`FBroVIP_屏幕视口_设置设备像素比(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetVirDevicePixelRatio(CefRefPtr<FBroVIPControl> vipcontrol, double indata)。这是独立的安全指纹命令；参数JSON为路径 devicePixelRatio 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetVirDevicePixelRatio`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_屏幕视口_设置设备像素比(FBro浏览器1, "{}")
```


#### FBroVIP_屏幕视口_设置屏幕方向

- 签名：`FBroVIP_屏幕视口_设置屏幕方向(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetVirOrientation(CefRefPtr<FBroVIPControl> vipcontrol, int orientation, int orientation_type)。这是独立的安全指纹命令；参数JSON为路径 orientation 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetVirOrientation`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_屏幕视口_设置屏幕方向(FBro浏览器1, "{}")
```


#### FBroVIP_屏幕视口_设置可用屏幕高度与宽度

- 签名：`FBroVIP_屏幕视口_设置可用屏幕高度与宽度(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetVirScreenavailHeightAndWidth(CefRefPtr<FBroVIPControl> vipcontrol, int H, int W)。这是独立的安全指纹命令；参数JSON为该接口对应的完整指纹配置补丁，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetVirScreenavailHeightAndWidth`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_屏幕视口_设置可用屏幕高度与宽度(FBro浏览器1, "{}")
```


#### FBroVIP_屏幕视口_设置屏幕颜色深度

- 签名：`FBroVIP_屏幕视口_设置屏幕颜色深度(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetVirScreencolorDepth(CefRefPtr<FBroVIPControl> vipcontrol, int indata)。这是独立的安全指纹命令；参数JSON为路径 screenColorDepth 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetVirScreencolorDepth`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_屏幕视口_设置屏幕颜色深度(FBro浏览器1, "{}")
```


#### FBroVIP_屏幕视口_设置屏幕高度与宽度

- 签名：`FBroVIP_屏幕视口_设置屏幕高度与宽度(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetVirScreenHeightAndWidth(CefRefPtr<FBroVIPControl> vipcontrol, int H, int W)。这是独立的安全指纹命令；参数JSON为该接口对应的完整指纹配置补丁，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetVirScreenHeightAndWidth`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_屏幕视口_设置屏幕高度与宽度(FBro浏览器1, "{}")
```


#### FBroVIP_屏幕视口_设置屏幕像素深度

- 签名：`FBroVIP_屏幕视口_设置屏幕像素深度(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetVirScreenpixelDepth(CefRefPtr<FBroVIPControl> vipcontrol, int indata)。这是独立的安全指纹命令；参数JSON为路径 screenPixelDepth 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetVirScreenpixelDepth`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_屏幕视口_设置屏幕像素深度(FBro浏览器1, "{}")
```


#### FBroVIP_屏幕视口_设置屏幕坐标

- 签名：`FBroVIP_屏幕视口_设置屏幕坐标(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetVirScreenXAndY(CefRefPtr<FBroVIPControl> vipcontrol, int X, int Y)。这是独立的安全指纹命令；参数JSON为该接口对应的完整指纹配置补丁，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetVirScreenXAndY`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_屏幕视口_设置屏幕坐标(FBro浏览器1, "{}")
```


#### FBroVIP_屏幕视口_设置视口

- 签名：`FBroVIP_屏幕视口_设置视口(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetVirViewport(CefRefPtr<FBroVIPControl> vipcontrol, int x, int y, int w, int h)。这是独立的安全指纹命令；参数JSON为路径 viewport 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetVirViewport`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_屏幕视口_设置视口(FBro浏览器1, "{}")
```


### Canvas、字体与音频指纹

#### FBroVIP_Canvas字体音频指纹_设置音频固定指纹

- 签名：`FBroVIP_Canvas字体音频指纹_设置音频固定指纹(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetAudioFingerPrint_constant(CefRefPtr<FBroVIPControl> vipcontrol, const CefString& indata)。这是独立的安全指纹命令；参数JSON为路径 fingerprints.audio.constant 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetAudioFingerPrint_constant`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_Canvas字体音频指纹_设置音频固定指纹(FBro浏览器1, "{}")
```


#### FBroVIP_Canvas字体音频指纹_设置音频随机指纹

- 签名：`FBroVIP_Canvas字体音频指纹_设置音频随机指纹(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT CefRefPtr<FBroString> TEXPORTS FBroHsVIPControl_SetAudioFingerPrint_random(CefRefPtr<FBroVIPControl> vipcontrol, int minipoint, int maxpoint, int srand)。这是独立的安全指纹命令；参数JSON为路径 fingerprints.audio 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetAudioFingerPrint_random`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_Canvas字体音频指纹_设置音频随机指纹(FBro浏览器1, "{}")
```


#### FBroVIP_Canvas字体音频指纹_设置Canvas固定指纹

- 签名：`FBroVIP_Canvas字体音频指纹_设置Canvas固定指纹(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetCanvasFingerPrint_constant(CefRefPtr<FBroVIPControl> vipcontrol, const CefString& indata)。这是独立的安全指纹命令；参数JSON为路径 fingerprints.canvas.constant 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetCanvasFingerPrint_constant`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_Canvas字体音频指纹_设置Canvas固定指纹(FBro浏览器1, "{}")
```


#### FBroVIP_Canvas字体音频指纹_设置Canvas随机指纹

- 签名：`FBroVIP_Canvas字体音频指纹_设置Canvas随机指纹(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT CefRefPtr<FBroString> TEXPORTS FBroHsVIPControl_SetCanvasFingerPrint_random(CefRefPtr<FBroVIPControl> vipcontrol, int minipoint, int maxpoint, int srand)。这是独立的安全指纹命令；参数JSON为路径 fingerprints.canvas 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetCanvasFingerPrint_random`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_Canvas字体音频指纹_设置Canvas随机指纹(FBro浏览器1, "{}")
```


#### FBroVIP_Canvas字体音频指纹_设置Canvas字体指纹

- 签名：`FBroVIP_Canvas字体音频指纹_设置Canvas字体指纹(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetVirCanvas2DFontFingerprint(CefRefPtr<FBroVIPControl> vipcontrol, double indata)。这是独立的安全指纹命令；参数JSON为路径 canvas2dFontFingerprint 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetVirCanvas2DFontFingerprint`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_Canvas字体音频指纹_设置Canvas字体指纹(FBro浏览器1, "{}")
```


#### FBroVIP_Canvas字体音频指纹_设置CSS字体指纹

- 签名：`FBroVIP_Canvas字体音频指纹_设置CSS字体指纹(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetVirCSSFontFingerprint(CefRefPtr<FBroVIPControl> vipcontrol, const CefString& indata, int x, int y)。这是独立的安全指纹命令；参数JSON为路径 cssFontFingerprint 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetVirCSSFontFingerprint`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_Canvas字体音频指纹_设置CSS字体指纹(FBro浏览器1, "{}")
```


#### FBroVIP_Canvas字体音频指纹_设置矩形指纹

- 签名：`FBroVIP_Canvas字体音频指纹_设置矩形指纹(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetVirRectFingerprint(CefRefPtr<FBroVIPControl> vipcontrol, int x, int y, int w, int h)。这是独立的安全指纹命令；参数JSON为路径 rectFingerprint 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetVirRectFingerprint`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_Canvas字体音频指纹_设置矩形指纹(FBro浏览器1, "{}")
```


### 内核与反检测

#### FBroVIP_内核反检测_设置CSS内核

- 签名：`FBroVIP_内核反检测_设置CSS内核(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetCSSKernel(CefRefPtr<FBroVIPControl> vipcontrol, int kernel)。这是独立的安全指纹命令；参数JSON为路径 cssKernel 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetCSSKernel`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_内核反检测_设置CSS内核(FBro浏览器1, "{}")
```


#### FBroVIP_内核反检测_设置禁用ConsoleAssert

- 签名：`FBroVIP_内核反检测_设置禁用ConsoleAssert(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetDisableConsoleAssert(CefRefPtr<FBroVIPControl> vipcontrol, BOOL indata)。这是独立的安全指纹命令；参数JSON为路径 disableConsoleAssert 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetDisableConsoleAssert`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_内核反检测_设置禁用ConsoleAssert(FBro浏览器1, "{}")
```


#### FBroVIP_内核反检测_设置禁用ConsoleClear

- 签名：`FBroVIP_内核反检测_设置禁用ConsoleClear(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetDisableConsoleClear(CefRefPtr<FBroVIPControl> vipcontrol, BOOL indata)。这是独立的安全指纹命令；参数JSON为路径 disableConsoleClear 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetDisableConsoleClear`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_内核反检测_设置禁用ConsoleClear(FBro浏览器1, "{}")
```


#### FBroVIP_内核反检测_设置禁用ConsoleCount

- 签名：`FBroVIP_内核反检测_设置禁用ConsoleCount(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetDisableConsoleCount(CefRefPtr<FBroVIPControl> vipcontrol, BOOL indata)。这是独立的安全指纹命令；参数JSON为路径 disableConsoleCount 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetDisableConsoleCount`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_内核反检测_设置禁用ConsoleCount(FBro浏览器1, "{}")
```


#### FBroVIP_内核反检测_设置禁用ConsoleDebug

- 签名：`FBroVIP_内核反检测_设置禁用ConsoleDebug(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetDisableConsoleDebug(CefRefPtr<FBroVIPControl> vipcontrol, BOOL indata)。这是独立的安全指纹命令；参数JSON为路径 disableConsoleDebug 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetDisableConsoleDebug`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_内核反检测_设置禁用ConsoleDebug(FBro浏览器1, "{}")
```


#### FBroVIP_内核反检测_设置禁用ConsoleDir

- 签名：`FBroVIP_内核反检测_设置禁用ConsoleDir(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetDisableConsoleDir(CefRefPtr<FBroVIPControl> vipcontrol, BOOL indata)。这是独立的安全指纹命令；参数JSON为路径 disableConsoleDir 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetDisableConsoleDir`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_内核反检测_设置禁用ConsoleDir(FBro浏览器1, "{}")
```


#### FBroVIP_内核反检测_设置禁用ConsoleError

- 签名：`FBroVIP_内核反检测_设置禁用ConsoleError(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetDisableConsoleError(CefRefPtr<FBroVIPControl> vipcontrol, BOOL indata)。这是独立的安全指纹命令；参数JSON为路径 disableConsoleError 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetDisableConsoleError`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_内核反检测_设置禁用ConsoleError(FBro浏览器1, "{}")
```


#### FBroVIP_内核反检测_设置禁用ConsoleGroup

- 签名：`FBroVIP_内核反检测_设置禁用ConsoleGroup(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetDisableConsoleGroup(CefRefPtr<FBroVIPControl> vipcontrol, BOOL indata)。这是独立的安全指纹命令；参数JSON为路径 disableConsoleGroup 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetDisableConsoleGroup`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_内核反检测_设置禁用ConsoleGroup(FBro浏览器1, "{}")
```


#### FBroVIP_内核反检测_设置禁用ConsoleInfo

- 签名：`FBroVIP_内核反检测_设置禁用ConsoleInfo(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetDisableConsoleInfo(CefRefPtr<FBroVIPControl> vipcontrol, BOOL indata)。这是独立的安全指纹命令；参数JSON为路径 disableConsoleInfo 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetDisableConsoleInfo`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_内核反检测_设置禁用ConsoleInfo(FBro浏览器1, "{}")
```


#### FBroVIP_内核反检测_设置禁用ConsoleLog

- 签名：`FBroVIP_内核反检测_设置禁用ConsoleLog(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetDisableConsoleLog(CefRefPtr<FBroVIPControl> vipcontrol, BOOL indata)。这是独立的安全指纹命令；参数JSON为路径 disableConsoleLog 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetDisableConsoleLog`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_内核反检测_设置禁用ConsoleLog(FBro浏览器1, "{}")
```


#### FBroVIP_内核反检测_设置禁用ConsoleProfile

- 签名：`FBroVIP_内核反检测_设置禁用ConsoleProfile(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetDisableConsoleProfile(CefRefPtr<FBroVIPControl> vipcontrol, BOOL indata)。这是独立的安全指纹命令；参数JSON为路径 disableConsoleProfile 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetDisableConsoleProfile`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_内核反检测_设置禁用ConsoleProfile(FBro浏览器1, "{}")
```


#### FBroVIP_内核反检测_设置禁用ConsoleTable

- 签名：`FBroVIP_内核反检测_设置禁用ConsoleTable(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetDisableConsoleTable(CefRefPtr<FBroVIPControl> vipcontrol, BOOL indata)。这是独立的安全指纹命令；参数JSON为路径 disableConsoleTable 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetDisableConsoleTable`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_内核反检测_设置禁用ConsoleTable(FBro浏览器1, "{}")
```


#### FBroVIP_内核反检测_设置禁用ConsoleTime

- 签名：`FBroVIP_内核反检测_设置禁用ConsoleTime(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetDisableConsoleTime(CefRefPtr<FBroVIPControl> vipcontrol, BOOL indata)。这是独立的安全指纹命令；参数JSON为路径 disableConsoleTime 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetDisableConsoleTime`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_内核反检测_设置禁用ConsoleTime(FBro浏览器1, "{}")
```


#### FBroVIP_内核反检测_设置禁用ConsoleTrace

- 签名：`FBroVIP_内核反检测_设置禁用ConsoleTrace(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetDisableConsoleTrace(CefRefPtr<FBroVIPControl> vipcontrol, BOOL indata)。这是独立的安全指纹命令；参数JSON为路径 disableConsoleTrace 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetDisableConsoleTrace`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_内核反检测_设置禁用ConsoleTrace(FBro浏览器1, "{}")
```


#### FBroVIP_内核反检测_设置禁用ConsoleWarn

- 签名：`FBroVIP_内核反检测_设置禁用ConsoleWarn(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetDisableConsoleWarn(CefRefPtr<FBroVIPControl> vipcontrol, BOOL indata)。这是独立的安全指纹命令；参数JSON为路径 disableConsoleWarn 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetDisableConsoleWarn`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_内核反检测_设置禁用ConsoleWarn(FBro浏览器1, "{}")
```


#### FBroVIP_内核反检测_设置禁用调试器

- 签名：`FBroVIP_内核反检测_设置禁用调试器(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetDisableDebugger(CefRefPtr<FBroVIPControl> vipcontrol, BOOL indata)。这是独立的安全指纹命令；参数JSON为路径 disableDebugger 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetDisableDebugger`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_内核反检测_设置禁用调试器(FBro浏览器1, "{}")
```


#### FBroVIP_内核反检测_设置性能检查范围

- 签名：`FBroVIP_内核反检测_设置性能检查范围(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetDisablePerformanceCheck(CefRefPtr<FBroVIPControl> vipcontrol, BOOL disable, double min, double max)。这是独立的安全指纹命令；参数JSON为路径 performanceCheck 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetDisablePerformanceCheck`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_内核反检测_设置性能检查范围(FBro浏览器1, "{}")
```


#### FBroVIP_内核反检测_设置鼠标模拟触摸事件

- 签名：`FBroVIP_内核反检测_设置鼠标模拟触摸事件(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetEmitTouchEventsForMouse(CefRefPtr<FBroVIPControl> vipcontrol, BOOL enable, int configuration)。这是独立的安全指纹命令；参数JSON为路径 emitTouchEventsForMouse 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetEmitTouchEventsForMouse`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_内核反检测_设置鼠标模拟触摸事件(FBro浏览器1, "{}")
```


#### FBroVIP_内核反检测_设置触摸事件模拟

- 签名：`FBroVIP_内核反检测_设置触摸事件模拟(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetTouchEventEmulationEnabled(CefRefPtr<FBroVIPControl> vipcontrol, BOOL enabled, int maxTouchPoints)。这是独立的安全指纹命令；参数JSON为路径 touchEmulation 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetTouchEventEmulationEnabled`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_内核反检测_设置触摸事件模拟(FBro浏览器1, "{}")
```


#### FBroVIP_内核反检测_设置V8内核

- 签名：`FBroVIP_内核反检测_设置V8内核(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetV8Kernel(CefRefPtr<FBroVIPControl> vipcontrol, int kernel)。这是独立的安全指纹命令；参数JSON为路径 v8Kernel 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetV8Kernel`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_内核反检测_设置V8内核(FBro浏览器1, "{}")
```


#### FBroVIP_内核反检测_设置可信事件标记

- 签名：`FBroVIP_内核反检测_设置可信事件标记(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetVirisTrusted(CefRefPtr<FBroVIPControl> vipcontrol, BOOL indata)。这是独立的安全指纹命令；参数JSON为路径 isTrusted 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetVirisTrusted`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_内核反检测_设置可信事件标记(FBro浏览器1, "{}")
```


#### FBroVIP_内核反检测_设置浏览器内核

- 签名：`FBroVIP_内核反检测_设置浏览器内核(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetVirKernel(CefRefPtr<FBroVIPControl> vipcontrol, int kernel)。这是独立的安全指纹命令；参数JSON为路径 kernel 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetVirKernel`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_内核反检测_设置浏览器内核(FBro浏览器1, "{}")
```


#### FBroVIP_内核反检测_设置Web功能内核

- 签名：`FBroVIP_内核反检测_设置Web功能内核(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetWebFeatureKernel(CefRefPtr<FBroVIPControl> vipcontrol, int kernel)。这是独立的安全指纹命令；参数JSON为路径 webFeatureKernel 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetWebFeatureKernel`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_内核反检测_设置Web功能内核(FBro浏览器1, "{}")
```


### 设备与插件

#### FBroVIP_设备插件_设置插件指纹

- 签名：`FBroVIP_设备插件_设置插件指纹(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetPlugins(CefRefPtr<FBroVIPControl> vipcontrol, int changetype, const CefString& indata)。这是独立的安全指纹命令；参数JSON为路径 plugins 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetPlugins`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_设备插件_设置插件指纹(FBro浏览器1, "{}")
```


#### FBroVIP_设备插件_设置音频输入设备

- 签名：`FBroVIP_设备插件_设置音频输入设备(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetVirAudioInput(CefRefPtr<FBroVIPControl> vipcontrol, const CefString& indata)。这是独立的安全指纹命令；参数JSON为路径 audioInput 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetVirAudioInput`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_设备插件_设置音频输入设备(FBro浏览器1, "{}")
```


#### FBroVIP_设备插件_设置音频输出设备

- 签名：`FBroVIP_设备插件_设置音频输出设备(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetVirAudioOutput(CefRefPtr<FBroVIPControl> vipcontrol, const CefString& indata)。这是独立的安全指纹命令；参数JSON为路径 audioOutput 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetVirAudioOutput`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_设备插件_设置音频输出设备(FBro浏览器1, "{}")
```


#### FBroVIP_设备插件_设置语音合成声音

- 签名：`FBroVIP_设备插件_设置语音合成声音(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetVirSpeechSynthesisVoices(CefRefPtr<FBroVIPControl> vipcontrol, const CefString& indata)。这是独立的安全指纹命令；参数JSON为路径 speechSynthesisVoices 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetVirSpeechSynthesisVoices`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_设备插件_设置语音合成声音(FBro浏览器1, "{}")
```


#### FBroVIP_设备插件_设置视频输入设备

- 签名：`FBroVIP_设备插件_设置视频输入设备(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetVirVideoInput(CefRefPtr<FBroVIPControl> vipcontrol, const CefString& indata)。这是独立的安全指纹命令；参数JSON为路径 videoInput 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetVirVideoInput`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_设备插件_设置视频输入设备(FBro浏览器1, "{}")
```


### 电池

#### FBroVIP_电池_设置电池充电状态

- 签名：`FBroVIP_电池_设置电池充电状态(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetVirBatteryManagerCharging(CefRefPtr<FBroVIPControl> vipcontrol, BOOL indata)。这是独立的安全指纹命令；参数JSON为路径 battery.charging 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetVirBatteryManagerCharging`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_电池_设置电池充电状态(FBro浏览器1, "{}")
```


#### FBroVIP_电池_设置电池充电时间

- 签名：`FBroVIP_电池_设置电池充电时间(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetVirBatteryManagerChargingTime(CefRefPtr<FBroVIPControl> vipcontrol, double indata)。这是独立的安全指纹命令；参数JSON为路径 battery.chargingTime 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetVirBatteryManagerChargingTime`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_电池_设置电池充电时间(FBro浏览器1, "{}")
```


#### FBroVIP_电池_设置电池放电时间

- 签名：`FBroVIP_电池_设置电池放电时间(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetVirBatteryManagerDischargingTime(CefRefPtr<FBroVIPControl> vipcontrol, double indata)。这是独立的安全指纹命令；参数JSON为路径 battery.dischargingTime 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetVirBatteryManagerDischargingTime`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_电池_设置电池放电时间(FBro浏览器1, "{}")
```


#### FBroVIP_电池_设置电池电量

- 签名：`FBroVIP_电池_设置电池电量(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetVirBatteryManagerLevel(CefRefPtr<FBroVIPControl> vipcontrol, double indata)。这是独立的安全指纹命令；参数JSON为路径 battery.level 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetVirBatteryManagerLevel`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_电池_设置电池电量(FBro浏览器1, "{}")
```


### GPU 与 WebGL

#### FBroVIP_GPUWebGL_设置GPU架构

- 签名：`FBroVIP_GPUWebGL_设置GPU架构(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetVirGPUArchitecture(CefRefPtr<FBroVIPControl> vipcontrol, const CefString& indata)。这是独立的安全指纹命令；参数JSON为路径 gpuArchitecture 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetVirGPUArchitecture`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_GPUWebGL_设置GPU架构(FBro浏览器1, "{}")
```


#### FBroVIP_GPUWebGL_设置GPU描述

- 签名：`FBroVIP_GPUWebGL_设置GPU描述(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetVirGPUDescription(CefRefPtr<FBroVIPControl> vipcontrol, const CefString& indata)。这是独立的安全指纹命令；参数JSON为路径 gpuDescription 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetVirGPUDescription`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_GPUWebGL_设置GPU描述(FBro浏览器1, "{}")
```


#### FBroVIP_GPUWebGL_设置GPU设备

- 签名：`FBroVIP_GPUWebGL_设置GPU设备(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetVirGPUDevice(CefRefPtr<FBroVIPControl> vipcontrol, const CefString& indata)。这是独立的安全指纹命令；参数JSON为路径 gpuDevice 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetVirGPUDevice`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_GPUWebGL_设置GPU设备(FBro浏览器1, "{}")
```


#### FBroVIP_GPUWebGL_设置GPU限制

- 签名：`FBroVIP_GPUWebGL_设置GPU限制(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetVirGPULimits(CefRefPtr<FBroVIPControl> vipcontrol, int type, int64_t indata)。这是独立的安全指纹命令；参数JSON为路径 gpuLimits 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetVirGPULimits`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_GPUWebGL_设置GPU限制(FBro浏览器1, "{}")
```


#### FBroVIP_GPUWebGL_设置GPU子组最大值

- 签名：`FBroVIP_GPUWebGL_设置GPU子组最大值(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetVirGPUSubgroupMaxSize(CefRefPtr<FBroVIPControl> vipcontrol, unsigned indata)。这是独立的安全指纹命令；参数JSON为路径 gpuSubgroupMaxSize 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetVirGPUSubgroupMaxSize`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_GPUWebGL_设置GPU子组最大值(FBro浏览器1, "{}")
```


#### FBroVIP_GPUWebGL_设置GPU子组最小值

- 签名：`FBroVIP_GPUWebGL_设置GPU子组最小值(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetVirGPUSubgroupMinSize(CefRefPtr<FBroVIPControl> vipcontrol, unsigned indata)。这是独立的安全指纹命令；参数JSON为路径 gpuSubgroupMinSize 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetVirGPUSubgroupMinSize`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_GPUWebGL_设置GPU子组最小值(FBro浏览器1, "{}")
```


#### FBroVIP_GPUWebGL_设置GPU厂商

- 签名：`FBroVIP_GPUWebGL_设置GPU厂商(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetVirGPUVendor(CefRefPtr<FBroVIPControl> vipcontrol, const CefString& indata)。这是独立的安全指纹命令；参数JSON为路径 gpuVendor 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetVirGPUVendor`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_GPUWebGL_设置GPU厂商(FBro浏览器1, "{}")
```


#### FBroVIP_GPUWebGL_设置WebGL渲染器

- 签名：`FBroVIP_GPUWebGL_设置WebGL渲染器(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetVirWebglrenderer(CefRefPtr<FBroVIPControl> vipcontrol, const CefString& indata)。这是独立的安全指纹命令；参数JSON为路径 webglRenderer 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetVirWebglrenderer`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_GPUWebGL_设置WebGL渲染器(FBro浏览器1, "{}")
```


#### FBroVIP_GPUWebGL_设置WebGL厂商

- 签名：`FBroVIP_GPUWebGL_设置WebGL厂商(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetVirWebglvendor(CefRefPtr<FBroVIPControl> vipcontrol, const CefString& indata)。这是独立的安全指纹命令；参数JSON为路径 webglVendor 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetVirWebglvendor`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_GPUWebGL_设置WebGL厂商(FBro浏览器1, "{}")
```


#### FBroVIP_GPUWebGL_设置WebGL固定指纹

- 签名：`FBroVIP_GPUWebGL_设置WebGL固定指纹(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetWebGLFingerPrint_constant(CefRefPtr<FBroVIPControl> vipcontrol, const CefString& indata)。这是独立的安全指纹命令；参数JSON为路径 fingerprints.webgl.constant 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetWebGLFingerPrint_constant`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_GPUWebGL_设置WebGL固定指纹(FBro浏览器1, "{}")
```


#### FBroVIP_GPUWebGL_设置WebGL随机指纹

- 签名：`FBroVIP_GPUWebGL_设置WebGL随机指纹(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT CefRefPtr<FBroString> TEXPORTS FBroHsVIPControl_SetWebGLFingerPrint_random(CefRefPtr<FBroVIPControl> vipcontrol, int minipoint, int maxpoint, int srand)。这是独立的安全指纹命令；参数JSON为路径 fingerprints.webgl 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetWebGLFingerPrint_random`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_GPUWebGL_设置WebGL随机指纹(FBro浏览器1, "{}")
```


### 位置与时区

#### FBroVIP_位置时区_设置地理位置

- 签名：`FBroVIP_位置时区_设置地理位置(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetVirLongitudeAndLatitude(CefRefPtr<FBroVIPControl> vipcontrol, double longitude, double latitude, double altitude, double accuracy, double altitude_accuracy, double heading, double speed)。这是独立的安全指纹命令；参数JSON为路径 geolocation 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetVirLongitudeAndLatitude`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_位置时区_设置地理位置(FBro浏览器1, "{}")
```


#### FBroVIP_位置时区_设置时区

- 签名：`FBroVIP_位置时区_设置时区(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetVirTimeZone(CefRefPtr<FBroVIPControl> vipcontrol, int timezonehour, int timezonemin, const CefString& timezonename, const CefString& standardtimezonename)。这是独立的安全指纹命令；参数JSON为路径 timeZone 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetVirTimeZone`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_位置时区_设置时区(FBro浏览器1, "{}")
```


### User-Agent Data

#### FBroVIP_UserAgentData_设置UserAgentData

- 签名：`FBroVIP_UserAgentData_设置UserAgentData(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPControl_SetVirUserAgent(CefRefPtr<FBroVIPControl> vipcontrol, CefRefPtr<FBroVIPUserAgentData> userAgentData)。这是独立的安全指纹命令；参数JSON为路径 userAgent 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPControl_SetVirUserAgent`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_UserAgentData_设置UserAgentData(FBro浏览器1, "{}")
```


#### FBroVIP_UserAgentData_创建UserAgentData

- 签名：`FBroVIP_UserAgentData_创建UserAgentData(控件名, 参数JSON)`
- 返回值：文本型
- 说明：官方接口：DLLEXPORT CefRefPtr<FBroVIPUserAgentData> TEXPORTS FBroHsVIPUserAgentData_Create()。该项由 LingBuilder FBro Bridge 自动管理，详情命令返回托管说明，不暴露 SDK 对象、CefRefPtr 或生命周期指针。
- 别名：`FBroHsVIPUserAgentData_Create`（兼容旧写法，生成代码使用主名）。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_UserAgentData_创建UserAgentData(FBro浏览器1, "{}")
```


#### FBroVIP_UserAgent_取架构

- 签名：`FBroVIP_UserAgent_取架构(控件名, 参数JSON)`
- 返回值：文本型
- 说明：官方接口：DLLEXPORT CefRefPtr<FBroString> TEXPORTS FBroHsVIPUserAgentData_GetArchitecture(CefRefPtr<FBroVIPUserAgentData> userAgentData)。返回最近一次已应用配置 JSON，可直接读取该 User-Agent Data 字段；不返回 SDK 对象。
- 别名：`FBroHsVIPUserAgentData_GetArchitecture`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_UserAgent_取架构(FBro浏览器1, "{}")
```


#### FBroVIP_UserAgent_取系统位数

- 签名：`FBroVIP_UserAgent_取系统位数(控件名, 参数JSON)`
- 返回值：文本型
- 说明：官方接口：DLLEXPORT CefRefPtr<FBroString> TEXPORTS FBroHsVIPUserAgentData_GetBitness(CefRefPtr<FBroVIPUserAgentData> userAgentData)。返回最近一次已应用配置 JSON，可直接读取该 User-Agent Data 字段；不返回 SDK 对象。
- 别名：`FBroHsVIPUserAgentData_GetBitness`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_UserAgent_取系统位数(FBro浏览器1, "{}")
```


#### FBroVIP_UserAgent_取品牌列表

- 签名：`FBroVIP_UserAgent_取品牌列表(控件名, 参数JSON)`
- 返回值：文本型
- 说明：官方接口：DLLEXPORT CefRefPtr<FBroDoubleString> TEXPORTS FBroHsVIPUserAgentData_GetBrands(CefRefPtr<FBroVIPUserAgentData> userAgentData)。返回最近一次已应用配置 JSON，可直接读取该 User-Agent Data 字段；不返回 SDK 对象。
- 别名：`FBroHsVIPUserAgentData_GetBrands`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_UserAgent_取品牌列表(FBro浏览器1, "{}")
```


#### FBroVIP_UserAgent_取设备形态列表

- 签名：`FBroVIP_UserAgent_取设备形态列表(控件名, 参数JSON)`
- 返回值：文本型
- 说明：官方接口：DLLEXPORT CefRefPtr<FBroCefStringList> TEXPORTS FBroHsVIPUserAgentData_GetFormFactors(CefRefPtr<FBroVIPUserAgentData> userAgentData)。返回最近一次已应用配置 JSON，可直接读取该 User-Agent Data 字段；不返回 SDK 对象。
- 别名：`FBroHsVIPUserAgentData_GetFormFactors`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_UserAgent_取设备形态列表(FBro浏览器1, "{}")
```


#### FBroVIP_UserAgent_取完整版本

- 签名：`FBroVIP_UserAgent_取完整版本(控件名, 参数JSON)`
- 返回值：文本型
- 说明：官方接口：DLLEXPORT CefRefPtr<FBroString> TEXPORTS FBroHsVIPUserAgentData_GetFullVersion(CefRefPtr<FBroVIPUserAgentData> userAgentData)。返回最近一次已应用配置 JSON，可直接读取该 User-Agent Data 字段；不返回 SDK 对象。
- 别名：`FBroHsVIPUserAgentData_GetFullVersion`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_UserAgent_取完整版本(FBro浏览器1, "{}")
```


#### FBroVIP_UserAgent_取完整版本列表

- 签名：`FBroVIP_UserAgent_取完整版本列表(控件名, 参数JSON)`
- 返回值：文本型
- 说明：官方接口：DLLEXPORT CefRefPtr<FBroDoubleString> TEXPORTS FBroHsVIPUserAgentData_GetFullVersionList(CefRefPtr<FBroVIPUserAgentData> userAgentData)。返回最近一次已应用配置 JSON，可直接读取该 User-Agent Data 字段；不返回 SDK 对象。
- 别名：`FBroHsVIPUserAgentData_GetFullVersionList`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_UserAgent_取完整版本列表(FBro浏览器1, "{}")
```


#### FBroVIP_UserAgent_取主接受语言

- 签名：`FBroVIP_UserAgent_取主接受语言(控件名, 参数JSON)`
- 返回值：文本型
- 说明：官方接口：DLLEXPORT CefRefPtr<FBroString> TEXPORTS FBroHsVIPUserAgentData_GetMainAcceptLanguage(CefRefPtr<FBroVIPUserAgentData> userAgentData)。返回最近一次已应用配置 JSON，可直接读取该 User-Agent Data 字段；不返回 SDK 对象。
- 别名：`FBroHsVIPUserAgentData_GetMainAcceptLanguage`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_UserAgent_取主接受语言(FBro浏览器1, "{}")
```


#### FBroVIP_UserAgent_取主平台

- 签名：`FBroVIP_UserAgent_取主平台(控件名, 参数JSON)`
- 返回值：文本型
- 说明：官方接口：DLLEXPORT CefRefPtr<FBroString> TEXPORTS FBroHsVIPUserAgentData_GetMainPlatform(CefRefPtr<FBroVIPUserAgentData> userAgentData)。返回最近一次已应用配置 JSON，可直接读取该 User-Agent Data 字段；不返回 SDK 对象。
- 别名：`FBroHsVIPUserAgentData_GetMainPlatform`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_UserAgent_取主平台(FBro浏览器1, "{}")
```


#### FBroVIP_UserAgent_取主UserAgent

- 签名：`FBroVIP_UserAgent_取主UserAgent(控件名, 参数JSON)`
- 返回值：文本型
- 说明：官方接口：DLLEXPORT CefRefPtr<FBroString> TEXPORTS FBroHsVIPUserAgentData_GetMainUserAgent(CefRefPtr<FBroVIPUserAgentData> userAgentData)。返回最近一次已应用配置 JSON，可直接读取该 User-Agent Data 字段；不返回 SDK 对象。
- 别名：`FBroHsVIPUserAgentData_GetMainUserAgent`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_UserAgent_取主UserAgent(FBro浏览器1, "{}")
```


#### FBroVIP_UserAgent_取移动设备标记

- 签名：`FBroVIP_UserAgent_取移动设备标记(控件名, 参数JSON)`
- 返回值：文本型
- 说明：官方接口：DLLEXPORT BOOL TEXPORTS FBroHsVIPUserAgentData_GetMobile(CefRefPtr<FBroVIPUserAgentData> userAgentData)。返回最近一次已应用配置 JSON，可直接读取该 User-Agent Data 字段；不返回 SDK 对象。
- 别名：`FBroHsVIPUserAgentData_GetMobile`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_UserAgent_取移动设备标记(FBro浏览器1, "{}")
```


#### FBroVIP_UserAgent_取设备型号

- 签名：`FBroVIP_UserAgent_取设备型号(控件名, 参数JSON)`
- 返回值：文本型
- 说明：官方接口：DLLEXPORT CefRefPtr<FBroString> TEXPORTS FBroHsVIPUserAgentData_GetModel(CefRefPtr<FBroVIPUserAgentData> userAgentData)。返回最近一次已应用配置 JSON，可直接读取该 User-Agent Data 字段；不返回 SDK 对象。
- 别名：`FBroHsVIPUserAgentData_GetModel`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_UserAgent_取设备型号(FBro浏览器1, "{}")
```


#### FBroVIP_UserAgent_取平台

- 签名：`FBroVIP_UserAgent_取平台(控件名, 参数JSON)`
- 返回值：文本型
- 说明：官方接口：DLLEXPORT CefRefPtr<FBroString> TEXPORTS FBroHsVIPUserAgentData_GetPlatform(CefRefPtr<FBroVIPUserAgentData> userAgentData)。返回最近一次已应用配置 JSON，可直接读取该 User-Agent Data 字段；不返回 SDK 对象。
- 别名：`FBroHsVIPUserAgentData_GetPlatform`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_UserAgent_取平台(FBro浏览器1, "{}")
```


#### FBroVIP_UserAgent_取平台版本

- 签名：`FBroVIP_UserAgent_取平台版本(控件名, 参数JSON)`
- 返回值：文本型
- 说明：官方接口：DLLEXPORT CefRefPtr<FBroString> TEXPORTS FBroHsVIPUserAgentData_GetPlatformVersion(CefRefPtr<FBroVIPUserAgentData> userAgentData)。返回最近一次已应用配置 JSON，可直接读取该 User-Agent Data 字段；不返回 SDK 对象。
- 别名：`FBroHsVIPUserAgentData_GetPlatformVersion`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_UserAgent_取平台版本(FBro浏览器1, "{}")
```


#### FBroVIP_UserAgent_取WOW64标记

- 签名：`FBroVIP_UserAgent_取WOW64标记(控件名, 参数JSON)`
- 返回值：文本型
- 说明：官方接口：DLLEXPORT BOOL TEXPORTS FBroHsVIPUserAgentData_GetWow64(CefRefPtr<FBroVIPUserAgentData> userAgentData)。返回最近一次已应用配置 JSON，可直接读取该 User-Agent Data 字段；不返回 SDK 对象。
- 别名：`FBroHsVIPUserAgentData_GetWow64`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_UserAgent_取WOW64标记(FBro浏览器1, "{}")
```


#### FBroVIP_UserAgent_设置架构

- 签名：`FBroVIP_UserAgent_设置架构(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPUserAgentData_SetArchitecture(CefRefPtr<FBroVIPUserAgentData> userAgentData, const CefString& indata)。这是独立的安全指纹命令；参数JSON为路径 userAgent.architecture 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPUserAgentData_SetArchitecture`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_UserAgent_设置架构(FBro浏览器1, "{}")
```


#### FBroVIP_UserAgent_设置系统位数

- 签名：`FBroVIP_UserAgent_设置系统位数(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPUserAgentData_SetBitness(CefRefPtr<FBroVIPUserAgentData> userAgentData, const CefString& indata)。这是独立的安全指纹命令；参数JSON为路径 userAgent.bitness 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPUserAgentData_SetBitness`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_UserAgent_设置系统位数(FBro浏览器1, "{}")
```


#### FBroVIP_UserAgent_设置品牌列表

- 签名：`FBroVIP_UserAgent_设置品牌列表(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPUserAgentData_SetBrands(CefRefPtr<FBroVIPUserAgentData> userAgentData, CefRefPtr<FBroDoubleString> indata)。这是独立的安全指纹命令；参数JSON为路径 userAgent.brands 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPUserAgentData_SetBrands`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_UserAgent_设置品牌列表(FBro浏览器1, "{}")
```


#### FBroVIP_UserAgent_设置设备形态列表

- 签名：`FBroVIP_UserAgent_设置设备形态列表(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPUserAgentData_SetFormFactors(CefRefPtr<FBroVIPUserAgentData> userAgentData, CefRefPtr<FBroCefStringList> indata)。这是独立的安全指纹命令；参数JSON为路径 userAgent.formFactors 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPUserAgentData_SetFormFactors`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_UserAgent_设置设备形态列表(FBro浏览器1, "{}")
```


#### FBroVIP_UserAgent_设置完整版本

- 签名：`FBroVIP_UserAgent_设置完整版本(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPUserAgentData_SetFullVersion(CefRefPtr<FBroVIPUserAgentData> userAgentData, const CefString& indata)。这是独立的安全指纹命令；参数JSON为路径 userAgent.fullVersion 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPUserAgentData_SetFullVersion`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_UserAgent_设置完整版本(FBro浏览器1, "{}")
```


#### FBroVIP_UserAgent_设置完整版本列表

- 签名：`FBroVIP_UserAgent_设置完整版本列表(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPUserAgentData_SetFullVersionList(CefRefPtr<FBroVIPUserAgentData> userAgentData, CefRefPtr<FBroDoubleString> indata)。这是独立的安全指纹命令；参数JSON为路径 userAgent.fullVersionList 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPUserAgentData_SetFullVersionList`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_UserAgent_设置完整版本列表(FBro浏览器1, "{}")
```


#### FBroVIP_UserAgent_设置主接受语言

- 签名：`FBroVIP_UserAgent_设置主接受语言(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPUserAgentData_SetMainAcceptLanguage(CefRefPtr<FBroVIPUserAgentData> userAgentData, const CefString& indata)。这是独立的安全指纹命令；参数JSON为路径 userAgent.mainAcceptLanguage 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPUserAgentData_SetMainAcceptLanguage`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_UserAgent_设置主接受语言(FBro浏览器1, "{}")
```


#### FBroVIP_UserAgent_设置主平台

- 签名：`FBroVIP_UserAgent_设置主平台(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPUserAgentData_SetMainPlatform(CefRefPtr<FBroVIPUserAgentData> userAgentData, const CefString& indata)。这是独立的安全指纹命令；参数JSON为路径 userAgent.mainPlatform 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPUserAgentData_SetMainPlatform`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_UserAgent_设置主平台(FBro浏览器1, "{}")
```


#### FBroVIP_UserAgent_设置主UserAgent

- 签名：`FBroVIP_UserAgent_设置主UserAgent(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPUserAgentData_SetMainUserAgent(CefRefPtr<FBroVIPUserAgentData> userAgentData, const CefString& indata)。这是独立的安全指纹命令；参数JSON为路径 userAgent.mainUserAgent 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPUserAgentData_SetMainUserAgent`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_UserAgent_设置主UserAgent(FBro浏览器1, "{}")
```


#### FBroVIP_UserAgent_设置移动设备标记

- 签名：`FBroVIP_UserAgent_设置移动设备标记(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPUserAgentData_SetMobile(CefRefPtr<FBroVIPUserAgentData> userAgentData, BOOL indata)。这是独立的安全指纹命令；参数JSON为路径 userAgent.mobile 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPUserAgentData_SetMobile`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_UserAgent_设置移动设备标记(FBro浏览器1, "{}")
```


#### FBroVIP_UserAgent_设置设备型号

- 签名：`FBroVIP_UserAgent_设置设备型号(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPUserAgentData_SetModel(CefRefPtr<FBroVIPUserAgentData> userAgentData, const CefString& indata)。这是独立的安全指纹命令；参数JSON为路径 userAgent.model 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPUserAgentData_SetModel`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_UserAgent_设置设备型号(FBro浏览器1, "{}")
```


#### FBroVIP_UserAgent_设置平台

- 签名：`FBroVIP_UserAgent_设置平台(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPUserAgentData_SetPlatform(CefRefPtr<FBroVIPUserAgentData> userAgentData, const CefString& indata)。这是独立的安全指纹命令；参数JSON为路径 userAgent.platform 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPUserAgentData_SetPlatform`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_UserAgent_设置平台(FBro浏览器1, "{}")
```


#### FBroVIP_UserAgent_设置平台版本

- 签名：`FBroVIP_UserAgent_设置平台版本(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPUserAgentData_SetPlatformVersion(CefRefPtr<FBroVIPUserAgentData> userAgentData, const CefString& indata)。这是独立的安全指纹命令；参数JSON为路径 userAgent.platformVersion 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPUserAgentData_SetPlatformVersion`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_UserAgent_设置平台版本(FBro浏览器1, "{}")
```


#### FBroVIP_UserAgent_设置WOW64标记

- 签名：`FBroVIP_UserAgent_设置WOW64标记(控件名, 参数JSON)`
- 返回值：整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPUserAgentData_SetWow64(CefRefPtr<FBroVIPUserAgentData> userAgentData, BOOL indata)。这是独立的安全指纹命令；参数JSON为路径 userAgent.wow64 对应的完整 JSON 值，Bridge 仍使用 UTF-16 JSON 和受控 VIP 实例。
- 别名：`FBroHsVIPUserAgentData_SetWow64`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_UserAgent_设置WOW64标记(FBro浏览器1, "{}")
```


### 浏览器扩展

#### FBroVIP_浏览器扩展_启用扩展增强

- 签名：`FBroVIP_浏览器扩展_启用扩展增强(控件名, 参数JSON)`
- 返回值：长整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPRequestContext_EnableExtensionPlus()。命令名已固定官方动作，调用时只需传参数JSON，不再手工填写分发命令字符串；异步结果使用 FBro任务_* 读取。
- 别名：`FBroHsVIPRequestContext_EnableExtensionPlus`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_浏览器扩展_启用扩展增强(FBro浏览器1, "{}")
```


#### FBroVIP_浏览器扩展_取扩展名称

- 签名：`FBroVIP_浏览器扩展_取扩展名称(控件名, 参数JSON)`
- 返回值：长整数型
- 说明：官方接口：DLLEXPORT CefRefPtr<FBroString> TEXPORTS FBroHsVIPRequestContext_GetExtensionName(CefRefPtr<CefRequestContext> requestContext, const CefString& extensionID)。命令名已固定官方动作，调用时只需传参数JSON，不再手工填写分发命令字符串；异步结果使用 FBro任务_* 读取。
- 别名：`FBroHsVIPRequestContext_GetExtensionName`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_浏览器扩展_取扩展名称(FBro浏览器1, "{}")
```


#### FBroVIP_浏览器扩展_取扩展路径

- 签名：`FBroVIP_浏览器扩展_取扩展路径(控件名, 参数JSON)`
- 返回值：长整数型
- 说明：官方接口：DLLEXPORT CefRefPtr<FBroString> TEXPORTS FBroHsVIPRequestContext_GetExtensionPath(CefRefPtr<CefRequestContext> requestContext, const CefString& extensionID)。命令名已固定官方动作，调用时只需传参数JSON，不再手工填写分发命令字符串；异步结果使用 FBro任务_* 读取。
- 别名：`FBroHsVIPRequestContext_GetExtensionPath`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_浏览器扩展_取扩展路径(FBro浏览器1, "{}")
```


#### FBroVIP_浏览器扩展_取扩展地址

- 签名：`FBroVIP_浏览器扩展_取扩展地址(控件名, 参数JSON)`
- 返回值：长整数型
- 说明：官方接口：DLLEXPORT CefRefPtr<FBroString> TEXPORTS FBroHsVIPRequestContext_GetExtensionURL(CefRefPtr<CefRequestContext> requestContext, const CefString& extensionID)。命令名已固定官方动作，调用时只需传参数JSON，不再手工填写分发命令字符串；异步结果使用 FBro任务_* 读取。
- 别名：`FBroHsVIPRequestContext_GetExtensionURL`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_浏览器扩展_取扩展地址(FBro浏览器1, "{}")
```


#### FBroVIP_浏览器扩展_安装CRX

- 签名：`FBroVIP_浏览器扩展_安装CRX(控件名, 参数JSON)`
- 返回值：长整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPRequestContext_InstallCrx(CefRefPtr<CefRequestContext> requestContext, const CefString& filePath)。命令名已固定官方动作，调用时只需传参数JSON，不再手工填写分发命令字符串；异步结果使用 FBro任务_* 读取。
- 别名：`FBroHsVIPRequestContext_InstallCrx`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_浏览器扩展_安装CRX(FBro浏览器1, "{}")
```


#### FBroVIP_浏览器扩展_加载扩展目录

- 签名：`FBroVIP_浏览器扩展_加载扩展目录(控件名, 参数JSON)`
- 返回值：长整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPRequestContext_LoadExtension(CefRefPtr<CefRequestContext> requestContext, const CefString& path)。命令名已固定官方动作，调用时只需传参数JSON，不再手工填写分发命令字符串；异步结果使用 FBro任务_* 读取。
- 别名：`FBroHsVIPRequestContext_LoadExtension`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_浏览器扩展_加载扩展目录(FBro浏览器1, "{}")
```


#### FBroVIP_浏览器扩展_卸载扩展

- 签名：`FBroVIP_浏览器扩展_卸载扩展(控件名, 参数JSON)`
- 返回值：长整数型
- 说明：官方接口：DLLEXPORT void TEXPORTS FBroHsVIPRequestContext_UnstallExtension(CefRefPtr<CefRequestContext> requestContext, const CefString& extensionID)。命令名已固定官方动作，调用时只需传参数JSON，不再手工填写分发命令字符串；异步结果使用 FBro任务_* 读取。
- 别名：`FBroHsVIPRequestContext_UnstallExtension`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 参数JSON（文本型）：该固定接口的 UTF-16 JSON 参数；无参数时传 {}。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。
- 示例：

```
FBroVIP_浏览器扩展_卸载扩展(FBro浏览器1, "{}")
```


### 批量与通用高级入口

#### FBroVIP_应用指纹JSON

- 签名：`FBroVIP_应用指纹JSON(控件名, JSON)`
- 返回值：整数型
- 说明：通过 UTF-16 JSON 批量应用完整直接指纹配置，覆盖浏览器、屏幕、GPU、WebRTC、时区、电池、位置、设备、Canvas/WebGL/Audio 和 User-Agent Data；不会暴露 Key。
- 别名：`LB_FBro_ApplyFingerprintJson`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - JSON（文本型）：完整指纹配置 JSON 文本，键见模块文档。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。

#### FBroVIP_取已应用配置JSON

- 签名：`FBroVIP_取已应用配置JSON(控件名)`
- 返回值：文本型
- 说明：取得最近一次成功应用的规范化指纹配置与 User-Agent Data JSON。
- 别名：`LB_FBro_GetAppliedFingerprintJson`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。

#### FBroVIP_取授权信息JSON

- 签名：`FBroVIP_取授权信息JSON()`
- 返回值：文本型
- 说明：读取脱敏的 VIP 授权状态、版本、授权范围和有效期；不返回 Key。
- 别名：`LB_FBro_GetVipLicenseInfoJson`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。

#### FBroVIP_取调用次数

- 签名：`FBroVIP_取调用次数(控件名)`
- 返回值：文本型
- 说明：查询 VIP 指纹调用次数。
- 别名：`LB_FBro_GetFingerprintCallCount`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。

#### FBroVIP_清空调用次数

- 签名：`FBroVIP_清空调用次数(控件名)`
- 返回值：整数型
- 说明：清空 VIP 指纹调用次数。
- 别名：`LB_FBro_ClearFingerprintCallCount`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。

#### FBroVIP_DOM异步命令

- 签名：`FBroVIP_DOM异步命令(控件名, 命令, 参数JSON)`
- 返回值：长整数型
- 说明：DOM 批量高级分发入口；单项 DOM 命令已经在 DOM 分类中分别公开。
- 别名：`LB_FBro_VipDomCommandAsync`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 命令（文本型）：要执行的 VIP 子命令名，取值见对应分类的单项命令文档。
  - 参数JSON（文本型）：子命令参数 JSON 对象文本。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。

#### FBroVIP_扩展异步命令

- 签名：`FBroVIP_扩展异步命令(控件名, 命令, 参数JSON)`
- 返回值：长整数型
- 说明：扩展批量高级分发入口；文件路径必须位于生成程序目录内。
- 别名：`LB_FBro_VipExtensionCommandAsync`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 命令（文本型）：要执行的 VIP 子命令名，取值见对应分类的单项命令文档。
  - 参数JSON（文本型）：子命令参数 JSON 对象文本。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。

#### FBroVIP_资源规则异步命令

- 签名：`FBroVIP_资源规则异步命令(控件名, 命令, 参数JSON)`
- 返回值：长整数型
- 说明：资源与响应规则批量高级分发入口；二进制数据只接受 FBro 受管缓冲句柄。
- 别名：`LB_FBro_VipResourceCommandAsync`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 命令（文本型）：要执行的 VIP 子命令名，取值见对应分类的单项命令文档。
  - 参数JSON（文本型）：子命令参数 JSON 对象文本。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。

#### FBroVIP_开发者工具异步命令

- 签名：`FBroVIP_开发者工具异步命令(控件名, 命令, 参数JSON)`
- 返回值：长整数型
- 说明：DevTools、Runtime 与输入批量高级分发入口；单项命令已经分别公开。
- 别名：`LB_FBro_VipDevToolsCommandAsync`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 控件名（控件引用）：裸写的可视控件或设计器资源名称（不能加引号），只在当前窗口内解析、且类型必须是 FBroBrowser、FBroHeadlessBrowser；生成 C++ 时按对象名定位。对象不存在、同名歧义或类型不兼容会给出中文诊断，按住 Ctrl 单击可跳转到设计器选中该对象。
  - 命令（文本型）：要执行的 VIP 子命令名，取值见对应分类的单项命令文档。
  - 参数JSON（文本型）：子命令参数 JSON 对象文本。
  - 控件引用参数必须传设计器中的裸控件名（不带引号），例如 `控件_设置文本(操作结果, "完成")`。

#### FBroVIP_设置启动代理

- 签名：`FBroVIP_设置启动代理(地址, 用户名, 密码)`
- 返回值：整数型
- 说明：配置 VIP 启动代理；必须在首个 FBro 运行时初始化前调用，凭据只保存在 Bridge 内存中。
- 别名：`LB_FBro_SetVipStartupProxy`（兼容旧写法，生成代码使用主名）。
- 高级命令：需在设置中开启「显示高级 API」后才会进入补全。
- 参数：
  - 地址（文本型）：启动代理地址，格式 "scheme://host:port"。
  - 用户名（文本型）：启动代理认证用户名。
  - 密码（文本型）：启动代理认证密码。

### 全部命令

#### FBroVIP_实例设置新窗口转标签页

- 签名：`FBroVIP_实例设置新窗口转标签页(实例句柄, 开关)`
- 返回值：整数型
- 说明：开启后（开关传 1，传 0 关闭），该实例内的新窗口（target=_blank、window.open）在 Chrome 原生UI 实例中自动转为本窗口新标签页（等价官方 C# OnBeforePopup+AddTabAt 示例），不再走"当前页加载"兜底；FBro_实例打开原生UI 弹出的窗口继承来源实例的开关，也可以直接把开关设置在弹窗句柄上。仅进程内实例有效；VIP 控制器不可用时自动回落当前页加载。
- 别名：`LB_FBro_SetPopupToTab`（兼容旧写法，生成代码使用主名）。
- 参数：
  - 实例句柄（长整数型）：FBro_后台创建 或 FBro_实例打开原生UI 返回的后台/弹窗实例句柄。
  - 开关（整数型）：1 开启新窗口转标签页，0 关闭（随实例销毁失效）。

#### FBroVIP_实例应用指纹JSON

- 签名：`FBroVIP_实例应用指纹JSON(实例句柄, JSON)`
- 返回值：整数型
- 说明：对 FBro_后台创建 / FBro_实例打开原生UI 返回的后台实例或弹窗句柄批量应用完整直接指纹配置，JSON 契约与 FBroVIP_应用指纹JSON 完全一致；指纹设置按浏览器生效，弹窗与来源实例共用缓存目录但是两个浏览器，需要各自应用一次。实例句柄无效返回 -1，浏览器尚未就绪返回 -1（可延迟重试），VIP 授权校验失败返回 -5、VIP 控制器不可用返回 -4。
- 参数：
  - 实例句柄（长整数型）：FBro_后台创建 或 FBro_实例打开原生UI 返回的后台/弹窗实例句柄。
  - JSON（文本型）：完整指纹配置 JSON 文本，键见模块文档。

## 构建与运行依赖

**目标 windows-msvc-x64**


## 更多帮助

- 在 IDE 中打开本模块详情页（模块面板点击模块名称），「接口」页签可搜索全部命令与参数说明。
- 命令行为以 IDE 内补全与悬停提示为准，二者与本文同源于模块清单。
