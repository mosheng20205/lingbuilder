import test from 'node:test';
import assert from 'node:assert/strict';

import { computeSubmenuPosition, SUBMENU_CLOSE_DELAY_MS } from '../src/components/WorkbenchContextMenu';

test('submenu stays adjacent to its anchor row when the viewport bottom has room', () => {
  // 窗口底部右键菜单中的「排列」子菜单：4 项（约 140px 高），底部仍有空间时必须紧贴锚点行，
  // 不得再按旧的 320px 估算高度整体上移导致子菜单与锚点脱节。
  const position = computeSubmenuPosition(
    { top: 400, right: 512 },
    { width: 240, height: 140 },
    { width: 847, height: 585 }
  );
  assert.equal(position.top, 0);
  assert.equal(position.left, '100%');
});

test('submenu shifts up only by the minimal amount needed to clear the window bottom', () => {
  const position = computeSubmenuPosition(
    { top: 500, right: 512 },
    { width: 240, height: 140 },
    { width: 847, height: 585 }
  );
  // 500 + 140 + 4 - 585 = 59：只上移 59px，子菜单底边正好落在窗口底 4px 边距上。
  assert.equal(position.top, -59);
});

test('submenu never shifts above the viewport top', () => {
  const position = computeSubmenuPosition(
    { top: 100, right: 512 },
    { width: 240, height: 600 },
    { width: 847, height: 585 }
  );
  assert.equal(position.top, -96);
});

test('submenu flips to the left side only when it would overflow the right edge', () => {
  const fits = computeSubmenuPosition(
    { top: 40, right: 700 },
    { width: 240, height: 120 },
    { width: 1024, height: 600 }
  );
  assert.equal(fits.left, '100%');

  const overflows = computeSubmenuPosition(
    { top: 40, right: 900 },
    { width: 240, height: 120 },
    { width: 1024, height: 600 }
  );
  assert.equal(overflows.left, '-100%');
});

test('hover close delay stays long enough to bridge the gap toward a displaced submenu', () => {
  assert.ok(SUBMENU_CLOSE_DELAY_MS >= 150);
});
