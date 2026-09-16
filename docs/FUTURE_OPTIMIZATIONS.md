# LingBuilder 后期优化事项

- 已完成（2026-09-16 下午）：**F5 生成崩溃「Cannot read properties of undefined (reading 'byRef')」双修复**。根因一：0.7.1 打包版（09-15 20:50）内置的生成器在 `translateModuleCallArguments` 读 `parameter.byRef === true` 无空值保护，`parameter` 在「实参数量超过 binding 声明且无 variadic」时为 undefined，SQLite 全功能演示的 3 实参 `格式化文本(...)` 调用触发 TypeError → 生成请求 HTTP 500；源码侧 09-15 深夜已改为 `parameter?.byRef`（附空安全注释），仅安装包未携带。根因二：`格式化文本`/`列表视图_创建行`/`列表视图_创建行集合` 三条命令的可变参形参只有「可继续传入任意数量」的描述、未标 `variadic: true`（清单校验要求 variadic 形参必须是 `lingValue` 类型且位于末位），本次按规范补标 `variadic: true` 并从 `raw` 切换为 `lingValue`（生成端两者同样透传表达式，C++ 输出不变；C++ 运行时本就是 `template <typename... Args>` 变参模板）。门禁写回：参数摘要 `de563e74`→`a2df62a9`（commands 计数/摘要不变）；`modules.test.ts` 的格式化文本类型断言同步为 `lingValue + variadic`；controlRef 源文件门禁 54→55 已写回（`projectDllMaterializeService.ts` 入列，全量扫描 0 违规）。验证：lint 全绿；`modules/lingcpp/windowDesigner/buildPipeline` 473 项 457 过（16 失败全为既有基线：lingcpp 5 条 HEAD 红 + 4 条环境项 + 7 条缺 `.lingbuilder/projects` 演示工程 ENOENT）；重建 cli.cjs 后对崩溃同款工程 `AI 视频自主生产/基础篇加餐/20 SQLite数据库模块` 跑 `project build --request` 无头构建，`ok:true`、编译成功出 exe。**教训**：打包版 IDE 的 F5 走安装包内 bundle，源码修了不重打包用户侧永远在旧代码上跑；排查时先 `grep` 安装目录 `app.asar` 区分「源码已修」还是「运行代码未修」。

- 已完成（2026-09-16）：**易语言支持库迁移批次——文件流/枚举/日期时间/文本/数学/字节集 66 条命令入账**。按《易语言支持库采集与IDE封装分析汇报》4.1.1 高优先级 24 条与 4.2 五个补全方向全量落地：`lingbuilder.fs.core` 1.1.0 新增句柄式文件流族 23 条（文件_打开/关闭/关闭全部/移动读写位置/移到文件首/移到文件尾/读入字节集/写出字节集/读入文本/写出文本/读入一行/写文本行/读入数据/写出数据/是否在文件尾/取读写位置/取长度/插入字节集/插入文本/插入文本行/删除数据/锁定/解锁）+ 枚举族 2 条（文件_枚举/目录_枚举），运行时为 CreateFileW 句柄注册表（每流互斥锁），锁族走 LockFile/UnlockFile；登记新名义类型 `文件号`。`lingbuilder.std.datetime` 1.1.0 新增日期时间族 17 条，名义类型 `日期时间` = 64 位位打包本地年月日时分秒（year<<26|month<<22|day<<17|hour<<12|minute<<6|second，0=无效哨兵），公历换算用 days_from_civil/civil_from_days，全部本地时区。std.text +6（取左边/取右边/码点转字符/取码点/删首空白/删尾空白）、std.math +11（取整/绝对取整/四舍五入/取符号/正余正反切/自然对数/反对数/置随机种子，种子与随机整数共用线程本地 mt19937）、std.bytes +7（字节集_从文本/重复/分割 + 数值_到十六进制/八进制文本与反向解析）。工厂 `createStandardModule` 新增 `returnLabel` 支持（contributes 返回类型标签与 binding ABI 类型分离）。门禁：审计 89 模块/3469 命令/6090 参数/1303 控件参数、摘要 `a5dfdb55`/`de563e74` 已写回 tests/modules.test.ts；封装清单 89/3469 与五个模块行已同步；audit-param-descriptions 缺失 0；lint/build 全绿。e2e：`examples/yl-migration-file-datetime-demo/`（build-request 内嵌源码 + verify.mjs 62 项断言）经 CLI 无头构建 + exe 落盘探针 `yl-verification-report.txt` 全部 ALL-PASS（63 行），覆盖文件流读写回一致、插入/删除数据、锁定解锁、递归枚举、变参 写出数据/读入数据 打包读回、日期时间分量/增减/间隔/解析、四批全部新命令。**踩坑记录**：① `LB_WriteDataValue` 的 `const wchar_t*` 重载里 `value ? value : L""` 仍是 `const wchar_t*`，无限递归调用自身导致栈溢出（exe 静默停在写出数据），必须显式构造 `std::wstring` 分派到文本重载；② 名义类型（文件号/日期时间）不接受 `= 0` 字面量初始化（语义检查阻断「整数型 不能初始化 文件号」），句柄族声明必须用裸声明 `局部 文件号 号` 两段式；③ `std::filesystem::path` 没有 `is_directory` 成员（自由函数）；④ 变参 binding 的 C++ 形参顺序必须与清单参数顺序逐位一致（字节集_分割 数组出参在 数目 之前）；⑤ `字节集` 数组在 .lcpp 声明为 `局部 字节集 分段[]`（标签「字节集」无「型」后缀），`std::vector<std::vector<unsigned char>>&` 出参实机可用；⑥ 易语言「零
」是 5 字节（3+2），删除字节数按 UTF-8 计。**已知基线漂移（非本批造成）**：并行会话新增未提交文件 `projectDllMaterializeService.ts` 使 controlRef 源文件门禁 54→55，已于同日 F5 崩溃修复会话实算写回（0 违规）。待办：官网命令页 web-sync 需管理员凭据（66 条新命令入账后重跑 `npm run website:sync-commands`/`module:web-sync` 链路）。

- 已完成（2026-09-15）：**new_emoji 目录控件「显示内容」在运行时落地**（用户实测 emoji 项目编辑框填了显示内容、F5 运行后空白）。根因：目录驱动的生成路径（`generateNewEmojiCatalogCreateCall`）只按 manifest `runtime.createParameters` 发射创建调用，而 `EU_CreateEditBox(hwnd,parent,x,y,w,h)` 固定签名没有文本参数，创建后也没有任何「把设计器通用 `content` 写入元素」的步骤——创建导出带 `text_bytes` 的控件（Button 等）不受影响，一切无文本创建参数的目录控件的显示内容都被静默丢弃。落地：① `ModuleDesignerRuntimeMapping` 新增可选 `applyContentCommand`（ABI 固定 `hwnd, element_id, bytes, len`），`validateModuleManifest` 校验声明必须是非空文本；② `generate-new-emoji-module.cjs` 新增 `APPLY_CONTENT_COMMANDS` 表（当前仅 `EditBox: 'EU_SetElementText'`，Space/Pagination/日期族等无文本创建参数组件因「显示内容」语义不明或未经验证暂不声明），runtime 组装时注入声明，已 `--install` 重新生成模块并同步 `electron/.lingbuilder/modules` 副本（两份目录逐字节一致仅差新字段）；③ 生成器在目录创建行之后、`LB_NE_RegisterElement` 之前发射 `LB_NE_ToUtf8` + `EU_SetElementText`（声明存在且 `content` 非空时），内置 `NE_创建编辑框` 分支（自带文本）路径不变。测试 `windowDesigner.test.ts` 新增「目录编辑框在创建后应用设计器显示内容」用例（声明+非空/空内容/未声明三态断言 + 创建先后顺序），「93 项目录」用例追加真实 manifest 端到端断言；本机 `windowDesigner` 145/152（7 失败为缺 `.lingbuilder/projects` 演示工程 fixture 的既有环境失败）、`modules.test` 130/134（4 失败为既有基线：controlRef 门禁审计计数与 CEF3/FBro 3 例，与本次无关，已 stash 复验）、lint/build 全绿。验证：CLI 无头构建 emoji 项目（Win32 Debug）生成 `EU_SetElementText(g_newEmojiWindow, ne_element_4, ...我是编辑框内容❤️😍🙌...)`，exe 启动 PrintWindow 截图确认编辑框渲染完整 emoji 内容（含 ZWJ 序列）。待办：后续目录控件若确认某组件存在「创建后文本」语义（如 Pagination 等），在 `APPLY_CONTENT_COMMANDS` 表与清单声明中补齐即可，机制无需再改。

- 已完成（2026-09-14）：**导入 C++ 工程体验升级**（原生对话框/区外双通道/`.sln` 展开/构建后运行/MSVC 诊断入问题面板/打开目录检测/源码目录生成 CMake/原生 C++ 适配入口/引用外部工程产物链接）。背景：导入既有 C++ 工程此前只有「输入工作区相对路径」一个文本框入口（`App.tsx` `requestWorkbenchPrompt`），`.sln` 整体当单 MSBuild 目标（不解析内部项目与依赖），外部工程只能构建不能运行、报错是英文原样日志、打开含 C++ 源码的目录不会得到任何提示，中文项目也无法引用外部工程的 include/lib。落地：① 主进程新增 `solution-import:pick-project/pick-source-directory/copy-external-project` 三个 IPC（对话框过滤 CMakeLists.txt/.vcxproj/.sln；复制模式排除 Debug/Release/obj/.vs 等产物目录，上限 1GB/2 万文件，落到 `external/<目录名>`），渲染层 `handleImportExternalProject` 重写为「区内直接导入 / 区外推荐切换工作区（`workspace.openPath` 原地切换后等待 `workspaceSwitchInFlightRef` 落定再导入）/ 拒绝切换时提供复制降级」三通道，Web 版保留相对路径输入。② 新解析器 `src/services/solution/solutionFileParser.ts`（Project 块 + `ProjectSection(ProjectDependencies)` + `ProjectConfigurationPlatforms`，UTF-8/UTF-16LE BOM 兼容），`ExternalProjectService.inspectSolution` 把 `.sln` 展开为多个 `external-msbuild` 项目（仅 x64 的项目自动默认 x64，工作区外/非 C++ 项目跳过并中文告警），`solutionService.importExternalProject(path,{mode})` 把依赖 GUID 翻译为 `references`（拓扑分批构建零改动复用）并在写盘前剥离 `solutionGuid/solutionDependencies` 中间字段；`POST /api/solution/import` 接受 `mode:'expand'|'single'`，整 sln 单目标导入保留为兜底。③ MSBuild 构建钉定 `/p:OutDir=<构建目录>\`、CMake 传 `-DCMAKE_RUNTIME_OUTPUT_DIRECTORY`，`locateExecutable`（钉定目录→工程目录常见组合→深度≤3 兜底，executableName 精确匹配优先）+ server 外部分支 run 步骤经 `managedProcessService.start` 托管启动（run.log 进输出面板，windows-dll 不运行）；`resolveOutputDir` 与 `build()` 单一来源复用。④ 新解析器 `src/services/tasks/msvcOutputParser.ts`：编译器 `文件(行,列): error Cxxxx`、链接器 `LINK : fatal error LNKxxxx`、`MSBxxxx` 三类诊断结构化（去重、上限 200 条、未知代码段不误判），约 40 个常见错误码附中文解释（C2065/LNK2019/MSB8020 等），诊断文件路径规整为工作区相对路径供问题面板点击跳转；外部构建结果附带 `compilerDiagnostics` 复用既有 `lingbuilder-compiler-diagnostics` 事件链路。⑤ `GET /api/solution/external-detect`（`externalProjectDetect.ts`，浅层深度≤2，跳过产物/环境目录）检测既有工程与「含源码无工程文件」目录；仅默认解决方案工作区在进入工作台 1.5s 后提示一次（localStorage 按工作区永久记住「不再提示」）；`POST /api/solution/import-source-directory`（`solutionService.importSourceDirectory`）扫描源码（深度≤3，上限 500 文件）生成最小 CMakeLists.txt（生成物注释标注、显式源码列表、C++17）并作为 `external-cmake` 导入，已存在 CMakeLists 需确认覆盖；文件菜单新增「导入 C++ 源码目录（生成 CMake 工程）…」。⑥ 资源管理器 `.cpp/.cc/.cxx/.c` 右键「适配为中文工程…」（命令 `workbench.action.project.adaptNativeCpp` → `POST /api/solution/adapt-native-cpp` → `solutionService.adaptNativeCppToProject`）：读取源码经 `importNativeCppToLingBuilder` 翻译，新建 blank-window 项目并覆写其 `.lcpp` 与设计器窗口模型，原文件不修改、名称冲突自动加后缀重试。⑦ D3 混合解决方案：`collectReferencedExternalArtifacts` 收集 references 指向的外部工程 include 目录（源码根 + include 子目录）与 `.lib`（`locateLibraries`），经 `runControlledWindowDesignerBuild` 新选项合并进 `moduleNativePlan`（`includeDirs/libFiles`），「生成项目/解决方案」时中文主程序直接链接外部 C++ 库；引用收集失败只提示不阻断。测试 `tests/externalProjectImport.test.ts` 11 用例（解析器/展开/引用接线/OutDir 钉定/产物定位/中文诊断/检测/骨架生成/适配）；`externalProject/solution/buildPipeline` 既有套件回归全绿。遗留优化见下方条目。

- 待办（2026-09-14，导入工程体验后续）：① VS 导出工程（`visualStudioProjectExporter`）暂不自动注入 references 指向外部工程的 include/lib（F5 IDE 构建链路已打通，导出的 `.vcxproj` 需用户手工配置 AdditionalIncludeDirectories/AdditionalDependencies）——后续应把 `collectReferencedExternalArtifacts` 的产物传给 `exportVisualStudioProject` 的 `includeDirectories/additionalDependencies` 选项。② `.sln` 展开导入暂不还原解决方案文件夹（`folders` 分组）与 sln 级配置映射到 LingBuilder 解决方案文件夹；`.sln` 中引用工作区外 vcxproj 的场景会跳过（可考虑后续提供「复制该工程进工作区」选项）。③ 复制外部工程进工作区不复制符号链接/junction（copyFile 直接跟进），超大仓库依赖 git/包管理器还原的场景仍建议用「切换工作区」通道。④ MSVC 诊断的 AI 一键解释入口目前复用问题面板既有建议文案，可按错误码把「常见修法」接进 AI 助手预填提示词。⑤ 打开文件夹检测只在「默认解决方案」工作区触发，用户跳过后如需再次唤起，可考虑在命令面板提供「检测可导入的 C++ 工程」命令。

- 已完成（2026-09-14）：「C++ DLL → v2 模块」全链路打通 + 中文项目生成可调用 DLL（`buildProperties.outputType: "dll"`）。背景：IDE 此前只能把中文项目生成为 EXE（`projectKind:'dynamic-library'` 能力在 VS 导出器中沉睡、生成器恒发 `wWinMain`、子程序零导出机制），第三方 DLL 也没有一份可照抄的封装手册。落地：① 生成器 `lingCppWin32Project.ts` 新增 `outputKind:'dynamic-library'`——不生成 `wWinMain`/消息循环，改生成 `DllMain`（DLL_PROCESS_ATTACH 记录实例，不在 DETACH 做清理）+ 首次导出调用时惰性运行时初始化（COM/GDI+/通用控件/窗口类注册，与 EXE 模式 wWinMain 同一套），并为「公开」节的每个子程序生成 `extern "C" __declspec(dllexport)` 包装（经窗口类单例转发；事件处理器/构造析构/私有保护一律不导出；跨 DLL 边界仅允许 POD+文本签名，违规给阻断诊断「不能跨 DLL 边界的类型」；同名公开方法跨窗口类重复导出阻断；new_emoji 后端请求 DLL 输出阻断）。② `externalProjectService.ts` 增加可选 `outputType:'exe'|'dll'`（挂解决方案项目 `buildProperties`，缺省 exe 向后兼容），`resolveExecutableNameParts` 支持 `.dll`+导入库；③ `aiBridgeService.ts` 的 buildRun/nativePreview 读取 outputType 透传 `projectKind`（vcxproj `ConfigurationType=DynamicLibrary`，强制 /MD）、编译侧 DLL 模式加 `/LD` 或链接加 `/DLL` 并强制动态 CRT、run 分支对 DLL 产物不启动进程只报产物路径。IDE 内编译（2026-09-14 同日补齐）：server.ts `runControlledWindowDesignerBuild`（「生成解决方案/生成项目」链路）读取 outputType 并以 DLL 模式生成/编译（`/LD`、`/DLL`、强制 /MD，产物 ProjectMathDll.dll+.lib 实测），DLL 项目工具栏「运行 F5」「重新运行」按钮与「生成并运行当前项目」命令按上下文 `project.dllOutput` 自动禁用，服务端 build-run 路由对 DLL + run 返回 run-unsupported 中文引导（不进入构建）。④ 端到端实测：`examples/dll-module-demo/`（MSVC 自制第三方 DLL 双架构 → migrate-cpp 封装 `lingbuilder.demo.mathdll` → 安装启用 → CLI 无头构建，Win32/x64 双架构 exe 真实调用 demo_add/demo_text_length/demo_distance 结果 5/13/5 ALL-PASS）；`examples/dll-lib-demo/`（公开子程序 加法计算/取字符数/两点距离计算 导出，私有 内部翻倍 未导出，dumpbin 验证 3 导出名）→ 封装 `lingbuilder.demo.projectdll` 双架构模块 → `examples/dll-consumer-demo/` 调用结果 5/13/5 ALL-PASS（exe 旁自动落 ProjectMathDll.dll）。⑤ 手册 `docs/DLL封装成模块操作手册.md`（两种 DLL 来源、薄封装/桥接封装、双架构口径、migrate-cpp 配置样例、诊断对照表）；测试 `tests/lingcpp.test.ts` 新增 4 用例（DLL 模式 DllMain+导出包装+私有不导出、非 POD 签名阻断、EXE 模式回归、outputType 属性与 dll 文件名解析）。同日第二批：F5 生成并运行对 DLL 项目自动禁用（工具栏按钮/命令上下文 `project.dllOutput`、服务端 run-unsupported 护栏）、IDE 内「生成解决方案/生成项目」以 DLL 模式编译、DLL 项目工具栏专用「生成」按钮（保存→解决方案生成链路）。同日第三批（实机验证抓出的 ABI 缺陷，关键）：项目 DLL 导出包装初版把文本参数/返回按 `std::wstring` 跨界，消费者 Debug 工程为 /MDd、DLL 为 /MD，std 对象跨界被按错误布局读取（"灵码LingBuilder" 取长度返回 2）乃至跨 CRT 堆释放（0xC0000374 堆损坏）——已改为 **文本参数 `const wchar_t*`、文本返回经 DLL 侧 `thread_local` 缓冲以 `const wchar_t*` 交出**（与生成器 wideString 实参发 `LingCppWideArg(...)`=c_str() 的既有约定天然匹配）；最小探针（/MDd + 隐式链接）与真实消费者双重复验 5/13/5 ALL-PASS。实机验证方式：CDP 驱动真实 IDE（electron --remote-debugging-port=9222 + --workspace 参数 + 独立 user-data-dir），真实点击工具栏 F5/生成按钮，三个场景（第三方 DLL 消费 F5 运行、DLL 项目 F5 禁用+生成按钮、项目 DLL 消费 F5 运行）全部 ALL-PASS。

- 已完成（2026-09-14）：`.lcpp` 多行文本块语法（三引号）一期落地，解决「内嵌 HTML/JSON/模板只能逐行字符串拼接」的痛点（进阶方案《内嵌网页托管演示》140 行拼接是直接动因）。语法：开始行 `变量 = """`、内容行原样（不解释转义）、结束标记单独一行 `"""`；一期只允许赋值右部，类型声明初值/命令实参/返回出中文诊断并引导两步写法（先声明后赋值，与局部变量提升一致）；未闭合块吞到 EOF 并在开始行报错。实现：共享词法 `electron/src/services/lingCpp/textBlock.ts`（单遍状态机 + 不透明行集合），解析器把块收敛为单条 `LingCppStatement`（新增 `endLine`），生成器 `translateStatement` 文本块分支经 `escapeWideString` 折叠为单行 `L"…\n…"` 宽字面量（Win32/new_emoji 共用），误用兜底降级 `L""` 不吐坏代码。豁免面：新手缩进/回车/注释切换/自动声明/命令展开/补全/跳转/着色、Monaco textBlock 状态、功能库与控件引用扫描、后端命令契约、全局/常量/数据类型重命名、`formatLingCpp`（块行含空行原样保留）全部按块区间不透明。测试 `tests/lingcpp.test.ts` 新增 12 用例（收敛、诊断、生成往返、新手契约、重命名、格式化、词法工具、Monarch）；实测 `AI 视频自主生产/进阶方案/内嵌网页托管演示` 改造后 CLI 构建 + verify-web-host-demo.ps1 14/14 PASS（含零落地断言）。二期待办：命令实参位与 `返回` 文本块（需实参分裂器跨行感知）、常量表初值、`importNativeCppToLingBuilder` 生成回读往返、设计器 UI 补「内嵌文件」属性面板入口（RCDATA 路线与文本块互补）。

- 已完成（2026-09-13）：更新渠道分层与体验计划（Beta Program）一期，解决「所有用户无差别收更新」与预览版跨渠道误推。背景：客户端更新检查从不带 `channel` 参数，云端对空渠道跨 stable/preview 取最高版本，预览版一旦发布且版本号更高就会推给全部用户；且没有用户分层，无法让愿意尝鲜的用户先吃预览版。落地：① 云端 `cloud/api` 新增 `beta-program` 模块——客户端 `GET /v1/beta-program/entitlement`、`POST /v1/beta-program/applications`、`DELETE /v1/beta-program/applications/active`，管理端 `v1/admin/beta-program` 快照/名单增删改/批量导入/报名审核/暂停开关共 9 接口（读四角色、写 super_admin+operator、全部写 AdminAuditLog）；Prisma 新增 `BetaProgramMember`/`BetaProgramApplication`/`SystemFlag` 三表（迁移 `202609130001_beta_program`）；`latest-version` 对 `channel=preview` 做可选鉴权（`resolvePreviewAccess`：JWT+账号 ACTIVE+名单 ACTIVE 未过期+渠道未暂停），任一不满足静默降级 stable，更新检查保持弱依赖不报错。② 管理后台新增「体验计划」页（`cloud/admin/src/BetaProgramAdmin.tsx`）：暂停预览渠道推送（二次确认）、报名审核队列（通过/拒绝带理由）、按邮箱搜索添加（复用 `/v1/admin/users?query=`）与批量导入（去重、逐条失败原因、上限 200）、名单编辑（分组/有效期/备注/停用/移除）。③ 客户端 `checkLatestVersion` 始终显式传 `channel=stable|preview`（普通用户不再被跨渠道最高版本误推预览版），preview 请求在主进程经 `cloudAccountService.currentAccessToken()` 附 Bearer（stable 保持匿名）；设置新增「更新」分区（`updates.autoCheck`、体验计划卡片展示资格/审核状态支持申请与撤回、`updates.experienceChannel` 接收预览版开关、`updates.skippedVersion` 已跳过版本），更新弹窗按渠道分化文案（预览版「抢先体验」+反馈问题入口，稳定版新增「跳过此版本」——该版本只保留标题栏徽标不再自动弹窗），标题栏徽标按渠道显示「升级/体验」。语义边界：被移出名单/到期/渠道暂停的客户端冻结在当前预览版（云端降级 stable 后版本比较自然无更新），稳定版追上后自动恢复更新，不做自动降级（项目数据兼容风险）；老客户端不带渠道参数行为完全不变。测试：`cloud/api/tests/beta-program.test.ts` 15 用例 + `website-content.test.ts` 回归 74/74；`electron/tests/versionCheck.test.ts` 渠道参数与鉴权头用例 8/8；门禁 `cloud/api lint/build/test`、`cloud/admin build`、`electron lint/test:version-check/build` 全绿。二期待办：渠道更新数据统计看板、预览渠道按比例放量、崩溃率熔断、云端「重要更新」强制提示标记、官网体验计划说明页。上线顺序：先云端 API（含迁移）→ 管理后台 → 客户端版本。

- 已完成（2026-09-13）：功能库引用项目常量/全局变量的 C++ 生成顺序修复（进阶方案演示工程实测发现）。规则手册允许「功能库可以使用当前项目常量、全局变量」，但 Win32 模板把 `namespace LingBuilderProjectGlobals` 插值在 `class LingWindowBase` 定义之后，而功能库函数生成为 `LingWindowBase` 的成员函数，库内引用 `预警阈值`、`已处理条数` 等项目符号时 MSVC 报 C2065 未声明标识符。修复：把 `${projectGlobalsDefinition}` 插值点上移到 `class LingWindowBase {` 之前（与 new_emoji 模板「全局在前」的既有顺序对齐），回归测试 `tests/projectGlobals.test.ts` 新增「功能库可引用项目常量与全局变量，全局命名空间必须生成在 LingWindowBase 之前」（断言命名空间先于类定义与 `LBFL_*` 功能库函数），全套 projectGlobals 测试 7/7 通过；演示工程 `AI 视频自主生产/进阶方案/项目变量常量与功能代码/` 已经 CLI 构建 + 真机运行验证（功能库读全局、静态计数、常量链全部按预期渲染）。

- 已完成（2026-09-13）：新手模式子程序就地新建与移动/剪切/复制/粘贴。此前新手模式「新建子程序」一律追加到类体末尾（`astEditService.insertMethod` 硬编码插入点为 `cls.endLine`），且没有任何子程序顺序调整或块搬移入口，用户只能在专业 Monaco 模式手工剪切整块。落地：① `LingCppAstEdit` 新增 `move-method`（上移/下移，`add-method` 增加 `insertAfterMethodName` 锚点、新增 `insert-method-block` 原样粘贴块编辑）；② `astEditService` 新增统一锚点插入原语 `insertMethodBlockPayload`（插入点按 `公开:/私有:/保护:` 访问段行解析归属，段不同时补访问段行并在其后恢复原段，保证后续方法的公开/私有不被插入改变），`moveMethodBlock`=先摘除块再锚点插入（邻居行区间按实际删除行数平移，含空行收缩与悬空访问段行清理），`getLingCppMethodBlock` 导出完整方法块（含声明上方连续备注行，尾随空行不属于块）；`delete-method`/`delete-event` 同步改为连同声明备注一起删除并对齐既有 `delete-constant`/`delete-local` 行为；③ `beginnerCommandTargetService` 注册 `lingcpp.beginner.moveSubprogramUp/Down`、`cutSubprogram/copySubprogram/pasteSubprogram` 五条命令（菜单可见性经 `lingcpp.beginner.hasSubprogramTarget/canMoveSubprogramUp/canMoveSubprogramDown/canPasteSubprogram` 上下文键），`addSubprogram` 携带当前方法目标作锚点；④ DiffViewer 右键菜单渲染五项（仅普通子程序可用，事件处理器与构造/析构给出中文阻断提示；剪贴板存内存块，粘贴重名时中文报错不改源码），「新建子程序」在有当前子程序时显示为「在当前下方新建子程序」。语义约定：粘贴保留子程序自身访问属性（补访问段行实现），不是继承锚点段；功能库缺省访问段为公开、类为私有，与解析器一致。测试：`tests/lingcpp.test.ts` 新增锚点插入/访问段保持、上下移（含跨段移动访问属性不变、事件移动拒绝、边缘不动）、剪切复制粘贴（备注行随块、访问段行补写与恢复、纯文本粘贴拒绝、删除连备注）3 个用例；`tests/menuService.test.ts` 菜单断言扩到 9 条命令并覆盖新命令执行与注销。已知边界：剪贴板是编辑器实例内存态，跨文件不共享；粘贴进功能库的私有子程序会显式补 `私有:` 段行（解析器允许）；悬空访问段行只在删除/移动后「该段紧邻的下一个内容是另一条访问段行（或直到文件尾都是空行）」时清理，紧邻 `结束类` 的空段行保守保留，不动源里原有的空段行。

- 已完成（2026-09-12）：AI Bridge MCP 设计器上下文三级解析与幻影项目封堵。背景：外部 AI 用 MCP 写项目时，若诊断/编辑不传 `designerProject`，控件引用一律误报「找不到控件」（与手工示例缺 `window-designer.json` 时 IDE 满屏误报同源）。落地：① `solutionService` 新增 `readDesignerProjectSnapshot`（返回 `{ project, persisted }`，`persisted=false` 表示文件缺失或无效、实为兜底空模型）；② `AiBridgeService` 新增共享 `resolveDesignerContext`（caller 传入优先 → 按 `projectId` 加载解决方案磁盘设计器 → 都缺省为 none），`lingbuilder.lingcpp.diagnostics` 与 `edit.propose` 上下文统一接入；③ 语言服务 `getLingCppSemanticDiagnostics` / `getLingCppControlReferenceDiagnostics` 新增抑制选项：无设计器上下文时跳过 missing/ambiguous/scope-mismatch/incompatible-kind/incompatible-type 族（带引号、复杂表达式、运行时类型不匹配等形状错误保留），诊断响应新增 `designerContext` 元数据（`source=caller|workspace|none`、`persisted`、`controlReferencesChecked`、中文 summary）与 `lingcpp-designer-context-missing`（未提供/项目未注册）、`lingcpp-designer-model-missing`（已注册但文件缺失，控件错误照常如实报）两条根因 warning；④ `edit.apply` 封堵幻影项目：`.lingbuilder/projects/<未注册项目>/` 写入、未注册项目的 `updatedDesignerProject` 提案一律拒绝并指引先 `project.create`；已注册项目的 `window-designer.json` 禁止当普通文件草稿改写，必须走 `updatedDesignerProject` 布局校验通道；⑤ `native.preview`/`native.export`/`build.run` 传入模型与磁盘设计器不一致时在日志给中文告警（只提示不阻断）。MCP schema 描述同步；`tests/aiBridge.test.ts` 新增回退/缺失根因/未注册跳过/裸设计器草稿拒绝/未注册设计器拒绝/构建漂移告警 6 用例，3 个旧设计器用例改为先注册解决方案。回归：`npm run lint`、`npm run test:lingcpp`（仅存量 sdkDependencyService 本机数据缺失失败）、`npm run build` 通过；`dist/cli.cjs ai-server` 真实 health + REST 诊断 smoke 通过。后续优化：`designerContext` 可扩展 per-window 校验覆盖范围标注；`build.run` 漂移告警可按需升级为阻断开关。
- 已完成（2026-09-11）：构建输出目录开放自定义（对齐 Visual Studio）。新增 `electron/src/services/tasks/buildPathTemplate.ts`（纯函数宏替换与校验，渲染层共用）与 `buildPathService.ts`（服务端目录解析）：构建目录缺省模板 `.lingbuilder-build/$(ProjectId)/$(Platform)/$(Configuration)`、可复制生成源码目录缺省 `generated/cpp/$(ProjectId)`，支持 `$(ProjectId)/$(ProjectName)/$(Platform)/$(Configuration)` 宏（大小写不敏感）；项目级覆盖存解决方案项目 `buildProperties.buildDirectory/generatedSourceDirectory`，工作区默认存 `.lingbuilder/build-configuration.json` 新增同名字段，均只接受工作区相对路径（拒绝绝对路径、`..`、非法字符、保留段 `.lingbuilder/.git/node_modules`）。F5（`/api/window-designer/build-run`）、`runControlledWindowDesignerBuild`（解决方案构建/AI Bridge）、`native-export`、`debug-logs`、`cleanProjects`、external-cmake/msbuild 输出目录与 AI Bridge `build.run` 写入路径全部收敛到统一解析；保存期做项目间构建目录/生成源码目录/源码根目录重合与嵌套的中文阻断校验；工作区搜索与 AI 索引按解析出的输出目录动态排除（`setActiveWorkspaceBuildExcludeDirs`）；项目右键「构建目录…」与命令 `workbench.action.configureProjectBuildPaths` 提供带实时解析预览的对话框；「清理」会同时删除旧缺省目录残留。缺省行为与历史逐字节一致，既有冒烟/导出脚本不受影响。后续优化：`.lingbuilder-build/native-preview|edge-control-preview` 临时暂存仍固定、exe 文件名（`LingBuilderPreview.exe`）自定义、工作区外绝对路径输出（需先重做 `nativeDependencyService` 工作区反推与 AI Bridge 路径白名单）。测试 `tests/buildPathService.test.ts` 已挂入 `test:lingcpp` 链。
- 已完成（2026-09-12）：CEF3 浏览器模块开放 JS 交互（cefQuery）能力，页面可以调用原生。桥接层（`electron/native/cef3-bridge/`）新增 `LB_CEF3_EnableJsQuery` / `LB_CEF3_JsQueryRespond` 两个导出与 `BridgeJsQueryHandler`：浏览器侧每浏览器一个 `CefMessageRouterBrowserSide`（`AddHandler` 要求 UI 线程，由 `PostToCefUi` 的浏览器创建任务首步 `SetupJsQueryRouter()` 完成，构造函数里注册会违反线程约束）；渲染侧在 `BridgeApp::OnWebKitInitialized` 创建 `CefMessageRouterRendererSide` 并在 OnContextCreated/OnContextReleased/OnProcessMessageReceived 转发，查询函数因此注入 `window.cefQuery`；配置经 `OnBeforeChildProcessLaunch` 注入命令行开关 `lingbuilder-js-query` 传给渲染子进程。应答走 pending 表 `(browser handle, query_id)`：`OnQuery` 在 CEF UI 线程登记回调并经 `EmitAsyncEvent`（120 秒超时、default_action=0，**不得**进 `CEF3_EVENT_ASYNC_DEFAULTS`——宿主未表态挂到超时才能对页面回 Failure(-4)，进了默认动作表就会立即续跑打断异步应答）派发「查询请求」，`.lcpp` 处理器同步执行时调 `CEF3_查询应答(控件名, 查询ID, 结果文本)` / `CEF3_查询应答失败(控件名, 查询ID, 错误码, 错误文本)` 从 pending 表取回调（CEF UI 线程直调、否则 PostTask）；`.lcpp` 层没有受管续跑命令，命令式应答是唯一应答路径。模块新增 `CEF3_启用JS扩展` / `CEF3_查询应答` / `CEF3_查询应答失败` 三条命令与 `jsQueryFunctions` 控件属性（data2 第 5 字段，解码处需 5→4 字段 fallback，否则旧 4 字段工程解析全军覆没）。**注册时序硬约束**：通道必须在 `LB_CEF3_Initialize` 之前注册，生成器在 `CEF3_初始化` 里读属性烘焙注册；运行期调用 `CEF3_启用JS扩展` 只在初始化前有效（文档与命令描述已写死）。**单通道边界**：CEF3 每程序一条查询通道（`CefMessageRouterConfig` 一对函数名），与 FBro 的多通道注册不同；多控件共享同一全局通道，事件经 `user_token` 区分控件。取消通知：页面主动 `cefQueryCancel` / 导航 / 浏览器关闭 / 渲染进程终止都会触发浏览器侧 `OnQueryCanceled` 并派发「查询已取消」给 `.lcpp`；但 CEF 150 中页面主动取消**不会**再回调页面自身的 `onCanceled`（CEF 内建语义，已实测），文档不得虚构。测试：`LingBuilderCefBridgeTests.cpp` 端到端回环（页面 cefQuery → 查询请求事件 → JsQueryRespond → 页面 onSuccess 收到 `jsquery-pong` + cefQueryCancel 触发「查询已取消」计数）两遍全过；`tests/modules.test.ts` 新增生成器/桥符号用例；审计基线写回 87 模块 / 3339 命令 / 5852 参数 / 1303 控参，摘要 `e5bf21d1` / `ce6312e5`；CEF3 事件目录 96→98、家族公开命令 399→402；桥 DLL 同步 SDK 模块目录后 SHA-256 一致（`484da6c1…`）。既有坑位记录：① `CefMessageRouterBrowserSide::Handler` 非 CefBase，不得加 `IMPLEMENT_REFCOUNTING`；② BridgeClient 成员声明顺序决定析构顺序（handler 必须声明在 router 之前）；③ 测试里注册 per-browser V4 回调后若不注销，后续 native-test 导航的「资源加载前」会挂到 30 秒超时导致 `navigation_committed` 假失败——查询段已移到 jsdialog 之后并在断言后注销回调；④ `LingBuilderCefBridgeTests` 第 1085 行 continuation `InvokeV4` 在 build 脚本背靠背负载下偶发失败（stash 甄别基线同款 1064 行，属既有脆弱断言，非本改动回归）。官网命令页口径待重跑 `npm run module:web-sync`。

- 已修复（2026-09-09）：裸 `返回` 语句不再被降级为注释。`.lcpp` 语句翻译器对裸 `返回`（事件/子程序内提前结束，可选空括号或分号）的判定用的是 `/^返回\b/`——`\b` 是 ASCII 词边界，对纯中文语句永远不成立，该规则实为死代码：裸 `返回` 一直落进兜底分支被降级成 `// 暂不支持的中文 C++ 语句：返回` 注释（`返回()` 更糟，会被兜底的调用语句翻译当成函数调用生成 `返回();`，MSVC 直接 C3861），事件处理器因此少了一次提前返回、继续执行后续语句。现改为整句匹配 `/^返回\s*[（(]?\s*[）)]?\s*;?\s*$/u`（带值返回仍由 `parseReturnValue` 先行接管，`返回 表达式` / `返回(表达式)` 行为不变），生成正确的 `return;`。`tests/lingcpp.test.ts` 既有用例补上「不得出现『暂不支持的中文 C++ 语句：返回』」负向断言（原用例只断言 `return;` 存在，被生成器派发代码里的 `return;` 误满足，掩盖了本缺陷）。同日排查 CEF3 合集示例导出 `.lcpppkg` 分享包时由第 09 集示例 `读取结果按钮_被单击` 的裸 `返回` 触发发现。注意：正在运行的 IDE 实例因 utilityProcess 缓存旧生成器，需重启后才生效。

- 已完成（2026-09-09）：FBro 四火山工程缺口全量封装（bridge 2.7.0 / 模块 `135.0.21.2.7.0`）。①WS 拦截闭环：`FBro_绑定事件` 开放「初始化WebSocket客户端创建/连接/关闭/消息/发送」五事件（wssClient 受管句柄 + 数据受管缓冲；消息/发送/连接为同步事件，响应 JSON 可写回篡改 `url`/`protocols`/`data`+`size`，缺省不写回即放行）；`FBro页面_发送文本/缓冲、客户端发送文本/缓冲`（SendByBrowser 通道）、`FBroWS客户端_是否空/取地址/取协议/取扩展/发送文本/发送缓冲`、`FBro请求_取方法`。②本地服务器 8 个回调全部转公开（服务器已创建/已销毁/客户端已连接/已断开/WebSocket已连接/WebSocket消息到达/WebSocket握手请求/HTTP请求到达），`FBro服务器_创建` 增加 控件名 参数以派发事件给创建者实例，握手请求默认放行。③DOM 遍历快照族 18 条（`FBro框架_遍历DOM` + `FBro遍历_*` 访问/按路径写回 + `FBro右键参数_取类型标志`）：官方 `VisitDOM` 回调在浏览器进程宿主不派发（CEF 语义仅渲染进程可调，桥内保留官方 visitor 参考实现），实际执行为页面内 JS 序列化到受管快照；`FBroHsDOMNode_GetElementAttribute` 走受管快照查找等价，`FBroHsDOMNode_GetLastChild` 保持 planned。④运行时上下文：`FBro会话_创建上下文` + `FBro会话_使用上下文重建`（TryCloseBrowser 后原地换 RequestContext 重启）+ `FBro_取主浏览器`。同批修复既有 wrapper 运行时比较错误：`LB_FBro_TaskWait` 成功返回 `LB_FBRO_OK` 而非 `LB_FBRO_TASK_COMPLETED`，8 处任务等待比较全部改正（此前填表取值/取坐标/取源码/取文本/服务器创建等在运行时会误判失败——批次 3/7 仅编译验证未暴露）。端到端冒烟（examples/fbro-intercept-dom-demo）：服务器创建/句柄/客户端连接事件、CreateContext 句柄、使用上下文重建=1、exe 存活 170 秒响应正常全部通过；遗留限制：`ExecuteJavaScriptToHasReturn` 结果投递在复杂页面有约 60 秒量级延迟且偶发超时（FBro SDK 通道行为），DOM 遍历在重页面需等待、已把 wrapper 等待放宽到 150 秒；WSSClient 未用符号（Connect/Close/Destroy/IsSame/GetBinaryType）与 `FBroHsDOMNode_GetLastChild` 保持 planned；发布前需按官方打包流程重出 2.7.0 归档、上传 R2 并在管理后台发布清单（跑 `sdk-catalog:check` 应见 sequence 递增）。
- 已完成（2026-09-11）：FBro WS 拦截五事件修复——生成 exe 兼任 CEF 子进程（火山同款架构；bridgeVersion 暂维持 2.7.0，发版出归档/改清单时随 sdk-catalog 链路一并 bump）。此前「初始化WebSocket客户端创建/连接/关闭/消息/发送」五事件在生成 exe 中永不触发：官方 FBroHsEvent.h 将这五钩子归入 CefRenderProcessHandler 组（渲染进程触发），而生成工程 `browser_subprocess_path` 指向官方 FBroSubprocess.exe 薄壳，桥与 BridgeInitEvent 只在浏览器进程，渲染层钩子无处投递。路径 B（FBroSubprocess.exe 找用户 DLL 注入点）已验证否决：该 exe 为 124KB 薄壳，导入表仅 libcef/FBrowserCEF3lib 三函数+KERNEL32，无任何插件/配置/环境变量扩展点；且火山参考工程 vipkg_main.cpp 实际把 subprocess 指向自身 exe（`GetModuleFileName` 取自身文件名），FBroHsInitPro 在子进程内自跑子进程循环并阻塞至退出。据此实现路径 A：`LB_FBRO_INITIALIZE_OPTIONS_V1` 新增 `use_self_subprocess`（生成器 `LB_FBroInitializeInProcess` 置 1，旧工程缺省仍走 FBroSubprocess.exe，无版本倾斜）；桥新增导出 `LB_FBro_RunCefSubprocessIfRequested`（生成的 wWinMain 最先调用，命令行含 `--type=` 即以 BridgeInitEvent 进入 FBroHsInitPro 子进程流程）；桥内新增命名管道中继层（浏览器进程 InitializeEx 起 `\.\pipe\LingBuilderFbroHook-<pid>` 服务端并经环境变量 `LINGBUILDER_FBRO_HOOK_PIPE` 下发管道名；渲染侧五钩子把事件转发回浏览器进程派发 .lcpp 处理器，篡改响应原路带回渲染进程写回——事件通道为**每请求一条短连接**严格锁步，长连接双工版存在写端永久阻塞的死锁（已实测），勿回退）。便捷语义：事件 fields 追加 `text`（载荷可无损 UTF-8 解码时）；响应 JSON 支持 `{"text":"..."}` 简写（服务端换算 data(base64)+size）；渲染侧受管句柄加位 30（`0x40000000`）下发，浏览器侧 `FBroWS客户端_取地址` 等访问器对偏见句柄经 `wss-query` 反向路由回渲染进程查询（Send/SendBuffer 远程句柄返回 NOT_SUPPORTED）。端到端验收（examples 同款 ep15）：外网 wss 与本地回环两条 WS 连接的创建/连接事件均触发且地址可读（含 URL），echo-test 消息拦截可读、`{"text"}` 篡改后页面收到的即篡改内容（页面 title 断言），服务器回环收到 `back:已篡改-标记`，渲染主线程 CDP evaluate 可响应（不再冻结），exe 存活响应正常；ep13/14/16 重建冒烟全过（架构变更对无钩子项目无回归）；`sdk-catalog:check` 门禁绿（bridgeVersion 不在锚定字段）。修复顺带项：桥头文件 `LB_FBro_ResponseCreate` 声明多了 object 参数（实现/清单为零参），导致重新生成工程编译失败——已改 `(void)`。遗留后续优化：独立进程（LingBuilderFbroHost/exe 兼任 Host）模式下 WSS 五事件的跨进程转发尚未接通（Host 内浏览器同样能拦截，但事件需经 Host WebSocket 协议回传控制器，当前只在进程内模式验证）；中继只支持单浏览器实例并发（多实例按 browserId 路由已支持，跨渲染进程多连接已支持）。**官方 SDK 升级核对清单**：本机制只依赖 FBroHsInitPro/FBroHsInitEvent 五虚函数/FBroHsVIPControl_EnableWebsocketClientHook/FBroHsWSSClient_* 公开契约（override 编译期校验）+ 三条行为假设（五钩子渲染进程触发、FBroHsInitPro 子进程自循环、缺省不写回放行）——升级后跑 ep15 冒烟即可甄别，不得引入 proxy DLL/内部符号依赖。

- 已完成（2026-09-08）：进程内 FBro 浏览器开放 CDP 调试端口。此前只有独立进程 Host 会预留 CDP 端口，进程内模式生成代码走 `LB_FBro_Initialize`（内部硬编码 `remote_debugging_port = 0`），`FBro_取调试端口` 对进程内固定返回 0，第 08 集《CDP 自动化》口播「进程内模式没有可供 CDP 连接的独立端口」即源于该产品限制。现在标准 Win32 与 new_emoji 两套生成模板的进程内初始化统一改走 `LB_FBro_InitializeEx`，初始化时按项目内进程内控件的 `enableDevTools` 属性（缺省启用）决定是否自动预留一个本机回环端口（同独立 Host 的 `ReserveLoopbackPort` 算法）并写入 CEF `remote_debugging_port`——任一进程内控件启用即开启、全部关闭则不预留（与独立 Host 的 flag 16 语义一致）；`FBro_取调试端口` 对进程内返回该真实端口，返回 0 表示尚未初始化、未启用开发者工具或预留失败。关键约束：CEF 的调试端口只在初始化时生效、事后无法补设，且初始化发生在 `wWinMain`（早于任何 `.lcpp` 事件代码），因此**没有也不提供**运行时设置端口的命令；初始化辅助函数带进程级一次性守卫，`wWinMain` 与每窗口 `FBro_初始化` 重复调用不会二次预留。同批更新 `FBro_取调试端口` manifest 描述、`docs/modules/fbro/control.md` 新增「CDP 调试端口」小节、规则手册与测试断言（modules.test 新增 6 条断言：snippet 注入、InitializeEx 端口写入、wWinMain 守卫、初始化调用、端口读取、旧 `LB_FBro_Initialize` 清除；另新增 enableDevTools 开关测试：缺省/显式 true 预留端口、显式 false 不预留且初始化仍走 InitializeEx、独立进程模式不受进程内烘焙影响）。门禁同批写回：audit 基线 3021/5184/1271（摘要 8f45195e/1972ba6c，含 FBro 合集 `FBro_替换资源响应内容/文件` 两命令入账）、FBro family 476、用户文档公开命令 467、封装清单 3021。已知边界：端口在进程内模式是**全局单例**——同一生成程序如有多个进程内 FBro 控件，它们共享同一个 CEF 实例和调试端口（与 CEF 架构一致）；`FBro 5.39.55` 覆盖清单随生成脚本重新出数。

- 已完成（2026-09-08）：FBro 资源响应事件字段升级与正文捕获开放为中文命令。`lingbuilder.fbro.events` 新增 `FBro_读资源响应正文(控件名, 最大字节数, 完成处理器)`；资源响应事件（`OnResourceResponse` / `OnResourceLoadComplete` / `GetResourceResponseFilter`）改为手写覆盖，Bridge 直接读 `CefRequest` / `CefResponse` 投递 `request_id`、`request_url`、`method`、`status_code`、`mime_type`、`charset`、`headers`（响应头对象）+ 原 `status`、`received_content_length`。正文捕获在「资源响应到达」处理器内安装有界过滤，完成后触发合成事件「资源响应正文到达」，字段 `url`、`status_code`、`mime_type`、`received_bytes`、`truncated`、`error`、`body_text`、`body_base64`。关键实现约束：FBro 资源事件在多个 IO 线程交错、`GetResourceResponseFilter` 与 `OnResourceResponse` 可能乱序，必须按 `request_id` 精确配对，不能用单一“当前请求”槽位；且必须走官方唯一受支持路径（`FBroHsResponseFilter` 子类 + `FBroHsResponseFilter_Create` 包装 + 官方 `End` 回调派发），自定义 `CefResponseFilter` 直接安装会静默失效并造成堆损坏（弃用方案，勿再尝试）。端到端验证见 `AI 视频自主生产/FBro 指纹浏览器合集/07 获取资源响应/验证报告.md`（四个文本资源正文全部捕获，进程正常退出 0 残留）。已知边界（后续优化方向）：正文捕获是请求级、不修改响应内容、不重新发起请求；`file://` 同样走过滤器路径；二进制资源按最大字节数截断、完整正文走 `body_base64`。
- 已完成（2026-09-09）：FBro 资源响应替换开放为高层中文命令。`lingbuilder.fbro.browser` 新增 `FBro_替换资源响应内容(控件名, 地址, 内容)`、`FBro_替换资源响应文件(控件名, 地址, 文件路径)`、`FBro_清除资源响应替换(控件名, 地址)` 与 `FBro_清空资源响应替换(控件名)`，宿主侧经 `LB_FBro_VipResourceCommandAsync`（官方 VIP 资源规则，find_type 0 精确匹配，火山 VIP高级功能测试 同款用法）同步等待后释放任务。语义与 CEF3 的查找替换不同：FBro 是按 URL 规则的整响应替换（缓冲/文件两种载荷），且走 FBro VIP 授权门禁（无 Key 返回 0 并中文提示，fail-closed，不得放行）。另确认两条产品行为：窗口 `创建完毕` 内不得调用 `FBro_导航`（浏览器未就绪，需先绑定 `浏览器创建完成` 再导航）；旧版 ep07 成片「公开接口不提供响应正文/响应头」表述已随本次能力重制订正。

- 已完成（2026-09-08）：CEF3 资源响应正文修改开放为中文命令。桥接层 `BridgeResponseFilter` 的字节查找替换实现（`LB_CEF3_ResponseFilterCreate` / `LB_CEF3_ResponseFilterSetReplacement` / `LB_CEF3_ResourceRequestHandlerSetResponseFilter`）此前只是 C ABI 能力、未暴露给 `.lcpp`；现在 `lingbuilder.cef3.browser` 新增 `CEF3_替换资源响应内容(控件名, 查找内容, 替换内容)` 与 `CEF3_清除资源响应替换(控件名)` 两条高层命令，生成器在宿主侧包装：宽字符参数边界做确定性 UTF-8 转换，浏览器未创建时排队并在 `CEF3_创建单个` 桥接句柄就绪的同步点附加（赶在初始导航请求之前）。端到端验证见 `AI 视频自主生产/CEF3 浏览器模块合集/12 修改资源响应数据/验证记录.md`（替换与清除均以页面标题字节被真实改写为准）。已知边界（后续优化方向）：替换配置是浏览器级全局，不支持按 URL/资源类型精确限定，按需限定需在桥接层为每个请求暴露裁决点；参数是宽字符串按 UTF-8 编码，任意二进制查找/替换仍只能走底层 `LB_CEF3_*` C ABI + 受管缓冲；只能改响应正文，改响应头/状态码需要自定义 `CefResourceHandler`（已有 Scheme 处理工厂一族），不要把两者混为一谈。同批补齐第 11 集 `CEF3_读资源响应正文` 欠下的文档与审计登记（README 接口表、controlRef 审计基线、模块封装清单计数）。

- 已完成（2026-09-05）：补齐 LingCpp 数组运行时。此前数组只能声明、传参、下标访问和用 `枚举循环首` 遍历，没有任何命令能读取成员数或增删成员。新增内置 `lingbuilder.std.array@1.0.0`，提供 `数组_取成员数/是否为空/取成员/置成员/加入成员/插入成员/删除成员/清空/查找/是否包含/排序/倒序/重定义` 共 13 条命令，直接作用于语言原有数组声明并映射到 `std::vector<T>`，索引从 0 开始、越界安全返回失败值。binding 新增泛型 `array`（数组左值，按 `std::vector<T>&` 原样传递）和 `arrayElement`（与数组元素类型一致的值，作为返回值时由实参定型）两个类型；清单校验拒绝 `array` 作返回值、缺少 `array` 参数的 `arrayElement`，以及泛型数组跨原生 DLL ABI。语言服务同步补上 `名单[0]` 的元素类型推断、数组变量的数组维度（项目全局、程序集、局部、记录字段），`areLingCppTypesCompatible` 不再把数组和标量视为兼容，并对数组命令校验实参个数、数组左值和成员类型。`数组_查找/是否包含/排序` 用 `std::void_t` 探测元素类型是否支持比较，记录型数组稳定返回失败值而不是编译失败。`smoke:array-native` 覆盖真实 MSVC x64 编译与运行时行为断言（`--runtime-only` 可在缺少 v143 平台工具集的机器上单独验证运行时）。后续若开放数组字面量初始化、多维数组或按字段排序，必须继续复用同一 binding 类型与诊断链路，不得回退到分隔符文本或 JSON 句柄模拟数组。

- 已修复（2026-09-02）：SDK 按需安装在归档已完成并通过 SHA-256 后不再等待 aria2c 进程退出，UI 会立即离开“正在下载”，分别显示下载进度/速度，并进入“正在解压”；同时兼容历史生成的平铺 SDK ZIP（根目录为 `sdk/`、模块清单和 README），解压前安全归一化到受控模块目录，避免误报“ZIP 顶层目录必须是模块 ID”。

- 已修复（2026-09-01）：Windows SDK 依赖安装在解压后将 staging 目录原子重命名到共享缓存时，Defender/索引器等进程可能短暂持有目录句柄，导致 `EPERM: operation not permitted, rename`。SDK 服务现在对下载归档、备份目录、staging 到目标目录及回滚目录使用有界退避重试（仅针对 `EPERM`/`EACCES`/`EBUSY`），并保留最终失败诊断；新增回归测试覆盖瞬时 `EPERM` 后成功。后续 SDK 安装仍必须保持原子替换、校验和路径安全门禁，不得用无限重试或静默覆盖失败。

- 已修复（2026-08-22）：窗口设计器在大项目（如 `datagrid-api-demo`，109 控件 + 702 行 `.lcpp`）中选中/拖动/缩放控件时主线程卡顿数秒。根因不在拖拽预览本身（预览已是绕过 React 的 DOM 直写），而是拖拽提交后设计器项目状态发布触发 `buildLingCppLanguageContext` → `getLingCppSemanticDiagnostics` → `getLingCppControlReferences`，其中 `resolveControlReference` 对每个 `controlRef` 参数都重新全文 `parseLingCpp`（经 `getRuntimeControlVariablesAtLine` 与两套 `getLingCppControlSymbols`→`selectDesignerWindows`，共 3 次/参数），形成 O(引用数 × 全文解析)；同时 App 的 `refreshModuleContext` 在每次设计器提交后都换新引用，令语言上下文 useMemo 与问题面板 effect 重复重算。控件引用解析现在一次解析共享：`controlReferenceService` 预构建方法列表、类名集合与两套作用域符号表，`runtimeControlTypeService` 新增 `collectRuntimeControlMethodCandidates`/`getRuntimeControlVariablesFromMethods` 复用入口，`getLingCppControlSymbols`/`selectDesignerWindows`（两个服务各一份）接受预解析类名集合；`refreshModuleContext` 在模块列表内容未变时保持引用稳定。实测（CDP CPU 采样）：单次拖拽提交主线程阻塞由 ~4.7s 降至 ~0.2-0.9s（dev 模式，含 jsxDEV 开销），`getLingCppSemanticDiagnostics` 包含时间 9260ms→0ms、`parseLingCpp` 8624ms→20ms；拖拽帧率中位 17ms。后续语言服务新增“每参数/每行”逻辑时必须复用同一次解析产物，禁止在循环中重复全文 `parseLingCpp`；若大项目仍有可感卡顿，下一步应评估 DiffViewer 语言上下文 useMemo 与 App 问题 effect 的合并或防抖，而非恢复逐参数解析。

- 阶段 3 实施中（2026-08-22）：CDP 客户端模块暂升 `lingbuilder.cdp.client@3.0.0`，现有 144 条 `CDP_` 命令和 14 个受管类型。已落地并通过生成测试与 MSVC Win32/x64 编译的地基包括：Target/Session/Frame/ExecutionContext 注册与 OOPIF/Worker 自动附加、Runtime binding、Overlay、严格多点触摸、Debugger 断点/暂停/单步/调用帧/作用域、Performance 指标、Storage usage/显式确认清理、exact-origin + 有限期限 + 逐次裁决的证书错误门禁，以及版本化录制原子落盘。阶段 1/2 smoke 继续通过；阶段 3 尚未完成，剩余 screencast、Tracing/CPU/Coverage/Heap 完整任务输出、录制自动采集与确定性回放、分类有界事件队列、AttachWorker 生命周期和分场景真实 smoke。不得在这些门禁通过前宣称阶段 3 完成。

- 已完成（2026-08-22）：AI 助手会话由项目级 `AiConversationService` 管理，按 `.lingbuilder/ai/<projectId>.sessions.json` UTF-8 原子写入，支持会话新建、切换、删除、重启恢复和损坏文件中文诊断；右侧停靠栏默认收起并保存宽度。后续应在不改变该权威存储边界的前提下增加历史摘要、关联文件、会话重命名、消息级时间戳稳定化和窄屏覆盖式布局；LangChain.js 如接入，仅作为摘要、检索和 Provider 编排适配层，不能接管跨项目记忆或编辑权限。

- 已修复（2026-08-20）：旧上传项目中的 `.lcpp` 命令 `上传_打开("控件名")` 曾被原样生成到 C++，而 Win32 运行时实际导出的是 `上传_打开文件选择`，导致 F5 出现 MSVC C3861。统一中文规则新增兼容别名解析，旧调用现在确定性生成有效运行时符号；新项目仍应迁移到非可视 `FileDialog` 与 `文件对话框_*` 命令。后续新增旧语法兼容时必须在规则层维护别名并覆盖生成回归，不得只在 C++ 模板中追加包装函数。

- 已修复（2026-08-20）：项目 `lingbuilder-project` 使用 AI 生成 `剪贴板_置文本` 后，项目模块清单补启用 `lingbuilder.system.clipboard@1.1.0`，确保 F5/导出包含剪贴板 C++ 运行时；后续应把未启用模块命令在生成前提升为明确中文阻断诊断，避免仅由 MSVC C3861 暴露。

- 已修复（2026-08-20）：`.lcpp` 中对当前窗口设计器控件的属性赋值（例如 `编辑框1.内容 = "..."`）现在复用设计器控件符号上下文，不再被变量字段赋值检查误报为“变量尚未声明”；普通变量和项目数据类型字段仍继续执行原有类型与字段校验。

- 已修复（2026-08-19）：`.lcpp` 局部变量初始表达式中的合法设计器控件引用（`controlRef`）不再被普通变量作用域检查误报为“未知名称”。语言服务现在读取当前窗口设计器控件符号后再执行局部初始化诊断，同时继续由统一控件引用服务负责不存在、歧义和类型不兼容诊断；后续新增控件引用语义必须继续复用同一设计器符号上下文。

- 已修复（2026-08-16）：按 F5 运行普通 Win32 项目时，启动窗口会被创建在 IDE 窗口之后，必须手动点击任务栏图标才能看到。根因是本地 API 服务运行在 Electron `utilityProcess` 中，exe 由该后台进程 spawn，按 Windows 前台激活规则无法继承前台激活权，首窗口因此落在前台 IDE 后面。经典 Win32 生成器新增 `EnsureStartWindowForeground(HWND, int)`，与 new_emoji 桥接的 `NE_显示并激活窗口` 保持同一激活契约：在启动窗口创建（含创建完毕处理器）之后、进入消息循环之前只执行一次同步激活，遇前台锁时临时 `AttachThreadInput` 附加当前线程与前台线程输入队列并在完成后立即分离，只短暂提升到最上层后立即还原普通层级；`showCommand` 为隐藏/最小化/不激活显示时不抢占前台。`LingWindowBase::Open()` 内部仍保持 2026-08-13 要求的单次标准 `ShowWindow + UpdateWindow`，未恢复延时定时器或重复 `SetForegroundWindow`/`SetFocus`，激活逻辑集中在 wWinMain 的后端专用函数中；后续不得把该激活下沉到 `Open()` 或恢复两阶段定时器方案。

- 已完成（2026-08-16）：工作台内全部 33 处同步原生对话框（window.confirm/alert/prompt，15 个文件）已统一迁移到 `workbenchConfirmService` + `WorkbenchConfirmDialog` 非阻塞模式（confirm/alert/prompt 三形态，Promise 化），`src/` 目录原生对话框调用清零；新增交互时禁止在异步流程中引入同步原生对话框，应使用 `requestWorkbenchConfirm`/`requestWorkbenchAlert`/`requestWorkbenchPrompt`。

- 后续优化（2026-08-16）：会话恢复确认已从同步 `window.confirm` 迁移到应用内非阻塞对话框（`WorkbenchConfirmDialog` + `requestWorkbenchConfirm`），修复了新建项目对话框无法输入、工作台整体冻结的问题。但工作台其余流程（外部修改冲突 App.tsx、删除文件确认、设计器粘贴预览、新手模式删除子程序、设置页快捷键放弃确认等约 20 处）仍在直接调用 `window.confirm/window.alert`，同样存在阻塞渲染进程主线程、冻结全部输入的风险；后续应统一迁移到 `requestWorkbenchConfirm`/应用内对话框，并在新增交互评审时禁止在异步流程中引入同步原生对话框。

- 已完成（2026-08-16）：严格精简 Windows 安装包已排除 `lingbuilder.cef3.sdk` 与 `lingbuilder.fbro.sdk` 的整个模块目录，不再保留清单或 README。使用 CEF3/FBro 前必须安装独立模块包或受控开发者提供的完整模块目录；发布门禁同时扫描解包目录和 NSIS，发现任一模块路径或桥接/运行时二进制即失败。

- 已完成（2026-08-15）：豆包视频下载器浏览器插件已明确为项目私有资源，不再作为模块封装。两个浏览器管理器项目的文件位于 `assets/<项目ID>/doubao-downloader/`，旧项目模块引用会在读取时过滤，源码包、预览、F5 和 Visual Studio 导出均通过项目 assets 复制；后续不得把该资源重新登记到 `.lingbuilder/modules` 或 `.lbmod`。

- 已完成（2026-08-14）：Windows 安装包不再内置 `lingbuilder.cef3.sdk/sdk` 与 `lingbuilder.fbro.sdk/sdk`，只保留两个资产模块的 `lingbuilder.module.json` 和 `README.md`。首次使用 `lingbuilder.cef3.browser` 或 `lingbuilder.fbro.browser` 执行 F5、原生预览或原生导出时，工作台会显示版本、下载体积、进度和速度，用户确认后通过 HTTPS/Range 下载，执行精确大小、SHA-256、ZIP 路径与展开清单校验，再原子安装到用户级共享缓存；成功后自动重放原操作一次。AI Bridge 与独立 CLI 只返回 `SDK_DEPENDENCY_REQUIRED` 诊断，不静默联网。发布门禁会拒绝 `win-unpacked` 或 NSIS 中残留的 SDK 目录。后续可增加设置页中的缓存查看、修复和删除入口，以及签名资源清单/备用下载源，但不得降低当前哈希、解压和原子安装门禁。

- 已修复（2026-08-13）：在窗口设计器中按 F5 运行普通 Win32 项目时，生成窗口不再先切换为 `HWND_TOPMOST`、同步抢占前台/焦点，再于 900ms 定时器中撤销置顶并重复抢焦点。该两阶段激活会触发 Electron 工作台与原生窗口的激活、Z 序和非客户区重绘竞争，表现为 IDE/设计器闪动。LingCpp 与旧原生 Win32 生成器现统一使用一次标准 `ShowWindow + UpdateWindow`，LingCpp 窗口在显示前完成 DPI、控件和最终尺寸准备；`new_emoji` 的独立窗口激活契约不受影响。后续如需增强运行窗口前置，应通过宿主/后端专用激活服务处理 Windows 前台限制，不得恢复临时置顶、延迟定时器或重复 `SetForegroundWindow` / `SetFocus`。

- 已完成并实机验证（2026-08-10）：普通 Win32 `win32-fbro-multi-browser-manager` 左侧下载详情区由 `76` 提升并固定为 `114` 逻辑像素；实例列表适度收紧，详情 TextBox 取消固定水平/垂直滚动条，长文件名和目录改为自动换行。窗口高度变化时，实例列表在顶部固定位置伸缩，名称/Cookie/缓存/删除/下载详情与进度操作区整体保持底部锚定，不再把新增高度分配给详情框。普通 Win32 生成器在 `SizeChanged` 批量布局返回后统一执行父背景擦除和全部子控件同步重绘，避免连续拖拽时旧位置留下按钮、标签和输入框残影。隔离 `--layout-only` smoke 连续经过四组窗口尺寸，验证列表与详情 HWND 高度、`WS_HSCROLL` / `WS_VSCROLL` 样式、控件不重叠、缩放锚定及统一重绘门禁。后续若下载详情增加字段，应优先调整信息层级或分组，不得恢复常驻双滚动条挤占内容区。

- 已修复并实机验证（2026-08-09）：普通 Win32 `win32-fbro-multi-browser-manager` 的地址栏、扩展状态和缩放行为已闭环。`AddressChanged` 与实例切换会直接回写地址 TextBox 的原生 HWND；每个实例在启用 FBro VIP 高级扩展能力后，先创建 RequestContext、立即经 FBro VIP `LoadExtension` 注册扩展、再创建浏览器，并用当前页面 DOM 探针区分“已加载（页面不适用）”“正在验证”“已生效”和“未在当前页面生效”。嵌入 Alloy 模式不支持 Chromium 自带扩展管理 UI，输入 `chrome://extensions/` 会在当前实例显示受管诊断页并保留逻辑地址。主窗口的 `SizeChanged`/`DpiChanged` 先执行 LCPP 布局、再调整 FBro 子窗口，地址栏和 TabControl 均以客户区与当前 DPI 重算。隔离 MSVC x64 smoke 已验证弹窗在本窗口导航后地址同步、受管扩展诊断和 1500x940 窗口缩放。后续若加入扩展调试、重载或多个插件，仍必须按 RequestContext 逐实例验证，不能恢复命令行 `load-extension` 或把路径回读当作注入成功。
- 扩展注册完成后仅允许对首个匹配页面执行一次受控刷新；后续页面以正常导航触发 content script，禁止通过无限刷新掩盖注入失败。

- 已完成并实机验证（2026-08-09）：普通 Win32 `win32-fbro-multi-browser-manager` 已加入下载事件和可见进度。FBro Bridge 在未订阅高级 v3 下载决策时默认继续下载，并只读转发 `OnBeforeDownload` / `OnDownloadUpdated` 的状态、速度、百分比、已接收/总字节、建议文件名和完整路径；管理器按稳定实例隔离这些状态。界面使用只读多行 TextBox、原生 ProgressBar 和“打开目录”按钮显示当前实例下载。隔离回环 smoke 已确认进度为 100、状态为“下载完成”、字节数为 `33 / 33`、文件名和目录正确，并读取落盘文件核对内容后清理。后续可增加下载历史、暂停/继续/取消入口和并发下载队列，但必须走 v3 受管延续与实例边界，不能让只读兼容事件改变下载行为。

- 已完成并实机验证（2026-08-08）：新增普通 Win32 `win32-fbro-multi-browser-manager` 最终项目，可视界面只引用 `lingbuilder.win32.basic` 与 `lingbuilder.win32.common-controls`，隐藏表头的原生 TabControl 为每个实例创建独立页面 `HWND`，左侧 ListBox 是唯一导航。每个稳定 ID 映射独立 FBro Host PID、浏览器 HWND 和 LocalAppData Profile；插件在 CEF 启动阶段通过 `load-extension` 加载，VIP 授权延迟到 `OnContextInitialized` 校验，随后以扩展 ID 和 `GetExtensionPath` 回读真实路径，失败只禁用插件而不阻断浏览器。`OnBeforePopup` 会把目标 URL 交给当前 Frame 后取消 popup。地址导航已移除 HTTP(S) 白名单，`chrome://extensions/`、`about:`、`file://` 等非空 Chromium 地址会原样传入独立 Host。最终 Release EXE 和 `exports/独立浏览器管理器.lcpppkg` 已生成，复制后导入、二次 C++ 生成、单/三实例恢复及弹窗接管均通过。后续可增加资源占用预警和跨机器可选加密 Cookie 备份，但不得把授权码、Cookie、Profile、缓存或插件私有存储加入项目分享包。

- 已修复（2026-08-08）：大型 `.lcpppkg` 导入或检查完成后，Windows 防病毒可能短暂占用 SDK DLL，旧清理流程会让成功导入被 `EBUSY` 临时目录清理错误覆盖。统一源码包服务现对递归临时目录清理使用有界重试；后续仍需保持目标工作区的原子重命名和路径校验，不能因清理重试放宽包内容安全门禁。

- 已完成并实机验证（2026-08-08）：`new-emoji-fbro-multi-browser-manager` 已形成完整多浏览器实例工作台。`browserWorkbench` 服务层统一稳定 ID/相对 Profile、原子 JSON 与 `.bak` 恢复、Cookie 校验预览、扩展清单校验、CommandService 命令和 MenuService 右键菜单；原生运行时继续负责 HWND/Host 生命周期与真实 CookieManager。实例状态正式写入 `%LocalAppData%/LingBuilder/browser-workspaces/<工作台键>/browser-instances.json`，分享包只携带 `config/.../browser-instances.json` 的结构配置和 exe 同级 `doubao-downloader` 资源。通用 `.lcpppkg` 打包器会排除 profiles、cache、localStorage、IndexedDB 和 Cookie JSON。后续可增加资源占用预警、跨机器可选 Cookie 加密备份和 macOS 浏览器后端，但不得把浏览器用户数据并入普通项目分享包。

- 已完成并实机验证（2026-08-08）：新增独立 `new-emoji-fbro-richlist` Demo，使用 `lingbuilder.new_emoji.fbro-shell@1.2.0` 和 new_emoji `RichList` 管理动态 FBro 会话。运行时以稳定 ID 映射会话配置、独立 Host PID、伴随 HWND 和唯一 Profile；RichList 索引只表示顺序。关闭只回收 Host/HWND，重开复用稳定 ID 与 Profile；删除移除表项和绑定但默认保留缓存。专项 smoke 已覆盖新建、切换、关闭/重开、删除、排序、Cookie 隔离和退出回收。后续如提供缓存清理功能，必须独立确认，不能绑定到删除表项。

- 已完成并实机验证（2026-08-08）：FBro `LB_FBro_CookieSetAsync` 和 `LB_FBro_CookieFlushAsync` 不再把调用已受理视为成功，而是分别等待同一 RequestContext 的 `SetCookie` 与 `FlushStore` 完成回调。独立 Host 仅在按名称和值读回成功、且其它打开会话 Cookie 快照未变化时报告注入成功；任何失败只给出中文状态，日志不得记录 Cookie 明文。后续新 Cookie 操作必须复用此完成确认与脱敏约束。

- 已修复并实机验证（2026-08-08）：`new-emoji-fbro-multi-browser-manager` 首次启动 8 个独立 Host 时，主窗口会在 `Created` 事件中同步等待 Host 执行 `show`，而 Host 的跨进程子窗口 `SetWindowPos` 又等待父窗口线程响应，形成确定性死锁。控制器现提供无响应 `Notify` 通道，`show`、`hide`、`resize` 不再阻塞 UI 线程；独立嵌入浏览器内部保持可见，由主进程拥有的伴随父 `HWND` 控制最终显隐。首次启动 smoke 增加主窗口 `Responding` 门禁，正式 EXE 连续 20 秒采样均保持响应。后续跨进程窗口命令不得恢复 UI 线程同步等待。

- 已完成并实机验证（2026-08-08）：`new-emoji-fbro-multi-browser-manager` 移除固定 6 实例槽位，改为 `lingbuilder.new_emoji.fbro-shell@1.2.0` 运行时动态集合。每次添加会创建独立 Host、鉴权 WebSocket、Profile 与 HWND；RichList 和隐藏表头 Tabs 同步同一稳定 ID 映射。实例清单、顺序、名称、地址和恢复状态已使用原子 UTF-8 JSON 持久化，损坏时从 `.bak` 恢复。原生 smoke 已创建并验证 8 个不同 PID、唯一可见实例和退出后全部回收。后续可增加资源用量预警，但不得重新引入固定数量上限。

- 已完成（2026-08-08）：`lingbuilder.database.sqlite@2.0.0` 从 7 条单连接原型升级为 67 条生产接口。模块使用独立 catalog/runtime，多连接与预编译语句采用不复用的受管 ID，同连接串行化并以 FULLMUTEX 打开；覆盖强类型绑定/列读取、事务与保存点、WAL、Online Backup、完整性检查、中断和完整错误码，旧默认连接入口继续兼容。Win32/x64 Release 编译及 x64 真实 DLL smoke 已通过。后续可把经过重新分发许可、固定版本和逐文件 SHA-256 的官方 SQLite 运行库封装为独立只读 SDK 模块，并增加故障注入、超大 BLOB、长事务、锁竞争、断电恢复与备份恢复压力测试；在这些资产门禁落地前不得自动联网下载或宣称内置数据库加密。
- 已完成（2026-09-09）：SQLite 2.1 内置数据库加密（上一条中“不得宣称内置数据库加密”的约束就此解除）。运行时（`sqliteRuntime.ts`）新增可选 `sqlite3_key` 绑定与 `SQLite_打开加密连接` / `SQLite_打开加密库` / `SQLite_运行库是否支持加密` 三个命令，统一按 SQLCipher 方案开库（先 `PRAGMA cipher=sqlcipher` 再注入密钥，随后真实读取 `sqlite_master` 校验密码，密码错误给出中文诊断）；随附运行库固定为 SQLite3MultipleCiphers 2.5.1（SQLite 3.53.4，静态 CRT，来源/版本/SHA-256 见 `electron/third_party/sqlite/NOTICE.md`，SHA-256 基线钉在 `sqliteModule.ts`），F5 构建、AI Bridge 构建与 VS 工程导出经 `materializeSqliteRuntime` / `materializeSqliteRuntimeForExport` 按目标架构自动复制。加密冒烟已并入 `npm run smoke:sqlite-native`（创建→重开校验→错误密码拒绝→空密码拒绝）。后续可再做：SQLCipher 1~3 旧参数存量库的迁移工具、`SQLite_改加密密码`（`sqlite3_rekey`）封装、故障注入与断电恢复压力测试。

- 已修复并实机验证（2026-08-07，2026-08-08 动态化）：`new-emoji-fbro-multi-browser-manager` 的顶部地址栏使用原生 `Omnibox`，按回车导航当前实例。左下角保留“添加实例”和“全局设置”；原先顺序启用 6 个预置 Host 的实现已由 2026-08-08 动态实例集合替代，不再存在固定数量上限。原生 smoke 的 fixture 产物隔离在 `new-emoji-fbro-multi-browser-manager-native-smoke`，正式 EXE 不得被测试 URL 覆盖。

- 已修复并实机验证（2026-08-07）：new_emoji FBro 多浏览器管理器虽然有 6 个原生 Tabs 页，但旧源码在每次实例切换时先隐藏全部 Host，再通过 WebSocket 显示目标 Host，导致 Chromium 恢复绘制前短暂黑屏。现在首次进入只在目标页显示后收起其余页；后续切换始终先显示并置顶目标 Tab，再收起上一个 Host。画布内重复的窗口标题已删除，架构说明单独置于客户区顶部，避免与原生标题栏及副标题重叠。源码包导出和原生 smoke 都校验 Tabs 结构、无重复标题，以及“先显示、后收起”的顺序；后续不得恢复“隐藏全部浏览器”的切换实现。

- 已修复并实机验证（2026-08-07）：多浏览器管理器的实例 Tabs 是内部页面/实例映射，不需要作为用户可见导航。原生 Tabs 表头现固定隐藏，6 个 Host 的真实浏览器视口从工作区顶部开始占满 `1252x760`，不再在地址栏与网页之间留下空白 Tab 条或空选中背景。左侧 RichList 继续作为唯一可见的实例切换入口；源码包和原生 smoke 必须拒绝 `browser-host-pages.headerVisible = true`。

- 已修复并实机验证（2026-08-07）：new_emoji 多浏览器管理器过去虽然启动了 6 个 `LingBuilderFbroHost.exe`，但 Host 在主消息循环前串行等待、共用 CEF 根缓存，Tabs 页面初始化后又可能取得无效选中索引，最终只看到进程状态而没有网页。new_emoji 独立 Host 现改为非阻塞并行启动，每个 Host 使用独立根缓存与日志目录，并保存有效 Tabs 索引，在 Host `Created` 后统一同步显隐。原生 smoke 实测 18.2 秒完成编译和运行验收，6 个独立 PID 均有 4 个 Chromium 子窗口，只有当前实例可见，尺寸为 `1220x450`，网页像素为 `RGB(255,255,255)`；后续不得把 Host 进程存在或 PID 非零当成浏览器显示验收。

- 已修复（2026-08-07）：FBro 独立 Host 复用生成主 EXE 时会继承 new_emoji 等导入依赖，但 Host 位于 `fbro-host/`，Windows 加载器过去无法回到主 `bin/` 目录查找 `new_emoji.dll`，导致 6 个实例全部显示“故障 / PID 0 / CDP 0”。Host 的私有启动环境现在把主 EXE 目录前置到 `PATH`，仍由应用目录优先级保证 CEF 135 从隔离 Host 目录加载，避免覆盖主目录中的其它 Chromium 运行时；新增 6 Host 真实编译、启动和 Job Object 回收 smoke 作为后续门禁。

- 已修复（2026-08-07）：new_emoji + FBro 浏览器外壳在 Bridge 2.2.0 通过依赖检查后，F5 的分离编译链只显式链接四个基础库，导致 Winsock、WinHTTP、证书校验和文件拖放共 30 个符号无法解析。现在 F5 与 Visual Studio 导出共用统一 Windows/MSVC 系统库清单，覆盖 `ws2_32`、`winhttp`、`crypt32`、`shell32` 和 `delayimp` 等运行时依赖；后续新增生成运行时使用新的系统 API 时必须扩展这一份清单并补原生链接 smoke，不能只依赖某个生成模板中的 `#pragma comment(lib)`。Electron 开发启动也会尊重显式 `LINGBUILDER_WORKSPACE_ROOT`，可直接在导入项目上验证 F5，而不改变仓库默认工作区。

- 进行中（2026-08-07）：CEF 150 安全接口全覆盖当前为 `558 / 1384（40.32%）`，剩余 826 项。本批完成 `cef_frame_t.send_process_message`、`CefProcessMessage`、`CefSharedProcessMessageBuilder` 和 `CefSharedMemoryRegion` 共 14 项受管 C ABI/V4 闭环；发送统一经 CEF UI 线程，消息发送后按所有权转移语义失效，参数列表、消息副本、共享内存区域及内存内容分别使用受管句柄或 `managedBuffer`，不跨 ABI 暴露 CEF 对象或原始地址。`planned` / `needsReview` 清零、Views 与 OSR 实机门禁完成前继续保持 `3.0.0-alpha.3`。

- 已完成核心闭环、后续扩展高级面（2026-08-07，2026-08-08 更新）：FBro 2.2 已支持 `in-process`、`independent-embedded`、`independent-window`，两种独立模式实行一浏览器一 Host 进程，以随机回环 WebSocket、一次性 256 位 Token、实例/PID/连接/代次映射控制导航、JS、缩放、静音、代理、指纹、显隐、尺寸、截图、真实 Cookie 遍历/结构化写入、缓存清理、关闭和受限重启。主进程通过 Job Object 回收 Host。全部 FBro 控件独立时可与 CEF3 共存，CEF 135 只物化到 `fbro-host/`，CEF 150 保留在主 exe 目录；F5 与 VS 导出复用同一规则。后续若要让独立模式达到进程内模式的完整 API 面，仍需按版本化 WebSocket schema 远程化 Frame、其它受管对象/任务、事件决策与 VIP 单项能力，并补充大规模并发、Host 升级兼容和故障注入测试。

- 进行中（2026-08-06）：CEF 150 安全接口全覆盖当前为 `505 / 1384（36.49%）`，剩余 879 项；浏览器事件域已完成 113 / 113 个官方签名，BrowserHost 已新增运行时样式、缩放读写、命令可用性查询与实际执行、`CEF3_尝试关闭`、窗口移动/调整大小通知、屏幕信息变化通知、捕获丢失输入通知、输入法组合取消与提交、自定义拼写词典写入、当前拼写错误替换、系统拖放源结束通知、拖放目标离开通知、OSR 宿主隐藏状态通知、网页全屏退出、CefBrowserView 承载状态查询和打开者浏览器 ID 查询，通过受管浏览器句柄、类型化逻辑值、UTF-16 文本和固定 v4 操作 ID 保留 CEF 的生命周期、宿主窗口、OSR 输入/绘制、IME、拼写检查、拖放状态、Fullscreen API、Views 边界与弹窗来源语义。`planned` / `needsReview` 清零、Views 与 OSR 实机门禁完成前，继续保持 `3.0.0-alpha.3`，不得发布或描述为 3.0.0 全覆盖。

- 已修复（2026-08-05）：新手 `.lcpp` 结构编辑器在切换窗口设计器后会保留实际滚动/选区状态，不再因卸载时 DOM 引用已清空而回落到旧行；F5 现在直接提交当前中文源码与设计器模型到受控构建接口，保持代码编辑器视图，不再自动跳转到界面设计器。后续如抽取统一 `TaskService`，应继续复用这条“当前视图发起构建、输出面板反馈”的交互契约。

- 已完成（2026-08-04）：建立 Electron `0.2.9` 发布基线。微信多开工具、`lingbuilder.wxhook.manager@1.1.1`、第三方模块随 `.lcpppkg` 离线分发、Windows EXE 图标资源和无 IDE AI Bridge 多文件工作流进入 Windows 安装包；微信模块最低版本设为 `0.2.9`，避免已发布的 0.2.8 客户端绕过生成器能力门禁。安装包继续使用不含正式 API 地址的 `offline` 云端模式。

- 已完成（2026-08-04）：窗口设计器的 `lingbuilder` 默认图标和项目 `assets/` 内自定义 ICO 已接入 Windows EXE 资源闭环。LingCpp 生成器输出 `lingbuilder-app.rc`，资源服务把当前入口窗口图标物化为固定可移植路径并校验 ICO 目录结构；F5、受控 CLI、AI Bridge 和 Visual Studio 导出都会通过 `rc.exe`/`windres` 编译并链接 `ICON`、`GROUP_ICON`。图标字节摘要进入增量构建指纹，原路径覆盖新图标不会复用旧 EXE。后续如新增显式“启动窗口/应用清单”模型，应把 EXE 图标来源从当前生成入口窗口迁移到该模型，但不得退回仅用 `WM_SETICON` 设置运行时窗口图标。

- 已完成（2026-08-04）：`wxmore-tool` 从 `程序_启动("WeChat.exe /multiple")` 占位示例升级为外置 v2 模块 `lingbuilder.wxhook.manager@1.1.1`。模块复用已验证的 WxHook Host/Agent，使用回环 WinHTTP、当前用户 DPAPI 令牌、500ms 后台轮询和 UI 线程消息投递，ListView 同时显示多实例头像、PID、登录状态、wxid、昵称、头像 URL 和自绘防撤回 Switch；顶部总开关默认开启防撤回与撤回灰条提示，通过标准 Button `Click` 事件调用 `微信多开_设置总防撤回`，新登录实例自动应用，单实例请求按账号上下文校验。模块包、源码包导出/导入、LingCpp 诊断、MSVC x64 构建和离线运行时复制已验证。上游 Agent 为避免过早注入仍保留进程稳定、登录确认和资料补全等待；后续只能基于分阶段运行日志和目标微信指纹优化，不能为追求表面速度移除安全门禁。

- 已修复（2026-08-04）：源码模块在派生窗口事件中使用 `controlRef` 的 `stableId/nativeHandle` 时不再因辅助函数位于基类私有区触发 C2248；动态 `wideString` 模块入口也已用真实 `std::wstring` 表达式完成编译验证。Win32 窗口创建后会读取真实 HWND DPI，并在首次显示及 `WM_DPICHANGED` 时用同一设计器逻辑尺寸重算窗口外框和控件。后续应补充 100%/125%/150% 多显示器拖动自动化，截图工具必须声明 Per-Monitor V2，避免由捕获线程 DPI 虚拟化造成假裁剪。

- 已修复（2026-08-04）：AI Bridge/CLI 新建项目省略 `enabledModuleIds` 时不再把模块选择归一化为空数组。创建预览现在继承根目录 `.lingbuilder/project-modules.json`，展示 `modules.selection`、依赖和项目级清单文件；批准后始终写入 `.lingbuilder/projects/<projectId>/project-modules.json`，显式空数组保持仅基础模块。模块服务对已加入解决方案但缺少项目级清单的旧项目提供兼容继承，之后诊断、补全、C++ 生成和构建统一按返回的 `projectId` 读取项目上下文。后续仍应增加跨版本项目模块清单迁移提示和完整 HTTP/MCP 项目上下文集成测试。

- 已完成（2026-08-04）：建立 Electron `0.2.8` 发布基线。HTTP 客户端 2.0、WebSocket 客户端 2.0 和 WebSocket 服务端 2.0 的最低 LingBuilder 版本提升为 `0.2.8`；EdgeView、ListView 和 OpenCV 的既有 `0.2.7` 契约保持不变。Windows 安装包继续支持无正式云端 API 的 `offline` 发布模式。

- 已修复（2026-08-03）：NewEmoji 生成程序的 `调试输出`不再只进入 `OutputDebugStringW`。生成器会把同一条 UTF-8 文本以 `[调试输出] `前缀写入并刷新标准输出，由 `ManagedProcessService` 落到 `run.log`，因此 F5 下 Table `CellAction` 等原生回调可以实时出现在 IDE 调试控制台。`new-emoji-92-tabs-validation` 中遗失的 `表格06.MouseEnter` 绑定也已补回；后续原生后端新增调试通道时必须复用受控进程日志，不能要求用户另开系统调试器。

- 已修复（2026-08-03）：NewEmoji Table 设计器事件不再统一生成空参数。模块清单新增强类型事件参数和可选初始语句；设计器在跳转代码前同步保存绑定，Monaco/新手补全与语言诊断消费同一契约。C++ 回调把单元格行列、动作、值、UTF-8 编辑文本、右键区域/坐标及鼠标参数传入 `.lcpp`；VirtualRow 使用线程局部返回槽和回调内缓存完成长度查询与第二次 buffer 复制，避免固定返回 0 或重复执行事件。旧零参数处理器保持兼容并可在重新打开时安全升级。后续其它原生 UI 后端新增参数化事件时应只扩展模块事件契约与后端回调映射，不得在 React 或语言服务中另建参数表。

- 已修复（2026-08-03）：NewEmoji ListBox 的六个专属事件不再生成空处理器签名。`SelectionChanged`、项目点击/双击、编辑、重排和右键菜单现在从上游回调 ABI 生成强类型参数，C++ 桥接同时完成 UTF-8 文本、索引、动作、数量和坐标映射；进入/离开和焦点事件保持无参，通用鼠标事件保留真实坐标/按钮/滚轮参数。后续新增列表框回调必须同步更新模块清单、语言服务和 native callback 参数映射。

- 已修复（2026-08-03）：NewEmoji Tabs 的 `SelectionChanged` 不再生成空处理器。模块清单现在自动声明 `选中索引`、`项目数量`、`动作` 三个整数参数，C++ 生成器按 `EU_SetTabsChangeCallback` 的 `ElementValueCallback` ABI 映射 `lb_value/lb_range_start/lb_range_end`，动作编号保持上游语义（1 代码设置、2 鼠标、3 键盘、4 关闭、5 新增、6 滚动）；带 FBro 页面时事件处理器也使用同一组参数。后续分页控件新增回调时必须按命令精确区分同名 `SelectionChanged`，不能只按 callback 类型猜测参数。

- 已完成（2026-08-03）：`lingbuilder.net.http-client@2.0.0` 从旧的同步 WinHTTP 原型升级为 74 条受管命令。`httpClientRuntime.ts` 统一管理客户端/请求生命周期、异步 UI 完成事件、请求头、UTF-8/JSON/字节集/文件传输、响应快照、代理/凭据、TLS 策略与 SHA-256 证书固定、Cookie、自动解压、重定向、超时和资源边界；普通 Win32 与 new_emoji 生成器共享 runtime，分别使用窗口消息和独立消息窗口回调。旧 HTTP 入口继续由默认受管客户端兼容，模块文档、演示和 Win32/new_emoji/隔离回归测试已同步。`smoke:http-client-native` 使用本地 HTTP fixture 真实编译 Win32/x64 与 new_emoji x64，并验证状态码、UTF-8 响应和资源清理。后续仍应增加代理认证、证书轮换和大文件压力场景，并把最大重定向次数纳入可观测的协议级限制。

- 已完成（2026-08-03）：New_Emoji Tabs 属性面板新增“显示标签页表头”布尔属性，默认显示，关闭时设计器预览移除标签页表头并让页面内容区占满；模块生成器通过 `EU_SetTabsHeaderVisible` 绑定到真实原生 Setter，旧项目缺少该字段时仍按显示处理。`npm run module:new-emoji -- --install`、属性面板/窗口设计器/模块专项测试已覆盖清单、预览和 C++ 生成结果。

- 已完成（2026-08-02）：新手模式子程序参数表新增“数组”开关，已有参数和新增参数统一使用 `类型[] 参数名` 语法；类型输入仍显示并补全基础类型，切换后由 AST 写回 `[]`，普通 Win32/new_emoji C++ 生成继续映射为 `std::vector<T>`。参数数组类型判断与后缀切换已下沉到 LingCpp service，避免 React 表格自行拼接语法。

- 已修复（2026-08-02）：New_Emoji 生成器不再用 `SetProcessDPIAware()` 把整个进程锁定在启动显示器的系统 DPI。生成的 `wWinMain` 会在 COM、`NE_创建窗口` 和所有控件创建前动态调用 `SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2)`，旧系统才回退到 `SetProcessDPIAware()`；上游 new_emoji DLL 的 `WM_DPICHANGED`、元素树和标题栏会因此按目标显示器重新布局。`new-emoji-92-tabs-validation` 的可复制 `main.cpp` 已同步，后续需继续在 100%/125%/150% 混合显示器上实机拖动验证窗口初始尺寸、标签页和弹层。

- 已完成（2026-08-01）：`lingbuilder.input.mouse@2.0.0` 从最小鼠标接口扩展为 29 条三分类命令：15 条全局真实输入（前台）、6 条指定 HWND 窗口消息输入（后台）和 8 条 UI Automation 语义操作（后台）。贡献、binding、运行时、文档、演示和专项测试同源；每条命令都注明是否移动/占用真实系统鼠标。窗口消息只用受控 `PostMessageW` 入队，UIA 使用受管整数元素句柄并在 COM 退出前统一清理。相对移动文案改为 Windows 鼠标速度/加速度影响的输入增量。后续如需拖动、双击、XButton 或 Raw Input，应继续按前台/后台边界设计独立命令，不得偷偷扩大为任意消息或全局钩子。

- 已完成（2026-08-01）：键盘输入模块由 5 条最小命令升级为 2.0 的 31 条分类 API。全局状态和键码转换不发送输入；前台命令使用批量 `SendInput` 支持虚拟键、最多三修饰键、Unicode 文本和扫描码；后台命令按指定 HWND 投递 `WM_KEY*` / `WM_SYSKEY*` / `WM_CHAR`，不抢焦点或改变物理键状态。全部命令在模块详情中标注前台/后台和键盘占用语义，旧 5 条命令保留兼容。已用 MSVC 验证 Win32/x64；后续如需全局热键事件，应在受管命令/事件生命周期上单独设计，不得引入隐藏键盘记录或无法回收的低级钩子。

- 已修复（2026-08-01）：Win32 生成运行时对多行 TextBox 做程序化文本更新时不再跳回文本开头。`控件_设置文本` 在 `SetWindowTextW` 成功后设置插入点到末尾并发送 `EM_SCROLLCARET`，自动显示最新日志行；单行 TextBox 和非 TextBox 控件保持原行为。设计器回归测试及 threading-api-demo 的生成/编译验证覆盖该修复；后续可按实时多行日志规模评估文本更新频率与更大日志控件的性能策略。

- 已完成（2026-08-01）：磁盘信息模块从 5 条基础查询扩展到 28 条只读命令和 8 个公开记录/数组类型，覆盖容量、卷/挂载点、文件系统能力、物理磁盘、总线、SSD/TRIM、扇区和分区布局。结构化命令返回值进入清单校验、语言服务和普通 Win32/new_emoji 生成顺序，原生 DLL target 继续禁止直接传递 STL/任意 C++ 结构；`smoke:disk-native` 已验证 Win32/x64 真实编译运行。后续若增加 SMART/NVMe 厂商日志，应单独设计权限、设备支持和版本化数据契约，不能把未授权或不支持误报为磁盘故障。

- 已完成（2026-08-01）：Win32 ListView 行数据接入模块公开命名数组。`lingbuilder.win32.common-controls` 新增 `列表视图行 = 文本型[]`、`列表视图行集合 = 列表视图行[]`、`列表视图_创建行` 和 `列表视图_创建行集合`；添加、插入、批量添加和虚拟行设置直接消费 `std::vector<std::wstring>` 或嵌套 vector，不再要求新源码手工拼接 `\t` / `\n`。构造器沿用 `到文本` 确定性转换标量，Monaco/新手成员补全按设计器实际列数生成结构化参数。旧 TSV 重载继续兼容；结构化值仅在生成工程内部传递，不开放为 DLL STL ABI。源码包新增 `win32.listview.structured-rows.v1` 和最低生成器 0.2.7 门禁，`listview-api-demo` 已迁移为推荐写法。

- 已完成（2026-08-01）：模块公开类型从扁平 `name/description/cppType` 扩展为 manifest v2 向后兼容的 `opaque/record/array` 契约。公开记录支持字段、说明、标量默认值、嵌套和字段数组；公开数组声明元素类型。清单校验阻止重名、未知/不安全字段类型、循环嵌套及结构化类型借 `cppType` 绕过语义。启用模块后，Monaco/新手补全、字段悬停与赋值诊断、项目数据类型嵌套、模块搜索/公开信息、AI 模块上下文和普通 Win32/new_emoji C++ 生成复用同一服务，记录生成 `struct`，数组映射为 `std::vector<T>`。后续若允许结构化值直接跨预编译 DLL binding，必须先增加独立、可验证的 POD/缓冲区/句柄 ABI 适配描述；不得直接跨 DLL 传递 STL 或任意 C++ 对象。

- 已修复（2026-08-01）：非默认解决方案项目新建或复制窗口时，窗口源码过去被固定创建到工作区根 `src/`，没有跟随项目 `sourceRoot`，会导致保存校验失败或重新载入后提示“未找到自定义窗体”。现已统一通过窗口源码路径服务按当前项目源码根目录生成、查找和删除 `.lcpp`，覆盖设计器、解决方案资源管理器和初始编辑器文件映射；旧会话若只剩设计器窗口而源码缺失，打开窗口时会按正确路径重新生成并提示保存。新增多项目路径回归测试。

- 已修复（2026-08-01）：内置 Win32 `GroupBox` 与 `TabControl` 的模块贡献过去遗漏正式 `layout`，打开含有这两个容器的项目会输出兼容布局警告。现由同一内置控件映射声明 `win32.groupbox.absolute` 和 `win32.tab.slots`，并新增 manifest 回归测试；后续新增容器仍必须同时更新布局注册表、模块贡献和跨容器粘贴测试。

- CEF 150 安全全覆盖进行中（2026-08-07）：`3.0.0-alpha.3` 的覆盖 v2 当前为 558 implemented、8 internal、185 notApplicable、826 planned（1577 项记录）。objects、session 与 `cef_command_line_capi.h` 已清零各自 `planned`；浏览器状态、窗口渲染模式、网页全屏状态、关闭准备状态、渲染进程响应状态、键鼠输入、焦点、查找、JSDialog、ContextMenu、音频、权限、文件对话框、跟踪、受管读写流处理器，以及进程消息/共享消息构建器/共享内存区域已补齐 Bridge、V4 operation、原生测试和用户文档。受管 `CefReadHandler` / `CefWriteHandler` 只消费 Bridge 缓冲；进程消息发送统一调度到 CEF UI 线程，builder/region 内存只返回 `managedBuffer` 副本，所有 CEF 引用按句柄分类在最终浏览器关闭前释放。用户事件目录为 92 项名称，对应 113 / 113 个官方事件签名已实现；全目录仍有 network/transfer/automation/DevTools/OSR/Views/platform 等 826 项待完成。`module:cef3-coverage:complete` 在 planned/needsReview 清零前仍必须失败。

- FBro VIP 子模块已完成（2026-08-01 更新）：官方 VIP 188 项全部为 implemented，`lingbuilder.fbro.vip planned=0`。188 项能力已逐项公开为 179 条单项安全命令、6 条 Bridge 自动管理能力和 3 条凭据中心/安全入口替代能力；另保留 10 条批量与通用高级入口，模块清单共 198 条。普通 Win32 与 New_Emoji 共用 C ABI 并生成同一套运行时包装器；双后端 MSVC x64 编译和运行 smoke 继续作为发布门禁。全 FBro 最新为 397 implemented、678 个非事件高级签名 planned、3 internal notApplicable、1 advanced notApplicable；事件目录已单独完成 174 个类方法槽位/158 个唯一签名的安全分类与 Bridge 接通。不能把 VIP 或事件完成误写成整个 FBro 1079 项全功能完成。

- FBro 完整事件回调安全全覆盖已完成（2026-08-01）：模块族升级至 2.1.0，主协议升级为兼容 C ABI v3 并保留 v1/v2；目录按“类 + 方法 + 完整签名”固定为 174 个回调槽位和 158 个唯一签名，零 `planned/needsReview`。普通 Win32/New_Emoji 共用结构化字段/响应 schema、稳定事件 ID、受管对象/延续句柄、订阅与限流。延续超时由 Bridge 单一受管计时线程处理；关闭时取消未完成延续、隐藏最后窗口并保留 HWND/消息泵等待 Closed，5 秒后才 fallback。无交互压力测试覆盖 200 条事件风暴、完成/取消/重复完成、30 秒资源请求超时、浏览器关闭清理和 20×5=100 次创建/关闭。FBro 5.38.49 可视 Basic Auth 登录 UI 未经过预期 `GetAuthCredentials` override，保持为已知 SDK 边界，不再运行会弹窗的认证 smoke。

- FBro 非事件高级 API 继续进行（2026-08-01）：覆盖基线仍为 FBro 5.38.49 / CEF 135.0.21 / MSVC x64 的 77 个头、1079 个签名。全目录当前为 397 implemented、678 planned、3 internal notApplicable、1 advanced notApplicable；剩余 678 项、Frame visitor、完整公开 V8、正式 OSR 设计器和其它高级网络/对象适配属于独立工作流。事件全覆盖完成不得被描述为整个 FBro 全功能完成，也不得据此注册空 OSR 模块。

- 已完成（2026-08-06 随 CEF3 FindHandler 扩展复测）：全模块演示项目与源码包自动生成链路按当前清单生成 86 个唯一模块项目，逐条覆盖 4209 条命令；大型模块最多拆成 12 个 TabControl 分组，界面统一提供默认关闭的实际执行开关，资产 SDK 则展示版本、用途和消费边界而不伪造命令。项目源码集中在 `examples/module-demos/`，86 个 `.lcpppkg` 输出到根目录 `exports/`，并通过逐包深度校验。后续新增或删除模块、命令时应重新生成并检查命令数量漂移，避免演示清单与运行时 binding 分叉。

- 已修复（2026-07-30）：LCPP 源码包过去只会随 CEF3/FBro 消费模块自动携带对应 SDK，四个通用密码学模块导出后可能缺少 `lingbuilder.crypto.sdk`。现在哈希、密码派生、对称和非对称模块均会自动携带 Botan/BLAKE3 只读资产，并新增专项回归测试。

- 已完成（2026-07-30）：补齐四组通用密码学内置模块。哈希覆盖 MD5、SHA-1、SHA-256、SHA3-256、SM3、BLAKE2b-512、BLAKE3；密码哈希覆盖 Argon2id、scrypt、bcrypt、PBKDF2-HMAC-SHA256；对称加密覆盖六种 AEAD 和 AES-CBC、Blowfish、RC2/RC4、DES/3DES 兼容入口；非对称覆盖 RSA、ECDSA P-256、SM2、ECDH P-256、X25519、ElGamal。Botan 3.12.0 与 BLAKE3 1.8.5 作为带 SHA-256 清单的只读 Win32/x64 SDK 由统一依赖服务物化，F5 与 VS 导出行为一致。原生 smoke 已完成双架构 Release 编译、标准摘要向量、密码验证、AEAD 篡改拒绝和全部非对称闭环。后续可增加硬件密钥、证书链和后量子算法，但必须继续走模块 binding、受控密钥边界和真实原生向量测试。

- 已完成（2026-07-30）：重构 `examples/basic-control-flow-demo/src` 的主项目为“全部控制流命令详细演示”，使用四个 `TabControl` 页面分组覆盖条件/选择、无限与判断循环、计次/变量/枚举循环、跳出/继续、异常处理、返回和程序退出。每组命令均提供独立可见日志和详细源码注释；项目通过零诊断确定性 C++ 生成、MSVC x64 Release 编译、3 秒运行存活以及 `.lcpppkg` 独立导入检查，源码包统一输出到仓库根目录 `exports/全部控制流命令详细演示.lcpppkg`。后续新增控制流语法或别名时，应同步扩展示例源码和生成回归覆盖，避免只增加编辑器补全。

- 已完成（2026-07-30）：新增 `format-text-api-demo` 新手模式项目，使用四个 `TabControl` 页面覆盖 `格式化文本` 的顺序占位符、文本/整数/长整数/小数/双精度/逻辑值、中文与 emoji、`{{` / `}}` 字面量花括号、参数不足、多余参数、零占位符、嵌套调用，以及赋值、控件文本、信息框、调试输出和实际订单摘要场景。项目已通过语义、确定性 C++ 生成与源码包独立导入检查，并导出为 `exports/格式化文本全接口与全能力演示.lcpppkg`。后续扩展格式语法时应同步扩展示例页面和回归测试，保持源码包可在独立工作区完整导入。

- 已完成（2026-07-30）：LCPP 新手模式默认基础模块新增 `格式化文本(格式模板, 参数...)`。运行时顺序替换 `{}`，支持 `{{` / `}}` 字面量花括号，并对参数不足和多余参数采用可预测的安全降级；文本、整数、长整数、小数和逻辑值沿用 `到文本` 的确定性转换语义。命令已接入模块 contribution/binding、新手与 Monaco 补全、普通 Win32/new_emoji C++ 模板及后端契约。后续若增加编号占位符、宽度、精度或日期格式，必须新增明确语法并保持旧 `{}` 行为不变，不能偷偷改成 `printf` 格式串。

- 已完成（2026-07-30）：新增 `popupmenu-api-demo`，以三个 TabControl 页面完整演示 Win32 PopupMenu 的所属窗口、结构化菜单项、当前位置显示、指定屏幕坐标显示、显示返回值、最后稳定项目 ID、禁用/勾选/分隔线状态和逐项事件。项目已通过确定性 LCPP 到 C++ 生成、MSVC x64 编译与 3 秒运行存活验证，并导出为 `exports/PopupMenu弹出菜单完整接口示例.lcpppkg`；源码包独立导入后保持 9 个菜单项和 3 个 LCPP 文件不变。

- 已完成（2026-07-30）：LCPP 源码包清单升级为 v2，导出时按实际 `.lcpp` 调用记录 `requiredCapabilities` 和最低生成器版本；新版 IDE 同时兼容导入 v1 包，并会从旧包内源码重新补齐能力清单。使用 ListView 高级 API 的包会写入 `win32.listview.advanced-api.v1`，导入预览会在模块校验前阻断不支持的生成器并指出升级版本与具体能力，避免旧版 IDE 继续生成后再由 MSVC 集中报 `C3861`。后续新增生成器能力时必须沿用同一清单字段和导入门禁。

- 已完成（2026-07-30）：Win32 ListView 补齐完整确定性数据接口。新增指定位置插入、删除、单元格读写、行数、批量 TSV、嵌套开始/结束批量更新、按列稳定排序和最后单击列读取；批量更新使用 `WM_SETREDRAW` 成对关闭/恢复重绘。设计器新增“虚拟列表模式”，生成时直接使用 `LVS_OWNERDATA`，运行时通过 `LVN_GETDISPINFOW` 按需提供文本，并支持最多 1000 万行的受控行数设置。新增 `listview-api-demo` 项目演示普通模式全部方法和 15000 行虚拟模式，可通过项目右键“一键导出 LCPP 源码包”分享；源码包只携带当前项目实际依赖的 CEF3/FBro SDK 资产模块，避免普通 Win32 示例被无关浏览器 SDK 膨胀。后续如需服务端数据分页，应在虚拟行模型之上增加可取消的数据提供者接口，不得在通知回调中执行阻塞网络请求。

- 已完成（2026-07-30，2026-08-01 扩展）：Win32 ListView 高层运行时现为 87 条中文命令：16 条数据/虚拟/类型化行命令，以及 71 条列管理、行状态、查找/命中/几何、滚动/重绘、视图/扩展样式/颜色、分组、标签编辑、热项、ImageList、插入标记和图标布局接口。高级命令目录集中在 `listViewApiCatalog.ts`，模块 contribution、binding、Monaco 成员补全和 C++ 符号回归测试保持同源。`listview-api-demo` 提供分类自检和全接口入口。需要指针结构、自定义回调/绘制、工作区数组或 Tile/Footer 复合 ABI 的原始 `LVM_*` 消息保留为 v2 原生模块扩展边界，禁止用文本参数伪装指针。

- 已修复（2026-07-30）：Win32 窗口运行时的 `信息框` 补充 `std::wstring` 重载，保留原 `const wchar_t*` 重载。ListView 示例读取选中行并组合索引、数量和单元格文本时，动态宽文本现可直接传给信息框，不再在 MSVC 阶段因 `std::wstring` 无法转为 `const wchar_t*` 而报 C2664。

- 已完成（2026-07-29）：New_Emoji Tabs 可在每个稳定页面槽中承载一个独立 FBro 浏览器 `HWND`。设计器保留 FBro 浏览器分组，生成器为每实例创建独立子宿主、profile 和 C ABI 句柄，并通过 Tabs 值变化回调切换宿主可见性。新增项目 `new-emoji-fbro-tabs` 展示三个标签页和三个独立浏览器。后续可扩展 FBro 事件到 New_Emoji 窗口线程的统一派发，以及窗口缩放时的声明式锚定布局；未完成前不应承诺 FBro 事件在 New_Emoji 后端与普通 Win32 完全等价。

- 已完成并实机验证（2026-07-28）：New_Emoji 设计器目录的 92 个控件完成全量验收。12 个分批验证窗口在内置浏览器中均显示预期控件，92/92 个控件通过属性面板修改“左距”并保存到项目模型；12 个 x64 Debug 原生窗口均由 MSVC 编译成功，`new_emoji.dll` 位于 exe 同目录，启动至少 3 秒后保持 `running`、可响应并取得原生截图。设计器模块上下文改用只返回控件、菜单贡献的紧凑 `/api/modules/project/designer` 接口并加入有界重试，避免全量模块清单和多个常驻 SSE 占满浏览器同源连接。修复模块命名空间控件因兼容 `TabControl` / `ListView` / `TreeView` 类型而产生的“不支持”误报；判断必须优先识别 `designerType: lingbuilder.new_emoji.ui/*`，只有没有模块命名空间且基础类型确实不支持的旧控件才报告诊断。

- 已修复（2026-07-28）：new_emoji ListBox 在设计器显示项目、F5 运行后项目为空。目录生成器过去会无条件发出全部属性 Setter：空高级项目会覆盖创建期简单项目，空 `selectedKeys` 会清除默认选中索引，`EU_SetListBoxVirtualItemCount(..., 0)` 还会直接清空普通项目。现在生成器仅在高级项目或选中 Key 确实非空时调用对应 Setter，仅在虚拟项目数量大于 0 时进入虚拟数量设置；普通静态列表保留创建期项目和 `selectedIndex`。新增命名空间 ListBox 生成回归测试，并用当前 `ne` 项目及已安装模块清单确认生成结果不再包含空选择 Key 和零虚拟数量调用。

- 已修复（2026-07-28）：new_emoji `Tabs` 过去被通用容器预览提前映射成 `Grid`，设计器不显示多个标签头；生成器又沿用上游 `contentVisible=false`，使运行窗口把完整控件高度用于标签头，且没有独立页面容器。现在模块生成脚本优先映射 `Tabs -> TabControl`，贡献动态 slots 布局和默认页面；设计器复用稳定页面 ID、页面树、拖放和仅显示当前页子控件的模型，并兼容旧 Grid 预览数据。New_Emoji 92 控件专属预览后来引入的二次分流也已排除 Tabs，分页容器始终读取真实 `tabs/items`、选中页和 `headerAlign`，不再显示写死的“标签页一/标签页二”。属性面板悬浮的“默认”按钮已移至属性名一侧，透明时不再拦截鼠标，修复标签头对齐等枚举下拉框箭头无法点击的问题；设计器也已按上游语义把 `headerAlign` 应用于每个等宽标签内部文字，而非错误地移动整组标签，并复用原生 72–152 像素宽度算法。原生生成器固定开启内容区，按上游内容矩形创建同级独立、无边框且 0 圆角的 Panel，通过 `EU_SetTabsPageElements` 绑定页面切换，页面子控件使用对应 Panel 作为真实 new_emoji 父元素；绑定外部页面时还会把 `ItemsEx` 的内置内容字段设为空白，避免高 DPI 下页面起点差异露出标签标题顶部笔画。模块清单、设计器模型和生成源码回归测试覆盖旧数据迁移、标签头、页面槽位、Panel 创建、父级映射、空白内置内容和禁止回退 `contentVisible=0`。

- 已完成（2026-07-28）：LCPP 补齐基础 `到文本` 与字符编码转换闭环。`到文本` 支持整数、长整数、小数、逻辑值和文本，普通 Win32 与 new_emoji 均有真实 C++ 实现；`lingbuilder.std.encoding` 现覆盖 UTF-8、UTF-16LE/BE、UTF-32LE/BE、ANSI、GBK、GB2312、GB18030、通用转换、BOM 与保守检测。当前原始编码字节统一使用大写十六进制文本承载，避免在尚无字节数组类型时损坏零字节或非法 Unicode。运行时专项测试、真实 MSVC 编码冒烟以及完整生成工程 MSVC 编译均已通过；未来若引入正式字节数组类型，应增加二进制重载而不是改变现有十六进制命令语义。

- 已完成并实机验证（2026-07-28）：`src/fbro-ui` 新手模式项目支持 FBro 内嵌浏览器与谷歌原生 UI 两种创建入口。新增确定性命令 `FBro_打开谷歌原生UI浏览器(控件名, 地址)` 和 C ABI `LB_FBro_CreateChromeUi`；后者不接收调用方 `HWND`，使用空 `parent_window/window`、`WS_EX_APPWINDOW`、`WS_OVERLAPPEDWINDOW` 与 `CEF_RUNTIME_STYLE_CHROME`，由 FBro/CEF 自行创建并管理独立桌面顶层窗口。内嵌浏览器继续使用独立子宿主 `HWND` 与 Alloy Runtime。网页 `BeforePopup` 由桥接取消后，示例 LCPP 用事件目标 URL 显式创建受管 Chrome UI；主窗口关闭时统一关闭其全部原生 UI 实例。真实 MSVC x64 构建通过，点击后同时检测到 `LingBuilderChineseCppWindowClass` 主窗口和独立 `Chrome_WidgetWin_1`，进程保持响应。

- 已完成并实机验证（2026-07-28）：`src/cef3-2` 新手模式项目新增 CEF3 双窗口形态示例。主窗口保留可随 DPI/窗口尺寸缩放的内嵌浏览器，工具栏提供“内嵌打开”和“谷歌原生UI”两个明确入口；新增确定性命令 `CEF3_打开原生UI浏览器`，通过 `CEF_RUNTIME_STYLE_CHROME`、空父句柄与独立根 HWND 直接创建带原生地址栏和完整浏览器界面的受管桌面顶层窗口，避免 Chrome UI 覆盖到主窗口内嵌宿主，也避免脚本 `window.open` 被 Chromium 弹窗策略拦截。已确认错误写法 `SetAsPopup(主窗口HWND, ...)` 会把 Chrome UI 挂入主窗口句柄层级；正确实现固定使用 `SetAsPopup(nullptr, ...)`、`parent_window=nullptr`、`WS_EX_APPWINDOW` 和非 `WS_CHILD`。实机截图确认 LingBuilder 内嵌窗口与 Chrome 原生 UI 窗口可同时存在并独立缩放。`OnBeforePopup` 显式返回允许，因此网页自身的新窗口链接同样创建独立原生浏览器窗口，不会重定向回内嵌实例。

- 已修复（2026-07-28）：CEF3 示例初次打开时设计器会按系统 DPI 正确缩放控件，但窗口尺寸事件过去把工具栏重新设置为未缩放的固定像素，拖动窗口后会造成后退、前进、刷新、地址栏和导航按钮位置比例异常。LCPP 现在使用 `窗口_取事件DPI()`，把全部工具栏坐标、尺寸、保留宽度和浏览器顶部偏移按 `当前DPI / 96` 统一换算，保证初次打开、拖动缩放及高 DPI 显示一致。

- 已完成（2026-07-28）：`src/cef3` 新手模式浏览器项目补齐地址栏、后退、前进、刷新、导航和窗口自适应布局；CEF3 宿主铺满顶部导航栏以下的客户区，窗口尺寸变化会同步调整 Chromium 内容。`OnBeforePopup` 由 LCPP 标记为已处理并把目标 URL 导航到当前实例，不再创建新浏览器窗口；地址与加载状态同步回写工具栏。项目已通过零语义诊断、生成 C++ 关键逻辑核对和 MSVC x64 CEF3 编译。

- 已完成（2026-07-28）：FBro 单窗口浏览器项目增加地址栏、后退、前进、刷新、导航和窗口自适应布局。基础模块新增 `控件_设置位置大小`，Win32 运行时移动真实宿主 `HWND` 后同步调整 FBro/CEF/Edge 子窗口，new_emoji 通过 `EU_SetElementBounds` 等价适配。FBro 桥接新增 `BeforePopup`：同步取消 popup，把目标 URL 投递给 LCPP，示例项目在当前浏览器实例导航。

- 已修复（2026-07-28）：FBro F5 偶发白屏与窗口“未响应”的启动竞态。桥接层过去会因 `OnContextInitialized` 与 Win32 窗口创建的先后顺序不同，随机从宿主主线程或 CEF UI 线程调用 `FBroHsCreate`；现在所有就绪后的创建统一通过 `CefPostTask(TID_UI, ...)` 串行投递到 CEF UI 线程。每控件 profile 同时改为 `.fbro-global-cache` 的直接子目录，旧的相对/嵌套目录会稳定映射，根目录外的绝对路径会隔离回退，避免 CEF 报 `cache_path`、`root_cache_path` 或 `Cannot create profile` 后降级。真实 `fbro` Debug 程序连续 8 秒保持响应、百度脚本成功执行、正常关闭且无缓存/profile 错误；错误 VIP 端到端测试继续通过。
- 已修复（2026-07-28）：FBro 创建期间拖动/初始化尺寸可能再次卡住 Win32 主消息循环。`LB_FBro_Resize` 现在使用非阻塞锁，CEF UI 线程正在创建时立即返回；尺寸同步只遍历宿主的直接子窗口，不再用 `EnumChildWindows` 递归移动 Chromium 内部 HWND。实际 `fbro` Debug exe 连续运行 12 秒保持 `Responding=True`，百度页面脚本已执行。
- 已修复（2026-07-28）：FBro 窗口缩放后导航栏控件错位。原因是初始布局按系统 DPI 缩放，大小改变事件却用未缩放像素移动地址栏、导航按钮和浏览器宿主，同时遗漏三个导航按钮。现在六个控件全部使用 `窗口_取事件DPI()` 在同一布局公式中重新定位，工具栏高度和浏览器顶边界也保持一致。

- 已修复（2026-07-28）：FBro 浏览器控件在窗口设计器中拖动或八向缩放时持续闪烁。控件交互改为通过 `requestAnimationFrame` 合并鼠标移动，只更新设计器瞬时预览；松开主鼠标键、窗口失焦或页面隐藏时才把最终坐标/尺寸一次性提交到项目模型，避免每个像素变化都触发持久化、脏状态通知和完整项目重绘。FBro 预览同时增加布局/绘制隔离，降低大面积白色浏览器占位区的重绘影响；后续若引入真实设计期原生 HWND 预览，仍应继续采用“交互预览与项目提交分离”的模型。

- 已完成（2026-07-28）：FBro VIP Key 用户自助配置、安全注入和错误授权端到端验证。设置中心新增“浏览器凭据”，每位开发者可保存、替换和清除自己的 Key；主进程使用 Electron `safeStorage` 加密到当前 Windows 用户凭据目录，preload 只公开配置状态和写/删操作，不提供明文读取接口。本地服务接收后从全局环境删除，并只在 F5/原生运行子进程中注入；AI Bridge 在下一次启动时带入。Key 不进入项目、设计器、源码、日志、AI 上下文或设置同步包；环境变量继续作为无人值守及导出 VS 工程的后备入口。真实 MSVC x64 自动测试已确认错误 Key 返回 FBro 原始授权错误且不泄漏 Key；测试退出改为 `FBroShutdown(FALSE)` 后等待 `OnBeforeClose`，避免强制终止产生 `0x80000003`。

- 已完成（2026-07-27）：FBro CEF 135.0.21 x64 独立模块闭环。内置 `lingbuilder.fbro.browser` 在媒体工具箱贡献可拖放的 `FBroBrowser`，每实例创建独立宿主 `HWND` 和 profile；基础导航、脚本提交、Cookie、代理、User-Agent、结构化指纹与浏览器事件通过预编译 `LingBuilderFbroBridge.dll` 的 C ABI 进入确定性 C++。`lingbuilder.fbro.sdk` 保存桥接层、官方头/库和 78 项（389,770,453 字节）运行时，F5/AI Bridge/VS 导出共用 SHA-256 增量物化、临时文件替换及目录保留。模块固定 MSVC x64，并在生成前阻断 CEF3、其它 `libcef.dll`、版本错配及 SDK 损坏。真实 VS Release x64 工程已编译，exe 与 3 个子进程运行 3 秒稳定。后续保留同步 JavaScript 返回值、完整缓存清理、高级 WebSocket/资源拦截、100 次压力测试，以及正式分发前的 FBro 重新打包许可确认。

- 已完成（2026-07-27）：原生 UI 后端命令契约接口化。新增 `NativeUiBackendCommandContract` 注册表，普通 Win32、new_emoji 以及后续 UI 库统一按“后端 ID + 模块 binding”声明命令支持能力；窗口模型的 `designerBackend` 不再是封闭二选一类型。new_emoji 已适配信息框、调试、退出、鼠标位置、窗口状态，以及控件文本/图片/启用/可见/勾选/数值/选择/集合等通用 Win32 基础命令，并复用标准库、文件系统、网络、数据媒体和平台运行时；依赖 `LingWindowBase`、专属 HWND 或普通 Win32 消息上下文的命令会在生成 C++ 前给出中文阻断诊断。未注册命令契约或未注册布局生成器的新后端也会阻断，禁止静默回退为 Win32。回归测试覆盖契约注册、字符串/注释过滤、可移植命令实现、不可移植命令阻断和 1500+ new_emoji binding 到真实导出头文件的全量衔接；MSVC x64 构建及 exe 运行 3 秒验证通过。

- 已修复（2026-07-27）：new_emoji 设计器中的控件 `.内容` 过去沿用普通 Win32 翻译结果，却没有在独立 new_emoji 运行时提供 `控件_取文本` / `控件_设置文本`，会让 `编辑框1.内容` 生成后触发 MSVC C3861。new_emoji C++ 生成器现在维护稳定中文控件名到元素 ID 的映射，并通过 `EU_GetElementText` / `EU_SetElementText` 完成 UTF-8 与宽文本转换；读取、赋值、嵌套表达式和信息框参数均复用同一确定性 `.内容` 语义。新增生成源码回归测试覆盖 getter、setter、元素注册和真实底层 API 调用。

- 已修复（2026-07-27）：new_emoji 项目通过 F5 后台启动时，窗口虽然已经创建并出现在任务栏，但仅调用 `EU_ShowWindow` 不能保证它进入 IDE 前方，用户必须手动点击任务栏。模块桥接新增 `NE_显示并激活窗口`，在控件和“创建完毕”处理器执行完成、进入消息循环之前统一恢复最小化窗口、刷新、短暂提升到最上层后立即还原普通层级，并请求前台、活动窗口和键盘焦点；遇到 Windows 前台窗口锁时会临时附加当前线程与原前台窗口线程的输入队列，完成激活后立即分离，因此不会遗留“总在最前”或线程输入关联。生成器顺序与桥接行为均加入回归测试。

- 已修复（2026-07-27）：new_emoji 设计器的通用预览事件键与模块原生事件键不一致会让 F5 静默漏绑回调。例如按钮双击生成的 `Click` / `_按钮1_被单击` 过去无法匹配模块目录的 `Clicked`，生成 C++ 中因此没有 `EU_SetElementClickCallback`。v2 设计器事件与 `runtime.eventBindings` 现支持显式 `aliases`，模块生成脚本维护 `Clicked <- Click` 等兼容关系；生成器会按别名解析旧项目，设计器双击则直接使用模块主事件。新增旧事件模型生成真实信息框回调和原生注册语句的回归测试。

- 已完成（2026-07-27）：new_emoji 92 个设计器控件属性/事件完整性专项。模块生成脚本不再只封装创建参数，而是从 `EU_Set<控件>` 导出推导结构化 `propertySetters`，并为组合 Setter、表格逐行配置和创建参数别名提供确定性映射；最终目录 698/698 属性均可生成真实 C++。事件目录统一补入鼠标进入/离开/按下/抬起/双击/移动/滚轮及焦点变化，连同组件语义事件达到 902/902 可绑定；上游 DLL 新增按钮经过/按下六色、统一鼠标/焦点/值变化回调。Upload 事件统一为 `FilesSelected` / `UploadAction`，错误粘入 Input 的 Omnibox 属性和无实现的 Menu accordion 元数据已移除。后续新增 new_emoji 控件属性或事件时，模块回归测试必须继续断言目录项全部具有运行时映射。

- 已修复（2026-07-27）：窗口设计器“保存后重新打开为空窗口”的状态水合竞态。磁盘 `.lingbuilder/projects/<projectId>/window-designer.json` 现在作为设计器首次挂载和后续外部重载的权威模型，`DiffViewer` 明确把已加载项目与活动窗口传入设计器；设计器不再因挂载较晚而错过磁盘加载事件后回退到共享空缓存。localStorage 自动保存改为按 `projectId` 独立键，并兼容迁移旧的全局键；new_emoji 命名空间控件在旧模型规范化时补齐 `designerBackend: new-emoji`。新增跨项目缓存隔离、旧键迁移、权威项目注入和后端迁移回归测试。

- 已修复（2026-07-27）：new_emoji 可视化设计器不再用紫蓝渐变、发光阴影和额外大圆角模拟按钮/编辑框，而是直接使用上游原生库深色与浅色主题令牌（窗口、标题栏、按钮、编辑框、边框和文字色）；设计画布仍保留仅用于对齐的点阵辅助线。F5、原生预览和 C++/Visual Studio 导出会在控件全部创建后，通过新增安全桥接 `NE_设置元素焦点` 把键盘焦点交给首个可见且启用的 Input/EditBox，使空编辑框启动时也能显示输入光标；窗口“创建完毕”处理器随后仍可覆盖默认焦点。默认 `lingbuilder` 图标改用根目录 `image/lingbuilder-ide-icon-v2.ico`，模块包将其作为双架构运行时资源复制到 exe 同目录，设计器标题栏同步预览同版 PNG；选择系统、自定义或无图标时仍服从窗口属性。新增主题令牌、输入控件识别、生成顺序、默认图标加载和桥接导出回归测试。

- 已完成（2026-07-28）：new_emoji 92 个命名空间控件新增独立设计时预览，不再按兼容 `Label`、`Grid`、`TextBox` 等基础类型退化为名称占位。预览按模块稳定类型绘制表格、弹窗、抽屉、通知、布局、统计、图表、日期时间、浮层、媒体与浏览器等组件，并复用上游深色/浅色主题令牌。12 个验证窗口已在内置浏览器以设计器实际 51% 适配比例逐项人工检查 92/92；同时修复 Tour 聚光遮罩阴影越界覆盖相邻控件的问题。

- 已修复（2026-07-27）：new_emoji 生成器的 UTF-8 转换辅助函数不再把 TypeScript 模板中的 `\0` 提前解释成真实 NUL 字节；F5、原生预览和 C++/Visual Studio 导出现在统一输出可见的 C++ 空字符转义 `'\0'`，避免 MSVC C2137“空字符常量”。同时，双架构外部模块的源码级 `#pragma comment(lib, ...)` 会按 `_WIN64` 选择 x64/Win32 target，不再让 x64 new_emoji 工程额外引用不存在的 `lib/Win32/new_emoji.lib` 并触发 LNK1104。新增生成源码回归断言，直接拒绝任何真实 NUL 字节并校验双架构库分支。

- 已修复（2026-07-27）：`.lcpp` 整行注释现在在统一语句生成入口、控制流分析和 `信息框` 特殊规则之前过滤。解析器仍保留 `// ...` 与 `注释 ...` 节点供结构编辑器展示，但普通 Win32、new_emoji、F5、原生预览/导出及 AI Bridge 不再把 `// 信息框(...)`、注释中的调试输出或控制流关键字翻译为可执行 C++；新增注释弹窗、日志和相邻条件结构回归测试。

- 已修复（2026-07-27）：窗口设计器 F5 与服务层受控构建统一通过生成文件落盘服务写入 C++ 工程；服务会先创建每个生成文件的父目录，并拒绝绝对路径或越界路径。生成器新增 `lcpp-sources/src/<项目>/MainWindow.lcpp` 等多级源码快照后，不再因构建目录内缺少嵌套文件夹触发 `ENOENT` / HTTP 500；新增嵌套 LCPP 源码落盘回归测试。

- 已修复（2026-07-27）：AI Bridge / 产品 CLI 的项目级诊断、空窗口生成与运行生命周期回归。`project diagnose` 在检查固定 `项目全局变量.lcpp` 时会同时加载同项目 `项目数据类型.lcpp`，自定义类型全局变量不再误报未知类型；无设计器控件的空窗口改由统一 `generateControlSpec` 生成类型安全占位项，不再因 `ControlSpec` 字段演进造成 MSVC 聚合初始化错位；`lingbuilder project run` 现在保持前台附着直到 exe 自然退出并等待 `run.log` 完成落盘，Ctrl+C/SIGTERM 会先停止受管进程再退出；普通窗口没有 `CefBrowser` 时不再尝试 CEF3 初始化或输出缺少 SDK 的误导日志。新增 AI Bridge 跨固定文件诊断、空窗口占位、未使用 CEF 运行时静默和受管进程自然退出/日志收尾回归测试。

- 已完成（2026-07-27）：新手模式可移植项目功能库闭环。新增 `功能库 名称 ... 结束功能库` 顶层语法，一个 `.lcpp` 文件对应一个无状态功能库，通过 `功能库名.功能名(...)` 自动跨文件发现和限定调用；公开/私有访问、重复库/功能、缺失库/功能、默认参数、成员状态、处理器引用及文件名不一致均有中文诊断。Monaco 和新手结构编辑器共用项目功能上下文，Win32 生成器把功能生成为携带调用窗口运行时的隐藏 `LingWindowBase` 方法，new_emoji 生成为前置声明的自由函数，并生成逐文件 source map。解决方案资源管理器提供“功能代码”组、项目右键新建/粘贴和文件右键复制。跨项目粘贴现已递归解析完整依赖闭包：间接功能库按依赖顺序批量复制，目标同名且源码相同的库直接复用，同名但不同的间接库自动改为唯一副本名并同步重写限定调用；嵌套项目数据类型、项目常量/全局变量初始化链和模块引用同时迁移，相同定义复用、不同定义在确认前阻止覆盖；新增源码、项目资源文件和 `project-modules.json` 使用同一可回滚文件事务写入。后续仍可增强系统文件对话框“添加现有功能库”、跨文件引用列表 UI 和完整崩溃恢复级原子重命名。

- 已完成（2026-07-27）：新手模式 LCPP 项目常量闭环。固定 `项目全局变量.lcpp` 现在同时保存项目常量和项目全局变量，新手界面提供独立页签；`常量 类型 名称 = 常量值` 进入解析、AST、结构编辑、基础标量类型校验、只读赋值诊断、拼音补全、引用查找、跨文件预览重命名和 source map。Win32 F5、原生预览、Visual Studio 导出与 AI Bridge 统一把数值/逻辑常量生成为 `inline constexpr`，文本常量生成为 `inline const std::wstring`，并在可变全局变量之前输出。首版仍不支持程序集常量、常量数组、枚举和项目常量的模块自定义类型；这些能力后续必须继续复用同一项目符号与确定性生成链路。

- 已完成（2026-08-01）：新手模式 `.lcpp` 局部常量闭环。`局部常量 类型 名称 = 表达式` 复用局部符号模型并支持事件、方法、构造和功能库函数；初始值必填、禁止显式数组、首版仅允许子程序顶层声明。解析、AST 编辑协议、变量/常量互转、前置引用与类型诊断、只读赋值诊断、补全/悬停/结构视图、拼音检索、定义与 source map 均已接通；新手“局部声明”表提供类别列、右键与命令面板“新建局部常量”，`Ctrl+L` 保持只插入普通局部变量。普通 Win32、new_emoji、F5、原生预览、Visual Studio 导出和 AI Bridge 共用生成入口并输出运行时 `T const`，不使用 `constexpr`。新增独立 MSVC x64 smoke，验证真实生成声明、源码顺序、初始化函数只调用一次和 local source map，不依赖当前公共 FBRO 运行时。程序集常量仍未支持。

- 已修复（2026-07-27）：基础/高级 Win32 控件属性与事件运行时完整性复查发现的缺口已闭环。自身初始隐藏的控件及隐藏父容器中的后代不再从生成数组删除，而是全部创建独立主 `HWND`；只有自身隐藏的控件移除初始 `WS_VISIBLE`，可见后代通过父 HWND 自然继承隐藏，重新显示父容器时不会永久丢失子控件；带外框控件显示/隐藏时会同步切换外框与内部 HWND。DateTimePicker、TabControl、HotKey 的专用绘制分支会继续派发已公开的鼠标/焦点事件；FlatScrollBar 在自身子类窗口过程处理标准滚动条消息并派发 `ValueChanged`。属性面板对日期/时间使用原生 `date` / `time` 输入，生成器同时解析 `YYYY-MM-DD` 与 `HH:mm[:ss]`；所有稳定英文枚举键均显示中文标签。新增针对生成结果、模块清单、事件可达性、隐藏句柄、日期时间和枚举本地化的回归测试。

- 已完成（2026-07-27）：基础控件与高级控件属性/事件完整性专项补齐。统一 Win32 控件注册表现在把原生子类运行时已支持的 `MouseDown`、`MouseEnter`、`MouseLeave`，以及仅对可可靠聚焦控件开放的 `GotFocus`、`LostFocus` 同步到设计器事件面板和内置模块清单；`Label`、`Image`、`AnimatedImage` 补齐原生 `Click`。标签、图片、动态图、分组框、进度条、状态栏、动画控件和平面滚动条不再显示无法可靠触发的焦点事件。由专用交互链管理的 `ColorPicker` 与 `VideoPlayer` 保持专属事件集合。非可视 `ToolTip`、`FileDialog`、`ContextMenu`、`PopupMenu`、`PropertySheet` 的注册属性已与实际持久化模型统一，属性页 `Applied` 改用统一事件卡片一键创建/打开，不再让用户手输处理器名。新增注册表—模块 manifest—事件面板一致性测试和非可视资源 schema 回归测试。

- 已修复（2026-07-26）：CEF3 原生依赖计划现在显式携带最低 C++20 与动态 CRT（`/MD`）要求，并统一传递到 IDE F5 直接编译、AI Bridge `build.run` 以及 `generated/cpp` / `.lingbuilder-build` 中的 Visual Studio 工程。四组 VS 配置不再硬编码 `stdcpp17`，避免 CEF 150 的 `<concepts>`、`std::convertible_to` 触发 STL4038、C2061 及连锁语法错误。CEF Debug 继续保留 `/Od`、`/Zi` 和链接调试信息，但为匹配预编译 `/MD` wrapper 使用 `NDEBUG`，不再把 `_DEBUG` CRT 调用混入 Release CRT 导致 `__imp__calloc_dbg` / `__imp__CrtDbgReport` 链接失败；普通无特殊模块项目仍保持 C++17 与原 Debug CRT。

- 已修复（2026-07-26）：环境检查不再把“仅检测到 g++/clang++”显示为 LingBuilder 默认原生构建已就绪。API 现在分别返回任意 C++ 编译器可用状态与 MSVC 原生构建就绪状态；默认 `ready` 要求 Windows、Node.js、MSVC 和 Windows SDK 均可用。环境输出与修复中心同步区分必需的 MSVC/Windows SDK 和可选的 CMake、g++、clang++，替代编译器存在时会明确提示其不能替代 Win32 与 Visual Studio `.lib` 模块所需工具链。

- 已完成（2026-07-26）：新手模式局部变量支持火山式快速插入与分组阅读。事件、方法和构造子程序的正文编辑框内按 `Ctrl+L` 会先提交当前草稿，再在光标所在源码行插入默认文本型局部变量并选中变量名；局部声明可以分散在子程序任意位置，相邻声明按源码顺序合并为独立可折叠变量组。AST 正文回写改为按“前置语句数量”锚定并保留全部局部声明，避免编辑正文时删除或挪走中间变量；局部变量只属于当前子程序，代码在声明之后使用，并由原生生成器确定性声明。
- 已完成（2026-07-26）：新手模式增加“回车智能声明”。光标位于完整的未声明赋值语句行末时，按 Enter 会使用字面量、当前作用域、子程序返回类型和已启用模块命令元数据推断类型，在赋值语句上方插入同名局部变量，并把光标继续放到下一行。无法确定类型时显示可键盘操作的类型选择；已声明名称、成员属性、注释、原生 C++ 和括号/引号不完整的表达式不会触发，避免回车时产生错误声明。
- 已完成（2026-07-26）：新手模式的新增/已有局部变量“类型”输入框接入统一类型补全服务。输入 `wb`、`zs`、`lj`、`xs` 等拼音简写或 `string`、`int`、`bool` 等英文别名会显示中文类型候选；支持方向键切换、Enter/Tab 确认、Esc 关闭，失焦时的精确别名也会规范化为中文类型，自定义类型仍可原样保留。

- 已完成（2026-07-26）：落地一键 LCPP 源码分享闭环。文件菜单、命令面板和项目右键菜单可把目标项目及其项目引用闭包导出为单文件 `.lcpppkg`；包内包含 `.lcpp`、配置、设计器模型、assets、项目模块锁定、已启用第三方模块和 SDK/资产载体模块，并为全部工作区文件记录 SHA-256。安装版支持双击、拖入或原生对话框打开，导入前校验格式、路径、符号链接、文件数量、解压体积和逐文件哈希，然后在“文档/LingBuilder/已导入源码”创建唯一独立工作区并直接切换，不覆盖原项目或污染其他工作区模块。`.env`、私钥/证书和常见凭据 JSON 默认排除；新增桌面宿主服务与真实压缩/解压回归测试。
- 已完成（2026-08-01）：工作区切换改为复用当前本地服务进程并在服务层运行时重绑定工作区。Electron 主进程调用 `/api/workspace/switch` 后只发送 `workspace:changed` IPC，不再停止/重启 Express/Vite、重新加载 renderer 或固定等待新服务；服务端串行取消构建、终端、clangd、调试和扩展等旧工作区资源，再重建工作区绑定服务并递增运行时版本。renderer 收到事件后重新载入解决方案、项目文件和模块上下文，显示切换遮罩直到本次项目文件载入进入 `ready/error`，并用 reload token 防止旧请求提前关闭遮罩。旧的“每次切换启动独立受管 Vite 服务”方案已被本方案替换；独立新窗口仍继续使用 `--managed-dev-server` 隔离服务。

- 已完成（2026-07-26）：CEF3 内核 SDK 离线模块包（方案 A）落地：新增纯资产载体模块 `lingbuilder.cef3.sdk`（无命令/控件、无需为项目启用），打包脚本 `electron/scripts/generate-cef3-sdk-module.cjs`（`npm run module:cef3-sdk -- --install`）把 CEF 官方包的 `include/Release/Resources` 与预编译 /MD `libcef_dll_wrapper.lib` 打成 `cef3-sdk-x64.lbmod`（实测 184MB，版本号自动读 `cef_version.h`）；`findCef3SdkRoot` 新增候选 `.lingbuilder/modules/lingbuilder.cef3.sdk/sdk` 并从 `layout.buildDir` 反推工作区根目录；`.lbmod` 包上限从 100MB 放宽到 1GB。已验证：正式安装链路（preview→install）通过；挡住其它 SDK 路径后仅凭模块 SDK 全新构建成功且 exe 多进程运行；`tests/modules.test.ts` 34/34。后续：开发者中心/市场 UI 需验证大包上传体验；32 位 SDK 包未制作；内核升级时需用新官方包重新打包。

- 已完成（2026-07-26）：Windows 发布流程增加 CEF3 SDK 强制完整性门禁。`package:dir` / `package:win` 在 Electron Builder 启动前校验模块 ID、schema、manifest 与 `cef_version.h` 版本、关键文件大小、x64 PE 架构、最低文件数/体积，并生成全部 SDK 文件的路径、大小和流式 CRC32 清单；`beforePack` 再次校验源目录，`afterPack` 对 `win-unpacked` 逐文件比对，NSIS 生成后使用 7-Zip 直接读取安装包归档并逐文件比对。SDK 缺失、版本错配、损坏、被漏打包或多出异常文件时发布命令立即失败，不再产生表面成功但无法编译 CEF3 项目的安装包。

- 已完成（2026-07-26）：CEF3 浏览器真实运行闭环落地（CEF 150.0.14+chromium-150.0.7871.129 x64）：`cef3-cli-test` 示例 exe 启动后两个 CefBrowser 控件真实渲染百度与必应。本次修复：① `nativeDependencyService.ts` 支持 CEF 官方二进制发行包布局，首次构建自动用 CMake 编译 `libcef_dll_wrapper.lib`；编译前自动把 `project(cef)` patch 为 `project(cef LANGUAGES CXX)`（部分 VS 2022 自带 CMake 3.31 在启用 C 语言时于 `find_program(CMAKE_LINKER)` 阶段 0xC0000409 崩溃，wrapper 纯 C++ 只需 CXX），并传 `-DCEF_RUNTIME_LIBRARY_FLAG=/MD` 对齐 LingBuilder 编译链动态 CRT（CEF 默认 /MT 会链接报 LNK2038），产物目录 `build_wrapper_<架构>_md/`；② 运行时复制清单补全 `v8_context_snapshot.bin`（缺失导致渲染进程无法启动、浏览器白屏）与 GPU/软渲染 DLL（d3dcompiler_47、dxcompiler、dxil、libEGL、libGLESv2、vk_swiftshader、vulkan-1）；③ 生成器 CEF 150 API 适配：`SetAsChild` 改用 `CefRect`、移除已删除的 `CefBrowserSettings.mute_audio`/`user_agent`（静音改为创建后 `GetHost()->SetAudioMuted(true)`，UA 改为全局 `CefSettings.user_agent`）、`friend class LingCefClient` 解决 protected 回调访问、模板反斜杠转义（TS 模板中 C++ `\\` 字面量需写四反斜杠）。后续优化：wrapper 自动编译链路（execFile 直接调 CMake）尚未在干净环境实测首次全自动编译；32 位 minimal 包未验证；F5 IDE 内链路与 VS 导出工程的 CEF3 行为一致性待回归。
- 已修复（2026-07-26）：新项目默认 Win32 与 CEF 150 x64 SDK 的架构冲突。启用或安装并启用 `lingbuilder.cef3.browser` 时，IDE 自动把工作区构建架构切换为 x64 并刷新状态栏；F5/解决方案构建前再次按已启用模块校正，覆盖复制项目或手动改回 Win32 的情况。当前随附 SDK 明确仅支持 x64；32 位 SDK 包未制作。
- 已修复（2026-07-26）：IDE 构建目录中的 Visual Studio 工程统一把 exe 输出到 `$(Platform)/$(Configuration)/bin/`，与 F5 已物化的 CEF DLL、snapshot 和 Resources 目录一致。不再出现 MSBuild 成功但 exe 位于资源目录上一层、从 Visual Studio 启动时缺失 `libcef.dll` 或 `v8_context_snapshot.bin` 的情况。可移植 `generated/cpp` 的完整 CEF SDK/资源复制仍是独立的导出闭环，不能因本次构建目录验证而视为已完成。

- 已修复（2026-07-26）：标准库 C++ 运行时的十六进制字符解析辅助函数 `LB_HexDigit` 移入所有内置运行时片段共享的公共区；项目只启用“编码转换模块”或“JSON 数据模块”、未启用“字节与十六进制模块”时，F5/导出不再因生成代码调用未声明辅助函数而触发 MSVC C3861。新增独立模块组合回归测试，确保辅助函数先定义且只生成一次。

- 已完成基础闭环（2026-07-25，2026-08-05 扩展）：新增内置 `CEF3浏览器模块`（模块 ID：`lingbuilder.cef3.browser`），按 v2 manifest 提供设计器控件高级贡献；22 条兼容核心命令与 92 项浏览器侧事件目录进入模块上下文和确定性 C++ 运行时，其中 `CEF3_打开原生UI浏览器` 可创建 Chrome Runtime 顶层窗口。已完成每实例 RequestContext/缓存子目录、真实 JavaScript JSON 返回和完整 CommandLine 子域。这里的“基础闭环”不等于 1577 个上游目录项全覆盖；完整状态和剩余项以文件顶部的 CEF 安全覆盖条目为准。

- 已修复（2026-07-25）：安装版工作区恢复状态与开发版状态分文件保存，首次安装或升级不再继承开发仓库的 `UI_CppLocProj` / `GameClient` 解决方案；安装包默认工作区也不再直接打包仓库根目录的 `src`、`config` 和设计器项目状态，而是在用户文档目录新的“起始工作区”中确定性创建“未命名解决方案 / 新建项目”，避免继续复用旧安装版的“示例工作区”残留。工作台新增“关闭当前解决方案”命令、文件菜单入口、解决方案树右键入口和载入失败页入口；关闭只切换到新的空白工作区并从最近记录移除旧工作区，不删除用户磁盘文件。

- 已完成（2026-07-25）：底部“输出窗口 - 编译与生成”中的本地生成路径支持双击跳转文件资源管理器；`bin` 等目录直接打开，`.sln` 等文件在其所在目录中选中。渲染层只识别日志里的 Windows 本地路径，Electron 主进程会解析真实路径并限制在当前桌面工作区或本地构建服务的可信工作区内；开发模式即使历史桌面工作区与构建服务根目录不同，也不会误报越界。路径不存在、真实越界或打开失败时返回中文提示。

- 已修复（2026-07-25）：底部“输出窗口 - 编译与生成”与调试日志的右键菜单补齐“复制行、复制全部、清空”，多行日志可按实际逻辑行命中复制；菜单坐标统一相对底部面板计算并在可视范围内约束，不再因滚动内容区偏移或面板边缘裁剪而看不到菜单。错误列表原有批量复制与清空行为保持不变。

- 已修复（2026-07-25）：窗口设计器中的 Win32 滑块不再回退成写有“滑块”的通用占位框，新增专用预览并按 `minimum`、`maximum`、`value`、`tickFrequency` 同源绘制轨道、滑块位置和自动刻度；状态栏预览同步采用原生 `SB_SETPARTS` 语义，前置分区保持固定像素宽度、最后分区填满剩余宽度，并以与 `PaintOwnerStatusBar` 一致的 22% 前景色混合效果绘制外框和分隔线。现有项目模型及 F5/导出 C++ 无需迁移。

- 已完成（2026-07-25）：Win32 基础模块新增全局初级命令 `取鼠标水平位置()` 和 `取鼠标垂直位置()`，使用原生 `GetCursorPos` 返回相对于屏幕左边、顶边的像素坐标。两个命令已同时进入模块补全、v2 binding 和 LingCpp 确定性 C++ 生成，默认启用基础模块即可使用；弹出菜单可直接传入这两个命令，不再需要手写固定坐标。

- 已完成（2026-07-25）：选项卡“标签页”不再把页面 ID、标题、图片编号和排序操作直接展开在狭窄属性面板中；属性面板改为标签页数量摘要和“编辑标签页”入口，独立响应式弹窗支持新增、复制、排序、删除、空状态、Esc/遮罩关闭及窄屏卡片布局。弹窗继续即时写回既有 `properties.tabs`，并在页面 ID 改名或删除时同步迁移页面内子控件的 `containerSlot`，避免已有布局丢失页面归属；至少保留一个标签页，设计器预览、持久化和 LingCpp Win32 F5/导出数据结构无需迁移。

- 已完成（2026-07-25）：Win32 公共控件模块新增非可视 `ContextMenu`（上下文菜单）和 `PopupMenu`（弹出菜单）设计控件。两者在画布中使用可选中、可拖动占位并持久化稳定菜单项 ID、文字、分隔线、启用与勾选状态；上下文菜单绑定窗口或具体控件后响应真实 `WM_CONTEXTMENU`，控件统一子类过程会直接拦截右键消息，选项卡页面也会向主窗口转发，因此嵌套在 Tab 页面或容器中的目标不再漏弹菜单；弹出菜单通过 `弹出菜单_显示` / `弹出菜单_在坐标显示` 主动触发。F5/导出统一生成 `HMENU`、`CreatePopupMenu`、`AppendMenuW` 与 `TrackPopupMenuEx`，菜单项选择按稳定 ID 分发中文事件，并可用 `菜单_取最后项目` 读取最近选择项。当前先支持单层菜单项；层级子菜单、图标和运行时动态增删列入后续增强。

- 已调整（2026-07-25）：窗口菜单栏 `MenuBar` 从设计器控件工具箱和新建入口移除，常规窗口操作入口统一使用 `ToolBar`。旧项目中已经保存的 `menuItems`、菜单事件和外观字段仍可加载、编辑并生成真实 Win32 菜单，避免升级时静默破坏既有工程；AI 规则同步禁止在新项目中继续创建窗口菜单栏。

- 已完成（2026-07-25）：独立表头控件的“列集合”不再把每列字段直接展开在狭窄属性面板中；属性面板改为列数量摘要和“编辑列”入口，并复用列表视图的响应式列编辑弹窗，集中编辑标题、宽度、对齐方式和图片编号，支持新增、排序、删除、空状态、Esc/遮罩关闭及窄屏卡片布局。弹窗继续即时写回既有 `properties.columns`，设计器预览与 LingCpp Win32 F5/导出链路无需迁移。

- 已修复（2026-07-25）：热键输入框的文字颜色、实体背景色和透明背景现在由设计器预览与 LingCpp Win32 F5/导出共同消费。设计器的通用控件预览在 `background: "transparent"` 时不再残留固定蓝黑占位底色。由于原生 `msctls_hotkey32` 会自行处理 `WM_PAINT` 而不可靠消费标准 Edit 颜色通知，运行时现在保留其原生按键捕获与 `HKM_GET/SETHOTKEY` 状态，但接管客户区绘制：文字使用设计器前景色，透明时使用实际窗口、选项卡页或最近不透明父容器的颜色与画刷。

- 已修复（2026-07-25）：富文本框的文字颜色和背景颜色现在由设计器预览与 LingCpp Win32 F5/导出共同消费。原生 `RichEdit` 使用 `EM_SETCHARFORMAT` 应用文字颜色、使用 `EM_SETBKGNDCOLOR` 应用背景颜色；`background: "transparent"` 按实际窗口、选项卡页或最近不透明父容器解析为等效背景色，不再回退为 RichEdit 系统白底。Win32 RichEdit 不支持 CSS 式 alpha 混合，因此透明语义保持与其他原生控件一致的父背景跟随。

- 已完成（2026-07-25）：状态栏“分区集合”不再把每个分区直接展开在狭窄属性面板中；属性面板改为分区数量摘要和“编辑分区”入口，独立响应式弹窗集中编辑文字与宽度，并支持新增、复制、排序、删除、空状态、Esc/遮罩关闭及窄屏卡片布局。弹窗即时写回既有 `properties.parts`，无需迁移设计器预览和 LingCpp Win32 F5/导出链路。

- 已完成（2026-07-25）：窗口设计器停止新增“分页容器”。`Pager` 注册项改为旧项目兼容能力，不再出现在控件工具箱和内置 `lingbuilder.win32.common-controls` 模块的 `designerControls` 贡献中；已有项目仍可读取、编辑并生成原生 Win32 `SysPager`，避免升级时破坏旧工程。当前 `lingbuilder-4` 项目已不再包含分页容器实例。

- 已调整（2026-07-25）：Rebar 容器从设计器工具箱、模块控件贡献和新建入口移除，常规工具栏场景统一使用 ToolBar。Rebar 注册项标记为 `legacyOnly`，既有项目仍可加载、编辑和生成真实 Win32 Rebar，不静默删除用户布局；AI 规则同步禁止在新项目中继续创建 Rebar。

- 已完成（2026-07-25）：窗口设计器停止新增“网格容器”。`Grid` 注册项改为旧项目兼容能力，不再出现在控件工具箱和内置模块的 `designerControls` 贡献中；已有项目仍可读取、编辑并生成原生 Win32/new_emoji 容器，避免迁移时丢失父子层级。普通容器布局统一使用分组框。

- 已完成（2026-07-24）：工具栏“按钮集合”不再把所有记录直接展开在狭窄属性面板中；属性面板改为按钮数量摘要和“编辑按钮”入口，独立响应式弹窗集中编辑命令 ID、文字、图片编号和按钮样式，并支持新增、复制、排序、删除、空状态、Esc/遮罩关闭及窄屏卡片布局。弹窗仍即时写回既有 `properties.buttons`，无需迁移 C++ 生成、图像列表和点击事件链路。

- 已修复（2026-07-24）：Win32 工具栏配色生成不再输出 Windows SDK 中不存在的 `TB_SETBKCOLOR` / `TB_SETTEXTCOLOR`，消除 MSVC C2065 编译阻断。背景色改用公共控件正式消息 `CCM_SETBKCOLOR`，文字色、禁用文字色和悬停背景通过 `NM_CUSTOMDRAW` / `NMTBCUSTOMDRAW` 确定性消费设计器颜色。

- 已修复（2026-07-24）：Win32 工具栏在 LingCpp F5/导出中会关闭会覆盖自定义配色的系统视觉主题，并通过公共控件背景消息与自绘通知消费设计器背景色和文字色；同时启用 `CCS_NODIVIDER` 移除工具栏顶部的系统白色分隔线。按钮集合、图像列表、点击命令 ID 和事件分发链路保持不变。

- 已修复（2026-07-24）：Win32 动画控件的 Media Foundation 播放失败日志在生成 C++ 时保留为 `\\n` 转义序列，不再把模板中的真实换行写进宽字符串常量；新增生成结果回归断言，避免 F5/导出因 MSVC C2001、C1075 阻断。

- 已修复（2026-07-24）：日期时间选择器调整原生下拉月历位置时，生成的 `std::clamp` 会先把 Win32 `RECT.left` 的 `LONG` 显式转换为 `int`，避免 MSVC 因上下界为 `int` 而无法推导统一模板参数的 C2672 编译阻断。

- 已修复（2026-07-24）：Win32“动画控件”不再依赖只支持无音频、未压缩/RLE 老式 AVI 的 `SysAnimate32`。LingCpp F5/导出改为复用 Media Foundation `IMFPMediaPlayer` 承载 AVI，因此 H.264/AAC 等系统可解码的现代 AVI 也能按 `autoPlay`、`loop` 播放，并继续分发“播放完毕”事件；解码失败时控件会显示“AVI 播放失败”并写入调试输出，不再静默空白。资源仍使用 `properties.aviSource` 和现有 `assets/` 复制链路，旧项目无需迁移模型。

- 已完成（2026-07-24）：Rebar 容器补齐高级带区能力。设计器支持锁定带区、显示/隐藏拖动柄、固定高度、带区边框、自动绑定直接子控件，并可对每个带区设置最小宽度、高度、强制换行和是否允许调整宽度；画布提供接近原生的带区预览及拖动排序。LingCpp F5/导出统一生成 `RBS_FIXEDORDER`、`RBS_VARHEIGHT`、`RBBS_NOGRIPPER`、`RBBS_BREAK`、`RBBS_FIXEDSIZE` 等真实 Win32 样式，并分发开始拖动、结束拖动、高度改变和布局改变事件。旧项目缺失新字段时保持原有可拖动、显示拖动柄和可变高度行为。

- 已修复（2026-07-24）：Rebar“带区集合”的通用“添加项目”不再创建随即被自动绑定校验清除的空记录。属性面板现在直接说明正确用法，并把按钮改为“绑定下一个子控件”：存在未绑定的直接子控件时自动填入控件、标题和尺寸；没有子控件或已全部绑定时显示明确中文提示，不再表现为点击无反应。

- 已修复（2026-07-24）：Win32 数值调节器（UpDown）新增设计器专属预览，画布中直接显示与原生控件一致的上、下双按钮和三角箭头，禁用状态同步变淡；不再回退成被窄宽度截断的通用文字占位。F5/导出的原生 `UDM_SETBUDDY`、数值范围、当前值和变更事件链路保持不变。

- 已修复（2026-07-24）：图片、GIF 与 AVI 文件属性编辑器的内容容器现在允许在默认窄属性面板中正确收缩，路径输入框会让出空间，固定宽度的文件选择按钮始终可见，不再需要手工拉宽属性面板。

- 已修复（2026-07-24）：Win32 状态栏的背景颜色、文字颜色、字体和文字对齐方式现在进入设计器预览及 LingCpp F5/导出结果。`properties.textAlign` 支持 `left`（居左，旧项目默认）、`center`（居中）、`right`（居右），统一应用到全部状态栏分区。设计器的 `transparent` 不再残留蓝色占位底色；原生状态栏通过 `SB_SETBKCOLOR` 和 owner-draw 分区确定性绘制，透明背景解析为实际窗口、选项卡页或最近不透明父容器的背景色，并保留分区宽度、文字省略和双击事件。

- 已完成（2026-07-24）：独立 Header（表头）的列集合新增逐列“文字对齐”字段，支持居左、居中、居右。对齐值作为 `alignment: left/center/right` 进入项目模型，设计器实时预览对应布局，LingCpp F5/导出统一生成 `HDF_LEFT/HDF_CENTER/HDF_RIGHT`；旧项目未保存该字段时安全默认为居左。

- 已修复（2026-07-24）：日期时间选择器的原生下拉月历高度现在同时调整内部 `SysMonthCal32` 和 `GetParent` 取得的系统下拉宿主；通过 `GetWindowInfo`、`AdjustWindowRectEx` 计算宿主非客户区，并按显示器工作区选择向上或向下展开，避免只拉伸内部月历后被旧尺寸宿主裁切。曾导致超大字体和日期全黑的 `DTM_SETMCFONT` 间接缩放方案已完全撤回，日期文字继续使用正常字体。

- 已完成（2026-07-24）：Win32 高级控件模块新增“视频播放器”可视控件。设计器支持导入 MP4、WMV、AVI、MOV、M4V 到项目 `assets/`，并持久化视频源、自动播放、循环播放和 0～100 音量；LingCpp F5/导出统一生成基于 Media Foundation `IMFPMediaPlayer` 的真实播放器，包含媒体打开、播放完毕、播放错误事件以及设置文件、播放、暂停、停止、设置音量、读取状态等确定性中文命令。生成工程链接 `mfplat.lib`、`mfplay.lib`、`mfuuid.lib`，项目资源复制链路会把视频一并带到 exe 目录。

- 已完成（2026-07-24）：Win32 基础工具箱新增“动态图像控件”，通过独立 `AnimatedImage` 模型和 `properties.gifSource` 选择并复制 GIF 到项目 `assets/`。设计器使用真实 GIF 预览；LingCpp F5/导出使用 GDI+ 时间帧维度、GIF `0x5100` 帧延时元数据和窗口定时器逐帧绘制，支持填充方式、自动播放、循环播放及“播放完毕”事件，停止与销毁时会清理定时器、位图和图像对象。原有 AVI“动画控件”和静态“图片框”保持兼容。

- 已完成（2026-07-24）：Win32 动画控件的“AVI 文件”属性新增与图片框一致的 Electron 原生文件选择入口。选择器仅接受 AVI，服务层校验后复制到当前项目 `assets/` 并保存工作区相对路径；现有 F5、导出和 AI Bridge 资源同步链路会把 AVI 一并复制到生成目录，避免项目依赖原电脑绝对路径。

- 已修复（2026-07-24）：增强组合框现在在 LingCpp Win32 F5/导出中确定性消费设计器的背景颜色与文字颜色；原生 ComboBoxEx 的收起项、下拉项目和下拉空白区统一使用控件模型颜色，并继续保留图像列表绘制。属性面板新增“下拉列表高度”（40–600），与控件自身高度分离并进入项目持久化和原生生成链路；旧项目缺失该字段时默认使用 160。

- 已修复（2026-07-24）：日期时间选择器和月历现在在 LingCpp Win32 F5/导出中确定性消费设计器的背景颜色、文字颜色和字体。月历关闭自身视觉主题后通过 `MCM_SETCOLOR` 同步月面、标题和相邻月份文字；日期时间选择器主体由保留原生交互的绘制链路着色，并在 `DTN_DROPDOWN` 时把同一颜色应用到真实下拉月历，不再只在 React 画布预览中生效。

- 已修复（2026-07-24）：Win32 `SysIPAddress32`（IP 地址框）现在在 F5/导出运行时真实消费设计器的背景颜色和文字颜色；内部四段编辑框通过控件颜色消息使用统一画刷，段间背景与三个分隔点由 IP 控件子类按同一颜色模型补绘。专属属性新增文字垂直对齐方式（顶部、居中、底部）、0～8 像素边框粗细和边框颜色，设计器预览与原生运行时共同消费这些字段；原生边框改由独立宿主窗口绘制并把 `SysIPAddress32` 内嵌到内容区，避免系统白色外框覆盖自定义颜色，同时保留原生输入、焦点切换和 `IPN_FIELDCHANGED` 事件行为。

- 已修复（2026-07-24）：独立 Win32 Header（表头）控件现在通过 `NM_CUSTOMDRAW` 消费设计器的背景颜色、文字颜色和字体；背景使用用户选择的精确颜色，列项目及最后一列后的空白区域共同绘制，不再在 F5/导出运行时退回系统白底黑字。列头保留悬停高亮、鼠标按下变暗及文字按压位移，避免自绘后点击看起来无效；位于选项卡页面等容器中的表头继续通过父级通知转发进入同一确定性绘制链路。

- 已完成（2026-07-24）：窗口属性“当前窗口 / 状态”新增“禁止拖拽调整大小”和“禁止窗口最大化”两个独立开关。字段进入设计器项目持久化、布局 XML、LingCpp F5/导出和旧原生 Win32 生成链路；生成器分别移除 `WS_THICKFRAME` 与 `WS_MAXIMIZEBOX`，旧项目继续默认允许调整大小和最大化。

- 已修复（2026-07-24）：最大化窗口中，隐藏表头的根级选项卡从首个页面切到后续页面时，不再因页面内空 Toolbar/Rebar 被 Win32 公共控件自动吸附到父页顶部而出现 `#A0A0A0/#FFFFFF` 两行系统边缘；Toolbar/Rebar 现在禁止自动父级对齐、移动和缩放，执行控件自身的自动布局后还会恢复设计器指定的位置与尺寸。

- 已修复（2026-07-24）：运行时隐藏选项卡表头后切换到曾经隐藏的页面时，不再复用该页隐藏前缓存的系统边缘像素；页面切换现在先同步刷新 TabControl，再将当前页面置顶并强制重绘页面、非客户区及全部子控件，避免首个页面正常而后续页面顶部重新出现白边。

- 已修复（2026-07-24）：位于选项卡非首个页面内的独立 Header 控件不再被 Win32 通用控件布局自动吸附到父页面顶部并拉伸成整行白边；原生创建样式现在禁止父级对齐、自动纵向移动和自动缩放，严格保留设计器中的位置与尺寸。

- 已修复（2026-07-24）：选项卡开启“隐藏表头”后，设计器预览与 LingCpp Win32 F5/导出运行时不再保留标签页内容区的顶部浅色边框；运行时动态调用“设置隐藏表头”也会按当前状态同步取消或恢复页面边框。

- 已修复（2026-07-24）：初始未配置 `imageSource` 的普通 Win32 Image 控件现在也固定使用 `SS_BITMAP | SS_CENTERIMAGE | SS_NOTIFY` 创建，空状态仅额外保留 `WS_BORDER`。因此文件对话框返回完整路径后调用 `图片框1.设置图片(...)` / `控件_设置图片(...)` 时，`STM_SETIMAGE` 可立即绘制位图，不再出现日志已有有效路径但空图片框仍不显示的问题。

- 已修复（2026-07-24）：LingCpp Win32 生成器补齐普通 `如果 (...) / 否则 / 如果结束` 的确定性 C++ 控制流翻译；条件中的比较、算术、嵌套模块调用和文本字面量统一递归翻译，`文件对话框_取文件(文件对话框1, 0)!=""` 会生成宽字符串比较，不再输出未定义的中文 `如果` 标识符或窄字符串。窗口设计器的小数宽高在写入 `WindowSpec` 前统一取整，消除 MSVC C4838 收缩警告；LingCpp 设计器诊断同时把项目 `resources` 中的 FileDialog 事件纳入绑定识别，不再误报控件不存在。
- 已完成（2026-07-26）：LingCpp 基础控制流补齐条件别名与否则如果、多路选择、无限/前置条件/后置条件/计次/变量/枚举循环、跳出与继续、尝试/捕获/最终/抛出，并统一到独立 `lingCpp/controlFlow.ts` 解析规则。解析诊断、Monaco/新手补全、关键字高亮、格式化、折叠、新手括号流程控制线和 Win32 C++ 生成共同消费该语义；生成结果已通过 MSVC 真实编译，exe 启动 3 秒后仍存活并由受控进程服务正常停止。

- 已完成（2026-07-24）：解决方案资源管理器的项目右键菜单新增“添加资源…”，项目节点同步新增“图片资源 (assets)”筛选组，自动枚举项目内全部受支持图片并在导入后刷新；单击图片项会打开真实资源预览，显示透明背景、图片尺寸、文件大小及加载失败状态，右键可通过 `workbench.action.project.copyImageResourcePath` 复制 `assets/...` 相对路径。添加入口注册为 `workbench.action.project.addImageResource` 工作台命令，调用 Electron 图片选择器并复用 `DesignerAssetService`，按目标项目自动复制到 `assets/` 或 `assets/<projectId>/`；取消不产生写入，进行中、成功和失败均提供中文状态反馈。

- 已完成（2026-07-24）：普通 Win32 图片框新增确定性运行时图片命令 `控件_设置图片(控件名, 图片路径)`，并为真实 Image 控件提供 `图片框1.设置图片(图片路径)` 方法补全与语法映射。命令复用 WIC、图片框尺寸和设计器 `stretch` 填充方式，替换时释放旧位图，空路径清空图片；项目内 `assets/...` 相对路径会随现有 F5/导出资源复制链路进入 exe 目录，文件对话框返回的本地完整路径也可直接加载。

- 已完成（2026-07-24）：Win32 高级控件模块从新增工具箱入口移除固定外观的 `Upload` / `DragUpload`，改为 `FileDialog` 设计控件。文件对话框不生成运行时视觉控件，但会像普通控件一样在设计器窗口画布内显示可拖拽占位，单击后独立显示属性面板，并在事件面板提供文件已选择、文件被拖入和选择被取消事件，不再放入“项目 / 非可视组件”集合。选中普通控件时会立即解除文件对话框选中状态。同一文件对话框可同时绑定按钮打开触发器和图片框拖放目标；选择拖放目标会自动启用拖放，拖入或通过按钮选择图片后会将第一张有效图片刷新到绑定图片框。统一支持 `IFileOpenDialog`、`WM_DROPFILES` 及 `文件对话框_打开/清空/取文件数量/取文件` bindings。旧项目上传控件继续兼容生成并输出迁移诊断，不静默删除用户布局。
- 已完成（2026-07-24）：文件对话框筛选属性改为友好的“文件类型”编辑器，提供所有文件、图片、文档、音频、视频、压缩包预设；自定义模式只需填类型名称和逗号分隔的扩展名。Win32 `名称|*.ext;*.ext` 原始格式仅保留在折叠的高级选项中供兼容和排错。

- 已完成（2026-07-24）：窗口“窗口图标”新增自定义 ICO 选项。选择器会把图标安全复制到当前项目 `assets/` 并仅持久化工作区相对路径；设计器标题栏实时预览，LingCpp F5/导出、旧原生 Win32、new_emoji 和 AI Bridge/Visual Studio 资源复制链路共同消费同一模型，运行时分别加载系统大、小图标尺寸。

- 已修复（2026-09-15）：new_emoji 后端窗口设置了自定义/内置图标后只有任务栏显示、自绘标题栏不显示。根因是生成模板用裸 `LoadImageW` + `WM_SETICON` 注入图标，而 new_emoji 自绘标题栏的图标来自其内部 `WindowState`，只能由 `EU_SetWindowIcon` 填充（该函数同时完成 WM_SETICON 与标题栏重绘）。生成模板已改为直接调 `EU_SetWindowIcon`（UTF-8 路径），删除本地 HICON 与 `DestroyIcon` 清理（图标归 new_emoji 运行时所有）；`none`/`system` 样式行为不变。涉及 `generateNewEmojiMainCpp` 的 `iconSetup` 模板与 `tests/windowDesigner.test.ts` 对应断言。

- 已修复（2026-07-24）：窗口菜单栏“背景颜色”不再只停留在虚拟属性控件中；颜色现在进入窗口项目模型、设计器预览以及 LingCpp F5/导出和旧原生 Win32 生成链路。下拉菜单使用背景刷，顶层非客户区菜单栏额外使用 owner-draw 与非客户区重绘，避免 Windows 主题忽略 `MIM_BACKGROUND` 后继续显示系统白底；旧项目确定性迁移为系统白色背景。
- 已修复（2026-07-24）：窗口菜单栏“文字颜色”进入独立 `menuForeground` 窗口模型字段，设计器顶栏与下拉预览、LingCpp F5/导出和旧原生 Win32 生成链路共用该颜色；顶层菜单及下拉菜单项统一 owner-draw，不再固定使用系统 `COLOR_MENUTEXT`，旧项目默认迁移为黑色文字。
- 已修复（2026-07-24）：自绘窗口菜单栏不再在底部残留 Windows 系统白色分隔线；非客户区绘制范围从 `MENUBARINFO.rcBar` 精确延伸到 `ClientToScreen` 得到的客户区顶部，覆盖菜单主体与系统分隔边且不侵入客户区控件。
- 已修复（2026-07-24）：窗口菜单栏首次显示与鼠标悬停时不再切换字体。首次非客户区补绘和 `WM_DRAWITEM` 状态重绘现在显式选择同一个菜单字体；菜单字体名称、字号、粗体、斜体、下划线也从虚拟属性控件进入窗口模型、设计器预览及两条 Win32 生成链路。

- 已完成（2026-07-24）：窗口设计器“布局内容”树支持 Ctrl 切换多选、Shift 连续选择和整组选区拖拽换父级；批量移动在服务层原子校验循环关系，保留选区内部父子结构与相对位置，并为合法/非法落点提供颜色和文字反馈。
- 已修复（2026-07-24）：布局树中的选项卡页面节点拥有独立展开状态和可键盘聚焦的折叠按钮；折叠页面只隐藏其树形子节点，不切换设计器当前页，Shift 连选排除已折叠节点，向页面拖入控件后自动展开显示结果。
- 已完成（2026-07-24）：窗口菜单栏的“显示内容”不再在狭窄属性栏中直接编辑逗号文本，改为与 ListView 集合编辑一致的独立菜单项弹窗；支持新增、复制、排序、删除、取消和保存，并通过独立模型在保存时序列化回旧的逗号格式，保持旧项目持久化和 C++ 生成链路兼容。
- 已修复（2026-07-24）：LingCpp 算术表达式中的嵌套中文运行时调用会继续递归翻译参数，`控件_取数值(控件名)+10` / `-10` 会把裸 controlRef 确定性转换为后端所需表示，从而消除 MSVC `const char[]` 无法转换为 `const wchar_t*` 的 C2664 编译阻断。

- 已修复（2026-07-24）：MSVC 构建与 AI Bridge 构建不再把中文 Windows 代码页输出直接按 UTF-8 解码；编译子进程统一保留原始字节，严格识别 UTF-8 后安全回退 GB18030，中文路径、函数名和诊断信息不再显示为 `��`。LingCpp `调试输出` 同时升级为可变参数命令，可用英文逗号传入任意数量的文本、整数、逻辑值等参数，运行时按 `, ` 连接后输出。

- 已修复（2026-07-24）：`.lcpp` 新手正文补全目录补齐逻辑字面量，“真”支持 `z` / `zhen` / `true` 精确检索，“假”支持 `j` / `jia` / `false` 精确检索；在控件布尔参数中输入单字母时会直接出现对应逻辑值，不再只显示无关命令或控件模糊候选。字面量目录与过滤排序已拆到可测试 LingCpp service。

- 已修复（2026-07-24）：`.lcpp` 新手控件补全补齐运行时可变属性命令。TabControl 新增 `选项卡_设置隐藏表头/取隐藏表头` 模块贡献与 binding，`选项卡1.` 会提示“设置隐藏表头、取隐藏表头”，F5/导出运行时会同步重排标签页承载区并可恢复表头；同时补齐 TreeView“清空项目”和 Upload/DragUpload“取文件数量、取文件”候选。已审计全部控件注册属性：当前仅把具备确定性运行时实现的文本、启用、可见、勾选、数值、选择、集合与隐藏表头能力暴露为命令；列/节点/标签页结构、创建样式等设计期属性不生成假命令。

- 已修复（2026-07-24）：`.lcpp` 新手模式的设计器控件补全不再只提供“内容”和少数“设置选择项”。补全服务会按统一 Win32 控件注册表列出每个真实控件的全部注册事件（含尚未绑定事件），并按控件类型提供可确定性生成 C++ 的通用、选择、数值、勾选、集合及 ListView/TreeView/TabControl/Upload 专属命令；选项卡现在包含“标签页被改变事件、设置/取选择项、添加页、清空项目”等候选。全控件注册表覆盖已加入 LingCpp 自动化测试。

- 已完成（2026-07-24）：全部设计器控件的通用外观模型新增字体名称、粗体、斜体和下划线字段；字体名称通过固定安全列表下拉选择，旧项目确定性迁移为 `Microsoft YaHei UI` 常规字体。设计器预览、普通 Win32 F5/导出和旧原生导出共用字段，Win32 通过 `CreateFontW` 完整应用；new_emoji 桥接应用字体名称与字号，并对 DLL 暂不支持的通用粗体/斜体/下划线生成明确诊断。

- 已完成（2026-07-24）：树形视图“编辑 TreeView 节点”的节点属性新增“默认展开节点”开关，节点模型以 `expanded` 布尔字段持久化，旧项目默认折叠。设计器预览与 LingCpp Win32 F5/导出共用该语义，原生生成会在全部节点插入后恢复展开状态。

- 已修复（2026-07-24）：Win32 选项卡自绘不再在未选中标签左侧绘制竖向分隔线，消除其显示在前一标签右侧的白色竖线；标签背景、悬停反馈、文字和选中橙色底边保持不变。F5 与导出 C++ 共用同一生成规则。

- 已完成（2026-07-24）：图片框“图片源”属性新增 Electron 原生图片选择器。用户选择的 PNG/JPEG/BMP/GIF/TIFF 会由独立 `DesignerAssetService` 校验并复制到当前项目 `assets/`（多项目为 `assets/<projectId>/`），设计器模型只保存工作区相对路径；设计器通过受控资源接口预览，F5、普通导出、解决方案构建和 AI Bridge `native.export` / `build.run` 会同步复制资源，Visual Studio 工程通过 post-build 将图片带到 exe 输出目录。网络 URL 仍仅用于设计器预览，不作为离线原生资源下载。

- 已修复（2026-07-24）：Win32 owner-draw 复选框和单选框的 `transparent` 背景不再回退并填充窗口背景色；运行时会解析实际标签页、分组框或普通父容器背景，透明父容器继续向上递归解析，显式背景色仍保持控件自身颜色。F5 与导出 C++ 共用同一生成规则。
- 已修复（2026-07-24）：Win32 选项卡表头在 150% 等高 DPI 下不再因原生自动宽度与自绘内边距不一致而把完整中文标题提前画成省略号。生成运行时现在先应用 DPI 内边距，再使用同一字体、图标尺寸和绘制边距测量标题，通过原生最小标签宽度保留完整文字；运行时新增标签页和 `WM_DPICHANGED` 重建均复用同一计算，同时继续保留真实空间不足时的安全省略。
- 已修复（2026-07-24）：窗口设计器画布按父子层级稳定安排控件绘制顺序，父容器始终先于后代绘制；选项卡 A 作为选项卡 B 的子控件时，不再因项目数组中 A 排在 B 前面而被 B 的页面背景覆盖。同层控件继续保留原始顺序，不改变既有兄弟控件叠放关系。
- 已修复（2026-07-24）：新手代码编辑器不再一概禁止括号内部的智能补全；在 `选项卡1.设置选择项(dzs` 等函数/控件方法参数表达式中会继续按统一补全目录匹配 `到整数`，同时仍禁止在字符串和注释中误弹普通命令候选。补全上下文扫描已从 React 组件拆到可测试的 LingCpp 服务。
- 已完成（2026-07-23）：当前设计器窗口的稳定控件中文名称进入 LingCpp 统一符号补全，新手编辑器与 Monaco 可用拼音首字母（如 `bjk`）命中 `编辑框_表头`，并提供 `编辑框_表头.内容` 候选。`.内容`/`.文字` 已成为确定性控件文本读写语法：表达式读取映射到 `控件_取文本`，赋值映射到 `控件_设置文本`，可嵌套用于 `到整数(编辑框_表头.内容)`；类型兼容的选择控件还支持并补全 `选项卡1.设置选择项(到整数(编辑框_表头.内容))`，确定性映射到底层控件命令，F5 与导出 C++ 行为一致。
- 已修复（2026-07-23）：LingCpp 所有补全项统一生成中文全拼、拼音首字母和保留 `_` 分段的混合检索键；新手代码编辑器与 Monaco 现在都可用 `kj`、`kongjian`、`控件_sz` 等输入命中 `控件_设置选择项`，并可用 `dzs` 命中新增的确定性 `到整数(文本)` 基础命令，不再要求模块清单或 React 组件逐条手写拼音别名。
- 已完成（2026-07-23）：选项卡控件属性面板新增“隐藏表头”开关，默认关闭并兼容旧项目。开启后设计器隐藏标签栏、页面内容扩展到整个控件区域，新建或移入的子控件不再预留标签栏高度；LingCpp Win32 F5/导出通过同一持久化字段隐藏原生标签栏并使用完整客户区承载当前页。
- 已修复（2026-07-23）：选项卡控件的“文字颜色”和“背景颜色”现在会实时进入设计器标签头、非选中标签和页面区域；LingCpp Win32 F5/导出使用完整自绘标签栏与页面承载层消费同一颜色字段，并保留透明背景时的系统浅色兼容语义。标签栏不再残留系统白底或高对比方框，改为统一背景、低对比分隔、悬停反馈和 LingBuilder 橙色选中底边；标题增加横向内边距，仅在真实空间不足时省略。标签页图像列表继续绘制，宽度计算避免混用 Win32 `LONG` 与 `int`。
- 已修复（2026-07-23）：Win32 生成运行时为控件查找补齐 const 重载；透明标签解析父容器画刷时不再从 const 成员函数调用非 const `FindRuntimeControl`，消除 Visual Studio C2662 编译阻断，并保留运行时状态的只读约束。
- 已修复（2026-07-23）：分组框在 LingBuilder 完整自绘后不再继续使用会参与系统主题重绘的 `BUTTON + BS_GROUPBOX`，改为带 `WS_EX_CONTROLPARENT` 的 `STATIC` 子控件容器，并保留子控件消息转发；消除分组框底边在后续重绘中向下延伸的单像素边框残影。非编辑组合框收起态同时继续按设计器 `height` 建立 GDI 裁剪区，隐藏下拉区域不会参与绘制。
- 已修复（2026-07-23）：ListBox 切换为自绘滚动条后不再依赖已移除的系统 `WS_VSCROLL` 处理鼠标滚轮；原生运行时按系统滚轮行数设置维护高精度滚轮余量并确定性更新 `LB_SETTOPINDEX`。拖动滑块抵达顶部/底部后，相同顶部索引不会再重复触发布局和选中项重绘，消除首个选中表项持续闪烁。
- 已修复（2026-07-23）：标签控件的 `transparent` 背景在 LingCpp Win32 生成链路中保留为明确的透明语义；原生 `WM_CTLCOLORSTATIC` 绘制使用 `TRANSPARENT` 背景模式，并根据实际父级选择标签页系统窗口画刷、普通父容器画刷或主窗口画刷，不再把标签页内透明标签错误填充为主窗口深色背景。
- 已完成（2026-07-23）：ListView 新增“边框颜色”“边框粗细”“表头高度”“表项高度”专属属性，设计器预览、项目持久化和 LingCpp Win32 F5/导出共用相同字段。原生运行时使用独立边框承载层绘制可配置边框，通过 Header `HDM_LAYOUT` 调整表头高度，并使用控件专属小图像列表稳定控制报告/列表模式表项高度；不会重新回退到系统立体边框和固定行高。
- 已修复（2026-07-23）：树形视图设计器由通用占位块改为按节点、连接线和复选框属性实时预览；LingCpp Win32 运行时显式应用控件背景色、文字色和连接线色，透明背景按既有暗色回退处理，不再出现设计器暗色而 F5 运行窗口为系统白底的问题。
- 已完成（2026-07-23）：树形视图“节点集合”由狭窄属性栏内的递归表单升级为专用管理弹窗；属性栏仅显示节点数量摘要。弹窗支持新增根节点/子节点、编辑唯一 ID 与标题、复制或删除整棵子树、同级上下排序和通过父节点下拉框调整层级，修改实时进入设计画布、项目持久化及 Win32 生成链路。
- 已完成（2026-07-23）：树形视图新增“边框线粗细”“边框线颜色”“节点间距”“节点内间距”外观属性。设计器按字段实时渲染边框和节点布局；Win32 运行时以独立边框承载层替代系统固定 `WS_EX_CLIENTEDGE`，通过 TreeView 项目高度、层级缩进及水平内容留白应用节点间距和内间距，并继续保留通知事件转发。

## 2026-07 状态记录

- 已完成：新增工作区根目录可见的 `.lbsln` LingBuilder 解决方案入口，旧工作区首次加载时自动迁移生成；入口摘要与 `.lingbuilder/solution.json` 内部完整状态同步更新。Electron 已注册 `.lbsln` 文件关联，并支持双击、拖入、命令行和原生打开对话框加载；Visual Studio 导出 `.sln` 继续保持独立格式。

- 已修复：设计器暗色按钮、复选框、单选框和进度条的颜色属性进入 LingCpp Win32 原生绘制链路；未配置菜单的窗口不再注入演示菜单；进度条显示值与结构化值保持同步。F5/生成运行窗口会覆盖 IDE 完成回调的短时间保持前置，随后自动恢复普通层级；编译输出与设计器日志在连续追加后于布局完成时自动滚动到最新记录。

- 已完成：新增真正的 `CommandService`、上下文 `when`/禁用状态、中文标题与英文 alias、快捷键冲突诊断和全局键盘路由；工作台命令面板支持搜索、键盘导航、焦点恢复、空状态和执行失败状态，工具菜单及常驻按钮均可打开。
- 已完成：新增用户/工作区 `ConfigurationService` 与设置页，落实“工作区 > 用户 > 默认值”优先级、schema 校验、旧 JSON/localStorage 迁移、损坏文件诊断和作用域独立持久化；字号、体验模式、主题、面板可见性及快捷键覆盖均连接真实工作台状态。编辑体验切换/重置受草稿提交守卫保护，快捷键拒绝裸输入键和默认/自定义冲突，未保存快捷键在关闭或切换作用域前确认。
- 已完成：项目文本读写统一接入 `TextFileService`，支持 UTF-8、UTF-8 BOM、UTF-16 LE/BE 和 LF/CRLF 检测、显式转换及字节往返；状态栏可修改活动文件格式并进入脏状态，保存、F5 前保存与 AI Bridge `edit.apply` 均保留所选格式。Diff 的编辑/并排/内联三种模式已有可见入口和命令面板命令，中间插入/删除、CRLF/LF 与末尾换行已纳入回归测试。
- 已完成：新增全工作区内容搜索与替换服务、工作台对话框和 `Ctrl+Shift+F` / `Ctrl+Shift+H` 命令，覆盖纯文本/正则、大小写、文件/项目/工作区范围、结果分组勾选和精确行列跳转。替换以“磁盘查询快照 -> 预览 -> 哈希复检 -> 原子应用 -> LIFO 可撤销事务”执行，脏编辑器必须先保存并重新搜索；应用/回滚中途失败或落盘后校验失败都会恢复一致状态，并保留原编码、BOM、换行和最终字节。正则安全拒绝灾难性回溯/反向引用/指数可选链；查询、预览、全缓存和事务数量均有硬上限，公共长行预览与行列换算保持线性有界。
- 已完成：新增会话级 `TextModelService`、本地 Monaco 模型适配器和每文件结构编辑历史，稳定隔离工作区/项目/文件及专业/新手/原生表面的光标、滚动和正反向选区；重命名保留模型关联，删除同时释放原生预览子模型。`.lcpp` 的新手正文与专业 Monaco 共用一条每文件规范撤销时间线，Monaco 普通输入及分组撤销/重做事件同步到同一快照序列，首次进入专业和跨模式连续撤销/重做均不依赖第二套回退栈；非 `.lcpp` 文件保留 Monaco 原生历史。项目文件权威载入前统一禁止保存、F5、文件变更、AI 应用和工作区替换；请求具备超时、取消、中文错误与重试，空响应不会把旧文件挂到新项目，异步写回以“项目 ID + 载入代次”拒绝切换或重载后的旧响应。Monaco 核心、worker 和 C++/INI 基础语言包完全本地化并加入构建产物校验。
- 已完成：F04 使用 SHA-256 磁盘版本令牌、`fs.watch` SSE 监听、冲突保留/重载策略、配置化自动保存、`.lingbuilder/recovery` 热退出恢复和临时文件原子替换/批量回滚完成外部文件同步闭环。
- 已修复（2026-07-26）：项目首次载入、保存响应和冲突响应中的 SHA-256 版本令牌统一直接读取磁盘原始字节，不再根据解码后的文本与推断格式重新编码。含混合 LF/CRLF 的外部源码或 `.lcpppkg` 导入源码不会在尚未发生外部修改时误报“项目文件冲突”；真正保存时仍按 `TextFileService` 选定格式规范化落盘。
- 后续建议：E01 的搜索哈希只保护一次查询/替换事务，不替代 F04 的持续磁盘监听；后续仍需在外部修改发生时主动提示、对比或重载，而不是等到用户应用替换时才发现冲突。
- 后续建议：F05 只保证当前 renderer 会话内的模型与历史；跨重启未保存恢复、磁盘外部冲突、自动保存和热退出仍归 F04，必须基于版本令牌与恢复文件实现，不能复用内存撤销栈冒充持久化恢复。
- 已完成（2026-07-27）：设计器右键菜单、复制/剪切/粘贴、创建副本、布局、排列、锁定和父子层级操作已注册为带设计器上下文的命令贡献。新增通用 `MenuService`、版本化系统剪贴板和 `DesignerContainerLayoutRegistry`；粘贴会对目标父容器生成并验证原子布局计划，支持 Tab 插槽、ReBar 带区、绝对/Flow/Stack/Grid/Dock/Slots/Single 布局和跨项目依赖预览。模块可声明菜单及容器布局，隔离插件通过 `designer.read/write` 提交受控、可撤销的原子编辑。
- 已完成：项目文件重命名/删除改为真实服务端磁盘操作，统一限制在当前项目 `sourceRoot` / `configRoot` 和工作区真实路径内，拒绝越界、符号链接、目录、目标冲突；工作台会串行提交新手草稿并同步标签页/活动文件状态，不再只改 React 内存。
- 已完成：F5 和 AI Bridge `build.run` 启动的原生 exe 改由 `ManagedProcessService` 按 `projectId` 持有进程句柄；重新生成会在写入/编译固定 exe 前等待旧进程与日志流收尾，避免 Windows 文件锁导致链接失败。IDE 内嵌 AI Bridge 与 F5 共享项目构建租约，外部 CLI 使用独立租约；同项目并发会被拒绝。Shift+F5 可取消在途生成并停止全部受控进程，服务/CLI/MCP 退出会等待在途租约并最终回收登记进程，不再遗留 detached 预览进程或发生“停止后迟到启动”。
- 已完成：“环境检查”改为真实只读探测 Node.js、MSVC/vswhere/vcvars、Windows SDK `rc.exe`、CMake、g++、clang++、WebView2 和 Windows 平台，并通过 `/api/environment/check` 返回中文明细与缺失警告，不再输出固定成功日志。Windows 上的 CMake 探测覆盖 PATH、标准独立安装目录及 `vswhere -find` 返回的 Visual Studio 内置 CMake，避免 VS 已安装 CMake 但未加入 PATH 时误报缺失。g++ 与 clang++ 作为可选替代编译器仍显示检测明细，但单独缺失时不再进入警告区；只有所有 C++ 编译器均缺失时才报告编译器警告。
- 已完成：新增“环境修复中心”服务、受控 API、工具菜单/命令入口和暗亮主题响应式对话框；只允许从固定微软 HTTPS 地址下载并以固定参数安装 `Microsoft.VisualStudio.Workload.VCTools` 或 WebView2，具备显式确认、并发拒绝、下载/安装/成功/失败状态和完成后复检。Windows NSIS 安装包会冻结并校验 WebView2 Evergreen Bootstrapper，缺失时补装；发布准备优先复用本地已下载且通过 Microsoft Authenticode 校验的 Bootstrapper。离线开发环境包结构、layout、哈希、签名与验收方案记录在 `LINGBUILDER_OFFLINE_ENVIRONMENT_PACKAGE.md`。
- 已完成（2026-08-02）：Electron 安装包增加显式云端发布模式。`online` 继续强制公网 HTTPS `LINGBUILDER_CLOUD_API_URL`；`offline` 在域名、备案或服务器未就绪时生成不连接云端的安装版，保留本地 IDE 与自定义 API，不使用虚假公网地址，也不回退到用户本机服务。
- 已完成：上述三项新增独立服务测试和 renderer server API 集成测试，并纳入 `npm run test:lingcpp` 全量门禁；完成度与验收证据统一记录在根目录 `IDE_FEATURE_COMPLETION.md`。

- 已完成：建立统一 Win32 控件注册表，窗口设计器项目升级到 schemaVersion 2 并兼容迁移旧 `content` 数据；基础与高级控件模块、工具箱、专属属性、事件和 C++ 原生适配器共享同一份定义。
- 已完成：新增 `lingbuilder.win32.common-controls`，覆盖微软标准 Common Controls、RichEdit、非可视 ImageList/ToolTip/PropertySheet 贡献和系统文件、目录、颜色、字体、查找替换、打印、页面设置、任务对话框 bindings。
- 已完成：LingCpp Win32 生成运行时支持多事件表、WM_COMMAND/WM_NOTIFY/滚动通知、真实父子 HWND、集合数据、范围/选中/样式属性，并通过全控件 MSVC Win32 编译及 3 秒存活冒烟。
- 已完成：窗口设计器接入项目模块变更事件，启用或禁用 Win32 高级控件模块后工具箱会实时解除或恢复灰色状态，无需重新加载 IDE。
- 已完成：属性面板已为列、ListView 行、树节点、标签页、工具栏按钮、状态栏分区、Rebar 带区提供结构化增删、排序和嵌套编辑；ImageList 提供项目资源编辑器、控件引用下拉框与安全相对路径诊断，不再要求手写数组 JSON。
- 已完成：ListView 设计器画布新增专用实时预览，列集合、行项目、详细/列表/大小图标模式、网格线、字体与启用状态会随属性面板即时更新；预览模型与 Win32 生成器采用同一列/行字段语义。
- 已完成（2026-07-23）：窗口标题栏背景、标题文字、DWM 圆角和窗口图标成为可持久化外观字段，旧项目确定性迁移；设计器画布与 F5/导出 Win32 共用字段。生成器动态调用 DWM 应用抗锯齿圆角，不支持 DWM 圆角的旧系统直接保持干净系统边框，不再使用会产生阶梯锯齿的 `SetWindowRgn` 伪圆角；内置图标同时设置大/小 HICON。ListView 透明预览统一解析为 `#0F172A`，原生运行时设置背景、文字背景、文字颜色并自绘所有真实列头及末列后的空白表头区域，消除设计器暗色而运行白色的问题。
- 已完成：ListView 属性面板不再要求手写 Tab 分隔字符串或内部行 ID；列集合与行项目改为数量摘要和专用表格编辑窗口，支持逐格输入、新增/复制/删除/排序、逐列左/中/右对齐、列与行数据联动、Excel/CSV/TSV 多行多列粘贴、批量替换/追加及窄屏卡片布局，所有修改继续实时进入设计画布和持久化模型；第一列的居中/右对齐通过 Win32 官方建议的临时占位列插入与删除流程实现。
- 已完成：ToolTip 作为独立附加行为资源绑定目标控件，每个资源使用独立原生 tooltip HWND 和显示延迟；PropertySheet 作为非画布顶层资源提供页面编辑、`属性页_显示` 命令和 Applied 中文事件派发，并完成真实 `#32770` 窗口创建/确定运行测试。
- 已完成：`.lcpp` 通过基础/高级模块 bindings 提供通用控件文本、启用、可见、勾选、数值、选择和集合操作，以及 ListView 行、TreeView 节点、Tab 页面操作；MSVC 运行测试会直接读取 HWND 状态验证中文代码产生真实变化。
- 已完成：PropertySheet 页面可引用普通设计器窗口作为控件模板，复用该窗口的全部标准控件、专属属性、父子 HWND 和事件类；真实运行测试已在 `#32770` 页面中确认 Label、CheckBox、ListView 及列表数据创建成功。
- 已完成：逐控件运行时消息、PropertySheet 20 轮重复创建销毁资源泄漏和桌面/窄屏设计器布局验收；1440×900 与 768×900 均无页面级横向溢出，工具箱和属性区不重叠，Win32 基础控件与高级控件全量闭环。
- 后续建议：补充可用环境中的自动化 UI 截图基线与 HWND 句柄泄漏压力测试；当前验证覆盖注册一致性、v1→v2 迁移、生成文本、真实 MSVC 编译和进程 3 秒存活。本机 Windows.Graphics.Capture 对临时验证窗口返回“不支持此接口”，因此本次未形成截图基线。

- 已完成：`.lcpp` 成为默认中文源码格式，Electron 原型默认主文件为 `src/游戏主窗体.lcpp`。
- 已完成：Monaco 识别 `lingcpp`，窗口设计器与构建链路默认读取 `.lcpp` 作为主源码输入。
- 已完成：设计器项目持久化落到 `.lingbuilder/window-designer.json`，可复制生成结果输出到 `generated/cpp/`，`.lingbuilder-build/` 继续只作为临时构建目录。
- 已完成：新增本地 Git 状态读取接口 `/api/source-control/status`，并新增预览优先的 AI 编辑提案接口 `/api/lingcpp/edit/*`。
- 已完成：`.lcpp` AI 编辑提案改为模型驱动的完整文件重写 + 本地最小 WorkspaceEdit diff 计算；Gemini 不可用时自动降级到本地安全提案。
- 已完成：补充 `electron/tests/lingcpp.test.ts`，覆盖 parser、generator 和 WorkspaceEdit diff 回归验证，并提供 `npm run test:lingcpp`。
- 已完成：AI 编辑提案扩展为多文件工作区提案，支持同时预览/应用 `.lcpp`、配置文件等多个真实工作区文件。
- 已完成：生成器回归测试扩展到复选框、单选框、进度条、下拉框、窗体创建事件、暂不支持语法安全注释和多文件 WorkspaceEdit。
- 已完成：模块构建链路开始支持外部 C++ 模块依赖复制，`new_emoji` 可通过 `.lbmod` 安装并在 F5 Win32 预览中复制 DLL/lib/header/source。
- 已完成：新增 AI Bridge CLI 与本地 `/api/ai-bridge/*` 接口，支持 token 鉴权、`readonly` / `preview` / `yolo` 权限模式、受控文件读取搜索、LingCpp 诊断、编辑提案应用、模块上下文、C++ 预览/导出和 MCP stdio 工具映射。
- 已完成（2026-08-04）：新增独立 C++ Win32 `tools/codex-configurator` 新手配置器。不启动 IDE 即可选择工作区和 `readonly` / `preview` / `yolo` 权限，一键生成项目级无 Token `--mcp --stdio-only` 配置；运行时自动识别开发版 Electron/CLI 与安装版 `resources/app.asar`，保留其它 TOML，冲突需要确认，支持原子写入、移除托管段和 `--headless`。后续可将签名安装包和配置器更新检查接入正式发布流程，但不得把配置器扩展成任意命令执行器。
- 已完成（2026-08-03）：补齐外部 AI 直接起步项目的受控闭环。`SolutionService` 提供 `blank-window` / `hello-window` 模板和纯预览计划；`ProjectCreationService` 在确认后以统一项目文件事务创建解决方案项目、中文 `.lcpp`、设计器模型、项目全局变量/数据类型、配置和模块引用，并生成带 SHA-256 快照的撤销凭据。AI Bridge REST/MCP 与 CLI 共用同一服务，支持模板查询、预览/批准创建、模块依赖计划、受控工作台导航和未被修改项目的安全撤销；renderer 通过工作区 SSE 刷新解决方案、保存当前草稿并打开新项目主文件。后续应继续补充跨重启导航请求清理、项目创建恢复日志、完整 HTTP/SSE 集成测试和正式 `TaskService` 任务编排，不能把 AI 客户端临时文件状态当作项目持久化。
- 已完成（2026-08-04）：无 IDE CLI 编程流程改为上下文优先、一次批准、源码与设计器 JSON 同步、诊断后原生预览再构建；MCP 工具描述明确区分 `result.project` 与 `result.designerProject`，并公开多文件提案的 `workspaceFiles` 与诊断的 `designerProject` 参数。后续继续补充跨客户端的 MCP 集成测试和更细粒度的设计器结构化编辑能力，不能退回只修改聊天中的 `.lcpp` 片段。
- 已完成：原生导出和 F5/AI Bridge 构建运行会同步生成 Visual Studio Win32 工程文件（`.sln`、`.vcxproj`、`.vcxproj.filters`），并把模块 include/lib/source/runtime 依赖写入 VS 工程。
- 已完成：修复 `new_emoji` 桥接层 UTF-8 转换缓冲区少分配 1 字节，以及临时 UTF-8 指针被 DLL 后续读取的问题，避免 Visual Studio Debug 运行时报 `HEAP CORRUPTION DETECTED` 或读取 `0xDDDDDDDD` 访问冲突。
- 已完成：修复 `.lcpp` 解析器把事件/方法块结尾 `结束` 误翻译为运行时 `结束();` 的问题；显式退出命令应写作 `结束()`。
- 已完成：模块生态升级到 schemaVersion 2，C++ 依赖改为 `targets[]`，中文命令到 C++ 的生成改为 `bindings.commands[]`，并新增模块 SDK/CLI、模块开发者中心 API、根目录 `模块开发手册.md`。
- 已完成：`new_emoji` 模块生成脚本升级为 v2 manifest，包含 Win32/x64 targets、`NE_` 桥接命令 binding、底层 API 文档和重新打包安装入口。
- 已完成（2026-08-03）：`lingbuilder.websocket.client@2.0.0` 从 5 条窗口级同步原型升级为 51 条受管命令和稳定 `WebSocket连接` 类型。独立 WinHTTP 运行时支持多连接、后台握手/接收、`ws://`/`wss://`、文本/二进制、Origin/子协议/请求头、代理、HTTP Basic 凭据、系统证书验证、自签名策略、SHA-256 证书固定、资源限制、指数退避重连、事件快照和统计；普通 Win32/New_Emoji 复用运行时并回到 UI 线程。Win32/x64 与 New_Emoji x64 已完成真实 MSVC 编译及本地断线重连协议 smoke。当前边界：WinHTTP 自动处理 Ping/Pong但不公开主动 Ping；生产凭据需接系统凭据存储，正式上线仍需按目标代理、证书轮换和网络故障模型压测。
- 已完成：新增内置 `HTTP 服务端模块`（`lingbuilder.http.server`）和 `WebSocket 服务端模块`（`lingbuilder.websocket.server`）；Windows/MSVC 生成链路链接所需的 Winsock/系统库。
- 已完成（2026-08-03）：`lingbuilder.http.server@2.0.0` 从 5 条同步单连接原型升级为 48 条受管命令和 2 个公开类型。后台 accept、1–64 工作线程与有界连接队列支持 IPv4/IPv6、动态端口、HTTP/1.0/1.1、keep-alive、Content-Length/chunked、路由、请求读取、文本/JSON/二进制/文件/Cookie/重定向响应、资源限制和统计；默认监听门禁校验解析后的实际回环地址，请求目标拒绝非法百分号编码和非法 UTF-8 解码结果；请求回到普通 Win32/New_Emoji UI 线程，Win32/x64 与 New_Emoji x64 已完成真实 MSVC 编译和协议 smoke。当前边界：嵌入式 HTTP/1.1，不内置 TLS/HTTP2/认证；公网 HTTPS 由网关提供，正式上线仍需按真实负载压测。
- 已完成（2026-08-03）：`lingbuilder.websocket.server@2.0.0` 从 6 条同步单连接原型升级为 50 条受管命令和 2 个公开类型。后台 `WSAPoll` reactor 支持多客户端、文本/二进制、分片、UTF-8、Ping/Pong、关闭握手、Origin/路径/子协议、资源限制、有界发送队列和统计；事件回到普通 Win32/New_Emoji UI 线程，Win32/x64 与 New_Emoji x64 已完成真实 MSVC 编译和协议 smoke。当前明确边界：只提供 `ws://`，公网 TLS 由网关终止；单 reactor 面向桌面和中等并发，正式大规模部署仍需按真实负载压测。
- 已完成：Electron 安装版改为由主进程管理独立本地服务进程，服务只监听 `127.0.0.1` 随机端口，renderer 请求由桌面宿主注入随机会话 token；安装版不再直接 `loadFile`，退出和工作区切换会终止旧服务。
- 已完成：IDE 内嵌 AI Bridge 默认关闭，外部 AI 继续通过 `lingbuilder ai-server` 显式启动；HTTP 只接受独立 Bearer token，工作区访问统一使用 realpath/符号链接策略并补齐拒绝审计。
- 已完成：安装版首次运行只补充复制“文档/LingBuilder/示例工作区”的缺失文件，保留用户修改，并在 `userData/workspace-state.json` 恢复最近工作区。
- 已完成：新手编辑器建立 flush/save/build 事务；`Ctrl+S`、F5、保存并退出及文件/项目/模式切换都会先提交未失焦草稿，保存失败不会构建或关闭，保存与构建互斥。
- 已完成：模块页按当前活动 `projectId` 隔离状态；Win32 原生依赖不再回退到 `targets[0]`，模块包预览/校验/打包会验证所有声明文件存在，`new_emoji` 高层命令补全与 binding 参数数量一致。
- 已完成：窗口设计器新增“布局内容”组件层级树，窗口、菜单栏、菜单项和普通控件可展开查看；控件模型支持可持久化 `parentId`，可通过网格容器组织父子组件，并对无效父级和循环层级安全降级。层级树支持把控件拖到窗口根节点或其他容器节点来更换父级，非法目标、非容器目标及循环嵌套会被拒绝。
- 已完成（2026-07-23）：窗口设计器父子控件采用完整容器语义；拖动、方向键微调或属性坐标修改父容器时全部后代保持相对位置同步平移，父级不可见或禁用时后代继承有效状态。设计器预览、Win32 F5/导出与 new_emoji 生成链路使用同一状态计算，不再把隐藏父级的可见子控件回退成窗口根控件。
- 后续建议：继续增强模块 v2 跨平台 target 的真实构建能力，包括 CMake、Linux/macOS、x64 F5 选择和第三方远程市场上传审核服务。官方收费模块的受保护下载、Ed25519/SHA-256 校验及安装更新闭环已落地。
- 后续建议：继续把 AI 编辑扩展到语义级 range 规划、跨模块依赖分析和更细粒度的审查提示。
- 后续建议：AI Bridge 的 `build.run` 已复用受控生成、编译和 `ManagedProcessService` 运行链路，但仍未开放任意 shell；后续应接入正式 `TaskService`，进一步提供编译子进程即时取消、结构化问题面板跳转和实时日志流。
- 后续建议：继续扩展 LingCpp Parser/IR 覆盖面，把变量赋值、控件属性读写、字符串拼接、窗口打开/关闭等中文语法纳入生成器。
- 已完成（2026-07-24）：new_emoji 设计后端新增“上传组件”和“拖拽上传组件”，模块清单现贡献 11 类 `designerControls`。上传标题、提示、初始文件、多选、自动上传、7 种样式、文件列表、操作区、系统拖放、数量/大小限制和类型过滤统一进入属性模型、画布预览及 `NE_创建上传/NE_设置上传选项` 原生生成链路；“文件已选择/上传操作”事件通过桥接回调分发，并提供最近路径、动作、索引和进度上下文命令。桌面模块页拖入工作区外 `.lbmod` 时由主进程校验扩展名、文件类型和 100MB 上限，安全复制到 `.lingbuilder/module-packages` 后继续预览确认。
- 已完成（2026-07-24）：上传组件与拖拽上传组件的主归属迁移到内置 `lingbuilder.win32.common-controls`；普通 Win32 项目使用 `IFileOpenDialog`、标准按钮/列表框和 `WM_DROPFILES` 生成真实窗口控件，支持多选、扩展名过滤、数量/大小限制、初始文件、文件列表、自动执行和选择/操作事件，并新增 `上传_打开文件选择/开始/清空文件/取文件数量/取文件` bindings。纯 Win32 上传项目不再要求 `lingbuilder.new_emoji.ui`，生成 exe 不复制或加载 `new_emoji.dll`；new_emoji 后端仅保留显式选择该后端时的兼容映射。
- 已完成（2026-07-23）：项目启用 `lingbuilder.new_emoji.ui` 后，窗口设计器自动切换为 new_emoji 原生设计后端；按钮、编辑框、文本、复选框、单选框、列表框、图片框、进度条和容器共享现有布局模型，画布显示 new_emoji 专属预览，F5/导出直接生成 `NE_创建*` 原生窗口与控件调用并由 `NE_运行消息循环` 负责生命周期。列表框项目/默认选中项与图片源/填充方式已进入确定性生成链路。不支持的高级 Win32 控件在工具箱禁用且生成时给出中文诊断，不静默回退为 Win32。
- 已修复（2026-07-23）：列表框“项目集合”属性编辑器保留输入草稿，按 Enter 可继续录入下一项且失焦时清理空行；LingCpp Win32 运行时处理 `WM_CTLCOLORLISTBOX`，列表框使用设计器模型中的前景色、背景色和对应画刷，不再回退为系统白底。
- 已修复（2026-07-23）：组合框不再把设计器的收起高度误作 Win32 下拉列表总高度；新增独立“下拉列表高度”和“表项高度”属性。非编辑组合框完整接管 `WM_PAINT`/`WM_PRINTCLIENT` 收起态绘制，避免系统主题在自绘后重新覆盖白色边框和按钮，背景、前景、圆角边框、矢量下拉箭头与设计器保持一致，40px 设计高度在 F5/导出运行时保持一致。
- 已完成（2026-07-23）：列表框新增 `itemHeight`、`contentPadding`、`scrollBarVisibility`、`scrollBarWidth`、`scrollBarTrackColor`、`scrollBarThumbColor`、`borderWidth`、`borderColor`、`selectionStartColor`、`selectionEndColor`、`selectionBorderColor` 和 `selectionCornerRadius` 专属外观属性。`itemHeight` 默认 28、范围 16–96；`contentPadding` 默认 4、范围 0–24，并统一控制首项相对边框的上、左、右、下留白。滚动条支持自动、始终显示和隐藏，原生生成不再使用不可定制的系统 `WS_VSCROLL`，由边框承载层自绘圆角轨道与滑块，并支持滚轮、键盘、轨道翻页和滑块拖动。设计器预览与 LingCpp Win32 F5/导出共用同一组默认值和模型字段，不能分别从 CSS 内边距或字体大小推导间距。原生列表框使用独立边框承载层与 `LBS_OWNERDRAWFIXED` 自绘项目，通过 GDI+ 绘制抗锯齿水平渐变、选中边框和圆角，不再显示系统蓝色矩形选中条。生成模板中的 C++ 空字符必须输出为文本转义 `L'\\0'`，回归测试会拒绝包含真实 NUL 字节的源码。
- 后续建议：为 `new_emoji` 增加 x64 构建目标选择、按钮/控件事件回调深度映射、更多 EU_ 控件类型、全量 API 参数类型增强和可视化示例模板。
- 后续建议：把“纯 new_emoji 独立演示入口”沉淀成正式模板或生成器选项。该模板必须保留作为事件块结束标记的独立 `结束`，但不得额外调用显式退出命令 `结束()`；创建 new_emoji 窗口后进入 `NE_运行消息循环` / `EU_RunMessageLoop()`，构建验收需启动 exe 并确认 3 秒后仍在运行，防止再次生成闪退示例。

本文档记录当前原型阶段为了快速闭环而采用的临时方案，以及后续必须工程化完善的方向。后续 Agent 开始大改动前应先阅读本文件，避免把原型实现误判为最终架构。

- 已完成（2026-08-17）：内置 `lingbuilder.data.json@2.0.0` 已从 5 条顶层文本辅助接口升级为 55 条受管 JSON API。`JSON值`、严格解析/创建/格式化、对象数组操作、RFC 6901 Pointer、RFC 6902 原子 Patch、RFC 7396 Merge Patch 与 JSON Schema 核心校验均进入同一模块 binding 和 C++ 生成闭环；普通 Win32/new_emoji 共用不依赖 Node 或浏览器的运行时。当前明确边界：不支持 JSON5/JSONC、BSON、MessagePack、CBOR、远程 `$ref`、网络 schema 下载或文件 I/O；这些能力如有需要必须以独立模块和受控文件服务实现，不能扩展 `JSON_解析` 以兼容非标准输入。

## 1. 窗口设计器持久化

### 当前状态

- 已完成 B01：Debug/Release 与 Win32/x64 使用工作区配置统一驱动 F5/解决方案编译参数、模块 target、分配编译环境和输出目录，不再使用状态栏固定文字模拟。
- 已完成 B02：解决方案 v2 持久化项目引用和多启动项，构建通过依赖图拓扑排序，循环/缺失引用明确失败，删除项目会清理悬空关系。

- Electron 工作区中的设计器项目模型已保存到项目引用的 `.lingbuilder/window-designer.json`，并与源码一起进入手动保存和配置化自动保存。
- `WpfDesigner` 会发出模型脏状态，工作台把设计器模型纳入热退出恢复；自动保存计时器通过稳定服务引用提交，不会被调试日志等周期性重渲染反复重置。外部修改通过 `fs.watch` SSE 通知，并使用按路径排队的处理器和 SHA-256 版本令牌提供重载或保留本地修改的冲突保护；源码与设计器文件同时变化时不会互相吞掉通知或用其中一份旧快照覆盖另一份脏数据。保存请求未结束期间会登记本次源码／设计器快照，监听器识别同一写入回声后只推进磁盘版本、不覆盖请求期间的新编辑；快照在请求成功、冲突或失败后立即清理，不能误抑制之后真实的外部回退。
- 设计器绑定窗口的类名、源码文件名和模型窗口目前不支持单边重命名；工作台会阻止直接重命名对应 `.lcpp`，避免源码与设计器绑定脱节。后续如开放该能力，必须作为一次原子重构同时更新磁盘文件、类声明、设计器模型、事件绑定、活动标签和恢复数据。
- `localStorage` 仍保留当前窗口、选中控件等 renderer 会话镜像和无工作区 fallback，但不再作为 Electron 项目模型的唯一权威来源。

### 风险

- 当前 renderer 仍通过 `windowDesignerService` 维护一份 `localStorage` 会话镜像；后续应把无工作区 fallback 与 Electron 项目服务进一步拆开，避免调用方误把镜像当作磁盘提交成功。
- 多窗口同时编辑同一设计器文件目前采用版本冲突提示，不做结构化三方合并；用户保留本地版本后，下次保存仍会继续触发冲突保护。
- 设计器项目与 `.lcpp` 已进入同一保存、恢复和生成链路，但布局 XML/C++ 属于派生产物；后续仍应提供更直观的模型／源码差异预览与重建状态。

### 后期目标

- 继续以工作区项目引用的 `.lingbuilder/window-designer.json`（或等价工程配置）作为权威设计器模型。
- 通过 `FileService` / Electron 原生文件系统桥接读写，不让 React 组件直接依赖存储细节。
- 设计器模型、中文 `.e` 源码、布局 XML、生成 C++ 都应有明确的同步关系和脏状态。
- 支持保存、另存为、打开项目、最近项目、自动恢复和冲突提示。
- 支持模型版本号和迁移函数，避免旧项目无法打开。

### 建议落地步骤

1. 已通过解决方案服务和 `/api/window-designer/files` 封装工作区加载、原子保存、版本冲突与外部变更通知；后续可再收敛为独立 `WindowDesignerProjectService` 接口。
2. 已使用带 `schemaVersion` 的项目文件保存窗口模型，并按项目身份隔离设计器状态；活动窗口和选中控件继续作为会话状态。
3. Electron 模式已通过文件系统保存到工作区；Web 原型保留 `localStorage` 作为无工作区 fallback。
4. 已让 `WpfDesigner` 发布模型更新与脏状态，组件卸载和项目切换不会把其它项目的缓存模型带入当前项目。
5. 已在保存、自动保存、热退出恢复和 F5／原生生成链路中同时读取最新设计器模型与中文源码；外部源码与设计器通知按路径串行排队并分别合并，后续补充结构化冲突合并和绑定窗口的原子重命名。

## 2. 中文代码转 C++ 规则继续扩展

### 当前状态

- 中文代码转 C++ 规则集中在 `src/services/windowDesigner/eplToCppRules.ts`。
- 当前优先支持事件子程序中的 `信息框`、`调试输出`、确认退出等最小闭环。
- 已完成（2026-07-26）：`.lcpp` 方法、事件和构造块支持 `局部 类型 名称 [= 初始值]` 及数组局部变量；解析器将局部声明写入方法 AST 和符号索引，语言服务按当前子程序隔离补全，并诊断重复名称、声明前使用、未声明赋值及已知类型不兼容。新手模式按子程序显示可增删改的“局部变量”表，正文结构编辑会保留声明。Win32 生成器会输出程序集成员、局部 C++ 声明和普通赋值，模块命令返回类型及模块贡献 `cppType` 可直接参与赋值生成；`网页_访问_对象` 的 `字节集` 返回值可保存为 `std::vector<unsigned char>`。

### 后期目标

- 继续扩展局部块作用域、复合赋值、字符串拼接、更多表达式类型检查、控件属性读写、窗口打开/关闭等规则；基础条件、选择、循环和异常控制流已完成，不再列为缺口。
- 输出中间表示 IR，再由 Win32 / Qt / wxWidgets 等后端生成不同 C++ UI 代码。
- 为每条中文语法规则补充单元测试，保证中文编辑器内容和运行 exe 行为一致。

## 3. 构建日志与任务系统

### 当前状态

- F5 和“生成并运行”已经走同一构建入口。
- 设计器底部有“编译日志”页签显示生成、编译和运行结果。

### 后期目标

- 抽象为 `TaskService`，区分构建、运行、调试和环境检查。
- 输出结构化日志，包括阶段、耗时、生成目录、编译器、错误位置和中文解释。
- 已完成（B04）：MSVC/GCC/Clang 与链接器输出已结构化解析；生成 C++ 位置按 source map 映射回 `.lcpp`，问题面板可显示错误码、行列并跳转，无法映射时保留原始生成文件位置。
- 已修复：错误列表跳转同时覆盖专业 Monaco 与中文结构编辑器；点击映射到 `.lcpp` 的构建诊断会打开对应文件，并在新手模式滚动到结构化源码行，路径分隔符差异不会再导致跳转失效。
- 已修复：设计器已绑定但源码尚缺失的事件不再错误归位到 `.lcpp` 类声明行，也不再用原始文本行号冒充新手结构编辑器的可视行号；问题面板明确标注“待生成事件（类末尾）”，避免给尚不存在的事件显示虚假源码位置。
- 已修复：LingCpp 问题聚合不再重复追加已经包含在语义诊断中的块结构诊断，错误列表不会把同一事件位置重复显示两遍。
- 已修复：新手中文结构编辑器的行号槽不再显示压缩布局产生的视觉序号；类、成员、子程序和代码正文统一显示真实 `.lcpp` 源码行号，合成的分隔空白不显示伪行号，因此错误列表第 34 行跳转后界面也明确显示第 34 行。
- 已修复：中文结构编辑器末尾增加受限滚动余量，靠近文件尾部的诊断目标也能完整滚动到编辑区中央，不再只露出目标行顶部而让用户误以为没有跳转。
- 已完成：右侧结构编辑器“待生成事件”列表为每个缺失处理器提供“快速生成”按钮，复用 LingCpp AST 编辑服务写入真实事件函数；错误列表原有生成入口和结构面板入口共享同一确定性编辑链路。
- 已修复：Win32 菜单运行时模板的空白字符集合改为双重转义，生成的 `find_first_not_of(L" \\t\\r\\n,")` 不再被 TypeScript 模板提前展开成跨行 C++ 字符串；新增生成文本回归断言。
- 已修复：Win32 普通按钮 owner-draw 使用 `RoundRect` 绘制圆角填充和边框；确定进度条在原生子类 `WM_PAINT` 后按范围与当前位置叠加居中百分比文字，使 F5 窗口外观与设计器预览一致。
- 已修复：LingCpp Win32 普通 owner-draw 按钮补齐普通、鼠标悬停、按下、键盘焦点和禁用五种状态；悬停/按下色从设计器背景色确定性推导，状态切换仅触发失效重绘、不移动或缩放 HWND，禁用按钮不保留悬停态，`MouseEnter` / `MouseLeave` 事件继续正常派发；按钮、编辑框、复选框和单选框通过 `WS_TABSTOP` 与窗口消息循环支持真实 Tab 导航，F5 与导出工程行为一致。
- 已修复：owner-draw 复选框与单选框不再依赖 `BS_OWNERDRAW` 下不会持久化的系统 `BM_GETCHECK` 状态；运行时显式保存并通过 `BM_GETCHECK` / `BM_SETCHECK` 暴露勾选状态，鼠标点击、键盘空格、中文代码设置勾选和单选组互斥都会立即重绘并发送状态变化通知，三态复选框按未选中→选中→中间态循环并绘制横杠。
- 已修复：复选框与单选框不再套用普通按钮的整行焦点外框；键盘焦点只强化左侧方框/圆点边线，勾选文字区域保持无边框，避免鼠标选中后出现横跨整行的青色矩形。
- 已修复：Win32 编辑框移除 `WS_EX_CLIENTEDGE` 系统立体边框，使用圆角窗口区域、暗色背景、普通/聚焦细边框和 DPI 缩放水平内边距，缩小设计器与 exe 的输入框视觉差异并保留原生 EDIT 行为。
- 已完成：编辑框属性面板新增 `verticalAlign`（顶部/居中/底部，默认居中）；设计器使用 flex 对齐预览，Win32 运行时根据真实字体度量调整内层单行 EDIT 的几何位置，多行编辑框铺满内容区。
- 已修复：放弃在原生 EDIT 本体上使用 `WM_NCCALCSIZE` / `WM_NCPAINT` 修改客户区和重绘边框；TextBox 现在由独立圆角 frame 唯一绘制暗色背景、普通边框和聚焦边框，内层无边框原生 EDIT 只负责输入、输入法、选择和剪贴板。
- 已修复：普通态与聚焦态共用完全相同的圆角和 1px 四边几何，只切换语义颜色；焦点变化只失效外层 frame，不再触发系统非客户区重算，因此不会出现顶部/底部白边、左右阴影、缺边或焦点切换残影。
## 2026-07 解决方案与构建任务更新
- 已完成：Electron 原型新增 `.lingbuilder/solution.json` 解决方案层，支持多个 Visual C++ 项目、启动项目、项目级资源根目录和兼容旧默认项目路径。
- 已完成：解决方案资源管理器支持解决方案/项目节点右键入口，可新建项目、设为启动项目、生成/清理/重新生成项目或解决方案，并支持从解决方案移除项目或删除非默认项目文件。
- 已完成：新增受控 `/api/solution/*` 接口；清理默认只删除 `.lingbuilder-build/<projectId>` 临时构建目录，保留 `generated/cpp/<projectId>` 可复制 Visual Studio 工程。
- 已完成：`/api/solution/build`、`clean`、`rebuild` 与 F5 构建接入正式 `TaskService`，统一队列、阶段/进度、取消、结构化日志和 SSE 工作台状态流；B04 已完成编译诊断映射与问题跳转。
- 已完成（B05）：解决方案批量构建按依赖阶段并行，原生项目使用持久化输入指纹进行增量编译判定，重新生成主动失效缓存；项目租约取消信号已传入 MSVC/GCC/Clang、CMake/MSBuild 子进程，停止操作可终止编译并阻止迟到运行。
- 已完成（D01）：底部面板接入 xterm 与真实 PTY/Windows ConPTY，多会话支持输入输出、cwd/env、resize、退出/关闭和缓冲恢复；服务端 API/SSE 受 renderer 会话鉴权，关服统一回收。安装版 smoke 已验证真实 CMD 回显和无残留进程。
- 已完成（D02）：接入开源 `lldb-dap` DAP 会话，支持 Debug 原生目标启动、普通/条件断点、继续、逐过程、逐语句、跳出和停止；`.lcpp` 断点按生成 source map 映射到 C++。MSVC Debug 构建补齐 `/MDd` 和 PDB 链接参数，服务退出会回收调试适配器。Locals/Watch/Call Stack/Threads 仍归 D03。
- 已完成（D03）：暂停态通过 DAP 返回真实 Threads、Call Stack、Scopes、Locals 和可展开变量，支持选择线程/栈帧与 Watch evaluate；底部面板已删除 WPF/端口模拟数据并替换为真实调试检查器。Attach、Dump、内存/寄存器/反汇编仍归 D04。
# 2026-07-11：高级原生调试闭环

- 已完成：`NativeDebugService` 复用同一 DAP 生命周期支持 PID attach、LLDB core/minidump 和 gdb-remote；内存、寄存器及反汇编只允许暂停态读取并设置数量上限。
- 已完成：高级调试 UI 和受 renderer 会话鉴权 API 已接通，失败不会回退成模拟数据或开放任意调试器命令。
- 后续优化：增加图形化进程选择器、十六进制内存编辑器、反汇编/源码混排和远程目标配置持久化；当前提示框是可用的首版入口。
# 2026-07-11：本地 Git 源代码管理闭环

- 已完成：独立 `GitService` 提供真实状态、选择暂存/取消暂存、提交、本地分支创建/切换/安全删除、提交历史和逐行 blame；所有文件参数限制在当前工作区，未开放任意 Git 参数或 shell。
- 已完成：解决方案侧栏的只读状态徽章升级为可操作源代码管理面板，具备中文忙碌、失败和空状态反馈。
- 后续优化：远程 fetch/pull/push、merge/rebase、冲突解决与 PR 归入 G02，不在 G01 本地提交闭环内混入隐藏网络操作。
# 2026-07-11：Git 远程同步、冲突与 PR 闭环

- 已完成：Git 服务支持 remotes、fetch/prune、ff-only/merge/rebase pull、push/upstream、本地 merge/rebase 继续与中止，并将冲突状态结构化返回。
- 已完成：冲突面板读取 Git index 的 base/ours/theirs 三方内容，用户可采用一侧或编辑合并文本；手工结果残留冲突标记时拒绝暂存。
- 已完成：PR 使用可替换 `PullRequestProvider`，默认以固定参数调用官方 `gh pr create`；非 GitHub remote、缺少 gh、未登录和提供器错误均显式反馈，不静默发起网络操作。
- 后续优化：增加凭据管理、远程进度流、force-with-lease 明确确认、PR 列表/评审与多托管平台提供器。
# 2026-07-11：设计器专业操作与 RC 资源往返编辑

# 2026-07-11：CPU、内存与 I/O 性能分析

# 2026-07-11：发布、签名与远程构建目标

# 2026-07-11：AI 索引、凭据安全、无障碍与设置同步

- 已完成：Electron AI API Key 改由主进程 `safeStorage` 加密保存，preload 只暴露最小 get/set/delete IPC；renderer 本地配置不再写入密钥，并会清除旧 localStorage 明文字段。Web 模式只保留当前会话输入，不降级为明文持久化。
- 已完成：新增 `WorkspaceIndexService`，有界索引工作区文本源码、保存 SHA-256/预览/术语并原子写入 `.lingbuilder/ai-index.json`；排除生成目录、依赖目录、符号链接和超大文件，支持搜索、请求取消和关服取消。
- 已完成：AI 对话请求使用 `AbortController`，聊天输入、发送、取消、索引构建/搜索结果补齐可访问名称、键盘焦点、`role=status/alert` 和 `aria-live`。
- 已完成：新增不含凭据的设置同步包，覆盖用户设置、工作区设置和扩展启用状态；导入必须先预览并以 SHA-256 令牌复检，批量替换失败会恢复所有先前文件。
- 验证：专项测试 7/7 通过，覆盖密钥不落 localStorage、safeStorage IPC、索引持久化/搜索/取消、ARIA/键盘入口、敏感字段递归剔除、同步冲突和确定性中途失败回滚。
- 后续建议：当前索引为确定性的词项索引；后续可选接入本地 embedding、增量文件监听和分块语义召回，但仍需保持离线降级、取消和敏感文件排除。

- 已完成：新增 `PublishingService`，读取 `.lingbuilder/publish.json`，校验语义版本、发布文件、输出目录、目标和签名配置；本地发布在临时目录复制文件并生成 SHA-256 清单，成功后原子替换输出目录。
- 已完成：发布失败会删除临时目录并恢复旧输出；Authenticode 仅通过固定 `signtool sign/verify` 参数执行，时间戳必须使用 HTTPS，证书文件必须位于工作区内。
- 已完成：WSL、Docker 容器和 SSH 统一调用 `lingbuilder-agent build --request <base64url>`，发行版、容器和主机参数均受白名单校验，不拼接或开放任意 shell；远程响应必须满足有界产物清单契约。
- 已完成：解决方案侧栏提供发布配置读取、生成发布产物和签名验证入口，并显示加载、运行、成功和失败状态。
- 验证：发布专项测试 4/4 通过，覆盖真实本地产物、哈希清单、原子替换、签名失败回滚、固定签名参数、WSL/容器/SSH 契约及 UI 状态。
- 后续建议：当前远程目标要求对端预装兼容版本 `lingbuilder-agent` 且工作区已由用户同步；后续可增加协议版本协商、增量文件传输、远程缓存证明和企业证书提供器。

- 已完成：新增独立 `PerformanceService`，只允许启动工作区内的可执行文件，以固定采样周期收集 CPU 时间、工作集内存、磁盘读取和写入字节，并限制参数、采样数和最长采集时间。
- 已完成：Windows 使用 `Win32_Process` 只读计数器，其他受支持平台使用 `/proc`；采集可主动取消，目标进程退出、超时、取消或 IDE 关服时均会回收。
- 已完成：支持导入 Chrome `.cpuprofile`，按采样时间聚合热点函数并限制报告规模；质量/测试页提供开始、取消、导入、错误、运行中和空报告状态。
- 验证：性能服务与 UI 专项测试 3/3 通过，覆盖报告解析、CPU/内存/I/O 汇总、越界拒绝、真实子进程采样、取消和空状态。
- 后续建议：当前是进程级采样和 CPU Profile 热点聚合；以后可接入 ETW/Windows Performance Recorder，提供调用树、火焰图、线程切换、分配栈和时间轴关联。

- 已完成：窗口设计器支持 Shift/Ctrl 多选控件、九种边缘/中心对齐与等宽等高、水平/垂直分布、方向键微调（Shift 为 10 像素）和批量删除。
- 已完成：设计器使用有界历史记录提供撤销/重做；新编辑会清空重做分支，项目更新仍经现有持久化链路提交。
- 已完成：新增 `RcResourceService` 和侧栏 RC 资源编辑器，可读取并修改菜单、对话框、控件和字符串资源文本；保存保留 UTF-8/UTF-16、BOM、LF/CRLF 及未识别语法。
- 已完成：RC 写入采用原始字节 SHA-256 冲突令牌和临时文件原子替换，外部修改、缺失条目或越界路径会明确拒绝，不会覆盖未知资源内容。
- 验证：设计器与 RC 专项测试 6/6 通过，并纳入 `npm run test:lingcpp` 完整门禁。
- 后续建议：可继续扩展可视化菜单层级编辑、对话框尺寸拖拽和完整 RC 语法 AST；当前实现只对已识别资源的引号文本做最小替换，未知语句保持原样。

# 2026-07-11：测试资源管理器闭环

- 已完成：`TestExplorerService` 发现 `*.test/spec.ts/js` 的 Node 测试，以及 CMake 生成的 CTest JSON v1 测试；测试 ID 稳定、有界扫描并跳过依赖/输出目录。
- 已完成：Node 测试按名称通过本地 tsx loader 运行，CTest 直接执行其结构化命令；结果统一为通过/失败/跳过、耗时、退出码和有界输出。
- 已完成：Node 测试使用真实 Inspector WebSocket 在入口暂停并支持继续/停止；C++ 测试调试配置复用现有 LLDB DAP。关服会回收 Node 测试调试进程树。
- 后续优化：增加测试发现文件监听、树形 suite 嵌套、参数化测试子节点、并行队列/取消进度和测试结果持久化。
# 2026-07-11：覆盖率、静态分析与 Sanitizer 闭环

- 已完成：质量服务可真实运行 Node V8 覆盖率，并解析 LCOV、Istanbul coverage-final.json、SARIF、AddressSanitizer 和 UndefinedBehaviorSanitizer 日志。
- 已完成：统一报告聚合行覆盖率、错误/警告和源码位置；质量面板可将覆盖行发布给 Monaco，已覆盖/未覆盖使用独立行背景和装订线标记，静态/Sanitizer 诊断合并进入问题面板。
- 已完成：报告和测试路径限制在工作区，V8 临时覆盖目录在返回前删除，输出和文件数量有界。
- 后续优化：增加 clang-tidy/MSVC `/analyze` 一键任务、C++ llvm-cov 自动采集、覆盖率阈值门禁、分支/函数覆盖视图和 HTML 报告导出。
# 2026-07-11：独立 Extension Host 闭环

- 已完成：`.lingbuilder/extensions/<extension>/package.json` 扩展体系与 `.lbmod` 模块体系分离；清单支持激活事件、权限及 commands/menus/views/languages/themes 贡献。
- 已完成：扩展代码在独立 Node 子进程和 VM 上下文执行，Node permission model 在 OS 层只允许读取宿主产物与扩展目录，默认禁止文件写入、网络和子进程；扩展脚本的 `require` 被拒绝，工作区访问只能走父进程受控 API。
- 已完成：onCommand、onLanguage、workspaceContains 与 `*` 激活，命令执行、工作区 UTF-8 读写、消息、启用/禁用、错误清单、主题读取、日志、超时强杀和最多三次崩溃恢复。
- 已完成：构建输出独立 `dist/extension-host.cjs`；关服回收宿主，扩展面板显示 PID、状态、恢复次数和通用贡献点。
- 后续优化：扩展签名/来源信任、安装预览、API 版本协商、真正 TreeDataProvider/Webview、主题全工作台令牌映射和扩展性能分析。
# 2026-07-11：C++ 依赖管理闭环

- 已完成：自动发现并解析标准 vcpkg.json、Conan conanfile.txt/.py、NuGet packages.config 与 PackageReference；统一显示直接依赖、版本和清单来源。
- 已完成：跨清单同 provider/包名的多个具体版本会阻止恢复并给出中文冲突；恢复命令使用固定参数，不接受任意 CLI 参数。
- 已完成：vcpkg 使用独立 install root 和 files binary cache；Conan 使用工作区缓存 HOME；NuGet 使用独立 packages 目录。离线模式分别使用 only-binarycaching/read、no-remote/build=never、本地 Source。
- 已完成：依赖面板提供在线恢复、仅离线缓存、缓存文件/字节统计和工具缺失诊断。
- 后续优化：增加包搜索/版本选择、锁文件图形化、许可证/SBOM、安全公告和依赖升级预览。
# 2026-07-11：窗口自身事件面板

- 已完成：窗口选中后事件页不再显示控件空状态；窗口模型持久化 `events.Loaded`，并由 Win32 C++ 生成器按绑定调用创建完毕处理器。
- 已完成（2026-07-16）：建立独立窗口事件注册表，事件面板按生命周期、布局与状态、焦点与键盘、系统与拖放分组，支持搜索、仅显示已绑定和安全打开事件代码。
- 已完成（2026-07-16）：确定性支持关闭前/已关闭、尺寸/位置、激活/可见、焦点、全窗口键盘、DPI、最小化/最大化/恢复和 Unicode 多文件拖入；上下文命令由 `lingbuilder.win32.basic` 的贡献与 binding 同源提供。
- 已完成（2026-07-16）：关闭取消、按键已处理、状态转换去重和旧 `Loaded` 处理器兼容已接入 F5 与导出 C++ 链路。
- 已完成（2026-08-02）：窗口键盘、字符、DPI 和文件拖入事件接入统一强类型参数 ABI：按键事件传入键码与 Ctrl/Shift/Alt 状态，字符事件传入 Unicode 文本，DPI 事件传入新 DPI，拖入事件传入完整 Unicode 路径数组。设计器事件卡片、补全、源码自动生成、语言服务诊断和 Win32 生成器同源；旧无参数处理器继续兼容并可使用上下文命令，从设计器重新打开时会安全升级空签名，使新手参数表直接显示注册表参数，同时保留事件正文和已有非空参数。

## 系统 AI 云端、账号计费与管理后台（2026-07-12）

- 已完成：建立根 npm workspaces，新增 `cloud/api` NestJS 服务、`cloud/admin` React/Vite 管理后台和 `packages/contracts` 共享协议；PostgreSQL/Redis/Mailpit 开发依赖由根 `docker-compose.yml` 描述。
- 已完成：账号服务覆盖邮箱注册验证、登录、刷新令牌轮换/重复使用撤销、找回密码、设备码授权和管理员 TOTP MFA；Refresh Token 只保存哈希，Electron 使用 safeStorage，CLI 使用 Windows DPAPI。
- 已完成：AI 点数使用 bigint 账户和不可变流水，提供赠送、管理员调账、冻结、结算和失败释放；注册送点在邮箱验证后唯一发放，免费窗口支持时区、模型范围、请求数和点数上限。
- 已完成：模型网关按逻辑别名路由 OpenAI-compatible、Anthropic 和 Gemini 流式接口；Provider 地址执行 HTTPS/私网/DNS 校验，密钥使用 AES-256-GCM SecretVault 保存。
- 已完成：管理后台提供用户、点数、活动、供应商、模型、用量和审计页面，包含响应式布局、键盘焦点、错误/加载/空状态；管理员路由要求角色与 MFA。
- 已完成：Electron AI 面板新增系统 AI/BYOK 双模式、账号登录、点数、云端模型、SSE、取消和云端编辑草稿的本地二次校验；系统账号刷新令牌不进入 renderer、localStorage 或工作区。
- 已完成：CLI 新增版本、帮助、doctor、账号设备登录、模型、余额、聊天、工作区检查和受控项目诊断/导出/构建/运行入口；AI Bridge 改为回环限定、官方 MCP SDK 严格 schema、UUID/TTL 提案、文件冲突拒绝、多文件失败回滚、搜索资源上限和编译 AbortSignal。
- 已完成（2026-07-26）：Windows 安装包携带 `lingbuilder.cmd`，复用 Electron/Node 运行时启动 `dist/cli.cjs`；NSIS 提供默认勾选的当前用户 PATH 选项，重装会去重或按用户选择移除，卸载会清理；安装版冒烟测试增加 CLI 版本验证，最终用户无需另装 Node.js。
- 已完成（2026-07-26）：原“CLI 与 AI Bridge 使用指南”已升级为完整的“AI Bridge 连接中心”，不再要求用户手工启动服务和复制配置。Electron 主进程新增受管 Bridge 生命周期服务，直接启动/健康检查/停止 CLI 子进程；同一 `AiBridgeService` 默认提供共享 Streamable HTTP MCP 与 REST API，传统 stdio MCP 继续作为兼容入口。连接中心可设置端口、`readonly`/`preview`/`yolo` 权限和生命周期，实时显示客户端、工具调用和脱敏日志，并在工作区切换或 IDE 退出时回收 Bridge。Bridge Token 通过子进程环境传递，不出现在启动命令行。外部客户端集成会检测 Codex CLI、Claude Code、Gemini CLI，一键创建注入临时地址和 Token 的 IDE PTY；Codex 使用会话覆盖，Claude/Gemini 托管配置只含环境变量占位符，不改写全局配置、不持久化 Token。CLI 自检、命令示例、HTTP 自动化和完整手册仍保留。
- 已完成（2026-07-26）：AI Bridge 连接中心新增 ChatGPT/Codex Windows 桌面客户端专属适配，不再把 Codex CLI PATH 当作桌面版安装状态。主进程检测 `OpenAI.Codex` MSIX 包、启动入口和 `ChatGPT` 进程，在当前工作区 `.codex/config.toml` 安全管理 `mcp_servers.lingbuilder_desktop`；保留用户其他 TOML、对非托管同名配置要求确认、检测安装路径/权限漂移并提示修复，以配置与进程时间判断是否需要重启。CLI 新增 `--mcp --stdio-only`，由 Codex 桌面端按项目直接启动同一 `AiBridgeService`，不监听端口、不生成或持久化 Token；配置默认让 Codex 对写工具提示批准，同时继续服从 LingBuilder 权限和审计边界。
- 后续建议：生产发布前在真实 PostgreSQL/Redis 上执行迁移和并发账本压力测试，接入部署平台 KMS、OpenTelemetry/Prometheus、备份恢复演练和真实供应商沙箱；当前开发机未安装 Docker，无法在本轮完成容器集成 smoke。
- 后续建议：系统 AI 的供应商成本预算、熔断健康任务、管理后台图表导出、跨平台 CLI Keychain 和在线支付仍按首版范围之外单独推进。
- 已修复：OpenAI-compatible 思考模型现在独立解析 `reasoning_content`，聊天不会再出现消耗 Token 但空白完成；编辑草稿仍只消费最终 `content`。
- 已修复（2026-09-11）：上条的「不再空白完成」在真机上仍会复现，根因有二并已同时修复。① 渲染层：`chatHistory` 从会话 store 派生，而 store 消息映射只保留 `content`，`reasoningText` 每次往返都被剥掉——思考折叠块永远渲染不出来，`completed` 时「只输出思考就提升为正文」的兜底读到的也是已剥离数组，静默失效，用户看到空气泡。修复：`AiAssistant.tsx` 新增 `toConversationMessage` 统一两处消息映射并随行 `reasoningText`（截断至 `MAX_REASONING_CHARS` 40K），`aiConversationService` 消息结构新增 `reasoningText` 字段随会话持久化，提升为正文时按 70K 截断。② 云端：模型预算曾为 4096/16384，思考模型把 `max_tokens` 全部耗在推理上即产出空正文；现已把生产库 `LogicalModel.maxOutputTokens` 开到 DeepSeek 上限 393216（`contextWindow` 1M），点数预冻结改为有界估算（`RESERVE_OUTPUT_TOKEN_ESTIMATE` 16384，settle 按实际用量补收），`provider.service` 捕获 `finish_reason`，chat 正文被 `length` 截断时追加「（回复达到输出长度上限…）」提示 delta，正文与思考全空时在 `usage` 后下发中文 `error` 事件而不是静默 `completed`。编辑流默认输出预算 `DEFAULT_EDIT_OUTPUT_TOKENS` 8192 → 32768，降低设计器整模回显被截断成 `EDIT_DRAFT_TRUNCATED` 的概率。遗留：IDE 侧 `isLikelyCodeEditInstruction`/`isLikelyDesignerEditInstruction` 触发词仍偏窄，「做一个 X」类诉求会落入纯 chat 流（不会改项目），是否扩词表待产品决策。同日真机端到端验收时发现并修复第三个叠加缺陷：AI 编辑提案命中**当前打开的文件**时，`handleApplyWorkspaceEdit` 只更新了 files 状态，而保存前的 `flushCurrentEditorDrafts()` 会用编辑器实例内的旧草稿反向覆盖（App.tsx flush 分支「editor wins」），提案内容被静默回滚、磁盘写入旧内容但 UI 仍提示「已写回」。修复：应用提案后把 `appliedFiles` 中活动文件的新源码经 `diffViewerRef.applyExternalSourceCode` 注入编辑器实例，使 flush 判定「编辑器与文件一致」而保留提案内容。验收：CDP 驱动真机走完整链路（chat 回复、reasoning 折叠块展开可见、编辑提案应用后磁盘出现新增子程序），`npm run lint`/`build` 全绿。
- 已修复：AI 幂等检查提前到 SSE 响应头提交之前，重复请求返回结构化 HTTP 409，不再以连接 `terminated` 结束。
- 已修复：取消结算复用包含规则手册的实际消息集合估算输入 Token，中文/CJK 字符按约一字符一 Token、ASCII 按约四字符一 Token估算，并按最终选中的路由价格记录估算供应商成本。
- 已修复（2026-08-22）：依据 DeepSeek 官方最新文档，系统预设直接使用 `deepseek-v4-flash`、`deepseek-v4-pro` 上游模型 ID；模型版本更新由官方别名承载，不再映射到已过时的模型名称。
# 2026-07-11：EdgeView 浏览器模块

- 已完成：`lingbuilder.edgeview` 支持 HWND 嵌入、区域承载、多实例、独立 User Data Folder、导航、前进后退、刷新关闭、分实例 JavaScript JSON 返回值，以及 WebView2 中文事件到 `.lcpp` 无参数处理器的直接回调。
- 已完成：构建链路从 NuGet 缓存受控发现 WebView2 SDK，复制头文件和 Win32/x64 Loader 到临时构建与可复制 VS 工程；AI Bridge CLI 多实例项目已真实编译运行，并验证两个独立 WebView2 进程组、两个缓存目录、JS 标题返回值和事件日志。
- 已完成：修复 WebView2 已加载且 JS/事件正常但画面被父窗口背景覆盖的问题；主窗口和承载 HWND 使用裁剪样式，控制器显式可见、通知父窗口位置变化并提升承载窗口 Z 序。
- 已完成：通过 WebView2 `ContextMenuRequested` 给每个 EdgeView 实例的原生右键菜单追加中文“刷新”，菜单选择回调只调用当前实例的 `Reload()`。
- 已完成：增加 EdgeView 全局默认代理与单实例覆盖代理，使用受校验的 `--proxy-server` Environment 参数，支持 HTTP、HTTPS、SOCKS5，并明确现有实例需重建后生效。
- 已完成（2026-09-13）：项目构建产物 EXE 文件名可配置（解决方案 `buildProperties.executableName`，可带 .exe 后缀）：`resolveExecutableNameParts` 统一校验（非法字符/长度≤64，缺省回退 `LingBuilderPreview.exe`），F5/CLI 构建产物、旧产物清理、VS 导出工程 TargetName、native.export 预览工程全链路跟随；IDE「构建目录…」对话框暴露同名输入项（`ProjectBuildPathsDialog`），`solutionClient`/`ExternalProjectProperties` 类型与 `validateProperties` 同步。
- 已完成（2026-09-13）：窗口模型新增 `embeddedFiles`（RCDATA 内嵌资源）：构建随 `lingbuilder-app.rc` 编译、EXE 启动自动释放到 `%TEMP%\lingbuilder-embedded\<工程ID>\`，中文代码按约定路径直读；实测 `AI 视频自主生产/进阶方案/高颜值应用商店-EdgeView/` 双击 exe 零外部文件运行（释放内容 SHA-256 与源文件一致）。
- 已修复（2026-09-13）：生成模板 WM_SIZE 新增 `EdgeView_随窗口调整设计器控件`，把「设计器 x/y=0 且宽高≥窗口」的全幅 EdgeBrowser 控件宿主拉伸到当前客户区后再 `EdgeView_调整全部大小()`——此前窗口最大化/缩放后 WebView2 子窗口保持创建尺寸、页面缩在左上角（FBro 进程内浏览器不受影响，桥自己撑满窗口）。局部布局的 EdgeBrowser 控件保持设计器矩形不参与拉伸；需要随窗口重排的局部控件仍走「大小被改变」事件 + `控件_设置位置大小` 应用层布局。实测证据见 `AI 视频自主生产/进阶方案/高颜值应用商店-EdgeView/`（最大化 3840×2160 全屏铺满截图）。
- 已完成（2026-09-15）：WebView2 Loader 改静态链接（`WebView2LoaderStatic.lib`，x86/x64 各自从固定版本 NuGet 包物化到模块 `lib/<arch>/` 并进 F5/CLI 与 VS 导出两条链接路径），模块 targets 移除 `runtimeFiles: WebView2Loader.dll`，生成运行时直接调用 `CreateCoreWebView2EnvironmentWithOptions`/`GetAvailableCoreWebView2BrowserVersionString`；F5/CLI 链接统一 `/MANIFEST:EMBED`（不再落外置 `.exe.manifest`）。EdgeView EXE 从此可单文件复制运行（目标机仍需系统 WebView2 Runtime）。
- 已完成（2026-09-15）：窗口模型新增 `embeddedSite: { files, entry?, host? }` 内嵌站点：网页静态文件（≤64 个、单个 ≤32MB、必须位于 entry 目录内）编译为 RCDATA（ID 2101 起，`resources/lbsite-N.bin`），生成 EdgeView 运行时注册 `WebResourceRequested` 对 `https://<host>/*` 从 EXE 内存资源直接应答（按扩展名给 Content-Type、未命中 404），运行期零文件释放；`embeddedFiles`（%TEMP% 释放）语义不变，且资源编译器在 rc 无 ICON 行时不再强制图标文件、释放器在无释放文件时整体不生成（不再建空 %TEMP% 目录）。端到端实测：`AI 视频自主生产/进阶方案/AI智能助手-EdgeView/`、`Cat小助手-EdgeView/`、`抖音助手-EdgeView/` 三个单文件 exe（源码 `T:/UiProject` 三个 Vite 项目），真实鼠标验证无边框窗口、网页标题栏拖拽（dx≈270）、网页按钮最小化/最大化/还原/关闭全链路，%TEMP% 零释放。
- 已完成（2026-09-16）：设计器属性面板新增「当前窗口 / 内嵌站点」编辑组（启用开关、主机名、入口文件、扫描目录 + 文件清单文本框），服务端 `GET /api/window-designer/embedded-site/scan` 递归列出目录内文件（只读、拒越界路径）；纯模型口径集中在 `embeddedSiteModel.ts`（渲染层可安全导入），与生成器门禁同口径校验。实测：AI智能助手-EdgeView 工程面板显示既有配置、「扫描目录」一键回填清单并随设计器持久化。
- 后续优化：双击标题栏最大化与 mousedown 拖拽存在系统模态循环竞争（拖拽捕获吃掉 click 对），双击最大化触发率依赖 postMessage 时序，后续可在生成运行时做拖拽阈值判定（位移超阈值才算拖拽）让双击可靠；内嵌站点面板暂未提供「新建后一键从模板创建 www 目录」的引导，空白工作区用户需先自行放置网页文件。
- 已完成（2026-07-26）：`lingbuilder.edgeview` 按 v2 `contributes.designerControls` 贡献 `Edge浏览器 (EdgeBrowser)`。模块启用后工具箱可添加多个可视占位，设计器 `parentId` 会在生成阶段解析为窗口、容器或选项卡页的真实父 HWND；每个控件使用独立 STATIC 宿主和 WebView2 Controller，空缓存配置按稳定控件 ID 自动生成独立 `.edgeview/<controlId>` 目录。新增按中文控件名创建、导航、JS、事件读取、前进后退、刷新、关闭和动态事件绑定命令，保留原数字实例/区域 API 兼容旧项目；DPI 重建和窗口销毁前会先释放设计器控制器。
- 已完成（2026-07-26）：以 `Microsoft.Web.WebView2 1.0.3537.50` 稳定头文件的 64 个 `add_*` 入口为审计基线，接入普通 HWND 控件可达的 62 项事件，覆盖 WebView、Controller、Environment、Download、Find、Frame、Notification、Profile、DevTools Protocol 和自定义菜单项；2 项 CompositionController 专属事件明确不适用。事件目录集中驱动设计器和模块清单，生成器按版本接口安全降级，事件数据统一为 UTF-16 JSON，等待事件改用分事件计数。完整 x64 MSVC/WebView2Loader 冒烟编译已通过。
- 已完成（2026-07-31）：EdgeView `1.2.0` 增加受管任务五态、取消/释放、`shared_ptr + generation` 实例失效检查和关闭后迟到回调拒绝；旧同步 JS 兼容入口复用任务状态。受管对象表覆盖 Frame、Worker、Notification、Extension、Certificate、SharedBuffer、文件系统句柄和资源对象，句柄永不复用并按控件级联释放。Loader 保持到进程退出。
- 已完成（2026-07-31）：新增设置、会话/Cookie、下载、查找、打印/PDF、截图/Favicon、网页消息、DevTools、资源过滤和同步事件动作接口。导航取消、权限允许/拒绝、脚本对话框、认证、新窗口和下载路径会消费事件结果；未设置结果时保持 WebView2 默认行为。
- 已完成（2026-07-31）：覆盖门禁升级为 SDK `1.0.3537.50` / Runtime 141 与 SDK `1.0.4078.44` / Runtime 150 双基线。995 个稳定方法已分类为 public 330、internal 565、excluded 100、pending 0；禁止未匹配项自动归为 internal。安全层固定排除 CompositionController、PointerInfo、AutomationProvider、实验 API、任意 Host Object 与裸 COM/指针。设计器独立原生预览和 Win32/x64 Release MSVC 冒烟均通过。
- 已完成（2026-07-31）：补齐 Environment/Controller 创建选项、Frame/Worker、Profile/Cookie/扩展/权限、下载/查找/打印、PDF 流、通知、DevTools、资源响应、证书、共享缓冲与附加文件对象。设计器创建期属性明确提示重建；F5 和原生清单按源码调用计算 Runtime 141/150 最低要求，v2 源码包声明 `edgeview.safe-api.v2`。
- 后续优化：打印设置和查找选项目前接受稳定 JSON 入口但只应用安全默认值，后续可在不改变命令签名的前提下扩充完整字段解析；浏览器扩展安装仍需增加明确的用户确认 UI 和签名来源提示。
# 2026-08-01：内置多线程模块 2.0 完整受管闭环

- 已完成：`lingbuilder.threading@2.0.0` 由单一命令目录生成 54 条 contribution/binding/补全/演示，公开 7 个受管类型；原 9 条演示命令和逐任务线程、`batchProgress_`、延时 UI 队列已删除并提供阻断迁移诊断。
- 已完成：`lingValue` 可变参数和 `managedTask` 调用形态接入 manifest 校验、语言服务和生成器。任意多个基础值、文本、字节集、数组、记录及嵌套组合按值深拷贝，工作/进度/完成处理器签名被静态校验，生成 C++17 类型化 lambda，不使用字符串参数包或 `std::any`。
- 已完成：项目级 `LingThreadProjectRuntime` 提供默认/自定义有界线程池、十万任务上限、协作取消、状态/错误/等待/进度、窗口 owner 隔离、80ms 进度合并和完成一次性投递。工作任务自等待和关闭所属池会被拒绝；窗口关闭不会影响其它窗口任务。
- 已完成：项目级非递归定时互斥锁、64 位原子整数/CAS、自动/手动重置事件和有界信号量全部使用不可伪造类别的 64 位受管 ID。销毁会校验持有/等待状态或唤醒等待者，不暴露裸线程、裸 `HANDLE`、裸指针或强制终止入口。
- 已完成：语言服务从全部启用模块 binding 动态识别 `controlRef` 命令并阻断工作处理器调用，同时警告未加锁的类成员/项目全局写入。普通 Win32 使用独立 UI dispatcher 消息适配器；核心线程池和同步实现保持标准 C++17 边界，后续 macOS 只替换 owner/UI dispatcher 与构建 target。
- 后续优化：新增桌面 UI 后端或 macOS target 时必须接入同一 owner/UI dispatcher 契约，并复用现有任务、线程池和同步核心；不得复制第二套状态机或放宽跨线程 UI 限制。

# 2026-07-12：按钮圆角属性与原生绘制一致性

- 已完成：按钮专属属性新增“圆角大小”，允许输入 0～100，默认值为 6；0 表示直角，超过控件短边一半时由设计器和 Win32 运行时共同限制到合法半径。
- 已完成：设计器预览、LingCpp F5/导出生成器和旧原生导出生成器使用同一 `cornerRadius` 属性；普通、悬停、按下、焦点和禁用状态只改变颜色，不改变按钮尺寸或圆角轮廓。
- 已完成：原生按钮圆角改用 GDI+ 抗锯齿路径绘制，启用 `SmoothingModeAntiAlias` 与半像素对齐；大圆角不再使用有明显阶梯的 GDI `RoundRect`，GDI 仅作为 GDI+ 初始化失败时的安全回退。
- 已修复：圆角按钮自绘前不再固定用主窗口背景清理四角，而是解析按钮的实际父容器；选项卡页面使用系统页面背景色，分组框和普通容器使用各自背景色，避免白色页面上的圆角按钮四周露出深色方角。
- 后续优化：切换按钮、分割按钮和命令链接当前仍服从 Windows 原生主题绘制；若以后开放这些样式的自定义圆角，应先统一为完整的 owner-draw 状态模型，不能只覆盖静态外观。
# 2026-07-23：错误列表批量复制与清空

- 已完成：底部错误列表加入与输出窗口一致的右键菜单，可一次复制全部错误、警告和辅助信息，并保留文件、行列、诊断代码、源码片段与修复建议。
- 已完成：错误列表支持右键清空当前汇总诊断，清理编译、质量检查和中文语言诊断三个来源；后续源码或构建状态变化时仍会按现有诊断链路重新生成。

# 2026-07-23：分组框原生外观一致性

- 已修复：分组框运行时标题使用设计器“文字颜色”，不再由 Windows 主题回退为系统默认色；新增“标题对齐”（居左、居中、居右）、“显示边框”“边框粗细”“边框颜色”属性，设计器预览、项目持久化和 LingCpp Win32 F5/导出共用相同字段及默认值。
- 已修复：分组框作为真实父 HWND 时会把子控件的命令、通知、自绘、测量、滚动和颜色消息转发到窗口统一处理器；嵌套的自绘组合框下拉表项不再因 `WM_DRAWITEM` 被分组框截断而显示为空白，选择事件与暗色配色也保持有效。

# 2026-07-23：选项卡设计器与原生外观一致性

- 已修复：选项卡不再使用通用深色容器占位预览；设计器现在按 Win32 `SysTabControl32` 默认主题呈现标签头、当前选中页和浅色页面区域，并与 `tabs`、`selectedIndex` 属性实时同步。
- 已完成：布局树把每个标签页显示为可选择、可接收拖放的独立页面节点；选择页面后新增控件自动写入对应 `containerSlot`，旧的无槽位子控件确定性归入第一页，设计画布只显示当前页子控件。
- 已完成：Win32 生成器为每个标签页创建独立 `WS_EX_CONTROLPARENT` 页面 HWND，子控件改挂到对应页面句柄；页面切换按槽位显示/隐藏 HWND，并把命令、通知、滚动和控件颜色消息转发回主窗口事件链路。
- 已修复：标签页 HWND 同时转发 `WM_DRAWITEM`、`WM_MEASUREITEM` 等 owner-draw 消息，页面内的自绘按钮、组合框和列表控件继续由主窗口统一绘制，不再出现只有背景而文字消失。

# 2026-07-23：网格容器原生背景一致性

- 已修复：LingCpp Win32 生成器不再为网格容器使用强制系统白底的 `SS_WHITERECT`；运行时通过已有 `WM_CTLCOLORSTATIC` 画刷消费设计器模型背景色，深色和自定义背景与可视化设计器保持一致，“显示边框”仍按原有属性生效。

# 2026-07-24：列表框边框与表项间距一致性

- 已完成：列表框专属属性补齐“显示边框”，并保留原有“边框粗细”“边框颜色”；关闭边框时不丢失已设置的粗细与颜色，重新开启后可恢复。
- 已完成：列表框新增 0～24 像素“表项间距”，默认 0 以兼容旧项目；设计器预览、项目属性持久化、原生表项高度、可见表项数量、滚动条计算和 LingCpp Win32 F5/导出链路使用同一字段。

# 2026-07-24：设计器事件单击创建与跳转

- 已完成：控件事件与窗口事件不再要求用户手工输入处理器名；事件卡片统一为单击入口，已绑定事件直接打开现有 `.lcpp` 处理器，未绑定事件按统一命名规则写回设计器模型、生成处理器并跳转。
- 已完成：事件面板显示“已绑定/未绑定”和“打开代码/生成并打开”状态，支持键盘聚焦与回车触发；已有自定义处理器名保持不变，不会被建议名称覆盖。
- 后续优化：若需要在设计器内重命名处理器，应复用 `.lcpp` AST 重命名和设计器绑定的原子 WorkspaceEdit，不再恢复自由文本输入框。

# 2026-07-24：超链接控件原生导航

- 已修复：Win32 `SysLink` 收到鼠标 `NM_CLICK` 或键盘 `NM_RETURN` 通知后，会读取原生通知中的 URL（缺失时回退设计器 `properties.url`）并通过 Windows 默认关联程序打开。
- 已完成：超链接默认导航不依赖中文 `Click` 事件绑定；打开链接后仍继续走统一事件分发，已有 `.lcpp` 单击处理器行为保持不变。
- 后续优化：如需限制自定义 URI scheme，应先为设计器链接地址增加协议校验、中文诊断和项目级安全策略，不能只在生成代码中静默拦截。
- 已修复：超链接背景选择窗口颜色跟随后，设计器不再显示通用控件的蓝色占位底色；Win32 `SysLink` 启用 `LWS_TRANSPARENT`，并在静态控件颜色通知中复用父级颜色与画刷解析。副窗口根级、普通容器和选项卡页面中的透明超链接现在分别跟随自己的实际背景。
- 已修复：部分 Windows 主题即使设置 `LWS_TRANSPARENT` 仍会由 `SysLink` 默认绘制覆盖白底；透明超链接现在统一接管 `WM_PAINT`、`WM_PRINTCLIENT` 和背景擦除，先填充解析后的父级画刷，再绘制链接文字、下划线与键盘焦点框，同时继续让原生控件处理鼠标、回车和通知。

# 2026-07-25：Win32 颜色选择器双模式闭环

- 已完成：`lingbuilder.win32.common-controls` 新增可拖放 `ColorPicker`，设计器预览、专属当前颜色/标题/颜色文本/完整面板属性和 Win32 owner-draw 色块共用同一模型。
- 已完成：可视颜色选择器点击自身打开 LingBuilder 暗色原生弹窗，使用自绘 HSV 色谱、色相条、HEX/RGB、预设色与确认/取消替代旧式 `ChooseColorW`；弹窗使用整窗双缓冲、禁止背景擦除并缓存 HSV 色谱，拖动选色时不再出现背景先清空的闪烁中间帧，HEX 编辑区按字体度量垂直居中；不可视颜色选择器仍进入原生运行时控件表，可由按钮、菜单或其他事件调用 `颜色选择器_打开`，并通过 `颜色选择器_置颜色/取颜色` 保存和读取 COLORREF。
- 已完成：选择过程分发颜色改变、窗口打开、确认、取消和关闭事件；模块补全、binding、生成器与回归测试保持同源。
- 后续优化：当前系统对话框只支持 RGB；如需 Alpha、吸管、最近颜色或内嵌调色板，应新增受测试的自定义弹层，并保持现有 COLORREF 命令兼容。
- 已完成（2026-07-26）：CEF3 浏览器事件体系从 5 个常用事件扩展为 CEF 150 `CefClient`/资源请求侧 92 项完整目录，覆盖生命周期、加载显示、菜单与对话框、输入焦点、下载、权限安全、网络资源、Cookie、音频打印、框架和渲染进程状态；事件目录集中在 `electron/src/services/modules/cef3BrowserEvents.ts`，设计器、模块清单与生成器同源消费。生成运行时新增 `WM_LINGBUILDER_CEF_EVENT` 线程桥：普通通知异步投递，需要返回允许/拒绝/已处理结果的回调同步投递到所属 Win32 窗口线程；音频、下载和加载进度做低频采样。新增 `CEF3_取事件字段`、`CEF3_设置事件结果`、`CEF3_设置事件返回文本`，保留原 5 个设计器事件 ID 与 `CEF3_绑定事件` 兼容。已验证 `tests/modules.test.ts` 36/36、CEF 150 x64 MSVC 真实生成编译通过。后续：离屏渲染 `CefRenderHandler` 像素缓冲/无障碍回调属于另一种浏览器宿主模式，若新增 OSR 控件需独立实现并做 GPU/输入法性能验证。

# 2026-07-27：新手模式项目全局变量与多源码生成

- 已完成：Visual C++ 项目固定使用 `<sourceRoot>/项目全局变量.lcpp`；新项目直接创建，旧项目首次打开入口时仅创建待保存内存文件。项目树、普通可关闭标签、新手表格、专业 Monaco 文本、固定文件删除/重命名保护和中文空/错状态已接通。
- 已完成：解析器、AST、结构编辑、符号索引、补全、悬停、变量诊断、遮蔽警告和智能局部声明共同识别 `全局 <类型> <名称>[] [= 初始值]`；安全初始化只允许字面量、纯运算及前置全局变量，数组首版只允许空值。
- 已完成：F5、解决方案构建、原生预览/导出和 AI Bridge 接收 `lingCppSources`，缺省时从项目源码目录读取全部 `.lcpp`；路径限制在当前 `sourceRoot`，集合大小受限，并保留旧单文件字段兼容。
- 已完成：Win32 生成器聚合全部窗口类，在运行时依赖之后、窗口类之前生成 `LingBuilderProjectGlobals`，输出全局/类/事件/语句逐文件映射，并把原始 `.lcpp` 作为 Visual Studio 非编译项保留。重复类、重复全局、错误声明位置和非法初始化进入阻断诊断。
- 已完成：新手全局变量表中的重命名会同步更新项目内全部内存 `.lcpp`，并跳过字符串与注释；定义跳转及编译错误行可回到固定全局文件和对应表格行。
- 后续优化：为 Monaco 的 F2 重命名补齐跨文件原子撤销与修改预览；若未来引入跨项目公开变量或线程安全包装，必须另行设计 ABI、依赖图和并发语义，不能扩展本轮隐式行为。

# 2026-07-27：新手模式项目自定义数据类型

- 已完成：新增固定 `<sourceRoot>/项目数据类型.lcpp`、项目树虚拟节点、命令面板和新手工具栏入口；新项目直接创建空文件，旧项目首次打开才创建待保存模型。新手编辑器使用类型卡片和字段表格，支持增删改、排序、数组、默认值、说明和中文校验状态。
- 已完成：解析器、AST、符号索引、Monaco/新手类型补全、多级字段补全、字段类型推断、赋值诊断和定义跳转统一消费 `LingCppProjectTypeContext`。字段支持安全基础类型、嵌套项目类型和数组，并阻止非法类型、重名及直接/间接循环依赖。
- 已完成：类型和类型化字段重命名会跨 `.lcpp` 更新并跳过字符串、注释与原生 C++；仍被引用的声明禁止删除。普通 Win32 与 new_emoji 生成链按依赖顺序输出值语义 `struct`，项目全局/程序集/局部/参数/返回值和数组使用同一 C++ 类型映射，类型文件进入源码包、生成清单和 source map。
- 已完成：新手重构使用 WorkspaceEdit 生成逐文件旧值/新值 Diff，只有点击“应用全部修改”并再次通过源文件版本校验后才整体提交；取消或任一文件过期均不产生部分修改。
- 后续优化：可把内联 Diff 提升为工作台统一 Diff 编辑器，并补充磁盘版本戳、单步撤销组及更丰富的字段悬浮 Markdown。对象字面量、序列化、原生结构布局和模块 ABI 仍不在首版范围。

# 2026-07-27：new_emoji 完整目录与模块商业化

- 已完成：上游机器可读目录导出器生成 92 个组件、297 个安全命令、561 个运行时命令和 1566 个精确导出；模块打包强制进行数量、签名、来源和 SHA-256 漂移检查。
- 已完成：设计器窗口后端、命名空间控件注册表、动态工具箱、属性搜索/分组/基础高级切换、隐藏实例创建和 92 个组件的数据驱动原生创建入口。当前 703 个目录专属属性中有 219 个由创建签名直接消费；其余属性在属性面板中锁定并显示诊断，不允许出现“可编辑但生成不生效”的假能力。
- 未完成：上游目录尚未给出 484 个非创建期属性的 setter 参数编组，也未给出 74 个事件到 callback setter/回调签名/事件上下文的可执行映射。LingBuilder 当前不会把这些目录项伪装成已完成；后续必须从 `EmojiCodeGenerator` 与 `exports.h` 提炼正式 runtime mapping，再补齐生成器和 92 控件双架构验收。旧 Upload/DragUpload 回调仅保留旧项目兼容。
- 未完成：new_emoji 生成器当前仍以所选启动窗口生成单窗口 `main.cpp`；同项目多窗口模型可以保存，但混合 Win32/new_emoji 后端的统一进程生命周期、窗口间打开命令和销毁顺序尚未闭环。
- 已完成：云端商品、永久/期限报价、订单、权益、24 小时限免、支付回调幂等、退款撤销、管理员赠送/撤销和访问审计模型；金额使用 bigint 分，时间统一 UTC。
- 已完成：Ed25519 Permit、购买最长 72 小时离线缓存、限免截止约束、时钟回拨检测，以及安装/启用/编辑/F5/预览/导出/AI Bridge 守卫。
- 已修复（2026-08-07）：收费模块 Permit 启动恢复竞态与过期误报。Electron 现在等待本地 API 健康后有界重试安全缓存同步，失败输出中文日志；签名有效但过期的 Permit 保留 `MODULE_ENTITLEMENT_EXPIRED` 诊断，不再退化成“请购买”。云端账号会话可恢复时启动即通过正式接口换发 Permit 并原子更新 `safeStorage`。本机开发账号的永久 `ADMIN_GRANT` 已重新签发，new_emoji + FBro x64 F5 实际运行 10 秒保持响应。
- 未完成：微信/支付宝目前是带签名的外部网关适配器，不是两家官方 SDK 的商户直连；管理后台退款发起和限免独立使用人数报表仍需补齐。正式生产前还必须配置真实网关 URL、Webhook 密钥与稳定 Permit PEM 密钥，并完成支付沙箱回放。
- 已修复（2026-07-28）：FBro F5 空白窗口。原生依赖服务现在可从 `.lingbuilder-build/<project>/x64/Debug` 等深层目录正确定位工作区 SDK；SDK/桥接/运行时缺失或损坏会作为阻断诊断停止 F5 和 AI Bridge，不再编译并启动空白占位控件。修正 FBro 缓存根目录的 C++ 路径分隔符转义，避免把缓存路径拼成 `程序.exe\.fbro-*` 后引发 GPU/网络子进程失败。F5 中间 VS 工程从已校验 `bin` 物化，便携导出工程携带 78 项完整 runtime 和增量脚本。真实 MSVC x64 测试已收到浏览器创建与 `https://example.com` 加载完成事件，错误 VIP Key 同时返回明确授权错误且未泄露 Key。

# 2026-07-29：软件首页与系统 AI 供应商配置

- 已完成：云端前端 `/` 新增纯软件信息首页，管理后台固定使用 `/admin`，设备授权继续使用 `/device`。
- 已完成：管理后台新增“系统 AI 供应商”配置，DeepSeek V4 预设同时建立 `deepseek-v4-flash`、`deepseek-v4-pro`；自定义模式支持 Base URL、Model Name、API Key、OpenAI 兼容协议和 Anthropic Messages 协议。
- 已完成：系统 AI 供应商创建和更新复用公开 HTTPS 校验、Secret Vault 加密、逻辑模型、版本化路由、审计与供应商熔断链路；密钥不回显，编辑留空时保留原密钥。
- 已修复：New_Emoji Tabs 内嵌 FBro 的白色宿主覆盖标签头且浏览器未启动。外部子 `HWND` 现在按 New_Emoji 30 逻辑像素标题栏原点和窗口 DPI 统一换算坐标；FBro 在创建 New_Emoji 窗口前完成 COM STA 与桥接初始化。模块预处理宏改为汇总已启用模块全部 target 的 `defines`，避免仅有 x64 target 的 FBro 因默认 Win32 target 选择而编译为空实现。原生烟雾测试会实际启动 exe，并要求至少三个 FBro renderer 子进程。
- 后续优化：补充供应商连通性测试、模型列表在线发现、点数价格表单和单路由启停/优先级调整；在这些能力完成前不能通过浏览器直连供应商或把密钥下发到 renderer。

## DataGrid v1 后续优化（2026-07-30）

- [x] 独立 Win32 DataGrid 主 HWND、可见单元格双缓冲绘制、临时编辑 HWND 与非阻塞虚拟数据请求已落地。
- [x] 结构化列/行/单元格编辑、10 种列类型、稳定行键/列 ID、TSV/CSV、无需安装 Excel 的首工作表 `.xlsx` 导入导出、排序筛选、撤销重做和事件上下文已落地。
- [x] `win32.datagrid.v1` 源码包能力和 0.2.5 版本门禁已落地。
- [x] 已增加覆盖 92 条命令、16 个专属事件、10 种列类型和 100 万虚拟行的独立示例项目，并用真实 MSVC x64 编译启动验证；动态文本参数通过生成期 `LingCppWideArg` 安全适配。列对齐支持居左、居中、居右，设计器默认居中并生成到原生表头、单元格和临时文本编辑器。
- [x] Switch 与进度单元格已改为和设计器一致的圆角视觉；组合框支持稳定值到中文标签映射、单击展开真实下拉框和选择事件；图片统一从 EXE 相对路径读取，非默认项目资源复制链路已有原生冒烟覆盖。
- [x] Switch/进度圆角进一步改为 GDI+ 抗锯齿；DataGrid 临时组合框使用深色自绘保证普通、悬停和选中项文字可读；图片列与单元格覆盖提供 `tile/contain/cover/center/stretch` 五种真实原生绘制模式。
- [x] DataGrid 进度轨道高度和圆角已接入窗口 DPI 缩放，进度文字改用完整单元格文本区域垂直居中，修复高 DPI 下数字上下被轨道矩形裁切的问题。
- [x] DataGrid 按钮列已改为按当前 GDI 字体测量完整文字宽度，并统一缩放内边距、间距及命中区域；绘制、悬停和点击复用同一布局，修复高 DPI 下按钮文字被截断及点击区域错位的问题。普通、主操作、危险、禁用、悬停和“更多”状态统一使用随 DPI 缩放的 4 逻辑像素 GDI+ 抗锯齿圆角填充与描边，保持紧凑但不再生硬。
- [x] DataGrid 冻结列表头和数据行先绘制不透明背景，再绘制列内容，修复横向滚动列位于冻结列后方时透出的透明区域。
- [x] DataGrid 新手示例改为 9 个选项卡和 86 个单命令按钮，事件上下文类接口放在真实生命周期中；完整包固定输出到 `exports/LingBuilder-DataGrid-All-APIs.lcpppkg`。项目源码扫描和源码包导出会精准排除误建的嵌套 LingBuilder 工作区，避免重复 `MainWindow` 阻断 F5。
- [ ] 后续以实际 10 万静态行和 100 万虚拟行数据源持续采集滚动帧耗时、GDI 对象数与缓存命中率，并根据数据决定是否引入分块索引或 Direct2D 后端。
- [ ] new_emoji 上游 DLL 增加图片单元格 ABI 后，再解除旧 Table 图片列的生成前诊断；本阶段不修改上游 DLL。

## OpenCV 模块后续优化（2026-08-01）

- [x] OpenCV 4.14.0 `core/imgproc/imgcodecs`、Windows MSVC x64 `/MD`、C++17、CPU Bridge、受管句柄、中文路径、基础处理、模板/轮廓和单/双缺口候选已落地。
- [x] `lingbuilder.opencv` 与隐藏 `lingbuilder.opencv.sdk` 家族、逐文件 SHA-256、F5/AI Bridge/原生导出/VS 导出统一物化、x64-only 工程和 `.lcpppkg` 自动携带 SDK 已落地。
- [x] 原生 smoke 已覆盖中文路径、主要图像变换、模板和双缺口坐标、空候选、严格配置、并发读、重复释放、256 对象上限、真实 MSVC x64 编译运行及 DLL 同目录。
- [x] 已新增 OpenCV 全命令演示项目：33 条 binding 全部在 `MainWindow.lcpp` 中有真实调用，设计器使用“基础与图像信息”“预处理与变换”“分析与结果读取”三个 TabControl 页面，并把 33 条命令拆成独立单功能按钮；额外的错误准备按钮也只执行一次失败加载，取错误由另一按钮完成。窗口成员保存图像/结果句柄供后续单命令操作使用，右侧提供结果预览和可见运行日志；源码包输出为 `exports/OpenCV图像处理模块完整演示.lcpppkg`，随包携带项目 PNG 与只读 x64 SDK。
- [x] 已修复 OpenCV 演示“分析缺口”使用普通图标轮廓造成的假演示：项目改用确定性生成的原创拼图缺口图，右侧缺口预设约为 `(330,108,100,110)`，分析按钮仍只调用一次 `OpenCV_分析缺口` 并通过固定 ROI 排除其它图形。原生 x64 smoke 直接读取同一 PNG，断言唯一候选坐标/尺寸，并由 `OpenCV结果_保存标注图` 生成可检查的绿色框选图。
- [x] 已修复资源管理器图片预览把鉴权/路径等 HTTP 失败误报为“图片损坏”的问题：弹窗先通过受控 `fetch` 获取图片 Blob、校验状态码和 MIME，再使用临时 `blob:` URL 解码；服务端诊断会原样显示，Blob URL 在关闭或切换资源时撤销。工作区路径现在作为资源/模块缓存代次，同项目 ID 的多个导入副本之间切换时会清空旧条目、重新请求并丢弃迟到响应。
- [x] 已修复 OpenCV 源码包导入后状态栏显示 x64、F5 却按默认 Win32 校验的问题：OpenCV 现纳入构建配置服务的 x64-only 兼容规则，缺少工作区配置时首次 F5 会自动持久化 x64；工作区切换会重新读取构建配置，`.lcpppkg` 导出也会携带 `.lingbuilder/build-configuration.json`。
- [ ] 后续可在保持 C ABI 和句柄模型不变的前提下增加基于真实授权样本的鲁棒性基准、性能采样和可视化调参工具；样本不得包含未获授权的第三方验证码数据。
- [ ] 如需 arm64、macOS/Clang 或 OpenCL，应新增独立 target、资产清单和端到端验收，不能把 x64 DLL 标记为跨平台兼容。
- [ ] CUDA、DNN、OCR、视频、摄像头和第三方编解码器不在首版范围；未来每项都应作为独立能力/资产评估体积、许可证、部署和安全边界。
- [ ] OpenCV 上游 CPU dispatch 生成器在中文绝对路径下仍可能写出系统代码页损坏的 include 路径。当前 SDK 固定 SSE2 baseline 并关闭 dispatch；后续如迁移到可靠的 ASCII 构建缓存或上游修复，再用性能数据决定是否恢复 AVX2 dispatch。
- [ ] 当前完整 LingCpp Win32 公共运行时受工作区未完成的 FBRO 事件目录重构影响，单独编译会出现 FBRO 类型/常量不一致；OpenCV smoke 已隔离并验证同一 OpenCV runtime、物化和 VS 导出链。FBRO 重构收口后应恢复“完整公共运行时 + OpenCV”联合原生 smoke。

## controlRef 语义后续优化（2026-08-01）

- [x] 全部内置、官方和已安装模块进入逐方法/逐参数审计；当前覆盖 88 个模块、4169 个方法、12168 个参数、1203 个 controlRef，并用摘要锁定目录变化；42 个模块 TypeScript 源文件也进入原始补全/示例/snippet 门禁，不再只验证加载后的归一化结果。
- [x] 新手编辑器与 Monaco 共用补全、缺失/歧义/类型/种类/作用域/引号诊断、快速修复、悬停、引用、重命名和独立语义颜色；Ctrl+单击、右键及命令面板共用稳定 ID 设计器导航。
- [x] C++ 生成和 Win32/new_emoji 后端契约消费同一 binding；第三方清单与 SDK 拒绝文本型控件参数、缺失元数据和带引号示例。
- [x] 安全迁移覆盖主解决方案、模块演示、便携工作区、嵌套导出项目和 smoke `build-request.json` 嵌入源码，只改写唯一解析且兼容的引用；新增只读迁移门禁，真实源码仍有可迁移或无法解析引用时直接失败。
- [ ] 后续模块生态增加新的对象种类或跨窗口引用模型时，应扩展 `controlKinds` / `scope` 枚举和后端适配测试，不得退回名称字符串猜测。

## 构建生成链与字节集（2026-08-01）

- [x] 建立 `BuildStep`、Provider 注册表、构建图和统一 Pipeline；已覆盖拓扑排序、循环依赖、路径越界、取消、进度、原子回滚和输入/Provider/选项/目标/工具链增量指纹。
- [x] manifest v2 增加受控 `build.codeGenerators[]`，拒绝公开 `buildSteps` 和任意命令；未知 Provider、版本不匹配、输出覆盖源码和不支持目标在规划阶段阻断。
- [x] 正式公开 `bytes`/“字节集”，补齐类型目录、赋值/补全/模块校验和 C++ 生成；跨 DLL 统一采用调用方拥有的指针+长度 ABI，真实字节序列的旧 `raw` 给出迁移诊断。
- [x] 接入 `lingbuilder.data.protobuf` 和受控 `lingbuilder.protobuf.protoc`，覆盖 descriptor set、反射句柄、bytes/JSON 往返和固定生成物清单。
- [x] Protobuf 本地 import 纳入输入指纹并复制到构建/导出树；Build Graph 产物先写 staging，再原子提交并在失败/取消时恢复旧文件。
- [x] Protobuf SDK 固定为 27.3.0。`runtime-manifest.json` 逐文件验证大小/SHA-256，并强制包含 `bin/protoc.exe`、头文件、导入库和 DLL；缺失、篡改、版本/架构不符在所有构建入口前阻断，禁止系统回退或联网下载。
- [ ] 通用公开 `buildSteps` 仍待第二套独立生成器完成同一安全、缓存、导出和取消验收后再开放。
- [x] 2026-09-12：真实固定版本 Protobuf SDK 27.3.0 已落地并随安装包附带（`electron/third_party/protobuf`，不入库，`npm run protobuf:prepare` 可重建）：官方 protoc 27.3 + 自建 libprotobuf 27.3 双架构（Release `/MD`、C++17 钉死）+ abseil 20240722.1 单体 DLL；IDE 打开工作区自动铺设到 `<工作区>/.lingbuilder/toolchains/protobuf`。消费侧自动注入 `PROTOBUF_USE_DLLS` + `ABSL_CONSUME_DLL`（缺前者运行期虚表 AV、缺后者 map 哈希 LNK2019），同时链接 `abseil_dll.lib`，全配置强制 `/MD`。`smoke:protobuf-native --require-sdk` 已覆盖真实 SDK 双架构端到端（protoc 生成 → 物化 → 编译生成代码含 map/repeated/bytes → 链接 → 运行 exe）。仍待：独立 Visual Studio 工程（非 F5 管线）对 protobuf 工程的构建验收；未知字段 round-trip 用例。
- [x] （已并入上条）~~补充真实固定版本 Protobuf SDK 的 Win32/x64 原生 smoke~~；离线 fixture 单测仍保留用于无 SDK 环境。

## 剪贴板图片与 GIF 字节集（2026-08-02）

- [x] `lingbuilder.system.clipboard@1.1.0` 已补齐图片字节集读写、图片格式查询和 GIF 原始字节读写，共 10 条命令；`bytes` 在生成工程内确定性映射为 `std::vector<unsigned char>`。
- [x] 普通图片输入接受 DIB/DIBV5 和 BMP 文件字节，写入 `CF_DIB`/`CF_DIBV5`；从 `CF_BITMAP` 读取时转换为受上限保护的 32 位 DIB。GIF87a/GIF89a 不进入静态位图转换，而是写入注册的 `GIF`、标准 MIME `image/gif` 和 `HTML Format`，保留全部动画帧。
- [x] 增加 GIF/DIB 运行时所有权与失败回滚、CF_HTML 偏移、GIF 回退读取、Win32/x64 C++ 生成回归和模块文档；单个图片/GIF 输入限制为 256 MB。
- [ ] 后续可增加 WIC/PNG/JPEG 注册格式的原始编码读写，以及跨平台宿主的剪贴板图片适配；实现前仍需为每种格式定义可复制的 bytes 契约和动画保留语义。

## new_emoji 启动浮层显式触发（2026-08-02）

- [x] `new-emoji-92-tabs-validation` 的对话框、抽屉、信息框、漫游引导和加载控件改为关闭或未激活状态启动；Notification、Message 与 MessageBox 在模型设为 `Collapsed` 时不再由生成器于窗口初始化阶段创建或调用底层 Show API。
- [x] 复用现有按钮和上传事件：普通按钮打开对话框，图标按钮打开抽屉，上传动作再打开信息框、漫游引导、加载、消息提示和确认消息框；事件按稳定控件名查找，避免依赖生成序号。
- [x] 09–16 标签页已为弹窗、抽屉、通知、消息提示、消息框和信息框分别增加同页演示按钮；每个按钮只触发对应组件，瞬时消息仍由底层 Show API 按点击即时创建。
- [x] 已增加生成器回归测试，并通过完整窗口设计器测试、Electron TypeScript lint 和真实 MSVC x64 原生构建。
- [ ] 如果 new_emoji 上游后续为 Message 或 MessageBox 提供可创建但不显示、隐藏或关闭 API，应把当前 `Collapsed` 延迟显示约定升级为正式状态契约，并补齐重复打开、关闭及销毁生命周期测试。

## new_emoji Table 结构化编辑器（2026-08-02）

- [x] 属性面板将基础列标题、基础行数据、高级列配置和高级行数据收敛到统一的“编辑列与行”入口，保留 `dataGridColumns/dataGridRows` 与旧 new_emoji 字段的双向兼容。
- [x] 列编辑支持稳定列 ID、标题、类型、宽度、对齐、移动/删除，以及组合框选项、按钮组、开关文字、进度范围、三态和列行为选项；行编辑支持稳定行键、启用状态、按列类型输入、复制/排序/删除和 Excel/CSV/TSV 粘贴。
- [x] 生成器在旧字段为空时从统一 DataGrid 数据确定性回退生成 `EU_CreateTable` 和 `EU_SetTableData` 参数，空表不会被注入默认列；旧项目仍保留字符串型 Ex setter 的兼容调用。
- [x] 已修复结构化 new_emoji 表格行运行时显示 JSON 的问题：`dataGridColumns/dataGridRows` 或对象型 `tableColumnsEx/tableRowsEx` 不再直接序列化到没有 JSON ABI 的 `EU_SetTableColumnsEx` / `EU_SetTableRowsEx`，统一使用安全的基础列/行数据渲染。
- [ ] 后续可接入 new_emoji 原生表格实时预览、列/单元格样式覆盖和合并单元格布局编辑；在上游 ABI 语义稳定前继续保持当前结构化数据与原始高级字段同步保存。

## new_emoji 单行输入光标高度（2026-08-02）

- [x] 修复上游 `EditBox` 和 `Input` 单行 caret 按控件整体高度绘制的问题，改为按字体行高在文本区域内垂直居中；多行输入仍使用文本布局行 metrics 和滚动偏移。
- [x] 已重新编译并同步 new_emoji Win32/x64 Release DLL/LIB 到模块目录、module-build 镜像和 `new-emoji-92-tabs-validation` x64 Debug 运行镜像。
- [ ] 后续若上游提供独立的字体 ascent/descent 或 baseline API，可进一步统一 EditBox、InputTag 和其它可编辑控件的 caret 视觉基线。

## new_emoji Tabs 17–24 原生布局修复（2026-08-02）

- [x] 修复 `new-emoji-92-tabs-validation` 运行时切换到 17–24 页后出现大块白色错位图形的问题。根因是 Tabs 页面绑定发生在页面子控件创建前，new_emoji 布局树只为当时可见页完成布局；切换页只改变可见状态，页面不会自动重新布局。
- [x] 生成器现在延后 `EU_SetTabsPageElements` 及折叠页隐藏调用，直到所有普通页面子控件和 FBro 子宿主创建完成；每个页面 Panel 仍与 Tabs 同级并覆盖设计器内容矩形。
- [x] new_emoji `Container` 的创建期属性显式调用 `EU_SetPanelLayout(..., 0, 0)`，关闭默认 `fill_parent` 和内容布局扩张，保证运行时尺寸服从设计器宽高。
- [x] 新增 92 控件项目生成回归测试；重新生成 v2 模块并完成 x64 Release MSVC 编译，实机切换 17–24 页截图与设计器布局一致。
- [ ] 后续若上游提供“页面创建后重新布局”或稳定的隐藏页布局 API，可评估将当前延后绑定策略替换为官方生命周期调用，并补齐 DPI/窗口缩放下的多页回流测试。

## new_emoji 17–24 设计器原生样式预览（2026-08-02）

- [x] 设计器的 Link、Icon、Container、Header、Aside、Main、Footer 预览改为消费项目模型中的真实内容、颜色、标题和对齐属性，不再绘制运行时不存在的导航、卡片、进度条和组合占位块。
- [x] 设计器颜色预览统一把 new_emoji 的 `#AARRGGBB` 转换为 CSS 颜色，保持与生成器传给 `EU_SetElementColor`/`EU_SetPanelStyle` 的值一致；Space 运行时不可见，只有选中时显示带中文说明的设计辅助轮廓。
- [x] 新增窗口设计器服务端渲染回归，锁定 17–24 控件不得重新引入合成示意内容。
- [ ] 后续如需要丰富的组合示例，应建模为真实子控件或显式组合模板并由原生后端实现，不能在基础控件预览中隐式伪造。

## new_emoji Layout 透明背景（2026-08-02）

- [x] 通用“背景颜色”和 new_emoji 控件的 `properties.backgroundColor` 现在双向同步；布局、面板等同时声明两种背景字段的控件不再出现界面显示透明但模块运行值仍为白色的分裂状态。
- [x] 模块专属颜色属性加入 `transparent` 选项，Layout 预览使用实际 `backgroundColor` 渲染，不再被固定的设计器面板背景覆盖。
- [x] 窗口设计器回归测试覆盖透明与白色 Layout 预览，保留 new_emoji 默认白色布局的兼容语义。

## 新手模式子程序参数入口（2026-08-02）

- [x] 新增功能代码和自定义事件时可以直接填写类型化参数，改为点击“新增”后一次性写入签名，避免名称输入框失焦时提前生成无参数子程序。
- [x] 普通功能正文也提供“调用功能”入口，按参数签名填写实参；功能库调用自动使用 `功能库名.功能名(...)` 限定形式。
- [x] 解析器、AST 写回、参数默认值规则和 C++ 生成继续共用既有 `LingCppMethod.parameters` 模型；设计器事件参数仍由事件契约校验。
- [x] 新手模式画布对零参数子程序也保留“新增参数”行，支持从右键创建的默认子程序继续补充参数，并把新增/删除/调用操作接入同一签名写回链路。
- [x] 无参数功能调用卡片改为仅保留“插入调用”操作，移除重复的无参数签名、说明和调用预览；有参数调用仍显示签名、实参编辑和预览。
- [x] 新手模式移除“调用功能”面板，避免在事件或子程序标题下渲染额外的调用卡片；参数签名、源码补全和直接调用语法继续保留。

## F5 运行日志面板切换（2026-08-03）

- [x] F5 开始时继续打开“输出窗口 (Output) - 编译与生成”，仅在窗口设计器报告 exe 已成功启动后自动切换到底部面板“调试日志”。
- [x] 编译、代码生成、依赖准备或运行启动失败时保持“编译与生成”页，方便用户直接查看失败阶段和原始输出；新增 UI 回归断言锁定该成功/失败边界。
- 已修复（2026-08-04）：删除输出面板右上角未接入构建状态、配置服务和 F5 链路的 Debug/Release、x86/x64/Any CPU 假选择器。工作区构建模式和架构现在只由状态栏入口写入 `.lingbuilder/build-configuration.json`，避免界面显示与实际构建配置冲突；后续新增构建配置入口必须复用同一 `BuildConfigurationService`，不得维护独立的局部选择状态。

## new_emoji RichList 富列表（2026-08-05）

- [x] 上游 RichList 已作为第 93 个命名空间设计器控件进入 `lingbuilder.new_emoji.ui`；模块生成器在提交目录仍为 92 控件时，会在系统临时目录调用上游 Catalog Exporter 获取当前 93 控件/1618 导出目录，不改写上游工作区。
- [x] 模板 JSON、项目 JSON、选中 key、选择选项、样式、滚动和虚拟项目数均映射到真实 `EU_CreateRichList` / `EU_SetRichList*` ABI；设计器提供消费实际项目 JSON 的专用预览。
- [x] 选择变化和六类语义事件接入原生回调。共享 JSON 回调按稳定 `event` 字段分流，避免一个事件误触发多个 `.lcpp` 处理器。
- [ ] 后续可增加 RichList 模板节点和项目数据的结构化编辑器、JSON schema 诊断及可视化事件载荷查看器；在上游 schema 稳定前继续保留原始 JSON 可复制性。

## 三界面模块运行时控件体系（2026-08-05）

- [x] `LingControl` 增加可选 `tagText`/`tagInteger`，旧项目不升 schema；属性面板区分空整数与 `0`，统一校验 trim、int32 和非空标记的“当前窗口 + 具体类型 + 标记类别”唯一性。
- [x] 设计器保存加载、撤销重做和复制粘贴保留标记；同窗口复制产生冲突时只清空冲突标记并返回中文提示，不阻止控件复制。
- [x] 新手模式和 Monaco 支持具体控件类型局部变量、参数、返回值、`当前窗口`、类型推断、赋值/调用诊断、补全、悬停和定义跳转；常量、数组、成员、项目全局及工作线程传递被阻断。
- [x] Win32 基础 12 项与高级 20 项共用窗口级注册、动态创建、两类标记查找、操作、完整事件绑定/解绑和失效规则，并保持每实例独立主 `HWND`。Grid、ReBar、Pager 排除。
- [x] new_emoji 93 项由结构化目录生成创建器、查找器、通用/专属操作和 918 项事件 binding；真实输入元素 ID 使用类型化 `controlRef(stableId)`，输出指针、请求/数据 ID、索引和数组保持原 ABI。
- [x] 新增 `smoke:runtime-controls-native`，覆盖 new_emoji 93 项目录工程及 Win32 32 项动态控件工程的 Win32/x64 链接。
- [ ] 后续若允许动态控件写回设计器，必须设计明确的用户命令、稳定设计器 ID、撤销事务和源码/模型冲突预览；当前禁止自动持久化。
- [ ] 第三方 UI 模块接入 `runtimeControl` 前，需补模块 SDK 脚手架和跨后端容器兼容预览；schema 已允许声明，但不自动推断或强制迁移现有模块。

## new_emoji + FBro 浏览器外壳（2026-08-06）

- [x] new_emoji 模块升级到 `2.0.0` / 最低 LingBuilder `0.3.0`，93 个控件和 3784 条 contribution/binding 从上游定义与设计器目录生成；`module:new-emoji:check` 已覆盖临时生成、module-build、安装目录和 `.lbmod` 的逐文件一致性。
- [x] `LingWindowModel.windowFrame`、`system | browserShell | custom` 预设、`0x3F` 浏览器 flags、四边缩放边框、圆角及旧模型迁移已进入服务层和属性面板。
- [x] 上游函数指针回调生成 `handler + handlerSignature`，`.lcpp` 使用 `&处理器名`；结构化集合使用 `recordList`，跨控件关系使用带约束的稳定 `controlRef`，原生生成按“先创建、后解析关系”两阶段执行。
- [x] new_emoji 窗口适配器已覆盖 18 个共享窗口事件、取消关闭和事件尺寸/DPI/状态读取；浏览器模板在 `SizeChanged` 与 `DpiChanged` 中统一重排控件、FBro HWND、弹层锚点和命中区域。
- [x] 新增 `lingbuilder.new_emoji.fbro-shell@1.0.0` 与 `new-emoji-fbro-browser-shell` 模板。每标签使用稳定 ID、独立 FBro 句柄和宿主 `HWND`；`BrowserViewport` 仅保留加载/错误占位语义，F5、原生预览和 VS 导出共用同一生成链。
- [x] 新增本地 HTTP fixture x64 原生 smoke，覆盖多标签导航、选择、重排、标题/地址/加载状态、10 秒存活、运行时哈希、正常关闭和无残留 FBro 进程。
- [x] 浏览器外壳模板已按 `chrome_shell_demo.py` 的 1180 x 760 结构补齐 Chrome Tabs、独立新建标签、Omnibox、下载/扩展/更多菜单、右键菜单、弹层和自绘窗口控制；`demo:new-emoji-fbro-shell:export` 会建立隔离工作区，生成、导出、回读和导入验证 `exports/new_emoji-FBro浏览器外壳完整复刻.lcpppkg`，确保分享包携带真实 `.lcpp`、设计器、x64 配置、new_emoji 和 FBro SDK 资产。
- [x] 修复 `WS_EX_LAYERED` new_emoji 主窗口与 Chromium 子 HWND 的 DWM 合成冲突：浏览器外壳每标签改用 `WS_EX_TOOLWINDOW + WS_POPUP` 非分层伴随宿主，并同步 BrowserViewport 的屏幕坐标、DPI、主窗口显隐/最小化/恢复和销毁。模板根 `Container` 显式 `flowEnabled=false`，避免流式布局吞掉标签栏和地址栏；弹层打开时受控隐藏宿主。原生 smoke 新增 owner/style/矩形、单一可见标签和顶部/网页像素门禁。
- [x] 修复浏览器模板局部变量初始化被 C++ 声明提升后造成的标签按钮错位：派生布局值改为声明后按顺序赋值，Tabs 宽度收缩为实际标签总宽度，顶部剩余区域恢复窗口拖拽；标签同步通过窗口消息在控件事件结束后刷新 BrowserViewport 与拖拽命中区。所有新标签默认打开 `https://www.baidu.com`。
- [x] `new-emoji-fbro-multi-browser-manager` 的真实 FBro 独立子窗口不再与设置页重叠。右侧使用浏览器工作区与配置工作区两个稳定 Tabs 页面；浏览器实例页由运行时按稳定 ID 动态创建，不预置固定 Host 数量，左侧 RichList 与隐藏表头 Tabs 同步。进入配置页必须先隐藏全部 FBro HWND，返回后仅显示当前实例。以后新增 FBro 管理表单时继续使用独立页面或原生伴随窗口，禁止覆盖在 embedded Chromium HWND 上。
- [x] 新增 `new-emoji-fbro-listbox` 固定三实例演示：new_emoji ListBox 使用 `browser-baidu`、`browser-bing`、`browser-github` 稳定 key，`.lcpp` 选择回调通过类型化 `FBro_显示` / `FBro_隐藏` 映射到三个独立 FBro 宿主和缓存目录。原生 smoke 覆盖生成映射、MSVC x64 编译、三个 renderer 存活及实际 ListBox 点击后的单一可见宿主切换。
- [ ] macOS、ARM64 和其它浏览器后端尚未实现；后续必须新增独立 target、平台桥接与原生验收，当前继续在生成前返回明确不支持诊断。
- [x] 浏览器外壳已完成稳定 ID、LocalAppData 独立 Profile、原子实例清单与备份恢复；重命名不改变 ID/Profile，恢复保持顺序、地址和开关状态。
- [ ] 后续可增加下载管理和自动化可访问性测试；这些能力必须继续复用稳定标签 ID、受控命令和 FBro 生命周期，不得把 `BrowserViewport` 升级为第二套网页渲染器。

## Aria2 模块（2026-08-15）

- [x] 新增内置 `lingbuilder.net.aria2` v2 模块，提供中文异步下载任务、状态/进度/字节数/速度/保存目录查询、安全打开任务目录、等待、停止和释放命令。
- [x] 生成器通过受控 C++ 运行时启动 EXE 同目录的 aria2c 子进程；使用 Job Object 回收子进程，限制协议、连接数、分段大小和文件名，禁止任意命令行注入。
- [x] F5 与 Visual Studio 导出统一复制并校验 `aria2c.exe`、GPLv2 `COPYING` 和 `NOTICE.md`；当前 target 为 Windows MSVC x64。
- [x] 完整演示源码包使用 500ms 定时刷新进度条、速度、字节数和可换行的实际保存目录；并发页在 TabControl 可见内容区可设置公共地址/保存目录以及 1/8/16 连接的独立文件名，三条任务各自有进度、完成目录和独立目录打开按钮。完成时仅记录一次目录日志；所有“打开下载目录”按钮只接受相应 `Aria2任务` 句柄，真实 x64 Release 编译、包完整性检查及临时导入回读均已通过。
- [x] `Aria2_下载` 新增可选 `&下载进度` 处理器，签名固定为 `(Aria2任务, 整数型, 长整数型, 长整数型, 长整数型, 文本型) -> 空`；运行时合并 aria2 输出后经窗口消息回调，速度优先解析 `DL:` 字段，避免预分配或随机写入时文件长度始终不变而显示 0 字节/秒。原生 smoke 使用 3 MiB 限速 Range fixture 验证实际回调、非零速度、进度和最终字节数。
- [ ] 后续可增加 JSON-RPC 多任务控制和 macOS/Linux 原生实现；新增能力必须先扩展模块 binding、权限边界和跨平台 target，不能让 AI 直接暴露 aria2 原始选项。

## 窗口边框样式属性（2026-08-16）

- [x] 设计器窗口模型新增 `borderStyle`（7 值枚举：无边框/普通可调/普通固定/窄标题可调/窄标题固定/镜框式可调/镜框式固定）与 `borderlessDraggable`（无边框拖动开关）；`resizable` 由枚举派生，不再是独立编辑入口。统一样式映射模块 `windowBorderStyle.ts` 作为"枚举 → Win32 样式"唯一事实来源，生成器、画布、测试全部消费。
- [x] 旧项目迁移：无 borderStyle 时 resizable=false → 普通固定边框，否则普通可调边框；行为与旧代码等价且幂等。
- [x] lingCpp 与 native 两个 Win32 生成器接入边框样式：C++ WindowSpec 增 borderStyle/borderlessDraggable 字段、注入 LB_WindowBorderStyleToDwStyle/DwExStyle 辅助函数、Open() 样式计算替换硬编码、CreateWindowExW exStyle 接入、无边框拖动（WM_NCLBUTTONDOWN/HTCAPTION + ChildWindowFromPoint 命中判定）、无边框默认位置工作区居中+级联回落（修复 WS_POPUP 的 CW_USEDEFAULT 坍缩）、captionKind 三档高度扣减、ApplyWindowAppearance 无边框跳过标题栏颜色。
- [x] 属性面板新增"边框"下拉与"允许拖动移动窗口"开关；画布标题栏按 hasCaption/captionKind 条件渲染（无边框无标题栏、窄标题 h-5、镜框式双边框描边）；"禁止拖拽调整大小"复选框移除，"禁止窗口最大化"无边框时禁用。
- [ ] 后续可补 `.lcpp` 运行时命令（如 `窗口_设置边框`）；spec 序列化侧 `TITLE_BAR_HEIGHT` 为近似扣减，运行时由 `AdjustWindowRect` 精确计算，如需画布与原生像素完全一致可精确化。
- [ ] `generateWindowXml` 导出目前只写双布尔（禁止拖拽/最大化），thin-title/frame/none 七值信息有损退化为 normal 类；后续应补 XML 边框样式输出（XML 无导入解析端，单向导出不自相矛盾）。

## FBro 未启用项目的生成回退（2026-08-16）

- [x] `fbroBrowserManagerRuntime` 在项目未启用 `lingbuilder.fbro.browser` 时生成无操作回退接口。它隔离发行 SDK 可见性与项目模块上下文的异常不一致，防止 `浏览器管理器_调整页面`、控件重建或关闭检查等调用在 MSVC 中报 C3861；完整 FBro 模块仍使用原有运行时实现。

## AI 源码与窗口设计器统一编辑（2026-08-19）

- [x] 内置 AI 的系统 AI、BYOK、AI Bridge 和 MCP 编辑请求统一传递完整 `designerProject`；涉及窗口/控件/布局时要求模型返回完整设计器模型，并与完整源码文件草稿组成同一份可预览提案。
- [x] 本地提案校验窗口、控件、资源 ID、名称、类型、坐标尺寸、父子引用和进度条值同步，默认禁止未明确请求的窗口/控件删除；确认后 Electron 状态、设计器刷新事件和受控文件写入同步更新。
- [x] AI Bridge 应用阶段始终重新读取磁盘设计器模型，并拒绝调用方快照或提案生成后发生的外部修改；源码与 `window-designer.json` 使用同一原子暂存/替换事务。
- [x] 2026-08-20：设计器校验兼容已启用模块控件、旧项目 `Upload` / `DragUpload` 和原模型中原样保留的未知类型；AI 提案、系统草稿和应用接口统一捕获模型校验/版本冲突并返回中文 HTTP 错误，避免一次非法 AI 响应导致 renderer server 和 Electron 连带退出。
- [x] 2026-08-20：修复“美化界面”等布局请求因 AI 输出 schema 未将 `designerProject` 设为必填而被本地安全校验拒绝的问题。BYOK 生成端现在与提案校验共用布局关键词判断，布局 schema 强制完整设计器对象并将输出预算提高到 32000；源码-only 请求仍可省略设计器模型。系统 AI/AI Bridge 继续复用同一完整对象契约，避免源码与设计器静默分叉。
- [x] 2026-08-20：AI 应用提案现在强制校验 `projectId` 与设计器模型 ID 相同，并按当前嵌套工作区项目读取 `window-designer.json`；模型完全未变化时拒绝显示“应用成功”。确认应用后源码和布局会显式走同一保存流程，避免只更新 renderer 内存导致重启后界面恢复原样。
- [x] 2026-08-20：针对“界面太乱、帮我美化”等宽泛请求，BYOK 规划提示现在要求至少三项真实视觉属性变化；检测到模型原样返回时自动纠正重试一次，仍无变化则使用保守的本地颜色、字体和按钮圆角回退，仍需预览确认，不删除控件或改变 ID/事件绑定。
- [x] 2026-08-20：美化回退已下沉到统一 `proposeLingCppEdit` 校验层；未配置 API Key、系统 AI 草稿缺少 `designerProject` 或 BYOK 重试仍返回原模型时，都会生成同一份源码不变、布局可预览的本地视觉提案，不再误报“未返回完整设计器模型”。
- [x] 2026-08-20：系统 AI 云端 `parseEditDraft` 同步识别宽泛美化请求；模型缺少或原样返回 `designerProject` 时，在云端 SSE 草稿阶段生成保留 ID/事件绑定的视觉回退，普通布局请求继续严格阻断，避免错误在到达本地 Electron 前被云端吞掉。
- [x] 2026-08-20：兼容尚未升级的云端 SSE 草稿：Electron 按云端请求 ID 保存原始用户提示词，`edit_draft` 缺少 `instruction` 时仍能识别“界面太乱/美化”等请求并进入本地视觉回退；请求完成或失败后清理会话提示词，避免跨请求串用。
- [x] 2026-08-20：修复活动文件分流误判：布局/美化提示不再要求当前文件必须是 `.lcpp`；只要存在完整设计器模型，即使用户打开 `config.ini` 或 `.cpp` 也会走源码与设计器同步编辑提案。系统 AI 的有限上下文优先包含当前文件和项目内 `.lcpp` 文件，并新增回归断言。
- [ ] 后续为嵌套工作区增加端到端 Electron smoke，覆盖 `src/<workspace>/.lingbuilder/projects/<projectId>/window-designer.json`、设计器画布刷新、重启恢复和多窗口并发版本号。
- [ ] 后续将 `/api/lingcpp/edit/apply` 的浏览器端状态应用与磁盘版本校验抽到共享 `WorkspaceEditService`，并为源码、设计器、恢复文件增加跨进程版本号，避免多个 IDE 窗口同时编辑时只能依赖 JSON 快照比较。

## 设计器交互性能（2026-08-22）

- [x] 窗口尺寸调整和非可视资源拖动改为 requestAnimationFrame 临时预览，鼠标释放时才提交项目模型，避免每个 mousemove 序列化完整设计器项目、触发跨组件通知和自动保存。
- [x] 控件移动和缩放预览改为 DOM 合成层更新：移动使用 `translate3d`，缩放使用 `translate3d + scale3d`，拖动帧不再写控件 `width/height`，释放时一次性恢复最终布局属性。
- [x] 窗口尺寸预览只调整带 `contain: layout paint size` 的外框并裁剪旧画布；画布真实 `width/height`、窗口模型和自动保存均延迟到释放时提交，交互期间使用独立预览边框反馈尺寸。
- [x] 控件选中状态改用按项目隔离的轻量选择缓存，选择变化不再序列化完整项目、广播 `WINDOW_DESIGNER_PROJECT_UPDATED` 或触发模块上下文刷新；项目保存仍会一次性同步完整状态和选择游标。
- [ ] 后续继续把画布控件绘制拆分为稳定层与交互层，并对 100+ 控件设计器做浏览器 Performance trace，重点检查阴影、渐变背景、层级重排和属性面板联动。
# 2026-08-16 Bug 修复

- 已修复：普通 Win32 F5 生成器对 `如果 (文本变量 = "值")` 的解析遗漏单等号，导致生成 `std::wstring` 与窄字符串赋值表达式并触发 MSVC C2679。表达式规则现将单等号规范为宽字符串 `==` 比较，并由回归测试锁定。
# 2026-08-16 编辑器颜色修复

- 已修复：新手编辑器条件表达式中的局部变量引用沿用旧蓝色 token，与局部变量声明表的绿色标记不一致。深色/浅色主题的 `variable` token 现统一使用局部变量绿色。

## Windows DLL 项目类型（2026-08-18）

- 首版已完成：新增 `windows-dll` 解决方案项目类型、创建模板、DLL C ABI 示例、DEF 导出定义、manifest 和 Visual Studio 工程；欢迎页已提供可用入口。
- 首版构建复用受控 `ExternalProjectService`/MSBuild，并在成功后校验 DLL 与 import lib 两个产物。DLL 不依赖窗口设计器或 `.lcpp` Win32 EXE 生成链。
- `.lcpp` 已接入 DLL 模板的新手编辑器链路：`DllApi.lcpp` 可编辑、保存、诊断并作为首个导航源码；当前仅把 `获取接口版本()` 的整数返回值确定性映射到示例导出函数，尚未把任意中文过程自动展开为 DLL ABI。
- DLL 项目不返回假的 `designerProject`，AI/CLI 创建预览只提供源码、配置和工程文件；窗口能力后续应通过明确的宿主回调/导出契约实现，禁止在 `DllMain` 中启动消息循环。
- 当前 PowerShell 默认 PATH 未包含 `cl.exe`、`msbuild.exe` 和 `dumpbin.exe`，但已从 Visual Studio 2022 Community 安装目录直接定位 MSVC 14.44.35207；Win32/x64 Debug 的真实编译、`dumpbin /exports`、`LoadLibrary`、`GetProcAddress`、cdecl 调用和 `FreeLibrary` smoke 已通过。`cmake.exe` 仍未安装；后续需补 Win32/x64 Release 验收和自动化工具链定位。
- 后续优化：用 `vswhere` 完善 MSVC 自动定位和安装实例选择、增加 DLL 导出符号检查、调用方示例工程、二进制依赖哈希物化和跨平台动态库 target；这些能力必须继续通过平台接口隔离，不得把 Windows 实现扩散到工作台服务。
# 2026-08-19 已完成

- 修复 F5 构建对 `controlRef` 裸控件名的误报：局部变量初始化表达式现在消费当前窗口设计器控件符号，`控件_取数值(进度条1)` 等合法代码不再被报告为“引用了未知名称”。真正缺失或类型不兼容的控件仍由统一控件引用诊断阻断。

## 项目源码扫描边界（2026-08-20）

- [x] 解决方案文件服务、F5 后端和 AI Bridge 统一排除 `.lingbuilder-build`、`generated/cpp` 及其它已知构建/工具产物目录，避免项目源码根目录为完整工程目录时把生成的 `.lcpp` 副本再次聚合。
- [x] 增加源码根目录内同时存在真实源码、Debug/Release 生成副本和导出副本的回归测试；保留磁盘产物，不做自动删除。
- [ ] 后续将源码收集守卫扩展为可配置的项目级构建输出清单，并让外部项目/插件贡献的输出目录在注册时声明为不可索引路径。
# AI 编辑请求点数预扣（2026-08-22）

- [x] 修复编辑请求默认按 24,576 输出 token 预扣导致余额不足的问题；未指定上限时最多按 8,192 token 预扣，并继续按模型上限和实际用量结算。
## AI 普通问答与编辑意图（2026-08-22）
- `.lcpp` 当前文件不再自动触发编辑提案；只有用户明确表达修改、修复、重构、生成代码等意图时才进入可审阅编辑流程，普通问题（例如“1+1”）走聊天回答。
- AI 对话消息的开发者标签与正文必须保持可读对比度，暗色主题使用浅蓝色文字，禁止使用低透明度导致难以阅读的标签。
- AI 消息正文必须允许文本选择，并提供右键“复制消息”；复制操作不得修改会话内容。
- AI 会话面板提供“清除当前上下文”和“新建 AI 会话”，两者同时注册为 CommandService 命令；历史会话按项目持久化并可切换查看。

## SDK 下载清单云端配置（2026-09-01 已实施 P0–P4）

- [x] 整条清单远端替换（Ed25519 签名 + sequence 防回滚 + 锚定字段逐字回显）：云端 3 端点、admin「SDK 下载源」页、IDE `sdkCatalogRemote.ts` 拉取验签合并、门禁脚本 `npm run sdk-catalog:check`、SDK 面板显示清单来源与 sequence。设计文档 `docs/SDK按需下载直链云端配置设计.md` 已标注各阶段状态与实施偏差（配对密钥变量、Ed25519 sign/verify 第一参必须为 null、criticalFiles 按 relativePath 列表比对）。
- [ ] 当前 IDE 信任锚为空（远端禁用，行为与旧版一致）；启用需：云端 Prisma db push 建 `SdkCatalogRelease` 表 → 配置 `SDK_CATALOG_PRIVATE_KEY_PEM`/`SDK_CATALOG_PUBLIC_KEY_PEM` → 公钥+keyId 固化进 `catalogTrustAnchors.ts` 发版 → 发布首个清单并跑门禁。步骤见 `docs/SDK下载清单发布流程.md`。
- [ ] 门禁脚本接入 CI（依赖上条云端建表后线上清单可用）；`SDK_CATALOG_TRUST_ANCHORS` 未来支持多锚点轮换时必须走 IDE 发版，不得引入运行时换根通道。

## 2026-09-01 追记（P6 模块 Permit 信任根）

- 已完成：模块 Permit 信任根从「服务端下发 PEM 即信任」改为 IDE 内置锚点（`electron/src/services/modules/modulePermitTrustAnchors.ts`，钉生产密钥 `0e2853e87a4250d3`）+ 云端轮换列表 `MODULE_PERMIT_ACCEPTED_KEY_IDS`（`/v1/modules/permit-key` 返回 `acceptedKeyIds`，仅元数据）；云端已部署并容器内验证。详见 AGENTS.md「模块 Permit 信任根规则」。
- 后续待办：后续如新增第二条收费模块或扩展 Permit 载荷（policyVersion 迁移、离线宽限期），应沿用本锚点模式扩展，不要恢复服务端换根路径。

- 2026-09-02��.lbmod ģ�鰲װ�ѽ��� Electron �ٷ��Ϸ�·�����ļ�ѡ�񡢵�ʵ�������������ܿ�Ԥ���¼��������ɼ����������� UI ״̬����ԭ����װ���ع���֤��

- 2026-09-02 ���䣺ģ�鰲װ��������ʾ��ȡ��У�顢Ԥ������װ���ɹ�/ʧ��״̬���ļ��������ü����Զ��ع���ԡ�

# 2026-09-02 动态图像控件 GIF 内存回收

- 已修复：Win32 动态图像控件逐帧替换 GIF 位图时，先从 STATIC 控件解绑旧 HBITMAP，再按运行时持有句柄显式 DeleteObject；控件销毁时也先解绑并清理资源，避免 GDI 位图在播放期间或重建窗口时持续累积。
- 影响范围：electron/src/services/windowDesigner/lingCppWin32Project.ts 生成的 Win32 原生运行时；覆盖自动播放、循环播放、DPI/控件重建和窗口销毁路径。
- 后续验证：补充生成器回归断言；需在 Windows 原生 smoke 中使用多帧 GIF 观察进程私有字节和 GDI 对象数量是否稳定。

# 2026-09-04 F5 中文代码宽字符串调用修复

- 已修复：普通 Win32 生成器的 控件_添加项目 运行时此前只接受 const wchar_t*，而 .lcpp 宽字符串表达式可能确定性生成 std::wstring，导致 MSVC C2664 编译失败。运行时现提供 std::wstring 兼容重载并转发到原始实现，保持后端调用 ABI 一致。
- 影响范围：lectron/src/services/windowDesigner/lingCppWin32Project.ts 生成的普通 Win32 C++ 运行时；覆盖组合框/列表框项目追加及由变量、函数返回值产生的文本参数。
- 后续新增 wideString 运行时命令时，必须同时检查生成器表达式结果与所有后端声明，优先在运行时层提供明确重载。

- 2026-09-04 补充：动态图像控件改为持久双缓冲 DIB 自绘；定时器仅推进帧索引并触发无擦除重绘，避免逐帧 STM_SETIMAGE 导致 GDI 句柄增长和闪烁。

# 2026-09-05 FBro 教程示例项目实测暴露的问题

制作《FBro 指纹浏览器合集》11 集示例项目时实测到以下问题，均已在示例侧绕开并记录，尚未修复源头。

## 1. 未授权环境下 `FBroVIP_取授权信息JSON()` 导致进程直接退出

- 现象：没有有效 VIP 授权时调用该命令，生成的 exe 立即退出，没有中文诊断、没有 stderr。注入
  `LINGBUILDER_FBRO_VIP_AUTHORIZATION_CODE` 后同一二进制一切正常。
- 影响：任何面向普通用户的示例都不能调用它——未授权用户一点按钮程序就没了。
- 现状：第 04 集示例改用 `FBro指纹_取调用次数` + `FBroVIP_取已应用配置JSON` 两个不会崩溃的脱敏入口。
- 建议：无授权时应返回空文本或错误码，并通过 `FBro_取最近错误` 给出中文诊断，绝不能让宿主进程退出。

## 2. `FBro指纹_应用配置` 的返回码语义与直觉相反，且无效 JSON 不给诊断

- 实测：已授权 + 合法脱敏夹具返回 `1`；残缺 JSON（如 `{"device":`）返回 `0`，且 `FBro_取最近错误` 可能为空。
- 影响：按「0 即成功」写的代码会把失败当成功；文档与口播里的「失败会留下中文诊断」目前不成立。
- 建议：统一返回码语义并补齐解析失败的中文诊断。

## 3. 同机并存的 FBro 实例会让新启动的程序主窗口长时间不显示

- 现象：只要机器上还有别的 `LingBuilderPreview` / `LingBuilderFbroHost` / `FBroSubprocess`（尤其是上次强杀残留的），
  新启动的 FBro 程序进程存活但主窗口 150 秒内都不出现；清空这些进程后同一 exe 立刻正常。
- 影响：批量验证、CI 并行、用户同时开两个 FBro 程序都会踩到；本次调查里它一度伪装成
  「about:blank 不能用」「多个进程内控件不能共存」等假象（这两条经清场后复测均已证伪）。
- 建议：排查 FBro SDK 的多实例判定（`enable_auto_multiple`）与全局缓存加锁路径，至少要有超时与中文诊断。

## 4. 强制结束主程序不回收 Host 与渲染子进程

- 现象：`Stop-Process` 掉主 exe 后，`LingBuilderFbroHost` 与 `FBroSubprocess` 仍在运行，占住
  `bin/.fbro/**`，下一次构建清理产物目录时报 `EBUSY: resource busy or locked`。
- 建议：Host 应监听父进程句柄，父进程消失时自行退出。

## 5. 语言服务把字符串字面量里的 `a.b(` 当成功能库调用

- 现象：`.lcpp` 里写 `文件_写入文本(路径, "document.getElementById('x')…")` 会报「找不到功能库“document”」并阻断构建。
- 原因：`functionLibraryService.ts` 的 `scanQualifiedCalls` 只 `stripLineComment`，没有像同文件的
  `analyzeFunctionLibraryDependencies` 那样先 `stripCommentsAndStrings`。
- 现状：示例里的内嵌 JS 全部改成 `document['getElementById'](…)` 括号取属性来绕开。
- 建议：`scanQualifiedCalls` 与 `scanUnqualifiedCalls` 统一先剥离字符串。

## 6. `到文本(...)` 参与拼接时容易生成有歧义的 C++

- 现象：一个表达式里出现两次 `到文本(...)`，或 `到文本(...)` 与 `std::wstring` 相加，MSVC 报
  `C2666: 重载函数具有类似的转换`；用户只看到原始 C++ 报错，没有 LingBuilder 级诊断。
- 原因：`LingCppTextValue` 同时有 `operator const wchar_t*()`、两个成员 `operator+` 和两个友元 `operator+`，
  再叠加 `std::wstring` 的标准 `operator+`，候选集互相「转换相似」。
- 相关：CDP 与部分标准库命令返回 `const wchar_t*`，`"字面量" + 命令()` 会直接变成指针相加（`C2110`）。
- 建议：收敛 `LingCppTextValue` 的转换与运算符重载（例如去掉隐式 `operator const wchar_t*`，
  或让所有 wideString 命令统一返回 `LingCppTextValue`），并在语言服务层对这两种写法给出中文诊断。

# 2026-09-06 EdgeView 教程示例项目实测暴露的问题

## 1. 同步版 `EdgeView_执行JS控件` 在 WebView2 事件回调里必然超时返回空文本

- 现象：`事件 _浏览器控件_导航完成()` 里调用 `EdgeView_执行JS控件(浏览器控件, "document.title")`，
  处理器确实执行了（`控件_设置文本` 把状态条清空），但返回值恒为空串；同一个调用搬到
  `_运行按钮_被单击` 里立即返回 `"LingBuilder EdgeView 测试页"`。原生 exe 的调试输出在 15 秒后打出
  「EdgeView 执行 JavaScript 失败或等待返回值超时。」
- 原因：`EdgeView_执行JS实例` 用 `PeekMessageW` + `MsgWaitForMultipleObjects` 自建嵌套消息泵等
  `ExecuteScript` 完成回调；而 WebView2 的 `add_NavigationCompleted` 回调本身就在 UI 线程的
  WebView2 分发栈上，泵不出自己的后续回调，只能等满 15000ms 超时。
- 现状提示：教程侧已绕开——第 01 集把标题读取放在按钮点击事件里；需要同步返回值的脚本调用一律不要写进
  浏览器事件处理器。
- 建议：`EdgeView_执行JS实例` 检测到当前处于 `EdgeView_记录事件` 派发栈内（`eventDecisionActive`
  或新增的派发深度标记）时，直接给出中文阻断诊断并提示改用 `EdgeView脚本_执行详情异步` + 完成处理器，
  而不是静默等 15 秒返回空串。语言服务侧也应能对「事件处理器内调用同步等待类命令」给出非阻断提示。

## 2. `.lcpp` 里 `事件 _控件名_事件名()` 命名约定不会自动绑定 EdgeView 控件事件

- 现象：第 01 集源码原本写着 `事件 _浏览器控件_导航完成()`，设计器模型里 EdgeBrowser 控件的
  `events` 为空，生成的 C++ 只有处理器函数和分派表，没有任何地方注册它 —— 这是一段永不执行的死代码，
  且诊断面板不报错、错误列表为 0。
- 原因：普通 Win32 控件走 `GetEventHandler(*control, eventId)` 的设计器事件槽；EdgeView 控件的中文事件
  必须显式调用 `EdgeView_绑定控件事件(控件名, "导航完成", &处理器)`（第 05、12 集就是这么写的）。
  两套绑定机制同名不同路，靠命名约定猜不到。
- 建议：要么让生成器在设计器模型缺少事件槽时给出中文诊断「处理器 `_<控件>_<事件>` 未绑定，
  请在设计器事件页登记或改用 `EdgeView_绑定控件事件`」，要么统一由生成器把符合
  `_<控件名>_<事件中文名>` 约定的处理器自动写入控件 `events`。两种都行，但不能继续静默。

## 3. 教程示例项目仍残留公网/伪域名地址

- 现状：`generate-edgeview-tutorial-projects.ts` 第 12 集导航 `https://demo.lingbuilder.local/capstone`，
  该虚拟主机从未注册，F5 后必然导航失败；第 02 集的 Cookie 域同样写死 `demo.lingbuilder.local`
  （只作 Cookie 作用域、不导航，暂不影响画面）。`builtinModules.ts` 的 EdgeView 补全片段与
  `EdgeView_创建` 示例仍默认 `https://example.com`。
- 建议：综合项目改成与第 01 集一致的 `EdgeView导航_设置虚拟主机` + 本地 `assets/capstone.html`；
  产品级默认补全片段是否去掉公网地址属独立决策，需产品确认后再改。


## 4. EdgeView 第 07 集样板复核结论（2026-09-06 实测）

以下每条都在本机 Electron + MSVC + WebView2 Runtime 141 上实测复现，不是推断。

### 已修复

- **第 12 集公网/伪域名（对应 §3）**：生成器已改为 `EdgeView导航_设置虚拟主机(浏览器控件, "capstone.local", 路径_转绝对路径("assets"), 1)`
  + `https://capstone.local/capstone.html`，资源过滤器同步改成 `https://capstone.local/*`，并启用 `lingbuilder.fs.path`。
  同时把 `导航完成` 回调里的同步 `EdgeView_执行JS控件` 移到 `_运行按钮_被单击`，回调只读 `EdgeView事件_取字段`。
- **生成器整目录删除会吃掉用户文件**：`writeEpisode` 原先 `fs.rm(示例项目, {recursive:true})`，实测重跑会删掉 IDE 生成的
  `*.lbsln`；CEF3 示例还证明 `.lingbuilder/build-configuration.json` 同样是 IDE 写的。已改为 `clearGeneratedFiles`，
  只删生成器自己写出的 6 个文件加过期 project 目录，重跑后 `.lbsln` 哈希不变。
- **`NN/验证记录.md` 硬编码 `生成时间：2026-09-04`**：任何人工验证证据都会在下次重跑时被静默覆盖。
  已改为 `verificationEvidence[集号]` 数据驱动，未验证的集输出明确的「待验证」条目而不是假日期。

### 平台硬约束（写教程代码前必须知道）

- **WebView2 事件回调里不能同步执行 JS（2026-09-06 已改为快速失败）**：`EdgeView_执行JS控件` 在 `导航完成` 一类回调内调用会死锁，
  卡满 15000 ms 后返回空文本；同样的调用放在按钮 `BM_CLICK` 里立即返回。
  现在 `EdgeView_执行JS实例` 检测到 `instance->eventDecisionActive` 时立刻返回空文本，并用
  `EdgeView_报告回调内同步等待` 输出中文诊断，提示改用 `EdgeView脚本_执行详情异步` + 完成处理器。
  实测：回调内调用从 15000 ms 降到同一毫秒内返回（诊断工程记录 `sync-callback-begin` 与 `sync-callback-end|` 同为 539 ms），
  按钮内调用照常返回 `"诊断页 /sync"`。这条仍是**平台约束**，不是可以修好的缺陷：
  WebView2 的完成回调要等界面线程回到消息循环才会派发，在回调里自建消息泵泵不出自己的后续回调。
- **`EdgeView_等待事件控件(控件名, 事件名, 超时毫秒)`（2026-09-06 新增）**：原先 `EdgeView_等待事件` 只按设计器
  `control.id` 查 `edgeViews_` 注册表，`.lcpp` 侧既没有 `_控件` 变体也拿不到实例 id，导致「创建完毕 → 等导航 → 填表」
  这条最自然的教程写法不成立。新命令用 `EdgeView_查找控件(控件名)` 解析 controlRef 后转调原命令，
  binding 参数声明为 `controlRef`，补全为裸控件名。
  实测在 `创建完毕` 里 `EdgeView_等待事件控件(浏览器控件, "导航完成", 8000)` 返回 1，随后同步
  `EdgeView_执行JS控件(浏览器控件, "document.title")` 立即返回标题，因此第 07 集旁白已经可以按原话实现。
  注意：它只能在**非** WebView2 回调上下文里调用（例如 `创建完毕`、按钮事件），在浏览器事件处理器内调用同样会等满超时。
- **语言服务把字符串字面量里的 `identifier.identifier(` 误判为功能库调用**：`"document.getElementById('name')"` 会报未知功能库。
  教程代码目前用方括号访问 `document['getElementById']('name')` 规避。属误报，应修词法作用域而不是教用户绕。
- **生成器少 `.c_str()`**：把拼接出的 `std::wstring` 传给 `const wchar_t*` 参数会生成 C2664。
  当前只有字符串字面量能安全传给 `EdgeView_执行JS控件`。
- **巨型内联 HTML 字面量会打乱翻译器**：`.lcpp` 里放整页 HTML 字符串后，**下一条**字符串字面量会丢掉 `L` 前缀。
  第 09、10 集仍走 `EdgeView导航_HTML(控件, "<整页 HTML>")`，属未爆的同类风险；建议与 01/07 统一改成本地虚拟主机。

### 剪辑与渲染侧

- **Remotion 预览合成不会自动缩放 px 坐标**：1920 设计空间写死的布局在 1280×720 预览合成里直接溢出裁切。
  已用 `transform: scale(width / 1920)` 的设计空间容器包住全部内容，一套数据同时喂 1080p 母版与 720p 预览。
- **本机系统 Edge headless 已不可用**：`msedge --headless=new --screenshot` 报 `Failed to launch the browser process! Error: Closed with 0 signal: null`
  且不产出文件；同参数的 Chrome 正常。Remotion 渲染必须 `--browser-executable` 指向
  `C:\Program Files\Google\Chrome\Application\chrome.exe`。这与 AGENTS.md「用系统 Edge 避免 Chrome Headless Shell 下载被墙」的记录相反，以本机实测为准。
- **`ffmpeg -vsync` 在本机 build 已不存在**：抽帧改用 `-fps_mode passthrough`；`tile` 过滤器只接受一个输入，
  多图联络表要先落成 `g%02d.png` 编号序列。

### 仍待处理

- 第 07 集旁白第 3 条「在创建完毕事件里」与实现不符（填值在 `_运行按钮_被单击`）。是否只重合成该 11.6 s cue
  由用户裁决，详见 `AI 视频自主生产/EdgeView 浏览器模块合集/字幕修正记录.md`。
- 第 12 集 `assets/capstone.html` 复用表单页，没有可触发 `下载开始` 的元素，下载镜头需要补一个本地下载链接。
- 第 08 集仍是两个子项目（替换响应 / 读取响应），最长旁白 91.68 s，尚未纳入统一 `Episode` 数据结构。


## 5. EdgeView 批量录制（01–12）踩到的工程坑（2026-09-06 实测）

这一批是「一集一集跑同一条采集流水线」时暴露出来的，跟第 4 节的单集样板结论不重叠。

### LingBuilder 自身的行为

- **Electron 主窗口关不掉**：`electron/main.ts:495` 的 `mainWindow.on('close')` 会 `event.preventDefault()`
  并向 renderer 发 `window:close-requested`，只有 renderer 调过 `confirmClose` 把窗口登记进
  `rendererConfirmedClose` 才真关。实测跨进程 `PostMessage(WM_CLOSE)`、`WM_SYSCOMMAND/SC_CLOSE`
  和真实 `Alt+F4`（`keybd_event`）全部无效，进程一直 `Responding=True`。
  唯一可靠路径是 CDP 调 `window.lingBuilder.windowControls.confirmClose()`，已封装成 `close_ide.mjs`，
  并由 `launch_record.ps1` 在拉起下一个实例前自动调用。
  建议：给 IDE 加一个「无 renderer 应答时超时后强制关闭」的兜底，否则 renderer 一旦停在
  `chrome-error://chromewebdata/` 就永远关不掉，只能 taskkill。
- **重跑生成器时 IDE 必须完全退出**：实测在 IDE 打开 01 集的情况下重跑
  `npm run tutorial:edgeview:generate`，`src/MainWindow.lcpp` 被串写成开头多出一段
  `类 MainWindow / 事件 创建完毕()` 桩、原文件头被吃掉字节的损坏内容；renderer 重载后 IDE 还会把
  `未命名解决方案 / lingbuilder-ui-project` 回写进 `01/示例项目/.lingbuilder/solution.json`，
  并在 `.lingbuilder/` 根落下 `window-designer.json` 与 `recovery/`。
  已封装 `regen_tutorials.sh`，先断言批量端口上没有 IDE 再生成。
  建议：IDE 保存解决方案前先比对磁盘修订号，发现外部改动时给中文提示而不是直接覆盖。
- **`错误列表 (0)` 与构建被阻断同时成立**：输出面板写着
  `【F5错误】LCPP 项目源码存在阻止构建的错误：src/MainWindow.lcpp 第 19 行：找不到功能库"localStorage"。`
  而状态栏的 `错误列表` 计数仍是 0。阻断性中文诊断没有进错误列表，靠看计数会误判为构建健康。
  建议：把 F5 阻断诊断同步进错误列表，或在计数旁显示「构建被 N 条诊断阻止」。
- **纯 `std::wstring` 变量传参没问题**：`局部 文本型 X = EdgeView_执行JS控件(...)` 再生成出
  `控件_设置文本(L"运行状态", LingCppWideArg(X))`，可编译。第 4 节记的「少 `.c_str()`」只发生在
  **拼接表达式**上，不是所有非字面量实参，描述范围要收窄。

### 采集与脚本

- **含中文的 `.ps1` 必须带 UTF-8 BOM**：Windows PowerShell 5.1 对无 BOM 文件按 ANSI codepage 解析，
  中文注释会让脚本在 `param()` 处直接 `UnexpectedToken` 崩掉，而且报错位置指不到真因。
  本目录所有 `.ps1` 已统一补 BOM；新写脚本时编辑器必须存成 UTF-8 with BOM。
- **`click_native_button.ps1` 的 `-Index` 枚举不可靠**：同一窗口三个按钮，`BUTTONS=` 一度只报 1。
  现在改为把每个按钮的 `GetWindowText` 落到 UTF-8 的 `native_captions.txt`，采集侧按标题记账
  （`NN/素材/shots/native_states.txt`），截图与按钮动作才能对上。
  注意 PowerShell 的 `$caps += $x` 会把多个标题拼成一个字符串，必须用 `List[string].Add()`。
- **Remotion 高亮标注的标签画在框上方 46px**（`EpisodeView.tsx` 的 `top: box.y - 46`）。
  代码镜头行距很紧时标签会盖住上一行代码，比不标更糟。01/02 集已撤掉高亮，命令名改由卡片承载；
  只有像 07 集那样上方确实有空白带时才用高亮。
- **示例项目以前不带 `build-configuration.json`**，F5 默认落在 Debug，导致各集构建口径不一致。
  生成器现在为每集写出 `{ mode: "Release", architecture: "Win32" }`。

### 教程示例项目与口播稿的落差（已改）

- 第 02 集原示例只 `置Cookie` 两次、页面从不导航，运行窗口是两块空白，而口播第 4 条要求
  「A 写 LocalStorage、B 读不到」这一核心证据。已改成两个会话都走 `iso.local` 虚拟主机加载
  `assets/isolation.html`，三个按钮分别「写入会话A / 读取会话B / 读取 Cookie」，
  实测运行窗口同时出现 A 蓝底「读到：只在A出现」与 B 橙底「本地存储为空」，
  Cookie 按钮回显 `[{"name":"演示键","value":"脱敏值","domain":"iso.local","path":"/"}]`。
- 第 01 集口播第 5 条说标题「打印到调试输出」，原代码只写状态标签。已改成
  `局部 文本型 页面标题 = EdgeView_执行JS控件(...)` 后同时 `调试输出(页面标题)` 和
  `控件_设置文本(运行状态, 页面标题)`，实测编译通过。
- 第 12 集口播第 3 条要求在 `导航完成` 处理器里同步取 `document.title`（不可实现），
  已按用户确认改用 `EdgeView脚本_执行详情异步(..., &标题就绪)`；
  同时 `assets/capstone.html` 补了 `data:` 下载链接，否则 `下载开始` 永不触发。

### 仍待处理

- 第 03/04/05/06/09/10/11 集的示例项目还没逐集对照口播稿核过落差，按 02 集的经验，
  大概率还有「口播承诺了可验证证据、示例项目没做」的情况，采集前应先读该集 `.srt`。
- 第 05 集 `.lcpp` 里的 `事件 纯代码实例对照()` 块引用了不存在的 `实例导航完成` 处理器，
  且 `EdgeView_等待事件` 对设计器控件不可用（见第 4 节），该块是永不执行的死代码，
  不能当运行证据，需要重写或删除。
- 第 06 集 `assets/message.html` 实际复用 intro 页，没有网页侧 `postMessage` 接收方，
  `EdgeView脚本_发送字符串消息` 发出去没有可见效果。
- 第 09/10 集仍用 `EdgeView导航_HTML` 内联整页 HTML，有「巨型字面量让下一条字符串丢 `L` 前缀」的风险。

### 补充：重建控件会丢弃虚拟主机映射与全部运行期设置（03 集实测）

- `EdgeView创建选项_重建控件(控件)` 之后，同一个控件上此前生效的
  `EdgeView导航_设置虚拟主机` 映射与 `EdgeView设置_置用户代理 / 置缩放 / 置静音` **全部失效**：
  实测再导航 `https://settings.local/settings.html` 直接落到
  「嗯… 无法访问此页面 / 找不到 settings.local 的服务器 IP 地址」，
  重新挂上映射后页面里的 `navigator.userAgent` 与 `window.innerWidth` 也回到默认值。
- 这正是第 03 集口播第 5 条「事件和页面状态要按项目需要重新初始化」的机制，
  但模块侧没有任何诊断提示，用户只能靠撞见错误页发现。
  建议：重建完成后输出一条中文提示，列出本次被丢弃的映射与运行期设置，
  或让 `EdgeView创建选项_重建控件` 返回一个「需要重新初始化」的明确结果。



## 6. EdgeView 01–12 批量采集暴露的模块行为（2026-09-06 实测）

第 4、5 节是单集样板与流水线；这一节是把 12 个示例项目全部改成「能真的拍出旁白所讲的证据」时，
从 EdgeView 模块本身撞出来的行为。全部有运行窗口截图或落盘文件为证。

- **虚拟主机映射的请求不会走 `WebResourceRequested`。**
  第 12 集最初把样式表放在已映射的 `capstone.local/capstone.css` 上并加过滤器替换，
  页面样式毫无变化（映射由 WebView2 内部直接应答，根本不产生资源请求事件）。
  改成引用一个**未映射**主机 `https://skin.capstone.local/skin.css` 后，
  替换的 CSS 立刻生效（页面变成青绿色），这才拿到「响应被程序替换」的可见证据。
  文档应明确：想演示资源拦截，目标 URL 不能落在 `SetVirtualHostNameToFolderMapping` 的目录里。
- **`EdgeView权限_设置异步` 会把页面刷白且完成处理器不回。**
  第 11 集「设置测试权限」按钮调用它之后，运行窗口变成空白，标签停在上一条 Cookie 结果，
  `&权限完成` 从未触发。已把该按钮改走 `EdgeView权限_枚举异步`（能稳定回 JSON），
  设置接口只在卡片里讲契约。这条要么修，要么在文档里写清前置条件。
- **`EdgeView事件_设置下载路径` 不生效（2026-09-06 已修模块）。**
  真实根因不是「示例项目传了相对路径」——实测三种写法（相对路径、裸文件名、`路径_转绝对路径` 得到的绝对路径）
  全部失败，而 setter 返回 1，说明决策窗口正常、值已写入，失败发生在 `put_ResultFilePath` 且完全静默。
  两点叠加：
  1. `EdgeView事件_设置下载路径` 原先只是 `EdgeView事件_设置返回文本` 的转发，写进共享槽 `eventResultText`；
  2. `ICoreWebView2DownloadStartingEventArgs::put_ResultFilePath` 与 `PrintToPdf` 一样只收绝对路径，
     且要求目标目录已存在，而模块既没补全也没建目录，更没检查 HRESULT。
  现在：setter 走独立槽 `eventDownloadPath`，先 `EdgeView_取绝对路径` 补全，再 `EdgeView_确保父目录`
  逐级 `CreateDirectoryW`；`DownloadStarting` 捕获 `put_ResultFilePath` 的 HRESULT，失败输出中文诊断，
  并按 downloadId 记进 `eventDownloadPathErrors`，由 `EdgeView下载_取状态JSON` 以 `resultFilePathError` 字段回传。
  回归断言见 `tests/modules.test.ts`「EdgeView 导出路径、响应正文时效、回调内同步等待与控件级等待事件保持统一契约」，
  绝对路径解析计数基线已从 4 提到 5（PDF、PDF 流、截图、图标、下载路径）。
- **`EdgeView下载_取状态JSON` 的 `path` 在 `下载开始` 处理器内是「决策前快照」。**
  WebView2 的 `ICoreWebView2DownloadOperation::get_ResultFilePath` 在 DownloadStarting 期间仍返回默认落点，
  所以「在改路径的同一条处理器里立刻取状态」必然看到系统默认下载目录，看起来像没生效。
  正确用法：改路径放在同步事件处理器内，读状态放到事件结束之后（例如另一个按钮）。
  第 09、12 集示例项目已按这个节奏改成「触发下载」+ 独立「查看下载状态」两个按钮，
  实测状态 JSON 回 `...bin\.edgeview\epNN\downloads\...`、`state:2`、received=total。
  已补：`取状态JSON` 现在同时回传 `pendingResultFilePath`（本次请求的落点）与既有 `path`（WebView2 实时值），事件内也能区分「已生效」与「本次请求」，不必再靠时序去猜。
- **`EdgeView打印_PDF异步` 不产出文件的真因是相对路径（2026-09-06 已修模块）。**
  与 `"{}"` 无关：运行期把 `设置JSON` 声明成**未命名参数**，压根没读它，所以传什么都会被丢弃；
  真正的失败是 `ICoreWebView2_7::PrintToPdf` 只接受绝对路径，相对名会以 `0x80070057` 结束，
  而 `EdgeView媒体_截图异步` / `EdgeView媒体_取Favicon异步` 是模块自己用 `CreateFileW` 落盘，相对路径按当前工作目录能写出去——
  同一族命令两套路径语义，才造成「只有 PDF 没产物」。
  现在四条导出命令统一先 `EdgeView_取绝对路径`，任务结果一律回报绝对落盘路径；
  `设置JSON` 补上真实实现（WebView2 驼峰键名白名单，见 `EdgeView打印_应用设置JSON`），非 `{` 开头的文本判为无效并给中文诊断。
  实测第 10 集示例项目裸文件名 `edgeview-ep10-page.pdf` 产出 64,204 B，`%PDF-1.4`、2 页、带 `%%EOF`，
  完成处理器 `EdgeView任务_取状态 == 1`。
- **同一个控件上并发调用 `PrintToPdf` 会被 WebView2 判为 `0x80004005`。**
  第 10 集最初把三个导出在一次按钮点击里连发，只有第一个成功；改成「一个按钮一个导出」后三个都成功。
  异步导出接口必须逐个发起、逐个观察，既不能串链也不能并发。
- **导出文件名与真实编码不一致（未修，属独立决策）**：`EdgeView媒体_截图异步` 传格式 `1` 时 WebView2 输出 JPEG，
  第 09/10 集示例却写成 `.png`；`EdgeView媒体_取Favicon异步` 固定用 `COREWEBVIEW2_FAVICON_IMAGE_FORMAT_PNG`，
  示例写成 `.ico`。文件能正常打开，只是扩展名和内容不符，改哪一边需要先确认教程口播是否提到格式。
- **导出路径的相对目录不会被自动创建。**
  第 10 集最初写 `.edgeview/ep10/output/page.pdf`，父目录不存在时静默无产物；
  改成 exe 同目录裸文件名后截图与 Favicon 立即落盘。
- **多个完成处理器共用一个状态标签时，只有最后一个可见。**
  这是剪辑侧的取证问题，不是模块缺陷：`shoot_episode.sh` 现在按按钮逐个点击、逐个截图，
  并把「截图 ↔ 按钮标题」写进 `NN/素材/shots/native_states.txt`，
  否则成片里出现的永远是最后一步的结果。
- **`EdgeView资源_读响应正文异步` 的约束是「事件上下文」，不是「真实网络 vs 合成应答」（2026-09-06 实测更正）。**
  同一份诊断工程里跑矩阵：在 `Web资源响应收到` 处理器执行期间立即发起读取，
  主文档、普通 CSS 子资源、以及被 `EdgeView资源_设置事件响应文本` 替换掉的合成应答**都能成功**
  （分别回 545 / 24 字节正文）；把 `responseHandle` 存进成员变量、事后再交给读正文异步，
  三种**全部失败**（约 5.6 s、9.5 s、17.4 s 后都是 `0x80004005`）。
  所以第 12 集的 `0x80004005` 是用法错，不是平台读不到合成应答；第 08 集一直用的是对的写法。
  第 12 集示例项目已改成「按钮重新导航 → 在响应处理器内立即读正文」，实测绿色「响应正文」标签回
  `被替换样式表 62 字节：main{background:#f0fdfa;border-color:#0f766e}h1{color:#0f766e}`。
  模块侧同时补了中文说明：句柄解析不到、或 `GetContent` 失败时，错误文本会追加
  「响应正文必须在 Web资源响应收到 处理器执行期间交给本命令……」而不是只给裸 HRESULT。
- **`EdgeView导航_HTML` 内联整页 HTML 已从 09、10 集移除**，统一改成本地虚拟主机，
  第 4 节记的「巨型字面量让下一条字符串丢 `L` 前缀」风险随之消失；
  产品补全片段里 `EdgeView导航_HTML` 仍在，是否保留待产品决定。

### 教程示例项目与口播稿的系统性落差

12 集里有 **7 集**（02、04、05、06、09、10、11）的示例项目根本没做到该集口播承诺的可验证证据，
其中 05、09、10、11 还引用了**未定义的完成处理器**（`&查找完成`、`&PDF完成`、`&Cookie完成` 等），
F5 直接被中文诊断阻断，但状态栏的 `错误列表` 仍显示 `(0)`。
已新增 `check_handlers.py` 做静态扫描：列出 `&处理器` 引用但没有 `事件 处理器()` 定义的文件，
以及从未被绑定的死定义块。采集任何一集之前先跑它。

## 7. FBro 独立顶层窗口的可见性与启动阻塞（2026-09-06 实测）

- **已修：`independent-window` 宿主顶层窗口永远不带 `WS_VISIBLE`。**
  `electron/src/services/windowDesigner/lingCppWin32Project.ts` 的 `FBro_创建` 组装 `LingFbroProcessConfig` 时
  用 `IsWindowVisible(instance->host)` 判可见，而 `FBro_创建(nullptr)` 是在 `WM_CREATE` 的
  `OnWindowCreated()` 里跑的，主窗口要到 `WM_CREATE` 返回之后才 `ShowWindow`，
  于是每个子控件在那一瞬间都被判成不可见；宿主进程 `Configure()` 的
  `if (visible || mode == EMBEDDED) SetWindowPos(..., SWP_SHOWWINDOW)` 因此永远不执行。
  改为按设计器可见性（`control.flags & CF_HIDDEN`）决定，实测宿主顶层窗口样式从
  `0x06CF0000` 变为 `0x16CF0000`，`LingBuilder.FBro.Host.Browser` 真实出现在桌面上。
- **未修：独立进程握手在 `WM_CREATE` 内串行阻塞界面线程，每实例最多 15 秒。**
  `LingFbroProcessController::Start(config, waitUntilReady = true)` 会
  `stateChanged.wait_for(..., 15s)` 等 `就绪`，而调用点在 `WM_CREATE` 里，所以两个独立进程实例的
  示例项目启动后 **30~35 秒内主窗口和宿主窗口都不出现**，期间整个窗口无响应。
  教程录屏必须按这个时长预留停顿；根治方案要么 `Start(config, false)` + 由事件回填状态，
  要么把独立进程实例的创建推迟到 `ShowWindow` 之后（后者会改变「创建完毕」事件的时序，需连带回归）。
- **未修：`CF_HIDDEN` 是一个从未被赋值的死标志位。**
  `lingCppWin32Project.ts` 只在 7305 定义它、在 19878/20094 读它，控件规格表里没有任何地方设置它，
  生成器里也搜不到 `visibility === 'Hidden'` 之类的分支。结论：设计器里把 Win32 控件设为「隐藏」
  在生成的运行时里仍然是 `WS_VISIBLE`。上面那条 FBro 可见性修复用的是与控件自身样式完全相同的表达式，
  所以与现状一致；但真正修 Hidden 语义时必须连带复核这一行，否则隐藏浏览器会忽然弹出顶层窗口。
- **冒烟门禁 `npm run smoke:fbro-process-native` 修了三处腐烂**（此前只数进程数，无法发现窗口级缺陷）：
  MSBuild 路径硬编码 VS2022 → 改用 `vswhere` 探测并按已安装的平台工具集传 `/p:PlatformToolset=`
  （当时 `visualStudioProjectExporter.ts` 仍写死 v143；该导出器工具集参数化已于 2026-09-11 落地，见文末「Visual Studio 工程导出工具集与后置命令修复」，smoke 门禁可改用统一探测器）；
  PowerShell here-string 语法导致 `TerminatorExpectedAtEndOfString`；
  `spawn(..., { windowsHide: true })` 让子进程以 `SW_HIDE` 启动，而宿主顶层窗口是主窗口的 owned 窗口，
  此时 `IsWindowVisible` 恒为假，可见性断言不可能通过。可见性轮询预算给到 90 秒，理由见上第二条。

### 采集脚本与运行环境侧实测结论（2026-09-06 追加）

- **`.NET Process.MainWindowHandle` 会跳过「有 owner 的顶层窗口」**，而 ③ `independent-window` 宿主窗口正是示例主窗口的
  owned 窗口。用 `MainWindowHandle -ne 0` 枚举进程时永远看不到 `LingBuilderFbroHost.exe`，造成「窗口没出现」的假失败。
  `录制/ep05/take-exe.mjs` 的 `windowedProcs()` 已改为把 `LingBuilderFbroHost` / `FBroSubprocess` 无条件并入候选集。
- **take 脚本必须先 `ensureWorkbench` 打开本集示例**。F5 构建并运行的是 IDE 当前打开的项目，不显式 `openPath` 就会把上一集的
  演示窗口录进来（ep04 第一版 exe take 录到 ep05 窗口的直接原因）。仅靠进程路径前缀过滤不足以发现这类错误，因此脚本在拿到
  pid 后追加了归属门禁：`(Get-Process -Id <pid>).Path` 必须包含本集项目目录名，否则直接抛错终止录制。
- **非默认渲染端口下 `ensureWorkbench` 只能用 `reload: false`**。`录制/ep01/lib.mjs` 的 reload 分支会 `Page.navigate`
  到硬编码 `http://127.0.0.1:3021/`，本会话受管 Electron 的渲染端口不是 3021，reload 会跳到死地址。
  `openPath` 内部 POST `/api/workspace/switch` 会切换 workspaceRoot，所以换集不需要重启 server。
- **强制结束示例进程会留下 `bin/.fbro` profile 锁**（`Stop-Process -Force` / `taskkill /F` 同样）。锁未清理时，后续实例在
  导航阶段**干净退出**：exit code 0、无 WER 记录、无残留进程，看起来完全像产品崩溃。清掉 `bin/.fbro` 后同一节拍全部通过。
  录制收尾只用 `CloseMainWindow`；已经留下锁时删目录，不要把它当运行时缺陷去改产品代码。
- **`录制/probe-windows.ps1` 输出的 x,y 是 DIP**（物理像素的 2/3，150% 缩放），不能直接当物理坐标摆位。
- **`FBro_打开谷歌原生UI浏览器`（`LB_FBro_CreateChromeUi`，`CEF_RUNTIME_STYLE_CHROME`）不需要 VIP**，
  实测 `Chrome_WidgetWin_1` 标题「FBro 资源测试页 - Chromium」在完整节拍下存活 25 秒以上。
  与此相对，第 04 集五条指纹/VIP 命令全部要求授权，未配置 Key 时只能录到「VIP Key 未配置或 FBro VIP 控件不可用」这一真实状态，
  该集 exe take 必须在用户于 IDE「设置 → FBro VIP Key」保存后重录（保存后下一次 F5 即生效，无需重启 IDE）。
- **关不掉 Electron 是关闭否决，不是卡死**：`electron/electron/main.ts` 在 `mainWindow.on('close')` 里未收到 renderer
  确认时 `preventDefault()` 并弹页内「取消 / 直接退出 / 保存并退出」。清理环境时选「直接退出」；
  不要选「保存并退出」，否则可能把脏设计器模型写回已交付的示例项目。
### CEF3 SDK 自动升级与 Bridge 物化一致性（2026-09-07）

- CEF3 SDK 校验现在额外检查 `LingBuilderCefBridge.h` 是否包含 `LB_CEF3_ResourceResponseBodyBegin`，旧版 SDK 不再被误判为可用。
- 构建前原生依赖物化按内容差异刷新 CEF3 Bridge 的头文件、LIB 和 DLL，避免增量构建目录残留旧 ABI。
- 后续官网 SDK 清单变更仍必须同步更新版本、SHA-256、压缩大小、解压大小和文件数；用户侧由 IDE 自动下载、校验和原子替换。

### FBro 非 VIP 响应正文查找替换与浏览器启动死锁修复（2026-09-09）

- `lingbuilder.fbro.browser` 2.5.0 新增非 VIP 查找替换族：`FBro_替换资源响应文本(控件名, 查找内容, 替换内容)` 与
  `FBro_清除资源响应文本替换(控件名)`。桥接侧新增导出 `LB_FBro_ResourceReplaceSet/Clear`（bridgeVersion 2.3.0 → 2.4.0，
  物化门禁 peExportProbe 已加新导出探测），过滤器 `LingFbroResourceReplaceFilter` 继承官方 `FBroHsResponseFilter`
  并经 `FBroHsResponseFilter_Create` 安装；流式 UTF-8 字节查找替换算法与 CEF3 桥 `BridgeResponseFilter` 同源
  （pending + `std::search` + 输出队列排空后才继续消费输入），二进制安全、跨块匹配、上限 64MiB。
  与 `FBro_读资源响应正文` 同请求并存时由替换过滤器顺带按原始输入字节捕获，`End` 回调派发正文事件（与 CEF3 语义一致）。
- **浏览器启动死锁（根因与修复）**：`BridgeBrowserStartTask::Execute` 原先在 `g_mutex` 全程持锁下执行 `StartBrowser`，
  后者会创建以主窗口宿主 HWND 为父的浏览器窗口，触发对主线程窗口的跨线程 `SetWindowLong`——必须等主线程消息泵应答；
  而主线程「创建完毕」处理器内的任何 `FBro_` 命令都要取同一把锁，形成互等死锁。cdb 抓栈确认双线程栈：
  主线程 `CreateWindowExW → WM_CREATE → FBro_导航 → RtlAcquireSRWLockExclusive`，CEF `CrBrowserMain → 桥 → NtUserSetWindowLong`。
  旧模板二进制只是碰巧赢得「CEF 初始化 vs WM_CREATE」时序竞争，新模板二进制必输。修复：`BridgeBrowserStartTask`、
  `ScheduleBrowserStart` 的 TID_UI 分支与 `StartPendingBrowsers` 一律锁外执行 `StartBrowser`（启动只发生在 CEF UI 线程，
  状态写入无需全局锁）；同时生成模板把 `OnWindowCreated`（含 `FBro_创建` 与 `Loaded` 派发）从 `WM_CREATE` 内同步调用
  改为 `WM_LINGBUILDER_WINDOW_CREATED`（WM_APP+0x59）延迟到消息循环开始后派发，对齐火山示例「消息循环运转后再建浏览器」的范式。
- **遗留优化**：`FBro_导航` 在浏览器就绪前调用会静默返回 0（CEF3 模块已有 `pendingNavigation` 排队机制），
  后续可给 FBro 生成运行时补同样的排队语义，消除「创建完毕内导航无效」这一新手陷阱；当前以
  `浏览器创建完成` 事件处理器内导航为文档化正确用法。
### FBro 环境 SDK 升级到火山版正式版 5.39.53（bridge 2.5.0，2026-09-09）
## FBro 环境 SDK 升级到火山版正式版 5.39.53（bridge 2.5.0，2026-09-09）

### 更新内容

- 用户提供火山最新安装包 `FBrowserCEF3Lib火山版正式版5.39.53_chromium135.0.7049.115.7z`（外层为安装器，内含 `FBrowser火山模块包.7z`，py7zr 不支持其 BCJ2 压缩，用 7zr.exe 解出）。以该包为权威源整体升级 FBro 环境 SDK；此前 `T:\编程工具\...\FBrowser` 为赞助会员工具升级的另一构建（与 5.39.53 亦不同），两个脚本 `DEFAULT_SOURCE` 已从该易漂移路径切换到工作区稳定源树 `.lingbuilder-build/fbro-official-5.39.53/FBrowser`（junction 指向已安装模块的 official/include、official/lib64、runtime/x64）。
- 版本判定：新旧 CEF 版本头完全一致（`135.0.21+gd008a99+chromium-135.0.7049.115`，`chrome_elf.dll` 同哈希），`SDK_VERSION` 保持 `135.0.21`；桥接在新头/库下重编译且二进制变化，`BRIDGE_VERSION` 2.4.0 → 2.5.0（2.4.0 归档未发布过，直接跳版）。模块版本 `135.0.21.2.5.0`。
- 官方头文件 77 → 73（删除 `FBroClientBase.h`、`FBroExtension.h`、`FBroExtensionHandler.h`、`FBroRenderHandler.h`；内容仅 `include/cef_config.h` 变化）；覆盖目录签名族 1079 → 1071（原始声明 1091 → 1083），**已实现 397 不变**——桥使用的全部官方 API 在 5.39.53 中健在（此前记忆中「SetVirGPU* 被删」只发生在漂移目录，5.39.53 官方 DLL 仍导出 7 个 SetVirGPU* 且声明可解析）。事件目录完全不变（174 槽位/158 唯一签名/90+31 分类/89 implemented/76 managed）。
- 运行时更新：`FBrowserCEF3lib.dll`、`FBrowserVIP.dll`、`libcef.dll` 全部更换（`FBroSubprocess.exe`、`chrome_elf.dll` 等不变）；新 `libcef.dll` 235.3MB，仍满足目录 `criticalFiles` 的 230MB 下限。
- `EXPECTED_HEADER_COUNT` 77→73、`EXPECTED_SIGNATURE_COUNT` 1079→1071 写入覆盖门禁；测试基线写回（headerCount/signatureCount/rawDeclarationCount 1083/advancedSafe planned 670）并注明原因。

### 影响范围与流程沉淀

- 已安装模块 `​.lingbuilder/modules/lingbuilder.fbro.sdk` 经 `npm run module:fbro-sdk -- --source <5.39.53 包> --install` 原子替换（桥 2.5.0 + 新 official + 新 runtime + 重算 SHA-256 的 runtime-manifest）；`FBro_替换资源响应文本` 等全部桥导出复核存在。
- 稳定源树 `.lingbuilder-build/fbro-official-5.39.53/FBrowser`（junction）供 `module:fbro-sdk` / `module:fbro-coverage[:check]` 的 `DEFAULT_SOURCE` 使用；两个脚本的旧绝对路径默认值已移除。
- 新归档 `​.lingbuilder-build/lingbuilder-fbro-sdk-135.0.21.2.5.0-windows-x64.zip`：473 文件（-5：4 头 + 运行时差 1），225,396,199 字节，解压 673,673,633 字节，SHA-256 `98c3e430fd4c480b7d7829b517984c0a83083f8a3fc6067225a079740454777d`，zip 清单与解压树双向对账一致；`sdkDependencyCatalog.ts` 可更新字段已同步（version/archiveName/downloadUrl/archiveBytes/expandedBytes/fileCount/sha256）。
- **未决（需维护者）**：R2 上传 2.5.0 归档 + 管理后台「SDK 下载源」发布 fbro 资源（sequence+1，按 `docs/SDK下载清单发布流程.md`「日常换直链」四步）。旧 2.4.0/2.3.0 归档未发布过，无需处理。

### 验证结果

- 覆盖门禁 `module:fbro-coverage:check`（经 junction 源树）绿：73 头 / 1071 签名 / 397 implemented / 670 planned / 3 internal；在线 `sdk-catalog:check` 绿（sequence 8，锚定字段逐字一致）。
- `npm run lint`、`npm run build` 绿；`modules.test.ts` 126 用例（覆盖目录基线已更新）仅剩 6 个既有本机环境基线失败；`test:lingcpp` 212 用例仅剩 1 个既有环境失败。
- 端到端：CLI 以新 SDK 物化重建 `fbro-novip-replace-demo` 并运行，非 VIP 查找替换 + 清除全流程 ALL_PASS（page1 标题被替换为「会员专享价格页面」，page2「清除后原始价格页面」保持原文），进程存活可响应。


## FBro 全量封装后续事项（2026-09-09）

- 批次 0-7 已落地 57 条命令（详见更新记录 2026-09-09）。遗留：① 各命令端到端 exe 冒烟（填表/取源码/启动开关/服务器/JS扩展各一例），当前仅有 DLL 导出探针与门禁绿；② CEF 服务器连接级事件（OnClientConnected/OnWebSocketMessage 等）未接事件目录（目录无 ServerHandle 槽位，接入需扩 EXPECTED_EVENT_SLOT_COUNT 并全量门禁重校）；③ 2.6.0 归档待 R2 上传与管理后台发布（线上 sequence+1）；④ TianBiao 全族尚有 SetChecked/GetChecked/SetSelected/GetSelected/SetInnerText 等 15 个同模式函数未封装（本次仅覆盖火山工程实际使用的 6 个）。

## 模块生态 AI 化三项优化的后续事项（2026-09-09）

本轮已落地：① 「安装 .lbmod」桌面版支持本机绝对路径（手输/拖入/文件选择统一经主进程导入复制进工作区）；② AI Bridge 新增 6 个 `lingbuilder.module.*` MCP 工具（scaffold/writeFiles/validate/pack/installPreview/install），外部 AI 可端到端生成模块，安装必须先 installPreview 且显式 approved；③ 模块页「一键生成」内置 AI 入口（系统 AI 通道由 renderer 编排 `cloudAi.start('chat')`，BYOK 通道走 `POST /api/modules/ai-generate`），复制粘贴流程降级为手动模式。

遗留与后续优化：

- 云端已落地最小改造（2026-09-09 已部署生产）：`AiChatRequest.thinking: 'disabled'` + ProviderService 对上游传 `thinking: {type:'disabled'}`，deepseek-v4-flash 预算 4096 → 16384（DB），IDE 一键生成改三阶段收敛编排，全链验收通过。遗留优化：专用 `/v1/ai/module/stream`（独立 system prompt、输出契约校验与计费口径）；`models()` 等普通请求不自动刷新过期 access token 的产品级问题已在 `snapshot()` 侧缓解，但其余 request 调用仍依赖先到期的流式刷新。
- 模块 MCP 工具当前只暴露 MCP（stdio + Streamable HTTP 共用），未加 REST 镜像；若后续 AI Bridge REST 客户端需要模块能力，再按「复用同一 AiBridgeService」规则补 `/api/ai-bridge/module/*` 路由。
- `docs/MODULE_ECOSYSTEM_IMPLEMENTATION.md` 的 manifest 示例仍是 v1 风格（`schemaVersion: 1` + `cppRuntimeName`），与 v2-only 规则存在文档漂移，需要整段改写为 v2 示例（schemaVersion 2 + targets + bindings）。
- 系统一键生成的自动修正回路目前是「把校验诊断追加进需求重跑一次」的人工触发按钮；后续可评估自动迭代（生成 → 校验失败自动回灌诊断，最多 N 轮）与点数消耗上限控制。

## Visual Studio 工程导出工具集与后置命令修复（2026-09-11）

两个真机实测缺陷已修复（修复前本机 VS2026 只有 v145 工具集，v143 机器不受影响）：

- **PlatformToolset 硬编码 v143 → 探测钉入。** 新增 `electron/src/services/windowDesigner/msvcPlatformToolset.ts`：`vswhere -latest -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64` 找最新安装，枚举 `MSBuild\Microsoft\VC\<版本>\Platforms\{Win32,x64}\PlatformToolsets` 中两平台共有的最新 `v<数字>` 工具集（与 MSBuild 解析工具集同一份目录）；非 Windows / 无 vswhere / 无目录时回退 `v143`。`exportVisualStudioProject` 未显式传 `platformToolset` 时自动探测，F5 中间工程、可复制导出与 windows-dll 模板（`solutionService` → `createWindowsDllProjectFiles`）消费同一结果。验收：本机重新导出后四配置 MSBuild 不带任何工具集覆盖全绿；显式 v143 与旧版输出逐字节一致（仅 4 行工具集行可变）。
- **PostBuildEvent 多行命令 MSB3073（退出码 3）→ 换行写成 `&#xD;` 字符引用。** 根因链：生成器把多行命令以真实 CRLF 写入 `<Command>` 文本节点 → XML 解析按规范把 CRLF 规范化为 LF → VC Exec 临时批处理是 LF-only → cmd 按字节偏移逐行执行时错位，第二条命令起从行中间开始执行（「文件名、目录名或卷标语法不正确」+「系统找不到指定的路径」），只有第一条 copy 成功；与 Debug/Release 无关（Release 曾"正常"只是旧产物未清理）。修复：`xmlEscapeMultilineText` 把 CR 输出为 `&#xD;`（VS 自身保存 vcxproj 的同款做法），MSBuild 读回即恢复 CRLF；另加首行 `if not exist "$(OutDir)" mkdir "$(OutDir)"` 防御性兜底。验收：演示工程 Debug|x64、Release|x64、Debug|Win32、Release|Win32 四配置清理后全链路 exit 0，bin 内 exe/pdb/sqlite3.dll/resources\lingbuilder-app.ico 齐全，exe 启动 5 秒后进程仍在。
- **遗留与注意**：① `.lingbuilder-build/` 与 `generated/cpp/` 的旧导出物不会自动继承修复，必须重新导出/重新生成；② `externalProjectService.resolveMsBuildCommand()` 仍只识别 VS2019/2022 安装路径（VS2026 下回退 PATH 里的 msbuild），后续可复用 `msvcPlatformToolset.ts` 的 vswhere 探测统一；③ CLI/无头环境导出含 SQLite 模块的工程需设 `LINGBUILDER_SQLITE_RUNTIME_ROOT` 与 `LINGBUILDER_RESOURCE_ROOT`（图标），否则随附 sqlite3.dll/默认图标缺失会导致导出不完整或阻断；④ 冒烟门禁 `smoke:fbro-process-native` 内部自带的工具集探测可改用统一探测器消重。

## Excel 表格模块 1.0 后续事项（2026-09-12）

- 已完成（2026-09-12）：`lingbuilder.data.excel@1.0.0` 内置 Excel 表格模块。随附运行桥 `LingBuilderExcel.dll`（electron/native/excel-bridge/ 源码，libxlsxwriter 1.2.3 + zlib 1.3.1 + OpenXLSX 0.5.1/miniz/nowide/pugixml 全静态 /MT，Win32/x64 双架构，SHA-256 钉在 `excelModule.ts`，来源见 `electron/third_party/excel/NOTICE.md`）。45 条命令八族：工作簿生命周期、工作表、单元格写、单元格读、行列批量（分隔符文本）、结构与格式（仅创建模式）、插入删除行列（仅创建模式，模型内自行实现键位移）、日期换算、诊断。创建模式=内存文档模型+libxlsxwriter 一次性序列化（保存后可继续修改再保存）；打开模式=OpenXLSX 保真修改。冒烟 `npm run smoke:excel-native` 双架构编译+x64 端到端通过。
- **能力边界（如实登记）**：① 打开模式不支持格式与结构命令（返回假+中文诊断）——OpenXLSX 样式写能力弱，不能在保真前提下补齐；若未来把打开模式改为「读入模型→libxlsxwriter 重写」会丢失原文件样式/图表/批注，禁止。② 公式不缓存计算值：创建模式写的公式由 Excel/WPS 打开时计算；打开模式读数值只能拿到文件里已有的缓存值。③ `Excel_读单元格文本` 对日期格式化单元格返回序列值文本，不做数字格式渲染（OpenXLSX 不解析显示格式）。④ 合并区域在插入/删除行列时不跟随移动（创建模式模型未登记合并区位移）。⑤ 1900-03-01 前日期序列与 Excel 差 1。
- **后续可做**：图表写入（libxlsxwriter 支持 chart，模型未登记）、条件格式与数据验证、打开模式公式计算值缓存读取增强、`.xls` 旧格式（需独立引擎，暂不做）、`Excel_读区域` 直接产出 JSON（配合 JSON 模块）、官网命令页与控件手册同步（`npm run module:web-sync` 已在入账时执行）。

## MySQL 数据库模块 1.0 后续事项（2026-09-11）

`lingbuilder.database.mysql@1.0.0` 已落地（43 条命令、MariaDB Connector/C 3.4.10 随附运行库、`smoke:mysql-native` 双架构编译 + x64 真库端到端全绿）。后续扩展按优先级：

- **TLS 完整证书参数**：当前 `MySQL_连接扩展` 只有「启用SSL」开关（Schannel，`MYSQL_OPT_SSL_ENFORCE`）。1.1 计划补 CA 证书路径、客户端证书/私钥、证书主机名校验开关（`MYSQL_OPT_SSL_CA/KEY/CERT` + `MYSQL_OPT_SSL_VERIFY_SERVER_CERT`）与 `MYSQL_OPT_TLS_VERSION`。
- **异步执行**：全部 43 条命令是阻塞调用。高频/长查询场景应配合多线程模块（每线程独立连接）使用；若做模块级异步（受管任务 + 完成处理器），须复用 `lingbuilder.threading` 的受管任务 invocation 契约，不得让 `.lcpp` 直接接触线程句柄。
- **官网 /commands 同步**：本模块 43 条命令尚未同步到官网命令查找页（线上当前 3248 条不含），发布前须跑 `npm run module:web-sync` 或容器内 syncManifest 通道。
- **踩坑记录**（改动 `mysqlRuntime.ts` 前必读）：① `my_bool` 返回 0=成功，bind_param/commit/rollback/autocommit 的成败判断不能写成 `!fn(...)`；② SELECT 的 `affected_rows` 是 `(my_ulonglong)-1` 哨兵，预编译执行后用 `mysql_stmt_affected_rows` 并把哨兵归零；③ 无参数语句执行 `mysql_stmt_bind_param(stmt, nullptr)` 合法；④ 逐行读取依赖「不预绑定结果缓冲 + `mysql_stmt_fetch_column`」，已实测可行，改结果读取设计前先跑冒烟；⑤ 官方归档无 Connector/C Windows 二进制，升级运行库须按 `third_party/mariadb/NOTICE.md` 的 CMake 口径自建双架构并更新 SHA-256 基线；⑥ `.lcpp` 带初始化的 `@` 透传行会被提升到方法最前，扩冒烟用例时先声明后赋值。

## FBro JS 交互（cefQuery）多通道与 data: URI 建页（2026-09-12）

对照火山「JS交互」示例补齐封装并实测通过（ep17 示例双通道回环 + PrintWindow 截图验收）。落地内容：桥 `LB_FBro_EnableJsQuery` 守卫改为只拦截已真正启动的浏览器（pending 条目不再误拒）；按查询函数名去重支持多通道注册（火山同款语义，全部通道共用一个 `BridgeQueryHandler`——CEF OnQuery 不带函数名且 FBro 把先注册的处理器放在分发链首，处理器无法区分来源通道）；生成器新增 FBroBrowser 控件属性 `jsQueryFunctions`（`查询名,取消名` 分号分隔多条），在 `LB_FBro_InitializeEx` 前逐条注册——CEF 多线程消息循环下 `OnContextInitialized` 远早于「创建完毕」，`.lcpp` 运行期调 `FBro_启用JS扩展` 必然迟到，不得再在事件里调用该命令。另修复语言服务 `scanQualifiedCalls`/`scanUnqualifiedCalls` 不剥离字符串字面量的误报（字符串里的 `document.getElementById(...)` 曾被报「找不到功能库」，阻断一切内嵌 HTML/JS 的 `.lcpp`）。

遗留与边界：

- **OnQueryCanceled 未派发**：桥 `BridgeQueryHandler` 没有 override `OnQueryCanceled`，页面 `window.cefQueryCancel` 的取消通知不会到达 `.lcpp`（被取消的查询由 CEF 路由器直接对页面回失败）。接入需要桥内 override + 事件目录已有槽位（`查询查询已取消`，managed），属小改动，待有真实需求时补。
- **data: URI 结果缓冲 64K 宽字符**：生成器包装 `FBro工具_创建数据URI` 用固定 `wchar_t value[65536]` 接结果，超大 HTML 会失败；火山版返回 CefString 无此限制。后续可改为两段式（先取长度再取值）或受管缓冲返回。
- **多通道无法区分来源**：受 FBro 内部分发模型所限（见上），处理器层收不到通道名；页面侧如需区分应在 request 载荷里自带标记。
- **`FBro_启用JS扩展` 命令描述已改**（修正原描述里不存在的「JS扩展调用」事件名，实际绑定名是 `OnQuery`），官网命令查找页待下次统一 `npm run module:web-sync`。
- 本机桥 DLL 已更新（`.lingbuilder/modules/lingbuilder.fbro.sdk/sdk/bridge/x64/`，构建与安装 SHA-256 一致），**仍属本地打包**：发布前需按官方流程重出 SDK 归档 + R2 上传 + 后台发布 + `sdk-catalog:check`（与既有 2.7.0 归档口径一致）。

## new_emoji 数据桥接命令与消息框补齐（2026-09-12）

对照 `T:\github
ew_emoji\examples\python` 下 13 个示例的 API 面补齐模块高层命令：生成器（`electron/scripts/generate-new-emoji-module.cjs`）新增 21 条显式声明的数据桥接命令（命令数 3784→3807）+ RichList 合成 `VirtualRow`（虚拟数据源）事件绑定（事件绑定 918→919）。此前这批能力只有 UTF-8 字节指针的 `NE_EU_*` 底层直通命令，`.lcpp` 传字符串生成 `L"..."` 宽指针与 `const unsigned char*` ABI 不匹配必然 C2664，属于「能补全但不能编译」的暗坑。

- **新命令**：表格 `NE表格_设置列/设置行数据/添加行/插入行`；富列表 `NE富列表_设置模板/设置条目/添加条目/设置选中键/设置倒计时/设置倒计时状态/设置虚拟行数据`；菜单 `NE菜单_设置项目/设置项目图标/设置项目快捷键/设置项目元数据`；徽标 `NE徽标_设置文本`；窗口级 `NE_设置窗口图标/NE_设置主题令牌`；消息框 `NE_显示消息框/NE_显示确认框/NE_显示扩展消息框`（`&处理器名` 回调按名派发：生成器按源码实际引用生成静态跳板 + `wcscmp` 查找表）。命令的控件参数带 controlTypes 约束、消息框 handler 带 handlerSignature，语言服务照常校验。
- **`当前窗口` 句柄关键字**：NE 前缀命令的 handle 参数支持 `当前窗口` → `g_newEmojiWindow`（`translateModuleCallArguments`），设计器流程无需自己保存窗口句柄。
- **按需生成**：数据桥接助手只在源码实际引用相关命令时才产出 C++（`generateNewEmojiDataBridgeCpp`），未使用工程的生成结果与历史一致——dataGrid「安全基础 ABI」与 windowDesigner「延迟弹层」两组整文件 `doesNotMatch` 扫描因此保持有效，无需改测试。
- **命令名边界匹配修复**：`extractCommandInvocationArguments`/`containsCommandInvocation`/`getNewEmojiBoundHandlerNames` 的调用匹配正则增加非标识符前缀边界；否则新增的 `NE_显示消息框` 会被既有 raw 命令 `显示消息框` 的诊断当子串误匹配。
- **既有缺口顺手修**：① new_emoji 专属模板缺链接 pragma，纯 new_emoji 工程 CLI 直编在 `DragQueryFileW` 上 LNK2019（此前所有工程都同时启用 Win32 模块掩盖），已补 shell32/user32/gdi32 pragma；② 生成器原子替换在系统临时目录与工作区跨盘符（EXDEV）时直接报错，退化为复制后替换；③ 绑定命令 handlerSignature 此前透传目录原始类型名（`int`），语言服务把合法处理器判为签名不匹配，已映射为中文类型名。
- **验证**：`examples/new-emoji-data-bridge-demo/build-request.json`（动态创建表格/富列表/徽标 + 全部新命令 + 消息框回调）经 CLI MSVC 编译成功，exe 同目录 new_emoji.dll，启动 4 秒 Alive/Responding=True。回归测试见 `tests/modules.test.ts`「new_emoji 数据桥接命令…」。
- **遗留**：① 生成器 raw 参数仍缺「迁移为 bytes 类型」的清单改造（manifest 校验器建议项），当前靠语言服务行内阻断诊断兜底；② `NE_设置窗口图标FromBytes`（内存字节集图标）未封装，`.lcpp` 无字节集字面量路径；③ 消息框 Post 异步变体（`EU_PostShowMessageBox*`）未封装；④ 富列表 Post 投递族未封装（同步版本已够 UI 线程使用）；⑤ `examples/module-demos` 的 new_emoji 快照（3784 时代）与官网 /commands 同步（`npm run module:web-sync` 需管理员凭据）待在完整环境执行；⑥ `module:demos` 生成器依赖全量已安装模块，本机缺 7 个模块无法运行（既有环境缺口）。
## new_emoji Tabs 样式与运行时全量补齐（2026-09-15）

对照 new_emoji 92 页组件总览的「标签页 Tabs」页（表头样式/卡片禁用/方向布局/编辑工作区）逐 API 审计 IDE 集成度后补齐四处缺口：

- **逐项禁用进生成链路**（功能缺口）：`EU_SetTabsItemsEx` 高阶协议支持每项 6 字段（`标题\tID\t内容\t图标\t禁用\t可关闭`），生成器此前只写 3 字段，设计器逐项「禁用」勾选在 F5 后完全无效（库没有 `EU_SetTabsItemDisabled` 单项 setter）。`readNewEmojiCatalogProperty` 的 itemsEx 序列化已补全 6 字段并清洗字段内协议分隔符（`|`、制表符、换行）。
- **两个事件补进 IDE**：清单合成事件新增 `ItemAdded`（新增标签页，处理器收新项目索引，`EU_SetTabsAddCallback`/ElementValueCallback）与 `ItemsReordered`（拖拽重排，处理器收原索引/新索引/项目总数，`EU_SetTabsReorderCallback`/ElementReorderCallback），自动带出 `NE标签页_绑定/解绑新增标签页`、`NE标签页_绑定/解绑拖拽重排`，事件绑定 921→923；生成器 `getNewEmojiEventArgumentExpressions` 补两条参数映射。
- **运行时命令族**（数据桥接第三批，命令数 3986→4011）：`NE标签页_设置激活索引/取激活索引/取激活标题/取项目数量/添加项目/关闭项目/设置滚动偏移/滚动` + 运行时样式族 `设置标签样式/设置标签位置/设置表头对齐/设置表头可见/设置可编辑/设置内容可见/启用浏览器模式/设置浏览器度量/设置项目图标/设置项目可关闭/设置项目状态/设置新建按钮可见/设置拖拽选项`，共 21 条宽字符桥接命令，实现集中在 `NEW_EMOJI_DATA_BRIDGE_HELPERS`（注意：该常量在 `generateNewEmojiMenuResourceRuntime` 之前结束——把新助手插进菜单运行时模板会导致无菜单工程 C3861，本次已踩过并回移）。
- **设计器画布预览重写**（`TabControlDesignerPreview.tsx`）：新增标签样式（线条/卡片/边框卡片）、表头四向（0 顶部/1 右侧/2 底部/3 左侧，尺寸公式与 `getControlTabContentOffset` 对齐）、逐项禁用灰显/固定📌/加载中⟳/静音🔇/提醒红点、可关闭 ×、可新增 +、浏览器（Chrome）模式含度量与新建按钮；Win32 TabControl 分支保持旧视觉契约（`inset 0 -2px` 选中线、`max-w-[220px]`、`border border-t-0` 内容边框类结构）。
- **验证**：门禁计数 921→923 写回 `tests/modules.test.ts`；数据桥接测试扩展 Tabs 命令签名/生成断言与事件跳板断言；`module:new-emoji:check`（module-build/installed/package 三处一致）通过；CLI 无头构建探针工程（卡片样式+禁用项+图标+钉住+提醒+addable+运行时命令）MSVC 编译成功，exe 运行 4 秒稳定，PrintWindow 截图确认禁用灰显、卡片样式、图标/提醒/×/+ 全部生效。
- **遗留**：新命令与事件待 `npm run module:web-sync` 同步官网 /commands（需管理员凭据，随下版统一执行）；`.lingbuilder/module-packages/new_emoji.lbmod` 已随本次生成重出，随下版安装包分发。

## new_emoji 运行时 DLL 单文件内嵌与示例复刻收尾（2026-09-13）

### 已落地

- AI Bridge / F5 构建管线把 `new_emoji.dll` 以 RCDATA 资源编入 EXE，延迟加载钩子首次调用时解压到 EXE 目录（不可写回退 `%LOCALAPPDATA%\LingBuilder
untime`），实现单文件分发。三处关键修正：`/DELAYLOAD` 必须走 cl 链接行的 `/link` 段（cl 会静默丢弃不带 `/link` 的纯链接器选项）；内嵌架构跟随 `compiler.arch`（`preferredTargetId`），不按 buildDir 目录名猜；rc 资源名用不带引号裸标识符（VS18 rc.exe 把裸标识符编译为字符串资源名，带引号反而查不到）。规则详见《LingBuilder AI 规则手册》「new_emoji 运行时 DLL 单文件内嵌规则」。
- Visual Studio 独立导出工程暂不内嵌（无 RCDATA 行与 /DELAYLOAD），回退「DLL 与 EXE 同目录」；后续如需 VS 导出也单文件，可在 `visualStudioProjectExporter.ts` 补 RCDATA 项与 `<DelayLoadDLLs>` 元数据。

### 遗留（需改 new_emoji 上游运行时渲染）

- 06-富列表全功能：行内徽标药丸（进行中/排队中/完成）超出列表右缘被裁切，需运行时按徽标宽度收缩行文本或内缩药丸。
- 07-浏览器外壳：NE地址栏在已设置 URL 时仍绘制居中占位文本，两者叠写；源码声明的 ➖/✕ 图标按钮被渲染成右上角两个绿色对勾。
- 13-组件画廊精选：NE标签页设置显式标签项后，内容区仍残留单字（「组」）错位绘制。
- 以上三项与生成代码无关（示例源码正确），需在 `T:\github
ew_emoji` 控件绘制层修复后重出 DLL 双架构产物并重装模块、重建示例。

## 网页访问模块内置化（2026-09-13）

- `lingbuilder.web.http` 已转内置模块：同步族（网页_访问_对象 + 5 条结果读取）WinHTTP 实现已移植进生成模板 `#ifdef LINGBUILDER_WEB_HTTP_MODULE` 块，异步族沿用模板既有实现。**内置模块（builtin://）不走 nativeDependencyService 依赖物化**——以后把任何带 C++ 桥接源码的安装模块转内置时，必须先把桥接实现搬进生成模板，否则全新工作区会编译缺符号（C3861）。
- 遗留待办：旧工作区中以 1.0.0 `.lbmod` 安装的网页访问模块与内置模块同 ID，官方后续版本可考虑在模块扫描时检测同 ID 安装版并提示卸载/迁移；`网页_异步访问` 目前不携带正文参数，异步 POST 带正文可作为后续命令增强（新增参数需走命令入账门禁 + module:web-sync）。

## Windows 控制台程序项目类型（2026-09-14）

### 已落地

- 新建项目对话框第三种可用类型「Windows 控制台程序」：模板 `windows-console`、解决方案项目 `type: "windows-console"`，对话框扩为 2×3 六卡（Windows 界面/DLL/控制台可用 + Mac 界面/动态库/控制台规划中占位）。控制台项目设计器模型只保留一个无控件宿主窗口（类名 `程序`），工作台直接打开 `程序.lcpp`，AI Bridge `project.create` 返回该最小设计器模型供后续 build/preview 使用。
- 生成器新增第三种产物形态 `outputKind: "console-application"`：以某个类「公开」节的 `整数型 启动()`（或 `空 启动()`）为程序主体，生成 `wmain`（`#ifdef _WIN32`/`#else main`，macOS 预留）+ `SetConsoleOutputCP(CP_UTF8)` + 惰性运行时初始化（COM/GDI+/通用控件，无窗口类注册、无消息循环），「整数型」返回值即进程退出码；入口缺失/重复/返回类型不符给中文阻断诊断。VS 导出器 `projectKind: "console-application"` 输出 `<SubSystem>Console</SubSystem>`（其余沿用 Windows 子系统，wmain 自动决定链接子系统，无需额外链接参数）。
- F5「生成并运行」：控制台项目走 `handleSolutionBuildCommand('build', projectId, run=true)`，`runControlledWindowDesignerBuild` 按 `type === "windows-console"` 选择控制台生成与 VS 导出形态，运行 `windowsHide: true`（输出经 run.log 进输出面板，不弹黑窗）。AI Bridge 侧新增 `resolveProjectOutputKind` 统一解析窗口应用/DLL/控制台（`native.preview`、`build.run`、VS 导出共用），`build.run` 控制台运行同样隐藏宿主控制台。命令面板/工具栏 F5 语义、DLL 项目行为不变。
- E2E 实测（临时工作区 CLI 全链路）：`project create`（windows-console）→ `project run --yes` 编译成功，产物为 PE32+ console 子系统 exe，运行退出码 0（`启动()` 返回 0 透传），run.log 中文 `调试输出` 正确。单元测试 `tests/consoleProject.test.ts` 7 用例（wmain 生成/空返回/缺失阻断/重复阻断/返回类型阻断/类名改名的窗口对齐/vcxproj Console 子系统）已挂入 `test:lingcpp`。

### 遗留 / 后续

- macOS 适配：控制台入口已 `#ifdef` 预留，但运行时初始化仍是 Win32（`GetModuleHandleW`/COM/GDI+）；接 clang 后端时需要平台化的初始化层与模块平台 target 门禁（后端模块多数声明 `windows-msvc-*` target，需逐步补 macOS target）。
- 2026-09-15 实机演示补齐（`AI 视频自主生产/进阶方案/控制台功能报告演示/`，8 组全 PASS、退出码 0）：期间修复两个控制台专属问题——①线程任务族在无窗口环境因 owner 未注册必然提交失败，控制台入口现自动注册无通知 owner（`LingThreadRegisterHeadlessOwner`），但完成/进度处理器仍不排空，须用「提交+等待+队列」取结果；②控制台应用单例改常驻不析构，规避静态析构逆序在无窗口收尾的 0xC0000005。
- 控制台项目的模块门禁：第一版不限制启用模块；控件类命令在无窗口运行时自然无效。后续可按「控制台项目禁用设计器控件模块」给出中文诊断（当前 #3 决策按「先不限」落地）。
- 控制台交互输入（`scanf`/控制台读行）没有对应中文命令；如需「控制台_读取行」类命令，走模块命令入账门禁新增。
- `Mac 界面设计`/`Mac 平台动态库开发`/`Mac 控制台程序` 三张规划中卡片为占位，后续 macOS 适配时逐张转「当前可用」。
