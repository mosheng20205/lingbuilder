你是资深 Electron 打包工程师。LingBuilder 生产云端已部署并验证：
- 云端 API：https://api.lingbuilder.com（/health 返回 {"ok":true,...}）
- 工作区：c:\Users\Administrator\Downloads\c++-汉化集成开发环境(lingbuilder)

任务：在本 Windows 开发机重新打包"在线版"LingBuilder 安装包（安装后登录、充值、检查更新等云端功能开箱即用）。直接执行命令并验证结果，不要只给教程。

步骤（PowerShell，用 ; 分隔语句，不要用 &&）：
1. 门禁：先执行 curl.exe -s https://api.lingbuilder.com/health，必须返回 200 且 ok=true，否则停止并报告。
2. cd electron
3. 设置在线模式环境变量（不修改任何源码与 electron-builder 配置）：
   $env:LINGBUILDER_CLOUD_RELEASE_MODE="online"
   $env:LINGBUILDER_CLOUD_API_URL="https://api.lingbuilder.com"
4. 逐步执行打包（任一步失败立即停止并报告）：
   node scripts/prepare-cloud-release-config.cjs
   npm run verify:cef3-release
   npm run verify:fbro-release
   npm run build
   npm run prepare:webview2
   npx electron-builder --win nsis --x64 --config.directories.output=release/online-0.6.0
   注意：Typora 经常锁定默认 release\win-unpacked，必须用独立输出目录（可改为 release/online-<日期>），不要写默认 release 目录。
5. 验证（全部通过才算完成）：
   - Get-Content release\online-0.6.0\win-unpacked\resources\cloud-release.json 必须为 cloudMode=online、cloudApiOrigin=https://api.lingbuilder.com；
   - node scripts/verify-on-demand-sdk-release.cjs unpacked release\online-0.6.0\win-unpacked 输出 "ok": true（CEF3/FBro 精简校验）；
   - node scripts/verify-on-demand-sdk-release.cjs installer release\online-0.6.0\LingBuilder-0.6.0-x64.exe 输出 "ok": true；
   - Get-FileHash release\online-0.6.0\LingBuilder-0.6.0-x64.exe -Algorithm SHA256 记录哈希。
6. 在 更新记录/<当天日期>.md 追加：在线版安装包路径、SHA-256、上述验证结果。
7. 汇报安装包完整路径与 SHA-256，提示用户可覆盖安装。

约束：
- 不修改 cloud/、src/、Electron 源码或 electron-builder 配置，只通过环境变量切换发布模式；
- 不要打离线包（LINGBUILDER_CLOUD_RELEASE_MODE=offline 是分发用离线版，与本任务相反）；
- 若 electron/package.json 版本号已变化，安装器文件名随之变化（LingBuilder-<版本>-x64.exe），验证路径同步调整。