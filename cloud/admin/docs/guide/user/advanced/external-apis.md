---
title: 外部 API 调用
---

# 外部 API 调用

> [🕒 预计 25 分钟] | 难度：进阶

LingBuilder 通过 **HTTP 客户端** 模块（模块 ID：`lingbuilder.net.http-client`）调用外部 RESTful API，配合 **JSON 模块** 解析响应数据。两个模块都可在侧边栏 **模块** 组的模块市场中获取；项目还需在 **配置项目所使用模块** 中启用它们。

## 1. 核心命令一览

HTTP 客户端模块采用"客户端 → 请求 → 等待/回调"的函数式风格，常用命令：

| 命令 | 说明 |
|---|---|
| `HTTP客户端_创建客户端` | 创建客户端实例 |
| `HTTP客户端_创建请求` | 基于客户端创建请求 |
| `HTTP客户端_设置请求头` / `HTTP客户端_添加请求头` | 设置请求头 |
| `HTTP客户端_设置文本正文` / `HTTP客户端_设置JSON正文` | 设置请求正文 |
| `HTTP客户端_设置超时` / `HTTP客户端_设置UserAgent` | 客户端级选项 |
| `HTTP客户端_GET异步` / `HTTP客户端_POSTJSON异步` | 异步发起 GET / JSON POST |
| `HTTP客户端_绑定完成处理器` | 绑定请求完成后的处理器 |
| `HTTP客户端_等待请求` | 阻塞等待请求结束（仅非界面场景） |
| `HTTP客户端_取状态码` / `HTTP客户端_取响应文本` | 读取响应状态与内容 |

JSON 模块常用命令：`JSON_解析`、`JSON_取文本`、`JSON_取整数`、`JSON_对象_键列表`、`JSON_序列化`、`JSON_释放` 等。

## 2. 发送异步 GET 请求

```lcpp
事件 按钮_点击()
{
    客户端 = HTTP客户端_创建客户端()

    ' 创建请求并绑定完成处理器
    请求 = HTTP客户端_创建请求(客户端, "https://api.example.com/data")
    HTTP客户端_添加请求头(请求, "Authorization", "Bearer " + 令牌)
    HTTP客户端_绑定完成处理器(请求, &请求完成)
    HTTP客户端_GET异步(客户端, "https://api.example.com/data")
}

事件 请求完成()
{
    状态码 = HTTP客户端_取状态码(客户端)
    正文 = HTTP客户端_取响应文本(客户端)
    调试输出("状态：" + 状态码)
    调试输出("响应：" + 正文)
}
```

> [!IMPORTANT]
> 处理器参数必须使用 `&处理器名` 引用语法（如 `&请求完成`），不要写成带引号的字符串。

## 3. 发送 POST JSON

```lcpp
HTTP客户端_设置JSON正文(请求, "{\"name\":\"LingBuilder\"}")
HTTP客户端_POSTJSON异步(客户端, "https://api.example.com/submit")
```

## 4. 用 JSON 模块解析响应

```lcpp
数据 = JSON_解析(正文)
如果 (JSON_是否有效(数据))
{
    名称 = JSON_取文本(数据, "name", "")
    数量 = JSON_取整数(数据, "count", 0)
    调试输出("名称：" + 名称 + "，数量：" + 数量)
}
JSON_释放(数据)   ' 用完记得释放
```

## 5. 安全建议

- API Key 等敏感信息存放在配置文件中，切勿硬编码到源码。
- 对外部返回的数据先用 `JSON_是否有效`、`JSON_取类型` 做边界校验，防止异常数据导致运行时错误。
- HTTPS 请求请确认目标证书有效；如需自定义证书校验，可使用 `HTTP客户端_设置证书固定`、`HTTP客户端_设置TLS策略`。
- 为客户端设置 `HTTP客户端_设置超时`，避免长时间无响应占用线程。

## 下一步

- 处理常见运行时错误：[问题排查](/guide/user/troubleshooting)
- 优化程序性能：[性能优化](/guide/user/advanced/performance)