import { LingBuilderModuleManifest, ModuleBindingValueType } from './types';
import { createStandardModule, StandardCommandSpec } from './standardLibraryModules';
import { createModuleBindingSnippetArgument } from './bindingValueType';
import { HTTP_CLIENT_MODULE } from './httpClientModule';
import { CDP_CLIENT_MODULE } from './cdpClientModule';
import { WEB_HTTP_MODULE } from './webHttpModule';

type Parameter = { name: string; type: ModuleBindingValueType; description: string };

// 以下说明按 src/services/windowDesigner/networkLibraryRuntime.ts 的实际校验逻辑核实，
// 重复语义（Cookie 请求头文本、Cookie 名、URL 地址）提取为共享常量。
const cookieHeaderArg = '请求头形式的 Cookie 文本，形如 a=1; b=2；按分号拆分并去掉每项两端空白，不含等号的片段会被忽略。';
const cookieNameArg = '要操作的 Cookie 名称，区分大小写。';
const urlArg = '要解析的完整 URL，必须带协议名；由 WinHTTP 解析，解析失败时文本项返回空文本、端口返回 0。';

function command(name: string, parameters: Parameter[], returnType: ModuleBindingValueType, description: string, example?: string): StandardCommandSpec {
  const argumentsText = parameters.map((parameter, index) => parameter.type === 'controlRef' || parameter.type === 'handler'
    ? createModuleBindingSnippetArgument(parameter, index)
    : parameter.type === 'wideString' || parameter.type === 'utf8String' ? `"$${index + 1}"` : parameter.type === 'bool' ? '假' : '0');
  return { name, signature: `${name}(${parameters.map(parameter => parameter.name).join(', ')})`, description, insertText: `${name}(${argumentsText.join(', ')})`, parameters, returnType, example };
}

const tcp = createStandardModule({
  id: 'lingbuilder.net.tcp', name: 'TCP通信模块', category: '网络',
  description: '提供单连接 TCP 客户端的连接、UTF-8 文本收发、超时和关闭能力。', tags: ['TCP', 'Socket'],
  commands: [
    command('TCP_连接', [{ name: '主机', type: 'wideString', description: '目标主机名或 IP 文本；同时按 IPv4 和 IPv6 尝试，逐个地址直到连上为止。'}, { name: '端口', type: 'int', description: '服务端端口，1 到 65535；超范围直接判为参数无效。'}, { name: '超时毫秒', type: 'int', description: '连接以及后续收发的超时毫秒数；小于 1 时按 1 毫秒处理。'}], 'bool', '连接 TCP 服务端。', 'TCP_连接("127.0.0.1", 9000, 5000)'),
    command('TCP_发送文本', [{ name: '内容', type: 'wideString', description: '要发送的文本，按 UTF-8 编码后循环发送直到全部发出；未连接或发送中断返回 -1。'}], 'int', '发送完整 UTF-8 文本，返回字节数，失败返回 -1。'),
    command('TCP_接收文本', [{ name: '最大字节数', type: 'int', description: '单次最多接收的字节数，上限 16 MiB；小于 1 时按 1 处理，收到的字节按 UTF-8 严格解码。'}], 'wideString', '接收一批 UTF-8 文本。'),
    command('TCP_是否已连接', [], 'bool', '判断当前 TCP 句柄是否处于连接状态。'),
    command('TCP_取错误', [], 'wideString', '返回最近 TCP 中文错误。'),
    command('TCP_关闭', [], 'void', '关闭当前 TCP 连接。')
  ]
});

const udp = createStandardModule({
  id: 'lingbuilder.net.udp', name: 'UDP通信模块', category: '网络',
  description: '提供 UDP 绑定、UTF-8 数据报发送接收和关闭能力。', tags: ['UDP', 'Socket'],
  commands: [
    command('UDP_绑定', [{ name: '端口', type: 'int', description: '要绑定的本机 UDP 端口，0 到 65535；0 表示由系统分配端口，绑定在本机全部接口上。'}], 'bool', '在本机全部接口绑定 UDP 端口。'),
    command('UDP_发送文本', [{ name: '主机', type: 'wideString', description: '目标主机名或地址；只按 IPv4 解析，解析失败返回 -1。'}, { name: '端口', type: 'int', description: '目标端口，1 到 65535；超范围返回 -1。'}, { name: '内容', type: 'wideString', description: '数据报正文，按 UTF-8 编码为一条数据报发出，不保证到达也不自动分片重发。'}], 'int', '发送一条 UTF-8 UDP 数据报。'),
    command('UDP_接收文本', [{ name: '最大字节数', type: 'int', description: '单个数据报最多接收的字节数，上限 65507；小于 1 时按 1 处理，超出部分会被丢弃。'}, { name: '超时毫秒', type: 'int', description: '等待数据报的超时毫秒数；小于 1 时按 1 处理，超时返回空文本。'}], 'wideString', '接收一条 UDP 数据报，超时返回空文本。'),
    command('UDP_取来源地址', [], 'wideString', '返回最近数据报来源 IP。'),
    command('UDP_取来源端口', [], 'int', '返回最近数据报来源端口。'),
    command('UDP_取错误', [], 'wideString', '返回最近 UDP 中文错误。'),
    command('UDP_关闭', [], 'void', '关闭当前 UDP 套接字。')
  ]
});

const dns = createStandardModule({
  id: 'lingbuilder.net.dns', name: 'DNS与IP模块', category: '网络',
  description: '提供域名解析、本机名、IP 格式检查和反向查询。', tags: ['DNS', 'IP'],
  commands: [
    command('DNS_解析首个地址', [{ name: '主机名', type: 'wideString', description: '要解析的域名或 IP 文本；解析失败返回空文本。'}], 'wideString', '解析并返回首个 IPv4 或 IPv6 地址。', 'DNS_解析首个地址("example.com")'),
    command('DNS_反向查询', [{ name: 'IP地址', type: 'wideString', description: '点分 IPv4 或标准 IPv6 文本；传入域名等非法地址直接返回空文本，没有 PTR 记录同样返回空文本。'}], 'wideString', '对 IP 地址执行反向名称查询。'),
    command('网络_取本机名', [], 'wideString', '返回 Winsock 本机主机名。'),
    command('网络_是否IPv4', [{ name: '地址', type: 'wideString', description: '待检查的地址文本，必须是点分十进制 IPv4，不接受前导零之外的空格或端口写法。'}], 'bool', '检查是否为合法 IPv4 文本。'),
    command('网络_是否IPv6', [{ name: '地址', type: 'wideString', description: '待检查的地址文本，必须是冒号分隔的 IPv6，允许双冒号缩写形式。'}], 'bool', '检查是否为合法 IPv6 文本。')
  ]
});

const url = createStandardModule({
  id: 'lingbuilder.net.url', name: 'URL解析模块', category: '网络',
  description: '使用 WinHTTP 解析 URL 的协议、主机、端口和路径。', tags: ['URL'],
  commands: [
    command('URL_是否有效', [{ name: '地址', type: 'wideString', description: urlArg}], 'bool', '判断 URL 是否可被 WinHTTP 解析。'),
    command('URL_取协议', [{ name: '地址', type: 'wideString', description: urlArg}], 'wideString', '返回 http 或 https 等协议名。'),
    command('URL_取主机', [{ name: '地址', type: 'wideString', description: urlArg}], 'wideString', '返回 URL 主机名。'),
    command('URL_取端口', [{ name: '地址', type: 'wideString', description: `${urlArg}未显式写端口时返回该协议的默认端口。`}], 'int', '返回 URL 端口。'),
    command('URL_取路径', [{ name: '地址', type: 'wideString', description: `${urlArg}返回值含问号后的查询串和锚点等附加信息。`}], 'wideString', '返回 URL 路径和附加信息。'),
    command('URL_是否HTTPS', [{ name: '地址', type: 'wideString', description: urlArg}], 'bool', '判断 URL 是否使用 HTTPS。')
  ]
});

const cookie = createStandardModule({
  id: 'lingbuilder.net.cookie', name: 'Cookie文本模块', category: '网络',
  description: '提供 Cookie 请求头文本的读取、设置、删除和存在性检查。', tags: ['Cookie', 'HTTP'],
  commands: [
    command('Cookie_取值', [{ name: 'Cookie文本', type: 'wideString', description: cookieHeaderArg}, { name: '名称', type: 'wideString', description: `${cookieNameArg}不存在时返回空文本。`}], 'wideString', '读取 Cookie 请求头中的指定值。'),
    command('Cookie_是否存在', [{ name: 'Cookie文本', type: 'wideString', description: cookieHeaderArg}, { name: '名称', type: 'wideString', description: cookieNameArg}], 'bool', '判断 Cookie 名称是否存在。'),
    command('Cookie_设置', [{ name: 'Cookie文本', type: 'wideString', description: cookieHeaderArg}, { name: '名称', type: 'wideString', description: cookieNameArg}, { name: '值', type: 'wideString', description: '新的 Cookie 值；不能包含分号，否则重新解析时会被截断。'}], 'wideString', '添加或替换 Cookie 值。'),
    command('Cookie_删除', [{ name: 'Cookie文本', type: 'wideString', description: cookieHeaderArg}, { name: '名称', type: 'wideString', description: `${cookieNameArg}名称不存在时返回原文本。`}], 'wideString', '删除指定 Cookie。'),
    command('Cookie_生成响应项', [{ name: '名称', type: 'wideString', description: 'Set-Cookie 左侧的 Cookie 名称。'}, { name: '值', type: 'wideString', description: 'Cookie 值，直接拼接不做转义，不能包含分号。'}, { name: '路径', type: 'wideString', description: 'Cookie 的 Path 属性；空文本时不输出 Path。'}, { name: '最大秒数', type: 'int', description: 'Max-Age 秒数；小于 0 时不输出 Max-Age。生成的响应项固定附带 HttpOnly 和 SameSite=Lax。'}], 'wideString', '生成一条 Set-Cookie 响应值。')
  ]
});

const ftp = createStandardModule({
  id: 'lingbuilder.net.ftp', name: 'FTP客户端模块', category: '网络',
  description: '基于 WinINet 提供 FTP/FTPS 连接、上传、下载、删除、改名和关闭。', tags: ['FTP', 'FTPS'],
  commands: [
    command('FTP_连接', [{ name: '主机', type: 'wideString', description: 'FTP 服务器主机名或 IP。'}, { name: '端口', type: 'int', description: '控制端口；小于等于 0 时使用 FTP 默认端口 21。'}, { name: '用户名', type: 'wideString', description: '登录账号；空文本按匿名登录处理。'}, { name: '密码', type: 'wideString', description: '登录密码；空文本表示不提交密码。'}, { name: '安全连接', type: 'bool', description: '传真按 FTPS 建立加密控制连接，传假使用明文 FTP。'}], 'bool', '连接 FTP 或 FTPS 服务端。'),
    command('FTP_上传文件', [{ name: '本地文件', type: 'wideString', description: '要上传的本机文件路径，文件必须已存在。'}, { name: '远程文件', type: 'wideString', description: '服务器上的目标路径，相对当前登录目录，以二进制方式传输。'}], 'bool', '以二进制模式上传文件。'),
    command('FTP_下载文件', [{ name: '远程文件', type: 'wideString', description: '服务器上的源文件路径，相对当前登录目录，以二进制方式传输。'}, { name: '本地文件', type: 'wideString', description: '保存到本机的路径；所在目录必须已存在。'}, { name: '允许覆盖', type: 'bool', description: '传真时本地同名文件会被覆盖，传假时本地文件已存在则下载失败。'}], 'bool', '以二进制模式下载文件。'),
    command('FTP_删除文件', [{ name: '远程文件', type: 'wideString', description: '服务器上要删除的文件路径。'}], 'bool', '删除远程文件。'),
    command('FTP_重命名', [{ name: '原名称', type: 'wideString', description: '服务器上的原文件路径。'}, { name: '新名称', type: 'wideString', description: '服务器上的新文件路径，只能在同一台服务器上改名。'}], 'bool', '重命名远程文件。'),
    command('FTP_取错误', [], 'wideString', '返回最近 FTP 中文错误。'),
    command('FTP_关闭', [], 'void', '关闭 FTP 连接和会话。')
  ]
});

export const NETWORK_LIBRARY_MODULES: LingBuilderModuleManifest[] = [HTTP_CLIENT_MODULE, CDP_CLIENT_MODULE, WEB_HTTP_MODULE, tcp, udp, dns, url, cookie, ftp];
