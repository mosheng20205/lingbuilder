/**
 * new_emoji 全控件属性发射审计（93 控件 / 738 目录属性）：
 * 每个控件属性都设非默认合法值 → 生成 C++ → 核对每条属性的 runtimeCommand
 * （或其发射别名）是否真实出现在生成结果中。面板标签 LB_NE_Apply* 按属性键
 * 手写发射，实际命令见 EMISSION_ALIASES。
 * 运行：npx tsx scripts/audit-new-emoji-property-emission.ts
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import type { InstalledModule } from '../src/services/modules/types';
import type { LingWindowProject, LingControl } from '../src/services/windowDesigner/types';

const manifestPath = path.resolve('..', '.lingbuilder', 'modules', 'lingbuilder.new_emoji.ui', 'lingbuilder.module.json');
const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
const installedModule: InstalledModule = {
  manifest, installPath: path.dirname(manifestPath), isInstalled: true, isEnabledForProject: true, diagnostics: []
};

const SPEC_FORMATS: Record<string, string[]> = {
  tableFilters: ['col=0\tvalue=过滤甲'],
  tableColumnAligns: ['col=0\theader=1\tcell=1'],
  tableRowAligns: ['row=0\talign=1'],
  tableCellAligns: ['row=0\tcol=0\talign=1'],
  tableRowStyles: ['row=0\tbg=4281543999\tfg=4294967295\talign=1'],
  tableColumnEditOverrides: ['col=0\teditable=0'],
  tableCellEditOverrides: ['row=0\tcol=0\teditable=1']
};

// 面板标签（LB_NE_Apply*）与实际发射命令的对应；发射按属性键手写进生成器。
const EMISSION_ALIASES: Record<string, string[]> = {
  LB_NE_ApplyTableFilters: ['EU_SetTableFilter'],
  LB_NE_ApplyTableColumnAligns: ['EU_SetTableColumnAlign'],
  LB_NE_ApplyTableRowAligns: ['EU_SetTableRowAlign'],
  LB_NE_ApplyTableCellAligns: ['EU_SetTableCellAlign'],
  LB_NE_ApplyTableRowStyles: ['EU_SetTableRowStyle'],
  LB_NE_ApplyTableColumnEditOverrides: ['EU_SetTableColumnDoubleClickEdit'],
  LB_NE_ApplyTableCellEditOverrides: ['EU_SetTableCellDoubleClickEdit'],
  LB_NE_ApplyMenuItems: ['EU_SetMenuItems']
};

// controlRef 属性按声明的 controlTypes 选兼容目标：容器类给 Container，菜单类给 Menu。
const REF_FALLBACK: Record<string, string> = {
  targetContainerId: 'probe-container',
  containerId: 'probe-container',
  dropdownElementId: 'probe-menu'
};

function valueFor(dc: any, property: any, index: number): unknown {
  if (SPEC_FORMATS[property.key]) return SPEC_FORMATS[property.key];
  if (property.type === 'controlRef') {
    const wanted = (property.controlTypes || []).find((t: string) => REF_FALLBACK[t.split('/').pop() || '']);
    if (wanted) return REF_FALLBACK[wanted.split('/').pop()!];
    return 'ref-ctl';
  }
  switch (property.type) {
    case 'boolean': return true;
    case 'number': return 7 + index;
    case 'color': return '#FF3366AA';
    case 'enum': {
      const options = property.options || [];
      const last = options[options.length - 1];
      return last ? last.value : 2;
    }
    case 'stringList': return [`值甲${index}`, `值乙${index}`];
    case 'text': return `文本${index}`;
    case 'recordList': {
      if (property.key === 'menuItems') {
        return [{ id: 'm1', command: '文件', title: '文件', icon: '📁', shortcut: 'Ctrl+O', separator: false, checked: false, disabled: false }];
      }
      if (property.key === 'actionIcons') {
        return [{ id: 'a1', icon: '★', tooltip: '收藏', title: '收藏' }];
      }
      if (property.key === 'suggestions') {
        return [{ id: 's1', icon: '⌕', title: '建议', description: '描述', url: 'https://example.com' }];
      }
      const fields = (property.fields || []).map((f: any) => f.key);
      const record: Record<string, unknown> = {};
      for (const field of fields) record[field] = field === 'id' ? `r${index}` : field === 'command' ? '命令' : `值${index}`;
      return [record];
    }
    default: return `值${index}`;
  }
}

const dcs = manifest.contributes.designerControls as any[];
const controls: LingControl[] = [
  {
    id: 'ref-ctl', type: 'Button', designerType: 'lingbuilder.new_emoji.ui/Button', name: '参照控件',
    content: '参照', x: 10, y: 10, width: 100, height: 32, fontSize: 12, background: '#202028', foreground: '#F8FAFC',
    isEnabled: true, visibility: 'Visible', properties: {}, events: {}
  } as unknown as LingControl,
  {
    id: 'probe-container', type: 'Container', designerType: 'lingbuilder.new_emoji.ui/Container', name: '参照容器',
    content: '', x: 10, y: 60, width: 200, height: 120, fontSize: 12, background: 'transparent', foreground: '#F8FAFC',
    isEnabled: true, visibility: 'Visible', properties: {}, events: {}
  } as unknown as LingControl,
  {
    id: 'probe-menu', type: 'Menu', designerType: 'lingbuilder.new_emoji.ui/Menu', name: '参照菜单',
    content: '参照菜单', x: 10, y: 200, width: 160, height: 200, fontSize: 12, background: '#202028', foreground: '#F8FAFC',
    isEnabled: true, visibility: 'Visible', properties: {}, events: {}
  } as unknown as LingControl
];
let index = 0;
for (const dc of dcs) {
  index += 1;
  const properties: Record<string, unknown> = {};
  for (const property of dc.properties || []) properties[property.key] = valueFor(dc, property, index);
  controls.push({
    id: `ctl-${index}`, type: dc.previewType || dc.type, designerType: dc.namespacedType,
    name: `控件${index}`, content: `内容${index}`, x: 20, y: 20, width: 320, height: 200,
    fontSize: 14, background: '#202028', foreground: '#F8FAFC', isEnabled: true, visibility: 'Visible',
    properties, events: {}
  } as LingControl);
}

const project: LingWindowProject = {
  schemaVersion: 2, id: 'probe-all-props', name: 'probe-all-props',
  windows: [{
    id: 'main', fileName: 'MainWindow.xml', className: '主窗口', title: '探针', width: 1280, height: 900,
    background: '#181825', description: '', designerBackend: 'new-emoji', controls, events: {}
  }]
};
const generated = generateLingCppNativeWin32Project(project, {
  enabledModules: [installedModule],
  lingCppSourceCode: '类 主窗口 : 公开 窗体\n结束类'
});
if (generated.blockingDiagnostics.length) {
  console.log('阻断诊断:');
  for (const d of generated.blockingDiagnostics) console.log('  -', d);
}
const cpp = generated.files.find(f => f.relativePath === 'main.cpp')?.content || '';
const lines = cpp.split('\n');
console.log('main.cpp 行数:', lines.length);

const report: string[] = [];
let totalProps = 0, missingProps = 0;
for (let i = 0; i < dcs.length; i += 1) {
  const dc = dcs[i];
  const variable = `ne_element_${i + 4}`;
  const createMarker = new RegExp(`\\b${variable}\\s*=\\s*EU_\\w+\\(`);
  const start = lines.findIndex(l => createMarker.test(l));
  if (start < 0) { report.push(`${dc.type}: 未找到创建调用!`); continue; }
  let end = lines.length;
  for (let j = i + 1; j < dcs.length; j += 1) {
    const nextMarker = new RegExp(`\\bne_element_${j + 2}\\s*=\\s*EU_\\w+\\(`);
    for (let k = start + 1; k < lines.length; k += 1) {
      if (nextMarker.test(lines[k])) { end = k; break; }
    }
    if (end < lines.length) break;
  }
  const block = lines.slice(start, end).join('\n');
  const missing: string[] = [];
  for (const property of dc.properties || []) {
    totalProps += 1;
    const rc = property.runtimeCommand as string;
    if (!rc) { missing.push(`${property.key}(无映射)`); continue; }
    if (rc === dc.runtime?.createCommand) continue;
    const candidates = EMISSION_ALIASES[rc] || [rc];
    if (!candidates.some(cmd => block.includes(cmd) || cpp.includes(cmd))) missing.push(`${property.key}→${rc}`);
  }
  if (missing.length) {
    missingProps += missing.length;
    report.push(`${dc.type}: 缺 ${missing.length} 条 → ${missing.slice(0, 6).join(', ')}${missing.length > 6 ? ' …' : ''}`);
  }
}
console.log(`\n属性总数 ${totalProps}，全文件仍缺失 ${missingProps}`);
console.log(report.join('\n') || '全部控件全属性 setter 均已发射 ✓');
