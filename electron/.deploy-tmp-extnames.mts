import { FBRO_VIP_API_CATALOG } from './src/services/modules/fbroVipApiCatalog.ts';
const ext = FBRO_VIP_API_CATALOG.filter(e => e.route === 'extension');
const fs = await import('node:fs');
fs.writeFileSync('.deploy/ext-names.txt', ext.map(e => e.command.name + '  |  ' + e.command.description.slice(0, 80)).join('\n'), 'utf8');
console.log('count:', ext.length);
