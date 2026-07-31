# FBro API 覆盖清单

确定性基线：FBro 5.38.49、CEF 135.0.21、windows-msvc-x64。火山 `.v` 二进制工程只用于火山 IDE 抽样核对，不参与本清单生成。

- 公共头文件：77
- 导出签名：1079
- 高层封装：56
- 高级安全封装：1020（已实现 162，待实现 857）
- 内部/生命周期项：3

- 官方事件签名：158
- 已接通 LingBuilder 事件：9

| 模块 ID | 中文能力域 | 签名数 |
|---|---:|---:|
| `lingbuilder.fbro.automation` | 自动化 | 247 |
| `lingbuilder.fbro.browser` | 浏览器 | 73 |
| `lingbuilder.fbro.events` | 事件 | 56 |
| `lingbuilder.fbro.network` | 网络 | 145 |
| `lingbuilder.fbro.objects` | 高级对象 | 268 |
| `lingbuilder.fbro.osr` | 离屏渲染 | 46 |
| `lingbuilder.fbro.session` | 会话 | 24 |
| `lingbuilder.fbro.transfer` | 传输 | 32 |
| `lingbuilder.fbro.vip` | 指纹 | 188 |

逐签名稳定 ID、SHA-256、官方英文别名、中文主名称、分类、实现状态和理由位于 `electron/src/services/modules/fbroApiCoverage.generated.json`。
