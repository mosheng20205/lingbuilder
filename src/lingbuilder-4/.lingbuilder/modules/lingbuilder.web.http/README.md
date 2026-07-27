# 网页访问模块

这个模块把易语言风格的 `网页_访问_对象` 迁移为 LingBuilder v2 模块，底层使用 Windows 自带的 WinHTTP。

推荐选择：

- 当前 Windows/MSVC 闭环：WinHTTP。无需额外 DLL，和“使用 WinHttp 的对象方式访问网页”的原始命令最贴近。
- 以后做跨平台：libcurl 或 cpr。libcurl 能力最全，但需要处理第三方库打包；cpr 更易用，但也是 libcurl 封装。
- 轻量服务端/简单请求：cpp-httplib。单头文件方便，但 HTTPS 仍需要 OpenSSL。
- 协议级异步网络：Boost.Beast。适合底层网络框架，不适合先做易语言命令兼容层。

## 中文命令

```text
网页_访问_对象(网址, 访问方式, 提交信息, 提交Cookies, 返回Cookies, 附加协议头, 返回协议头, 返回状态代码, 禁止重定向, 字节集提交, 代理地址, 超时, 代理用户名, 代理密码, 代理标识, 对象继承, 是否自动合并更新Cookie, 是否补全必要协议头, 是否处理协议头大小写)
```

`访问方式`：0=GET，1=POST，2=HEAD，3=PUT，4=OPTIONS，5=DELETE，6=TRACE，7=CONNECT，8=PATCH。

当前 LingBuilder 生成器对“参考参数回写”还在演进中，所以 `.lcpp` 里建议先用下面的最近一次结果函数读取返回信息：

- `网页_取返回文本()`
- `网页_取返回Cookies()`
- `网页_取返回协议头()`
- `网页_取返回状态代码()`
- `网页_取错误信息()`

## 示例

```text
网页_访问_对象("https://example.com", 0)
调试输出(网页_取返回文本())
调试输出(网页_取返回状态代码())
```

模块源码不依赖第三方二进制文件，`src/web_http_bridge.cpp` 内部通过 `#pragma comment(lib, "winhttp.lib")` 链接系统库。
