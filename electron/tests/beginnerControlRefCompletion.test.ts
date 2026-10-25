import test from 'node:test';
import assert from 'node:assert/strict';
import { getLingCppControlReferenceCompletion } from '../src/services/lingCpp/controlReferenceService';
import { createBeginnerControlReferenceCompletions } from '../src/services/lingCpp/beginnerControlRefCompletion';
import { LingWindowProject } from '../src/services/windowDesigner/types';
import { InstalledModule } from '../src/services/modules/types';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';

const moduleContext = (() => {
  const modules: InstalledModule[] = ['lingbuilder.win32.basic'].map(id => ({
    manifest: BUILTIN_MODULES.find(item => item.id === id)!,
    installPath: `builtin://${id}`,
    isBuiltin: true,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  }));
  return { enabledModules: modules, availableModules: modules };
})();

const project: LingWindowProject = {
  id: 'clock-project',
  name: '登录界面',
  windows: [{
    id: 'window-1',
    fileName: 'Window2.xml',
    className: '自定义窗体2',
    title: '自定义窗口 2',
    width: 480,
    height: 360,
    background: '#1f2937',
    description: '自定义窗口',
    controls: [{
      id: 'label-time',
      type: 'Label',
      name: '时间标签',
      content: '',
      x: 16,
      y: 24,
      width: 160,
      height: 28,
      fontSize: 13,
      background: '#202020',
      foreground: '#ffffff',
      isEnabled: true,
      visibility: 'Visible',
      events: {}
    }],
    events: {}
  }],
  resources: [{
    id: 'clock-1',
    type: 'Clock',
    name: '时钟1',
    ownerWindowId: 'window-1',
    periodMilliseconds: 1000,
    startEnabled: false,
    periodHandler: '_时钟1_周期到期'
  }]
};

test('新手模式 controlRef 参数位置补全出兼容的设计器资源（时钟组件），不混入可视控件', () => {
  // 与新手编辑器草稿同形的片段：事件体内刚敲到 时钟_启动(时。
  const draft = '    时钟_启动(时';
  const completion = getLingCppControlReferenceCompletion(draft, 1, draft.length + 1, project, moduleContext, 'src/lingbuilder-project-4/自定义窗体2.lcpp');
  assert.ok(completion, '光标在 时钟_启动( 实参内应命中 controlRef 补全');
  assert.equal(completion!.parameter.name, '组件名');
  assert.deepEqual(completion!.symbols.map(symbol => symbol.name), ['时钟1']);

  const items = createBeginnerControlReferenceCompletions(completion!);
  assert.equal(items.length, 1);
  assert.equal(items[0].label, '时钟1');
  assert.equal(items[0].insertText, '时钟1');
  assert.match(items[0].detail, /设计器资源 · Clock/u);
});

test('新手模式 controlRef 参数位置刚敲完左括号（空 token）即出完整兼容清单', () => {
  const draft = '    时钟_启动(';
  const completion = getLingCppControlReferenceCompletion(draft, 1, draft.length + 1, project, moduleContext, 'src/lingbuilder-project-4/自定义窗体2.lcpp');
  assert.ok(completion);
  assert.deepEqual(completion!.symbols.map(symbol => symbol.name), ['时钟1']);
});

test('新手模式可视控件参数位置补全只出兼容的可视控件，文本参数不触发', () => {
  const visualDraft = '    控件_设置文本(时';
  const visualCompletion = getLingCppControlReferenceCompletion(visualDraft, 1, visualDraft.length + 1, project, moduleContext, 'src/lingbuilder-project-4/自定义窗体2.lcpp');
  assert.ok(visualCompletion);
  assert.deepEqual(visualCompletion!.symbols.map(symbol => symbol.name), ['时间标签']);

  const textDraft = '    调试输出("时';
  const textCompletion = getLingCppControlReferenceCompletion(textDraft, 1, textDraft.length + 1, project, moduleContext, 'src/lingbuilder-project-4/自定义窗体2.lcpp');
  assert.equal(textCompletion, undefined);
});
