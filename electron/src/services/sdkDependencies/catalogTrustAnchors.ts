// SDK 下载清单信任锚：Ed25519 公钥与 keyId 硬编码在本文件，绝不通过环境变量、
// 配置文件或云端下发覆盖（设计文档 docs/SDK按需下载直链云端配置设计.md §4.1）。
// 云端只持有私钥（SDK_CATALOG_PRIVATE_KEY_PEM / SDK_CATALOG_PUBLIC_KEY_PEM）。
// 生产密钥生成并复核后，把 SPKI 公钥与 SHA-256(SPKI DER) 前 16 位 keyId 追加到下方数组。
// 空数组表示远端清单功能未启用，IDE 始终使用内置清单（安全的默认状态）。
// 换锚（密钥轮换）必须先更新本文件并随 IDE 发版，不得提前切换云端签发密钥。
// 当前锚点为生产签发密钥（2026-09-01 于 api 容器生成并逐字固化，线上 sequence 2 清单已用其签名并通过门禁）。
export interface SdkCatalogTrustAnchor {
  keyId: string;
  publicKeyPem: string;
}

export const SDK_CATALOG_TRUST_ANCHORS: readonly SdkCatalogTrustAnchor[] = [
  {
    keyId: '450c46062258e2d4',
    publicKeyPem: '-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAOvytnURNm5lDesqbVUFy3wEXC8NNrYPkquB63VRICMw=\n-----END PUBLIC KEY-----'
  }
];
