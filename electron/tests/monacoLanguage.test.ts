import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { mapWorkbenchLanguageToMonaco } from '../src/services/textModel/monacoLanguage';
import { createLingCppMonarchLanguage, getLingCppModuleCommandNames } from '../src/services/lingCpp/monacoTokens';
import type { LingCppModuleContext } from '../src/services/modules/types';
import {
  classifyLingCppPresentationCode,
  classifyLingCppPresentationToken,
  extractLingCppNativeVariableNames,
  tokenizeLingCppPresentationCode
} from '../src/services/lingCpp/beginnerSyntaxPresentation';

test('workbench language aliases map to the locally bundled Monaco languages', () => {
  assert.equal(mapWorkbenchLanguageToMonaco('cpp'), 'cpp');
  assert.equal(mapWorkbenchLanguageToMonaco('header'), 'cpp');
  assert.equal(mapWorkbenchLanguageToMonaco('h'), 'cpp');
  assert.equal(mapWorkbenchLanguageToMonaco('resource'), 'ini');
  assert.equal(mapWorkbenchLanguageToMonaco('rc'), 'ini');
  assert.equal(mapWorkbenchLanguageToMonaco('ini'), 'ini');
  assert.equal(mapWorkbenchLanguageToMonaco('lingcpp'), 'lingcpp');
  assert.equal(mapWorkbenchLanguageToMonaco('lcpp'), 'lingcpp');
  assert.equal(mapWorkbenchLanguageToMonaco('epl'), 'epl');
  assert.equal(mapWorkbenchLanguageToMonaco('unknown'), 'plaintext');
});

test('standalone Monaco optional workspace symbol API is capability-guarded', async () => {
  const source = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/MonacoCodeEditor.tsx'), 'utf8');
  const devScript = await fs.readFile(path.resolve(import.meta.dirname, '../scripts/dev.cjs'), 'utf8');
  assert.match(source, /typeof registerWorkspaceSymbolProvider === 'function'/u);
  assert.doesNotMatch(source, /monaco\.languages\.registerWorkspaceSymbolProvider\s*\(/u);
  assert.match(devScript, /assertPortAvailable/u);
  assert.match(devScript, /请先关闭旧的 npm run dev 窗口/u);
  assert.match(devScript, /exclusive: true/u);
});

test('Monaco reports the focused editor group through a current callback ref', async () => {
  const source = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/MonacoCodeEditor.tsx'), 'utf8');
  assert.match(source, /onFocusEditor\?: \(\) => void/u);
  assert.match(source, /onDidFocusEditorText\?\.\(\(\) => onFocusEditorRef\.current\?\.\(\)\)/u);
});

test('Monaco C++ providers resolve live model paths without retaining the mount-time map', async () => {
  const source = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/MonacoCodeEditor.tsx'), 'utf8');
  assert.match(source, /cppFilePathRegistry\.bind\(owner, modelUri, context\.filePath\)/u);
  assert.match(source, /cppFilePathRegistry\.release\(cppFilePathOwnerRef\.current\)/u);
  assert.match(source, /cppFilePathRegistry\.resolve\(model\.uri\.toString\(\)\)/u);
  assert.doesNotMatch(source, /const cppFilePaths = new Map/u);
});

test('LingCpp Monaco tokens distinguish enabled module commands and inline native C++', () => {
  const moduleContext: LingCppModuleContext = {
    availableModules: [],
    enabledModules: [
      {
        manifest: {
          schemaVersion: 2,
          id: 'test.edge-view',
          name: 'EdgeView 测试模块',
          version: '1.0.0',
          category: '界面',
          description: '测试模块命令着色。',
          contributes: {
            commands: [{
              name: 'EdgeView_创建区域',
              signature: 'EdgeView_创建区域(编号)',
              description: '创建浏览区域。'
            }]
          }
        },
        installPath: '.lingbuilder/modules/test.edge-view',
        isInstalled: true,
        diagnostics: []
      },
      {
        manifest: {
          schemaVersion: 2,
          id: 'test.invalid',
          name: '不可用模块',
          version: '1.0.0',
          category: '其他',
          description: '带诊断的模块不应参与着色。',
          contributes: {
            commands: [{ name: '不可用命令', signature: '不可用命令()', description: '不可用。' }]
          }
        },
        installPath: '.lingbuilder/modules/test.invalid',
        isInstalled: true,
        diagnostics: ['模块不可用']
      }
    ]
  };

  assert.deepEqual(getLingCppModuleCommandNames(moduleContext), ['EdgeView_创建区域']);
  const language = createLingCppMonarchLanguage(moduleContext);
  assert.deepEqual(language.moduleCommands, ['EdgeView_创建区域']);
  assert.equal((language.tokenizer.root[0] as any)[1][1].token, 'native.marker');
  assert.equal((language.tokenizer.root[0] as any)[1][1].nextEmbedded, 'cpp');
  assert.equal((language.tokenizer.nativeCpp[0] as any)[1].nextEmbedded, '@pop');
});

test('beginner LingCpp presentation distinguishes module calls and native C++ tokens', () => {
  const moduleCommands = new Set(['EdgeView_创建区域']);
  const context = {
    moduleCommands,
    knownMembers: new Set<string>(),
    knownProcedures: new Set<string>()
  };

  const moduleTokens = tokenizeLingCppPresentationCode('EdgeView_创建区域(1)');
  assert.equal(moduleTokens.includes('EdgeView_创建区域'), true);
  assert.equal(classifyLingCppPresentationToken('EdgeView_创建区域', { ...context, isNativeCpp: false }), 'module-command');

  const nativeTokens = tokenizeLingCppPresentationCode('@ std::wstring value = L"标题";');
  assert.equal(nativeTokens.includes('@'), true);
  assert.equal(nativeTokens.includes('L"标题"'), true);
  assert.equal(classifyLingCppPresentationToken('@', { ...context, isNativeCpp: true }), 'native-marker');
  assert.equal(classifyLingCppPresentationToken('std', { ...context, isNativeCpp: true }), 'native-namespace');
  assert.equal(classifyLingCppPresentationToken('wstring', { ...context, isNativeCpp: true }), 'native-type');
  assert.equal(classifyLingCppPresentationToken('EdgeView_创建区域', { ...context, isNativeCpp: true }), 'identifier');
});

test('beginner native C++ presentation colors functions, variables and wide strings semantically', () => {
  const source = [
    '    @ std::wstring js1 = EdgeView_执行JS实例(1, L"document.title");',
    '    @ 调试输出((L"JS返回值=" + js1).c_str());'
  ].join('\n');
  const nativeVariables = extractLingCppNativeVariableNames(source);
  assert.deepEqual([...nativeVariables], ['js1']);

  const context = {
    isNativeCpp: true,
    moduleCommands: new Set<string>(),
    knownMembers: new Set<string>(),
    knownProcedures: new Set<string>(),
    nativeVariables
  };
  const declaration = classifyLingCppPresentationCode(source.split('\n')[0].trim(), context);
  const call = classifyLingCppPresentationCode(source.split('\n')[1].trim(), context);
  const kindOf = (tokens: typeof declaration, text: string) => tokens.find(token => token.text === text)?.kind;

  assert.equal(kindOf(declaration, 'js1'), 'native-variable');
  assert.equal(kindOf(declaration, 'EdgeView_执行JS实例'), 'native-function');
  assert.equal(kindOf(declaration, 'L"document.title"'), 'string');
  assert.equal(kindOf(call, '调试输出'), 'native-function');
  assert.equal(kindOf(call, 'js1'), 'native-variable');
  assert.equal(kindOf(call, 'c_str'), 'native-function');
});
