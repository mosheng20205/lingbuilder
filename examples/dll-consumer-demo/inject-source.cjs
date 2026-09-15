#!/usr/bin/env node
// Inject examples/dll-consumer-demo/src/调用项目动态库.lcpp into build-request.json.
const fs = require('fs');
const path = require('path');
const dir = __dirname;
const source = fs.readFileSync(path.join(dir, 'src', '调用项目动态库.lcpp'), 'utf8');
const requestPath = path.join(dir, 'build-request.json');
const request = JSON.parse(fs.readFileSync(requestPath, 'utf8'));
request.lingCppSourceCode = source;
request.lingCppSources = [{ filePath: 'examples/dll-consumer-demo/src/调用项目动态库.lcpp', sourceCode: source }];
fs.writeFileSync(requestPath, JSON.stringify(request, null, 2) + '\n', 'utf8');
console.log('injected', source.length, 'chars into build-request.json');
