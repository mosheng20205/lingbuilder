# SDK 按需下载与离线安装

LingBuilder Windows 安装包不再内置 CEF3、FBro 两套大型 SDK。首次在项目中使用对应模块进行构建（F5）、运行、原生预览或工程导出时，IDE 会弹出安装对话框，说明 SDK 名称、版本与体积，下载完成并校验 SHA-256 后自动继续操作。本文解决三类问题：下载失败怎么办、代理怎么配、完全离线怎么装。

## 正常流程

1. 触发构建/运行时，安装对话框列出需要的 SDK 与体积，点「下载并安装」。
2. 下载使用安装包内置的 aria2（8 路连接、断点续传），完成后自动校验精确大小与 SHA-256，安全解压并原子安装。
3. 安装结果全机器共享：`%APPDATA%\LingBuilder\sdk-cache`。其他工作区再遇到同一下载会直接复用，提示「已安装，无需重复下载」。
4. 取消下载会保留已下载部分，下次继续，不会从头开始。

## 下载失败排查

安装失败信息已全部中文化，按提示处理即可。常见情况：

- **「无法连接下载服务器…请检查网络连接或代理设置」**：多为网络不通或代理不可用，见下节代理说明。
- **「服务器上不存在该资源」/ HTTP 404**：官方已更换下载地址；先更新 LingBuilder 到最新版再试。
- **「下载超时」/ 长时间停在某个进度**：30 秒无新数据时进度条旁会提示「已 N 秒未收到数据…」。线路不稳定时可多试几次（支持断点续传），或改用下方手动部署。
- **「磁盘空间不足」**：两个 SDK 解压后各占约 0.5–1 GiB，清理 `%APPDATA%\LingBuilder\sdk-cache` 或系统盘后重试。
- **「下载文件大小或 SHA-256 不匹配，已拒绝安装」**：下载内容损坏，删除 `%APPDATA%\LingBuilder\sdk-cache\downloads` 下的对应文件后重试。
- 重新尝试时在安装对话框点「重试安装」即可，无需重启 IDE。

## 代理设置

IDE 下载前会自动读取代理，无需在 IDE 内配置：

1. 环境变量 `HTTPS_PROXY` / `https_proxy` / `ALL_PROXY` / `all_proxy`；
2. 其次是 Windows 系统代理（「设置 → 网络和 Internet → 代理」里配置的那个）。

仅支持 HTTP/HTTPS 代理（`http://host:port`），SOCKS 代理不被支持。设置后重新触发下载即可生效。

## 完全离线安装（IDE 内下载一直失败时）

在一台能上网的机器上，从下方「资源清单」的直链用浏览器或下载工具下载 ZIP，然后用以下任一方式安装到离线机器。

### 方式一（推荐）：放完整 ZIP，让 IDE 校验安装

1. 用 `certutil -hashfile "<zip 路径>" SHA256` 核对哈希与下表一致。
2. 把 ZIP 放到 `%APPDATA%\LingBuilder\sdk-cache\downloads\`（目录不存在则逐级新建），文件名保持原样，不要解压、不要改名。
3. 回到 IDE 重新触发被拦截的操作，点「下载并安装」/「重试安装」；IDE 检测到完整 ZIP 后跳过下载直接安装。ZIP 必须与官方包字节一致，不一致时会被删除并转为联网下载。

### 方式二：直接解压到共享模块目录（完全离线）

1. 解压 ZIP，得到顶层文件夹 `lingbuilder.cef3.sdk/` 或 `lingbuilder.fbro.sdk/`。
2. 将该文件夹整个放到 `%APPDATA%\LingBuilder\sdk-cache\modules\` 下。
3. 在该文件夹内新建文本文件 `.lingbuilder-sdk-install.json`（UTF-8，无扩展名），内容按下表填写：

| 字段 | CEF3 | FBro |
| --- | --- | --- |
| `dependencyId` | `cef3` | `fbro` |
| `moduleId` | `lingbuilder.cef3.sdk` | `lingbuilder.fbro.sdk` |
| `version` | `150.0.14+g7c1aa68+chromium-150.0.7871.129` | `135.0.21.2.2.0` |
| `archiveSha256` | `b984477a30527864f67aab5817b4ee17d23ec1977fc5a6ab191b19a373a6dc55` | `99ed17b2d649a91acf7552a5fce9427541a9fef287cbd8ef5a5855ebd449361f` |
| `schemaVersion` | `1` | `1` |

4. 重新触发构建/运行即可识别，无需重启 IDE。标记缺失或字段不匹配时该目录不生效。

### 方式三：工作区级安装

把解压出的 `lingbuilder.cef3.sdk/`（或 `lingbuilder.fbro.sdk/`）整个文件夹放到 `<工作区>\.lingbuilder\modules\` 下。此方式不需要安装标记，但只对当前工作区生效。

高级用户也可以设置环境变量 `CEF3_SDK_ROOT` / `FBRO_SDK_ROOT` 直接指向已解压的 `sdk` 目录（例如 `...\lingbuilder.cef3.sdk\sdk`）。

验证是否成功：重新执行被拦截的操作能通过；或检查 `%APPDATA%\LingBuilder\sdk-cache\modules\<模块 ID>\sdk` 下关键文件是否完整。

## 资源清单（下载核对用）

| | CEF3 SDK | FBro SDK |
| --- | --- | --- |
| 模块 ID | `lingbuilder.cef3.sdk` | `lingbuilder.fbro.sdk` |
| 版本 | `150.0.14+g7c1aa68+chromium-150.0.7871.129` | `135.0.21.2.2.0`（SDK `135.0.21`） |
| 平台 | Windows x64 | Windows x64 |
| 压缩包 | `lingbuilder-cef3-sdk-150.0.14-chromium-150.0.7871.129-windows-x64.zip` | `lingbuilder-fbro-sdk-135.0.21.2.2.0-windows-x64.zip` |
| 下载地址 | <https://msimgimg.xyz/uploads/lingbuilder-cef3-sdk-150.0.14-chromium-150.0.7871.129-windows-x64.zip> | <https://msimgimg.xyz/uploads/lingbuilder-fbro-sdk-135.0.21.2.2.0-windows-x64.zip> |
| 大小 | 186457476 字节（约 177.8 MiB） | 245575922 字节（约 234.2 MiB） |
| SHA-256 | `b984477a30527864f67aab5817b4ee17d23ec1977fc5a6ab191b19a373a6dc55` | `99ed17b2d649a91acf7552a5fce9427541a9fef287cbd8ef5a5855ebd449361f` |
| ZIP 顶层目录 | `lingbuilder.cef3.sdk/` | `lingbuilder.fbro.sdk/` |

## 常见问题

- **每次打开项目都要重新下载吗？** 不会。安装结果全机器共享，只有第一次需要下载。
- **下载会占用官方服务器吗？** 下载走官方对象存储直链，支持断点续传与多连接。
- **离线机器能装吗？** 能，见上方三种手动方式。
- **下载的 SDK 会被校验吗？** 会。精确字节数 + SHA-256 逐字节校验，解压前阻止路径穿越，校验失败绝不安装。
