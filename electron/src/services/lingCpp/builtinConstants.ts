import { normalizeIdentifier } from './parser';

/**
 * 内置系统常量：语言层开箱自带的 #常量，不依赖项目常量表或模块清单。
 * C++ 生成（物化声明）、补全、悬停、常量引用诊断共用这张表；
 * 项目常量与模块常量同名时遮蔽内置常量（解析口径与项目常量遮蔽模块常量一致）。
 */
export interface LingCppBuiltinConstant {
  name: string;
  type: '文本型' | '整数型' | '逻辑型';
  /** 真实值（文本型可含真实控制字符），供 C++ 生成物化编译期常量声明。 */
  value: string | number | boolean;
  description: string;
}

export const LING_CPP_BUILTIN_CONSTANTS: readonly LingCppBuiltinConstant[] = [
  {
    name: '换行符',
    type: '文本型',
    value: '\r\n',
    description: '回车+换行（CRLF，共 2 个字符），与易语言 #换行符 同义。例：控件_设置文本(编辑框1, "第一行"+#换行符+"第二行")。'
  }
];

/** 收集内置常量；reservedNames 中的同名常量（项目常量/模块常量）遮蔽内置常量，不再下发。 */
export function getBuiltinLingCppConstants(reservedNames?: ReadonlySet<string>): LingCppBuiltinConstant[] {
  return LING_CPP_BUILTIN_CONSTANTS.filter(constant => !reservedNames?.has(normalizeIdentifier(constant.name)));
}

/** 内置常量值的中文展示形态：文本型转义控制字符（与生成端 escapeWideString 同表），其余原样。 */
export function formatBuiltinConstantDisplayValue(constant: LingCppBuiltinConstant): string {
  if (typeof constant.value !== 'string') return String(constant.value);
  return `"${constant.value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r/g, '\\r').replace(/\n/g, '\\n').replace(/\t/g, '\\t')}"`;
}
