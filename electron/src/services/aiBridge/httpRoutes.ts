import crypto from 'node:crypto';
import express from 'express';
import { LingCppEditContext } from '../lingCpp/types';
import { AiBridgeService } from './aiBridgeService';

export function createAiBridgeRouter(
  service: AiBridgeService,
  token: string,
  planner?: (context: LingCppEditContext) => Promise<any>
): express.Router {
  const expectedToken = token.trim();
  if (!expectedToken) {
    throw new Error('AI Bridge 必须配置非空独立 token。');
  }
  const router = express.Router();

  router.use((req, res, next) => {
    const authHeader = req.header('authorization') || '';
    const match = /^Bearer\s+(.+)$/iu.exec(authHeader);
    const bearerToken = match?.[1]?.trim() || '';
    if (!tokensEqual(bearerToken, expectedToken)) {
      return res.status(401).json({ ok: false, error: 'AI Bridge token 无效或缺失。' });
    }
    next();
  });

  router.get('/health', (_req, res) => res.json(service.health()));

  router.get('/workspace/tree', async (_req, res) => handle(res, () => service.listWorkspaceTree()));

  router.post('/files/read', async (req, res) => handle(res, () => service.readFile(req.body.filePath)));

  router.post('/files/search', async (req, res) => handle(res, () => service.searchFiles(req.body)));

  router.post('/diagnostics/lingcpp', async (req, res) => handle(res, () => service.getLingCppDiagnostics(req.body)));

  router.post('/edit/propose', async (req, res) => handle(res, () => service.proposeEdit(req.body, planner)));

  router.post('/edit/apply', async (req, res) => handle(res, () => service.applyEdit(req.body)));

  router.post('/build/run', async (req, res) => handle(res, () => service.buildRun(req.body)));

  router.get('/modules', async (req, res) => {
    const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : undefined;
    await handle(res, () => service.listModules(projectId));
  });

  router.post('/native/preview', async (req, res) => handle(res, () => service.nativePreview(req.body)));

  router.post('/native/export', async (req, res) => handle(res, () => service.nativeExport(req.body)));

  return router;
}

function tokensEqual(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length
    && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

async function handle(res: express.Response, fn: () => Promise<unknown>): Promise<void> {
  try {
    res.json(await fn());
  } catch (error: any) {
    res.status(400).json({ ok: false, error: error?.message || 'AI Bridge 请求失败。' });
  }
}
