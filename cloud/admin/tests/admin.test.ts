import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
test('admin shell exposes accessible navigation and zero-retention messaging',()=>{const source=fs.readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');assert.match(source,/aria-current/u);assert.match(source,/skip-link/u);assert.match(source,/零保留/u);assert.match(source,/role="alert"/u)});
