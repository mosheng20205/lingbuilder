/**
 * 灵码 Skill 清单信任锚：Ed25519 公钥与 keyId 硬编码在本文件，绝不通过环境变量、
 * 配置文件或云端下发覆盖；换锚必须改本文件并随 IDE 发版。
 *
 * 这里刻意与 SDK 下载清单共用同一把生产签发密钥（云端 SDK_CATALOG_PRIVATE_KEY_PEM /
 * SDK_CATALOG_PUBLIC_KEY_PEM），这样轮换一次密钥两个清单同时生效，不会出现"一个清单已换锚、
 * 另一个还在用旧锚"的半新半旧状态。两处公钥必须逐字相同，由 tests/skillCatalogRemote.test.ts
 * 的锚点一致性用例把守（本文件不能直接 import src/**：electron 主进程 tsconfig 的 rootDir 限制）。
 *
 * 两个清单的签名消息域名不同（lingbuilder-sdk-catalog-v1 / lingbuilder-skill-catalog-v1），
 * 同一签名不能跨清单复用。
 */
export interface SkillCatalogTrustAnchor {
  keyId: string;
  publicKeyPem: string;
}

export const SKILL_CATALOG_TRUST_ANCHORS: readonly SkillCatalogTrustAnchor[] = [
  {
    keyId: '450c46062258e2d4',
    publicKeyPem: '-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAOvytnURNm5lDesqbVUFy3wEXC8NNrYPkquB63VRICMw=\n-----END PUBLIC KEY-----'
  }
];
