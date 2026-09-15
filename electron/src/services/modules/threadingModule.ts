import {
  LingBuilderModuleManifest,
  ModuleCommandBinding,
  ModuleCommandBindingParameter,
  ModuleCommandContribution,
  ModuleManagedTaskInvocation
} from './types';

interface ThreadingCommandSpec {
  name: string;
  signature: string;
  description: string;
  parameters: ModuleCommandBindingParameter[];
  returnType: string;
  returnLabel: string;
  category: string;
  insertText?: string;
  example?: string;
  invocation?: ModuleManagedTaskInvocation;
}

const parameter = (name: string, type: ModuleCommandBindingParameter['type'], description: string): ModuleCommandBindingParameter => ({ name, type, description });
const variadic = (description = '按值深拷贝后传给工作处理器，数量不设人为上限。'): ModuleCommandBindingParameter => ({ name: '参数', type: 'lingValue', variadic: true, description });

// 重复语义按 threadingRuntime.ts 的校验和 languageService.ts 的处理器签名门禁核实，提取为共享常量。
const workerHandlerArg = '必须使用 &处理器名；在工作线程执行，形参按提交的可变参数顺序和类型声明，返回值会交给完成处理器。';
const completionHandlerArg = '必须使用 &处理器名；在发起任务的窗口 UI 线程执行，签名必须是 空 处理器(线程任务 任务) 或 空 处理器(线程任务 任务, 工作返回值)。';
const progressHandlerArg = '必须使用 &处理器名；在发起任务的窗口 UI 线程执行，签名必须是 空 处理器(线程任务 任务, 整数型 百分比, 文本型 说明)。';
const syncHandlerArg = '必须使用 &处理器名；无参数、无返回值的处理器，在持锁期间同步执行完毕。';
const taskArg = '线程_提交* 或 线程池_提交* 返回的线程任务 ID；记录已被释放或从未存在时命令按说明返回失败值。';
const poolArg = '线程池_创建 或 线程池_取默认池 返回的线程池 ID；池不存在或已销毁时命令返回假。';
const mutexArg = '互斥锁_创建 返回的互斥锁 ID；非递归锁，同一线程重入会失败。';
const atomicArg = '原子整数_创建 返回的原子整数 ID；不存在时读取和写入返回 0。';
const eventArg = '线程事件_创建 返回的同步事件 ID；已销毁或不存在时命令返回假。';
const semaphoreArg = '信号量_创建 返回的信号量 ID；已销毁或不存在时命令返回假。';
const queueArg = '队列_创建 返回的线程队列 ID；队列不存在或已销毁时命令返回失败值。';
const timeoutArg = '等待超时毫秒数，只允许 -1 或非负整数；-1 表示无限等待，其它负值判为参数错误并返回假。';
const queueEnqueueTimeoutArg = '队列已满时的阻塞毫秒数，只允许 -1 或非负整数；-1 无限等待，0 表示队列满时立即返回假。';

const taskInvocation = (
  workerParameterIndex: number,
  variadicParameterIndex: number,
  options: Partial<Omit<ModuleManagedTaskInvocation, 'kind' | 'operation' | 'workerParameterIndex' | 'variadicParameterIndex'>> = {}
): ModuleManagedTaskInvocation => ({ kind: 'managedTask', operation: 'submit', workerParameterIndex, variadicParameterIndex, ...options });

const synchronizedInvocation = (
  workerParameterIndex: number,
  variadicParameterIndex: number,
  timeoutParameterIndex?: number
): ModuleManagedTaskInvocation => ({ kind: 'managedTask', operation: 'synchronized', workerParameterIndex, variadicParameterIndex, timeoutParameterIndex });

const specs: ThreadingCommandSpec[] = [
  { name: '线程_提交', signature: '线程_提交(&工作处理器, 参数...)', description: '向项目默认线程池提交类型化工作；所有参数在提交时按值深拷贝。', parameters: [parameter('工作处理器', 'handler', workerHandlerArg), variadic()], returnType: 'longLong', returnLabel: '线程任务', category: '任务', insertText: '线程_提交(&$1, $0)', invocation: taskInvocation(0, 1) },
  { name: '线程_提交完成', signature: '线程_提交完成(&工作处理器, &完成处理器, 参数...)', description: '提交工作并在发起窗口 UI 线程执行一次完成处理器。', parameters: [parameter('工作处理器', 'handler', workerHandlerArg), parameter('完成处理器', 'handler', completionHandlerArg), variadic()], returnType: 'longLong', returnLabel: '线程任务', category: '任务', insertText: '线程_提交完成(&$1, &$2, $0)', invocation: taskInvocation(0, 2, { completionParameterIndex: 1 }) },
  { name: '线程_提交进度', signature: '线程_提交进度(&工作处理器, &进度处理器, &完成处理器, 参数...)', description: '提交可报告进度的工作；进度按 80ms 合并并在 UI 线程分发。', parameters: [parameter('工作处理器', 'handler', workerHandlerArg), parameter('进度处理器', 'handler', progressHandlerArg), parameter('完成处理器', 'handler', completionHandlerArg), variadic()], returnType: 'longLong', returnLabel: '线程任务', category: '任务', insertText: '线程_提交进度(&$1, &$2, &$3, $0)', invocation: taskInvocation(0, 3, { progressParameterIndex: 1, completionParameterIndex: 2 }) },
  { name: '线程_取当前任务', signature: '线程_取当前任务()', description: '在工作处理器内返回当前任务；其它线程返回 0。', parameters: [], returnType: 'longLong', returnLabel: '线程任务', category: '任务' },
  { name: '线程_请求取消', signature: '线程_请求取消(任务)', description: '请求排队或运行任务协作取消。', parameters: [parameter('任务', 'longLong', `${taskArg}已经成功、失败或取消的终态任务返回假。`)], returnType: 'bool', returnLabel: '逻辑型', category: '任务' },
  { name: '线程_是否请求取消', signature: '线程_是否请求取消(任务)', description: '查询指定任务是否已请求取消；传 0 时查询当前任务。', parameters: [parameter('任务', 'longLong', '线程任务 ID；传 0 表示查询当前正在执行的工作处理器所属任务。')], returnType: 'bool', returnLabel: '逻辑型', category: '任务' },
  { name: '线程_取状态', signature: '线程_取状态(任务)', description: '返回固定任务状态码：-1 无效，0 排队，1 运行，2 成功，3 失败，4 请求取消，5 已取消。', parameters: [parameter('任务', 'longLong', `${taskArg}任务不存在时返回 -1。`)], returnType: 'int', returnLabel: '线程任务状态', category: '任务' },
  { name: '线程_取状态名称', signature: '线程_取状态名称(任务)', description: '返回任务状态的中文名称。', parameters: [parameter('任务', 'longLong', taskArg)], returnType: 'wideString', returnLabel: '文本型', category: '任务' },
  { name: '线程_是否完成', signature: '线程_是否完成(任务)', description: '判断任务是否处于成功、失败或已取消状态。', parameters: [parameter('任务', 'longLong', taskArg)], returnType: 'bool', returnLabel: '逻辑型', category: '任务' },
  { name: '线程_取错误', signature: '线程_取错误(任务)', description: '返回任务失败、取消或提交失败的中文错误。', parameters: [parameter('任务', 'longLong', `${taskArg}传 0 时返回项目级最近一次线程操作的中文错误；任务记录不存在时返回任务不存在提示。`)], returnType: 'wideString', returnLabel: '文本型', category: '任务' },
  { name: '线程_等待', signature: '线程_等待(任务, 超时毫秒)', description: '等待任务结束；-1 表示无限等待。禁止在任务中等待自身。', parameters: [parameter('任务', 'longLong', `${taskArg}不能等待当前工作处理器自身所属的任务。`), parameter('超时毫秒', 'int', `${timeoutArg}在界面事件里等待会冻结界面。`)], returnType: 'bool', returnLabel: '逻辑型', category: '等待' },
  { name: '线程_等待全部超时', signature: '线程_等待全部超时(超时毫秒, 任务...)', description: '在总超时内等待给出的全部任务。', parameters: [parameter('超时毫秒', 'int', `${timeoutArg}逐个任务按剩余时间继续等待，总时长不超过该值。`), variadic('一个或多个线程任务；不接受其它值。')], returnType: 'bool', returnLabel: '逻辑型', category: '等待', insertText: '线程_等待全部超时(5000, $0)' },
  { name: '线程_协作等待', signature: '线程_协作等待(毫秒)', description: '在工作处理器中分段等待并响应取消；UI 线程调用时不会泵送界面消息。', parameters: [parameter('毫秒', 'int', '要等待的总毫秒数，不能为负；内部按不超过 10 毫秒分片休眠，并在每片前检查取消请求。')], returnType: 'bool', returnLabel: '逻辑型', category: '等待' },
  { name: '线程_报告进度', signature: '线程_报告进度(百分比, 说明)', description: '从当前工作处理器报告 0～100 的最新进度。', parameters: [parameter('百分比', 'int', '要报告的进度，0 到 100；小于 0 按 0、大于 100 按 100 记录。'), parameter('说明', 'wideString', '随本次进度一起上报的中文说明文本，进度处理器原样收到。')], returnType: 'bool', returnLabel: '逻辑型', category: '进度' },
  { name: '线程_取进度', signature: '线程_取进度(任务)', description: '返回任务最近报告的百分比。', parameters: [parameter('任务', 'longLong', taskArg)], returnType: 'int', returnLabel: '整数型', category: '进度' },
  { name: '线程_取进度说明', signature: '线程_取进度说明(任务)', description: '返回任务最近报告的说明。', parameters: [parameter('任务', 'longLong', `${taskArg}任务不存在时返回空文本。`)], returnType: 'wideString', returnLabel: '文本型', category: '进度' },
  { name: '线程_释放任务', signature: '线程_释放任务(任务)', description: '释放已完成任务的项目级记录；运行中的任务不能释放。', parameters: [parameter('任务', 'longLong', `${taskArg}只有已终结的任务可以释放，运行中或排队的任务返回假。`)], returnType: 'bool', returnLabel: '逻辑型', category: '任务' },
  { name: '线程_清理已完成', signature: '线程_清理已完成()', description: '清理当前项目中全部已完成任务记录并返回数量。', parameters: [], returnType: 'int', returnLabel: '整数型', category: '任务' },

  { name: '线程池_取默认池', signature: '线程池_取默认池()', description: '返回惰性启动的项目默认线程池。', parameters: [], returnType: 'longLong', returnLabel: '线程池', category: '线程池' },
  { name: '线程池_创建', signature: '线程池_创建(并发数, 队列容量)', description: '创建项目级自定义有界线程池；并发数 1～64，容量 1～100000，最多 16 个。', parameters: [parameter('并发数', 'int', '工作线程数量，1 到 64；一个项目最多存在 16 个自定义线程池。'), parameter('队列容量', 'int', '有界等待队列的最大排队任务数，1 到 100000。')], returnType: 'longLong', returnLabel: '线程池', category: '线程池' },
  { name: '线程池_提交', signature: '线程池_提交(线程池, &工作处理器, 参数...)', description: '向指定线程池提交类型化工作。', parameters: [parameter('线程池', 'longLong', poolArg), parameter('工作处理器', 'handler', workerHandlerArg), variadic()], returnType: 'longLong', returnLabel: '线程任务', category: '线程池', invocation: taskInvocation(1, 2, { poolParameterIndex: 0 }) },
  { name: '线程池_提交完成', signature: '线程池_提交完成(线程池, &工作处理器, &完成处理器, 参数...)', description: '向指定线程池提交工作并在 UI 线程执行完成处理器。', parameters: [parameter('线程池', 'longLong', poolArg), parameter('工作处理器', 'handler', workerHandlerArg), parameter('完成处理器', 'handler', completionHandlerArg), variadic()], returnType: 'longLong', returnLabel: '线程任务', category: '线程池', invocation: taskInvocation(1, 3, { poolParameterIndex: 0, completionParameterIndex: 2 }) },
  { name: '线程池_提交进度', signature: '线程池_提交进度(线程池, &工作处理器, &进度处理器, &完成处理器, 参数...)', description: '向指定线程池提交带进度和完成回调的工作。', parameters: [parameter('线程池', 'longLong', poolArg), parameter('工作处理器', 'handler', workerHandlerArg), parameter('进度处理器', 'handler', progressHandlerArg), parameter('完成处理器', 'handler', completionHandlerArg), variadic()], returnType: 'longLong', returnLabel: '线程任务', category: '线程池', invocation: taskInvocation(1, 4, { poolParameterIndex: 0, progressParameterIndex: 2, completionParameterIndex: 3 }) },
  { name: '线程池_设置并发数', signature: '线程池_设置并发数(线程池, 并发数)', description: '在线程池空闲时调整并发数。', parameters: [parameter('线程池', 'longLong', `${poolArg}只有空闲的池才允许调整。`), parameter('并发数', 'int', '调整后的工作线程数量，1 到 64。')], returnType: 'bool', returnLabel: '逻辑型', category: '线程池' },
  { name: '线程池_取并发数', signature: '线程池_取并发数(线程池)', description: '返回线程池工作线程数。', parameters: [parameter('线程池', 'longLong', `${poolArg}池不存在时返回 0。`)], returnType: 'int', returnLabel: '整数型', category: '线程池' },
  { name: '线程池_取等待数量', signature: '线程池_取等待数量(线程池)', description: '返回线程池有界队列中的等待任务数。', parameters: [parameter('线程池', 'longLong', `${poolArg}池不存在时返回 -1。`)], returnType: 'int', returnLabel: '整数型', category: '线程池' },
  { name: '线程池_取运行数量', signature: '线程池_取运行数量(线程池)', description: '返回线程池当前运行任务数。', parameters: [parameter('线程池', 'longLong', `${poolArg}池不存在时返回 -1。`)], returnType: 'int', returnLabel: '整数型', category: '线程池' },
  { name: '线程池_是否空闲', signature: '线程池_是否空闲(线程池)', description: '判断线程池是否没有排队或运行任务。', parameters: [parameter('线程池', 'longLong', poolArg)], returnType: 'bool', returnLabel: '逻辑型', category: '线程池' },
  { name: '线程池_等待空闲', signature: '线程池_等待空闲(线程池, 超时毫秒)', description: '等待线程池进入空闲状态；-1 表示无限等待。', parameters: [parameter('线程池', 'longLong', `${poolArg}工作处理器不能等待自身所属线程池。`), parameter('超时毫秒', 'int', timeoutArg)], returnType: 'bool', returnLabel: '逻辑型', category: '线程池' },
  { name: '线程池_请求停止', signature: '线程池_请求停止(线程池)', description: '协作取消线程池中的排队和运行任务。', parameters: [parameter('线程池', 'longLong', `${poolArg}默认池同样可以请求停止。`)], returnType: 'bool', returnLabel: '逻辑型', category: '线程池' },
  { name: '线程池_关闭', signature: '线程池_关闭(线程池, 超时毫秒)', description: '协作停止并等待工作线程退出；超时不会强杀线程。', parameters: [parameter('线程池', 'longLong', `${poolArg}工作处理器不能关闭自身所属线程池。`), parameter('超时毫秒', 'int', '等待工作线程退出的超时毫秒数，只允许 -1 或非负整数；超时返回假且不会强杀线程。')], returnType: 'bool', returnLabel: '逻辑型', category: '线程池' },
  { name: '线程池_重启', signature: '线程池_重启(线程池)', description: '重启已关闭且空闲的自定义线程池。', parameters: [parameter('线程池', 'longLong', `${poolArg}必须是已关闭且空闲的自定义线程池。`)], returnType: 'bool', returnLabel: '逻辑型', category: '线程池' },
  { name: '线程池_销毁', signature: '线程池_销毁(线程池)', description: '销毁已停止且空闲的自定义线程池；默认池不可销毁。', parameters: [parameter('线程池', 'longLong', `${poolArg}必须是已停止且空闲的自定义线程池，项目默认池不能销毁。`)], returnType: 'bool', returnLabel: '逻辑型', category: '线程池' },
  { name: '线程池_取硬件并发数', signature: '线程池_取硬件并发数()', description: '返回 C++ 运行时报告的硬件并发数，最小为 1。', parameters: [], returnType: 'int', returnLabel: '整数型', category: '线程池' },

  { name: '互斥锁_创建', signature: '互斥锁_创建()', description: '创建项目级非递归定时互斥锁。', parameters: [], returnType: 'longLong', returnLabel: '线程互斥锁', category: '同步' },
  { name: '互斥锁_执行', signature: '互斥锁_执行(互斥锁, &处理器, 参数...)', description: '持锁执行处理器并由 RAII 自动解锁；同线程重入会失败。', parameters: [parameter('互斥锁', 'longLong', mutexArg), parameter('处理器', 'handler', syncHandlerArg), variadic()], returnType: 'bool', returnLabel: '逻辑型', category: '同步', invocation: synchronizedInvocation(1, 2) },
  { name: '互斥锁_尝试执行', signature: '互斥锁_尝试执行(互斥锁, 超时毫秒, &处理器, 参数...)', description: '在超时内尝试持锁执行处理器，并由 RAII 自动解锁。', parameters: [parameter('互斥锁', 'longLong', mutexArg), parameter('超时毫秒', 'int', '获取锁的最长等待毫秒数，只允许 -1 或非负整数；超时未拿到锁则不执行处理器并返回假。'), parameter('处理器', 'handler', syncHandlerArg), variadic()], returnType: 'bool', returnLabel: '逻辑型', category: '同步', invocation: synchronizedInvocation(2, 3, 1) },
  { name: '互斥锁_销毁', signature: '互斥锁_销毁(互斥锁)', description: '销毁当前无人持有或等待的互斥锁。', parameters: [parameter('互斥锁', 'longLong', `${mutexArg}仍被持有或有等待者时返回假。`)], returnType: 'bool', returnLabel: '逻辑型', category: '同步' },
  { name: '原子整数_创建', signature: '原子整数_创建(初始值)', description: '创建项目级 64 位原子整数。', parameters: [parameter('初始值', 'longLong', '原子整数的起始值。')], returnType: 'longLong', returnLabel: '线程原子整数', category: '同步' },
  { name: '原子整数_读取', signature: '原子整数_读取(原子整数)', description: '原子读取当前值。', parameters: [parameter('原子整数', 'longLong', atomicArg)], returnType: 'longLong', returnLabel: '长整数型', category: '同步' },
  { name: '原子整数_写入', signature: '原子整数_写入(原子整数, 新值)', description: '原子写入并返回旧值。', parameters: [parameter('原子整数', 'longLong', atomicArg), parameter('新值', 'longLong', '要写入的新值；命令同时返回写入前的旧值。')], returnType: 'longLong', returnLabel: '长整数型', category: '同步' },
  { name: '原子整数_增加', signature: '原子整数_增加(原子整数, 增量)', description: '原子增加并返回新值。', parameters: [parameter('原子整数', 'longLong', atomicArg), parameter('增量', 'longLong', '要累加的增量，可以为负数；命令返回相加后的新值。')], returnType: 'longLong', returnLabel: '长整数型', category: '同步' },
  { name: '原子整数_比较交换', signature: '原子整数_比较交换(原子整数, 预期值, 新值)', description: '仅当当前值等于预期值时交换，并返回是否成功。', parameters: [parameter('原子整数', 'longLong', atomicArg), parameter('预期值', 'longLong', '期望的当前值，只有实际值等于它才会交换。'), parameter('新值', 'longLong', '交换成功时写入的新值。')], returnType: 'bool', returnLabel: '逻辑型', category: '同步' },
  { name: '原子整数_销毁', signature: '原子整数_销毁(原子整数)', description: '销毁项目级原子整数。', parameters: [parameter('原子整数', 'longLong', atomicArg)], returnType: 'bool', returnLabel: '逻辑型', category: '同步' },
  { name: '线程事件_创建', signature: '线程事件_创建(手动重置, 初始置位)', description: '创建自动或手动重置的项目级同步事件。', parameters: [parameter('手动重置', 'bool', '传真创建手动重置事件，置位后放行全部等待者；传假为自动重置事件，只放行一个等待者。'), parameter('初始置位', 'bool', '传真时创建后立即处于已置位状态，传假为未置位。')], returnType: 'longLong', returnLabel: '线程同步事件', category: '同步' },
  { name: '线程事件_置位', signature: '线程事件_置位(事件)', description: '置位事件并唤醒等待者。', parameters: [parameter('事件', 'longLong', eventArg)], returnType: 'bool', returnLabel: '逻辑型', category: '同步' },
  { name: '线程事件_重置', signature: '线程事件_重置(事件)', description: '将事件恢复为未置位状态。', parameters: [parameter('事件', 'longLong', eventArg)], returnType: 'bool', returnLabel: '逻辑型', category: '同步' },
  { name: '线程事件_等待', signature: '线程事件_等待(事件, 超时毫秒)', description: '等待事件置位；自动重置事件仅释放一个等待者。', parameters: [parameter('事件', 'longLong', eventArg), parameter('超时毫秒', 'int', `${timeoutArg}超时返回假且事件状态不变。`)], returnType: 'bool', returnLabel: '逻辑型', category: '同步' },
  { name: '线程事件_销毁', signature: '线程事件_销毁(事件)', description: '销毁事件并唤醒等待者使其失败返回。', parameters: [parameter('事件', 'longLong', `${eventArg}销毁会把正在等待的线程唤醒并使其返回假。`)], returnType: 'bool', returnLabel: '逻辑型', category: '同步' },
  { name: '信号量_创建', signature: '信号量_创建(初始值, 最大值)', description: '创建项目级计数信号量。', parameters: [parameter('初始值', 'int', '创建时的可用计数，必须落在 0 到最大值之间。'), parameter('最大值', 'int', '可用计数上限，必须大于 0；释放后超过上限会被拒绝。')], returnType: 'longLong', returnLabel: '线程信号量', category: '同步' },
  { name: '信号量_等待', signature: '信号量_等待(信号量, 超时毫秒)', description: '等待并消耗一个信号量计数。', parameters: [parameter('信号量', 'longLong', semaphoreArg), parameter('超时毫秒', 'int', `${timeoutArg}等待成功会消耗一个计数。`)], returnType: 'bool', returnLabel: '逻辑型', category: '同步' },
  { name: '信号量_释放', signature: '信号量_释放(信号量, 数量)', description: '释放指定计数；超过最大值时拒绝。', parameters: [parameter('信号量', 'longLong', semaphoreArg), parameter('数量', 'int', '本次释放的计数，必须大于 0，且释放后可用数不得超过创建时的最大值。')], returnType: 'bool', returnLabel: '逻辑型', category: '同步' },
  { name: '信号量_取可用数量', signature: '信号量_取可用数量(信号量)', description: '返回当前可用计数。', parameters: [parameter('信号量', 'longLong', `${semaphoreArg}不存在时返回 -1。`)], returnType: 'int', returnLabel: '整数型', category: '同步' },
  { name: '信号量_销毁', signature: '信号量_销毁(信号量)', description: '销毁信号量并唤醒等待者使其失败返回。', parameters: [parameter('信号量', 'longLong', `${semaphoreArg}销毁会把正在等待的线程唤醒并使其返回假。`)], returnType: 'bool', returnLabel: '逻辑型', category: '同步' }
,
  { name: '队列_创建', signature: '队列_创建(容量上限)', description: '创建项目级线程安全先进先出队列；容量上限 0 表示无界，1～100000 为有界队列。', parameters: [{ name: '容量上限', type: 'int', description: '同时排队的元素上限，0 表示无界队列，1 到 100000 表示有界队列；超出范围返回句柄 0。'}], returnType: 'longLong', returnLabel: '线程队列', category: '队列', insertText: '队列_创建(1000)' },
  { name: '队列_入队', signature: '队列_入队(队列, 文本, 超时毫秒)', description: '把文本放入队尾；有界队列已满时在超时内阻塞等待（-1 无限等待，0 立即返回），队列已销毁时返回假。', parameters: [{ name: '队列', type: 'longLong', description: queueArg}, { name: '文本', type: 'wideString', description: '放入队尾的文本元素，可以传空文本；取出时原样返回。'}, { name: '超时毫秒', type: 'int', description: '队列已满时的阻塞毫秒数，只允许 -1 或非负整数；-1 无限等待，0 表示队列满时立即返回假。'}], returnType: 'bool', returnLabel: '逻辑型', category: '队列', insertText: '队列_入队($1, "$2", -1)' },
  { name: '队列_出队', signature: '队列_出队(队列, 超时毫秒)', description: '从队首取出并转为文本：文本原样，整数转十进制文本，字节集按 UTF-8 解码（非法返回空文本）；队列为空时在超时内阻塞等待。返回空文本不代表失败，须用上次出队是否成功判断。', parameters: [{ name: '队列', type: 'longLong', description: queueArg}, { name: '超时毫秒', type: 'int', description: '队列为空时的阻塞毫秒数，只允许 -1 或非负整数；返回空文本不代表成功，需用 队列_上次出队是否成功 判断。'}], returnType: 'wideString', returnLabel: '文本型', category: '队列', insertText: '队列_出队($1, -1)' },
  { name: '队列_上次出队是否成功', signature: '队列_上次出队是否成功()', description: '返回当前线程最近一次队列出队是否真正取到数据；用于区分空文本元素与超时空返回。', parameters: [], returnType: 'bool', returnLabel: '逻辑型', category: '队列', insertText: '队列_上次出队是否成功()' },
  { name: '队列_取长度', signature: '队列_取长度(队列)', description: '返回队列中等待取出的元素数量；队列不存在或已销毁时返回 -1。', parameters: [{ name: '队列', type: 'longLong', description: queueArg}], returnType: 'int', returnLabel: '整数型', category: '队列', insertText: '队列_取长度($1)' },
  { name: '队列_是否为空', signature: '队列_是否为空(队列)', description: '判断队列是否没有元素；队列不存在或已销毁时返回假。', parameters: [{ name: '队列', type: 'longLong', description: queueArg}], returnType: 'bool', returnLabel: '逻辑型', category: '队列', insertText: '队列_是否为空($1)' },
  { name: '队列_清空', signature: '队列_清空(队列)', description: '丢弃队列中全部未取出的元素并唤醒等待者重新检查状态。', parameters: [{ name: '队列', type: 'longLong', description: queueArg}], returnType: 'bool', returnLabel: '逻辑型', category: '队列', insertText: '队列_清空($1)' },
  { name: '队列_销毁', signature: '队列_销毁(队列)', description: '销毁队列并唤醒全部等待者（其后续操作返回失败）；未取出的元素被丢弃。队列 ID 不可复用。', parameters: [{ name: '队列', type: 'longLong', description: `${queueArg}销毁后队列 ID 不会被复用。`}], returnType: 'bool', returnLabel: '逻辑型', category: '队列', insertText: '队列_销毁($1)' },
  { name: '队列_入队整数', signature: '队列_入队整数(队列, 整数, 超时毫秒)', description: '把整数放入队尾；有界队列已满时在超时内阻塞等待（-1 无限等待，0 立即返回），队列已销毁时返回假。', parameters: [{ name: '队列', type: 'longLong', description: queueArg}, { name: '整数', type: 'longLong', description: '放入队尾的长整数元素；取出按文本读取时转为十进制文本。'}, { name: '超时毫秒', type: 'int', description: queueEnqueueTimeoutArg}], returnType: 'bool', returnLabel: '逻辑型', category: '队列', insertText: '队列_入队整数($1, $2, -1)' },
  { name: '队列_出队整数', signature: '队列_出队整数(队列, 超时毫秒)', description: '从队首取出并转为整数：整数原样，文本按完整十进制解析（失败返回 0），字节集取前 8 字节小端（不足补 0）；队列为空时在超时内阻塞等待。有效性用上次出队是否成功判断。', parameters: [{ name: '队列', type: 'longLong', description: queueArg}, { name: '超时毫秒', type: 'int', description: '队列为空时的阻塞毫秒数，只允许 -1 或非负整数；返回 0 不代表成功，需用 队列_上次出队是否成功 判断。'}], returnType: 'longLong', returnLabel: '长整数型', category: '队列', insertText: '队列_出队整数($1, -1)' },
  { name: '队列_入队字节集', signature: '队列_入队字节集(队列, 字节集, 超时毫秒)', description: '把字节集放入队尾；有界队列已满时在超时内阻塞等待（-1 无限等待，0 立即返回），队列已销毁时返回假。', parameters: [{ name: '队列', type: 'longLong', description: queueArg}, { name: '字节集', type: 'bytes', description: '放入队尾的字节集元素；取出按文本读取时按 UTF-8 解码。'}, { name: '超时毫秒', type: 'int', description: queueEnqueueTimeoutArg}], returnType: 'bool', returnLabel: '逻辑型', category: '队列', insertText: '队列_入队字节集($1, $2, -1)' },
  { name: '队列_出队字节集', signature: '队列_出队字节集(队列, 超时毫秒)', description: '从队首取出并转为字节集：字节集原样，文本按 UTF-8 编码，整数转 8 字节小端；队列为空时在超时内阻塞等待。有效性用上次出队是否成功判断。', parameters: [{ name: '队列', type: 'longLong', description: queueArg}, { name: '超时毫秒', type: 'int', description: '队列为空时的阻塞毫秒数，只允许 -1 或非负整数；返回空字节集不代表成功，需用 队列_上次出队是否成功 判断。'}], returnType: 'bytes', returnLabel: '字节集', category: '队列', insertText: '队列_出队字节集($1, -1)' }];

function contribution(spec: ThreadingCommandSpec): ModuleCommandContribution {
  return {
    name: spec.name,
    signature: spec.signature,
    description: spec.description,
    insertText: spec.insertText || `${spec.name}(${spec.parameters.map((item, index) => item.type === 'handler' ? `&$${index + 1}` : item.variadic ? '$0' : `$${index + 1}`).join(', ')})`,
    returnType: spec.returnLabel,
    category: spec.category,
    capabilityKind: 'managed'
  };
}

function binding(spec: ThreadingCommandSpec): ModuleCommandBinding {
  return {
    command: spec.name,
    runtimeName: spec.name,
    parameters: spec.parameters,
    returnType: spec.returnType,
    encoding: spec.parameters.some(item => item.type === 'wideString') ? 'wide' : 'raw',
    example: spec.example || (spec.insertText ? spec.insertText.replace(/\$\d+|\$0/gu, '示例值') : `${spec.name}()`),
    description: spec.description,
    invocation: spec.invocation
  };
}

export const THREADING_COMMAND_SPECS = specs;

export const THREADING_LEGACY_COMMANDS = [
  '线程_启动延时输出', '线程_等待全部', '线程_活动数量', '线程_硬件并发数', '线程_休眠',
  '线程_启动延时设置文本', '线程_启动延时添加行', '线程_启动延时添加项目', '线程_批量启动'
] as const;

export const THREADING_MODULE: LingBuilderModuleManifest = {
  schemaVersion: 2,
  id: 'lingbuilder.threading',
  name: '多线程模块',
  version: '2.1.0',
  category: '系统',
  description: '提供项目级受管任务、类型化多参数、进度与完成回调、线程池和同步原语，并提供文本/整数/字节集元素的线程安全队列族。',
  author: 'LingBuilder',
  tags: ['内置', '系统', '多线程', '线程池', '同步', 'C++17'],
  contributes: {
    commands: specs.map(contribution),
    types: [
      { name: '线程任务', description: '项目级受管任务 ID；64 位、进程生命周期内不复用。', cppType: 'long long' },
      { name: '线程任务状态', description: '固定任务状态码。', cppType: 'int' },
      { name: '线程池', description: '项目级受管线程池 ID。', cppType: 'long long' },
      { name: '线程互斥锁', description: '项目级受管非递归定时互斥锁 ID。', cppType: 'long long' },
      { name: '线程原子整数', description: '项目级受管 64 位原子整数 ID。', cppType: 'long long' },
      { name: '线程同步事件', description: '项目级受管自动/手动重置事件 ID。', cppType: 'long long' },
      { name: '线程信号量', description: '项目级受管计数信号量 ID。', cppType: 'long long' }
,
      { name: '线程队列', description: '项目级受管线程安全队列 ID。', cppType: 'long long' }    ],
    snippets: [
      { label: '线程任务多参数与完成回调', insertText: '线程任务 任务 = 线程_提交完成(&计算汇总, &计算完成, 记录参数, 数值数组, "批次A")', description: '按值复制记录、数组和文本，并在 UI 线程接收类型化结果。' },
      { label: '线程任务进度与取消', insertText: '线程任务 任务 = 线程_提交进度(&后台导入, &导入进度, &导入完成, 文件列表)\n线程_请求取消(任务)', description: '报告合并进度并执行协作取消。' },
      { label: '自定义线程池', insertText: '线程池 后台池 = 线程池_创建(4, 1000)\n线程池_提交(后台池, &后台工作, 参数)\n线程池_等待空闲(后台池, 5000)\n线程池_关闭(后台池, 5000)\n线程池_销毁(后台池)', description: '创建、使用并安全销毁有界线程池。' },
      { label: '线程同步原语', insertText: '线程互斥锁 锁 = 互斥锁_创建()\n线程原子整数 计数 = 原子整数_创建(0)\n线程同步事件 就绪 = 线程事件_创建(真, 假)\n线程信号量 限流 = 信号量_创建(2, 2)', description: '创建互斥锁、原子整数、事件和信号量。' }
,
      { label: '队列生产者与消费者', insertText: '线程队列 结果 = 队列_创建(1000)\n线程_提交(&生产者工作, 结果)\n文本型 一条文本 = 队列_出队(结果, 5000)\n逻辑型 有效 = 队列_上次出队是否成功()', description: '工作线程入队、界面线程出队，并用上次出队是否成功判断取数有效性。' }    ],
    docs: [{ title: '多线程模块使用说明', path: 'docs/modules/threading/README.md' }]
  },
  targets: [{ id: 'windows-msvc-win32', platform: 'windows', arch: 'win32', toolchain: 'msvc', defines: ['LINGBUILDER_THREADING_MODULE'], compileOptions: ['/std:c++17'] }],
  bindings: { commands: specs.map(binding) }
};
