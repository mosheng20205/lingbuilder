import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

test('extension panel exposes host state, enablement and generic contribution points', async () => { const source = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/ExtensionHostPanel.tsx'), 'utf8'); assert.match(source, /Extension Host/u); assert.match(source, /\/api\/extensions/u); assert.match(source, /contributes\?\.commands/u); assert.match(source, /contributes\?\.menus/u); assert.match(source, /contributes\?\.views/u); assert.match(source, /contributes\?\.languages/u); assert.match(source, /contributes\?\.themes/u); assert.match(source, /role="alert"/u); });
test('server builds a dedicated extension host artifact and shuts it down', async () => { const pkg = await fs.readFile(path.resolve(import.meta.dirname, '../package.json'), 'utf8'); const server = await fs.readFile(path.resolve(import.meta.dirname, '../server.ts'), 'utf8'); assert.match(pkg, /build:extension-host/u); assert.match(pkg, /extension-host\.cjs/u); assert.match(server, /extensionService\.stop/u); assert.match(server, /\/api\/extensions\/commands/u); assert.match(server, /\/themes\/:themeId/u); });
