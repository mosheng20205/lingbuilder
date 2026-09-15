#!/usr/bin/env node
// Inject examples/dll-module-demo/src/Dll模块演示.lcpp into build-request.json as
// the authoritative embedded source for headless CLI builds.
const fs = require('fs');
const path = require('path');
const dir = __dirname;
const source = fs.readFileSync(path.join(dir, 'src', 'Dll模块演示.lcpp'), 'utf8');
const requestPath = path.join(dir, 'build-request.json');
const request = JSON.parse(fs.readFileSync(requestPath, 'utf8'));
request.lingCppSourceCode = source;
request.lingCppSources = [{ filePath: 'examples/dll-module-demo/src/Dll模块演示.lcpp', sourceCode: source }];
fs.writeFileSync(requestPath, JSON.stringify(request, null, 2) + '\n', 'utf8');
console.log('injected', source.length, 'chars into build-request.json');
