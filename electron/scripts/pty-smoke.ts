import { PtyTerminalService } from '../src/services/terminal/ptyTerminalService';

const root = process.argv[2] || process.cwd();
const service = new PtyTerminalService(root);
try {
  const session = await service.create({ profile: process.platform === 'win32' ? 'cmd' : 'shell' });
  const exited = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('PTY 命令执行超时。')), 7000);
    const unsubscribe = service.subscribe(event => {
      if (event.kind === 'exited' && event.session.id === session.id) { clearTimeout(timeout); unsubscribe(); resolve(); }
    });
  });
  service.write(session.id, process.platform === 'win32' ? 'echo LINGBUILDER_PTY_OK & exit\r' : 'echo LINGBUILDER_PTY_OK; exit\n');
  await exited;
  if (!(service.get(session.id)?.buffer || '').includes('LINGBUILDER_PTY_OK')) throw new Error('PTY 未返回预期交互输出。');
  console.log('LINGBUILDER_PTY_SMOKE_OK');
  service.closeAll();
  process.exit(0);
} catch (error) {
  console.error(error);
  service.closeAll();
  process.exit(1);
}
