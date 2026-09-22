import {
  LingBuilderModuleManifest,
  ModuleBindingValueType,
  ModuleCommandBinding,
  ModuleCommandBindingParameter,
  ModuleCommandContribution,
  ModuleCommandValueType,
  ModuleConstantContribution
} from './types';

export const SUNNYNET_MODULE_ID = 'lingbuilder.sunnynet';
export const SUNNYNET_SDK_MODULE_ID = 'lingbuilder.sunnynet.sdk';

interface SunnyNetCommandSpec {
  name: string;
  signature: string;
  description: string;
  parameters: ModuleCommandBindingParameter[];
  returnType: ModuleCommandValueType;
  returnLabel: string;
  category: '生命周期' | '证书' | '事件' | 'HTTP事件' | '连接' | '进程代理' | '系统代理';
  insertText?: string;
  example?: string;
  visibility?: 'default' | 'advanced' | 'internal';
}

const parameter = (
  name: string,
  type: ModuleBindingValueType | (string & {}),
  description: string
): ModuleCommandBindingParameter => ({
  name,
  type,
  description,
  ...(type === 'handler' ? { handlerSignature: { parameterTypes: [], returnType: '空' } } : {})
});

const middlewareHandle = '网络中间件_创建 返回的中间件句柄；句柄不存在时命令返回失败值。';
const certManagerHandle = '网络中间件_创建证书管理器 返回的证书管理器句柄；不存在时命令返回失败值。';
const eventHandlerArg = '必须使用 &处理器名；处理器必须无参数，在网络中间件捕获到事件时于窗口 UI 线程执行，处理器内用 网络中间件_取当前事件* 与 HTTP/连接 命令读写本次事件。';
const rebootWarning = '⚠️ 驱动卸载必须重启计算机才能完成：程序运行时会弹出中文确认对话框，用户点击“是”后立即重启系统，点击“否”则不执行任何操作并返回假。';

const specs: SunnyNetCommandSpec[] = [
  // ===== 生命周期 =====
  { name: '网络中间件_创建', signature: '网络中间件_创建()', description: '创建网络中间件实例并返回句柄；基于 SunnyNet 中间件，可抓取、查看和修改本机 HTTP/HTTPS/WebSocket/TCP/UDP 收发数据。', parameters: [], returnType: '网络中间件', returnLabel: '网络中间件', category: '生命周期' },
  { name: '网络中间件_销毁', signature: '网络中间件_销毁(中间件)', description: '停止并释放中间件句柄；重复销毁返回假。', parameters: [parameter('中间件', '网络中间件', middlewareHandle)], returnType: 'bool', returnLabel: '逻辑型', category: '生命周期' },
  { name: '网络中间件_设置端口', signature: '网络中间件_设置端口(中间件, 端口)', description: '设置本地代理监听端口；须在 启动 之前设置。', parameters: [parameter('中间件', '网络中间件', middlewareHandle), parameter('端口', 'int', '本地代理监听端口，1 到 65535；须避开系统占用端口。')], returnType: 'bool', returnLabel: '逻辑型', category: '生命周期' },
  { name: '网络中间件_启动', signature: '网络中间件_启动(中间件)', description: '启动本地代理监听；启动后配合 网络中间件_设置系统代理 或进程代理驱动捕获流量。', parameters: [parameter('中间件', '网络中间件', middlewareHandle)], returnType: 'bool', returnLabel: '逻辑型', category: '生命周期' },
  { name: '网络中间件_停止', signature: '网络中间件_停止(中间件)', description: '停止本地代理监听并自动还原系统代理设置（与底层官方语义一致）；已建立的连接会被断开。', parameters: [parameter('中间件', '网络中间件', middlewareHandle)], returnType: 'bool', returnLabel: '逻辑型', category: '生命周期' },
  { name: '网络中间件_取错误', signature: '网络中间件_取错误(中间件)', description: '返回中间件最近一次操作的中文或原文错误信息；无错误返回空文本。', parameters: [parameter('中间件', '网络中间件', middlewareHandle)], returnType: 'wideString', returnLabel: '文本型', category: '生命周期' },
  { name: '网络中间件_取版本', signature: '网络中间件_取版本()', description: '返回底层 SunnyNet 版本串，如 "2026-09-16"；DLL 加载失败返回空文本。', parameters: [], returnType: 'wideString', returnLabel: '文本型', category: '生命周期' },

  // ===== 证书 =====
  { name: '网络中间件_创建证书管理器', signature: '网络中间件_创建证书管理器()', description: '创建证书管理器并自动生成 LingBuilder 网络中间件根证书（通用名 LingBuilder.Sunny.Root）；配合 网络中间件_绑定证书 用于 HTTPS 解密。', parameters: [], returnType: '网络证书管理器', returnLabel: '网络证书管理器', category: '证书' },
  { name: '网络中间件_销毁证书管理器', signature: '网络中间件_销毁证书管理器(证书管理器)', description: '释放证书管理器句柄；不影响已安装到系统的根证书。', parameters: [parameter('证书管理器', '网络证书管理器', certManagerHandle)], returnType: 'void', returnLabel: '无返回值', category: '证书' },
  { name: '网络中间件_绑定证书', signature: '网络中间件_绑定证书(中间件, 证书管理器)', description: '把证书管理器绑定到中间件；绑定后启动即可解密 HTTPS 流量。', parameters: [parameter('中间件', '网络中间件', middlewareHandle), parameter('证书管理器', '网络证书管理器', certManagerHandle)], returnType: 'bool', returnLabel: '逻辑型', category: '证书' },
  { name: '网络中间件_是否已安装根证书', signature: '网络中间件_是否已安装根证书()', description: '检查系统证书库（当前用户与本地计算机的受信任根）中是否存在 LingBuilder 网络中间件根证书。', parameters: [], returnType: 'bool', returnLabel: '逻辑型', category: '证书' },
  { name: '网络中间件_安装根证书', signature: '网络中间件_安装根证书(中间件)', description: '⚠️ 系统级操作：向系统受信任根证书库安装 LingBuilder 网络中间件根证书（本地计算机库需管理员权限）。已安装时直接返回真；首次安装时程序会弹出中文确认对话框，用户点击“是”才执行安装。', parameters: [parameter('中间件', '网络中间件', middlewareHandle)], returnType: 'bool', returnLabel: '逻辑型', category: '证书' },
  { name: '网络中间件_卸载根证书', signature: '网络中间件_卸载根证书()', description: '⚠️ 系统级操作：从系统受信任根证书库移除 LingBuilder 网络中间件根证书（当前用户与本地计算机两处；本地计算机库需管理员权限）。', parameters: [], returnType: 'bool', returnLabel: '逻辑型', category: '证书' },
  { name: '网络中间件_导出根证书', signature: '网络中间件_导出根证书(中间件, 文件路径)', description: '把中间件当前使用的根证书导出为 PEM 文本文件，供 curl、Python 等工具信任使用。', parameters: [parameter('中间件', '网络中间件', middlewareHandle), parameter('文件路径', 'wideString', '要写出的 PEM 文件完整路径（文本型）。')], returnType: 'bool', returnLabel: '逻辑型', category: '证书' },

  // ===== 事件绑定 =====
  { name: '网络中间件_设置HTTP事件', signature: '网络中间件_设置HTTP事件(中间件, &处理器)', description: '绑定 HTTP/HTTPS 收发事件处理器；请求与响应各触发一次，处理器内用 网络中间件_取当前事件类型 区分（#HTTP事件_请求 / #HTTP事件_响应）。', parameters: [parameter('中间件', '网络中间件', middlewareHandle), parameter('处理器', 'handler', eventHandlerArg)], returnType: 'bool', returnLabel: '逻辑型', category: '事件', insertText: '网络中间件_设置HTTP事件($1, &$2)' },
  { name: '网络中间件_设置TCP事件', signature: '网络中间件_设置TCP事件(中间件, &处理器)', description: '绑定 TCP 收发事件处理器；处理器内用 网络中间件_取当前事件类型 与 网络中间件_取当前TCP数据 读写数据。', parameters: [parameter('中间件', '网络中间件', middlewareHandle), parameter('处理器', 'handler', eventHandlerArg)], returnType: 'bool', returnLabel: '逻辑型', category: '事件' },
  { name: '网络中间件_设置WebSocket事件', signature: '网络中间件_设置WebSocket事件(中间件, &处理器)', description: '绑定 WebSocket 收发事件处理器；处理器内用 网络中间件_取当前事件类型 与 网络中间件_取当前WS数据 读写消息。', parameters: [parameter('中间件', '网络中间件', middlewareHandle), parameter('处理器', 'handler', eventHandlerArg)], returnType: 'bool', returnLabel: '逻辑型', category: '事件' },
  { name: '网络中间件_设置UDP事件', signature: '网络中间件_设置UDP事件(中间件, &处理器)', description: '绑定 UDP 收发事件处理器；处理器内用 网络中间件_取当前事件类型 与 网络中间件_取当前UDP数据 读写数据。', parameters: [parameter('中间件', '网络中间件', middlewareHandle), parameter('处理器', 'handler', eventHandlerArg)], returnType: 'bool', returnLabel: '逻辑型', category: '事件' },

  // ===== 当前事件上下文 =====
  { name: '网络中间件_取当前事件ID', signature: '网络中间件_取当前事件ID()', description: '在事件处理器内返回本次事件的消息 ID；其它位置返回 0。', parameters: [], returnType: 'longLong', returnLabel: '长整数型', category: 'HTTP事件' },
  { name: '网络中间件_取当前事件类型', signature: '网络中间件_取当前事件类型()', description: '在事件处理器内返回本次事件类型：0 无事件，1 请求（#HTTP事件_请求），2 响应（#HTTP事件_响应）。', parameters: [], returnType: 'int', returnLabel: '整数型', category: 'HTTP事件' },
  { name: '网络中间件_取当前方法', signature: '网络中间件_取当前方法()', description: '在事件处理器内返回本次请求方法，如 GET、POST；非 HTTP 事件返回空文本。', parameters: [], returnType: 'wideString', returnLabel: '文本型', category: 'HTTP事件' },
  { name: '网络中间件_取当前URL', signature: '网络中间件_取当前URL()', description: '在事件处理器内返回本次请求完整 URL；HTTPS 解密后为明文 URL。', parameters: [], returnType: 'wideString', returnLabel: '文本型', category: 'HTTP事件' },
  { name: '网络中间件_取当前进程ID', signature: '网络中间件_取当前进程ID()', description: '在事件处理器内返回发起本次流量的进程 ID；未知时返回 0。', parameters: [], returnType: 'longLong', returnLabel: '长整数型', category: 'HTTP事件' },
  { name: '网络中间件_取当前客户IP', signature: '网络中间件_取当前客户IP()', description: '在事件处理器内返回发起请求的客户端 IP 地址。', parameters: [], returnType: 'wideString', returnLabel: '文本型', category: 'HTTP事件' },
  { name: '网络中间件_取当前连接ID', signature: '网络中间件_取当前连接ID()', description: '在 TCP/UDP/WebSocket 事件处理器内返回本次连接的唯一 ID，可用于发送与关闭命令。', parameters: [], returnType: 'longLong', returnLabel: '长整数型', category: '连接' },
  { name: '网络中间件_取当前本地地址', signature: '网络中间件_取当前本地地址()', description: '在 TCP/UDP 事件处理器内返回本地端地址文本，如 127.0.0.1:52341。', parameters: [], returnType: 'wideString', returnLabel: '文本型', category: '连接' },
  { name: '网络中间件_取当前对端地址', signature: '网络中间件_取当前对端地址()', description: '在 TCP/UDP 事件处理器内返回对端地址文本，如 93.184.216.34:443。', parameters: [], returnType: 'wideString', returnLabel: '文本型', category: '连接' },
  { name: '网络中间件_取当前TCP数据', signature: '网络中间件_取当前TCP数据()', description: '在 TCP 事件处理器内返回本次收发的数据字节集。', parameters: [], returnType: 'bytes', returnLabel: '字节集', category: '连接' },
  { name: '网络中间件_取当前WS数据', signature: '网络中间件_取当前WS数据()', description: '在 WebSocket 事件处理器内返回本次收发的消息字节集。', parameters: [], returnType: 'bytes', returnLabel: '字节集', category: '连接' },
  { name: '网络中间件_取当前UDP数据', signature: '网络中间件_取当前UDP数据()', description: '在 UDP 事件处理器内返回本次收发的数据字节集。', parameters: [], returnType: 'bytes', returnLabel: '字节集', category: '连接' },

  // ===== HTTP 请求读写 =====
  { name: '网络中间件_取请求头', signature: '网络中间件_取请求头(头名称)', description: '在 HTTP 事件处理器内返回指定请求头的值；不存在返回空文本。', parameters: [parameter('头名称', 'wideString', '请求头名称，如 User-Agent、Cookie。')], returnType: 'wideString', returnLabel: '文本型', category: 'HTTP事件' },
  { name: '网络中间件_设请求头', signature: '网络中间件_设请求头(头名称, 值)', description: '在 HTTP 请求事件处理器内设置或覆盖请求头；须在请求事件（#HTTP事件_请求）中使用才会生效。', parameters: [parameter('头名称', 'wideString', '请求头名称。'), parameter('值', 'wideString', '请求头内容。')], returnType: 'bool', returnLabel: '逻辑型', category: 'HTTP事件' },
  { name: '网络中间件_删请求头', signature: '网络中间件_删请求头(头名称)', description: '在 HTTP 请求事件处理器内删除指定请求头。', parameters: [parameter('头名称', 'wideString', '要删除的请求头名称。')], returnType: 'bool', returnLabel: '逻辑型', category: 'HTTP事件' },
  { name: '网络中间件_取请求体', signature: '网络中间件_取请求体()', description: '在 HTTP 事件处理器内返回请求正文文本（按 UTF-8 解码；二进制内容请改用字节集命令族）。', parameters: [], returnType: 'wideString', returnLabel: '文本型', category: 'HTTP事件' },
  { name: '网络中间件_取请求体长度', signature: '网络中间件_取请求体长度()', description: '在 HTTP 事件处理器内返回请求正文长度（字节数）。', parameters: [], returnType: 'longLong', returnLabel: '长整数型', category: 'HTTP事件' },
  { name: '网络中间件_设请求体', signature: '网络中间件_设请求体(内容)', description: '在 HTTP 请求事件处理器内用文本（按 UTF-8 编码）替换请求正文。', parameters: [parameter('内容', 'wideString', '新的请求正文文本。')], returnType: 'bool', returnLabel: '逻辑型', category: 'HTTP事件' },
  { name: '网络中间件_设请求URL', signature: '网络中间件_设请求URL(新URL)', description: '在 HTTP 请求事件处理器内把请求重定向到新 URL。', parameters: [parameter('新URL', 'wideString', '新的完整请求 URL。')], returnType: 'bool', returnLabel: '逻辑型', category: 'HTTP事件' },
  { name: '网络中间件_取请求Cookie', signature: '网络中间件_取请求Cookie(名称)', description: '在 HTTP 事件处理器内返回请求 Cookie 中指定名称的值。', parameters: [parameter('名称', 'wideString', 'Cookie 名称。')], returnType: 'wideString', returnLabel: '文本型', category: 'HTTP事件' },
  { name: '网络中间件_设请求Cookie', signature: '网络中间件_设请求Cookie(名称, 值)', description: '在 HTTP 请求事件处理器内设置请求 Cookie 中指定名称的值。', parameters: [parameter('名称', 'wideString', 'Cookie 名称。'), parameter('值', 'wideString', 'Cookie 值。')], returnType: 'bool', returnLabel: '逻辑型', category: 'HTTP事件' },

  // ===== HTTP 响应读写 =====
  { name: '网络中间件_取响应状态码', signature: '网络中间件_取响应状态码()', description: '在 HTTP 响应事件处理器内返回响应状态码，如 200。', parameters: [], returnType: 'int', returnLabel: '整数型', category: 'HTTP事件' },
  { name: '网络中间件_设响应状态码', signature: '网络中间件_设响应状态码(状态码)', description: '在 HTTP 响应事件处理器内修改响应状态码。', parameters: [parameter('状态码', 'int', '新的响应状态码，100 到 599。')], returnType: 'bool', returnLabel: '逻辑型', category: 'HTTP事件' },
  { name: '网络中间件_取响应头', signature: '网络中间件_取响应头(头名称)', description: '在 HTTP 事件处理器内返回指定响应头的值。', parameters: [parameter('头名称', 'wideString', '响应头名称，如 Content-Type。')], returnType: 'wideString', returnLabel: '文本型', category: 'HTTP事件' },
  { name: '网络中间件_设响应头', signature: '网络中间件_设响应头(头名称, 值)', description: '在 HTTP 响应事件处理器内设置或覆盖响应头；须在响应事件（#HTTP事件_响应）中使用才会生效。', parameters: [parameter('头名称', 'wideString', '响应头名称。'), parameter('值', 'wideString', '响应头内容。')], returnType: 'bool', returnLabel: '逻辑型', category: 'HTTP事件' },
  { name: '网络中间件_删响应头', signature: '网络中间件_删响应头(头名称)', description: '在 HTTP 响应事件处理器内删除指定响应头。', parameters: [parameter('头名称', 'wideString', '要删除的响应头名称。')], returnType: 'bool', returnLabel: '逻辑型', category: 'HTTP事件' },
  { name: '网络中间件_取响应体', signature: '网络中间件_取响应体()', description: '在 HTTP 事件处理器内返回响应正文文本（按 UTF-8 解码；二进制内容请改用字节集命令族）。', parameters: [], returnType: 'wideString', returnLabel: '文本型', category: 'HTTP事件' },
  { name: '网络中间件_取响应体长度', signature: '网络中间件_取响应体长度()', description: '在 HTTP 事件处理器内返回响应正文长度（字节数）。', parameters: [], returnType: 'longLong', returnLabel: '长整数型', category: 'HTTP事件' },
  { name: '网络中间件_设响应体', signature: '网络中间件_设响应体(内容)', description: '在 HTTP 响应事件处理器内用文本（按 UTF-8 编码）替换响应正文；须在响应事件中使用才会生效。', parameters: [parameter('内容', 'wideString', '新的响应正文文本。')], returnType: 'bool', returnLabel: '逻辑型', category: 'HTTP事件' },
  { name: '网络中间件_设响应体字节集', signature: '网络中间件_设响应体字节集(字节集)', description: '在 HTTP 响应事件处理器内用字节集替换响应正文（适合图片等二进制内容）。', parameters: [parameter('字节集', 'bytes', '新的响应正文字节集。')], returnType: 'bool', returnLabel: '逻辑型', category: 'HTTP事件' },

  // ===== 连接收发 =====
  { name: '网络中间件_TCP发送数据', signature: '网络中间件_TCP发送数据(连接ID, 字节集)', description: '向指定 TCP 连接主动发送数据；连接 ID 来自 网络中间件_取当前连接ID。', parameters: [parameter('连接ID', 'longLong', 'TCP 连接唯一 ID。'), parameter('字节集', 'bytes', '要发送的数据。')], returnType: 'bool', returnLabel: '逻辑型', category: '连接' },
  { name: '网络中间件_TCP关闭连接', signature: '网络中间件_TCP关闭连接(连接ID)', description: '关闭指定 TCP 连接。', parameters: [parameter('连接ID', 'longLong', 'TCP 连接唯一 ID。')], returnType: 'bool', returnLabel: '逻辑型', category: '连接' },
  { name: '网络中间件_WS发送文本', signature: '网络中间件_WS发送文本(事件ID, 文本)', description: '向指定 WebSocket 连接以文本帧发送消息；事件 ID 来自 网络中间件_取当前事件ID。', parameters: [parameter('事件ID', 'longLong', 'WebSocket 事件消息 ID。'), parameter('文本', 'wideString', '要发送的文本消息，按 UTF-8 编码。')], returnType: 'bool', returnLabel: '逻辑型', category: '连接' },
  { name: '网络中间件_WS发送字节集', signature: '网络中间件_WS发送字节集(事件ID, 字节集)', description: '向指定 WebSocket 连接以二进制帧发送数据。', parameters: [parameter('事件ID', 'longLong', 'WebSocket 事件消息 ID。'), parameter('字节集', 'bytes', '要发送的数据。')], returnType: 'bool', returnLabel: '逻辑型', category: '连接' },
  { name: '网络中间件_WS关闭连接', signature: '网络中间件_WS关闭连接(连接ID)', description: '关闭指定 WebSocket 连接。', parameters: [parameter('连接ID', 'longLong', 'WebSocket 连接唯一 ID。')], returnType: 'bool', returnLabel: '逻辑型', category: '连接' },
  { name: '网络中间件_UDP发送数据', signature: '网络中间件_UDP发送数据(连接ID, 字节集, 发往客户端)', description: '向指定 UDP 会话发送数据；发往客户端 为真发往本地客户端，为假发往远端服务器。', parameters: [parameter('连接ID', 'longLong', 'UDP 会话唯一 ID。'), parameter('字节集', 'bytes', '要发送的数据。'), parameter('发往客户端', 'bool', '真=发往本地客户端方向，假=发往远端服务器方向。')], returnType: 'bool', returnLabel: '逻辑型', category: '连接' },

  // ===== 进程代理（高危族） =====
  { name: '网络中间件_加载进程代理驱动', signature: '网络中间件_加载进程代理驱动(中间件, 模式)', description: '⚠️ 高级能力：加载内核级进程代理驱动（需管理员权限，弹确认框），使指定进程的流量无需设置系统代理即可被中间件捕获。驱动加载一次即可常驻系统，日常反复抓包无需卸载、无需重启；同一时刻只允许一个中间件使用驱动。模式取值：#进程代理_模式_Proxifier / #进程代理_模式_NFAPI / #进程代理_模式_Tun；不想用驱动时改走 SOCKS 用户校验族（无驱动按进程代理）。', parameters: [parameter('中间件', '网络中间件', middlewareHandle), parameter('模式', 'int', '0=Proxifier，1=NFAPI（netfilter2 驱动），2=Tun（WinDivert 驱动，推荐）。')], returnType: 'bool', returnLabel: '逻辑型', category: '进程代理' },
  { name: '网络中间件_添加代理进程', signature: '网络中间件_添加代理进程(中间件, 进程名)', description: '把指定进程名（如 python.exe）纳入进程代理捕获；须先成功加载进程代理驱动。', parameters: [parameter('中间件', '网络中间件', middlewareHandle), parameter('进程名', 'wideString', '进程映像名，如 notepad.exe；不带路径。')], returnType: 'bool', returnLabel: '逻辑型', category: '进程代理' },
  { name: '网络中间件_移除代理进程', signature: '网络中间件_移除代理进程(中间件, 进程名)', description: '把指定进程名移出进程代理捕获列表。', parameters: [parameter('中间件', '网络中间件', middlewareHandle), parameter('进程名', 'wideString', '进程映像名。')], returnType: 'bool', returnLabel: '逻辑型', category: '进程代理' },
  { name: '网络中间件_按PID添加代理进程', signature: '网络中间件_按PID添加代理进程(中间件, 进程ID)', description: '把指定进程 ID 纳入进程代理捕获。', parameters: [parameter('中间件', '网络中间件', middlewareHandle), parameter('进程ID', 'int', '目标进程 ID。')], returnType: 'bool', returnLabel: '逻辑型', category: '进程代理' },
  { name: '网络中间件_清空代理进程', signature: '网络中间件_清空代理进程(中间件)', description: '清空全部已登记的代理进程与进程 ID。', parameters: [parameter('中间件', '网络中间件', middlewareHandle)], returnType: 'bool', returnLabel: '逻辑型', category: '进程代理' },
  { name: '网络中间件_卸载进程代理文件', signature: '网络中间件_卸载进程代理文件(中间件)', description: '日常清理路径：不重启地停止并删除驱动服务、把驱动文件移入临时目录，进程代理立即失效；清理后如需再次按进程抓包，重新加载驱动即可。', parameters: [parameter('中间件', '网络中间件', middlewareHandle)], returnType: 'bool', returnLabel: '逻辑型', category: '进程代理' },
  { name: '网络中间件_彻底清理驱动并重启计算机', signature: '网络中间件_彻底清理驱动并重启计算机(中间件)', description: `⚠️ 仅在彻底移除驱动时使用：${rebootWarning}日常使用无需调用本命令——驱动加载一次即可常驻，反复抓包不需要卸载。`, parameters: [parameter('中间件', '网络中间件', middlewareHandle)], returnType: 'bool', returnLabel: '逻辑型', category: '进程代理', visibility: 'advanced' },

  // ===== SOCKS 按进程代理（无驱动路径） =====
  { name: '网络中间件_添加SOCKS用户', signature: '网络中间件_添加SOCKS用户(中间件, 用户名, 密码)', description: '给中间件代理端口的 SOCKS5 服务添加一个用户名密码；配合 Proxifier 类工具，把指定进程的代理指向 127.0.0.1:代理端口 即可按进程抓包，无驱动、无管理员、无需重启。', parameters: [parameter('中间件', '网络中间件', middlewareHandle), parameter('用户名', 'wideString', 'SOCKS5 用户名。'), parameter('密码', 'wideString', 'SOCKS5 密码。')], returnType: 'bool', returnLabel: '逻辑型', category: '系统代理' },
  { name: '网络中间件_删除SOCKS用户', signature: '网络中间件_删除SOCKS用户(中间件, 用户名, 密码)', description: '删除 SOCKS5 服务中指定用户名与密码的账号。', parameters: [parameter('中间件', '网络中间件', middlewareHandle), parameter('用户名', 'wideString', '要删除的 SOCKS5 用户名。'), parameter('密码', 'wideString', '该账号对应的密码。')], returnType: 'bool', returnLabel: '逻辑型', category: '系统代理' },
  { name: '网络中间件_开启SOCKS用户校验', signature: '网络中间件_开启SOCKS用户校验(中间件, 开启)', description: '开关 SOCKS5 用户名密码校验；开启后，Proxifier 类工具必须用已添加的用户名密码才能通过本中间件的 SOCKS5 代理。', parameters: [parameter('中间件', '网络中间件', middlewareHandle), parameter('开启', 'bool', '真=要求用户名密码校验，假=关闭校验。')], returnType: 'bool', returnLabel: '逻辑型', category: '系统代理' },

  // ===== 系统代理 =====
  { name: '网络中间件_设置上游代理', signature: '网络中间件_设置上游代理(中间件, 代理地址, 超时毫秒)', description: '给中间件设置全局上游代理：所有经本中间件的流量先转发到该代理再出站。代理地址用标准 URL 格式，支持 socks5（可带账号密码，如 socks5://用户名:密码@主机:端口）、http、https。多进程分流的标准做法：创建多个中间件实例、各设不同端口与不同上游代理，再用 Proxifier 类工具把不同进程指向 127.0.0.1:不同端口。', parameters: [parameter('中间件', '网络中间件', middlewareHandle), parameter('代理地址', 'wideString', '上游代理 URL：socks5://用户名:密码@主机:端口 / http://主机:端口 / https://主机:端口；空文本等同取消上游代理。'), parameter('超时毫秒', 'int', '经上游代理出站的超时毫秒数，1000 到 3600000。', )], returnType: 'bool', returnLabel: '逻辑型', category: '系统代理', insertText: '网络中间件_设置上游代理($1, "socks5://用户名:密码@127.0.0.1:1080", 30000)' },
  { name: '网络中间件_取消上游代理', signature: '网络中间件_取消上游代理(中间件)', description: '取消中间件的全局上游代理，流量恢复直连出站。', parameters: [parameter('中间件', '网络中间件', middlewareHandle)], returnType: 'bool', returnLabel: '逻辑型', category: '系统代理' },
  { name: '网络中间件_设请求代理', signature: '网络中间件_设请求代理(消息ID, 代理地址, 超时毫秒)', description: '只给当前这一个请求设置上游代理（按请求分流）：在 HTTP 请求事件处理器内调用，消息ID 用 网络中间件_取当前事件ID() 取得；可与 网络中间件_取当前进程ID() 配合按进程决定走哪个上游。支持 socks5（可带账号密码）/http/https 地址。', parameters: [parameter('消息ID', 'longLong', '当前请求的消息 ID，来自 网络中间件_取当前事件ID()；只在 HTTP 请求事件处理器内有效。'), parameter('代理地址', 'wideString', '本请求使用的上游代理 URL，格式同 网络中间件_设置上游代理。'), parameter('超时毫秒', 'int', '经上游代理出站的超时毫秒数，1000 到 3600000。')], returnType: 'bool', returnLabel: '逻辑型', category: '系统代理', insertText: '网络中间件_设请求代理(网络中间件_取当前事件ID(), "socks5://u:p@127.0.0.1:1080", 30000)' },
  { name: '网络中间件_设置系统代理', signature: '网络中间件_设置系统代理(中间件)', description: '⚠️ 系统级操作：把 Windows 系统代理（WinINET）指向本中间件监听端口，此后浏览器等走系统代理的程序流量都会被捕获。停止、销毁与程序正常退出时会自动还原系统代理（防断网）；也可随时用 网络中间件_取消系统代理 手动还原。', parameters: [parameter('中间件', '网络中间件', middlewareHandle)], returnType: 'bool', returnLabel: '逻辑型', category: '系统代理' },
  { name: '网络中间件_取消系统代理', signature: '网络中间件_取消系统代理(中间件)', description: '取消由本中间件设置的系统代理。', parameters: [parameter('中间件', '网络中间件', middlewareHandle)], returnType: 'bool', returnLabel: '逻辑型', category: '系统代理' }
];

const SUNNYNET_CONSTANTS: ModuleConstantContribution[] = [
  { name: 'HTTP事件_请求', type: '整数型', value: 1, description: '网络中间件事件类型：HTTP/HTTPS 请求方向。' },
  { name: 'HTTP事件_响应', type: '整数型', value: 2, description: '网络中间件事件类型：HTTP/HTTPS 响应方向。' },
  { name: '进程代理_模式_Proxifier', type: '整数型', value: 0, description: '进程代理驱动模式 0：Proxifier 方式。' },
  { name: '进程代理_模式_NFAPI', type: '整数型', value: 1, description: '进程代理驱动模式 1：NFAPI（netfilter2 内核驱动）。' },
  { name: '进程代理_模式_Tun', type: '整数型', value: 2, description: '进程代理驱动模式 2：Tun（WinDivert 内核驱动，推荐）。' }
];

function contribution(spec: SunnyNetCommandSpec): ModuleCommandContribution {
  return {
    name: spec.name,
    signature: spec.signature,
    description: spec.description,
    insertText: spec.insertText || `${spec.name}(${spec.parameters.map((item, index) => item.type === 'handler' ? `&$${index + 1}` : `$${index + 1}`).join(', ')})`,
    returnType: spec.returnLabel,
    category: spec.category,
    capabilityKind: 'single',
    ...(spec.visibility ? { visibility: spec.visibility } : {})
  };
}

function binding(spec: SunnyNetCommandSpec): ModuleCommandBinding {
  return {
    command: spec.name,
    runtimeName: spec.name,
    parameters: spec.parameters,
    returnType: spec.returnType,
    encoding: 'wide',
    example: spec.example || spec.insertText?.replace(/\$\d+/gu, '示例值') || `${spec.name}()`,
    description: spec.description
  };
}

export const SUNNYNET_COMMAND_SPECS = specs;

export const SUNNYNET_MODULE: LingBuilderModuleManifest = {
  schemaVersion: 2,
  id: SUNNYNET_MODULE_ID,
  name: '网络中间件模块',
  version: '1.1.0',
  category: '网络',
  description: '基于 SunnyNet 的网络抓包与改写中间件：捕获并查看、修改本机 HTTP/HTTPS/WebSocket/TCP/UDP 收发数据，支持根证书 HTTPS 解密、按进程代理（高级）与系统代理；事件处理器在窗口 UI 线程执行。',
  author: 'LingBuilder',
  license: 'MIT（底层 SunnyNet，见随包 LICENSE）',
  tags: ['内置', '网络', '抓包', '中间件', 'HTTPS', '代理'],
  contributes: {
    commands: specs.map(contribution),
    types: [
      { name: '网络中间件', description: '网络中间件实例句柄；64 位、进程生命周期内不复用。', cppType: 'long long' },
      { name: '网络证书管理器', description: '网络中间件证书管理器句柄。', cppType: 'long long' }
    ],
    constants: SUNNYNET_CONSTANTS,
    snippets: [
      { label: 'HTTP抓包最小示例', insertText: '网络中间件 中间件 = 网络中间件_创建()\n网络中间件_设置HTTP事件(中间件, &HTTP事件处理)\n网络中间件_设置端口(中间件, 8888)\n网络中间件_启动(中间件)', description: '创建中间件、绑定 HTTP 事件并启动本地代理；配合 网络中间件_设置系统代理 开始抓包。' },
      { label: 'HTTPS解密与响应改写', insertText: '网络中间件 中间件 = 网络中间件_创建()\n网络证书管理器 证书 = 网络中间件_创建证书管理器()\n网络中间件_绑定证书(中间件, 证书)\n网络中间件_安装根证书(中间件)\n网络中间件_设置HTTP事件(中间件, &HTTP事件处理)\n网络中间件_设置端口(中间件, 8888)\n网络中间件_启动(中间件)', description: 'HTTPS 解密完整链路：证书管理器、根证书安装（带确认弹窗）与事件改写。' }
    ],
    docs: [{ title: '网络中间件模块使用说明', path: 'docs/modules/sunnynet/README.md' }],
    examples: [{ title: 'HTTP抓包与HTTPS解密示例（模块演示）', path: 'examples/module-demos/lingbuilder.sunnynet/src/MainWindow.lcpp', description: '最小可编译的抓包示例：创建中间件、证书、事件改写与系统代理。' }]
  },
  targets: [
    { id: 'windows-msvc-win32', platform: 'windows', arch: 'win32', toolchain: 'msvc', defines: ['LINGBUILDER_SUNNYNET_MODULE'], compileOptions: ['/std:c++17'] },
    { id: 'windows-msvc-x64', platform: 'windows', arch: 'x64', toolchain: 'msvc', defines: ['LINGBUILDER_SUNNYNET_MODULE'], compileOptions: ['/std:c++17'] }
  ],
  bindings: { commands: specs.map(binding) }
};
