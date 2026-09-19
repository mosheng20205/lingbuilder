import fs from 'node:fs/promises';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const root = path.join(repoRoot, 'AI 视频自主生产', 'EdgeView 浏览器模块合集');

const intro = `<!doctype html><html lang='zh-CN'><meta charset='utf-8'><title>LingBuilder EdgeView 测试页</title><style>body{font-family:Microsoft YaHei UI,sans-serif;background:#f8fafc;padding:48px}main{max-width:720px;margin:auto;background:#fff;border-left:6px solid #2563eb;padding:28px}</style><main><h1>EdgeView 本地测试页</h1><p>只用于教程录制，不访问公网。</p></main>`;
const form = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>EdgeView 本地表单</title>
<style>
  body { font-family: "Segoe UI", "Microsoft YaHei", sans-serif; background: #f4f7fb; color: #172033; margin: 0; padding: 28px; }
  main { max-width: 640px; margin: 0 auto; background: #fff; border: 1px solid #dbe4f0; border-radius: 14px; padding: 26px 28px; }
  h1 { margin: 0 0 4px; font-size: 22px; color: #1d4ed8; }
  .tip { margin: 0 0 18px; color: #64748b; font-size: 13px; }
  label { display: block; margin: 14px 0 6px; font-weight: 600; font-size: 14px; }
  input { box-sizing: border-box; width: 100%; padding: 10px 12px; border: 1px solid #b8c4d6; border-radius: 7px; font-size: 16px; }
  input:focus { outline: 2px solid #93c5fd; border-color: #2563eb; }
  button { margin-top: 22px; padding: 10px 22px; border: 0; border-radius: 7px; background: #2563eb; color: #fff; font-size: 15px; font-weight: 700; }
  button:disabled { background: #b8c4d6; }
  #result { margin-top: 18px; padding: 12px 14px; border-radius: 8px; background: #fff7ed; color: #9a3412; font-size: 15px; font-weight: 600; }
  #result[data-state="pass"] { background: #ecfdf5; color: #047857; }
  #result[data-state="sent"] { background: #eff6ff; color: #1d4ed8; }
</style>
</head>
<body>
<main>
  <h1>本地测试表单</h1>
  <p class="tip">仅用于教程演示：数据为虚构值，页面不访问公网。</p>
  <label for="name">姓名</label>
  <input id="name" placeholder="例如：林小明">
  <label for="email">邮箱</label>
  <input id="email" placeholder="demo@example.test">
  <label for="count">数量</label>
  <input id="count" type="number" value="1" min="1">
  <button id="submit" type="button" disabled>提交测试</button>
  <p id="result" data-state="idle">等待校验</p>
</main>
<script>
var result = document.getElementById('result');
var submit = document.getElementById('submit');
function fields() {
  return [document.getElementById('name'), document.getElementById('email'), document.getElementById('count')];
}
function validate() {
  var f = fields();
  var ok = f[0].value.trim() !== '' && f[1].value.indexOf('@') > 0 && Number(f[2].value) > 0;
  result.textContent = ok ? '校验通过' : '请检查字段';
  result.dataset.state = ok ? 'pass' : 'idle';
  submit.disabled = !ok;
  return ok;
}
fields().forEach(function (input) {
  input.addEventListener('input', validate);
  input.addEventListener('change', validate);
});
submit.addEventListener('click', function () {
  if (!validate()) { return; }
  var f = fields();
  var record = { 姓名: f[0].value, 邮箱: f[1].value, 数量: f[2].value };
  localStorage.setItem('edgeview-demo-record', JSON.stringify(record));
  result.textContent = '已提交到本地存储';
  result.dataset.state = 'sent';
});
validate();
</script>
</body>
</html>
`;
// 第 12 集旁白要演示「页面触发测试下载」，纯表单页没有任何能触发 下载开始 的元素。
const capstone = form.replace('<p id="result" data-state="idle">', '<link rel="stylesheet" href="https://skin.capstone.local/skin.css">\n  <p><a id="download" download="edgeview-demo.txt" href="data:text/plain;charset=utf-8,EdgeView%20ep12%20demo%EF%BC%9A%E4%BB%85%E6%9C%AC%E5%9C%B0%E7%94%9F%E6%88%90%EF%BC%8C%E4%B8%8D%E8%AE%BF%E9%97%AE%E5%85%AC%E7%BD%91%E3%80%82">下载演示文件</a></p>\n  <p id="result" data-state="idle">');
const isolation = `<!doctype html><html lang='zh-CN'><meta charset='utf-8'><title>EdgeView 会话隔离页</title><style>body{font-family:Microsoft YaHei UI,sans-serif;background:#f4f7fb;margin:0;padding:22px}main{max-width:520px;margin:auto;background:#fff;border:1px solid #dbe4f0;border-radius:12px;padding:22px}h1{margin:0 0 4px;font-size:20px;color:#1d4ed8}.tip{margin:0 0 14px;color:#64748b;font-size:13px}#state{margin-top:14px;padding:10px 12px;border-radius:8px;background:#eff6ff;color:#1d4ed8;font-size:15px;font-weight:600}#state[data-state="empty"]{background:#fff7ed;color:#9a3412}</style><body><main><h1>会话隔离测试页</h1><p class="tip">同一份本地页面，两个独立缓存目录；只读写 localStorage，不访问公网。</p><div id="state">等待读取</div></main><script>var s=document.getElementById('state');var v=localStorage.getItem('演示键');if(v){s.textContent='读到：'+v;}else{s.textContent='本地存储为空';s.dataset.state='empty';}</script></body></html>`;
const settings = `<!doctype html><html lang='zh-CN'><meta charset='utf-8'><title>EdgeView 设置回显页</title><style>body{font-family:Microsoft YaHei UI,sans-serif;background:#f4f7fb;margin:0;padding:24px}main{max-width:640px;margin:auto;background:#fff;border:1px solid #dbe4f0;border-radius:12px;padding:24px}h1{margin:0 0 4px;font-size:22px;color:#1d4ed8}.tip{margin:0 0 14px;color:#64748b;font-size:13px}.row{display:flex;justify-content:space-between;gap:18px;padding:10px 0;border-top:1px solid #eef2f7;font-size:14px}.k{color:#475569;font-weight:600}.v{font-family:Consolas,monospace;color:#0f172a;text-align:right;word-break:break-all}#zoom{margin-top:16px;padding:10px 14px;background:#eff6ff;border-radius:8px;font-size:16px;font-weight:700;color:#1d4ed8}</style><body><main><h1>浏览器设置回显页</h1><p class="tip">只读本地环境，不访问公网。</p><div class="row"><span class="k">navigator.userAgent</span><span class="v" id="ua">-</span></div><div class="row"><span class="k">window.innerWidth</span><span class="v" id="w">-</span></div><div id="zoom">缩放一变，这一行和上面的宽度数字立刻跟着变</div></main><script>function refresh(){document.getElementById('ua').textContent=navigator.userAgent;document.getElementById('w').textContent=String(window.innerWidth);}refresh();window.addEventListener('resize',refresh);</script></body></html>`;
const pageShell = (title: string, heading: string, tip: string, body: string, script: string) => `<!doctype html><html lang='zh-CN'><meta charset='utf-8'><title>${title}</title><style>body{font-family:Microsoft YaHei UI,sans-serif;background:#f4f7fb;margin:0;padding:24px}main{max-width:680px;margin:auto;background:#fff;border:1px solid #dbe4f0;border-radius:12px;padding:24px}h1{margin:0 0 4px;font-size:22px;color:#1d4ed8}.tip{margin:0 0 14px;color:#64748b;font-size:13px}.row{display:flex;justify-content:space-between;gap:18px;padding:9px 0;border-top:1px solid #eef2f7;font-size:14px}.k{color:#475569;font-weight:600}.v{font-family:Consolas,monospace;color:#0f172a;text-align:right;word-break:break-all}#log{margin-top:14px;padding:10px 12px;border-radius:8px;background:#eff6ff;color:#1d4ed8;font-size:15px;font-weight:600}</style><body><main><h1>${heading}</h1><p class="tip">${tip}</p>${body}<div id="log">等待程序侧调用</div><script>${script}</script></main></body></html>`;
const echoReads = "document.getElementById('u').textContent=location.href;document.getElementById('ua').textContent=navigator.userAgent;";
const proxyEcho = pageShell('EdgeView 代理回显页', '代理作用域回显页',
  '本页只读本地环境。代理是否命中由程序侧 EdgeView_取实例代理 确认；演示只用回环端口，不外发流量。',
  "<div class='row'><span class='k'>location.href</span><span class='v' id='u'>-</span></div><div class='row'><span class='k'>navigator.userAgent</span><span class='v' id='ua'>-</span></div>",
  echoReads);
const eventsPage = pageShell('EdgeView 事件测试页', '事件测试页',
  '页面标题会在一秒后自动改变，用来真实触发「导航开始 / 导航完成 / 标题改变」三个事件。',
  "<div class='row'><span class='k'>当前标题</span><span class='v' id='t'>初始标题</span></div>",
  "setTimeout(function(){document.title='标题已改变 · EdgeView 事件';var t=document.getElementById('t');if(t){t.textContent=document.title;}},1000);");
const messagePage = pageShell('EdgeView 消息页', '网页与程序双向消息',
  '网页侧通过 chrome.webview 接收程序发来的消息，并用 postMessage 回传处理结果。',
  "<div class='row'><span class='k'>收到的字符串</span><span class='v' id='s'>-</span></div><div class='row'><span class='k'>收到的 JSON</span><span class='v' id='j'>-</span></div>",
  "window.chrome=window.chrome||{};window.chrome.webview=window.chrome.webview||{addEventListener:function(){},postMessage:function(){}};chrome.webview.addEventListener('message',function(e){var d=e.data;if(typeof d==='string'){document.getElementById('s').textContent=d;}else{document.getElementById('j').textContent=JSON.stringify(d);}document.getElementById('log').textContent='网页已收到并回传';chrome.webview.postMessage({from:'page',echo:d});});");
const outputPage = pageShell('EdgeView 导出测试页', '打印 / 截图 / DevTools 测试页',
  '本页内容足够撑满一页，便于检查导出的 PDF 与 PNG；控制台日志用于观察开发者工具事件。',
  "<div class='row'><span class='k'>location.href</span><span class='v' id='u'>-</span></div><p>正文段落：LingBuilder 把网页嵌进中文软件后，仍然可以导出成文件、截图，并打开真实的开发者工具。</p>",
  echoReads + "console.log('EdgeView 导出测试页已加载');");
const securityPage = pageShell('EdgeView 会话与安全页', '会话 / 权限 / 安全边界',
  '演示只使用测试键名与脱敏值，清理动作只作用于本集独立的 Profile 目录。',
  "<div class='row'><span class='k'>location.href</span><span class='v' id='u'>-</span></div><div class='row'><span class='k'>navigator.userAgent</span><span class='v' id='ua'>-</span></div>",
  echoReads);
const find = `<!doctype html><html lang='zh-CN'><meta charset='utf-8'><title>EdgeView 下载与查找</title><h1>重复关键词测试页</h1><p>LingBuilder EdgeView 让页面查找更快。</p><p>再次出现 EdgeView，便于验证。</p><a id='dl' download='edgeview-demo.txt' href='data:text/plain;charset=utf-8,EdgeView%20demo'>下载测试文件</a>`;

type Episode = { no: string; id: string; name: string; runtime: string; title: string; commands: string[]; lines: string[]; asset?: [string, string]; extraModules?: string[] };
const esc = (text: string) => text.replace(/\\/g, '\\\\').replace(/\r?\n/g, ' ');
const e = (no: string, id: string, name: string, runtime: string, title: string, commands: string[], lines: string[], asset?: [string, string], extraModules?: string[]): Episode => ({ no, id, name, runtime, title, commands, lines, asset, extraModules });

const episodes: Episode[] = [
  e('01','edgeview-ep01-intro','EdgeView 入门示例','WebView2 Runtime 141+','EdgeView 入门：把网页嵌进窗口',['EdgeView_导航控件','EdgeView_执行JS控件','EdgeView导航_设置虚拟主机','路径_转绝对路径'],['事件 _MainWindow_创建完毕()','    EdgeView导航_设置虚拟主机(浏览器控件, "intro.local", 路径_转绝对路径("assets"), 1)','    EdgeView_导航控件(浏览器控件, "https://intro.local/intro.html")','结束','','事件 _运行按钮_被单击()','    局部 文本型 页面标题 = EdgeView_执行JS控件(浏览器控件, "document.title")','    调试输出(页面标题)','    控件_设置文本(运行状态, 页面标题)','结束'],['assets/intro.html',intro],['lingbuilder.fs.path']),
  e('02','edgeview-ep02-isolation','EdgeView 多实例与会话隔离示例','WebView2 Runtime 141+','EdgeView 多实例与会话隔离',['EdgeView_导航控件','EdgeView导航_设置虚拟主机','路径_转绝对路径','EdgeView会话_置Cookie','EdgeView会话_取Cookie异步','EdgeView_执行JS控件','EdgeView任务_取结果','EdgeView任务_释放','EdgeView_创建实例','EdgeView_创建区域'],['事件 _MainWindow_创建完毕()','    EdgeView导航_设置虚拟主机(会话A, "iso.local", 路径_转绝对路径("assets"), 1)','    EdgeView导航_设置虚拟主机(会话B, "iso.local", 路径_转绝对路径("assets"), 1)','    EdgeView_导航控件(会话A, "https://iso.local/isolation.html")','    EdgeView_导航控件(会话B, "https://iso.local/isolation.html")','    EdgeView会话_置Cookie(会话A, "演示键", "脱敏值", "iso.local", "/")','    控件_设置文本(运行状态, "会话 A / 会话 B：不同缓存目录，同一份本地页面。")','结束','',`事件 _运行按钮_被单击()`,`    控件_设置文本(运行状态, EdgeView_执行JS控件(会话A, "localStorage['setItem']('演示键','只在A出现');'A 已写入演示键'"))`,`    EdgeView_导航控件(会话A, "https://iso.local/isolation.html")`,`    EdgeView_导航控件(会话B, "https://iso.local/isolation.html")`,'结束','',`事件 _读取按钮_被单击()`,`    控件_设置文本(运行状态, EdgeView_执行JS控件(会话B, "localStorage['getItem']('演示键') || 'B 读不到：会话已隔离'"))`,'结束','','事件 _Cookie按钮_被单击()','    EdgeView会话_取Cookie异步(会话A, "https://iso.local", &Cookie完成)','结束','','事件 Cookie完成()','    控件_设置文本(运行状态, EdgeView任务_取结果(EdgeView任务_取当前任务ID()))','    EdgeView任务_释放(EdgeView任务_取当前任务ID())','结束'],['assets/isolation.html',isolation],['lingbuilder.fs.path']),
  e('03','edgeview-ep03-settings','EdgeView 浏览器设置示例','WebView2 Runtime 150+','EdgeView 浏览器设置与创建选项',['EdgeView_导航控件','EdgeView_执行JS控件','EdgeView导航_设置虚拟主机','路径_转绝对路径','EdgeView设置_置用户代理','EdgeView设置_置缩放','EdgeView设置_置静音','EdgeView创建选项_置独占用户目录','EdgeView创建选项_重建控件'],['事件 _MainWindow_创建完毕()','    EdgeView导航_设置虚拟主机(浏览器控件, "settings.local", 路径_转绝对路径("assets"), 1)','    EdgeView_导航控件(浏览器控件, "https://settings.local/settings.html")','    控件_设置文本(运行状态, "本地回显页已准备：assets/settings.html")','结束','','事件 _运行时设置按钮_被单击()','    EdgeView设置_置用户代理(浏览器控件, "LingBuilder-Tutorial/1.0")','    EdgeView设置_置缩放(浏览器控件, 1.5)','    EdgeView设置_置静音(浏览器控件, 真)','结束','','事件 _重建按钮_被单击()','    EdgeView创建选项_置独占用户目录(浏览器控件, 真)','    EdgeView创建选项_重建控件(浏览器控件)','    EdgeView导航_设置虚拟主机(浏览器控件, "settings.local", 路径_转绝对路径("assets"), 1)','    EdgeView_导航控件(浏览器控件, "https://settings.local/settings.html")','    控件_设置文本(运行状态, "控件已重建：创建期选项与虚拟主机映射都要重新应用。")','结束','',`事件 _运行按钮_被单击()`,`    控件_设置文本(运行状态, EdgeView_执行JS控件(浏览器控件, "navigator.userAgent + ' | 宽度 ' + window.innerWidth"))`,'结束'],['assets/settings.html',settings],['lingbuilder.fs.path']),
  e('04','edgeview-ep04-proxy','EdgeView 代理作用域示例','WebView2 Runtime 141+','EdgeView 代理：全局与实例级',['EdgeView_清除全局代理','EdgeView_设置全局代理','EdgeView_取全局代理','EdgeView_创建实例代理','EdgeView_创建区域代理','EdgeView_取实例代理','EdgeView_导航控件','EdgeView导航_设置虚拟主机','路径_转绝对路径'],['事件 _MainWindow_创建完毕()','    EdgeView_清除全局代理()','    EdgeView导航_设置虚拟主机(浏览器控件, "proxy.local", 路径_转绝对路径("assets"), 1)','    EdgeView_导航控件(浏览器控件, "https://proxy.local/proxy-echo.html")','    控件_设置文本(运行状态, "默认无代理；演示只用回环测试端口。")','结束','','事件 _运行按钮_被单击()','    调试输出(EdgeView_设置全局代理("http://127.0.0.1:8888"))','    控件_设置文本(运行状态, 格式化文本("全局代理 → {}", EdgeView_取全局代理()))','结束','','事件 _实例代理按钮_被单击()','    调试输出(EdgeView_创建实例代理(41, 0, "https://proxy.local/proxy-echo.html", ".edgeview/ep04/instance-41", "http://127.0.0.1:8889"))','    控件_设置文本(运行状态, 格式化文本("实例 41 实际代理 → {}", EdgeView_取实例代理(41)))','结束','','事件 _区域代理按钮_被单击()','    调试输出(EdgeView_创建区域代理(42, 24, 720, 500, 100, "https://proxy.local/proxy-echo.html", ".edgeview/ep04/region-42", "socks5://127.0.0.1:8890"))','    控件_设置文本(运行状态, 格式化文本("区域 42 实际代理 → {}", EdgeView_取实例代理(42)))','结束'],['assets/proxy-echo.html',proxyEcho],['lingbuilder.fs.path']),
  e('05','edgeview-ep05-events','EdgeView 事件驱动示例','WebView2 Runtime 141+','EdgeView 事件驱动：让代码响应网页',['EdgeView_绑定控件事件','EdgeView_取事件数据控件','EdgeView事件_取字段','EdgeView_导航控件','EdgeView导航_设置虚拟主机','路径_转绝对路径'],['事件 _MainWindow_创建完毕()','    EdgeView_绑定控件事件(浏览器控件, "导航开始", &导航开始)','    EdgeView_绑定控件事件(浏览器控件, "导航完成", &导航完成)','    EdgeView_绑定控件事件(浏览器控件, "标题改变", &标题改变)','    EdgeView导航_设置虚拟主机(浏览器控件, "events.local", 路径_转绝对路径("assets"), 1)','    控件_设置文本(运行状态, "已绑定 导航开始 / 导航完成 / 标题改变。")','结束','','事件 导航开始()','    控件_设置文本(运行状态, 格式化文本("导航开始：{}", EdgeView事件_取字段(浏览器控件, "uri")))','    调试输出(EdgeView_取事件数据控件(浏览器控件))','结束','','事件 导航完成()','    控件_设置文本(运行状态, 格式化文本("导航完成：{}", EdgeView事件_取字段(浏览器控件, "uri")))','    调试输出(EdgeView_取事件数据控件(浏览器控件))','结束','','事件 标题改变()','    控件_设置文本(运行状态, 格式化文本("标题改变：{}", EdgeView_取事件数据控件(浏览器控件)))','    调试输出(EdgeView_取事件数据控件(浏览器控件))','结束','','事件 _运行按钮_被单击()','    EdgeView_导航控件(浏览器控件, "https://events.local/events.html")','结束'],['assets/events.html',eventsPage],['lingbuilder.fs.path']),
  e('06','edgeview-ep06-messaging','EdgeView JavaScript 与消息示例','WebView2 Runtime 150+','EdgeView JavaScript 与网页消息',['EdgeView设置_置网页消息','EdgeView脚本_执行详情异步','EdgeView任务_取当前任务ID','EdgeView任务_取状态','EdgeView任务_取结果','EdgeView任务_释放','EdgeView脚本_发送字符串消息','EdgeView脚本_发送JSON消息','EdgeView_绑定控件事件','EdgeView_导航控件','EdgeView导航_设置虚拟主机','路径_转绝对路径'],['事件 _MainWindow_创建完毕()','    EdgeView设置_置网页消息(浏览器控件, 真)','    EdgeView_绑定控件事件(浏览器控件, "网页消息", &收到网页消息)','    EdgeView导航_设置虚拟主机(浏览器控件, "msg.local", 路径_转绝对路径("assets"), 1)','    EdgeView_导航控件(浏览器控件, "https://msg.local/message.html")','    EdgeView脚本_执行详情异步(浏览器控件, "document.title", &脚本完成)','结束','','事件 脚本完成()','    局部 长整数型 任务ID = EdgeView任务_取当前任务ID()','    控件_设置文本(运行状态, 格式化文本("任务 {} 状态 {} → {}", 任务ID, EdgeView任务_取状态(任务ID), EdgeView任务_取结果(任务ID)))','    EdgeView任务_释放(任务ID)','结束','','事件 收到网页消息()','    控件_设置文本(运行状态, 格式化文本("网页回传：{}", EdgeView_取事件数据控件(浏览器控件)))','结束','','事件 _运行按钮_被单击()','    EdgeView脚本_发送字符串消息(浏览器控件, "刷新列表")','结束','','事件 _JSON按钮_被单击()','    EdgeView脚本_发送JSON消息(浏览器控件, "{\\"action\\":\\"refresh\\",\\"id\\":7}")','结束'],['assets/message.html',messagePage],['lingbuilder.fs.path']),
  e('07','edgeview-ep07-form','EdgeView 本地表单示例','WebView2 Runtime 141+','EdgeView 网页表单填充与验证',['EdgeView_执行JS控件','EdgeView_等待事件控件','EdgeView脚本_执行详情异步','EdgeView任务_取结果'],[`事件 _MainWindow_创建完毕()`,'    EdgeView导航_设置虚拟主机(浏览器控件, "form.local", 路径_转绝对路径("assets"), 1)','    EdgeView_导航控件(浏览器控件, "https://form.local/form.html")','    控件_设置文本(运行状态, 格式化文本("页面就绪等待：{}", EdgeView_等待事件控件(浏览器控件, "导航完成", 8000)))',`    EdgeView_执行JS控件(浏览器控件, "(()=>{const e=document['getElementById']('name');e['value']='林小明';e['dispatchEvent'](new Event('input',{'bubbles':true}))})()")`,`    EdgeView_执行JS控件(浏览器控件, "(()=>{const e=document['getElementById']('email');e['value']='demo@example.test';e['dispatchEvent'](new Event('change',{'bubbles':true}))})()")`,`    EdgeView_执行JS控件(浏览器控件, "(()=>{const e=document['getElementById']('count');e['value']='2';e['dispatchEvent'](new Event('change',{'bubbles':true}))})()")`,`    控件_设置文本(运行状态, "已在创建完毕里写入姓名、邮箱和数量。")`,'结束','',`事件 提交结果就绪()`,'    控件_设置文本(运行状态, EdgeView任务_取结果(EdgeView任务_取当前任务ID()))','结束','',`事件 _运行按钮_被单击()`,`    控件_设置文本(运行状态, EdgeView_执行JS控件(浏览器控件, "(()=>{const r=document['getElementById']('result');return r['dataset']['state']+' : '+r['textContent']})()"))`,'结束','',`事件 _提交按钮_被单击()`,'    EdgeView脚本_执行详情异步(浏览器控件, "(()=>{const b=document[\'getElementById\'](\'submit\');if(b[\'disabled\']){return \'校验未通过，未提交\'}b[\'click\']();return document[\'getElementById\'](\'result\')[\'textContent\']})()", &提交结果就绪)','结束'],['assets/form.html',form],['lingbuilder.fs.path']),
  e('09','edgeview-ep09-download-find','EdgeView 下载与页内查找示例','WebView2 Runtime 141+','EdgeView 下载与页内查找',['EdgeView_绑定控件事件','EdgeView事件_取字段','EdgeView事件_设置下载路径','EdgeView下载_取状态JSON','EdgeView查找_开始异步','EdgeView查找_下一项','EdgeView查找_停止','EdgeView_执行JS控件','EdgeView_导航控件','EdgeView导航_设置虚拟主机','路径_转绝对路径','EdgeView任务_取结果','EdgeView任务_释放'],['事件 _MainWindow_创建完毕()','    EdgeView_绑定控件事件(浏览器控件, "下载开始", &下载开始)','    EdgeView导航_设置虚拟主机(浏览器控件, "find.local", 路径_转绝对路径("assets"), 1)','    EdgeView_导航控件(浏览器控件, "https://find.local/download-find.html")','    控件_设置文本(运行状态, "本地页已加载：assets/download-find.html")','结束','','私有:','    长整数型 最近下载ID = 0','结束','','公开:','事件 下载开始()','    最近下载ID = 到整数(EdgeView事件_取字段(浏览器控件, "downloadId"))','    调试输出(EdgeView事件_设置下载路径(浏览器控件, ".edgeview/ep09/downloads/edgeview-demo.txt"))','    控件_设置文本(运行状态, 格式化文本("下载 {} 已改到 .edgeview/ep09/downloads/", 最近下载ID))','结束','','','事件 _运行按钮_被单击()','    EdgeView查找_开始异步(浏览器控件, "EdgeView", "{\\"findNext\\":true}", &查找完成)','结束','','事件 查找完成()','    控件_设置文本(运行状态, EdgeView任务_取结果(EdgeView任务_取当前任务ID()))','    EdgeView任务_释放(EdgeView任务_取当前任务ID())','结束','','事件 _下一项按钮_被单击()','    调试输出(EdgeView查找_下一项(浏览器控件))','结束','','事件 _停止按钮_被单击()','    调试输出(EdgeView查找_停止(浏览器控件))','结束','','事件 _下载状态按钮_被单击()','    如果 (最近下载ID != 0)','        控件_设置文本(运行状态, EdgeView下载_取状态JSON(浏览器控件, 最近下载ID))','    否则','        控件_设置文本(运行状态, "还没有测试下载，请先点「触发下载」。")','    如果结束','结束','',`事件 _下载按钮_被单击()`,`    控件_设置文本(运行状态, EdgeView_执行JS控件(浏览器控件, "document['getElementById']('dl')['click']() || '已触发下载'"))`,'结束'],['assets/download-find.html',find],['lingbuilder.fs.path']),
  e('10','edgeview-ep10-output-devtools','EdgeView 输出与 DevTools 示例','WebView2 Runtime 141+','EdgeView 打印、截图与开发者工具',['EdgeView_监听开发者工具事件控件','EdgeView_导航控件','EdgeView导航_设置虚拟主机','路径_转绝对路径','EdgeView打印_PDF异步','EdgeView媒体_截图异步','EdgeView媒体_取Favicon异步','EdgeView开发者工具_打开','EdgeView任务_取当前任务ID','EdgeView任务_取状态','EdgeView任务_取结果','EdgeView任务_取错误','EdgeView任务_释放'],['事件 _MainWindow_创建完毕()','    EdgeView_监听开发者工具事件控件(浏览器控件, "Console.messageAdded")','    EdgeView导航_设置虚拟主机(浏览器控件, "output.local", 路径_转绝对路径("assets"), 1)','    EdgeView_导航控件(浏览器控件, "https://output.local/output.html")','    控件_设置文本(运行状态, "本地页已加载：assets/output.html")','结束','','事件 _运行按钮_被单击()','    EdgeView打印_PDF异步(浏览器控件, "edgeview-ep10-page.pdf", "{\\"scaleFactor\\":1,\\"shouldPrintBackgrounds\\":true}", &PDF完成)','结束','','事件 PDF完成()','    局部 长整数型 任务ID = EdgeView任务_取当前任务ID()','    如果 (EdgeView任务_取状态(任务ID) == 1)','        控件_设置文本(运行状态, 格式化文本("PDF 已导出 → {}", EdgeView任务_取结果(任务ID)))','    否则','        控件_设置文本(运行状态, 格式化文本("PDF 状态 {} · 错误：{}", EdgeView任务_取状态(任务ID), EdgeView任务_取错误(任务ID)))','    如果结束','    EdgeView任务_释放(任务ID)','结束','','事件 _截图按钮_被单击()','    EdgeView媒体_截图异步(浏览器控件, "edgeview-ep10-page.png", 1, &截图完成)','结束','','事件 截图完成()','    局部 长整数型 任务ID = EdgeView任务_取当前任务ID()','    如果 (EdgeView任务_取状态(任务ID) == 1)','        控件_设置文本(运行状态, 格式化文本("截图已导出 → {}", EdgeView任务_取结果(任务ID)))','    否则','        控件_设置文本(运行状态, 格式化文本("截图 状态 {} · 错误：{}", EdgeView任务_取状态(任务ID), EdgeView任务_取错误(任务ID)))','    如果结束','    EdgeView任务_释放(任务ID)','结束','','事件 _图标按钮_被单击()','    EdgeView媒体_取Favicon异步(浏览器控件, "edgeview-ep10-page.ico", &图标完成)','结束','','事件 图标完成()','    局部 长整数型 任务ID = EdgeView任务_取当前任务ID()','    如果 (EdgeView任务_取状态(任务ID) == 1)','        控件_设置文本(运行状态, 格式化文本("图标已导出 → {}", EdgeView任务_取结果(任务ID)))','    否则','        控件_设置文本(运行状态, 格式化文本("图标 状态 {} · 错误：{}", EdgeView任务_取状态(任务ID), EdgeView任务_取错误(任务ID)))','    如果结束','    EdgeView任务_释放(任务ID)','结束','','事件 _开发者工具按钮_被单击()','    调试输出(EdgeView开发者工具_打开(浏览器控件))','    控件_设置文本(运行状态, "已请求打开真实 WebView2 开发者工具。")','结束'],['assets/output.html',outputPage],['lingbuilder.fs.path']),
  e('11','edgeview-ep11-security','EdgeView 会话与安全示例','WebView2 Runtime 150+','EdgeView 会话、权限与安全边界',['EdgeView会话_置Cookie','EdgeView会话_取Cookie异步','EdgeView会话_清理全部浏览数据异步','EdgeView权限_枚举异步','EdgeView权限_设置异步','EdgeView_导航控件','EdgeView导航_设置虚拟主机','路径_转绝对路径','EdgeView任务_取当前任务ID','EdgeView任务_取状态','EdgeView任务_取结果','EdgeView任务_取错误','EdgeView任务_释放'],['事件 _MainWindow_创建完毕()','    EdgeView导航_设置虚拟主机(浏览器控件, "sec.local", 路径_转绝对路径("assets"), 1)','    EdgeView_导航控件(浏览器控件, "https://sec.local/security.html")','    EdgeView会话_置Cookie(浏览器控件, "演示键", "脱敏值", "sec.local", "/")','    控件_设置文本(运行状态, "本地页已加载：assets/security.html")','结束','','事件 _运行按钮_被单击()','    EdgeView会话_取Cookie异步(浏览器控件, "https://sec.local", &Cookie完成)','结束','','事件 Cookie完成()','    控件_设置文本(运行状态, 格式化文本("Cookie → {}", EdgeView任务_取结果(EdgeView任务_取当前任务ID())))','    EdgeView任务_释放(EdgeView任务_取当前任务ID())','结束','','事件 权限完成()','    控件_设置文本(运行状态, 格式化文本("权限枚举 → {}", EdgeView任务_取结果(EdgeView任务_取当前任务ID())))','    EdgeView任务_释放(EdgeView任务_取当前任务ID())','结束','','事件 _权限按钮_被单击()','    EdgeView权限_枚举异步(浏览器控件, &权限完成)','结束','','事件 _清理按钮_被单击()','    EdgeView会话_清理全部浏览数据异步(浏览器控件, &清理完成)','结束','','事件 清理完成()','    局部 长整数型 任务ID = EdgeView任务_取当前任务ID()','    如果 (EdgeView任务_取状态(任务ID) == 1)','        控件_设置文本(运行状态, 格式化文本("清理完成 → {}", EdgeView任务_取结果(任务ID)))','    否则','        控件_设置文本(运行状态, 格式化文本("清理状态 {} · 错误：{}", EdgeView任务_取状态(任务ID), EdgeView任务_取错误(任务ID)))','    如果结束','    EdgeView任务_释放(任务ID)','结束'],['assets/security.html',securityPage],['lingbuilder.fs.path']),
  e('12','edgeview-ep12-capstone','EdgeView 综合项目','WebView2 Runtime 150+','EdgeView 综合项目：加载、拦截、填表、下载与 F5',['EdgeView_导航控件','EdgeView_执行JS控件','EdgeView_绑定控件事件','EdgeView导航_设置虚拟主机','路径_转绝对路径','EdgeView事件_取字段','EdgeView脚本_执行详情异步','EdgeView任务_取结果','EdgeView任务_取状态','EdgeView任务_取错误','EdgeView任务_释放','EdgeView资源_添加过滤器','EdgeView资源_设置事件响应文本','EdgeView资源_读响应正文异步','JSON_取文本','字节_十六进制转文本','EdgeView事件_设置下载路径','EdgeView下载_取状态JSON'],['私有:','    文本型 最近响应地址 = ""','    长整数型 最近下载ID = 0','结束','','公开:','事件 _MainWindow_创建完毕()','    EdgeView_绑定控件事件(浏览器控件, "导航完成", &导航完成)','    EdgeView_绑定控件事件(浏览器控件, "Web资源请求", &收到资源请求)','    EdgeView_绑定控件事件(浏览器控件, "Web资源响应收到", &收到资源响应)','    EdgeView_绑定控件事件(浏览器控件, "下载开始", &下载开始)','    EdgeView资源_添加过滤器(浏览器控件, "https://skin.capstone.local/skin.css", 0, 0)','    EdgeView导航_设置虚拟主机(浏览器控件, "capstone.local", 路径_转绝对路径("assets"), 1)','    EdgeView_导航控件(浏览器控件, "https://capstone.local/capstone.html")','结束','','事件 导航完成()','    EdgeView脚本_执行详情异步(浏览器控件, "document.title + \' | \' + location.href", &标题就绪)','结束','','事件 标题就绪()','    控件_设置文本(运行状态, EdgeView任务_取结果(EdgeView任务_取当前任务ID()))','    EdgeView任务_释放(EdgeView任务_取当前任务ID())','结束','','事件 收到资源请求()','    如果 (EdgeView事件_取字段(浏览器控件, "uri") == "https://skin.capstone.local/skin.css")','        调试输出(EdgeView资源_设置事件响应文本(浏览器控件, 200, "OK", "Content-Type: text/css; charset=utf-8\\r\\nCache-Control: no-store", "main{background:#f0fdfa;border-color:#0f766e}h1{color:#0f766e}"))','    如果结束','结束','','事件 收到资源响应()','    局部 长整数型 响应句柄 = 到整数(EdgeView事件_取字段(浏览器控件, "responseHandle"))','    最近响应地址 = EdgeView事件_取字段(浏览器控件, "uri")','    如果 (最近响应地址 == "https://skin.capstone.local/skin.css")','        EdgeView资源_读响应正文异步(浏览器控件, 响应句柄, 4096, &正文完成)','    否则','        控件_设置文本(运行状态, 格式化文本("响应收到：{} 句柄 {}", 最近响应地址, 响应句柄))','    如果结束','结束','','事件 _运行按钮_被单击()','    控件_设置文本(运行状态, EdgeView_执行JS控件(浏览器控件, "(()=>{const e=document[\'getElementById\'](\'name\');e[\'value\']=\'林小明\';e[\'dispatchEvent\'](new Event(\'input\',{\'bubbles\':true}));const r=document[\'getElementById\'](\'result\');return r[\'dataset\'][\'state\']+\' : \'+r[\'textContent\']})()"))','结束','','事件 _下载按钮_被单击()','    调试输出(EdgeView_执行JS控件(浏览器控件, "document[\'getElementById\'](\'download\')[\'click\']()"))','结束','','事件 下载开始()','    最近下载ID = 到整数(EdgeView事件_取字段(浏览器控件, "downloadId"))','    调试输出(EdgeView事件_设置下载路径(浏览器控件, ".edgeview/ep12/downloads/capstone.txt"))','    控件_设置文本(运行状态, 格式化文本("下载 {} 已改到 .edgeview/ep12/downloads/", 最近下载ID))','结束','','事件 _正文按钮_被单击()','    控件_设置文本(运行状态, "重新加载页面，在响应事件里立即读取被替换的样式表正文……")','    EdgeView_导航控件(浏览器控件, "https://capstone.local/capstone.html")','结束','','事件 正文完成()','    局部 长整数型 任务ID = EdgeView任务_取当前任务ID()','    局部 文本型 任务结果 = EdgeView任务_取结果(任务ID)','    如果 (EdgeView任务_取状态(任务ID) == 1)','        控件_设置文本(响应正文, 格式化文本("被替换样式表 {} 字节：{}", JSON_取文本(任务结果, "byteCount"), 字节_十六进制转文本(JSON_取文本(任务结果, "hex"))))','    否则','        控件_设置文本(响应正文, 格式化文本("正文读取状态 {} · 错误：{}", EdgeView任务_取状态(任务ID), EdgeView任务_取错误(任务ID)))','    如果结束','    EdgeView任务_释放(任务ID)','结束','','事件 _下载状态按钮_被单击()','    如果 (最近下载ID != 0)','        控件_设置文本(运行状态, EdgeView下载_取状态JSON(浏览器控件, 最近下载ID))','    否则','        控件_设置文本(运行状态, "还没有测试下载，请先点「触发下载」。")','    如果结束','结束'],['assets/capstone.html',capstone],['lingbuilder.fs.path', 'lingbuilder.data.json', 'lingbuilder.std.bytes'])
];

async function writeEpisode(item: Episode) {
  const dir = path.join(root, item.no, '示例项目');
  await clearGeneratedFiles(dir, item);
  await fs.mkdir(path.join(dir, '.lingbuilder', 'projects', item.id), { recursive: true });
  const controls: any[] = [{ id: 'title', type: 'Label', name: '标题', content: item.title, x: 24, y: 18, width: 720, height: 34, fontSize: 20, fontFamily: 'Microsoft YaHei UI', background: 'transparent', foreground: '#F9FAFB', isEnabled: true, visibility: 'Visible', properties: { staticStyle: 'text', textAlign: 'left' } }, { id: 'status', type: 'Label', name: '运行状态', content: '等待 F5 运行...', x: 24, y: 62, width: 1040, height: 34, fontSize: 12, fontFamily: 'Microsoft YaHei UI', background: '#1E3A8A', foreground: '#DBEAFE', isEnabled: true, visibility: 'Visible', properties: { staticStyle: 'text', textAlign: 'left' } }, { id: 'action', type: 'Button', name: '运行按钮', content: '运行演示', x: 860, y: 18, width: 200, height: 36, fontSize: 12, fontFamily: 'Microsoft YaHei UI', background: '#2563EB', foreground: '#FFFFFF', isEnabled: true, visibility: 'Visible', properties: { buttonStyle: 'push', cornerRadius: 6 }, events: { Click: '_运行按钮_被单击' } }, { id: 'edge', type: 'EdgeBrowser', name: '浏览器控件', content: 'Edge 浏览器', x: 24, y: 112, width: 1036, height: 590, fontSize: 12, fontFamily: 'Microsoft YaHei UI', background: '#FFFFFF', foreground: '#111827', isEnabled: true, visibility: 'Visible', properties: { url: 'about:blank', cacheDir: '.edgeview/' + item.no, proxyMode: 'system', enableScript: true, enableWebMessage: true, enableDevTools: true, enableContextMenu: true, enableStatusBar: false, zoomFactor: 100, language: 'zh-CN' } }];
  const buttonDefaults = (control: any) => ({ fontSize: 12, fontFamily: 'Microsoft YaHei UI', background: '#2563EB', foreground: '#FFFFFF', ...control });
  // 一集多个按钮时统一排版：去掉默认「运行演示」，把按钮等宽铺在标题栏右侧，标题让出宽度。
  const addButtons = (no: string, defs: { id: string; name: string; content: string; handler: string }[]) => {
    if (item.no !== no) return;
    controls.splice(2, 1);
    const width = Math.floor((1060 - 24 - (defs.length - 1) * 12) / defs.length);
    controls[0].width = Math.max(240, 1060 - (defs.length * (width + 12)) - 24);
    defs.forEach((def, i) => controls.push(buttonDefaults({
      id: def.id, type: 'Button', name: def.name, content: def.content,
      x: 1060 - (defs.length - i) * (width + 12), y: 18, width, height: 36,
      events: { Click: def.handler }, isEnabled: true, visibility: 'Visible',
      properties: { buttonStyle: 'push', cornerRadius: 6 },
    })));
  };
  addButtons('04', [
    { id: 'action', name: '运行按钮', content: '设置全局代理', handler: '_运行按钮_被单击' },
    { id: 'instance-proxy', name: '实例代理按钮', content: '实例代理', handler: '_实例代理按钮_被单击' },
    { id: 'region-proxy', name: '区域代理按钮', content: '区域代理', handler: '_区域代理按钮_被单击' },
  ]);
  addButtons('06', [
    { id: 'action', name: '运行按钮', content: '发送字符串消息', handler: '_运行按钮_被单击' },
    { id: 'json-send', name: 'JSON按钮', content: '发送 JSON 消息', handler: '_JSON按钮_被单击' },
  ]);
  addButtons('09', [
    { id: 'action', name: '运行按钮', content: '开始查找', handler: '_运行按钮_被单击' },
    { id: 'next', name: '下一项按钮', content: '下一个匹配', handler: '_下一项按钮_被单击' },
    { id: 'stop', name: '停止按钮', content: '停止查找', handler: '_停止按钮_被单击' },
    { id: 'trigger', name: '下载按钮', content: '触发下载', handler: '_下载按钮_被单击' },
    { id: 'dstatus', name: '下载状态按钮', content: '查看下载状态', handler: '_下载状态按钮_被单击' },
  ]);
  addButtons('10', [
    { id: 'action', name: '运行按钮', content: '导出 PDF', handler: '_运行按钮_被单击' },
    { id: 'shot', name: '截图按钮', content: '导出截图', handler: '_截图按钮_被单击' },
    { id: 'icon', name: '图标按钮', content: '导出图标', handler: '_图标按钮_被单击' },
    { id: 'devtools', name: '开发者工具按钮', content: '打开 DevTools', handler: '_开发者工具按钮_被单击' },
  ]);
  addButtons('11', [
    { id: 'action', name: '运行按钮', content: '读取会话与权限', handler: '_运行按钮_被单击' },
    { id: 'grant', name: '权限按钮', content: '设置测试权限', handler: '_权限按钮_被单击' },
    { id: 'clear', name: '清理按钮', content: '清理测试 Profile', handler: '_清理按钮_被单击' },
  ]);
  addButtons('12', [
    { id: 'action', name: '运行按钮', content: '填充并校验', handler: '_运行按钮_被单击' },
    { id: 'download', name: '下载按钮', content: '触发下载', handler: '_下载按钮_被单击' },
    { id: 'body', name: '正文按钮', content: '读取响应正文', handler: '_正文按钮_被单击' },
    { id: 'dstatus', name: '下载状态按钮', content: '查看下载状态', handler: '_下载状态按钮_被单击' },
  ]);
  if (item.no === '02') {
    controls[0].width = 380;
    controls[2].content = '写入会话A'; controls[2].x = 420; controls[2].width = 200;
    controls[3].name = '会话A'; controls[3].x = 24; controls[3].width = 500; controls[3].properties.cacheDir = '.edgeview/02/cache-a';
    controls.push({ ...controls[3], id: 'edge-b', name: '会话B', x: 550, properties: { ...controls[3].properties, cacheDir: '.edgeview/02/cache-b' } });
    controls.push(buttonDefaults({ id: 'read-b', type: 'Button', name: '读取按钮', content: '读取会话B', x: 630, y: 18, width: 200, height: 36, events: { Click: '_读取按钮_被单击' }, isEnabled: true, visibility: 'Visible', properties: { buttonStyle: 'push', cornerRadius: 6 } }), buttonDefaults({ id: 'cookie', type: 'Button', name: 'Cookie按钮', content: '读取 Cookie', x: 840, y: 18, width: 200, height: 36, events: { Click: '_Cookie按钮_被单击' }, isEnabled: true, visibility: 'Visible', properties: { buttonStyle: 'push', cornerRadius: 6 } }));
  }
  if (item.no === '03') controls.splice(2, 0, buttonDefaults({ id: 'runtime', type: 'Button', name: '运行时设置按钮', content: '应用运行时设置', x: 640, y: 18, width: 200, height: 36, events: { Click: '_运行时设置按钮_被单击' }, isEnabled: true, visibility: 'Visible', properties: { buttonStyle: 'push', cornerRadius: 6 } }), buttonDefaults({ id: 'rebuild', type: 'Button', name: '重建按钮', content: '应用创建期选项', x: 850, y: 18, width: 200, height: 36, events: { Click: '_重建按钮_被单击' }, isEnabled: true, visibility: 'Visible', properties: { buttonStyle: 'push', cornerRadius: 6 } }));
  if (item.no === '12') {
    controls[1].width = 520;
    controls.push({
      id: 'body-text', type: 'Label', name: '响应正文', content: '等待在响应事件内读取被替换的样式表正文',
      x: 556, y: 62, width: 508, height: 34, fontSize: 12, fontFamily: 'Microsoft YaHei UI',
      background: '#14532D', foreground: '#DCFCE7', isEnabled: true, visibility: 'Visible',
      properties: { staticStyle: 'text', textAlign: 'left' },
    });
  }
  if (item.no === '07') { controls[2].content = '读取校验结果'; controls.splice(2, 0, buttonDefaults({ id: 'submit', type: 'Button', name: '提交按钮', content: '提交演示', x: 640, y: 18, width: 200, height: 36, events: { Click: '_提交按钮_被单击' }, isEnabled: true, visibility: 'Visible', properties: { buttonStyle: 'push', cornerRadius: 6 } })); }
  const model = { schemaVersion: 2, id: item.id, name: item.name, resources: [], windows: [{ id: 'main-window', fileName: 'MainWindow.xml', className: 'MainWindow', title: item.title, width: 1100, height: 760, background: '#111827', designerBackend: 'win32', openPlacement: 'center', events: { Loaded: '_MainWindow_创建完毕' }, controls }] };
  const solution = { schemaVersion: 2, id: item.id + '-solution', name: item.name, startupProjectId: item.id, startupProjectIds: [item.id], projects: [{ type: 'visual-cpp', id: item.id, name: item.name, sourceRoot: 'src', configRoot: 'config', designerPath: '.lingbuilder/projects/' + item.id + '/window-designer.json', isDefault: true, references: [] }] };
  const extraModules = item.extraModules ?? [];
  const pinnedVersions: Record<string, string> = { 'lingbuilder.win32.basic': '1.0.0', 'lingbuilder.edgeview': '1.5.0' };
  for (const moduleId of extraModules) pinnedVersions[moduleId] = '1.0.0';
  const modules = { schemaVersion: 1, enabledModuleIds: ['lingbuilder.win32.basic', 'lingbuilder.edgeview', ...extraModules], pinnedVersions };
  await fs.writeFile(path.join(dir, '.lingbuilder', 'solution.json'), JSON.stringify(solution, null, 2) + '\n', 'utf8');
  await fs.writeFile(path.join(dir, '.lingbuilder', 'build-configuration.json'), JSON.stringify({ schemaVersion: 1, mode: 'Release', architecture: 'Win32' }, null, 2) + '\n', 'utf8');
  await fs.writeFile(path.join(dir, '.lingbuilder', 'projects', item.id, 'project-modules.json'), JSON.stringify(modules, null, 2) + '\n', 'utf8');
  await fs.writeFile(path.join(dir, '.lingbuilder', 'projects', item.id, 'window-designer.json'), JSON.stringify(model, null, 2) + '\n', 'utf8');
  await fs.mkdir(path.join(dir, 'src'), { recursive: true }); await fs.mkdir(path.join(dir, 'config'), { recursive: true });
  const lines = [...item.lines];
  if (!lines.some(line => line.includes('事件 _MainWindow_创建完毕'))) lines.unshift('事件 _MainWindow_创建完毕()', '    控件_设置文本(运行状态, "示例项目已启动。")', '结束', '');
  if (!lines.some(line => line.includes('事件 _运行按钮_被单击'))) lines.push('', '事件 _运行按钮_被单击()', '    控件_设置文本(运行状态, "已执行本集演示入口。")', '结束');
  lines.push('', '// 本集口播命令：' + item.commands.join('、'));
  await fs.writeFile(path.join(dir, 'src', 'MainWindow.lcpp'), ['包 EdgeView教程第' + item.no + '集演示', '使用 Win32窗口基础模块', '使用 EdgeView浏览器模块', '', '类 MainWindow : 公开 窗口', '    构造()', '    结束', '', ...lines, '结束类', ''].join('\n'), 'utf8');
  await fs.writeFile(path.join(dir, 'config', 'config.ini'), '[project]\nname=' + item.name + '\nmoduleId=lingbuilder.edgeview\n', 'utf8');
  if (item.asset) { await fs.mkdir(path.dirname(path.join(dir, item.asset[0])), { recursive: true }); await fs.writeFile(path.join(dir, item.asset[0]), item.asset[1], 'utf8'); }
  await fs.writeFile(path.join(dir, 'README.md'), '# ' + item.name + '\n\n对应 EdgeView 合集第 ' + item.no + ' 集。复制到独立工作区后打开 solution.json 并 F5。\n', 'utf8');
  await fs.writeFile(path.join(root, item.no, '录制准备.md'), '# 第 ' + item.no + ' 集录制准备：' + item.name + '\n\n- 项目入口：示例项目/.lingbuilder/solution.json\n- 项目 ID：' + item.id + '\n- 运行环境：' + item.runtime + '，Windows 10/11。\n- 代码镜头使用新手模式、至少 1920×1080 DIP；F5 前确认错误列表为 0，exe 保持至少 3 秒。\n- 仅使用本地/授权测试数据，禁止真实账号、Cookie 值、代理密码、私钥和敏感路径。\n\n## 本集关键命令\n\n' + item.commands.map(command => '- ' + command).join('\n') + '\n', 'utf8');
  await fs.writeFile(path.join(root, item.no, '验证记录.md'), renderVerificationRecord(item), 'utf8');
}

// 只清理生成器自己写出的文件；.lbsln / build-configuration.json / build-request.json 属于 IDE 与用户。
async function clearGeneratedFiles(dir: string, item: Episode) {
  const projectDir = path.join(dir, '.lingbuilder', 'projects', item.id);
  const projectsRoot = path.join(dir, '.lingbuilder', 'projects');
  const entries = await fs.readdir(projectsRoot, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name !== item.id) {
      await fs.rm(path.join(projectsRoot, entry.name), { recursive: true, force: true });
    }
  }
  const owned = [
    path.join(projectDir, 'project-modules.json'),
    path.join(projectDir, 'window-designer.json'),
    path.join(dir, '.lingbuilder', 'solution.json'),
    path.join(dir, 'src', 'MainWindow.lcpp'),
    path.join(dir, 'config', 'config.ini'),
    path.join(dir, 'README.md'),
  ];
  for (const file of owned) await fs.rm(file, { force: true });
  if (item.asset) await fs.rm(path.join(dir, 'assets'), { recursive: true, force: true });
}

const pendingEvidence = (no: string) => [
  `- 原生构建：待录制机执行 F5，确认错误列表 (0)、Release exe 启动后 ≥ 3 秒仍在运行（需先确认 WebView2 Runtime 与 MSVC）`,
  `- 运行画面：待抓取原生窗口截图并逐帧确认本地测试页真实显示、关键 API 与控件名在最终观看尺寸可读`,
  `- 成片：待按 ${no}/配音/manifest.json 与该集权威字幕时间线渲染 1920×1080 / 30fps / H.264+AAC`,
];

const verificationEvidence: Record<string, string[]> = {
  '01': [
    `- 静态文件：solution / project-modules / window-designer / lcpp / assets 已生成并通过校验`,
    `- 生成器诊断：npm run tutorial:edgeview:verify 通过；python check_handlers.py 无悬空处理器引用`,
    `- 原生构建：F5 构建 Release exe 成功，错误列表 (0)，WebView2Loader.dll 位于 exe 同目录；运行窗口以 WM_CLOSE 正常关闭`,
    `- 运行画面：本地页 https://intro.local/intro.html 实测显示「EdgeView 本地测试页 / 只用于教程录制，不访问公网」；点「运行演示」后状态标签回显 "LingBuilder EdgeView 测试页"（document.title）。`,
    `- 采集清单：截图与按钮动作的对应关系记在 NN/素材/shots/native_states.txt`,
  ],
  '02': [
    `- 静态文件：solution / project-modules / window-designer / lcpp / assets 已生成并通过校验`,
    `- 生成器诊断：npm run tutorial:edgeview:verify 通过；python check_handlers.py 无悬空处理器引用`,
    `- 原生构建：F5 构建 Release exe 成功，错误列表 (0)，WebView2Loader.dll 位于 exe 同目录；运行窗口以 WM_CLOSE 正常关闭`,
    `- 运行画面：三按钮实测：A 蓝底「读到：只在A出现」与 B 橙底「本地存储为空」同框；标签「B 读不到：会话已隔离」；Cookie 回显 [{"name":"演示键","value":"脱敏值","domain":"iso.local","path":"/"}]。`,
    `- 采集清单：截图与按钮动作的对应关系记在 NN/素材/shots/native_states.txt`,
  ],
  '03': [
    `- 静态文件：solution / project-modules / window-designer / lcpp / assets 已生成并通过校验`,
    `- 生成器诊断：npm run tutorial:edgeview:verify 通过；python check_handlers.py 无悬空处理器引用`,
    `- 原生构建：F5 构建 Release exe 成功，错误列表 (0)，WebView2Loader.dll 位于 exe 同目录；运行窗口以 WM_CLOSE 正常关闭`,
    `- 运行画面：回显页实测四态：默认 UA + innerWidth 1036 → 应用设置后 LingBuilder-Tutorial/1.0 + 690（缩放 1.5）→ 重建并重挂虚拟主机后重新加载 → UA 与宽度回到默认，证明重建丢弃运行期设置。`,
    `- 采集清单：截图与按钮动作的对应关系记在 NN/素材/shots/native_states.txt`,
  ],
  '04': [
    `- 静态文件：solution / project-modules / window-designer / lcpp / assets 已生成并通过校验`,
    `- 生成器诊断：npm run tutorial:edgeview:verify 通过；python check_handlers.py 无悬空处理器引用`,
    `- 原生构建：F5 构建 Release exe 成功，错误列表 (0)，WebView2Loader.dll 位于 exe 同目录；运行窗口以 WM_CLOSE 正常关闭`,
    `- 运行画面：三按钮实测三条作用域互不串：全局代理 → http://127.0.0.1:8888；实例 41 实际代理 → http://127.0.0.1:8889；区域 42 实际代理 → socks5://127.0.0.1:8890。`,
    `- 采集清单：截图与按钮动作的对应关系记在 NN/素材/shots/native_states.txt`,
  ],
  '05': [
    `- 静态文件：solution / project-modules / window-designer / lcpp / assets 已生成并通过校验`,
    `- 生成器诊断：npm run tutorial:edgeview:verify 通过；python check_handlers.py 无悬空处理器引用`,
    `- 原生构建：F5 构建 Release exe 成功，错误列表 (0)，WebView2Loader.dll 位于 exe 同目录；运行窗口以 WM_CLOSE 正常关闭`,
    `- 运行画面：绑定 导航开始/导航完成/标题改变 三个真实事件；测试页一秒后自改标题，实测标签显示 标题改变：{"title":"标题已改变 · EdgeView 事件"}，证明事件来自 WebView2 而非轮询。`,
    `- 采集清单：截图与按钮动作的对应关系记在 NN/素材/shots/native_states.txt`,
  ],
  '06': [
    `- 静态文件：solution / project-modules / window-designer / lcpp / assets 已生成并通过校验`,
    `- 生成器诊断：npm run tutorial:edgeview:verify 通过；python check_handlers.py 无悬空处理器引用`,
    `- 原生构建：F5 构建 Release exe 成功，错误列表 (0)，WebView2Loader.dll 位于 exe 同目录；运行窗口以 WM_CLOSE 正常关闭`,
    `- 运行画面：双向消息实测：页面显示 收到的字符串=刷新列表、收到的 JSON={"action":"refresh","id":7}、网页已收到并回传；状态标签显示页面 postMessage 回来的 JSON。`,
    `- 采集清单：截图与按钮动作的对应关系记在 NN/素材/shots/native_states.txt`,
  ],
  '07': [
    `- 静态文件：solution / project-modules / window-designer / lcpp / assets 已生成并通过校验`,
    `- 生成器诊断：npm run tutorial:edgeview:verify 通过；python check_handlers.py 无悬空处理器引用`,
    `- 原生构建：F5 成功，错误列表 (0)，Release exe 生成；运行窗口以 WM_CLOSE 正常关闭，无残留进程`,
    `- 运行画面：填值已按旁白搬进 _MainWindow_创建完毕（导航 → EdgeView_等待事件控件 等「导航完成」→ 三条 EdgeView_执行JS控件），实测窗口启动即显示 林小明 / demo@example.test / 2 与绿色「校验通过」；「读取校验结果」回显 "pass : 校验通过"，「提交演示」回显「已提交到本地存储」`,
    `- 采集素材：n1-run-initial / n2-run-btn0(读取校验结果) / n3-run-btn1(提交演示)`, 
    `- 成片：out/ep07-master-1080p30.mp4 1920×1080/30fps/2090 帧/69.667s，全量解码 0 错误，音轨 -23.9 LUFS 与旁白一致`,
  ],
  '08': [
    `- 静态文件：solution / project-modules / window-designer / lcpp / assets 已生成并通过校验`,
    `- 生成器诊断：npm run tutorial:edgeview:verify 通过；python check_handlers.py 无悬空处理器引用`,
    `- 原生构建：F5 构建 Release exe 成功，错误列表 (0)，WebView2Loader.dll 位于 exe 同目录；运行窗口以 WM_CLOSE 正常关闭`,
    `- 运行画面：两个子工程分别采集。读取响应实测标签「读取完成：HTTP 200 OK，正文 110 字节」，右侧面板给出 requestHandle=2 / responseHandle=3 / 状态码=200 / 原因=OK 与 UTF-8 解码后的中文正文。`,
    `- 采集清单：截图与按钮动作的对应关系记在 NN/素材/shots/native_states.txt`,
  ],
  '09': [
    `- 静态文件：solution / project-modules / window-designer / lcpp / assets 已生成并通过校验`,
    `- 生成器诊断：npm run tutorial:edgeview:verify 通过；python check_handlers.py 无悬空处理器引用`,
    `- 原生构建：F5 构建 Release exe 成功，错误列表 (0)，WebView2Loader.dll 位于 exe 同目录；运行窗口以 WM_CLOSE 正常关闭`,
    `- 运行画面：程序侧点击页面下载链接后实测触发 下载开始，标签显示 下载 1 → {"id":"1","state":"0","received":"13","total":"13",...}；注意 设置下载路径 未改掉实际落盘路径（见 FUTURE_OPTIMIZATIONS §6）。`,
    `- 采集清单：截图与按钮动作的对应关系记在 NN/素材/shots/native_states.txt`,
  ],
  '10': [
    `- 静态文件：solution / project-modules / window-designer / lcpp / assets 已生成并通过校验`,
    `- 生成器诊断：npm run tutorial:edgeview:verify 通过；python check_handlers.py 无悬空处理器引用`,
    `- 原生构建：F5 构建 Release exe 成功，错误列表 (0)，WebView2Loader.dll 位于 exe 同目录；运行窗口以 WM_CLOSE 正常关闭`,
    `- 运行画面：三个导出各占一个按钮，逐个点击逐个取证。实测 exe 同目录产出 edgeview-ep10-page.pdf 64,204 B（%PDF-1.4、2 页、带 %%EOF）、edgeview-ep10-page.png 57,393 B、edgeview-ep10-page.ico 425 B；状态标签分别回「PDF 已导出 → …\edgeview-ep10-page.pdf」「截图已导出 → …」「图标已导出 → …」，即 EdgeView任务_取状态 == 1。`,
    `- 模块修复：EdgeView打印_PDF异步 之前不产出文件是因为 PrintToPdf 只接受绝对路径，而截图/图标由模块自己 CreateFileW 落盘所以相对名能写出去；现在四条导出命令统一 EdgeView_取绝对路径，任务结果回报绝对路径。设置JSON 之前是未命名哑参数，现在按 WebView2 驼峰键名白名单真实生效。`,
    `- 采集清单：n2-run-btn0(导出 PDF) / n3-run-btn1(导出截图) / n4-run-btn2(导出图标) / n5-run-btn3(打开 DevTools)`, 
    `- 采集清单：截图与按钮动作的对应关系记在 NN/素材/shots/native_states.txt`,
  ],
  '11': [
    `- 静态文件：solution / project-modules / window-designer / lcpp / assets 已生成并通过校验`,
    `- 生成器诊断：npm run tutorial:edgeview:verify 通过；python check_handlers.py 无悬空处理器引用`,
    `- 原生构建：F5 构建 Release exe 成功，错误列表 (0)，WebView2Loader.dll 位于 exe 同目录；运行窗口以 WM_CLOSE 正常关闭`,
    `- 运行画面：Cookie 读取实测 [{"name":"演示键","value":"脱敏值","domain":"sec.local","path":"/"}]；权限按钮改走 枚举异步（设置异步实测把页面刷白且处理器不回）。`,
    `- 采集清单：截图与按钮动作的对应关系记在 NN/素材/shots/native_states.txt`,
  ],
  '12': [
    `- 静态文件：solution / project-modules / window-designer / lcpp / assets 已生成并通过校验`,
    `- 生成器诊断：npm run tutorial:edgeview:verify 通过；python check_handlers.py 无悬空处理器引用`,
    `- 原生构建：F5 构建 Release exe 成功，错误列表 (0)，WebView2Loader.dll 位于 exe 同目录；运行窗口以 WM_CLOSE 正常关闭`,
    `- 运行画面：资源替换实测生效：样式表改从未映射主机 skin.capstone.local 取，页面被替换成青绿配色，证明 Web资源请求 应答是唯一来源；导航完成异步回标题与地址，下载按钮触发 下载开始。`,
    `- 读正文：EdgeView资源_读响应正文异步 改到 Web资源响应收到 处理器执行期间立即发起，新增绿色「响应正文」标签实测回「被替换样式表 62 字节：main{background:#f0fdfa;border-color:#0f766e}h1{color:#0f766e}」；把句柄存下来事后再读约 5.6 s / 9.5 s / 17.4 s 全部失败（0x80004005），与响应是真实网络还是合成应答无关。`,
    `- 采集清单：n2-run-btn0(填充并校验) / n3-run-btn1(触发下载) / n4-run-btn2(读取响应正文)`, 
    `- 采集清单：截图与按钮动作的对应关系记在 NN/素材/shots/native_states.txt`,
  ],
};

function renderVerificationRecord(item: Episode) {
  const evidence = verificationEvidence[item.no] ?? pendingEvidence(item.no);
  return [
    `# 第 ${item.no} 集验证记录：${item.name}`,
    ``,
    `> 本文件由 \`electron/scripts/generate-edgeview-tutorial-projects.ts\` 生成，重跑生成器会用下表覆盖。`,
    `> 新增验证证据请写入生成器的 \`verificationEvidence['${item.no}']\`，不要只改本文件。`,
    ``,
    `- 项目 ID：${item.id}`,
    `- 运行环境：${item.runtime}`,
    ...evidence,
    `- 成片：remotion/out/ep${item.no}-master-1080p30.mp4，1920×1080 / 30fps / H.264 + AAC LC 48kHz 立体声，`
      + `帧数按 ${item.no}/配音/manifest.json 的实测总时长取整；FFmpeg 全量解码 0 错误，`
      + `音轨 integrated loudness 与该集 vo.mp3 一致（未加增益）。逐集数值见 ../成片交付总表.md`,
    ``,
  ].join('\n');
}

async function copyEp08() {
  const target = path.join(root, '08', '示例项目'); await fs.rm(target, { recursive: true, force: true }); await fs.mkdir(target, { recursive: true });
  for (const [name, source] of [['替换响应', 'replace-response'], ['读取响应', 'read-response']] as const) await fs.cp(path.join(repoRoot, 'examples', 'edgeview-response-demos', source), path.join(target, name), { recursive: true });
  await fs.writeFile(path.join(target, 'README.md'), '# 第 08 集响应示例项目\n\n复用仓库中已验证的替换响应与读取响应项目。\n', 'utf8');
  await fs.writeFile(path.join(root, '08', '录制准备.md'), '# 第 08 集录制准备：获取资源响应\n\n先录制替换响应，再录制读取响应；Runtime 150 正文读取保留任务与对象释放镜头。\n', 'utf8');
  await fs.writeFile(path.join(root, '08', '验证记录.md'), '# 第 08 集验证记录：获取资源响应\n\n复用 examples/edgeview-response-demos 两个已验证项目；录制前确认 F5 错误列表为 0。\n', 'utf8');
}

for (const item of episodes.filter(item => item.no !== '08')) await writeEpisode(item);
await copyEp08();
console.log(JSON.stringify({ ok: true, episodes: episodes.length, root }, null, 2));

