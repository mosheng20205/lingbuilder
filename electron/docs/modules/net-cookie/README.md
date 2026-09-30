<!-- 本文档由 electron/scripts/generate-builtin-module-docs.ts 从模块清单自动生成（npm run module:builtin-docs）。手工编辑会被覆盖；要接管维护，请把 contributes.docs 写回模块清单并从 builtinModuleDocuments.ts 移除该模块，再改写本文档。 -->

# Cookie文本模块使用说明

| 项目 | 内容 |
| --- | --- |
| 模块 ID | `lingbuilder.net.cookie` |
| 版本 | 1.0.0 |
| 分类 | 网络 |
| 命令数 | 8 |

提供 Cookie 请求头文本的读取、设置、删除和存在性检查，并支持把 Cookie 记录集导出为 Netscape cookies.txt 与 EditThisCookie JSON 两种通用格式。

## 启用方式

本模块为 LingBuilder 内置模块，随 IDE 一起分发，无需单独安装。在「模块」面板或解决方案树的模块节点确认其处于「已启用」状态后，即可在当前项目的 `.lcpp` 代码中直接调用下列命令；未启用时语言服务会给出带启用路径的中文诊断。

## 命令参考（共 8 条）

### 全部命令

#### Cookie_取值

- 签名：`Cookie_取值(Cookie文本, 名称)`
- 返回值：文本型
- 说明：读取 Cookie 请求头中的指定值。
- 参数：
  - Cookie文本（文本型）：请求头形式的 Cookie 文本，形如 a=1; b=2；按分号拆分并去掉每项两端空白，不含等号的片段会被忽略。
  - 名称（文本型）：要操作的 Cookie 名称，区分大小写。不存在时返回空文本。

#### Cookie_是否存在

- 签名：`Cookie_是否存在(Cookie文本, 名称)`
- 返回值：逻辑型
- 说明：判断 Cookie 名称是否存在。
- 参数：
  - Cookie文本（文本型）：请求头形式的 Cookie 文本，形如 a=1; b=2；按分号拆分并去掉每项两端空白，不含等号的片段会被忽略。
  - 名称（文本型）：要操作的 Cookie 名称，区分大小写。

#### Cookie_设置

- 签名：`Cookie_设置(Cookie文本, 名称, 值)`
- 返回值：文本型
- 说明：添加或替换 Cookie 值。
- 参数：
  - Cookie文本（文本型）：请求头形式的 Cookie 文本，形如 a=1; b=2；按分号拆分并去掉每项两端空白，不含等号的片段会被忽略。
  - 名称（文本型）：要操作的 Cookie 名称，区分大小写。
  - 值（文本型）：新的 Cookie 值；不能包含分号，否则重新解析时会被截断。

#### Cookie_删除

- 签名：`Cookie_删除(Cookie文本, 名称)`
- 返回值：文本型
- 说明：删除指定 Cookie。
- 参数：
  - Cookie文本（文本型）：请求头形式的 Cookie 文本，形如 a=1; b=2；按分号拆分并去掉每项两端空白，不含等号的片段会被忽略。
  - 名称（文本型）：要操作的 Cookie 名称，区分大小写。名称不存在时返回原文本。

#### Cookie_生成响应项

- 签名：`Cookie_生成响应项(名称, 值, 路径, 最大秒数)`
- 返回值：文本型
- 说明：生成一条 Set-Cookie 响应值。
- 参数：
  - 名称（文本型）：Set-Cookie 左侧的 Cookie 名称。
  - 值（文本型）：Cookie 值，直接拼接不做转义，不能包含分号。
  - 路径（文本型）：Cookie 的 Path 属性；空文本时不输出 Path。
  - 最大秒数（整数型）：Max-Age 秒数；小于 0 时不输出 Max-Age。生成的响应项固定附带 HttpOnly 和 SameSite=Lax。

#### Cookie_导出Netscape

- 签名：`Cookie_导出Netscape(Cookie数组JSON)`
- 返回值：文本型
- 说明：把 Cookie 记录集导出为Netscape cookies.txt（curl / wget / yt-dlp 与 Python MozillaCookieJar 可直接读取）；按字段别名自动归一 Chromium 与浏览器扩展两种写法，域名或名称缺失、JSON 语法错误时返回空文本并用 Cookie_取错误 读取中文原因。
- 参数：
  - Cookie数组JSON（文本型）：由扁平 Cookie 对象组成的 JSON 数组文本，一次传入全部记录；也接受单个对象。值只能是字符串、数字、逻辑值或 null，出现嵌套对象/数组视为格式错误。字段名两套写法自动识别：域名取 domain / host_key / host；名称取 name；值取 value；路径取 path（缺省 "/"）；安全位取 secure / is_secure、HttpOnly 位取 httpOnly / is_httponly（数字按 ≠0 为真，字符串 "1"/"true" 也为真）；过期时间优先取 expirationDate（已是 Unix 秒，可为小数，原样保留），否则取 expires_utc（Chromium 自 1601-01-01 起的微秒整数，按整数换算为 Unix 秒，不经过双精度以免丢失小数位）；两者都缺省、为 0 或换算结果不晚于 1601 年视为会话 Cookie。hostOnly 显式给出则照用，否则按域名不以英文句点开头推导；sameSite 为字符串时原样输出（no_restriction / lax / strict / unspecified），为数字时按 Chromium 枚举映射：-1 输出 null、0 输出 no_restriction、1 输出 lax、2 输出 strict；storeId 是 Firefox 专有字段，导出时固定为 null；Netscape 格式的 includeSubDomains 列由域名是否以句点开头写成 TRUE/FALSE。
- 示例：

```
Cookie_导出Netscape(Cookie数组JSON)
```


#### Cookie_导出EditThisCookieJSON

- 签名：`Cookie_导出EditThisCookieJSON(Cookie数组JSON)`
- 返回值：文本型
- 说明：把 Cookie 记录集导出为EditThisCookie JSON 数组（可直接粘贴进浏览器 Cookie 导入器）；按字段别名自动归一 Chromium 与浏览器扩展两种写法，域名或名称缺失、JSON 语法错误时返回空文本并用 Cookie_取错误 读取中文原因。
- 参数：
  - Cookie数组JSON（文本型）：由扁平 Cookie 对象组成的 JSON 数组文本，一次传入全部记录；也接受单个对象。值只能是字符串、数字、逻辑值或 null，出现嵌套对象/数组视为格式错误。字段名两套写法自动识别：域名取 domain / host_key / host；名称取 name；值取 value；路径取 path（缺省 "/"）；安全位取 secure / is_secure、HttpOnly 位取 httpOnly / is_httponly（数字按 ≠0 为真，字符串 "1"/"true" 也为真）；过期时间优先取 expirationDate（已是 Unix 秒，可为小数，原样保留），否则取 expires_utc（Chromium 自 1601-01-01 起的微秒整数，按整数换算为 Unix 秒，不经过双精度以免丢失小数位）；两者都缺省、为 0 或换算结果不晚于 1601 年视为会话 Cookie。hostOnly 显式给出则照用，否则按域名不以英文句点开头推导；sameSite 为字符串时原样输出（no_restriction / lax / strict / unspecified），为数字时按 Chromium 枚举映射：-1 输出 null、0 输出 no_restriction、1 输出 lax、2 输出 strict；storeId 是 Firefox 专有字段，导出时固定为 null；Netscape 格式的 includeSubDomains 列由域名是否以句点开头写成 TRUE/FALSE。
- 示例：

```
Cookie_导出EditThisCookieJSON(Cookie数组JSON)
```


#### Cookie_取错误

- 签名：`Cookie_取错误()`
- 返回值：文本型
- 说明：返回最近一次 Cookie 导出失败的中文错误；解析成功会清空该错误。

## 代码片段（共 1 条）

### Cookie文本模块快速示例

插入Cookie文本模块的基础调用示例。

```
Cookie_取值("", "")
Cookie_是否存在("", "")
```

## 构建与运行依赖

**目标 windows-msvc-win32**


**目标 windows-msvc-x64**


## 更多帮助

- 在 IDE 中打开本模块详情页（模块面板点击模块名称），「接口」页签可搜索全部命令与参数说明。
- 命令行为以 IDE 内补全与悬停提示为准，二者与本文同源于模块清单。
