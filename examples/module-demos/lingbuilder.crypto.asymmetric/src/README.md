# 非对称密码模块完整演示

- 模块 ID：`lingbuilder.crypto.asymmetric`
- 版本：`1.0.0`
- 类型：LingBuilder 内置模块
- 命令数：27
- 设计器控件数：0
- 分组数：2

## 使用方式

打开项目后按标签页查看命令分组。源码默认只展示并记录，不执行有副作用的调用；确认演示参数和运行环境后，勾选“允许实际执行”再点击对应分组按钮。

每条命令在 `MainWindow.lcpp` 中包含签名、功能、参数、返回类型和真实调用；结构化清单位于 `模块命令清单.json`。

## 模块说明

提供 RSA、ECDSA P-256、ECDH P-256、X25519、SM2 和 ElGamal 的密钥、加密、签名或协商能力。私钥使用 PKCS#8 PEM，公钥使用 X.509 PEM。

## 命令清单

| # | 命令 | 签名 | 返回 | 说明 |
|---:|---|---|---|---|
| 1 | `非对称_RSA生成私钥` | `非对称_RSA生成私钥(位数)` | wideString | 生成 RSA PKCS#8 PEM 私钥。 |
| 2 | `非对称_RSA取公钥` | `非对称_RSA取公钥(私钥PEM)` | wideString | 从 RSA 私钥导出 X.509 PEM 公钥。 |
| 3 | `非对称_RSA_OAEP_SHA256加密` | `非对称_RSA_OAEP_SHA256加密(明文, 公钥PEM)` | wideString | 使用 RSA-OAEP(SHA-256) 加密短文本并返回 Base64。 |
| 4 | `非对称_RSA_OAEP_SHA256解密` | `非对称_RSA_OAEP_SHA256解密(Base64密文, 私钥PEM)` | wideString | 使用 RSA-OAEP(SHA-256) 解密短文本。 |
| 5 | `非对称_RSA_PSS_SHA256签名` | `非对称_RSA_PSS_SHA256签名(文本, 私钥PEM)` | wideString | 使用 RSA-PSS(SHA-256) 签名并返回 Base64。 |
| 6 | `非对称_RSA_PSS_SHA256验签` | `非对称_RSA_PSS_SHA256验签(文本, Base64签名, 公钥PEM)` | bool | 验证 RSA-PSS(SHA-256) 签名。 |
| 7 | `非对称_ECDSA_P256生成私钥` | `非对称_ECDSA_P256生成私钥()` | wideString | 生成 ECDSA secp256r1 PKCS#8 PEM 私钥。 |
| 8 | `非对称_ECDSA_P256取公钥` | `非对称_ECDSA_P256取公钥(私钥PEM)` | wideString | 从 ECDSA P-256 私钥导出公钥。 |
| 9 | `非对称_ECDSA_P256签名` | `非对称_ECDSA_P256签名(文本, 私钥PEM)` | wideString | 使用 ECDSA P-256 与 SHA-256 签名。 |
| 10 | `非对称_ECDSA_P256验签` | `非对称_ECDSA_P256验签(文本, Base64签名, 公钥PEM)` | bool | 验证 ECDSA P-256/SHA-256 签名。 |
| 11 | `非对称_SM2生成私钥` | `非对称_SM2生成私钥()` | wideString | 生成 SM2 P-256 PKCS#8 PEM 私钥。 |
| 12 | `非对称_SM2取公钥` | `非对称_SM2取公钥(私钥PEM)` | wideString | 从 SM2 私钥导出公钥。 |
| 13 | `非对称_SM2加密` | `非对称_SM2加密(明文, 公钥PEM)` | wideString | 使用 SM2/SM3 加密文本并返回 Base64。 |
| 14 | `非对称_SM2解密` | `非对称_SM2解密(Base64密文, 私钥PEM)` | wideString | 使用 SM2/SM3 解密文本。 |
| 15 | `非对称_SM2签名` | `非对称_SM2签名(文本, 私钥PEM, 用户标识)` | wideString | 使用 SM2/SM3 签名。 |
| 16 | `非对称_SM2验签` | `非对称_SM2验签(文本, Base64签名, 公钥PEM, 用户标识)` | bool | 验证 SM2/SM3 签名。 |
| 17 | `非对称_ECDH_P256生成私钥` | `非对称_ECDH_P256生成私钥()` | wideString | 生成 ECDH secp256r1 私钥。 |
| 18 | `非对称_ECDH_P256取公钥` | `非对称_ECDH_P256取公钥(私钥PEM)` | wideString | 导出 ECDH P-256 公钥。 |
| 19 | `非对称_ECDH_P256协商` | `非对称_ECDH_P256协商(本方私钥PEM, 对方公钥PEM)` | wideString | 执行 ECDH P-256 并经 HKDF-SHA256 导出 32 字节共享密钥十六进制。 |
| 20 | `非对称_X25519生成私钥` | `非对称_X25519生成私钥()` | wideString | 生成 X25519 私钥。 |
| 21 | `非对称_X25519取公钥` | `非对称_X25519取公钥(私钥PEM)` | wideString | 导出 X25519 公钥。 |
| 22 | `非对称_X25519协商` | `非对称_X25519协商(本方私钥PEM, 对方公钥PEM)` | wideString | 执行 X25519 并经 HKDF-SHA256 导出 32 字节共享密钥十六进制。 |
| 23 | `非对称_ElGamal生成私钥` | `非对称_ElGamal生成私钥(位数)` | wideString | 生成 ElGamal PKCS#8 PEM 私钥；仅用于兼容。 |
| 24 | `非对称_ElGamal取公钥` | `非对称_ElGamal取公钥(私钥PEM)` | wideString | 从 ElGamal 私钥导出公钥。 |
| 25 | `非对称_ElGamal加密` | `非对称_ElGamal加密(明文, 公钥PEM)` | wideString | 使用 ElGamal/OAEP(SHA-256) 加密短文本；仅用于兼容。 |
| 26 | `非对称_ElGamal解密` | `非对称_ElGamal解密(Base64密文, 私钥PEM)` | wideString | 解密 ElGamal/OAEP(SHA-256) 密文；仅用于兼容。 |
| 27 | `非对称_取错误` | `非对称_取错误()` | wideString | 读取最近一次非对称操作失败的中文错误。 |
