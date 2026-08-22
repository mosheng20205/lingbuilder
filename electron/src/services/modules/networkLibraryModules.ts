import { LingBuilderModuleManifest, ModuleBindingValueType } from './types';
import { createStandardModule, StandardCommandSpec } from './standardLibraryModules';
import { createModuleBindingSnippetArgument } from './bindingValueType';
import { HTTP_CLIENT_MODULE } from './httpClientModule';
import { CDP_CLIENT_MODULE } from './cdpClientModule';

type Parameter = { name: string; type: ModuleBindingValueType; description?: string };

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
    command('TCP_连接', [{ name: '主机', type: 'wideString' }, { name: '端口', type: 'int' }, { name: '超时毫秒', type: 'int' }], 'bool', '连接 TCP 服务端。', 'TCP_连接("127.0.0.1", 9000, 5000)'),
    command('TCP_发送文本', [{ name: '内容', type: 'wideString' }], 'int', '发送完整 UTF-8 文本，返回字节数，失败返回 -1。'),
    command('TCP_接收文本', [{ name: '最大字节数', type: 'int' }], 'wideString', '接收一批 UTF-8 文本。'),
    command('TCP_是否已连接', [], 'bool', '判断当前 TCP 句柄是否处于连接状态。'),
    command('TCP_取错误', [], 'wideString', '返回最近 TCP 中文错误。'),
    command('TCP_关闭', [], 'void', '关闭当前 TCP 连接。')
  ]
});

const udp = createStandardModule({
  id: 'lingbuilder.net.udp', name: 'UDP通信模块', category: '网络',
  description: '提供 UDP 绑定、UTF-8 数据报发送接收和关闭能力。', tags: ['UDP', 'Socket'],
  commands: [
    command('UDP_绑定', [{ name: '端口', type: 'int' }], 'bool', '在本机全部接口绑定 UDP 端口。'),
    command('UDP_发送文本', [{ name: '主机', type: 'wideString' }, { name: '端口', type: 'int' }, { name: '内容', type: 'wideString' }], 'int', '发送一条 UTF-8 UDP 数据报。'),
    command('UDP_接收文本', [{ name: '最大字节数', type: 'int' }, { name: '超时毫秒', type: 'int' }], 'wideString', '接收一条 UDP 数据报，超时返回空文本。'),
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
    command('DNS_解析首个地址', [{ name: '主机名', type: 'wideString' }], 'wideString', '解析并返回首个 IPv4 或 IPv6 地址。', 'DNS_解析首个地址("example.com")'),
    command('DNS_反向查询', [{ name: 'IP地址', type: 'wideString' }], 'wideString', '对 IP 地址执行反向名称查询。'),
    command('网络_取本机名', [], 'wideString', '返回 Winsock 本机主机名。'),
    command('网络_是否IPv4', [{ name: '地址', type: 'wideString' }], 'bool', '检查是否为合法 IPv4 文本。'),
    command('网络_是否IPv6', [{ name: '地址', type: 'wideString' }], 'bool', '检查是否为合法 IPv6 文本。')
  ]
});

const url = createStandardModule({
  id: 'lingbuilder.net.url', name: 'URL解析模块', category: '网络',
  description: '使用 WinHTTP 解析 URL 的协议、主机、端口和路径。', tags: ['URL'],
  commands: [
    command('URL_是否有效', [{ name: '地址', type: 'wideString' }], 'bool', '判断 URL 是否可被 WinHTTP 解析。'),
    command('URL_取协议', [{ name: '地址', type: 'wideString' }], 'wideString', '返回 http 或 https 等协议名。'),
    command('URL_取主机', [{ name: '地址', type: 'wideString' }], 'wideString', '返回 URL 主机名。'),
    command('URL_取端口', [{ name: '地址', type: 'wideString' }], 'int', '返回 URL 端口。'),
    command('URL_取路径', [{ name: '地址', type: 'wideString' }], 'wideString', '返回 URL 路径和附加信息。'),
    command('URL_是否HTTPS', [{ name: '地址', type: 'wideString' }], 'bool', '判断 URL 是否使用 HTTPS。')
  ]
});

const cookie = createStandardModule({
  id: 'lingbuilder.net.cookie', name: 'Cookie文本模块', category: '网络',
  description: '提供 Cookie 请求头文本的读取、设置、删除和存在性检查。', tags: ['Cookie', 'HTTP'],
  commands: [
    command('Cookie_取值', [{ name: 'Cookie文本', type: 'wideString' }, { name: '名称', type: 'wideString' }], 'wideString', '读取 Cookie 请求头中的指定值。'),
    command('Cookie_是否存在', [{ name: 'Cookie文本', type: 'wideString' }, { name: '名称', type: 'wideString' }], 'bool', '判断 Cookie 名称是否存在。'),
    command('Cookie_设置', [{ name: 'Cookie文本', type: 'wideString' }, { name: '名称', type: 'wideString' }, { name: '值', type: 'wideString' }], 'wideString', '添加或替换 Cookie 值。'),
    command('Cookie_删除', [{ name: 'Cookie文本', type: 'wideString' }, { name: '名称', type: 'wideString' }], 'wideString', '删除指定 Cookie。'),
    command('Cookie_生成响应项', [{ name: '名称', type: 'wideString' }, { name: '值', type: 'wideString' }, { name: '路径', type: 'wideString' }, { name: '最大秒数', type: 'int' }], 'wideString', '生成一条 Set-Cookie 响应值。')
  ]
});

const ftp = createStandardModule({
  id: 'lingbuilder.net.ftp', name: 'FTP客户端模块', category: '网络',
  description: '基于 WinINet 提供 FTP/FTPS 连接、上传、下载、删除、改名和关闭。', tags: ['FTP', 'FTPS'],
  commands: [
    command('FTP_连接', [{ name: '主机', type: 'wideString' }, { name: '端口', type: 'int' }, { name: '用户名', type: 'wideString' }, { name: '密码', type: 'wideString' }, { name: '安全连接', type: 'bool' }], 'bool', '连接 FTP 或 FTPS 服务端。'),
    command('FTP_上传文件', [{ name: '本地文件', type: 'wideString' }, { name: '远程文件', type: 'wideString' }], 'bool', '以二进制模式上传文件。'),
    command('FTP_下载文件', [{ name: '远程文件', type: 'wideString' }, { name: '本地文件', type: 'wideString' }, { name: '允许覆盖', type: 'bool' }], 'bool', '以二进制模式下载文件。'),
    command('FTP_删除文件', [{ name: '远程文件', type: 'wideString' }], 'bool', '删除远程文件。'),
    command('FTP_重命名', [{ name: '原名称', type: 'wideString' }, { name: '新名称', type: 'wideString' }], 'bool', '重命名远程文件。'),
    command('FTP_取错误', [], 'wideString', '返回最近 FTP 中文错误。'),
    command('FTP_关闭', [], 'void', '关闭 FTP 连接和会话。')
  ]
});

export const NETWORK_LIBRARY_MODULES: LingBuilderModuleManifest[] = [HTTP_CLIENT_MODULE, CDP_CLIENT_MODULE, tcp, udp, dns, url, cookie, ftp];
