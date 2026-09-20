// 灵码 Skill 清单发布门禁：拉取线上清单，验签 + 与安装包内置快照逐字比对锚定字段与文件哈希。
// 用法：npx tsx scripts/check-skill-catalog-anchors.ts [--url <清单地址>]
// 默认按 LINGBUILDER_SKILL_CATALOG_URL / LINGBUILDER_CLOUD_RELEASE_MODE=online 解析地址。
// 漂移或不可用时输出中文诊断并以退出码 1 结束，用于 CI / 发布前人工门禁。
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { SKILL_CATALOG_TRUST_ANCHORS } from '../electron/skillKit/skillCatalogTrustAnchors';
import {
  fetchRemoteSkillCatalog,
  resolveSkillCatalogEndpoint,
  verifySkillCatalogManifest,
  type SkillKitBundledManifest
} from '../electron/skillKit/skillCatalogRemote';

const electronRoot = path.resolve(import.meta.dirname, '..');

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const urlIndex = args.indexOf('--url');
  const explicitUrl = urlIndex >= 0 ? String(args[urlIndex + 1] || '').trim() : '';
  const endpoint = explicitUrl ? { url: explicitUrl } : resolveSkillCatalogEndpoint(process.env);
  if (!endpoint) {
    console.error('灵码 Skill 清单门禁失败：未配置清单地址。请传 --url <清单地址>，或设置 LINGBUILDER_SKILL_CATALOG_URL / LINGBUILDER_CLOUD_RELEASE_MODE=online。');
    process.exit(1);
  }

  let bundled: SkillKitBundledManifest;
  try {
    bundled = JSON.parse(await fs.readFile(path.join(electronRoot, 'skill-kit', 'manifest.json'), 'utf8')) as SkillKitBundledManifest;
  } catch (reason) {
    console.error(`灵码 Skill 清单门禁失败：无法读取安装包内置快照（${reason instanceof Error ? reason.message : String(reason)}）。`);
    process.exit(1);
    return;
  }

  console.log(`正在拉取线上灵码 Skill 清单：${endpoint.url}`);
  let manifest;
  try {
    manifest = await fetchRemoteSkillCatalog(endpoint.url);
  } catch (reason) {
    console.error(`灵码 Skill 清单门禁失败：${reason instanceof Error ? reason.message : String(reason)}`);
    console.error('云端尚未发布清单时 IDE 会一直使用安装包内置快照，此门禁不适用，可跳过。');
    process.exit(1);
    return;
  }

  let verified;
  try {
    verified = verifySkillCatalogManifest({
      manifest,
      bundled,
      anchors: SKILL_CATALOG_TRUST_ANCHORS,
      acceptedSequence: 0,
      ideVersion: ''
    });
  } catch (reason) {
    console.error(`灵码 Skill 清单门禁失败：线上清单不可信或与内置快照不一致（${reason instanceof Error ? reason.message : String(reason)}）。`);
    console.error('处理方式：在管理后台按内置快照修正锚定字段与文件清单；确需变更入口或包 ID 时，必须先更新 electron/skill-kit 并随 IDE 发版，再重新发布清单。');
    process.exit(1);
    return;
  }

  const drifts: string[] = [];
  for (const file of verified.release.files) {
    const local = bundled.files.find(entry => entry.path === file.path);
    if (!local) {
      drifts.push(`文件 ${file.path}：内置快照里没有该文件。`);
      continue;
    }
    const data = await fs.readFile(path.join(electronRoot, 'skill-kit', ...file.path.split('/'))).catch(() => null);
    if (data === null) {
      drifts.push(`文件 ${file.path}：内置快照清单登记了但磁盘缺失。`);
      continue;
    }
    const digest = createHash('sha256').update(data).digest('hex');
    if (digest !== file.sha256 || data.length !== file.bytes) {
      drifts.push(`文件 ${file.path}：线上 SHA-256/字节数与仓库内置正文不一致（线上 ${file.sha256.slice(0, 12)}…/${file.bytes}，仓库 ${digest.slice(0, 12)}…/${data.length}）。`);
    }
  }
  if (drifts.length) {
    console.error('灵码 Skill 清单门禁失败：线上清单与仓库 electron/skill-kit 内容不一致：');
    for (const drift of drifts) console.error(`- ${drift}`);
    console.error('正文唯一真源是仓库内的 skill-kit 快照；后台发布必须按它算 SHA，改正文要同步推进 manifest.json 的 bytes/sha256 与 sequence。');
    process.exit(1);
  }

  console.log(`灵码 Skill 清单门禁通过：sequence ${verified.sequence}，版本 ${verified.release.version}，${verified.release.files.length} 个文件与仓库内置正文逐字一致；签名 keyId ${manifest.keyId}。`);
}

void main();
