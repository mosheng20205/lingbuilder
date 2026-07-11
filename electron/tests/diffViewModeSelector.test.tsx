import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';

import DiffViewModeSelector from '../src/components/DiffViewModeSelector';

test('diff mode selector exposes all three modes as focusable pressed-state buttons', () => {
  const markup = renderToStaticMarkup(
    <DiffViewModeSelector
      value="split"
      onChange={() => undefined}
      isDarkMode
      hasDifferences
    />
  );

  assert.match(markup, /role="group"/u);
  assert.match(markup, /aria-label="对比视图模式"/u);
  assert.equal(markup.match(/<button/g)?.length, 3);
  assert.equal(markup.match(/aria-pressed="true"/g)?.length, 1);
  assert.equal(markup.match(/aria-pressed="false"/g)?.length, 2);
  assert.match(markup, />编辑<\/button>/u);
  assert.match(markup, />并排对比<\/button>/u);
  assert.match(markup, />内联对比<\/button>/u);
  assert.match(markup, /focus-visible:ring-2/u);
});

test('diff mode selector announces a Chinese empty state when there are no changes', () => {
  const markup = renderToStaticMarkup(
    <DiffViewModeSelector
      value="unified"
      onChange={() => undefined}
      isDarkMode={false}
      hasDifferences={false}
    />
  );

  assert.match(markup, /role="status"/u);
  assert.match(markup, /aria-live="polite"/u);
  assert.match(markup, /当前文件没有差异/u);
  assert.match(markup, /aria-pressed="true"[^>]*>内联对比<\/button>/u);
});
