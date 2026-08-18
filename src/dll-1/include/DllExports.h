#pragma once

// LingBuilder DLL 的公开 C ABI。导出名由 exports.def 统一维护，调用方只依赖稳定的标量类型。
#if defined(_WINDLL)
#define LINGBUILDER_DLL_API
#else
#define LINGBUILDER_DLL_API __declspec(dllimport)
#endif

extern "C" LINGBUILDER_DLL_API int LingBuilder_GetApiVersion() noexcept;
