const fs = require('node:fs');
const path = require('node:path');

const origin = String(process.env.LINGBUILDER_CLOUD_API_URL || '').trim().replace(/\/$/, '');
if (!origin.startsWith('https://')) {
  console.error('正式打包前必须设置 LINGBUILDER_CLOUD_API_URL，且地址必须以 https:// 开头。');
  process.exit(1);
}
const target = path.resolve(__dirname, '..', 'installer', 'cloud-release.json');
fs.writeFileSync(target, `${JSON.stringify({ schemaVersion: 1, cloudApiOrigin: origin }, null, 2)}\n`, 'utf8');
console.log(`已写入正式云端地址：${origin}`);
