const fs = require('fs');
const path = require('path');

const cfgPath = path.join(__dirname, '..', 'cloud', 'admin', 'nginx.conf');
const original = fs.readFileSync(cfgPath, 'utf8');
const newCfg = original.replace(
  "location / { try_files $uri $uri/ /index.html; }",
  `location / { try_files $uri $uri/ /index.html; }
  location /docs/ { alias /usr/share/nginx/html/docs/; try_files $uri $uri/ =404; }`
);

if (newCfg === original) {
  console.error('No replacement made.');
  process.exit(1);
}
console.log(newCfg);
fs.writeFileSync(cfgPath, newCfg, 'utf8');
console.log('nginx.conf updated.');
