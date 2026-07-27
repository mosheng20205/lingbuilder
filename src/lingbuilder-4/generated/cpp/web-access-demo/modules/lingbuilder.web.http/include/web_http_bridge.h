#pragma once

#include <string>
#include <vector>

std::vector<unsigned char> 网页_访问_对象(
    const std::wstring& 网址,
    int 访问方式 = 0,
    const std::wstring& 提交信息 = L"",
    const std::wstring& 提交Cookies = L"",
    const std::wstring& 返回Cookies占位 = L"",
    const std::wstring& 附加协议头 = L"",
    const std::wstring& 返回协议头占位 = L"",
    int 返回状态代码占位 = 0,
    bool 禁止重定向 = false,
    const std::vector<unsigned char>& 字节集提交 = std::vector<unsigned char>(),
    const std::wstring& 代理地址 = L"",
    int 超时 = 15,
    const std::wstring& 代理用户名 = L"",
    const std::wstring& 代理密码 = L"",
    int 代理标识 = 1,
    void* 对象继承 = nullptr,
    bool 是否自动合并更新Cookie = true,
    bool 是否补全必要协议头 = true,
    bool 是否处理协议头大小写 = true);

std::vector<unsigned char> LB_网页_访问_对象_完整(
    const std::wstring& 网址,
    int 访问方式,
    const std::wstring& 提交信息,
    std::wstring* 提交Cookies,
    std::wstring* 返回Cookies,
    const std::wstring& 附加协议头,
    std::wstring* 返回协议头,
    int* 返回状态代码,
    bool 禁止重定向,
    const std::vector<unsigned char>& 字节集提交,
    const std::wstring& 代理地址,
    int 超时,
    const std::wstring& 代理用户名,
    const std::wstring& 代理密码,
    int 代理标识,
    void* 对象继承,
    bool 是否自动合并更新Cookie,
    bool 是否补全必要协议头,
    bool 是否处理协议头大小写);

std::wstring 网页_取返回文本();
std::wstring 网页_取返回Cookies();
std::wstring 网页_取返回协议头();
int 网页_取返回状态代码();
std::wstring 网页_取错误信息();
