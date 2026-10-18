/**
 * lingbuilder.notify 1.0.0 消息推送模块真机验收：
 * 生成窗口工程 → MSBuild Win32+x64 Release → 运行 exe → exe 向三平台测试群真实推送并写 notify-smoke.txt → 脚本逐行硬断言。
 * 覆盖：企微文本/Markdown/图片(自动Base64+MD5)/图文/文件上传发送/发JSON 直发；钉钉文本（关键词+加签叠加）/
 * Markdown（自动补 @手机号）/链接/单按钮卡片/多按钮卡片/FeedCard/@所有人；飞书文本/富文本段落/@所有人/带签名发送；
 * 错误路径：企微错误 key（errcode!=0）、钉钉错误签名（errcode 310000）、内容超 2048 字节、图片路径不存在、
 * 飞书无效地址——全部走 推送_取错误() 中文报错且不崩溃。
 * 运行：cd electron && npm run smoke:notify
 * 注意：钉钉测试机器人配置为「自定义关键词（消息/武汉/天气）+ 加签」叠加校验，所有钉钉内容/标题必须含「消息」。
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import type { InstalledModule } from '../src/services/modules/types';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import type { LingWindowProject } from '../src/services/windowDesigner/types';
import { exportVisualStudioProject } from '../src/services/windowDesigner/visualStudioProjectExporter';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const projectDir = path.resolve(repoRoot, '.lingbuilder-build', 'notify-native-smoke');
const REPORT_NAME = 'notify-smoke.txt';

// 测试群专用凭据：钉钉=关键词(消息/武汉/天气)+加签叠加；飞书=无签模式（响应旧格式 StatusCode:0）。
// 验收完成后用户会删除三个机器人使凭据全部作废。
const DINGTALK_WEBHOOK = 'https://oapi.dingtalk.com/robot/send?access_token=e850f5b190f97275a2ed70666a5449d3918d4d909eff17c1ce834620c9bd19b7';
const DINGTALK_SECRET = 'SEC029cbc99018f9e9df16156a15cc15082b112ee5d74e733d11da7cffc24e89c61';
const FEISHU_WEBHOOK = 'https://open.feishu.cn/open-apis/bot/v2/hook/0acbeaff-56b2-497b-8513-fca21d22ba57';

async function resolveWecomWebhook(): Promise<string> {
  if (process.env['LINGBUILDER_WECOM_WEBHOOK']) return process.env['LINGBUILDER_WECOM_WEBHOOK'].trim();
  const configPath = path.join(process.env['USERPROFILE'] || '', '.zcode', 'skills', 'wecom-webhook', 'config', 'webhook.txt');
  const content = await fs.readFile(configPath, 'utf8');
  const url = content.trim().split(/\r?\n/)[0].trim();
  if (!url.startsWith('https://')) throw new Error(`企业微信 webhook 配置无效：${configPath}`);
  return url;
}

function builtin(id: string): InstalledModule {
  const manifest = BUILTIN_MODULES.find(item => item.id === id);
  if (!manifest) throw new Error(`缺少内置模块：${id}`);
  return { manifest, installPath: `builtin://${id}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
}

interface Expectation {
  name: string;
  positive: boolean;
  detailPattern?: RegExp;
}

function buildSource(wecomWebhook: string): string {
  return [
    '类 MainWindow',
    '    事件 _MainWindow_创建完毕()',
    '        局部 文本型 企微地址',
    '        局部 文本型 钉钉地址',
    '        局部 文本型 钉钉密钥',
    '        局部 文本型 飞书地址',
    '        局部 文本型 编号',
    '        局部 文本型 按钮列表',
    '        局部 文本型 图文条目',
    '        局部 文本型 段落',
    '        局部 文本型 长内容',
    '        局部 逻辑型 成功',
    '        @ std::remove("' + REPORT_NAME + '");',
    '        @ auto lbNotifyReport = [](const char* name, bool ok, const std::wstring& detail) {',
    `        @     std::ofstream out("${REPORT_NAME}", std::ios::binary | std::ios::app);`,
    '        @     std::string bytes = LB_WideToUtf8(detail.c_str());',
    '        @     for (auto& ch : bytes) { if (ch == \'\\r\' || ch == \'\\n\') ch = \' \'; }',
    '        @     out << name << \' \' << (ok ? \'E\' : \'N\') << \' \' << bytes << "\\n";',
    '        @ };',
    `        企微地址 = "${wecomWebhook}"`,
    `        钉钉地址 = "${DINGTALK_WEBHOOK}"`,
    `        钉钉密钥 = "${DINGTALK_SECRET}"`,
    `        飞书地址 = "${FEISHU_WEBHOOK}"`,
    // ── 企业微信：文本 / Markdown / 图片 / 图文 / 文件 / 发JSON ──
    '        成功 = 推送_发企业微信文本(企微地址, "LingBuilder 企微文本消息测试：引号与换行转义由运行时代劳", "", 假)',
    '        @ lbNotifyReport("wecom-text", 成功, 推送_取响应文本());',
    '        成功 = 推送_发企业微信Markdown(企微地址, "## LingBuilder 企微Markdown测试\\n> 消息推送模块冒烟")',
    '        @ lbNotifyReport("wecom-markdown", 成功, 推送_取响应文本());',
    '        成功 = 推送_发企业微信图片(企微地址, "结果.png")',
    '        @ lbNotifyReport("wecom-image", 成功, 推送_取响应文本());',
    '        图文条目 = """',
    'LingBuilder 发布公告消息|点此查看详情|https://lingbuilder.com',
    '第二条图文消息|描述可留空|https://lingbuilder.com/downloads',
    '"""',
    '        成功 = 推送_发企业微信图文(企微地址, 图文条目)',
    '        @ lbNotifyReport("wecom-news", 成功, 推送_取响应文本());',
    '        编号 = 推送_上传企业微信文件(企微地址, "report.txt")',
    '        @ if (编号.empty()) lbNotifyReport("wecom-upload", false, 推送_取错误()); else lbNotifyReport("wecom-upload", true, 推送_取响应文本());',
    '        成功 = 推送_发企业微信文件(企微地址, 编号)',
    '        @ lbNotifyReport("wecom-file", 成功, 推送_取响应文本());',
    `        @ 成功 = 推送_发JSON(L"${wecomWebhook}", L"{\\"msgtype\\":\\"text\\",\\"text\\":{\\"content\\":\\"LingBuilder 推送_发JSON 直发测试\\"}}");`,
    '        @ lbNotifyReport("wecom-json", 成功, 推送_取响应文本());',
    // ── 钉钉：文本（关键词+加签）/ Markdown / 链接 / 双卡片 / FeedCard / @所有人 ──
    '        成功 = 推送_发钉钉文本(钉钉地址, "LingBuilder 钉钉文本消息测试（关键词+加签）", "", 假, 钉钉密钥)',
    '        @ lbNotifyReport("dingtalk-text", 成功, 推送_取响应文本());',
    '        成功 = 推送_发钉钉Markdown(钉钉地址, "## LingBuilder 钉钉Markdown消息测试", "", 假, 钉钉密钥)',
    '        @ lbNotifyReport("dingtalk-markdown", 成功, 推送_取响应文本());',
    '        成功 = 推送_发钉钉链接(钉钉地址, "LingBuilder 消息链接测试", "点此查看项目主页", "https://lingbuilder.com", "", 钉钉密钥)',
    '        @ lbNotifyReport("dingtalk-link", 成功, 推送_取响应文本());',
    '        成功 = 推送_发钉钉卡片单按钮(钉钉地址, "LingBuilder 消息卡片测试", "构建失败请查看日志", "查看消息日志", "https://lingbuilder.com", 钉钉密钥)',
    '        @ lbNotifyReport("dingtalk-card-single", 成功, 推送_取响应文本());',
    '        按钮列表 = """',
    '查看消息日志|https://lingbuilder.com',
    '重新构建消息|https://lingbuilder.com/downloads',
    '"""',
    '        成功 = 推送_发钉钉卡片多按钮(钉钉地址, "LingBuilder 消息多按钮卡片", "请选择操作", 按钮列表, 真, 钉钉密钥)',
    '        @ lbNotifyReport("dingtalk-card-multi", 成功, 推送_取响应文本());',
    '        成功 = 推送_发钉钉图文(钉钉地址, "LingBuilder 资讯消息|https://lingbuilder.com|https://lingbuilder.com/favicon.ico", 钉钉密钥)',
    '        @ lbNotifyReport("dingtalk-feedcard", 成功, 推送_取响应文本());',
    '        成功 = 推送_发钉钉文本(钉钉地址, "LingBuilder 钉钉消息：本条 @ 所有人（冒烟验收）", "", 真, 钉钉密钥)',
    '        @ lbNotifyReport("dingtalk-atall", 成功, 推送_取响应文本());',
    // ── 飞书：文本 / 富文本段落 / @所有人 / 带签名 ──
    '        成功 = 推送_发飞书文本(飞书地址, "LingBuilder 飞书文本消息测试", "", 假, "")',
    '        @ lbNotifyReport("feishu-text", 成功, 推送_取响应文本());',
    '        段落 = """',
    'LingBuilder 飞书富文本第一段消息',
    '第二段：消息推送模块冒烟验收',
    '"""',
    '        成功 = 推送_发飞书富文本(飞书地址, 段落, "")',
    '        @ lbNotifyReport("feishu-post", 成功, 推送_取响应文本());',
    '        成功 = 推送_发飞书文本(飞书地址, "LingBuilder 飞书消息：本条 @ 所有人（冒烟验收）", "", 真, "")',
    '        @ lbNotifyReport("feishu-atall", 成功, 推送_取响应文本());',
    '        成功 = 推送_发飞书文本(飞书地址, "LingBuilder 飞书带签名消息测试", "", 假, 钉钉密钥)',
    '        @ lbNotifyReport("feishu-signed", 成功, 推送_取响应文本());',
    // ── 错误路径：全部返回假且 推送_取错误() 给出中文原因 ──
    '        成功 = 推送_发企业微信文本("https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=00000000-0000-0000-0000-000000000000", "错误key消息测试", "", 假)',
    '        @ lbNotifyReport("neg-wecom-badkey", 成功, 推送_取错误());',
    '        成功 = 推送_发钉钉文本(钉钉地址, "错误签名消息测试", "", 假, "SEC00000000000000000000000000000000000000000000000000000000000000")',
    '        @ lbNotifyReport("neg-dingtalk-badsign", 成功, 推送_取错误());',
    '        @ for (int i = 0; i < 300; ++i) 长内容 += L"超长测试消息";',
    '        成功 = 推送_发企业微信文本(企微地址, 长内容, "", 假)',
    '        @ lbNotifyReport("neg-wecom-toolong", 成功, 推送_取错误());',
    '        成功 = 推送_发企业微信图片(企微地址, "不存在的图片.png")',
    '        @ lbNotifyReport("neg-wecom-image-missing", 成功, 推送_取错误());',
    '        成功 = 推送_发飞书文本("https://open.feishu.cn/open-apis/bot/v2/hook/00000000-0000-0000-0000-000000000000", "无效地址消息测试", "", 假, "")',
    '        @ lbNotifyReport("neg-feishu-badurl", 成功, 推送_取错误());',
    `        @ { std::ofstream out("${REPORT_NAME}", std::ios::binary | std::ios::app); out << "final OK" << "\\n"; }`,
    '        @ ExitProcess(0);',
    '    结束',
    '结束类'
  ].join('\n');
}

// 1×1 白色 PNG（企微图片消息用）；report.txt 为文件上传用样本。
const TINY_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

function assertReport(platform: string, report: string): void {
  const lines = new Map(report.split('\n').filter(Boolean).map(line => [line.split(' ')[0], line]));
  const expectations: Expectation[] = [
    { name: 'wecom-text', positive: true, detailPattern: /"errcode":\s*0/ },
    { name: 'wecom-markdown', positive: true, detailPattern: /"errcode":\s*0/ },
    { name: 'wecom-image', positive: true, detailPattern: /"errcode":\s*0/ },
    { name: 'wecom-news', positive: true, detailPattern: /"errcode":\s*0/ },
    { name: 'wecom-upload', positive: true, detailPattern: /"media_id"/ },
    { name: 'wecom-file', positive: true, detailPattern: /"errcode":\s*0/ },
    { name: 'wecom-json', positive: true, detailPattern: /"errcode":\s*0/ },
    { name: 'dingtalk-text', positive: true, detailPattern: /"errcode":\s*0/ },
    { name: 'dingtalk-markdown', positive: true, detailPattern: /"errcode":\s*0/ },
    { name: 'dingtalk-link', positive: true, detailPattern: /"errcode":\s*0/ },
    { name: 'dingtalk-card-single', positive: true, detailPattern: /"errcode":\s*0/ },
    { name: 'dingtalk-card-multi', positive: true, detailPattern: /"errcode":\s*0/ },
    { name: 'dingtalk-feedcard', positive: true, detailPattern: /"errcode":\s*0/ },
    { name: 'dingtalk-atall', positive: true, detailPattern: /"errcode":\s*0/ },
    { name: 'feishu-text', positive: true, detailPattern: /"(?:StatusCode|code)":\s*0/ },
    { name: 'feishu-post', positive: true, detailPattern: /"(?:StatusCode|code)":\s*0/ },
    { name: 'feishu-atall', positive: true, detailPattern: /"(?:StatusCode|code)":\s*0/ },
    { name: 'feishu-signed', positive: true, detailPattern: /"(?:StatusCode|code)":\s*0/ },
    { name: 'neg-wecom-badkey', positive: false },
    { name: 'neg-dingtalk-badsign', positive: false, detailPattern: /310000/ },
    { name: 'neg-wecom-toolong', positive: false, detailPattern: /2048/ },
    { name: 'neg-wecom-image-missing', positive: false, detailPattern: /读取图片文件失败/ },
    { name: 'neg-feishu-badurl', positive: false }
  ];
  for (const expectation of expectations) {
    const line = lines.get(expectation.name);
    if (!line) throw new Error(`${platform} 报告缺少 ${expectation.name} 行：\n${report}`);
    const parsed = line.match(/^(\S+) ([EN]) (.*?)\s*$/u);
    if (!parsed) throw new Error(`${platform} 报告行格式异常：${line}`);
    const flag = parsed[2];
    const detail = parsed[3] || '';
    const flagOk = flag === 'E';
    if (flagOk !== expectation.positive) throw new Error(`${platform} ${expectation.name} 标志位异常（期望 ${expectation.positive ? 'E' : 'N'}）：${line}`);
    if (expectation.positive && expectation.detailPattern && !expectation.detailPattern.test(detail)) {
      throw new Error(`${platform} ${expectation.name} 响应不含期望字段（${expectation.detailPattern}）：${line}`);
    }
    if (!expectation.positive) {
      if (!detail.trim()) throw new Error(`${platform} ${expectation.name} 失败但 推送_取错误() 为空：${line}`);
      if (expectation.detailPattern && !expectation.detailPattern.test(detail)) {
        throw new Error(`${platform} ${expectation.name} 错误文本不含期望原因（${expectation.detailPattern}）：${line}`);
      }
    }
  }
  if (!report.includes('final OK')) throw new Error(`${platform} 报告缺 final OK 行。`);
}

async function main(): Promise<void> {
  if (!projectDir.startsWith(`${repoRoot}${path.sep}`)) throw new Error('notify 冒烟目录越出工作区。');
  const wecomWebhook = await resolveWecomWebhook();
  const enabledModules = [builtin('lingbuilder.win32.basic'), builtin('lingbuilder.notify')];
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'notify-native-smoke',
    name: '消息推送原生冒烟测试',
    windows: [{ id: 'main', fileName: 'MainWindow.xml', className: 'MainWindow', title: '消息推送原生冒烟测试', width: 420, height: 240, background: '#202028', description: '企业微信/钉钉/飞书 webhook 出站推送真机验收', controls: [] }]
  };
  const generated = generateLingCppNativeWin32Project(project, { enabledModules, lingCppSourceCode: buildSource(wecomWebhook) });
  if (generated.blockingDiagnostics.length) throw new Error(generated.blockingDiagnostics.join('\n'));
  await fs.rm(projectDir, { recursive: true, force: true });
  await fs.mkdir(projectDir, { recursive: true });
  for (const file of generated.files) {
    const target = path.resolve(projectDir, file.relativePath);
    if (!target.startsWith(`${projectDir}${path.sep}`)) throw new Error(`生成文件越界：${file.relativePath}`);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, file.content, 'utf8');
  }
  await fs.mkdir(path.join(projectDir, 'resources'), { recursive: true });
  await fs.copyFile(path.join(repoRoot, 'image', 'lingbuilder-ide-icon-v1.ico'), path.join(projectDir, 'resources', 'lingbuilder-app.ico'));
  const exported = await exportVisualStudioProject({ projectDir, projectId: project.id, generatedFiles: generated.files, enabledModules });
  const vswhere = path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');
  const installation = (await execFileAsync(vswhere, ['-latest', '-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath'], { windowsHide: true })).stdout.trim();
  const msbuild = path.join(installation, 'MSBuild', 'Current', 'Bin', 'MSBuild.exe');
  for (const platform of ['Win32', 'x64'] as const) {
    await execFileAsync(msbuild, [exported.solutionPath, '/m', '/t:Build', '/p:Configuration=Release', `/p:Platform=${platform}`, '/v:minimal'], { cwd: projectDir, windowsHide: true, timeout: 15 * 60 * 1000, maxBuffer: 32 * 1024 * 1024 });
    const binDir = path.join(projectDir, platform, 'Release', 'bin');
    await fs.writeFile(path.join(binDir, '结果.png'), TINY_PNG);
    await fs.writeFile(path.join(binDir, 'report.txt'), 'LingBuilder 消息推送模块文件上传冒烟样本\n', 'utf8');
    const executable = path.join(binDir, `${exported.projectName}.exe`);
    const run = await execFileAsync(executable, [], { cwd: binDir, windowsHide: true, timeout: 5 * 60 * 1000, maxBuffer: 1024 * 1024 }).then(() => ({}), error => ({ error }));
    const reportPath = path.join(binDir, REPORT_NAME);
    const report = await fs.readFile(reportPath, 'utf8').catch(() => '');
    if ('error' in run && !report.includes('final OK')) throw new Error(`${platform} 运行未正常退出（exit=${(run.error as { code?: number }).code}）：\n${report}`);
    assertReport(platform, report);
    console.log(`[${platform}] notify 消息推送原生冒烟 PASS（23 项：18 正向 + 5 错误路径）`);
  }
  console.log(JSON.stringify({ ok: true, projectDir, platforms: ['Win32', 'x64'] }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
