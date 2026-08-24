/**
 * docs-site-builder.mjs - Generate static docs from doc/*.md with a minimal renderer and sidebar.
 * This avoids external CDN; renders headings, paragraphs, bold, code blocks, lists, tables, links inline.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dir = path.dirname(fileURLToPath(import.meta.url));

// Minimal markdown-to-HTML converter (no external deps)
const MAX_CHARS = 50000; // Safety cap for very large docs
const mdToHtml = (text) => {
  let html = '';
  const lines = text.split(/\r?\n/);
  let i = 0, total = 0;
  while (i < lines.length && total < MAX_CHARS) {
    const line = lines[i].trim();
    // Heading # ## etc.
    if (/^#{1,6} /.test(line)) {
      const m = line.match(/^(\#{1,6})\s+(.*)$/);
      if (m) { const level = m[1].length; const title = escapeHtml(m[2]).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>'); html += `<h${level}>${title}</h${level}>\n`; i++; total+=line.length; continue; }
    }
    // Code block ``` ... ```
    if (line === '```') {
      const lang = lines[i + 1]?.trim() || '';
      const endIdx = lines.findIndex((l, idx) => idx > i && l.trim() === '```');
      const codeLines = lines.slice(i + 1, endIdx).slice(lang ? 1 : 0);
      const code = escapeHtml(codeLines.join('\n').trim());
      html += `<pre class="code-block"><code>${code}\n</code></pre>\n`; i += endIdx === -1 ? lines.length - i : endIdx + 1 - i; total+=code.length; continue;
    }
    // List
    if (/^- (.*)$/.test(line)) {
      let listHtml = '<ul>\n';
      while (i < lines.length && /^- /.test(lines[i]) && total < MAX_CHARS) {
        const liText = escapeHtml(lines[i].substring(2)).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
        listHtml += `<li>${liText}</li>\n`; i++; total+=lines[i-1].length;
      }
      listHtml += '</ul>\n'; html += listHtml; continue;
    }
    // Paragraph
    if (line) { html += `<p>${escapeHtml(line).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')}</p>\n`; i++; total+=line.length; } else i++;
  }
  if (total >= MAX_CHARS) html += `<p class="note">文档过长，已截断显示前 ${Math.min(MAX_CHARS,total)} 字符。</p>\n`;
  return html;
};
const escapeHtml = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Build pages
const srcDir = path.join(__dir, '..', 'doc');
const outDir = path.join(__dir, '..', 'website', 'docs-dist');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.md'));
const titles = {};
files.forEach(f => {
  const content = fs.readFileSync(path.join(srcDir, f), 'utf8');
  const title = titles[f] = content.split('\n')[0].replace(/^#+\s+/, '');
});

// Sidebar
const sidebarHtml = `
<nav class="sidebar">
  <h1>LingBuilder 开发文档</h1>
  <ul>
    ${files.map(f => `<li><a href="${path.basename(f, '.md')}.html">${titles[f]}</a></li>`).join('')}
  </ul>
  <p class="note">本文档为内部开发与部署手册，仅供授权人员查阅。</p>
</nav>
`;

// Template
const template = (title, body) => `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} — LingBuilder 文档</title>
<style>
:root{--bg:#0b1020;--card:#12192b;--text:#e9edf7;--muted:#9aa7bd;--accent:#7c6cff}
body{margin:0;background:var(--bg);color:var(--text);font-family:system-ui,-apple-system,sans-serif;font-size:14px;line-height:1.6}
.container{max-width:1100px;margin:auto;display:flex}
.sidebar{width:260px;padding:20px;background:var(--card);border-right:1px solid var(--accent);flex-shrink:0;display:flex;flex-direction:column}
.sidebar h1{font-size:15px;margin-bottom:14px;color:var(--accent)}
.sidebar ul{list-style:none;padding:0;margin:0}
.sidebar li{margin:6px 0}
.sidebar a{color:var(--text);text-decoration:none}
.sidebar a:hover{text-decoration:underline}
.sidebar .note{font-size:12px;color:var(--muted);margin-top:10px}
.main{flex:1;padding:24px}
.code-block{background:#0d1424;border:1px solid #1f2a3d;border-radius:8px;padding:12px;overflow-x:auto;font-family:monospace;font-size:12.5px}
h1,h2,h3,h4{margin-top:20px}
h1:first-child{margin-top:0}
img{max-width:100%;height:auto}
@media(max-width:900px){.container{flex-direction:column}.sidebar{width:100%}}
</style>
</head>
<body><div class="container">
  ${sidebarHtml}
  <main class="main">
<h1>${escapeHtml(title)}</h1>
<article>${body}</article>
<footer style="margin-top:24px;font-size:12px;color:var(--muted)">本文档由 VitePress 风格静态生成器生成。<a href="/" style="color:var(--accent)">返回首页</a></footer>
  </main>
</div></body></html>
`;

// Output index.html and per-page
fs.writeFileSync(path.join(outDir, 'index.html'), template(files[0] ? titles[files[0]] : '首页', mdToHtml(fs.readFileSync(path.join(srcDir, files[0]), 'utf8'))));
files.forEach(f => {
  const slug = path.basename(f, '.md');
  const body = mdToHtml(fs.readFileSync(path.join(srcDir, f), 'utf8'));
  fs.writeFileSync(path.join(outDir, `${slug}.html`), template(titles[f], body));
});

console.log(`Generated ${files.length} docs to ${outDir}`);
