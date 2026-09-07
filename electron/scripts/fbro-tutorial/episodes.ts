// FBro 教程示例项目定义：11 集，每集一个独立可构建工作区。
// 命令、事件名与字段全部按 builtinModules.ts / fbroModules.ts / FbroEventOverrides.generated.inc 实测核对。

export const MODULE_NAMES = {
  'lingbuilder.win32.basic': ['Win32窗口基础模块', '1.0.0'],
  'lingbuilder.win32.common-controls': ['Win32高级控件模块', '1.0.0'],
  'lingbuilder.fbro.browser': ['FBro指纹浏览器模块', '2.4.0'],
  'lingbuilder.fbro.events': ['FBro事件模块', '2.1.0'],
  'lingbuilder.fbro.session': ['FBro会话模块', '2.1.0'],
  'lingbuilder.fbro.transfer': ['FBro传输模块', '2.1.0'],
  'lingbuilder.fbro.objects': ['FBro受管对象模块', '2.1.0'],
  'lingbuilder.fbro.vip': ['FBro VIP 指纹模块', '2.1.0'],
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
  lines.push(`      ${declare}${urlVar} = 到文本("file:///") + 文本_替换(路径_转绝对路径(路径_合并("${dirName}", "${files[0][0]}")), "\\\\", "/")`);
  if (navigate) lines.push(`      FBro_导航(${browserName}, ${urlVar})`);
  lines.push(`      调试输出("本地测试页已写出：", ${urlVar})`);
  lines.push('  结束');
  return lines.join('\n');
}
