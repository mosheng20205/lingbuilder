export const MODULE_GENERATION_MAX_REQUIREMENT_LENGTH = 8000;

export function sanitizeModuleRequirement(value: unknown): { ok: boolean; text: string; error?: string } {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return { ok: false, text: '', error: '请先用中文描述你想生成的模块需求。' };
  if (text.length > MODULE_GENERATION_MAX_REQUIREMENT_LENGTH) {
    return { ok: false, text: '', error: `模块需求描述过长（${text.length} 字），请控制在 ${MODULE_GENERATION_MAX_REQUIREMENT_LENGTH} 字以内。` };
  }
  return { ok: true, text };
}

export function buildModuleGenerationMessages(requirement: string, spec: string): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = [
    '你是 LingBuilder 模块生成助手，负责根据中文需求生成可直接导入 LingBuilder IDE 的 .lbmod 模块项目文件。',
    '输出必须严格遵循《LingBuilder 模块开发规范》的输出契约：每个文件用“### 文件：<相对路径>”标题开头，标题下用围栏代码块给出完整文件内容；第一个文件必须是 lingbuilder.module.json（manifest v2）。',
    '回复的第一行必须直接是「### 文件：lingbuilder.module.json」标题。禁止输出任何需求分析、计划、思考过程、解释、道歉或总结——这些内容会浪费输出预算并导致文件被截断。',
    '所有文件的围栏代码块必须完整闭合，输出必须以最后一个闭合的代码块结束；宁可通过精简的文档与示例控制篇幅，也不能让任何文件写到一半被截断。',
    '所有中文命令必须同时登记 contributes.commands 与 bindings.commands，命令参数语义必须使用正确的 binding 值类型（控件引用参数必须是 controlRef 且在源码中使用裸控件标识符）。',
    '每份模块必须登记真实、非空的中文模块文档（contributes.docs）与可运行示例（contributes.examples）。',
    '当前模型能力无法满足的需求，必须只输出一个 module-build-errors.md 文件，用中文说明缺失的能力与建议的需求拆分方案，不得编造不存在的命令或运行时。'
  ].join('\n');
  const userPrompt = [
    '以下是《LingBuilder 模块开发规范》全文，生成结果必须严格遵守：',
    '<<<LINGBUILDER_MODULE_SPEC',
    spec,
    'LINGBUILDER_MODULE_SPEC>>>',
    '',
    '请根据以下中文需求生成完整模块文件（再次强调：直接从「### 文件：lingbuilder.module.json」开始输出，不要输出任何分析文字）：',
    '<<<REQUIREMENT',
    requirement,
    'REQUIREMENT>>>'
  ].join('\n');
  return { systemPrompt, userPrompt };
}

export function buildModuleParseRetryRequirement(requirement: string, reason: string): string {
  return [
    requirement,
    '',
    `【重试要求】上一轮回复未通过输出契约解析（${reason}）。请重新生成，并严格遵守：`,
    '1. 回复第一行必须是「### 文件：lingbuilder.module.json」；',
    '2. 除「### 文件：<相对路径>」标题和围栏代码块外，不得输出任何分析、计划或说明文字；',
    '3. 每个代码块必须用 ``` 完整闭合，不得中途截断；文档和示例可以精简，但必须真实、非空。'
  ].join('\n');
}

const MODULE_OUTPUT_CONTRACT_RULES = [
  '输出必须严格遵循《LingBuilder 模块开发规范》的输出契约：每个文件用“### 文件：<相对路径>”标题开头，标题下用围栏代码块给出完整文件内容。',
  '除「### 文件：<相对路径>」标题与围栏代码块外，不得输出任何需求分析、计划、思考过程、解释、道歉或总结。',
  '所有围栏代码块必须完整闭合；输出预算有限，文档与示例务必精简但必须真实、非空。',
  '所有中文命令必须同时登记 contributes.commands 与 bindings.commands，命令参数语义必须使用正确的 binding 值类型（控件引用参数必须是 controlRef 且在源码中使用裸控件标识符）。',
  '当前模型能力无法满足的需求，必须只输出一个 module-build-errors.md 文件，用中文说明缺失的能力与建议的需求拆分方案，不得编造不存在的命令或运行时。'
];

export function buildModuleManifestPhaseMessages(requirement: string, spec: string): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = [
    '你是 LingBuilder 模块生成助手。本次任务分多阶段完成，本轮【只输出一个文件】：lingbuilder.module.json（manifest v2）。',
    ...MODULE_OUTPUT_CONTRACT_RULES
  ].join('\n');
  const userPrompt = [
    '以下是《LingBuilder 模块开发规范》全文，生成结果必须严格遵守：',
    '<<<LINGBUILDER_MODULE_SPEC',
    spec,
    'LINGBUILDER_MODULE_SPEC>>>',
    '',
    '请根据以下中文需求，只生成模块清单文件（本轮不要输出头文件、源码、文档或示例的实际内容）：',
    '<<<REQUIREMENT',
    requirement,
    'REQUIREMENT>>>',
    '',
    '清单要求：',
    '1. 第一行直接是「### 文件：lingbuilder.module.json」；',
    '2. schemaVersion 为 2，contributes.commands 与 bindings.commands 一一对应且完整；',
    '3. targets 按需求选择平台并登记 includeDirs/headers/sources/libs/runtimeFiles（相对路径，后续阶段会提供这些文件的内容）；',
    '4. contributes.docs 与 contributes.examples 登记精简的中文文档与示例路径（如 docs/usage.md、examples/demo.lcpp）。'
  ].join('\n');
  return { systemPrompt, userPrompt };
}

export function buildModuleFilesPhaseMessages(requirement: string, manifestJson: string, spec: string): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = [
    '你是 LingBuilder 模块生成助手。模块清单（lingbuilder.module.json）已生成，本轮【输出其余全部文件】：清单 targets 登记的头文件与源码、contributes.docs 与 contributes.examples 对应的内容。本轮不得再输出 lingbuilder.module.json。',
    ...MODULE_OUTPUT_CONTRACT_RULES
  ].join('\n');
  const userPrompt = [
    '以下是《LingBuilder 模块开发规范》全文，生成结果必须严格遵守：',
    '<<<LINGBUILDER_MODULE_SPEC',
    spec,
    'LINGBUILDER_MODULE_SPEC>>>',
    '',
    '模块需求：',
    '<<<REQUIREMENT',
    requirement,
    'REQUIREMENT>>>',
    '',
    '已生成的模块清单（文件路径与命令 binding 以它为准，必须完整实现其中登记的头文件、源码、文档与示例）：',
    '<<<MANIFEST',
    manifestJson,
    'MANIFEST>>>',
    '',
    '要求：',
    '1. 每个登记文件一个「### 文件：<相对路径>」段落，路径与清单登记完全一致；',
    '2. C++ 桥接源码按清单 bindings.commands 逐命令实现中文命令的运行时函数；',
    '3. 中文文档精简（不超过 40 行），示例保持短小可运行。'
  ].join('\n');
  return { systemPrompt, userPrompt };
}

export function buildModuleMissingFilesPhaseMessages(requirement: string, manifestJson: string, missingPaths: string[], spec: string): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = [
    '你是 LingBuilder 模块生成助手。模块清单与其余文件已生成完毕，本轮【只补全下列缺失文件】：每个路径一个「### 文件：<路径>」段落与完整围栏代码块，路径必须与要求完全一致。不得输出清单或其它文件。',
    ...MODULE_OUTPUT_CONTRACT_RULES
  ].join('\n');
  const userPrompt = [
    '以下是《LingBuilder 模块开发规范》全文，生成结果必须严格遵守：',
    '<<<LINGBUILDER_MODULE_SPEC',
    spec,
    'LINGBUILDER_MODULE_SPEC>>>',
    '',
    '模块需求：',
    '<<<REQUIREMENT',
    requirement,
    'REQUIREMENT>>>',
    '',
    '已生成的模块清单（命令语义与 C++ 运行时函数名以它为准）：',
    '<<<MANIFEST',
    manifestJson,
    'MANIFEST>>>',
    '',
    '本轮必须补全的文件（逐个输出，路径完全一致，内容真实、非空）：',
    missingPaths.map(p => `- ${p}`).join('\n')
  ].join('\n');
  return { systemPrompt, userPrompt };
}
