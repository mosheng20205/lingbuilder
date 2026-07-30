import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
test('admin shell exposes accessible navigation and zero-retention messaging',()=>{const source=fs.readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');assert.match(source,/aria-current/u);assert.match(source,/skip-link/u);assert.match(source,/零保留/u);assert.match(source,/role="alert"/u)});
test('public home page explains the software without exposing admin operations',()=>{const source=fs.readFileSync(new URL('../src/HomePage.tsx',import.meta.url),'utf8');assert.match(source,/用中文构建/u);assert.match(source,/确定性规则/u);assert.match(source,/真实 C\+\+/u);assert.match(source,/下载体验/u);assert.doesNotMatch(source,/管理员登录/u)});
test('system AI provider admin supports DeepSeek and custom compatible protocols',()=>{const source=fs.readFileSync(new URL('../src/SystemAiProviderAdmin.tsx',import.meta.url),'utf8');assert.match(source,/deepseek-v4-flash/u);assert.match(source,/deepseek-v4-pro/u);assert.match(source,/OpenAI 兼容协议/u);assert.match(source,/Anthropic Messages 协议/u);assert.match(source,/Base URL/u);assert.match(source,/Model Name/u);assert.match(source,/API Key/u)});
