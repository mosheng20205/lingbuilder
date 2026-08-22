# R2 大文件上传器

这是一个个人使用的 Cloudflare R2 大文件上传程序。浏览器按 32 MiB 分片、3 路并发上传，失败或 R2 确认超时时最多重试 3 次。580 MiB 文件会传输 19 个 Multipart 临时分片；完成后 R2 存储桶中生成一个完整对象，例如：

```text
uploads/LingBuilder-0.2.7-x64.exe
```

下载接口直接读取这个 R2 对象，支持 HTTP `HEAD` 和单区间 `Range`。上传完成后会显示下载地址，并触发 JavaScript 完成回调。

## 首次配置

`wrangler login` 只用于部署 Worker，不能作为 R2 S3 Access Key。使用本机上传程序前，需要在 Cloudflare 控制台创建 R2 API 凭据：

1. 打开 Cloudflare 控制台的 `R2 对象存储`。
2. 进入 `管理 R2 API 令牌`。
3. 创建权限为 `Object Read & Write` 的令牌。
4. 将权限限定到存储桶 `462030`。
5. 保存页面只显示一次的 `Access Key ID` 和 `Secret Access Key`。

官方入口和说明：[R2 API 令牌](https://developers.cloudflare.com/r2/api/tokens/)。

## 本机上传

安装并启动：

```powershell
cd tools/r2-large-file-uploader
npm install
npm start
```

程序会自动打开 [http://127.0.0.1:8791](http://127.0.0.1:8791)。首次打开时填写：

- `Account ID`：已预填当前账号 `f5ae4747daef58a439015054049ed986`。
- `存储桶`：已预填 `462030`。
- `Access Key ID` 和 `Secret Access Key`：填写上一步创建的 R2 API 凭据。
- `R2 公开域名`：默认是 `https://msimgimg.xyz`，完成地址会直接拼接 R2 对象 Key。

点击“保存并验证”成功后，选择文件并点击“开始上传”。配置按个人使用要求明文保存在被 Git 忽略的 `r2-uploader.config.json`，本机服务只监听 `127.0.0.1`。

终端必须在上传期间保持运行，按 `Ctrl+C` 停止程序。可选环境变量：

```powershell
$env:R2_UPLOADER_PORT = "8792"
$env:R2_UPLOADER_BUCKET = "你的存储桶名称"
$env:R2_UPLOADER_ACCOUNT_ID = "你的 Account ID"
$env:R2_UPLOADER_PUBLIC_BASE_URL = "https://你的 R2 自定义域名"
npm start
```

## Windows 客户端

Windows x64 便携版不需要安装 Node.js，也不需要保持终端运行。双击以下文件即可启动：

```text
dist-client/LingBuilder-R2-Uploader-1.0.0-x64.exe
```

当前便携版未配置商业代码签名证书，Windows SmartScreen 可能显示“未知发布者”。

客户端内置本机上传服务并自动选择空闲端口。当前机器第一次从源码启动客户端时，会把现有 `r2-uploader.config.json` 迁移到：

```text
%APPDATA%\LingBuilder R2 大文件上传器\r2-uploader.config.json
```

EXE 不内嵌 R2 Secret；复制到没有现有配置的电脑后，在客户端页面填写并验证凭据即可。源码开发和重新打包命令：

```powershell
npm run desktop
npm run dist:win
```

本机客户端的进度只统计已收到 R2 ETag 确认的分片。网络连接卡住时，单个分片会在超时后自动重试；R2 合并响应丢失时，服务会通过最终对象大小确认是否已经完成，不会让界面无限停在“正在合并”。

## 下载地址

完成响应包含两个地址：

- `downloadUrl`：本机下载地址，仅在 `npm start` 运行期间有效。
- `publicDownloadUrl`：R2 自定义域名下载地址，可长期使用；页面优先显示这个地址，例如 `https://msimgimg.xyz/uploads/LingBuilder-0.2.7-x64.exe`。

两个地址读取的是同一个 R2 完整对象。使用 `publicDownloadUrl` 时，R2 存储桶的自定义域名必须处于 Active 状态；本机 `downloadUrl` 不依赖公开访问。

## 部署 Worker

部署页面和公开下载接口需要 Wrangler 登录：

```powershell
npx wrangler login
npm run check
npx wrangler deploy --dry-run
npm run deploy
```

部署后的页面通过 Worker 的 `FILES` R2 binding 直接执行原生 Multipart Upload，不需要在网页填写 S3 凭据。当前 Worker 地址（自定义域名，大陆网络可达）：

[https://upload.msimgimg.xyz](https://upload.msimgimg.xyz)

原 `*.workers.dev` 地址在大陆网络无法直连，当前部署已停用 workers.dev 路由，统一走 `msimgimg.xyz` 同一 Cloudflare 区域的 Worker 自定义域名（在 `wrangler.jsonc` 的 `routes` 里配置）。

只在本机模拟 R2、不写入真实存储桶时运行：

```powershell
npm run dev:local
```

## 上传鉴权与跨域（管理后台直连）

部署后的 `/api/uploads/*` 支持 Bearer 令牌校验和跨域白名单：

1. 生成一个随机令牌（例如 `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`）。
2. 保存到 Worker secret：`npx wrangler secret put R2_UPLOAD_TOKEN`。
3. 重新部署：`npm run deploy`。设置 secret 后，所有 `/api/uploads/*` 请求必须携带 `Authorization: Bearer <令牌>`，否则返回 401；未设置 secret 时保持原有开放行为。
4. 跨域白名单在 `wrangler.jsonc` 的 `UPLOAD_ALLOWED_ORIGINS`（逗号分隔），当前允许 `https://lingbuilder.com`（生产管理后台）和 `http://127.0.0.1:17901`（本机开发）。不在白名单内的来源不会拿到 CORS 响应头。

Worker 自带页面在检测到 Worker 模式（无本机 `/api/config`）时会显示“上传令牌”栏，填入后保存在本机浏览器 `localStorage`，上传请求自动携带。

管理后台（官网内容 → 版本与下载）已内置“直链上传”入口：云端 API 通过 `GET /v1/admin/site/r2-upload/config` 把 Worker 地址和令牌下发给已登录管理员（需 `super_admin` / `operator` 角色），浏览器分片直传 Worker，文件字节不经过官网服务器；上传完成后自动填写文件大小、SHA-256、版本号，并写入“直链”镜像。云端 API 侧需设置环境变量 `R2_UPLOAD_WORKER_URL` 和 `R2_UPLOAD_TOKEN`（后者与 Worker secret 一致），两者都配置后功能才开启。

## 完成回调

页面同时提供全局函数和标准 DOM 事件：

```js
window.onR2UploadComplete = result => {
  console.log('公开下载地址：', result.publicDownloadUrl);
  console.log('R2 Key：', result.key);
  console.log('文件大小：', result.size);
};

window.addEventListener('r2-upload-complete', event => {
  console.log(event.detail.publicDownloadUrl);
});
```

回调对象主要字段：

```ts
{
  ok: true;
  key: string;
  size: number;
  etag: string;
  downloadUrl: string;
  publicDownloadUrl: string;
  file: File;
}
```

## 存储格式

新版上传完成后只有一个正式对象：

```text
uploads/<文件名>
```

R2/S3 Multipart 的临时分片由 R2 管理，`CompleteMultipartUpload` 成功后组合成上述对象。取消上传会调用 `AbortMultipartUpload` 清理临时分片。

早期版本产生的 `.lingbuilder-parts/` 和 `.lingbuilder-manifest.json` 对象只保留下载兼容，不再用于新上传。确认同一文件已通过新版成功上传为完整对象后，再删除旧分片和清单。

## 接口

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| `GET` | `/api/config` | 读取本机 R2 配置状态 |
| `POST` | `/api/config` | 保存并验证本机 R2 S3 凭据 |
| `POST` | `/api/uploads/init` | 创建 R2 Multipart Upload |
| `PUT` | `/api/uploads/part` | 上传一个原生 Multipart 分片 |
| `POST` | `/api/uploads/complete` | 合并成完整 R2 对象并返回下载地址 |
| `POST` | `/api/uploads/abort` | 取消 Multipart Upload |
| `GET/HEAD` | `/files/<key>` | 下载或查看完整 R2 对象 |

## 安全边界

按个人使用需求，本机凭据没有加密；配置文件已被 Git 忽略。

部署后的 Worker：`/api/uploads/*` 在设置了 `R2_UPLOAD_TOKEN` secret 后必须携带 Bearer 令牌，跨域只开放 `UPLOAD_ALLOWED_ORIGINS` 白名单内的来源；`/files/*` 公开下载接口保持无需登录。未设置 secret 时上传接口保持开放，任何知道 Worker 地址的人都可以调用，长期公开部署应务必设置。管理后台下发的令牌等同于 R2 存储桶的上传权限，应妥善保管，泄露后重新执行 `npx wrangler secret put R2_UPLOAD_TOKEN` 并同步更新云端 API 环境变量即可轮换。
