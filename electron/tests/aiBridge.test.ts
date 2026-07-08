import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';

import { AiBridgeService } from '../src/services/aiBridge/aiBridgeService';
import { createAiBridgeRouter } from '../src/services/aiBridge/httpRoutes';
import { AiBridgeServerOptions } from '../src/services/aiBridge/types';

test('AI Bridge HTTP rejects missing or invalid token', async () => {
  const workspaceRoot = await createTempWorkspace();
  const service = new AiBridgeService(createOptions(workspaceRoot, 'preview', 'secret-token'));
  const app = express();
  app.use(express.json());
  app.use('/api/ai-bridge', createAiBridgeRouter(service, 'secret-token'));
  const server = await listen(app);
  try {
    const baseUrl = `http://127.0.0.1:${server.port}/api/ai-bridge`;
    const unauthorized = await fetch(`${baseUrl}/health`);
    assert.equal(unauthorized.status, 401);

    const authorized = await fetch(`${baseUrl}/health`, {
      headers: { authorization: 'Bearer secret-token' }
    });
    assert.equal(authorized.status, 200);
    const body = await authorized.json() as { ok: boolean; permission: string };
    assert.equal(body.ok, true);
    assert.equal(body.permission, 'preview');
  } finally {
    await server.close();
  }
});

test('AI Bridge rejects workspace path traversal', async () => {
  const workspaceRoot = await createTempWorkspace();
  const service = new AiBridgeService(createOptions(workspaceRoot, 'preview'));
  await assert.rejects(
    () => service.readFile('../outside.md'),
    /路径越界/
  );
});

test('AI Bridge permission modes gate edit apply', async () => {
  const workspaceRoot = await createTempWorkspace();
  const sourcePath = 'src/main.lcpp';
  const sourceCode = '类 Main\n结束类\n';
  await fs.mkdir(path.join(workspaceRoot, 'src'), { recursive: true });
  await fs.writeFile(path.join(workspaceRoot, sourcePath), sourceCode, 'utf8');

  const previewService = new AiBridgeService(createOptions(workspaceRoot, 'preview'));
  const previewProposal = await previewService.proposeEdit({
    filePath: sourcePath,
    sourceCode,
    instruction: '添加一条注释'
  });
  await assert.rejects(
    () => previewService.applyEdit({ proposalId: previewProposal.proposal.id }),
    /预览确认模式/
  );

  const applied = await previewService.applyEdit({
    proposalId: previewProposal.proposal.id,
    approved: true
  });
  assert.equal(applied.ok, true);
  assert.equal(applied.appliedFiles.length, 1);

  const readonlyService = new AiBridgeService(createOptions(workspaceRoot, 'readonly'));
  const readonlyProposal = await readonlyService.proposeEdit({
    filePath: sourcePath,
    sourceCode,
    instruction: '添加一条注释'
  });
  await assert.rejects(
    () => readonlyService.applyEdit({ proposalId: readonlyProposal.proposal.id, approved: true }),
    /只读模式/
  );
});

test('AI Bridge diagnostics and modules use LingCpp module context', async () => {
  const workspaceRoot = await createTempWorkspace();
  const service = new AiBridgeService(createOptions(workspaceRoot, 'preview'));
  const diagnostics = await service.getLingCppDiagnostics({
    filePath: 'src/main.lcpp',
    sourceCode: '类 Main\n    事件 _按钮1_被单击()\n        未启用模块命令()\n结束类\n'
  });
  assert.equal(diagnostics.ok, true);
  assert.ok(Array.isArray(diagnostics.diagnostics));
  assert.equal(typeof diagnostics.moduleContextSummary, 'string');

  const modules = await service.listModules();
  assert.equal(modules.ok, true);
  assert.ok(Array.isArray(modules.availableModules));
  assert.equal(typeof modules.summary, 'string');
});

async function createTempWorkspace(): Promise<string> {
  return await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-ai-bridge-'));
}

function createOptions(
  workspaceRoot: string,
  permission: AiBridgeServerOptions['permission'],
  token = 'test-token'
): AiBridgeServerOptions {
  return {
    workspaceRoot,
    host: '127.0.0.1',
    port: 0,
    token,
    permission,
    allowRemote: false,
    enableMcp: false
  };
}

async function listen(app: express.Express): Promise<{ port: number; close: () => Promise<void> }> {
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Failed to listen');
  return {
    port: address.port,
    close: () => new Promise(resolve => server.close(() => resolve()))
  };
}
