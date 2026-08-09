import test from 'node:test'; import assert from 'node:assert/strict'; import { applyDesignerLayout, createNextRebarBand, DesignerHistory, nudgeControls, reconcileRebarBands, updateControlWithDescendants } from '../src/services/windowDesigner/designerOperations'; import type { LingWindowModel, LingWindowProject } from '../src/services/windowDesigner/types';
const control=(id:string,x:number,y:number,w=20,h=10):any=>({id,type:'Button',name:id,content:id,x,y,width:w,height:h,fontSize:12,background:'#fff',foreground:'#000',isEnabled:true,visibility:'Visible'}); const windowModel: LingWindowModel={id:'w',fileName:'w.lcpp',className:'W',title:'W',width:300,height:200,background:'#fff',description:'',controls:[control('a',10,20,30),control('b',80,50,20),control('c',160,90,40)]};
test('designer multi-selection aligns, sizes, distributes and nudges controls deterministically',()=>{ assert.deepEqual(applyDesignerLayout(windowModel,['a','b'],'align-left').controls.map(x=>x.x),[10,10,160]); assert.deepEqual(applyDesignerLayout(windowModel,['a','b'],'align-right').controls.slice(0,2).map(x=>x.x),[10,20]); assert.deepEqual(applyDesignerLayout(windowModel,['a','b'],'align-top').controls.slice(0,2).map(x=>x.y),[20,20]); assert.deepEqual(applyDesignerLayout(windowModel,['a','b'],'same-width').controls.slice(0,2).map(x=>x.width),[30,30]); const distributed=applyDesignerLayout(windowModel,['a','b','c'],'distribute-horizontal'); assert.ok(distributed.controls[1].x>40&&distributed.controls[1].x<150); const nudged=nudgeControls(windowModel,['a','b'],5,-10); assert.deepEqual(nudged.controls.slice(0,2).map(x=>[x.x,x.y]),[[15,10],[85,40]]); assert.throws(()=>applyDesignerLayout(windowModel,['a'],'align-left'),/至少/u); assert.throws(()=>applyDesignerLayout(windowModel,['a','b'],'distribute-vertical'),/三个/u); });
test('designer history supports bounded undo/redo and clears redo after a new edit',()=>{ const project: LingWindowProject={id:'p',name:'p',windows:[windowModel]}; const history=new DesignerHistory(project,2); history.commit({...project,name:'one'}); history.commit({...project,name:'two'}); assert.equal(history.undo()?.name,'one'); assert.equal(history.redo()?.name,'two'); history.undo(); history.commit({...project,name:'branch'}); assert.equal(history.canRedo,false); history.commit({...project,name:'last'}); history.commit({...project,name:'bounded'}); assert.equal(history.undo()?.name,'last'); assert.equal(history.undo()?.name,'branch'); assert.equal(history.undo(),null); });

test('designer history restores control tags through undo and redo', () => {
  const project: LingWindowProject = { id: 'tag-history', name: 'tag-history', windows: [windowModel] };
  const history = new DesignerHistory(project);
  const tagged: LingWindowProject = {
    ...project,
    windows: [{ ...windowModel, controls: windowModel.controls.map(item => item.id === 'a' ? { ...item, tagText: '确认', tagInteger: 0 } : item) }]
  };
  history.commit(tagged);
  assert.equal(history.value.windows[0].controls[0].tagInteger, 0);
  assert.equal(history.undo()?.windows[0].controls[0].tagText, undefined);
  assert.equal(history.redo()?.windows[0].controls[0].tagText, '确认');
});

test('moving a container translates every descendant exactly once', () => {
  const controls = [
    { ...control('group', 20, 30, 160, 120), type: 'GroupBox' },
    { ...control('combo', 40, 60, 100, 30), type: 'ComboBox', parentId: 'group' },
    { ...control('button', 55, 95), parentId: 'combo' }
  ];
  const moved = updateControlWithDescendants(controls, 'group', { x: 50, y: 70 });
  assert.deepEqual(moved.map(item => [item.id, item.x, item.y]), [
    ['group', 50, 70], ['combo', 70, 100], ['button', 85, 135]
  ]);

  const nestedWindow = { ...windowModel, controls };
  const nudged = nudgeControls(nestedWindow, ['group', 'combo'], 5, 5);
  assert.deepEqual(nudged.controls.map(item => [item.id, item.x, item.y]), [
    ['group', 25, 35], ['combo', 45, 65], ['button', 60, 100]
  ]);
});

test('Rebar automatically binds direct children and preserves configured band settings', () => {
  const controls = [
    { ...control('rebar', 10, 10, 260, 50), type: 'ReBar', properties: { autoBindChildren: true, bands: [{ id: 'existing', title: '主带区', childControl: 'toolbar', width: 180, breakLine: true }] } },
    { ...control('toolbar', 20, 20, 160, 28), type: 'ToolBar', parentId: 'rebar' },
    { ...control('search', 190, 20, 60, 28), type: 'TextBox', parentId: 'rebar' },
    { ...control('nested', 25, 25), parentId: 'toolbar' },
    { ...control('stale', 0, 0), type: 'Button' }
  ];
  const reconciled = reconcileRebarBands(controls as any);
  const rebar = reconciled.find(item => item.id === 'rebar')!;
  const bands = rebar.properties?.bands as Array<Record<string, unknown>>;
  assert.equal(bands.length, 2);
  assert.deepEqual(bands[0], { id: 'existing', title: '主带区', childControl: 'toolbar', width: 180, breakLine: true });
  assert.equal(bands[1].childControl, 'search');
  assert.equal(bands[1].minWidth, 40);
  assert.equal(bands.some(band => band.childControl === 'nested'), false);
});

test('Rebar add-band action binds the next child or returns actionable Chinese guidance', () => {
  const empty = createNextRebarBand([], []);
  assert.equal(empty.band, undefined);
  assert.match(empty.message, /先选中 Rebar.*工具箱.*工具栏/u);

  const toolbar = { ...control('toolbar', 20, 20, 160, 28), type: 'ToolBar', name: '主工具栏' };
  const search = { ...control('search', 190, 20, 80, 28), type: 'TextBox', name: '搜索框' };
  const next = createNextRebarBand([{ childControl: 'toolbar' }], [toolbar, search] as any);
  assert.equal(next.band?.childControl, 'search');
  assert.equal(next.band?.title, '搜索框');
  assert.match(next.message, /已把.*搜索框.*新带区/u);

  const complete = createNextRebarBand([{ childControl: 'toolbar' }, { childControl: 'search' }], [toolbar, search] as any);
  assert.equal(complete.band, undefined);
  assert.match(complete.message, /都已经绑定/u);
});
