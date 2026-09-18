// 把 src/进程内存扫描演示.lcpp 回填进 build-request.json 的 lingCppSourceCode（两处保持一致）。
const fs = require('node:fs');
const path = require('node:path');

const demoRoot = __dirname;
const sourcePath = path.join(demoRoot, 'src', '进程内存扫描演示.lcpp');
const requestPath = path.join(demoRoot, 'build-request.json');

const request = JSON.parse(fs.readFileSync(requestPath, 'utf8'));
request.lingCppSourceCode = fs.readFileSync(sourcePath, 'utf8');
fs.writeFileSync(requestPath, JSON.stringify(request, null, 2) + '\n', 'utf8');
console.log('已回填 build-request 内嵌源码：' + Buffer.byteLength(request.lingCppSourceCode, 'utf8') + ' bytes');
