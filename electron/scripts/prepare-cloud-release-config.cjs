const fs = require('node:fs');
const path = require('node:path');

const releaseMode = String(process.env.LINGBUILDER_CLOUD_RELEASE_MODE || 'online').trim().toLowerCase();
const origin = String(process.env.LINGBUILDER_CLOUD_API_URL || '').trim().replace(/\/$/, '');
if (releaseMode === 'offline') {
  if (origin) {
    console.error('离线打包不得同时设置 LINGBUILDER_CLOUD_API_URL。');
    process.exit(1);
  }
} else if (releaseMode !== 'online') {
  console.error('LINGBUILDER_CLOUD_RELEASE_MODE 只允许 online 或 offline。');
  process.exit(1);
} else if (!origin.startsWith('https://')) {
  console.error('正式打包前必须设置 LINGBUILDER_CLOUD_API_URL，且地址必须以 https:// 开头。');
  process.exit(1);
}
const target = path.resolve(__dirname, '..', 'installer', 'cloud-release.json');
const config = releaseMode === 'offline'
  ? { schemaVersion: 1, cloudMode: 'offline' }
  : { schemaVersion: 1, cloudMode: 'online', cloudApiOrigin: origin };
fs.writeFileSync(target, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
console.log(releaseMode === 'offline'
  ? '已写入离线发布配置：安装版不连接 LingBuilder 云端服务。'
  : `已写入正式云端地址：${origin}`);
