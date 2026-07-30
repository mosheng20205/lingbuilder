import {
  ArrowDown,
  Blocks,
  Bot,
  Boxes,
  Braces,
  Check,
  ChevronRight,
  Code2,
  Download,
  ExternalLink,
  GitBranch,
  LayoutTemplate,
  MessageCircle,
  MonitorCog,
  PackageOpen,
  Play,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  WandSparkles,
} from 'lucide-react';
import brandIcon from '../../../image/lingbuilder-ide-icon-v2.png';
import moduleEcosystemImage from '../../../宣传素材/LingBuilder模块生态宣传组图/01-LingBuilder模块生态-主视觉.png';
import './home.css';

const features = [
  {
    icon: Code2,
    index: '01',
    title: '全中文 IDE 工作台',
    description: '中文菜单、命令、诊断和任务输出，配合 Monaco 编辑器、多标签页、工作区搜索与 Diff。',
    tags: ['Monaco', '多文件', '中文诊断'],
  },
  {
    icon: Braces,
    index: '02',
    title: '中文代码生成真实 C++',
    description: '用 .lcpp 编写中文事件和命令，通过本地确定性规则生成可阅读、可迁移的 C++ 工程。',
    tags: ['.lcpp', 'C++', 'Visual Studio'],
  },
  {
    icon: LayoutTemplate,
    index: '03',
    title: 'Win32 可视化设计器',
    description: '拖放设计窗口和控件，管理属性与事件，最终生成真正的 Win32 窗口，而不是网页模拟。',
    tags: ['拖放设计', '事件绑定', '原生窗口'],
  },
  {
    icon: TerminalSquare,
    index: '04',
    title: '构建、运行与调试',
    description: '检测 MSVC、Windows SDK 与 CMake，支持 F5 构建、真实终端、断点、调用栈和变量查看。',
    tags: ['MSVC', 'F5', '原生调试'],
  },
  {
    icon: Blocks,
    index: '05',
    title: '模块与扩展生态',
    description: '通过 .lbmod 封装 C++ 能力，统一安装、启用和项目引用，并向中文代码贡献命令与补全。',
    tags: ['.lbmod', '模块 SDK', '扩展宿主'],
  },
  {
    icon: Bot,
    index: '06',
    title: '可审查的 AI 辅助',
    description: '解释错误、生成项目和提出修复，源码修改先形成 Diff 草稿；离线时核心编译能力仍然可用。',
    tags: ['错误解释', 'Diff 草稿', '本地优先'],
  },
];

const downloads = [
  { label: '123 云盘', href: 'https://1855765585.share.123pan.cn/123pan/jgROvd-lPcW' },
  { label: '天翼云盘', href: 'https://cloud.189.cn/web/share?code=7rEZniR7r2u2' },
  { label: '百度网盘', href: 'https://pan.baidu.com/s/13ApwWnvg7ypC8RkALtnwqg?pwd=z25w' },
  { label: '迅雷云盘', href: 'https://pan.xunlei.com/s/VOyNJe3jycYK-6GzlUFxXApqA1?pwd=emuk' },
];

function Brand() {
  return (
    <a className="home-brand" href="#top" aria-label="返回灵码首页顶部">
      <img src={brandIcon} alt="" />
      <span><strong>灵码</strong><small>LINGBUILDER</small></span>
    </a>
  );
}

export function HomePage() {
  return (
    <div className="home-page" id="top">
      <a className="skip-link" href="#home-main">跳到主要内容</a>
      <header className="home-header">
        <div className="home-container home-nav">
          <Brand />
          <nav aria-label="首页导航">
            <a href="#capabilities">核心能力</a>
            <a href="#workflow">实现方式</a>
            <a href="#audience">适用人群</a>
            <a href="#download">下载体验</a>
          </nav>
          <a className="header-action" href="#download">获取灵码 <ArrowDown size={16} /></a>
        </div>
      </header>

      <main id="home-main">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-glow hero-glow-one" />
          <div className="hero-glow hero-glow-two" />
          <div className="home-container hero-layout">
            <div className="hero-copy">
              <div className="status-pill"><span /> Windows 中文 C++ IDE · 持续开发中</div>
              <p className="home-kicker">CODE IN CHINESE. BUILD IN C++.</p>
              <h1 id="hero-title">用中文构建<br /><em>真正的 C++ 软件</em></h1>
              <p className="hero-lead">灵码是一款面向中文开发者的集成开发环境。用中文源码和可视化设计器表达程序，再由本地确定性规则生成可阅读、可复制、可迁移的真实 C++ 工程。</p>
              <div className="hero-actions">
                <a className="home-button primary" href="#download"><Download size={18} /> 下载体验</a>
                <a className="home-button secondary" href="https://www.bilibili.com/video/BV1g63M6MEMM" target="_blank" rel="noreferrer"><Play size={17} /> 观看演示</a>
              </div>
              <div className="hero-facts" aria-label="产品特征">
                <span><Check size={15} /> 本地确定性生成</span>
                <span><Check size={15} /> 可导出 VS 工程</span>
                <span><Check size={15} /> AI 非硬依赖</span>
              </div>
            </div>

            <div className="ide-preview" aria-label="灵码中文代码生成预览">
              <div className="preview-topbar">
                <div className="window-dots"><i /><i /><i /></div>
                <span>示例项目 · 主窗口.lcpp</span>
                <span className="preview-run"><Play size={12} fill="currentColor" /> F5</span>
              </div>
              <div className="preview-body">
                <aside>
                  <span className="active"><Boxes size={16} /></span>
                  <span><GitBranch size={16} /></span>
                  <span><Blocks size={16} /></span>
                </aside>
                <div className="preview-explorer">
                  <small>解决方案资源管理器</small>
                  <strong><ChevronRight size={13} /> 中文桌面程序</strong>
                  <p>⌁ 主窗口.lcpp</p>
                  <p>▦ 主窗口.设计</p>
                  <p>◇ 应用图标.ico</p>
                  <strong><ChevronRight size={13} /> 模块</strong>
                  <p>▣ Win32 基础控件</p>
                </div>
                <div className="preview-editor">
                  <div className="editor-tab">主窗口.lcpp <span>×</span></div>
                  <div className="code-lines" aria-hidden="true">
                    <div><b>1</b><code><mark>.子程序</mark> 主窗口_创建完毕</code></div>
                    <div><b>2</b><code>　调试输出（<q>“窗口已就绪”</q>）</code></div>
                    <div><b>3</b><code><mark>结束</mark></code></div>
                    <div><b>4</b><code /></div>
                    <div><b>5</b><code><mark>.子程序</mark> 开始按钮_被单击</code></div>
                    <div><b>6</b><code>　信息框（<q>“你好，C++！”</q>）</code></div>
                    <div><b>7</b><code><mark>结束</mark></code></div>
                  </div>
                  <div className="build-panel">
                    <div><span className="active">输出</span><span>问题</span><span>终端</span></div>
                    <p><Check size={13} /> 已生成 main.cpp 与 Visual Studio 工程</p>
                    <p><Check size={13} /> 构建成功，耗时 1.42 秒</p>
                  </div>
                </div>
              </div>
              <div className="preview-status"><span>就绪</span><span>Ln 6, Col 18　UTF-8　中文代码</span></div>
            </div>
          </div>
        </section>

        <section className="principle-strip" aria-label="灵码核心路径">
          <div className="home-container principle-grid">
            <div><span>01</span><strong>中文表达</strong><small>界面、命令、源码与诊断</small></div>
            <ChevronRight aria-hidden="true" />
            <div><span>02</span><strong>确定性转换</strong><small>本地规则可复现、可检查</small></div>
            <ChevronRight aria-hidden="true" />
            <div><span>03</span><strong>标准工具链</strong><small>MSVC、Windows SDK、CMake</small></div>
            <ChevronRight aria-hidden="true" />
            <div><span>04</span><strong>真实软件</strong><small>原生 EXE 与 Visual Studio 工程</small></div>
          </div>
        </section>

        <section className="home-section capabilities" id="capabilities">
          <div className="home-container">
            <div className="section-heading">
              <div><p className="home-kicker">WHAT YOU CAN BUILD WITH</p><h2>一套中文工作流，覆盖桌面开发全链路</h2></div>
              <p>从第一行中文代码，到窗口设计、构建调试、模块复用和项目交付，能力都落在可操作的工程链路里。</p>
            </div>
            <div className="feature-grid">
              {features.map(({ icon: Icon, index, title, description, tags }) => (
                <article className="feature-card" key={title}>
                  <div className="feature-top"><span><Icon size={23} /></span><small>{index}</small></div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                  <div className="feature-tags">{tags.map(tag => <span key={tag}>{tag}</span>)}</div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="home-section workflow" id="workflow">
          <div className="home-container workflow-layout">
            <div className="workflow-copy">
              <p className="home-kicker">DETERMINISTIC BY DESIGN</p>
              <h2>不是解释器，也不是只在 IDE 里生效的演示逻辑</h2>
              <p>灵码把中文源码与设计器模型转换为真实 C++ 和工程文件。IDE 内运行与导出工程共用同一套规则，让结果可阅读、可检查，也能交给其他开发者继续维护。</p>
              <ol>
                <li><span>1</span><div><strong>中文源码与设计模型</strong><small>结构化描述窗口、控件、事件与模块调用。</small></div></li>
                <li><span>2</span><div><strong>本地规则生成 C++</strong><small>关键语义确定性映射，不依赖云端 AI 猜测。</small></div></li>
                <li><span>3</span><div><strong>标准工具链编译</strong><small>生成原生 EXE、C++ 源码和 Visual Studio 工程。</small></div></li>
              </ol>
            </div>
            <div className="pipeline-card">
              <div className="pipeline-node chinese"><WandSparkles size={20} /><span>中文源码</span><small>主窗口.lcpp</small></div>
              <div className="pipeline-line"><ChevronRight /></div>
              <div className="pipeline-node rules"><MonitorCog size={20} /><span>确定性规则</span><small>本地生成服务</small></div>
              <div className="pipeline-line"><ChevronRight /></div>
              <div className="pipeline-node cpp"><Braces size={20} /><span>真实 C++</span><small>源码 · SLN · EXE</small></div>
            </div>
          </div>
        </section>

        <section className="home-section ecosystem">
          <div className="home-container ecosystem-layout">
            <div className="ecosystem-visual"><img src={moduleEcosystemImage} alt="LingBuilder 模块生态能力概览" loading="lazy" /></div>
            <div className="ecosystem-copy">
              <p className="home-kicker">OPEN MODULE ECOSYSTEM</p>
              <h2>把原生 C++ 能力，封装成简单的中文模块</h2>
              <p>模块以 <code>.lbmod</code> 形式安装、启用和按项目引用。开发者可以封装自己的头文件、源码、静态库与 DLL，并同时提供中文命令、补全和诊断。</p>
              <ul>
                <li><PackageOpen size={18} /> 模块包可预览、安装、卸载和迁移</li>
                <li><Sparkles size={18} /> 中文命令与 C++ 映射使用同一份上下文</li>
                <li><ShieldCheck size={18} /> 扩展与原生模块保持清晰的安全边界</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="home-section audience" id="audience">
          <div className="home-container">
            <div className="section-heading compact">
              <div><p className="home-kicker">BUILT FOR CHINESE CREATORS</p><h2>让不同经验的开发者，都能走到真实交付</h2></div>
            </div>
            <div className="audience-grid">
              <article><span>初学者</span><h3>从中文理解程序结构</h3><p>用熟悉的语言认识事件、控件、模块和构建过程，同时接触真实 C++ 工程。</p></article>
              <article><span>桌面开发者</span><h3>更快制作 Windows 工具</h3><p>组合可视化设计、Win32 控件、中文代码和 F5 构建，完成小工具与业务软件。</p></article>
              <article><span>模块作者</span><h3>复用已有 C++ 资产</h3><p>把现有库封装成中文模块，让其他项目通过清晰的命令和依赖模型直接使用。</p></article>
            </div>
          </div>
        </section>

        <section className="download-section" id="download">
          <div className="home-container download-card">
            <div>
              <p className="home-kicker">EARLY ACCESS · WINDOWS</p>
              <h2>下载灵码，体验中文开发到真实 C++ 的完整路径</h2>
              <p>当前版本仍在持续开发与测试中。部分高级构建和调试能力需要 Visual Studio Build Tools、Windows SDK 等本机环境。</p>
              <div className="download-note"><MessageCircle size={17} /> 交流 QQ 群：<strong>1083244094</strong></div>
            </div>
            <div className="download-links" aria-label="灵码下载地址">
              {downloads.map(item => <a href={item.href} key={item.label} target="_blank" rel="noreferrer"><Download size={17} /><span>{item.label}</span><ExternalLink size={14} /></a>)}
              <small>天翼云盘访问码：xi65 · 百度网盘提取码：z25w</small>
            </div>
          </div>
        </section>
      </main>

      <footer className="home-footer">
        <div className="home-container">
          <Brand />
          <p>面向中文开发者的 C++ 集成开发环境</p>
          <span>Windows · 中文编程 · 原生 C++ · 持续开发中</span>
        </div>
      </footer>
    </div>
  );
}
