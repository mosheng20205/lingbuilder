import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { AiConversationService, AiConversationStoreError } from '../src/services/ai/aiConversationService';

async function temporaryWorkspace(): Promise<string> { return await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-ai-conversation-')); }

test('AI conversations persist independently for each project', async () => {
  const workspaceRoot = await temporaryWorkspace();
  const service = new AiConversationService(workspaceRoot);
  const first = await service.create('project-a');
  await service.replaceMessages('project-a', first.conversations[0].id, [{ id: 'message-1', role: 'user', content: '帮我修复错误', createdAt: '2026-08-22T00:00:00.000Z' }]);
  assert.equal((await service.get('project-a')).conversations[0].messages[0].content, '帮我修复错误');
  assert.deepEqual((await service.get('project-b')).conversations, []);
  assert.ok(await fs.stat(path.join(workspaceRoot, '.lingbuilder', 'ai', 'project-a.sessions.json')));
});

test('AI conversations retain active selection and support deletion', async () => {
  const service = new AiConversationService(await temporaryWorkspace());
  const first = await service.create('project-a', '第一个会话');
  const second = await service.create('project-a', '第二个会话');
  assert.equal(second.activeConversationId, second.conversations[0].id);
  const activated = await service.activate('project-a', first.conversations[0].id);
  assert.equal(activated.activeConversationId, first.conversations[0].id);
  const removed = await service.remove('project-a', first.conversations[0].id);
  assert.equal(removed.activeConversationId, second.conversations[0].id);
});

test('AI conversation storage reports corrupted JSON without overwriting it', async () => {
  const workspaceRoot = await temporaryWorkspace();
  const filePath = path.join(workspaceRoot, '.lingbuilder', 'ai', 'project-a.sessions.json');
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, '{broken', 'utf8');
  await assert.rejects(() => new AiConversationService(workspaceRoot).get('project-a'), (error: unknown) => error instanceof AiConversationStoreError && error.code === 'CORRUPTED_STORE');
  assert.equal(await fs.readFile(filePath, 'utf8'), '{broken');
});
