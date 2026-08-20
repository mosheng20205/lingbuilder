# Git 功能补齐设计（2026-08-21）

## 目标

补齐 LingBuilder Git 面板与 VS Code 源代码管理体验的六项差距，保持现有分层（GitService → server.ts 路由 → sourceControlService mutation 映射 → SourceControlPanel UI → 命令系统）不变。子模块（submodule）支持本次暂缓。

## 范围

### 1. stash 贮藏管理

- `GitService.stashList()`：`git stash list --format=%gd%x00%gs%x00%ci`，返回 `{ index, message, createdAt }`（index 从 reflog 名解析为非负整数）。
- `GitService.stashSave(message?, includeUntracked)`：`git stash push [-u] [-m message]`；消息 ≤500 字符、拒绝 NUL；默认消息由 Git 生成。
- `GitService.stashApply(index, pop)`：`git stash apply|pop stash@{index}`；pop 在有冲突时保留 stash 并抛出中文错误。
- `GitService.stashDrop(index)`：`git stash drop stash@{index}`；不存在的索引由 Git 报错并原样透出。
- 路由：`GET /api/source-control/stashes`、`POST /api/source-control/stashes`（save）、`POST /api/source-control/stashes/apply`、`DELETE /api/source-control/stashes/:index`。
- UI：顶栏新增 Archive 图标切换 stash 视图；列表显示索引、消息、时间；操作：贮藏当前更改（可填消息、可选包含未跟踪）、应用、弹出、删除（应用/弹出/删除均带说明，删除走 danger 确认）。

### 2. tag 标签管理

- `GitService.tags()`：`git for-each-ref --format=%(refname:short)%00%(objectname)%00%(contents:subject) refs/tags/`，返回 `{ name, commit, subject }`。
- `GitService.createTag(name, message?)`：message 非空走 `tag -a -m`，否则走轻量 tag；tag 名按 refname 规则校验（拒绝空格、`~^:?*[\`、`..`、`@{`、`~`、`^`、开头 `-`/`.`、结尾 `.lock`/`/`/`.`，长度 ≤200）。
- `GitService.deleteTag(name)`：`git tag -d`。
- 路由：`GET/POST /api/source-control/tags`、`DELETE /api/source-control/tags/:name`。
- UI：分支视图下方新增"标签"分区：列表（名称 + 提交主题）、新建（名称 + 可选说明）、删除（danger 确认）。

### 3. 历史分页

- 后端 `history(limit, skip)` 已支持；仅 UI 增加"加载更多"按钮：`skip += 50` 追加，返回不足 50 条时隐藏按钮并显示"已加载全部提交"。

### 4. blame 接编辑器上下文

- `SourceControlPanel` 新增可选 prop `activeFilePath?: string`；blame 对话框的文件路径字段默认填充该值（用户仍可修改）。Sidebar 传入当前活动文件的相对路径。

### 5. Monaco 并排 Diff

- `GitService.diff()` 增强：`GitDiff` 新增 `original: string`、`modified: string`、`language`（按扩展名映射）：
  - 未跟踪新文件：original = ''，modified = 工作区全文。
  - staged=false：original = `:path`（暂存区），modified = 工作区文件全文。
  - staged=true：original = `HEAD:path`，modified = `:path`。
  - 已删除文件：modified = ''。
  - original/modified 各自经 `limitUtf8` 2MB 截断；binary 文件跳过（继续返回文本提示）。
- UI：diff 视图优先渲染 `@monaco-editor/react` 的 `DiffEditor`（side-by-side、readOnly、主题随 isDarkMode），Monaco 实例复用 MonacoCodeEditor 模块顶层的全局 `loader.config`；提供"并排/补丁"切换，补丁视图保留现有纯文本渲染作为降级（二进制、超长截断提示不变）。
- 语言映射集中在小 helper：按扩展名返回 Monaco language id（lcpp→lingcpp 在 Monaco 已注册的前提下使用，未识别回落 plaintext）。

### 6. 更改列表大列表优化

- 工作区/已暂存两个分区内部按**顶层目录分组**：组头显示目录名（根目录显示 `(根目录)`）+ 计数徽章，可折叠（默认展开），折叠状态存组件 state；文件行渲染逻辑不变。
- 不引入虚拟滚动依赖；分组后单组渲染量小，5380 个更改的场景渲染压力显著下降。
- 选中集合（checkbox 多选）与分组渲染解耦：跨组选择仍有效，组头显示组内选中数。

## 错误处理与安全

- 所有新输入（stash 消息、tag 名、tag 说明）走与现有分支名/远程名同风格的中文校验错误。
- stash apply/pop 产生冲突时：Git 命令失败 → 透出 stderr 中文提示，提示用户到冲突面板处理；pop 冲突时 Git 自身不会删除 stash 条目，无需额外逻辑。
- `stash@{index}` 拼接全部经由 `execFile` 参数数组传递，index 严格校验为 0–999 非负整数，无注入面。
- 删除 tag、drop stash 走 danger 确认对话框。

## 测试

- `tests/gitService.test.ts` 新增：
  - stash：save（含消息与 includeUntracked）→ list → apply → drop 全流程；pop 应用后列表清空；非法消息/索引被拒绝。
  - tag：创建轻量与附注 tag → 列表 → 删除；非法 tag 名被拒绝。
  - diff 增强：staged/unstaged/新文件三种情形的 original/modified 内容断言。
- `tests/sourceControlPanel.test.tsx` 新增文本断言：贮藏视图操作、标签分区、加载更多、并排 diff 切换、目录分组、activeFilePath 传递。
- 验收命令：`npm run lint`、`node --import tsx --test tests/gitService.test.ts tests/gitRemote.test.ts tests/sourceControlPanel.test.tsx`。

## 文档

- 按项目规范写入 `更新记录/2026-08-21.md`。
