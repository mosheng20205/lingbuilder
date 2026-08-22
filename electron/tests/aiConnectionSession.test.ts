import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { AiConnectionSessionService, aiConnectionSession } from '../src/services/ai/aiConnectionSessionService';
import { getAiWorkspaceFilesForEdit, isLikelyCodeEditInstruction, isLikelyDesignerEditInstruction } from '../src/components/AiAssistant';

test('AI connection verification survives an assistant panel remount within the renderer session', () => {
  const signature = 'deepseek|https://api.deepseek.com|test-key|deepseek-v4-flash';

  aiConnectionSession.clear();
  try {
    aiConnectionSession.markConnected(signature);

    assert.equal(aiConnectionSession.getConnectedSignature(), signature);
    assert.equal(aiConnectionSession.isConnected(signature), true);
    assert.equal(aiConnectionSession.isConnected('deepseek|https://api.deepseek.com|other-key|deepseek-v4-flash'), false);
  } finally {
    aiConnectionSession.clear();
  }
});

test('changing the AI connection configuration invalidates the renderer-session verification', () => {
  const session = new AiConnectionSessionService();
  const signature = 'deepseek|https://api.deepseek.com|test-key|deepseek-v4-flash';

  session.markConnected(signature);
  session.clear();

  assert.equal(session.getConnectedSignature(), null);
  assert.equal(session.isConnected(signature), false);
});

test('AI usage mode survives an assistant panel remount within the renderer session', () => {
  const session = new AiConnectionSessionService();

  assert.equal(session.getMode(), null);
  session.setMode('byok');

  assert.equal(session.getMode(), 'byok');
});

test('AI assistant restores only renderer-session verification and waits for safe credential hydration', () => {
  const assistant = fs.readFileSync(new URL('../src/components/AiAssistant.tsx', import.meta.url), 'utf8');

  assert.match(assistant, /aiConnectionSession\.getConnectedSignature\(\)/u);
  assert.match(assistant, /aiConnectionSession\.markConnected\(aiConnectionSignature\)/u);
  assert.match(assistant, /aiConnectionSession\.clear\(\)/u);
  assert.match(assistant, /aiConnectionSession\.getMode\(\) \|\| loadAiMode\(\)/u);
  assert.match(assistant, /aiConnectionSession\.setMode\(mode\)/u);
  assert.match(assistant, /aiMode,/u);
  assert.match(assistant, /handleAiModeChange\('byok'\)/u);
  assert.match(assistant, /isAiCredentialReady/u);
  assert.match(assistant, /credentials\.getAiApiKey\(\)[\s\S]*finally\(\(\) => setIsAiCredentialReady\(true\)\)/u);
});

test('AI assistant routes explicit edits through the edit flow without forcing every lcpp question into edits', () => {
  const assistant = fs.readFileSync(new URL('../src/components/AiAssistant.tsx', import.meta.url), 'utf8');

  assert.match(assistant, /export function isLikelyDesignerEditInstruction/u);
  assert.match(assistant, /const shouldUseEditFlow = \(isLingCppFile && isLikelyCodeEditInstruction\(userMsg\.text\)\) \|\| Boolean\(/u);
  assert.match(assistant, /cloudAi\.start\(shouldUseEditFlow \? 'edit' : 'chat'/u);
  assert.match(assistant, /if \(shouldUseEditFlow\) \{/u);
  assert.match(assistant, /getAiWorkspaceFilesForEdit\(workspaceFiles, filePath, sourceCode\)/u);
  assert.match(assistant, /\.lcpp\$\/iu/u);
});

test('layout intent and bounded AI context remain independent from the active file extension', () => {
  assert.equal(isLikelyDesignerEditInstruction('当前的界面太乱了，帮我美化一下'), true);
  assert.equal(isLikelyDesignerEditInstruction('请解释当前 C++ 编译错误'), false);

  const files = getAiWorkspaceFilesForEdit([
    { filePath: 'src/other.cpp', sourceCode: 'other' },
    { filePath: 'src/MainWindow.lcpp', sourceCode: 'stale' }
  ], 'config.ini', 'current');

  assert.deepEqual(files.map(file => file.filePath), [
    'config.ini',
    'src/MainWindow.lcpp',
    'src/other.cpp'
  ]);
  assert.equal(files[0].sourceCode, 'current');
  assert.equal(isLikelyCodeEditInstruction('1+1'), false);
  assert.equal(isLikelyCodeEditInstruction('请修复这个编译错误'), true);
});
