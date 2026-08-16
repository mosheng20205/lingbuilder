import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';

import TextFileStatusControls from '../src/components/TextFileStatusControls';

const noop = () => undefined;

test('text file status controls expose the selected encoding and EOL as accessible native controls', () => {
  const markup = renderToStaticMarkup(
    <TextFileStatusControls
      format={{ encoding: 'utf8bom', eol: 'crlf' }}
      fileName="界面.lcpp"
      isDarkMode
      isModified
      onEncodingChange={noop}
      onEolChange={noop}
    />
  );

  assert.match(markup, /role="group"/u);
  assert.match(markup, /aria-label="“界面\.lcpp”的文本格式"/u);
  assert.match(markup, /aria-label="更改“界面\.lcpp”的文件编码"/u);
  assert.match(markup, /aria-label="更改“界面\.lcpp”的换行符"/u);
  assert.match(markup, /<option value="utf8bom" selected="">UTF-8（带 BOM）<\/option>/u);
  assert.match(markup, /<option value="crlf" selected="">CRLF<\/option>/u);
  assert.match(markup, /focus-visible:ring-2/u);
  assert.match(markup, /\[&amp;&gt;option\]:bg-\[#252526\]/u);
  assert.match(markup, /\[&amp;&gt;option\]:text-slate-200/u);
  assert.match(markup, /flex-wrap/u);
  assert.match(markup, /role="status"/u);
  assert.match(markup, /格式待保存/u);
});

test('text file status controls render light-theme and disabled semantics', () => {
  const markup = renderToStaticMarkup(
    <TextFileStatusControls
      format={{ encoding: 'utf16le', eol: 'lf' }}
      isDarkMode={false}
      disabled
      onEncodingChange={noop}
      onEolChange={noop}
    />
  );

  assert.match(markup, /aria-disabled="true"/u);
  assert.equal((markup.match(/ disabled=""/gu) ?? []).length, 2);
  assert.match(markup, /<option value="utf16le" selected="">UTF-16 LE<\/option>/u);
  assert.match(markup, /<option value="lf" selected="">LF<\/option>/u);
  assert.match(markup, /border-slate-300/u);
  assert.match(markup, /\[&amp;&gt;option\]:bg-white/u);
  assert.match(markup, /\[&amp;&gt;option\]:text-slate-800/u);
  assert.match(markup, /disabled:cursor-not-allowed/u);
});

test('text file status controls announce a compact no-file state without interactive elements', () => {
  const markup = renderToStaticMarkup(
    <TextFileStatusControls
      format={null}
      isDarkMode
      onEncodingChange={noop}
      onEolChange={noop}
    />
  );

  assert.match(markup, /role="status"/u);
  assert.match(markup, /aria-live="polite"/u);
  assert.match(markup, /未打开文本文件/u);
  assert.doesNotMatch(markup, /<select/u);
  assert.match(markup, /truncate/u);
});
