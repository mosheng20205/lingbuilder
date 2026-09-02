const sharp = require('sharp');
const { writePsd } = require('ag-psd');
const fs = require('fs');
const episodeTitle = process.argv.slice(2).join(' ').trim() || '本集内容标题';
const episodeFontSize = episodeTitle.length > 12 ? 54 : episodeTitle.length > 9 ? 62 : 74;

const W = 1920, H = 1080;
const outDir = 'T:/electron/lingbuilder/assets/video-covers';
fs.mkdirSync(outDir, { recursive: true });

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
async function raster(svg) { const png=await sharp(Buffer.from(svg)).png().toBuffer(); const raw=await sharp(png).raw().toBuffer({ resolveWithObject: true }); return {png, data:raw.data, info:raw.info}; }
function svgWrap(content, bg='transparent') { return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#080d1b"/><stop offset=".55" stop-color="#111c35"/><stop offset="1" stop-color="#0a1020"/></linearGradient>
<linearGradient id="cyan" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#64ecff"/><stop offset="1" stop-color="#1596ff"/></linearGradient>
<linearGradient id="amber" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#ffd27a"/><stop offset="1" stop-color="#ff8b3d"/></linearGradient>
<filter id="glow"><feGaussianBlur stdDeviation="16" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<filter id="soft"><feGaussianBlur stdDeviation="55"/></filter>
</defs>${content}</svg>`; }

const layers = [];
layers.push({name:'背景渐变与网格', svg: svgWrap(`<rect width="100%" height="100%" fill="url(#bg)"/><ellipse cx="1530" cy="230" rx="430" ry="300" fill="#1bd8ff" opacity=".13" filter="url(#soft)"/><ellipse cx="350" cy="940" rx="500" ry="230" fill="#ff9f43" opacity=".10" filter="url(#soft)"/><g opacity=".13" stroke="#6ca6cf" stroke-width="1">${Array.from({length:28},(_,i)=>`<path d="M0 ${i*45}H1920"/>`).join('')}${Array.from({length:40},(_,i)=>`<path d="M${i*52} 0V1080"/>`).join('')}</g>`)});
layers.push({name:'IDE工作台界面', svg: svgWrap(`<rect x="920" y="112" width="870" height="720" rx="18" fill="#10182b" stroke="#385078" stroke-width="3"/><rect x="920" y="112" width="870" height="58" rx="18" fill="#1b2945"/><circle cx="952" cy="141" r="8" fill="#ff6b6b"/><circle cx="978" cy="141" r="8" fill="#ffd166"/><circle cx="1004" cy="141" r="8" fill="#32d7ff"/><rect x="950" y="208" width="190" height="574" rx="8" fill="#0b1222"/><rect x="1160" y="208" width="595" height="265" rx="8" fill="#0b1222"/><rect x="1160" y="492" width="595" height="290" rx="8" fill="#0b1222"/><g stroke="#32d7ff" opacity=".65" stroke-width="4"><path d="M1210 260h410M1210 295h330M1210 330h450M1210 365h280M1210 400h390"/><path d="M1210 550h420M1210 585h350M1210 620h460M1210 655h300M1210 690h400"/></g><g fill="#ffb454" opacity=".8"><rect x="970" y="250" width="115" height="11" rx="5"/><rect x="970" y="286" width="145" height="11" rx="5"/><rect x="970" y="322" width="90" height="11" rx="5"/><rect x="970" y="358" width="130" height="11" rx="5"/></g><path d="M1280 755L1410 520l90 110 85-160 140 285" fill="none" stroke="url(#cyan)" stroke-width="5" opacity=".8"/>`)});
layers.push({name:'品牌标题', svg: svgWrap(`<text x="120" y="405" fill="#f7fbff" font-family="Microsoft YaHei, Segoe UI, sans-serif" font-size="112" font-weight="800" letter-spacing="3">LingBuilder</text><rect x="126" y="445" width="610" height="8" rx="4" fill="url(#amber)"/>`)});
layers.push({name:'本集标题（可替换）', svg: svgWrap(`<text x="126" y="555" fill="#ffffff" font-family="Microsoft YaHei, sans-serif" font-size="${episodeFontSize}" font-weight="700">${esc(episodeTitle)}</text><text x="130" y="624" fill="#a9c1dd" font-family="Microsoft YaHei, sans-serif" font-size="36">从中文代码到 C++ 工程</text>`)});
layers.push({name:'徽标与教程标签', svg: svgWrap(`<g transform="translate(132 160)" filter="url(#glow)"><path d="M0 35L42 0l42 35-42 35z" fill="none" stroke="#32d7ff" stroke-width="10"/><path d="M42 0v70M0 35h84" stroke="#ffb454" stroke-width="7"/><circle cx="42" cy="35" r="12" fill="#fff"/></g><rect x="126" y="720" width="252" height="66" rx="33" fill="#32d7ff"/><text x="252" y="766" text-anchor="middle" fill="#07111f" font-family="Microsoft YaHei, sans-serif" font-size="32" font-weight="800">上手实战</text><g fill="#32d7ff" opacity=".9"><circle cx="820" cy="260" r="6"/><circle cx="850" cy="290" r="4"/><circle cx="790" cy="300" r="3"/></g>`)});

(async()=>{
 const rendered=[]; for(const l of layers){ const r=await raster(l.svg); rendered.push({name:l.name, png:r.png, data:r.data, width:r.info.width, height:r.info.height}); }
 const psdChildren=rendered.map(x=>({name:x.name,canvas:{width:W,height:H},imageData:{data:x.data,width:W,height:H}, hidden:x.name==='本集标题（可替换）'}));
 // Photoshop-native editable text layer. The raster counterpart stays hidden in the PSD,
 // but remains visible in the PNG preview for reliable thumbnail rendering.
 psdChildren.push({name:'本集标题｜可编辑文字', text:{text:episodeTitle, transform:[1,0,0,1,126,498], style:{font:{name:'MicrosoftYaHei-Bold'},fontSize:episodeFontSize,fillColor:{r:255,g:255,b:255},fauxBold:true}, paragraphStyle:{justification:'left'}}});
 const psd={width:W,height:H,channels:4,bitsPerChannel:8,children:psdChildren};
 const psdBuf=writePsd(psd); fs.writeFileSync(`${outDir}/lingbuilder-bilibili-cover.psd`, Buffer.from(psdBuf));
 // Composite preview from PNG layers to preserve alpha
 let comp=sharp({create:{width:W,height:H,channels:4,background:{r:0,g:0,b:0,alpha:0}}});
 comp=comp.composite(rendered.map(x=>({input:x.png}))); await comp.png().toFile(`${outDir}/lingbuilder-bilibili-cover.png`);
 console.log(`${outDir}/lingbuilder-bilibili-cover.psd`); console.log(`${outDir}/lingbuilder-bilibili-cover.png`);
})();
