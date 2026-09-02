import path from 'node:path';
export const MODULE_INSTALL_EVENT = 'lingbuilder:install-module-package';
export const isLbmodPath = (value: string) => path.extname(value).toLowerCase() === '.lbmod';
export const findLbmodArgument = (argv: readonly string[]) => argv.slice(1).find(value => value && !value.startsWith('-') && isLbmodPath(value));
export const hasLbmodFileAssociation = (value: any) => Array.isArray(value?.build?.fileAssociations) && value.build.fileAssociations.some((item: any) => item?.ext === 'lbmod');
