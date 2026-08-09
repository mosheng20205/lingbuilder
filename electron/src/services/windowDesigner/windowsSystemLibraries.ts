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
