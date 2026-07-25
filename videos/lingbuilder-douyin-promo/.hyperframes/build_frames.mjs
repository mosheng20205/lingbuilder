import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const framesDir = path.join(root, "compositions", "frames");
const audioMeta = JSON.parse(fs.readFileSync(path.join(root, "audio_meta.json"), "utf8"));
const voiceDurations = new Map(audioMeta.voices.map((voice) => [Number(voice.frame), Number(voice.duration_s)]));

const posterFrames = [
  { id: "01-hook", asset: "lingbuilder-01-hero.png", cue1: 1.8, cue2: 4.8, box1: [52, 48, 920, 340], box2: [74, 410, 930, 1050] },
  { id: "02-chinese-ide", asset: "lingbuilder-02-chinese-ide.png", cue1: 2.2, cue2: 6.4, box1: [52, 60, 900, 300], box2: [38, 420, 1004, 1040] },
  { id: "03-real-cpp", asset: "lingbuilder-03-real-cpp.png", cue1: 3.3, cue2: 6.6, box1: [172, 190, 736, 520], box2: [218, 710, 650, 740] },
  { id: "04-win32-designer", asset: "lingbuilder-04-win32-designer.png", cue1: 3.0, cue2: 6.2, box1: [36, 270, 1006, 760], box2: [250, 930, 580, 500] },
  { id: "05-f5-build", asset: "lingbuilder-05-f5-build.png", cue1: 1.9, cue2: 4.6, box1: [350, 208, 380, 220], box2: [126, 420, 820, 960] },
  { id: "06-ai-review", asset: "lingbuilder-06-ai-review.png", cue1: 2.8, cue2: 5.6, box1: [620, 260, 340, 930], box2: [94, 780, 590, 690] },
  { id: "07-lbmod", asset: "lingbuilder-07-lbmod.png", cue1: 3.2, cue2: 6.4, box1: [32, 270, 1016, 560], box2: [310, 810, 470, 600] },
  { id: "08-workbench", asset: "lingbuilder-08-workbench.png", cue1: 3.2, cue2: 6.4, box1: [38, 190, 1000, 760], box2: [44, 920, 990, 570] },
].map((frame, index) => ({ ...frame, duration: voiceDurations.get(index + 1) }));

function posterTemplate(frame, index) {
  const p = `f${String(index).padStart(2, "0")}`;
  const [x1, y1, w1, h1] = frame.box1;
  const [x2, y2, w2, h2] = frame.box2;
  return `<template>
  <style>
    #root{position:absolute;inset:0;width:1080px;height:1920px;overflow:hidden;container-type:size;color:#F8FAFC;box-sizing:border-box}
    .${p}-ground{position:absolute;inset:0;background:#03060B}
    .${p}-visual{position:absolute;left:0;top:0;width:1080px;height:1604px;overflow:hidden;background:#03060B}
    .${p}-backdrop{position:absolute;inset:-32px;background-image:url("assets/${frame.asset}");background-position:center;background-size:cover;filter:blur(28px) brightness(.34) saturate(1.18);opacity:.9}
    .${p}-poster{position:absolute;left:88px;top:0;width:904px;height:1604px;object-fit:contain;object-position:center top;will-change:transform,filter}
    .${p}-rail{position:absolute;left:68px;top:0;width:3px;height:1604px;background:#0087FF;transform-origin:top;opacity:.92}
    .${p}-focus{position:absolute;border:2px solid rgba(33,212,253,.92);border-radius:18px;box-shadow:0 0 0 1px rgba(0,135,255,.22);opacity:0;box-sizing:border-box}
    .${p}-focus-a{left:${x1}px;top:${y1}px;width:${w1}px;height:${h1}px}
    .${p}-focus-b{left:${x2}px;top:${y2}px;width:${w2}px;height:${h2}px;border-color:rgba(137,92,255,.92)}
    .${p}-caption-ground{position:absolute;left:0;right:0;bottom:0;height:316px;background:#07101D;border-top:2px solid #0087FF}
  </style>
  <div id="root" data-composition-id="${frame.id}" data-width="1080" data-height="1920" data-duration="${frame.duration}">
    <div id="${p}-ground" class="clip ${p}-ground" data-start="0" data-duration="${frame.duration}" data-track-index="0"></div>
    <section id="${p}-visual" class="clip ${p}-visual" data-start="0" data-duration="${frame.duration}" data-track-index="1">
      <div class="${p}-backdrop"></div>
      <img class="${p}-poster" src="assets/${frame.asset}" alt="">
      <div class="${p}-rail"></div>
      <div class="${p}-focus ${p}-focus-a"></div>
      <div class="${p}-focus ${p}-focus-b"></div>
    </section>
    <div id="${p}-caption-ground" class="clip ${p}-caption-ground" data-start="0" data-duration="${frame.duration}" data-track-index="2"></div>
  </div>
  <script>
    window.__timelines=window.__timelines||{};
    const tl=gsap.timeline({paused:true});
    const poster=document.querySelector(".${p}-poster");
    tl.fromTo(poster,{scale:1.018,y:0,filter:"brightness(.86)"},{scale:1.0,y:-7,filter:"brightness(1)",duration:${frame.duration},ease:"power3.inOut"},0);
    tl.fromTo(".${p}-rail",{scaleY:0},{scaleY:1,duration:.65,ease:"power3.out"},.08);
    tl.fromTo(".${p}-focus-a",{opacity:0,scale:.985},{opacity:.9,scale:1,duration:.38,ease:"power3.out"},${Math.max(.35, frame.cue1 - .35).toFixed(3)});
    tl.to(".${p}-focus-a",{opacity:.16,duration:.32,ease:"power3.inOut"},${frame.cue2.toFixed(3)});
    tl.fromTo(".${p}-focus-b",{opacity:0,scale:.985},{opacity:.92,scale:1,duration:.42,ease:"power3.out"},${frame.cue2.toFixed(3)});
    window.__timelines["${frame.id}"]=tl;
  </script>
</template>`;
}

function ctaTemplate() {
  const duration = voiceDurations.get(9);
  return `<template>
  <style>
    #root{position:absolute;inset:0;width:1080px;height:1920px;overflow:hidden;container-type:size;color:#F8FAFC;box-sizing:border-box}
    .f09-ground{position:absolute;inset:0;background:#07101D}
    .f09-grid{position:absolute;inset:0;background-image:linear-gradient(rgba(0,135,255,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(0,135,255,.08) 1px,transparent 1px);background-size:72px 72px}
    .f09-stage{position:absolute;left:0;top:0;width:1080px;height:1604px;padding:160px 84px 90px;display:flex;flex-direction:column;align-items:center;text-align:center;box-sizing:border-box}
    .f09-kicker{font-size:24px;line-height:1.2;letter-spacing:.18em;color:#21D4FD;margin-bottom:54px}
    .f09-title{font-size:82px;line-height:1.18;font-weight:700;letter-spacing:-.04em}
    .f09-title strong{color:#168FFF}
    .f09-sub{font-size:34px;line-height:1.45;color:#B7C7DA;margin-top:28px}
    .f09-repo{width:100%;margin-top:112px;padding:54px 42px;border:2px solid #168FFF;border-radius:24px;background:#091424;text-align:left;box-sizing:border-box}
    .f09-repo-label{font-size:24px;line-height:1.2;letter-spacing:.12em;color:#21D4FD;margin-bottom:28px}
    .f09-repo-url{font-size:38px;line-height:1.5;font-weight:700;color:#F8FAFC;overflow-wrap:anywhere}
    .f09-cta{margin-top:56px;padding:24px 46px;border-radius:999px;background:#168FFF;font-size:32px;font-weight:700}
    .f09-caption-ground{position:absolute;left:0;right:0;bottom:0;height:316px;background:#03060B;border-top:2px solid #168FFF}
  </style>
  <div id="root" data-composition-id="09-cta" data-width="1080" data-height="1920" data-duration="${duration}">
    <div id="f09-ground" class="clip f09-ground" data-start="0" data-duration="${duration}" data-track-index="0"><div class="f09-grid"></div></div>
    <section id="f09-stage" class="clip f09-stage" data-start="0" data-duration="${duration}" data-track-index="1">
      <div class="f09-kicker">✱ LINGBUILDER · OPEN SOURCE</div>
      <div class="f09-title">中文写代码<br><strong>生成真实 C++</strong></div>
      <div class="f09-sub">面向中文开发者的集成开发环境</div>
      <div class="f09-repo"><div class="f09-repo-label">GITEE · 开源仓库</div><div class="f09-repo-url">https://gitee.com/<br>MoSheng2020/LingBuilder</div></div>
      <div class="f09-cta">访问 LingBuilder 项目</div>
    </section>
    <div id="f09-caption-ground" class="clip f09-caption-ground" data-start="0" data-duration="${duration}" data-track-index="2"></div>
  </div>
  <script>
    window.__timelines=window.__timelines||{};
    const tl=gsap.timeline({paused:true});
    tl.fromTo(".f09-kicker",{opacity:0,y:18},{opacity:1,y:0,duration:.45,ease:"power3.out"},.1);
    tl.fromTo(".f09-title",{opacity:0,y:30},{opacity:1,y:0,duration:.65,ease:"power3.out"},.55);
    tl.fromTo(".f09-sub",{opacity:0,y:20},{opacity:1,y:0,duration:.45,ease:"power3.out"},1.35);
    tl.fromTo(".f09-repo",{opacity:0,scale:.97},{opacity:1,scale:1,duration:.6,ease:"power3.out"},2.4);
    tl.fromTo(".f09-repo-url",{opacity:.3},{opacity:1,duration:.75,ease:"power3.inOut"},3.25);
    tl.fromTo(".f09-cta",{opacity:0,y:18},{opacity:1,y:0,duration:.5,ease:"power3.out"},5.8);
    window.__timelines["09-cta"]=tl;
  </script>
</template>`;
}

for (let i = 0; i < posterFrames.length; i += 1) {
  const frame = posterFrames[i];
  fs.writeFileSync(path.join(framesDir, `${frame.id}.html`), posterTemplate(frame, i + 1), "utf8");
}
fs.writeFileSync(path.join(framesDir, "09-cta.html"), ctaTemplate(), "utf8");
console.log(`Built ${posterFrames.length + 1} synchronized frame compositions.`);
