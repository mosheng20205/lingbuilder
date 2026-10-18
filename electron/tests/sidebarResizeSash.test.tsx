import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';

import SidebarResizeSash, { suppressNextSyntheticClick } from '../src/components/SidebarResizeSash';

test('展开态 sash 是纯拖拽条：不渲染任何点击折叠入口', () => {
  const markup = renderToStaticMarkup(
    <SidebarResizeSash
      visible
      onResizeStart={() => undefined}
      onResetWidth={() => undefined}
      onToggleVisibility={() => undefined}
    />
  );
  assert.match(markup, /拖拽调整宽度 \/ 双击重置/u);
  assert.match(markup, /cursor-col-resize/u);
  assert.doesNotMatch(markup, /<button/u);
  assert.doesNotMatch(markup, /折叠左侧面板/u);
});

test('折叠态 sash 保留条带点击展开与展开箭头按钮', () => {
  const markup = renderToStaticMarkup(
    <SidebarResizeSash
      visible={false}
      onResizeStart={() => undefined}
      onResetWidth={() => undefined}
      onToggleVisibility={() => undefined}
    />
  );
  assert.match(markup, /点击展开左侧解决方案资源管理器/u);
  assert.match(markup, /<button/u);
  assert.match(markup, /展开左侧面板/u);
});

test('拖拽结束的合成 click 在捕获段被吞掉，后续真实 click 正常放行', () => {
  const target = new EventTarget();
  // 真实 DOM 中 window 捕获段监听器永远先于 React 根容器监听器（阶段序优于注册序）；
  // 裸 EventTarget 没有阶段模型，用注册顺序模拟同一拓扑：先装抑制器，再挂下游监听器。
  suppressNextSyntheticClick(target);
  let clicks = 0;
  target.addEventListener('click', () => { clicks += 1; });

  target.dispatchEvent(new Event('click'));
  assert.equal(clicks, 0, '紧随拖拽 mouseup 的合成 click 必须被吞掉');

  target.dispatchEvent(new Event('click'));
  assert.equal(clicks, 1, '解绑后的真实 click 必须正常送达');
});

test('未发生 click 时抑制器兜底自动解绑，不悬挂监听器', async () => {
  const target = new EventTarget();
  let clicks = 0;
  target.addEventListener('click', () => { clicks += 1; });

  suppressNextSyntheticClick(target);
  await new Promise(resolve => setTimeout(resolve, 1100));

  target.dispatchEvent(new Event('click'));
  assert.equal(clicks, 1, '兜底解绑后 click 正常送达');
});

test('App 接线：sash 组件化、拖拽后抑制合成 click、内联折叠按钮物理移除', async () => {
  const appSource = await fs.readFile(path.resolve(import.meta.dirname, '../src/App.tsx'), 'utf8');
  assert.match(appSource, /<SidebarResizeSash/u);
  assert.match(appSource, /import SidebarResizeSash, \{ suppressNextSyntheticClick \} from '\.\/components\/SidebarResizeSash';/u);
  assert.doesNotMatch(appSource, /折叠左侧面板/u);
  // startResizeLeft 必须在发生过实际拖拽（didResize）后抑制合成 click，再保存宽度
  assert.match(appSource, /if \(didResize\) \{\s*\n[\s\S]*?suppressNextSyntheticClick\(\);[\s\S]*?workbench\.sidebar\.width/u);

  const sashSource = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/SidebarResizeSash.tsx'), 'utf8');
  // 展开态不得有任何 click 入口，折叠态才允许点击展开
  assert.match(sashSource, /onClick=\{visible \? undefined : onToggleVisibility\}/u);
  assert.match(sashSource, /\{!visible && \(/u);
});

test('可见性写穿：所有显隐写路径都持久化，禁止裸 setState 造成客户端/服务端脱同步', async () => {
  const appSource = await fs.readFile(path.resolve(import.meta.dirname, '../src/App.tsx'), 'utf8');
  // 写穿助手存在且写设置
  assert.match(appSource, /const commitSidebarVisible = useCallback\(\(visible: boolean\) => \{\s*\n\s*setShowLeftSidebar\(visible\);\s*\n\s*void configurationMutationRef\.current\('workbench\.sidebar\.visible', visible, 'user'\);/u);
  assert.match(appSource, /const commitPanelVisible = useCallback\(\(visible: boolean\) => \{\s*\n\s*setShowBottomPanel\(visible\);\s*\n\s*void configurationMutationRef\.current\('workbench\.panel\.visible', visible, 'user'\);/u);
  // Sidebar（活动栏图标切换、模块页自动展开）拿到的是写穿版本
  assert.match(appSource, /setShowLeftSidebar=\{commitSidebarVisible\}/u);
  // 底面板程序化自动展开不得绕过持久化（原始 setter 只允许出现在声明、快照回放与写穿助手内部）
  assert.doesNotMatch(appSource, /(?<!const \[showBottomPanel, )setShowBottomPanel\(true\)/u);
  const rawSetterUses = appSource.match(/setShowBottomPanel\((?:true|false|visible)\)/gu) || [];
  const allowed = appSource.match(/const \[showBottomPanel, setShowBottomPanel\] = useState\(true\);/u);
  assert.ok(allowed, '底面板 state 声明必须保留');
  // 快照回放与写穿助手内部共 2 处合法 raw 调用（visible/panelVisible 两形态）
  assert.ok(rawSetterUses.length <= 3, `裸 setShowBottomPanel 调用过多：${rawSetterUses.length}`);
});
