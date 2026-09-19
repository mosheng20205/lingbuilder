import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getLingCppSemanticDiagnostics } from '../src/services/lingCpp/languageService';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import type { InstalledModule, LingBuilderModuleManifest } from '../src/services/modules/types';
import type { LingWindowProject } from '../src/services/windowDesigner/types';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const RECIPE_MODULE_ID = 'lingbuilder.new_emoji.ui';
const recipeDir = path.join(repoRoot, 'examples', 'ui-recipes', RECIPE_MODULE_ID);
const installedManifestPath = path.join(repoRoot, '.lingbuilder', 'modules', RECIPE_MODULE_ID, 'lingbuilder.module.json');

interface RecipeEntry {
  id: string;
  title: string;
  file: string;
  scenario: string;
  commands: string[];
  controls: string[];
  notes: string[];
}

const recipeIndex = JSON.parse(fs.readFileSync(path.join(recipeDir, 'recipes.json'), 'utf8')) as {
  recipes: RecipeEntry[];
};

test('new_emoji 界面配方语料齐备且守住 .lcpp 红线', () => {
  assert.ok(recipeIndex.recipes.length >= 6, '至少要有 6 条界面配方');
  const seen = new Set<string>();
  for (const recipe of recipeIndex.recipes) {
    assert.ok(!seen.has(recipe.id), `配方 id 重复：${recipe.id}`);
    seen.add(recipe.id);
    assert.ok(recipe.scenario.length > 0, `${recipe.id} 缺少适用场景说明`);
    assert.ok(recipe.notes.length > 0, `${recipe.id} 缺少要点说明`);
    const filePath = path.join(recipeDir, recipe.file);
    assert.ok(fs.existsSync(filePath), `配方文件缺失：${recipe.file}`);
    const lines = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/u, '').split(/\r?\n/u);
    assert.ok(lines.length <= 90, `${recipe.file} 超过 90 行，不适合作为可复制配方`);
    assert.match(lines.join('\n'), /^包 \S+/mu, `${recipe.file} 缺少 包 声明`);
    assert.match(lines.join('\n'), /^结束类\s*$/mu, `${recipe.file} 必须以 结束类 收尾`);
    const body = lines.filter(line => !line.trimStart().startsWith('//')).join('\n');
    assert.ok(!/^\s*结束\(\)\s*$/mu.test(body), `${recipe.file} 不得出现显式退出命令 结束()`);
    assert.ok(!body.includes('NE_运行消息循环'), `${recipe.file} 不得手写消息循环，生成器已负责`);
    assert.ok(!/控件_设置(?:文本|勾选|可见)\(\s"/u.test(body), `${recipe.file} 控件引用参数不得写成带引号文本`);
    for (const command of recipe.commands) {
      assert.ok(body.includes(command), `${recipe.file} 声明用到 ${command}，正文里却没有出现`);
    }
  }
});

test('new_emoji 界面配方通过 .lcpp 语义诊断（无 error 级问题）', () => {
  if (!fs.existsSync(installedManifestPath)) return;
  const enabledModules = installedModules();
  const manifest = JSON.parse(fs.readFileSync(installedManifestPath, 'utf8')) as LingBuilderModuleManifest;
  for (const recipe of recipeIndex.recipes) {
    const source = fs.readFileSync(path.join(recipeDir, recipe.file), 'utf8');
    const project = createRecipeProject(recipe, manifest);
    const diagnostics = getLingCppSemanticDiagnostics(source, project, `src/${recipe.file}`, {
      enabledModules,
      availableModules: enabledModules
    });
    const errors = diagnostics.filter(item => item.level === 'error');
    assert.deepEqual(errors, [], `${recipe.file} 存在 error 级诊断：${errors.map(item => `${item.line} ${item.message}`).join('；')}`);
  }
});

/**
 * 配方 01–06 走「模型零控件 + 源码 控件_创建NE* 创建」，配方 07 走设计器模型控件；
 * 后者按模块 designerControls 的 previewType/defaultProps 造模型，验证配方注释里的契约真实可解析。
 */
function createRecipeProject(recipe: RecipeEntry, manifest: LingBuilderModuleManifest): LingWindowProject {
  const modelControls = recipe.id === 'designer-model-controls';
  return {
    schemaVersion: 2,
    id: `ui-recipe-${recipe.id}`,
    name: recipe.title,
    windows: [{
      id: 'main',
      fileName: 'MainWindow.xml',
      className: '演示窗口',
      title: recipe.title,
      width: 900,
      height: 560,
      background: '#181825',
      description: '',
      designerBackend: 'new-emoji',
      events: { Loaded: '创建完毕' },
      controls: modelControls ? [
        createDesignerControl(manifest, 'Input', '主输入框', { Clicked: undefined, TextChanged: '_主输入框_文本变化' }),
        createDesignerControl(manifest, 'Button', '提交按钮', { Clicked: '_提交按钮_被点击' }),
        createDesignerControl(manifest, 'Button', '清空按钮', { Clicked: '_清空按钮_被点击' }),
        createDesignerControl(manifest, 'Text', '结果文本', {})
      ] : []
    }]
  } as LingWindowProject;
}

function createDesignerControl(
  manifest: LingBuilderModuleManifest,
  type: string,
  name: string,
  events: Record<string, string | undefined>
) {
  const control = (manifest.contributes?.designerControls || []).find(item => item.type === type);
  assert.ok(control, `模块清单里没有 ${type} 控件贡献`);
  return {
    id: name,
    type: control!.previewType || control!.type,
    designerType: control!.namespacedType,
    name,
    content: control!.defaultProps?.content ?? name,
    x: 24,
    y: 24,
    width: 260,
    height: 40,
    fontSize: 12,
    background: '#181825',
    foreground: '#F8FAFC',
    isEnabled: true,
    visibility: 'Visible',
    properties: { ...control!.defaultProps },
    events: Object.fromEntries(Object.entries(events).filter(([, handler]) => Boolean(handler))) as Record<string, string>
  };
}

function installedModules(): InstalledModule[] {
  const newEmoji = JSON.parse(fs.readFileSync(installedManifestPath, 'utf8')) as LingBuilderModuleManifest;
  const builtin: InstalledModule[] = BUILTIN_MODULES.map(manifest => ({
    manifest,
    installPath: '',
    isBuiltin: true,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  }));
  return [...builtin, {
    manifest: newEmoji,
    installPath: path.dirname(installedManifestPath),
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  }];
}
