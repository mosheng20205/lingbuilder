import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import HelpCenterDialog from '../src/components/HelpCenterDialog';
import {
  LINGBUILDER_DISPLAY_VERSION,
  LINGBUILDER_RELEASE_NOTES,
  LINGBUILDER_VERSION
} from '../src/services/product/productInfo';

test('product version and release notes share package metadata', () => {
  const packageMetadata = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../package.json'), 'utf8'));
  assert.equal(LINGBUILDER_VERSION, packageMetadata.version);
  assert.equal(LINGBUILDER_DISPLAY_VERSION, `v${LINGBUILDER_VERSION}`);
  assert.equal(LINGBUILDER_RELEASE_NOTES[0]?.version, LINGBUILDER_VERSION);
});

test('about dialog exposes the shared software version and accessible dialog semantics', () => {
  const source = fs.readFileSync(path.resolve(import.meta.dirname, '../src/components/AboutDialog.tsx'), 'utf8');
  assert.match(source, /关于 LingBuilder IDE/u);
  assert.match(source, /软件版本 \{LINGBUILDER_DISPLAY_VERSION\}/u);
  assert.match(source, /role="dialog"/u);
  assert.match(source, /aria-modal="true"/u);
});

test('help center renders the installed version changelog', () => {
  const markup = renderToStaticMarkup(<HelpCenterDialog open onClose={() => undefined} />);
  assert.match(markup, /LingBuilder 帮助中心/u);
  assert.match(markup, /更新日志/u);
  assert.match(markup, /当前版本/u);
  assert.match(markup, /工作台左上角/u);
  assert.match(markup, new RegExp(LINGBUILDER_DISPLAY_VERSION.replaceAll('.', '\\.'), 'u'));
});
