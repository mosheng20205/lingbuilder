---
title: EdgeView 浏览器模块
---

# EdgeView 浏览器模块

> [🕒 预计 8 分钟] | 难度：入门

EdgeView 基于 Microsoft Edge WebView2，把完整的 Edge 浏览器嵌入你的 Win32 窗口，提供导航、网页消息、JavaScript 返回值、71 项浏览器事件和约 220 条中文命令，覆盖任务、导航、脚本、会话、下载、查找、打印、开发者工具等 20 个功能族。

| 项目 | 说明 |
|---|---|
| 模块 ID | `lingbuilder.edgeview` |
| 设计器控件 | **Edge浏览器** |
| SDK 依赖 | 无需下载大型 SDK（依赖系统 WebView2 Runtime，Windows 10/11 一般已内置） |
| 平台 | Windows（Win32 / x64，MSVC 工具链） |

## 启用模块

打开活动栏「模块」页，在模块市场或本地模块中找到 **EdgeView 浏览器模块**，确认安装并加入当前项目；也可以在解决方案资源管理器项目节点下右键「模块」→「配置项目所使用模块」勾选。详细步骤见[安装与管理模块](/guide/user/modules/install-module)。

## 设计器控件

在窗口设计器工具箱的模块分组中找到 **Edge浏览器** 控件，拖到窗口上即可。控件在运行时由模块创建并挂载到控件区域；也可以不拖控件，直接用 `EdgeView_创建` 在代码中创建。

## 快速上手

在窗口的「创建完毕」事件里绑定事件并导航（示例沿用官方示例工程的写法）：

```text
包 EdgeView演示
使用 Win32窗口基础模块
使用 EdgeView浏览器模块

类 MainWindow : 窗口
公开
  事件 _MainWindow_创建完毕()
    局部 整数型 绑定结果 = 0
    绑定结果 = EdgeView_绑定控件事件(演示浏览器, "Web资源请求", &收到资源请求)
    EdgeView_导航("https://example.com")
  结束

  事件 收到资源请求()
    调试输出(EdgeView事件_取字段(演示浏览器, "uri"))
  结束
结束类
```

要点：

- 控件参数是裸 `controlRef`（如 `演示浏览器`），不要加引号；处理器参数用 `&处理器名` 引用。
- 设计器控件用 `EdgeView_绑定控件事件(控件名, 事件名, &处理器名)`；纯代码实例用 `EdgeView_绑定事件(实例编号, 事件名, &处理器名)`。
- `EdgeView_执行JS("document.title")` 执行 JavaScript 并返回 WebView2 的 JSON 编码结果。
- `EdgeView_取事件数据控件` 返回当前事件的 UTF-16 JSON 文本，`EdgeView事件_取字段` 按字段名读取单个字段。

完整示例（拦截请求并读取响应正文）见仓库 `examples/edgeview-response-demos/`。

## 常用命令参考

| 命令 | 说明 |
|---|---|
| `EdgeView_创建(父组件句柄, 地址)` | 在指定 HWND 组件客户区创建 EdgeView；传 0 嵌入当前窗口 |
| `EdgeView_创建实例(实例编号, 父组件句柄, 地址, 独立缓存目录)` | 创建具名实例；不同缓存目录拥有独立 Cookie、存储和会话 |
| `EdgeView_创建实例代理(实例编号, 父组件句柄, 地址, 缓存目录, 代理地址)` | 创建使用独立代理的实例（HTTP/HTTPS/SOCKS5） |
| `EdgeView_导航(地址)` / `EdgeView_导航实例(实例编号, 地址)` | 导航到 HTTP/HTTPS 或本地文件地址 |
| `EdgeView_执行JS(脚本)` / `EdgeView_执行JS实例(实例编号, 脚本)` | 执行 JavaScript，返回 JSON 编码结果 |
| `EdgeView_后退()` / `EdgeView_前进()` | 历史记录导航 |
| `EdgeView_绑定控件事件(控件名, 事件名, &处理器名)` | 为设计器控件绑定浏览器事件 |
| `EdgeView_绑定事件(实例编号, 事件名, &处理器名)` | 为纯代码实例绑定浏览器事件 |
| `EdgeView_监听开发者工具事件(实例编号, 协议事件名)` | 监听 Chromium DevTools Protocol 事件 |
| `EdgeView_等待事件(实例编号, 事件名, 超时毫秒)` | 泵送消息并等待指定事件 |
| `EdgeView事件_取字段(控件名, "字段名")` | 读取当前事件的单个字段 |

完整命令清单在 IDE「模块详情 → 接口 → 模块公开信息」中查看。

## 事件

EdgeView 通过统一事件目录公开 **71 项**普通 HWND 可达事件（如 导航开始、导航完成、标题改变、网页消息、下载开始、权限请求、Web资源请求 等），事件名使用中文，底层 WebView2 标识、分类和字段说明以模块详情内置文档《EdgeView 事件与接口参考》为准。

两类需要注意的事件：

- **同步决策事件**（如 Web资源请求）只在处理器执行期间允许调用对应的 `EdgeView事件_*` / `EdgeView资源_*` 决策接口；未设置动作时保留 WebView2 默认行为。
- 部分资源、对象和创建选项接口需要 **WebView2 Runtime 150** 或更高版本，不满足时模块会给出中文诊断。

## 依赖与平台限制

- 仅支持 Windows（Win32 / x64，MSVC 工具链）。
- 依赖系统 **WebView2 Runtime**（Evergreen）；基础事件最低基线为 SDK `1.0.3537.50` / Runtime 141。
- 导出的 exe 与 F5 构建产物需要 WebView2 Runtime 存在于目标机器。

## 相关页面

- [CEF3 浏览器模块](/guide/user/modules/cef3) / [FBro 指纹浏览器模块](/guide/user/modules/fbro) —— 三种浏览器内核怎么选
- [窗口设计器](/guide/user/window-designer) —— 控件拖放与事件绑定
- [构建与运行](/guide/user/build-and-run) —— F5 编译运行
