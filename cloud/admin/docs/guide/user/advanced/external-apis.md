---
title: 外部 API 调用
---

# 外部 API 调用

> [🕒 预计 25 分钟] | 难度：进阶

LingBuilder 支持通过 `network-http` 模块调用外部 RESTful API。本项目需先在 **模块市场** 中安装 `network-http` 模块。

## 1. 发送 GET 请求

```lcpp
导入 lingbuilder.network.http

程序_启动()
{
    网络请求 请求 = 新建 网络请求("https://api.example.com/data")
    请求.添加请求头("Content-Type", "application/json")
    请求.添加请求头("Authorization", "Bearer " + 令牌)
    网络响应 响应 = 请求.获取()
    调试输出(响应.状态码 + " " + 响应.正文)
}
```

## 2. 发送 POST 请求

```lcpp
导入 lingbuilder.network.http

程序_启动()
{
    网络请求 请求 = 新建 网络请求("https://api.example.com/submit")
    请求.设置方法(请求方法.POST)
    请求.设置正文("{\"name\":\"LingBuilder\"}")
    网络响应 响应 = 请求.发送()
    调试输出(响应.正文)
}
```

## 3. JSON 解析

配合 `json-utils` 模块解析响应数据：

```lcpp
导入 lingbuilder.json

程序_启动()
{
    文本 正文 = 响应.正文
    JSON对象 数据 = JSON解析(正文)
    文本 名称 = 数据.取文本("name", "")
    整数 数量 = 数据.取整数("count", 0)
    调试输出("名称：" + 名称 + "，数量：" + 数量)
}
```

## 4. 异步调用与进度提示

长时间请求建议采用异步模式，避免界面卡顿：

```lcpp
程序_启动()
{
    网络请求 请求 = 新建 网络请求("https://api.example.com/large-data")
    请求.完成事件 = 处理函数(网络响应 响应)
    {
        调试输出("请求完成：" + 响应.正文.长度)
    }
    请求.开始异步()
    调试输出("已启动异步请求")
}
```

## 5. 安全建议

- API Key 等敏感信息存放在配置文件中，切勿硬编码到源码。
- 对外部返回的数据做好**边界校验**，防止异常数据导致运行时错误。
- HTTPS 请求请确认目标证书有效，避免中间人攻击。

## 下一步

- 处理常见运行时错误：[问题排查](/guide/user/troubleshooting)
- 优化程序性能：[性能优化](/guide/user/advanced/performance)