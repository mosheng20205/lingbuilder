#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include "include/DllExports.h"

// dll-export-test 的最小 DLL 入口。业务 API 应继续使用 C ABI 和调用方拥有的缓冲区。
BOOL APIENTRY DllMain(HMODULE module, DWORD reason, LPVOID reserved) {
  (void)module;
  (void)reason;
  (void)reserved;
  return TRUE;
}

extern "C" LINGBUILDER_DLL_API int LingBuilder_GetApiVersion() noexcept {
  // 该返回值由 DllApi.lcpp 中的“获取接口版本”过程确定性生成。
  return 1;
}
