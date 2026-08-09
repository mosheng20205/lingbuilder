# CEF3 API 安全覆盖清单

> 自动生成，请勿手工编辑。基线：CEF 150.0.14+g7c1aa68+chromium-150.0.7871.129 / Chromium 150 / Windows MSVC x64。

- 扫描头文件：287
- C API 头文件：105
- 覆盖记录：1577
- 公开能力记录：1384
- 已记录排除头：64

## 状态

| 状态 | 数量 |
| --- | ---: |
| implemented | 1384 |
| internal | 8 |
| notApplicable | 185 |

## 中文复核

| 状态 | 数量 |
| --- | ---: |
| notRequired | 193 |
| translated | 1384 |

## 模块分布

| 模块 | 签名数 |
| --- | ---: |
| `lingbuilder.cef3.automation` | 219 |
| `lingbuilder.cef3.browser` | 94 |
| `lingbuilder.cef3.devtools` | 5 |
| `lingbuilder.cef3.events` | 113 |
| `lingbuilder.cef3.network` | 199 |
| `lingbuilder.cef3.objects` | 190 |
| `lingbuilder.cef3.osr` | 54 |
| `lingbuilder.cef3.platform` | 324 |
| `lingbuilder.cef3.session` | 18 |
| `lingbuilder.cef3.transfer` | 100 |
| `lingbuilder.cef3.views` | 261 |

完整机器可读目录位于 `electron/src/services/modules/cef3ApiCoverage.generated.json`。只有 `npm run module:cef3-coverage:complete` 通过后，才允许宣称 CEF3 安全全覆盖完成。
