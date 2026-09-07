/**
 * CEF3 事件名一致性回归。
 *
 * 背景：桥接层（native/cef3-bridge）发出 CEF 回调事件时用的中文名，与模块事件目录
 * （services/modules/cef3BrowserEvents.ts）里的中文名曾经不是同一个词——例如桥接发
 * 「浏览前请求」，目录与 CEF3_绑定事件 用的是「导航请求前」。而目录名正是运行时存处理器的键，
 * 名字对不上就查不到处理器：`kind === 'decision'` 这一类是**同步可取消**事件，
 * 处理器不执行 → response->action 恒为 0 → 取消静默失效，且没有任何报错。
 * 该缺陷让 CEF3 教程第 05 集一度以为「运行态是乱码」而放弃了实机演示镜头。
 *
 * 本测试锁住三件事：
 *   1. 目录里每个 decision 事件，只要桥接层真的会发它，名字就必须一致，
 *      或者被生成器的归一化别名表覆盖；
 *   2. 别名表不得有过期条目（目标名必须是目录里真实存在的事件名）；
 *   3. 名字对上不代表订阅位对上——桥接层按处理器族订阅位决定是否安装处理器并投递事件，
 *      受门控且没有 legacy 数字事件通道的事件必须由 CEF3_绑定事件 点亮订阅位。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import { CEF3_BROWSER_EVENTS, CEF3_EVENT_ASYNC_DEFAULTS, CEF3_EVENT_BRIDGE_SUBSCRIPTIONS } from '../src/services/modules/cef3BrowserEvents';

const BRIDGE_SOURCE = '../native/cef3-bridge/LingBuilderCefBridge.cpp';
const GENERATOR_SOURCE = '../src/services/windowDesigner/lingCppWin32Project.ts';

/** CEF 回调方法名（OnBeforeBrowse 等）→ 桥接实际发出的事件名集合 */
async function bridgeEmittedNames(): Promise<Map<string, Set<string>>> {
  const src = await fs.readFile(new URL(BRIDGE_SOURCE, import.meta.url), 'utf8');

  // 回调声明：返回类型 + 方法名 + 左括号
  const methodRe = /(?:bool|void|int|ReturnValue|cef_return_value_t|CefRefPtr<Cef[A-Za-z]+>|double)[ \t]+([A-Z][A-Za-z0-9_]*)\s*\(/g;
  const methods: Array<{ at: number; name: string }> = [];
  for (const m of src.matchAll(methodRe)) methods.push({ at: m.index ?? 0, name: m[1] });
  methods.sort((a, b) => a.at - b.at);
  const ownerAt = (pos: number): string | undefined => {
    let current: string | undefined;
    for (const m of methods) { if (m.at <= pos) current = m.name; else break; }
    return current;
  };

  // 桥接的事件名一律是宽字符中文字面量，而类型名（cef_resource_request_handler_t）与
  // 方法名（on_before_resource_load）都是 ASCII，所以「含中文」就是事件名的判别特征。
  // 发射函数有多种（EmitEvent / EmitNotificationEventV4 / EmitAsyncEvent /
  // EmitDownloadHandlerNotification …），因此不枚举函数名，改看前面不远处是否有 Emit 调用。
  const out = new Map<string, Set<string>>();
  for (const m of src.matchAll(/L"([^"]*[\u4e00-\u9fff][^"]*)"/g)) {
    const at = m.index ?? 0;
    if (!/Emit[A-Za-z0-9_]*\s*\(/.test(src.slice(Math.max(0, at - 400), at))) continue;
    const owner = ownerAt(at);
    if (!owner) continue;
    if (!out.has(owner)) out.set(owner, new Set());
    out.get(owner)!.add(m[1]);
  }
  return out;
}

/** 生成器里 CEF3_归一化Bridge事件名() 的别名对：桥接名 → 目录名 */
async function generatorAliases(): Promise<Map<string, string>> {
  const src = await fs.readFile(new URL(GENERATOR_SOURCE, import.meta.url), 'utf8');
  const body = src.match(/CEF3_归一化Bridge事件名\([^)]*\)\s*\{[\s\S]*?\n\s*\}/);
  assert.ok(body, '生成器里找不到 CEF3_归一化Bridge事件名()，事件名归一化被移除了？');
  const pairs = new Map<string, string>();
  for (const m of body[0].matchAll(/\{\s*L"([^"]+)"\s*,\s*L"([^"]+)"\s*\}/g)) pairs.set(m[1], m[2]);
  return pairs;
}

test('每个同步可取消的 CEF3 事件都能按目录名被派发到', async () => {
  const emitted = await bridgeEmittedNames();
  const aliases = await generatorAliases();

  const broken: string[] = [];
  let checked = 0;
  for (const event of CEF3_BROWSER_EVENTS.filter(e => e.kind === 'decision')) {
    const bridgeNames = emitted.get(event.id);
    if (!bridgeNames || bridgeNames.size === 0) continue;   // 桥接不发这个回调，跳过
    checked += 1;
    const reachable = [...bridgeNames].some(n => n === event.name || aliases.get(n) === event.name);
    if (!reachable) {
      broken.push(`${event.id}: 目录名「${event.name}」，桥接实际发「${[...bridgeNames].join('」「')}」，别名表未覆盖`);
    }
  }

  assert.ok(checked > 20, `只核到 ${checked} 个 decision 事件，解析可能失效了`);
  assert.deepEqual(broken, [], `CEF3 事件名不一致，这些事件在运行时永远不会触发:\n${broken.join('\n')}`);
});

test('事件名别名表不含过期条目', async () => {
  const aliases = await generatorAliases();
  const catalogNames = new Set(CEF3_BROWSER_EVENTS.map(e => e.name));
  const emitted = await bridgeEmittedNames();
  const allEmitted = new Set([...emitted.values()].flatMap(s => [...s]));

  const staleTargets = [...aliases].filter(([, to]) => !catalogNames.has(to)).map(([from, to]) => `${from} → ${to}`);
  assert.deepEqual(staleTargets, [], '别名表指向了目录里不存在的事件名:\n' + staleTargets.join('\n'));

  const staleSources = [...aliases].filter(([from]) => !allEmitted.has(from)).map(([from]) => from);
  assert.deepEqual(staleSources, [], '别名表里有桥接层已不再发出的名字:\n' + staleSources.join('\n'));
});

/**
 * 事件名对上 ≠ 订阅位对上。
 *
 * 桥接层按「处理器族订阅位掩码」决定两件事：`GetResourceRequestHandler` 之类是否返回处理器
 * （返回 nullptr 时 CEF 根本不会调用回调），以及回调体是否向宿主投递事件。宿主侧
 * CEF3_绑定事件 过去只登记处理器名、从不点亮订阅位，于是「资源响应到达 / 资源重定向 /
 * 下载进度更新 / 框架* / 打印*」这一族事件在生成的 exe 里一次都不会触发，且不报任何错。
 * 另一半原因是这些族只走受管 V4 通道（没有 legacy 数字事件兜底），而生成的运行时过去只注册
 * V3 回调，V4 包找不到接收方会被直接丢弃。
 *
 * 已有 legacy 数字事件通道的事件不得进订阅表：点亮订阅位后同一事件会经两条通道各投一次，
 * 处理器被调用两遍。
 */
async function bridgeSources(): Promise<{ bridge: string; generator: string }> {
  return {
    bridge: await fs.readFile(new URL(BRIDGE_SOURCE, import.meta.url), 'utf8'),
    generator: await fs.readFile(new URL(GENERATOR_SOURCE, import.meta.url), 'utf8')
  };
}

/** 回调方法名 → 该回调体是否被订阅位门控（Is<Family>SubscriptionEnabled(state_, kBit)） */
function gatedCallbacks(bridge: string): Set<string> {
  const methodRe = /(?:bool|void|int|ReturnValue|cef_return_value_t|CefRefPtr<Cef[A-Za-z]+>|double)[ \t]+([A-Z][A-Za-z0-9_]*)\s*\(/g;
  const methods: Array<{ at: number; name: string }> = [];
  for (const m of bridge.matchAll(methodRe)) methods.push({ at: m.index ?? 0, name: m[1] });
  methods.sort((a, b) => a.at - b.at);
  const gated = new Set<string>();
  for (const m of bridge.matchAll(/Is\w*SubscriptionEnabled\(\s*state_,\s*(k\w+)\)/g)) {
    const at = m.index ?? 0;
    let current: string | undefined;
    for (const method of methods) { if (method.at <= at) current = method.name; else break; }
    if (current) gated.add(current);
  }
  return gated;
}

/** 桥接层通过 legacy 数字事件通道发出的中文名集合 */
function legacyEmittedNames(bridge: string): Set<string> {
  const flat = bridge.replace(/\r?\n\s*/g, ' ');
  return new Set([...flat.matchAll(/EmitEvent\(\s*state_,\s*\d+,\s*L"([^"]+)"/g)].map(m => m[1]));
}

test('订阅映射只引用真实存在的桥接导出与目录事件名', async () => {
  const { bridge } = await bridgeSources();
  const catalogNames = new Set(CEF3_BROWSER_EVENTS.map(e => e.name));
  const badNames = Object.keys(CEF3_EVENT_BRIDGE_SUBSCRIPTIONS).filter(name => !catalogNames.has(name));
  assert.deepEqual(badNames, [], '订阅表里有目录中不存在的事件名:\n' + badNames.join('\n'));

  const missingExports = Object.entries(CEF3_EVENT_BRIDGE_SUBSCRIPTIONS)
    .filter(([, exporter]) => !new RegExp(`int LB_CEF3_CALL ${exporter}\\(`).test(bridge))
    .map(([name, exporter]) => `${name} → ${exporter}`);
  assert.deepEqual(missingExports, [], '订阅表引用了桥接层不存在的导出:\n' + missingExports.join('\n'));
});

test('受订阅门控且无 legacy 通道的目录事件必须登记订阅位', async () => {
  const { bridge } = await bridgeSources();
  const emitted = await bridgeEmittedNames();
  const gated = gatedCallbacks(bridge);
  const legacy = legacyEmittedNames(bridge);
  const bound = new Set(Object.keys(CEF3_EVENT_BRIDGE_SUBSCRIPTIONS));

  const unreachable: string[] = [];
  const checked = new Set<string>();
  for (const event of CEF3_BROWSER_EVENTS) {
    if (!gated.has(event.id)) continue;
    const names = emitted.get(event.id);
    if (!names || names.size === 0) continue;
    if ([...names].some(name => legacy.has(name))) continue;   // legacy 通道已覆盖，不得再订阅
    checked.add(event.id);
    if (!bound.has(event.name)) {
      unreachable.push(`${event.id}「${event.name}」被订阅位门控且无 legacy 通道，但未登记订阅导出`);
    }
  }
  // 帧族与下载族的发射点被归属到辅助函数上，解析器天然数不满订阅表条数，
  // 因此这里只要求解析覆盖到缺陷直接涉及的资源族回调，作为解析未失效的证据。
  const critical = ['OnBeforeResourceLoad', 'OnResourceResponse', 'OnResourceRedirect',
    'OnResourceLoadComplete', 'OnProtocolExecution', 'CanSendCookie'];
  const lost = critical.filter(id => !checked.has(id));
  assert.deepEqual(lost, [], `桥接解析漏掉了这些资源族回调，本测试的结论不可信:\n${lost.join('\n')}`);
  assert.ok(checked.size >= 8, `只核到 ${checked.size} 个需要订阅位的事件，桥接解析可能失效了`);
  assert.deepEqual(unreachable, [], '这些 CEF3 事件绑定后仍不会触发:\n' + unreachable.join('\n'));
});

test('已有 legacy 通道的事件不得进订阅表，避免同一事件双份投递', async () => {
  const { bridge } = await bridgeSources();
  const emitted = await bridgeEmittedNames();
  const legacy = legacyEmittedNames(bridge);
  const byName = new Map(CEF3_BROWSER_EVENTS.map(e => [e.name, e]));

  const duplicated = Object.keys(CEF3_EVENT_BRIDGE_SUBSCRIPTIONS).filter(name => {
    const event = byName.get(name);
    const names = event ? emitted.get(event.id) : undefined;
    return Boolean(names && [...names].some(emittedName => legacy.has(emittedName)));
  });
  assert.deepEqual(duplicated, [], '这些事件已有 legacy 数字事件通道，点亮订阅位会导致处理器被调用两次:\n' + duplicated.join('\n'));
});

test('生成的运行时注册 V4 受管事件回调并在绑定时点亮订阅位', async () => {
  const { generator } = await bridgeSources();
  assert.match(generator, /LB_CEF3_SetEventCallbackV4\(instance->bridgeHandle, &LingWindowBase::CEF3_Bridge事件回调V4/,
    '生成器不再注册 V4 事件回调，受管通道的事件会被桥接层丢弃');
  assert.match(generator, /instance->handlers\[eventName\] = handler;\s*\n\s*return CEF3_应用Bridge订阅\(instance, eventName, true\);/,
    'CEF3_绑定事件 不再点亮订阅位，资源/框架/打印族事件会静默失效');
  assert.match(generator, /void CEF3_补齐Bridge订阅\(CefBrowserInstance& instance\)/,
    '缺少创建完成后回放订阅的入口，绑定早于创建时事件会静默失效');
  // EmitAsyncEvent 家族（「资源加载前」等）只在宿主给出非零动作时才结束 continuation；
  // 宿主未表态时必须按该事件自身的默认动作续跑，否则请求会挂到桥接层超时、期间页面空白。
  assert.match(generator, /if \(packet->continuation != 0 && legacyResponse\.action == 0\) \{\s*\n\s*const int fallback = owner->CEF3_桥接默认动作\(adapted\.event_name\);\s*\n\s*if \(fallback != 0\) LB_CEF3_ContinuationCompleteV4\(packet->continuation, fallback, nullptr\);/,
    'V4 回调未在宿主未表态时按事件默认动作续跑 continuation，绑定「资源加载前」会让请求挂到超时');
});

/** 桥接层所有 EmitAsyncEvent 调用点：桥接事件名 → 声明的 default_action */
async function bridgeAsyncDefaults(): Promise<Map<string, number>> {
  const { bridge } = await bridgeSources();
  const flat = bridge.replace(/\r?\n\s*/g, ' ');
  const out = new Map<string, number>();
  for (const m of flat.matchAll(/EmitAsyncEvent\(\s*state_,\s*(\d+),\s*L"[^"]*",\s*L"[^"]*",\s*L"([^"]+)",\s*\w+,\s*(\d+),\s*(\d+)/g)) {
    out.set(m[2], Number(m[4]));
  }
  return out;
}

test('异步决策事件的宿主默认续跑动作与桥接层声明逐条一致', async () => {
  const asyncDefaults = await bridgeAsyncDefaults();
  const aliases = await generatorAliases();
  assert.ok(asyncDefaults.size >= 6, `只解析到 ${asyncDefaults.size} 个 EmitAsyncEvent 调用点，桥接解析可能失效了`);

  const catalogByName = new Map(CEF3_BROWSER_EVENTS.map(e => [e.name, e]));
  const toCatalog = (bridgeName: string): string | undefined => {
    const direct = catalogByName.has(bridgeName) ? bridgeName : undefined;
    return direct || [...aliases.entries()].find(([from]) => from === bridgeName)?.[1];
  };

  const missing: string[] = [];
  for (const [bridgeName, action] of asyncDefaults) {
    const catalogName = toCatalog(bridgeName);
    if (!catalogName) continue;                       // 不属于浏览器事件目录（如视图/OSR 族）
    if (CEF3_EVENT_ASYNC_DEFAULTS[catalogName] !== action) {
      missing.push(`「${catalogName}」桥接 default_action=${action}，映射表=${CEF3_EVENT_ASYNC_DEFAULTS[catalogName] ?? '未登记'}`);
    }
  }
  assert.deepEqual(missing, [], '宿主未表态时的续跑动作与桥接层默认不一致，会改掉事件的拒绝/自定义语义:\n' + missing.join('\n'));

  const stale = Object.keys(CEF3_EVENT_ASYNC_DEFAULTS).filter(
    name => ![...asyncDefaults.entries()].some(([bridgeName, ]) => toCatalog(bridgeName) === name));
  assert.deepEqual(stale, [], '异步默认动作表里有桥接层不再以 EmitAsyncEvent 发出的事件:\n' + stale.join('\n'));
});
