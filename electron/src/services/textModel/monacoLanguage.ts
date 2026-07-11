/**
 * Maps workbench file-language identifiers to the Monaco languages that are
 * bundled locally. Keep aliases here so file discovery and the editor cannot
 * silently disagree about header/resource files.
 */
export function mapWorkbenchLanguageToMonaco(language: string): string {
  const normalized = language.trim().toLowerCase();
  if (normalized === 'epl') return 'epl';
  if (normalized === 'lingcpp' || normalized === 'lcpp') return 'lingcpp';
  if (normalized === 'cpp' || normalized === 'c++' || normalized === 'h' || normalized === 'header') return 'cpp';
  if (normalized === 'rc' || normalized === 'resource' || normalized === 'ini') return 'ini';
  return 'plaintext';
}
