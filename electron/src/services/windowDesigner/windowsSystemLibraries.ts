export const WINDOWS_MSVC_SYSTEM_LIBRARIES = [
  'user32.lib',
  'gdi32.lib',
  'comctl32.lib',
  'comdlg32.lib',
  'ole32.lib',
  'oleaut32.lib',
  'shell32.lib',
  'shlwapi.lib',
  'gdiplus.lib',
  'windowscodecs.lib',
  'winhttp.lib',
  'wininet.lib',
  'ws2_32.lib',
  'advapi32.lib',
  'bcrypt.lib',
  'crypt32.lib',
  'odbc32.lib',
  'winmm.lib',
  'oleacc.lib',
  'uxtheme.lib',
  'mfplat.lib',
  'mfplay.lib',
  'mfuuid.lib',
  'delayimp.lib'
] as const;

export function createWindowsMsvcLinkLibraries(additionalLibraries: readonly string[] = []): string[] {
  const libraries = [...WINDOWS_MSVC_SYSTEM_LIBRARIES, ...additionalLibraries];
  const seen = new Set<string>();
  return libraries.filter(library => {
    const key = library.toLocaleLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * requireAdministrator 的直编链接参数：请求 UAC 提权（requestedExecutionLevel=requireAdministrator）。
 * 值不含空格与双引号，可安全穿过 cmd /c call 包装；单引号为链接器要求的取值形式。
 * 与 Visual Studio 导出工程的 <UACExecutionLevel>RequireAdministrator</UACExecutionLevel> 行为一致；
 * 注意 #pragma comment(linker, "/manifestuac:...") 不生效（MSVC 仅支持 pragma 传 manifestdependency），
 * 因此该能力必须在编译/链接调用点显式传参，不能放在生成的 main.cpp 里。
 */
export const REQUIRE_ADMINISTRATOR_LINK_ARGS = ["/MANIFESTUAC:level='requireAdministrator'"] as const;
