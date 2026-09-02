export interface ModulePermitTrustAnchor {
  keyId: string;
  publicKeyPem: string;
}

// 模块 Permit 信任根：与 SDK 下载清单锚点同一硬边界——只能随 IDE 发版更新，
// 禁止任何环境变量、配置文件或云端下发覆盖；服务端轮换密钥时必须先发新版 IDE。
// keyId 口径与云端 module-signing-key.ts 一致：SHA-256(SPKI DER) 前 16 位小写十六进制。
export const MODULE_PERMIT_TRUST_ANCHORS: readonly ModulePermitTrustAnchor[] = [
  {
    keyId: '0e2853e87a4250d3',
    publicKeyPem: [
      '-----BEGIN PUBLIC KEY-----',
      'MCowBQYDK2VwAyEATv6zpZKEs8KGpps5GrjnQXp/Riu8448ne9ARfwadLX4=',
      '-----END PUBLIC KEY-----'
    ].join('\n')
  }
];
