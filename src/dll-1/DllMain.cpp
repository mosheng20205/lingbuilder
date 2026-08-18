#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include "include/DllExports.h"

// dll-1 的最小 DLL 入口。业务 API 应继续使用 C ABI 和调用方拥有的缓冲区。
BOOL APIENTRY DllMain(HMODULE module, DWORD reason, LPVOID reserved) {
  (void)module;
  (void)reason;
  (void)reserved;
  return TRUE;
}

extern "C" LINGBUILDER_DLL_API int LingBuilder_GetApiVersion() noexcept {
  return 1;
}
