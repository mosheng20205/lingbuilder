---

## Video direction

以八张已确认的 9:16 成品图作为完整主视觉，不裁掉标题或关键 UI。画面上方约 83% 为产品海报舞台，下方约 17% 为统一的深色字幕安全区；字幕使用高对比白字，当前语义词以青蓝渐变强调。整体采用深黑、青蓝、紫色的技术感配色，保留原图的发光边缘与网格质感。

镜头语言保持克制：每帧只做一次连续的缓慢推近、纵向平移或焦点切换，使用 `power3.inOut`，不使用弹跳、呼吸缩放或循环漂浮。海报作为单一二维平面运动，内部焦点由局部光晕、遮罩和描边提示完成；所有重点变化跟随配音短语发生，并在句末留出稳定阅读时间。转场以短促推移、柔和模糊交叉和一次缩放穿越为主，配合轻量离线音效，不使用背景音乐。

字幕按本地语音识别得到的词级时间分组显示，每组控制在一至两行，并始终位于底部安全区内；画面中的原有标题属于视觉信息，字幕不与其重叠。最后一帧只保留 Gitee 仓库地址，不出现二维码、QQ群或其他联系方式。
format: 1080x1920
duration: 58.416s
message: "用中文写代码，也能得到真正可阅读、可复制、可迁移的 C++ 工程"
arc: Hook → Chinese-first → Deterministic C++ → Designer → Build → AI → Modules → Workbench → CTA
audience: 中文编程初学者、Windows 桌面开发者、易语言经验用户与 C++ 模块作者
mode: collaborative
language: zh-CN
captions: enabled
music: none
---

## Frame 1 — 灵码 LingBuilder

- scene: 01 主视觉完整出现，先建立品牌，再锁定“中文写代码，生成真实 C++”
- voiceover: "灵码 LingBuilder。中文写代码，生成真实 C++。"
- duration: 5.976s
- transition_in: cut
- status: built
- src: compositions/frames/01-hook.html
- poster: 2s
- type: hook
- persuasion: Category creation
- beat: recognition + promise
- blueprint: compose — 主视觉缓慢推近，标题与工作台依次获得青蓝描边强调
- focal: capture/assets/lingbuilder-01-hero.png
- roles: 9:16 主视觉 = 背景与品牌焦点；标题区域 = 第一焦点；工作台 = 第二焦点
- sfx: impact-bass-1, whoosh-short
- scenes: 0.0–1.8s 品牌标题进入并停稳；1.8–4.8s 镜头下移至工作台；4.8s–end 完整画面稳定阅读
- asset_candidates: capture/assets/lingbuilder-01-hero.png — 灵码主视觉 9:16 成品

narrativeRole: 在前三秒同时交代产品名与最强价值主张。
keyMessage: 中文代码可以生成真实 C++。

## Frame 2 — 全中文 IDE

- scene: 02 全中文 IDE 画面占据主舞台，聚焦标题与完整工作台
- voiceover: "从菜单到诊断，从项目模板到错误提示，全中文贯穿开发流程。"
- duration: 6.336s
- transition_in: blur-crossfade
- status: built
- src: compositions/frames/02-chinese-ide.html
- poster: 3s
- type: product_intro
- persuasion: Ease of adoption
- beat: clarity
- blueprint: compose — 保持完整 IDE 可读，镜头从“全中文 IDE”标题顺滑移向工作台
- focal: capture/assets/lingbuilder-02-chinese-ide.png
- roles: 全中文标题 = 开场焦点；IDE 工作台 = 核心证明；右侧 AI 面板 = 次级焦点
- sfx: whoosh-short, click-soft
- scenes: 0.0–2.2s 标题与副标题停留；2.2–6.4s 平移聚焦 IDE；6.4s–end 完整工作台稳定展示
- asset_candidates: capture/assets/lingbuilder-02-chinese-ide.png — 全中文 IDE 9:16 成品

narrativeRole: 明确灵码不是局部汉化，而是贯穿开发流程的中文工作环境。
keyMessage: 中文入口覆盖完整开发流程。

## Frame 3 — 中文代码生成真实 C++

- scene: 03 转换链路从中文 .lcpp 逐层落到 C++ 与 EXE
- voiceover: "中文代码经过本地确定性规则，生成可阅读、可复制、可迁移的真实 C++ 工程。"
- duration: 8.016s
- transition_in: push-slide LEFT
- status: built
- src: compositions/frames/03-real-cpp.html
- poster: 3.5s
- type: feature_showcase
- persuasion: Risk reversal
- beat: trust + proof
- blueprint: compose — 沿中文代码、确定性转换链、C++ 与 EXE 自上而下连续推进
- focal: capture/assets/lingbuilder-03-real-cpp.png
- roles: 中文 .lcpp = 输入；转换链 = 因果连接；C++ 与 EXE = 输出证明
- sfx: typing, whoosh-short, chime
- scenes: 0.0–3.3s 中文代码区域；3.3–6.6s 转换链逐节点高亮；6.6s–end C++ 与 EXE 结果停稳
- asset_candidates: capture/assets/lingbuilder-03-real-cpp.png — 中文代码生成真实 C++ 9:16 成品

narrativeRole: 回答“是不是解释器或 AI 临时生成”的核心疑问。
keyMessage: 转换规则本地、确定，输出是真实工程。

## Frame 4 — 可视化 Win32 设计器

- scene: 04 设计器画面展示拖放、属性编辑与原生窗口结果
- voiceover: "拖入控件、调整属性、绑定事件，可视化完成原生 Win32 窗口。"
- duration: 6.504s
- transition_in: push-slide LEFT
- status: built
- src: compositions/frames/04-win32-designer.html
- poster: 3s
- type: feature_showcase
- persuasion: Show-don't-tell proof
- beat: creation
- blueprint: compose — 从拖放箭头与设计器聚焦到下方原生窗口结果
- focal: capture/assets/lingbuilder-04-win32-designer.png
- roles: 设计器 = 操作舞台；拖放箭头 = 动作提示；原生窗口 = 结果证明
- sfx: click-soft, whoosh-short, chime
- scenes: 0.0–3.0s 工具箱与拖放动作；3.0–6.2s 属性与设计画布；6.2s–end 原生窗口稳定展示
- asset_candidates: capture/assets/lingbuilder-04-win32-designer.png — 可视化 Win32 设计器 9:16 成品

narrativeRole: 证明可视化设计器与原生窗口结果处于同一条开发链路。
keyMessage: 拖放设计最终得到原生 Win32 窗口。

## Frame 5 — F5 构建运行调试

- scene: 05 F5 图标、编译输出、运行窗口与 EXE 结果依次成为焦点
- voiceover: "按下 F5，完成真实编译、调试与 EXE 运行。"
- duration: 5.496s
- transition_in: zoom-through
- status: built
- src: compositions/frames/05-f5-build.html
- poster: 3s
- type: feature_showcase
- persuasion: Concrete proof
- beat: payoff
- blueprint: compose — 沿 F5、编译成功、运行窗口与 EXE 做单向因果推进
- focal: capture/assets/lingbuilder-05-f5-build.png
- roles: F5 = 触发器；编译输出 = 过程证明；运行窗口与 EXE = 最终结果
- sfx: click-soft, typing, chime
- scenes: 0.0–1.9s F5 发光确认；1.9–4.6s 编译输出高亮；4.6s–end 运行窗口和 EXE 停稳
- asset_candidates: capture/assets/lingbuilder-05-f5-build.png — F5 构建运行调试 9:16 成品

narrativeRole: 把“能开发”落实为真实构建、调试和可交付 EXE。
keyMessage: F5 触发真实工具链，而不是界面模拟。

## Frame 6 — AI 帮你写，也让你审

- scene: 06 AI 助手、代码区域与 Diff 预览形成清晰的审查闭环
- voiceover: "AI 能写、能修，也会先给出 Diff，由你审查确认后再应用。"
- duration: 6.192s
- transition_in: blur-crossfade
- status: built
- src: compositions/frames/06-ai-review.html
- poster: 3s
- type: feature_showcase
- persuasion: User control
- beat: relief + trust
- blueprint: compose — 在 AI 助手、代码区域和 Diff 审核卡之间建立清晰视觉闭环
- focal: capture/assets/lingbuilder-06-ai-review.png
- roles: AI 助手 = 建议来源；代码区域 = 修改上下文；Diff 卡 = 用户确认点
- sfx: typing, whoosh-short, click-soft
- scenes: 0.0–2.8s AI 助手与生成动作；2.8–5.6s 代码修改区域；5.6s–end Diff 审核卡稳定强调
- asset_candidates: capture/assets/lingbuilder-06-ai-review.png — AI 代码审查 9:16 成品

narrativeRole: 展示 AI 提效，同时强调用户保留最终修改决定权。
keyMessage: AI 修改可预览、可审查、再应用。

## Frame 7 — lbmod 模块生态

- scene: 07 模块管理器与 lbmod 能力包展示原生 C++ 模块的封装、安装和启用
- voiceover: "原生 C++ 能力可以封装成 lbmod 模块，安装、启用、复用更简单。"
- duration: 6.936s
- transition_in: push-slide LEFT
- status: built
- src: compositions/frames/07-lbmod.html
- poster: 3s
- type: benefit_highlight
- persuasion: Ecosystem leverage
- beat: expansion
- blueprint: compose — 以发光 lbmod 模块包为中心，顺序连接命令、源码、库与项目启用
- focal: capture/assets/lingbuilder-07-lbmod.png
- roles: 模块管理器 = 管理入口；lbmod 包 = 核心焦点；能力卡片 = 模块产物与用途
- sfx: whoosh-short, impact-bass-1, chime
- scenes: 0.0–3.2s 模块管理器；3.2–6.4s lbmod 模块包与连线；6.4s–end 能力卡片和启用状态稳定
- asset_candidates: capture/assets/lingbuilder-07-lbmod.png — lbmod 模块生态 9:16 成品

narrativeRole: 展示灵码不仅能写项目，还能沉淀和复用原生能力。
keyMessage: C++ 能力可以模块化封装并快速接入项目。

## Frame 8 — 完整中文开发工作台

- scene: 08 完整工作台同时呈现编辑器、Git、终端、测试与诊断
- voiceover: "Monaco、Git、终端、调试和测试，汇聚成一套完整的中文开发工作台。"
- duration: 6.84s
- transition_in: zoom-through
- status: built
- src: compositions/frames/08-workbench.html
- poster: 3s
- type: benefit_highlight
- persuasion: Value stacking
- beat: confidence + completeness
- blueprint: compose — 从代码与 Git 局部缓慢拉开到完整多面板工作台
- focal: capture/assets/lingbuilder-08-workbench.png
- roles: 编辑器与 Git = 开发核心；终端与测试 = 工具链证明；完整工作台 = 汇总焦点
- sfx: whoosh-short, typing, chime
- scenes: 0.0–3.2s 编辑器与 Git；3.2–6.4s 终端、测试和诊断；6.4s–end 完整工作台稳定展示
- asset_candidates: capture/assets/lingbuilder-08-workbench.png — 完整开发工作台 9:16 成品

narrativeRole: 在行动引导前汇总专业能力，形成“可以作为主力工具”的完整印象。
keyMessage: 中文优先，同时保留专业 IDE 的完整能力。

## Frame 9 — 访问 LingBuilder 开源仓库

- scene: 品牌主张锁定，中央只展示 Gitee 开源仓库地址，不出现二维码或群号
- voiceover: "想用中文开发 Windows 软件？访问 Gitee，体验灵码 LingBuilder。"
- duration: 6.12s
- transition_in: blur-crossfade
- status: built
- src: compositions/frames/09-cta.html
- poster: 4s
- type: cta
- persuasion: Direct repository invitation
- beat: motivation + action
- blueprint: compose — 品牌主张先出现，随后只锁定唯一的 Gitee 仓库地址
- focal: https://gitee.com/MoSheng2020/LingBuilder
- roles: 品牌主张 = 开场；Gitee 地址 = 唯一行动焦点；底部安全区 = 同步字幕
- sfx: impact-bass-1, whoosh-short, chime
- scenes: 0.0–2.4s 品牌主张出现；2.4–5.8s Gitee 地址写入并放大；5.8s–end 地址稳定可读
- asset_candidates:

narrativeRole: 把兴趣转化为访问开源仓库、查看源码和下载体验的行动。
keyMessage: 访问 https://gitee.com/MoSheng2020/LingBuilder。
