# 密码哈希与派生模块完整演示

- 模块 ID：`lingbuilder.crypto.password`
- 版本：`1.0.0`
- 类型：LingBuilder 内置模块
- 命令数：9
- 设计器控件数：0
- 分组数：1

## 使用方式

打开项目后按标签页查看命令分组。源码默认只展示并记录，不执行有副作用的调用；确认演示参数和运行环境后，勾选“允许实际执行”再点击对应分组按钮。

每条命令在 `MainWindow.lcpp` 中包含签名、功能、参数、返回类型和真实调用；结构化清单位于 `模块命令清单.json`。

## 模块说明

提供自描述格式的 Argon2id、scrypt、bcrypt 与 PBKDF2-SHA256 密码哈希及恒定时间验证。

## 命令清单

| # | 命令 | 签名 | 返回 | 说明 |
|---:|---|---|---|---|
| 1 | `密码_Argon2id哈希` | `密码_Argon2id哈希(密码, 内存KB, 迭代次数, 并行度)` | wideString | 生成标准 PHC 格式的 Argon2id 密码哈希。 |
| 2 | `密码_Argon2id验证` | `密码_Argon2id验证(密码, 已保存哈希)` | bool | 恒定时间验证 Argon2id PHC 哈希。 |
| 3 | `密码_scrypt哈希` | `密码_scrypt哈希(密码, N, r, p)` | wideString | 生成包含全部参数和随机盐的 scrypt PHC 哈希。 |
| 4 | `密码_scrypt验证` | `密码_scrypt验证(密码, 已保存哈希)` | bool | 恒定时间验证 scrypt PHC 哈希。 |
| 5 | `密码_bcrypt哈希` | `密码_bcrypt哈希(密码, 成本)` | wideString | 生成标准 bcrypt 密码哈希。 |
| 6 | `密码_bcrypt验证` | `密码_bcrypt验证(密码, 已保存哈希)` | bool | 验证 bcrypt 密码哈希。 |
| 7 | `密码_PBKDF2_SHA256哈希` | `密码_PBKDF2_SHA256哈希(密码, 迭代次数)` | wideString | 生成带随机盐的 PBKDF2-HMAC-SHA256 自描述哈希。 |
| 8 | `密码_PBKDF2_SHA256验证` | `密码_PBKDF2_SHA256验证(密码, 已保存哈希)` | bool | 恒定时间验证 PBKDF2-HMAC-SHA256 哈希。 |
| 9 | `密码_取错误` | `密码_取错误()` | wideString | 读取最近一次密码哈希或验证失败的中文错误。 |
