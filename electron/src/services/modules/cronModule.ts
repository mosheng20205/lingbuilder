import {
  LingBuilderModuleManifest,
  ModuleCommandBinding,
  ModuleCommandBindingParameter,
  ModuleCommandContribution
} from './types';

interface CronCommandSpec {
  name: string;
  signature: string;
  description: string;
  parameters: ModuleCommandBindingParameter[];
  returnType: string;
  returnLabel: string;
  category: string;
  insertText?: string;
  example?: string;
}

const parameter = (name: string, type: ModuleCommandBindingParameter['type'], description: string): ModuleCommandBindingParameter => ({ name, type, description });
const optionalPath = (description: string): ModuleCommandBindingParameter => ({ name: '路径', type: 'wideString', optional: true, defaultValue: '', description });

// 处理器签名契约与 cronRuntime.ts 的生成派发一一对应：到点/完成处理器收 定时任务 参数，
// 工作处理器无参数；语言服务按该契约校验 &处理器 引用。
const fireHandlerArg = '必须使用 &处理器名；到点后在注册窗口的 UI 线程执行，签名必须是 空 处理器(定时任务 任务)。';
const workerHandlerArg = '必须使用 &处理器名；在 cron 后台线程执行，无参数无返回值，禁止调用任何 UI/controlRef 命令，界面更新放到完成处理器。';
const completionHandlerArg = '必须使用 &处理器名；在注册窗口的 UI 线程执行，签名必须是 空 处理器(定时任务 任务)。';
const taskArg = 'cron_定时_启动 或 cron_定时_提交线程 返回的定时任务 ID；任务不存在或已停止时命令按说明返回失败值。';
const expressionArg = 'cron 表达式：五段「分 时 日 月 周」或六段「秒 分 时 日 月 周」，支持 * 、逗号列表、a-b 区间、a-b/n 步进、*/n 以及 @yearly/@monthly/@weekly/@daily/@hourly/@reboot 简写；月与周可用 JAN~DEC、SUN~SAT 英文名；日与周同时受限时命中其一即触发（标准 cron 语义）。';
const tablePathArg = 'crontab 表文件完整路径；留空表示系统默认表 %APPDATA%\\LingBuilder\\cron\\crontab.txt（按 Windows 用户隔离，所有应用共用）。';

const specs: CronCommandSpec[] = [
  { name: 'cron_定时_启动', signature: 'cron_定时_启动(表达式, &处理器)', description: '按 cron 表达式注册周期任务；到点后在注册窗口 UI 线程执行处理器，窗口关闭时任务自动停止。', parameters: [parameter('表达式', 'wideString', expressionArg), parameter('处理器', 'handler', fireHandlerArg)], returnType: 'longLong', returnLabel: '定时任务', category: '调度', insertText: 'cron_定时_启动("*/5 * * * *", &$2)', example: '定时任务 任务 = cron_定时_启动("*/5 * * * *", &检查更新)' },
  { name: 'cron_定时_提交线程', signature: 'cron_定时_提交线程(表达式, &工作处理器, &完成处理器)', description: '按 cron 表达式注册周期任务；到点后在 cron 后台线程执行工作处理器，结束后在注册窗口 UI 线程执行完成处理器。', parameters: [parameter('表达式', 'wideString', expressionArg), parameter('工作处理器', 'handler', workerHandlerArg), parameter('完成处理器', 'handler', completionHandlerArg)], returnType: 'longLong', returnLabel: '定时任务', category: '调度', insertText: 'cron_定时_提交线程("0 2 * * *", &$2, &$3)', example: '定时任务 任务 = cron_定时_提交线程("0 2 * * *", &夜间备份, &备份完成)' },
  { name: 'cron_定时_停止', signature: 'cron_定时_停止(任务)', description: '停止指定的定时任务；正在执行中的本轮触发不会被中断。', parameters: [parameter('任务', 'longLong', taskArg)], returnType: 'bool', returnLabel: '逻辑型', category: '调度' },
  { name: 'cron_定时_停止全部', signature: 'cron_定时_停止全部()', description: '停止当前进程内全部定时任务（含从 crontab 表载入的命令型任务），返回停止数量。', parameters: [], returnType: 'int', returnLabel: '整数型', category: '调度' },
  { name: 'cron_定时_暂停', signature: 'cron_定时_暂停(任务)', description: '暂停指定任务的时间匹配；已暂停期间到点的触发不会被补发，恢复后从当前时间重新计算下次触发。', parameters: [parameter('任务', 'longLong', taskArg)], returnType: 'bool', returnLabel: '逻辑型', category: '调度' },
  { name: 'cron_定时_恢复', signature: 'cron_定时_恢复(任务)', description: '恢复已暂停的任务，并从当前时间重新计算下次触发时间。', parameters: [parameter('任务', 'longLong', taskArg)], returnType: 'bool', returnLabel: '逻辑型', category: '调度' },
  { name: 'cron_定时_是否运行', signature: 'cron_定时_是否运行(任务)', description: '判断任务是否存在且处于等待触发状态（未暂停、未停止）。', parameters: [parameter('任务', 'longLong', taskArg)], returnType: 'bool', returnLabel: '逻辑型', category: '调度' },
  { name: 'cron_定时_取状态', signature: 'cron_定时_取状态(任务)', description: '返回任务状态的中文说明：等待中、已暂停、已停止或不存在。', parameters: [parameter('任务', 'longLong', taskArg)], returnType: 'wideString', returnLabel: '文本型', category: '调度' },
  { name: 'cron_定时_下次触发时间', signature: 'cron_定时_下次触发时间(任务)', description: '返回任务下次触发的本地时间（格式 2026-09-21 18:30:00）；已暂停、已停止或不存在时返回空文本。', parameters: [parameter('任务', 'longLong', taskArg)], returnType: 'wideString', returnLabel: '文本型', category: '调度' },
  { name: 'cron_定时_立即触发', signature: 'cron_定时_立即触发(任务)', description: '立刻按该任务的注册方式触发一次，不影响其原有周期。', parameters: [parameter('任务', 'longLong', taskArg)], returnType: 'bool', returnLabel: '逻辑型', category: '调度' },
  { name: 'cron_定时_校验表达式', signature: 'cron_定时_校验表达式(表达式)', description: '校验 cron 表达式是否合法；具体原因用 cron_定时_取表达式错误 查询。', parameters: [parameter('表达式', 'wideString', expressionArg)], returnType: 'bool', returnLabel: '逻辑型', category: '表达式' },
  { name: 'cron_定时_取表达式错误', signature: 'cron_定时_取表达式错误(表达式)', description: '返回表达式的中文错误说明；表达式合法时返回空文本。', parameters: [parameter('表达式', 'wideString', expressionArg)], returnType: 'wideString', returnLabel: '文本型', category: '表达式' },
  { name: 'cron_定时_表达式说明', signature: 'cron_定时_表达式说明(表达式)', description: '把 cron 表达式翻译成人话（例如「每 5 分钟」「每天 02:00」）；表达式非法时返回空文本。', parameters: [parameter('表达式', 'wideString', expressionArg)], returnType: 'wideString', returnLabel: '文本型', category: '表达式' },
  { name: 'cron_定时_取任务数量', signature: 'cron_定时_取任务数量()', description: '返回当前进程内未停止的定时任务数量（含表载入的命令型任务）。', parameters: [], returnType: 'int', returnLabel: '整数型', category: '调度' },
  { name: 'cron_定时_取错误', signature: 'cron_定时_取错误()', description: '返回最近一次 cron 模块操作失败的中文原因；无失败时返回空文本。', parameters: [], returnType: 'wideString', returnLabel: '文本型', category: '调度' },

  { name: 'cron_定时_表路径', signature: 'cron_定时_表路径()', description: '返回系统默认 crontab 表文件的完整路径（目录不存在时会自动创建）。', parameters: [], returnType: 'wideString', returnLabel: '文本型', category: 'crontab表' },
  { name: 'cron_定时_表读取', signature: 'cron_定时_表读取(路径)', description: '读取 crontab 表文件全部内容；文件不存在时返回空文本。', parameters: [optionalPath(tablePathArg)], returnType: 'wideString', returnLabel: '文本型', category: 'crontab表' },
  { name: 'cron_定时_表保存', signature: 'cron_定时_表保存(内容, 路径)', description: '把内容整体写入 crontab 表文件（UTF-8，覆盖保存）；目录不存在会自动创建。', parameters: [parameter('内容', 'wideString', '完整的表文件内容；建议先 cron_定时_表读取 后在其基础上修改，再整体保存。'), optionalPath(tablePathArg)], returnType: 'bool', returnLabel: '逻辑型', category: 'crontab表' },
  { name: 'cron_定时_表添加', signature: 'cron_定时_表添加(表达式, 命令行, 注释, 路径)', description: '向 crontab 表追加一行「表达式 命令行」；表达式不合法或命令行为空时返回假，不写入。', parameters: [parameter('表达式', 'wideString', expressionArg), parameter('命令行', 'wideString', '到点要执行的外部命令行；经 cmd.exe /c 执行，支持内建命令与输出重定向。'), { name: '注释', type: 'wideString', optional: true, defaultValue: '', description: '可选备注；非空时在任务行前写一行「# 注释」便于维护。' }, optionalPath(tablePathArg)], returnType: 'bool', returnLabel: '逻辑型', category: 'crontab表' },
  { name: 'cron_定时_表删除', signature: 'cron_定时_表删除(行号, 路径)', description: '按任务行号删除表中的一行；行号按「非空且非 # 注释」的行从 1 计数。', parameters: [parameter('行号', 'int', '要删除的任务行号，从 1 开始；超出范围返回假。'), optionalPath(tablePathArg)], returnType: 'bool', returnLabel: '逻辑型', category: 'crontab表' },
  { name: 'cron_定时_表清空', signature: 'cron_定时_表清空(路径)', description: '清空 crontab 表文件内容；已载入运行的任务不受影响，需要另外 cron_定时_停止全部。', parameters: [optionalPath(tablePathArg)], returnType: 'bool', returnLabel: '逻辑型', category: 'crontab表' },
  { name: 'cron_定时_表载入运行', signature: 'cron_定时_表载入运行(路径)', description: '解析 crontab 表并把每条任务注册为命令型定时任务，返回成功注册的数量；表达式非法的行跳过并记录到 cron_定时_取错误，MAILTO= 行作为失败/有输出时的通知邮箱。', parameters: [optionalPath(tablePathArg)], returnType: 'int', returnLabel: '整数型', category: 'crontab表' },

  { name: 'cron_定时_守护启动', signature: 'cron_定时_守护启动()', description: '启动进程内 cron 守护：自动 cron_定时_表载入运行 并开启后台调度线程（每 0.5 秒检查到点任务）；同一张表同一时刻只允许一个进程启动守护，重复启动返回假。', parameters: [], returnType: 'bool', returnLabel: '逻辑型', category: '守护进程' },
  { name: 'cron_定时_守护停止', signature: 'cron_定时_守护停止()', description: '停止守护调度线程；已注册的任务保留，正在执行的外部命令不会被中断。', parameters: [], returnType: 'bool', returnLabel: '逻辑型', category: '守护进程' },
  { name: 'cron_定时_守护是否运行', signature: 'cron_定时_守护是否运行()', description: '判断当前进程的 cron 守护是否正在运行。', parameters: [], returnType: 'bool', returnLabel: '逻辑型', category: '守护进程' },
  { name: 'cron_定时_开机自启', signature: 'cron_定时_开机自启(是否启用)', description: '把本程序注册/注销为开机自启（当前用户注册表 Run 键，参数 --lingbuilder-cron-daemon）；登录后系统静默拉起本程序进入守护模式，不需要管理员权限。', parameters: [parameter('是否启用', 'bool', '传真注册开机自启，传假注销；写入的是当前用户的注册表 Run 键。')], returnType: 'bool', returnLabel: '逻辑型', category: '守护进程' },
  { name: 'cron_定时_是否开机自启', signature: 'cron_定时_是否开机自启()', description: '查询本程序当前是否已注册开机自启。', parameters: [], returnType: 'bool', returnLabel: '逻辑型', category: '守护进程' },

  { name: 'cron_定时_邮件配置', signature: 'cron_定时_邮件配置(SMTP服务器, 端口, 账号, 授权码, 收件地址)', description: '配置 MAILTO 邮件通知使用的 SMTP 账号；Windows 没有本机邮件代理，命令型任务失败或有输出时的邮件通知必须先配置真实 SMTP 账号（如邮箱授权码）。', parameters: [parameter('SMTP服务器', 'wideString', 'SMTP 服务器域名，例如 smtp.qq.com。'), parameter('端口', 'int', 'SMTP 端口，1 到 65535，常用 465 或 587。'), parameter('账号', 'wideString', 'SMTP 登录账号；留空表示服务器不需要认证。'), parameter('授权码', 'wideString', 'SMTP 登录密码或邮箱授权码。'), parameter('收件地址', 'wideString', '通知邮件的收件邮箱（MAILTO）。')], returnType: 'bool', returnLabel: '逻辑型', category: '邮件通知' },
  { name: 'cron_定时_邮件测试', signature: 'cron_定时_邮件测试()', description: '用当前配置发送一封测试邮件，验证 SMTP 账号是否可用；失败原因用 cron_定时_取错误 查询。', parameters: [], returnType: 'bool', returnLabel: '逻辑型', category: '邮件通知' }
];

function contribution(spec: CronCommandSpec): ModuleCommandContribution {
  return {
    name: spec.name,
    signature: spec.signature,
    description: spec.description,
    insertText: spec.insertText || `${spec.name}(${spec.parameters.map((item, index) => item.type === 'handler' ? `&$${index + 1}` : item.optional ? '' : `$${index + 1}`).filter(part => part !== '').join(', ')})`,
    returnType: spec.returnLabel,
    category: spec.category,
    capabilityKind: 'managed'
  };
}

function binding(spec: CronCommandSpec): ModuleCommandBinding {
  return {
    command: spec.name,
    runtimeName: spec.name,
    parameters: spec.parameters,
    returnType: spec.returnType,
    encoding: spec.parameters.some(item => item.type === 'wideString') ? 'wide' : 'raw',
    example: spec.example || `${spec.name}()`,
    description: spec.description
  };
}

// 到点/完成处理器收定时任务参数；生成器按方法形参数量生成 名(任务) 或 名() 派发，与契约保持一致。
const fireHandlerSignature = { parameterTypes: ['定时任务'], returnType: '空' };
const workerHandlerSignature = { parameterTypes: [] as string[], returnType: '空' };

export const CRON_COMMAND_SPECS = specs;
export const CRON_MODULE_ID = 'lingbuilder.cron';
export const CRON_DAEMON_ARGUMENT = '--lingbuilder-cron-daemon';

// bindings.commands 的运行时形态：启动/提交线程是窗口类成员（需要把处理器派发回注册窗口），
// handlerSignature 契约在导出清单里补齐；其余命令是 runtime 块内的静态函数。
export const CRON_MODULE: LingBuilderModuleManifest = {
  schemaVersion: 2,
  id: CRON_MODULE_ID,
  name: '定时任务模块',
  version: '1.0.0',
  category: '系统',
  description: '提供标准 cron 表达式的周期调度、crontab 表文件管理、进程内守护线程、开机自启和 MAILTO 邮件通知；命令型任务经 cmd.exe 执行外部命令。',
  author: 'LingBuilder',
  tags: ['内置', '系统', '定时', 'cron', 'crontab', '守护进程'],
  contributes: {
    commands: specs.map(contribution),
    types: [
      { name: '定时任务', description: '定时任务 ID；64 位、进程生命周期内不复用。', cppType: 'long long' }
    ],
    snippets: [
      { label: '每 5 分钟刷新界面', insertText: '定时任务 任务 = cron_定时_启动("*/5 * * * *", &定时刷新)\n\n空 定时刷新(定时任务 任务)\n    编辑框_置文本(状态框, 时间_到文本(时间_取现行时间()))\n结束', description: '到点处理器在 UI 线程执行，可以直接更新控件。' },
      { label: '每天夜间执行命令并邮件通知', insertText: 'cron_定时_邮件配置("smtp.qq.com", 465, "账号@qq.com", "授权码", "我@qq.com")\ncron_定时_表添加("0 2 * * *", "D:\\\\tools\\\\backup.bat 备份", "夜间备份")\ncron_定时_守护启动()', description: '表内命令型任务失败或有输出时，用配置的 SMTP 账号发通知邮件。' },
      { label: '后台跑重活并回界面收结果', insertText: '定时任务 任务 = cron_定时_提交线程("0 * * * *", &整点同步, &同步完成)\n\n空 整点同步()\n    \' 后台线程：只做耗时计算或文件/网络操作，禁止碰控件\n结束\n\n空 同步完成(定时任务 任务)\n    编辑框_置文本(状态框, "同步完成")\n结束', description: '工作处理器运行在 cron 后台线程，禁止 UI 调用；结果在完成处理器回到 UI 线程。' }
    ],
    docs: [{ title: '定时任务模块使用说明', path: 'docs/modules/cron/README.md' }]
  },
  targets: [{ id: 'windows-msvc-win32', platform: 'windows', arch: 'win32', toolchain: 'msvc', defines: ['LINGBUILDER_CRON_MODULE'], compileOptions: ['/std:c++17'] }],
  bindings: {
    commands: specs.map(spec => ({
      ...binding(spec),
      // 生成器按 handler-as-name ABI 传 L"处理器名"；签名契约交给语言服务校验。
      parameters: spec.parameters.map(item => item.type === 'handler'
        ? { ...item, handlerSignature: item.name === '工作处理器' ? workerHandlerSignature : fireHandlerSignature }
        : item)
    }))
  }
};
