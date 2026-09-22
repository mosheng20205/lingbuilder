// FBro 教程示例项目定义：11 集，每集一个独立可构建工作区。
// 命令、事件名与字段全部按 builtinModules.ts / fbroModules.ts / FbroEventOverrides.generated.inc 实测核对。

export const MODULE_NAMES = {
  'lingbuilder.win32.basic': ['Win32窗口基础模块', '1.0.0'],
  'lingbuilder.win32.common-controls': ['Win32高级控件模块', '1.0.0'],
  'lingbuilder.fbro.browser': ['FBro指纹浏览器模块', '2.9.0'],
  'lingbuilder.fbro.events': ['FBro事件模块', '2.1.0'],
  'lingbuilder.fbro.session': ['FBro会话模块', '2.1.0'],
  'lingbuilder.fbro.transfer': ['FBro传输模块', '2.1.0'],
  'lingbuilder.fbro.automation': ['FBro自动化模块', '2.1.0'],
  'lingbuilder.fbro.objects': ['FBro受管对象模块', '2.1.0'],
  'lingbuilder.fbro.network': ['FBro高级网络模块', '2.1.0'],
  'lingbuilder.fbro.vip': ['FBro VIP 指纹模块', '2.1.0'],
  'lingbuilder.http.server': ['HTTP 服务端模块', '2.1.0'],
  'lingbuilder.cdp.client': ['CDP 客户端模块', '3.0.0'],
  'lingbuilder.fs.core': ['文件目录模块', '1.0.0'],
  'lingbuilder.fs.path': ['路径处理模块', '1.0.0'],
  'lingbuilder.std.text': ['文本处理模块', '1.0.0']
};

const DARK = '#111827';
const FG = '#E5E7EB';

export function label(id, name, content, x, y, w, h = 22) {
  return { id, type: 'Label', name, content, x, y, width: w, height: h, background: DARK, foreground: FG, isEnabled: true, visibility: 'Visible', properties: {} };
}
export function button(id, name, content, x, y, w = 150, h = 30) {
  // 设计器事件表必须显式给出 Click -> _控件名_被单击，运行时才会派发到中文代码。
  return {
    id, type: 'Button', name, content, x, y, width: w, height: h,
    background: '#1F2937', foreground: FG, isEnabled: true, visibility: 'Visible',
    properties: {}, events: { Click: `_${name}_被单击` }
  };
}
export function textbox(id, name, content, x, y, w, h = 26) {
  return { id, type: 'TextBox', name, content, x, y, width: w, height: h, background: '#0B1220', foreground: FG, isEnabled: true, visibility: 'Visible', properties: {} };
}
export function listbox(id, name, x, y, w, h) {
  return { id, type: 'ListBox', name, content: '', x, y, width: w, height: h, background: '#0B1220', foreground: FG, isEnabled: true, visibility: 'Visible', properties: {} };
}
export function progress(id, name, x, y, w, h = 22) {
  return { id, type: 'ProgressBar', name, content: '', x, y, width: w, height: h, background: DARK, foreground: '#22C55E', isEnabled: true, visibility: 'Visible', properties: {} };
}
export function tabs(id, name, x, y, w, h) {
  return { id, type: 'TabControl', name, content: '', x, y, width: w, height: h, background: DARK, foreground: FG, isEnabled: true, visibility: 'Visible', properties: {} };
}
export function fbro(id, name, x, y, w, h, props) {
  return {
    id, type: 'FBroBrowser', name, content: '', x, y, width: w, height: h,
    background: '#FFFFFF', foreground: '#000000', isEnabled: true, visibility: 'Visible',
    properties: Object.assign({
      processMode: 'in-process', url: 'about:blank', cacheDir: '', enableJs: true,
      enableDevTools: true, loadImages: true, enableWebGL: true, muteAudio: true, proxyMode: 'system'
    }, props || {})
  };
}

// ---------------------------------------------------------------- 共享测试页内容（同时落盘 assets/，运行时再写一份到 exe 目录）

export const PAGE_FILES = [
  ['index.html', [
    '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">',
    '<title>FBro 资源测试页</title><link rel="stylesheet" href="style.css">',
    '</head><body><h1>FBro 资源测试页</h1>',
    '<img src="logo.svg" width="96" height="96" alt="演示图形">',
    '<p id="tip">这是一个只用于教程演示的本地测试页。</p>',
    '<button id="demo-button" type="button">点我</button>',
    '<p id="click-result">未点击</p>',
    '<script src="app.js"></script></body></html>'
  ].join('')],
  ['style.css', 'body{font-family:Segoe UI,Microsoft YaHei,sans-serif;background:#0b1220;color:#e5e7eb;padding:24px}h1{color:#38bdf8}button{padding:8px 16px}'],
  ['app.js', "var b=document['getElementById']('demo-button');b['addEventListener']('click',function(){document['getElementById']('click-result')['textContent']='已点击';});"],
  ['logo.svg', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><circle cx="48" cy="48" r="44" fill="#38bdf8"/><text x="48" y="58" font-size="28" text-anchor="middle" fill="#0b1220">FBro</text></svg>']
];

export const FORM_FILES = [
  ['form.html', [
    '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>FBro 测试表单</title>',
    '<style>body{font-family:Segoe UI,Microsoft YaHei,sans-serif;background:#0b1220;color:#e5e7eb;padding:24px}',
    'label{display:block;margin:8px 0 4px}input,select{padding:6px;min-width:220px}#result{margin-top:16px;color:#22c55e}</style>',
    '</head><body><h1>FBro 测试表单</h1><form id="demo-form" onsubmit="return false;">',
    '<label for="name">姓名</label><input id="name" type="text">',
    '<label for="city">城市</label><select id="city"><option value="">请选择</option><option value="beijing">北京</option><option value="shanghai">上海</option></select>',
    '<label><input id="interest-email" type="checkbox"> 订阅邮件</label>',
    '<label><input id="contact-phone" type="radio" name="contact"> 电话联系</label>',
    '<button id="submit" type="button">提交</button></form>',
    '<p id="result">未提交</p>',
    '<script>var sb=document["getElementById"]("submit");sb["addEventListener"]("click",function(){',
    'var n=document["getElementById"]("name")["value"],c=document["getElementById"]("city")["value"];',
    'var e=document["getElementById"]("interest-email")["checked"]?"是":"否";',
    'var p=document["getElementById"]("contact-phone")["checked"]?"是":"否";',
    'document["getElementById"]("result")["textContent"]="提交成功 姓名="+n+" 城市="+c+" 订阅="+e+" 电话="+p;});</script>',
    '</body></html>'
  ].join('')]
];

// ---------------------------------------------------------------- 18-29 共享样式与页面

const BASE_STYLE = 'body{font-family:Segoe UI,Microsoft YaHei,sans-serif;background:#0b1220;color:#e5e7eb;padding:24px}h1{color:#38bdf8}a{color:#60a5fa}button{padding:8px 16px}input,select,textarea{padding:6px;background:#111827;color:#e5e7eb;border:1px solid #334155}';

/** 第 18 集：右键菜单演示页（可选中文本、链接、图片、可编辑区域）。 */
export const CONTEXTMENU_FILES = [
  ['contextmenu.html', [
    '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>FBro 右键菜单演示页</title>',
    '<style>' + BASE_STYLE + '#editor{min-height:80px;border:1px solid #334155;border-radius:6px;padding:10px;margin-top:12px}</style>',
    '</head><body><h1>右键菜单定制演示</h1>',
    '<p id="text">在这段文字上按下鼠标右键：上下文菜单会被替换成中文自定义菜单，并显示右键坐标、选中文本与页面地址。</p>',
    '<p><a id="demo-link" href="contextmenu.html">这是一个演示链接</a>（右键它可以读取链接地址）。</p>',
    '<p><img id="demo-img" src="logo.svg" width="96" height="96" alt="演示图形">（右键它可以读取图片信息）。</p>',
    '<div id="editor" contenteditable="true">这是可编辑区域，右键它可以看到「是否可编辑」参数为 1。</div>',
    '<script src="contextmenu-app.js"></script></body></html>'
  ].join('')],
  ['contextmenu-app.js', "document['addEventListener']('contextmenu',function(e){var t=document['getElementById']('last-right-click');if(t){t['textContent']='页面收到右键：x='+e['pageX']+' y='+e['pageY'];};});var d=document['createElement']('p');d['id']='last-right-click';d['style']['color']='#94a3b8';document['body']['appendChild'](d);"],
  ['logo.svg', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><circle cx="48" cy="48" r="44" fill="#38bdf8"/><text x="48" y="58" font-size="28" text-anchor="middle" fill="#0b1220">FBro</text></svg>']
];

/** 第 19 集：下载演示页。 */
export const DOWNLOAD_FILES = [
  ['download.html', [
    '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>FBro 下载管理演示页</title>',
    '<style>' + BASE_STYLE + '#file-box{margin-top:16px;padding:16px;border:1px dashed #334155;border-radius:8px}</style>',
    '</head><body><h1>下载管理演示</h1>',
    '<div id="file-box"><p>点击下面的链接也会触发浏览器下载（写入路径由程序在「下载开始」事件里接管）：</p>',
    '<p><a id="bin-link" href="样例数据.bin" download>下载 样例数据.bin</a></p></div>',
    '<p id="tip">本页面只用于教程演示，下载内容为程序生成的文本文件。</p></body></html>'
  ].join('')],
  ['样例数据.bin', 'LingBuilder FBro 下载管理演示数据文件。\n本文件由示例项目在运行时写出，仅用于触发与观察浏览器下载流程。\n']
];

/** 第 22 集：资源观察页（复用 PAGE_FILES 的多资源结构，单独命名避免跨集改动）。 */
export const RESOURCES_FILES = [
  ['index.html', [
    '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">',
    '<title>FBro 资源观察页</title><link rel="stylesheet" href="style.css">',
    '</head><body><h1>FBro 资源观察页</h1>',
    '<img src="logo.svg" width="96" height="96" alt="演示图形">',
    '<p id="tip">主文档 + CSS + JS + SVG 共四类资源，用于观察资源响应对象。</p>',
    '<button id="demo-button" type="button">点我</button>',
    '<p id="click-result">未点击</p>',
    '<script src="app.js"></script></body></html>'
  ].join('')],
  ['style.css', 'body{font-family:Segoe UI,Microsoft YaHei,sans-serif;background:#0b1220;color:#e5e7eb;padding:24px}h1{color:#38bdf8}button{padding:8px 16px}'],
  ['app.js', "var b=document['getElementById']('demo-button');b['addEventListener']('click',function(){document['getElementById']('click-result')['textContent']='已点击';});"],
  ['logo.svg', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><circle cx="48" cy="48" r="44" fill="#38bdf8"/><text x="48" y="58" font-size="28" text-anchor="middle" fill="#0b1220">FBro</text></svg>']
];

/** 第 24 集：填表进阶页（多类型控件）。 */
export const FORMPRO_FILES = [
  ['formpro.html', [
    '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>FBro 填表进阶演示</title>',
    '<style>' + BASE_STYLE + 'fieldset{border:1px solid #334155;margin-top:12px}#editor{min-height:60px;border:1px solid #334155;border-radius:6px;padding:10px}#fire-log{color:#22c55e}</style>',
    '</head><body><h1>填表进阶演示</h1>',
    '<fieldset><legend>基础控件</legend>',
    '<label>昵称 <input id="nickname" type="text"></label>',
    '<label>城市 <select id="city"><option value="">请选择</option><option value="beijing">北京</option><option value="shanghai">上海</option><option value="shenzhen">深圳</option></select></label>',
    '<label><input id="agree" type="checkbox"> 我已阅读说明</label>',
    '<label><input id="mode-fast" type="radio" name="mode"> 快速模式</label>',
    '<label><input id="mode-safe" type="radio" name="mode"> 安全模式</label>',
    '</fieldset>',
    '<fieldset><legend>富文本与代码</legend>',
    '<div id="editor" contenteditable="true">这里是富文本编辑区</div>',
    '<textarea id="bio" rows="3" cols="40">自我介绍</textarea>',
    '</fieldset>',
    '<fieldset><legend>属性与事件</legend>',
    '<p id="tagged" data-demo="原始属性值">带 data-demo 属性的段落</p>',
    '<button id="fire-btn" type="button">事件目标按钮</button>',
    '<span id="fire-log">按钮尚未被触发</span>',
    '</fieldset>',
    '<script>var fb=document["getElementById"]("fire-btn");fb["addEventListener"]("custom-event",function(){document["getElementById"]("fire-log")["textContent"]="收到 custom-event，时间标记 "+Date.now();});</script>',
    '</body></html>'
  ].join('')]
];

/** 第 25 集：Cookie 观察页。 */
export const COOKIE_FILES = [
  ['cookie.html', [
    '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>FBro Cookie 观察页</title>',
    '<style>' + BASE_STYLE + '#cookie-view{margin-top:16px;padding:12px;border:1px solid #334155;border-radius:8px;min-height:40px;color:#86efac;word-break:break-all}</style>',
    '</head><body><h1>Cookie 观察页</h1>',
    '<p>程序通过 FBro会话_异步设置Cookie 写入站点数据；下方实时显示 document.cookie，可对照验证。</p>',
    '<div id="cookie-view">（尚未读取）</div>',
    '<p><button id="refresh" type="button">刷新显示</button></p>',
    '<script>function show(){document["getElementById"]("cookie-view")["textContent"]=document["cookie"]||"（空）";}document["getElementById"]("refresh")["addEventListener"]("click",show);show();setInterval(show,1000);</script>',
    '</body></html>'
  ].join('')]
];

/** 第 26 集：图像来源页（纯 CSS 色块，供截图产生源图像）。 */
export const IMAGE_FILES = [
  ['image.html', [
    '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>FBro 图像演示页</title>',
    '<style>body{font-family:Segoe UI,Microsoft YaHei,sans-serif;background:#0b1220;color:#e5e7eb;padding:24px;margin:0}h1{color:#38bdf8}.grid{display:grid;grid-template-columns:120px 120px 120px;gap:10px}.grid div{height:120px;border-radius:8px}.c1{background:#38bdf8}.c2{background:#22c55e}.c3{background:#f59e0b}.c4{background:#ef4444}.c5{background:#a78bfa}.c6{background:#e2e8f0}</style>',
    '</head><body><h1>图像演示页</h1>',
    '<p>程序先截图本页作为源图像，再用 FBro图像_下载 从 file:// 地址读回为受管图像对象。</p>',
    '<div class="grid"><div class="c1"></div><div class="c2"></div><div class="c3"></div><div class="c4"></div><div class="c5"></div><div class="c6"></div></div>',
    '</body></html>'
  ].join('')]
];

/** 第 27 集：框架与编辑命令页（主页面 + 同名子框架）。 */
export const FRAME_FILES = [
  ['frame.html', [
    '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>FBro 框架编辑演示</title>',
    '<style>' + BASE_STYLE + '#main-editor{min-height:70px;border:1px solid #334155;border-radius:6px;padding:10px;margin:12px 0}iframe{width:100%;height:220px;border:1px solid #334155;border-radius:6px;background:#0b1220}</style>',
    '</head><body><h1>主框架页面</h1>',
    '<p>下方可编辑区域用于演示 剪切 / 复制 / 粘贴 / 全选 / 删除 / 撤销 / 重做。</p>',
    '<div id="main-editor" contenteditable="true">主框架的可编辑文本：全选我，然后复制粘贴。</div>',
    '<iframe name="子框架" src="frame-child.html"></iframe>',
    '</body></html>'
  ].join('')],
  ['frame-child.html', [
    '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>子框架页面</title>',
    '<style>body{font-family:Segoe UI,Microsoft YaHei,sans-serif;background:#0b1220;color:#e5e7eb;padding:16px}h2{color:#38bdf8}#child-editor{min-height:50px;border:1px solid #334155;border-radius:6px;padding:8px}</style>',
    '</head><body><h2>子框架页面（frame 名称：子框架）</h2>',
    '<div id="child-editor" contenteditable="true">子框架的可编辑文本</div>',
    '<p id="child-status">子框架就绪</p></body></html>'
  ].join('')]
];

/** 第 28 集：WebSocket 客户端演示页（连接内嵌服务器回环）。 */
export const WS_FILES = [
  ['ws.html', [
    '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>FBro WS 客户端演示页</title>',
    '<style>' + BASE_STYLE + '#ws-status{padding:8px 14px;border-radius:8px;background:#14532d;color:#86efac;display:inline-block}#ws-log{margin-top:12px;max-height:260px;overflow:auto;border:1px solid #334155;border-radius:8px;padding:8px;font-size:13px}</style>',
    '</head><body><h1>WS 客户端拦截演示</h1>',
    '<p>状态：<span id="ws-status">连接中…</span></p>',
    '<p><input id="msg" value="来自页面的消息"> <button id="send" type="button">发送</button></p>',
    '<div id="ws-log"></div>',
    '<script>var log=function(t){var d=document["createElement"]("div");d["textContent"]=t;var box=document["getElementById"]("ws-log");box["appendChild"](d);box["scrollTop"]=box["scrollHeight"];};',
    'var status=function(t,ok){var s=document["getElementById"]("ws-status");s["textContent"]=t;s["style"]["background"]=ok?"#14532d":"#7f1d1d";};',
    'var ws=new WebSocket("ws://127.0.0.1:8899/ling28");',
    'ws["onopen"]=function(){status("已连接 ws://127.0.0.1:8899/ling28",true);log("页面：连接已建立");ws["send"]("页面首条消息");};',
    'ws["onmessage"]=function(e){log("页面收到："+e["data"]);if(e["data"]["indexOf"]("拦截回执")===0){status("拦截链路完整（原生已改写消息）",true);}};',
    'ws["onclose"]=function(){status("连接已关闭",false);};',
    'document["getElementById"]("send")["addEventListener"]("click",function(){var v=document["getElementById"]("msg")["value"];log("页面发送："+v);ws["send"](v);});</script>',
    '</body></html>'
  ].join('')]
];

/** 第 29 集：启动开关与输入注入页（主页面 + 跨域子页）。 */
export const SWITCH_FILES = [
  ['switch.html', [
    '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>FBro 输入注入演示</title>',
    '<style>body{font-family:Segoe UI,Microsoft YaHei,sans-serif;background:#0b1220;color:#e5e7eb;padding:16px;margin:0}h1{color:#38bdf8;font-size:20px}#inject-btn{display:block;width:100%;height:64px;line-height:64px;text-align:center;background:#1d4ed8;color:#fff;border-radius:8px;font-size:17px;cursor:pointer}iframe{width:100%;height:190px;border:1px solid #334155;border-radius:6px;background:#0b1220;margin-top:10px}#wheel-log{color:#94a3b8}</style>',
    '</head><body>',
    '<div id="inject-btn">被注入点击的按钮　点击次数：<span id="click-count">0</span></div>',
    '<p><input id="key-box" placeholder="聚焦后由程序注入按键" style="width:300px" value="">　<span id="wheel-log">滚轮日志</span></p>',
    '<h1>输入注入与跨域演示</h1>',
    '<iframe name="跨域框架" src="switch-child.html"></iframe>',
    '<script>var n=0;var b=document["getElementById"]("inject-btn");b["addEventListener"]("click",function(){n++;document["getElementById"]("click-count")["textContent"]=n;});',
    'var k=document["getElementById"]("key-box");k["addEventListener"]("keydown",function(e){k["value"]+="["+e["key"]+"]";});',
    'document["addEventListener"]("wheel",function(e){document["getElementById"]("wheel-log")["textContent"]="滚轮增量 "+e["deltaY"];});</script>',
    '</body></html>'
  ].join('')],
  ['switch-child.html', [
    '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>跨域子页面</title>',
    '<style>body{font-family:Segoe UI,Microsoft YaHei,sans-serif;background:#111827;color:#e5e7eb;padding:16px}input{padding:6px;background:#0b1220;color:#e5e7eb;border:1px solid #334155}</style>',
    '</head><body><h2 style="color:#38bdf8;margin-top:0">跨域框架子页面</h2>',
    '<p><input id="cross-input" placeholder="跨框架写入目标" style="width:280px"> <span id="cross-status">等待跨框架访问</span></p>',
    '</body></html>'
  ].join('')]
];

// 把内容安全地嵌进 .lcpp 双引号字面量（生成器会原样透传为 C++ 宽字符串字面量）
export function lit(text) {
  return text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * 生成「运行时写出本地测试页 → 拼出 file:// 地址 → 导航」的私有方法。
 * 复制到任何目录后按 F5 都能直接复现，不依赖手工准备素材。
 */
export interface PagePrepOptions {
  /** 写完文件后是否顺带导航；默认 true。独立进程宿主建议关掉，改由按钮触发。 */
  navigate?: boolean;
  /** 保存 file:// 地址的变量名，默认「页面地址」。 */
  urlVar?: string;
  /** 是否在赋值前加「局部 文本型」声明。 */
  declare?: boolean;
}

export function pagePrepMethod(
  methodName: string,
  dirName: string,
  files: string[][],
  browserName: string,
  options: PagePrepOptions = {}
): string {
  const navigate = options.navigate !== false;
  const urlVar = options.urlVar || '页面地址';
  const declare = options.declare ? '局部 文本型 ' : '';
  const lines = [];
  lines.push(`  空 ${methodName}()`);
  lines.push(`      目录_创建("${dirName}")`);
  for (const [fileName, content] of files) {
    lines.push(`      文件_写入文本(路径_合并("${dirName}", "${fileName}"), "${lit(content)}")`);
  }
  lines.push(`      ${declare}${urlVar} = "file:///" + 文本_替换(路径_转绝对路径(路径_合并("${dirName}", "${files[0][0]}")), "\\\\", "/")`);
  if (navigate) lines.push(`      FBro_导航(${browserName}, ${urlVar})`);
  lines.push(`      调试输出("本地测试页已写出：", ${urlVar})`);
  lines.push('  结束');
  return lines.join('\n');
}
