// 把 src/std-algo-demo.lcpp 内嵌进 build-request.json（CLI 构建以 lingCppSourceCode 为真源）。
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const requestPath = path.join(dir, 'build-request.json');
const sourcePath = path.join(dir, 'src', 'std-algo-demo.lcpp');

const request = JSON.parse(fs.readFileSync(requestPath, 'utf8'));
request.lingCppSourceCode = fs.readFileSync(sourcePath, 'utf8');
fs.writeFileSync(requestPath, JSON.stringify(request, null, 2), 'utf8');
console.log('injected', request.lingCppSourceCode.length, 'chars into', requestPath);
