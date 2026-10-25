import { createStandardModule, StandardCommandSpec } from './standardLibraryModules';
import { LingBuilderModuleManifest, ModuleBindingValueType } from './types';

// 消息推送模块：企业微信群机器人 / 钉钉自定义机器人 / 飞书自定义机器人的出站 webhook。
// 运行时实现内置于生成模板（networkLibraryRuntime.ts 中按 lingbuilder.notify 启用拼接的
// NOTIFY_RUNTIME 块），targets.defines 声明 LINGBUILDER_NOTIFY_MODULE 以保持目标元数据一致。
// 设计口径：所有 内容 参数收原文文本，JSON 信封与转义由运行时构建；钉钉/飞书加签在运行时
// 内部完成（BCrypt HMAC-SHA256）；失败返回假并经 推送_取错误() 给出中文原因。

type Parameter = { name: string; type: ModuleBindingValueType; description: string; optional?: boolean; defaultValue?: number };

const webhookUrlArg = '机器人 webhook 完整地址（https:// 开头），由各平台群设置里「添加机器人」获得。';
const mobileListArg = '要 @ 的手机号列表，多行或逗号分隔均可，如 "13800000001,13800000002"；空文本表示不 @ 指定人。';
const feishuIdListArg = '要 @ 的用户 open_id 列表，多行或逗号分隔均可；空文本表示不 @ 指定人。';
const dingtalkSecretArg = '钉钉机器人「加签」安全设置的密钥（SEC 开头）；空文本表示机器人未开启加签。签名由运行时按 HMAC-SHA256 自动计算，不需要自己拼 sign。';
const feishuSecretArg = '飞书机器人「签名校验」的密钥；空文本表示机器人未开启签名校验。签名由运行时按 HMAC-SHA256 自动计算并写进请求体。';
const atAllArg = '真时 @ 群内所有人（同时占用一条限流额度），假时不 @ 所有人。';

function command(name: string, parameters: Parameter[], returnType: ModuleBindingValueType, description: string, insertText?: string, example?: string): StandardCommandSpec {
  return {
    name,
    signature: `${name}(${parameters.map(parameter => parameter.name).join(', ')})`,
    description,
    insertText: insertText || `${name}(${parameters.map((parameter, index) => parameter.type === 'bool' ? '假' : parameter.type === 'int' ? '0' : `"$${index + 1}"`).join(', ')})`,
    parameters,
    returnType,
    example
  };
}

const commands: StandardCommandSpec[] = [
  // ── 通用 ──
  command('推送_发JSON', [
    { name: '地址', type: 'wideString', description: '任意 HTTP/HTTPS webhook 地址：Server酱、Bark、Qmsg酱、自建服务等。' },
    { name: 'JSON文本', type: 'wideString', description: '完整请求体 JSON。⚠️ 本命令不转义：JSON 里的引号/换行必须自己按 JSON 规则写，内容里的中文按 UTF-8 提交。' },
    { name: '超时毫秒', type: 'int', description: '请求超时毫秒数，省略时使用 #推送_默认超时毫秒（10000）。', optional: true, defaultValue: 10000 }
  ], 'bool',
    '把一段现成 JSON 以 POST（Content-Type: application/json）发给任意 webhook 地址。三平台结构化命令（发企业微信文本/发钉钉文本等）能满足的场景优先用它们——内容转义、@ 人和加签都由运行时代劳；本命令是万能兜底：企微模板卡片、飞书交互卡片、Server酱/Bark/Qmsg 等第三方服务都走这里。成功指 HTTP 200，业务层是否送达请读 推送_取响应文本() 核对。',
    '推送_发JSON("${1:https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx}", "${2:{\\"msgtype\\":\\"text\\",\\"text\\":{\\"content\\":\\"你好\\"}}}")',
    '推送_发JSON("https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx", "{\\"msgtype\\":\\"text\\",\\"text\\":{\\"content\\":\\"构建完成\\"}}")'),
  command('推送_取错误', [], 'wideString',
    '返回最近一次推送命令失败或被平台拒绝时的中文原因（参数校验、网络错误、HTTP 非 200、平台 errcode 非 0、加签失败等）；最近一次成功时为空文本。所有推送命令失败都返回假、不抛异常，错误一律到这里读。',
    '推送_取错误()', '如果(推送_发钉钉文本(地址, "构建失败", "", 假, 密钥) = 假)\n    调试输出(推送_取错误())'),
  command('推送_取响应文本', [], 'wideString',
    '返回最近一次推送请求的平台响应原文（JSON），排障刚需：errcode/errmsg、StatusCode、code 都在这里。发JSON 等自定义服务也用它核对业务返回。',
    '推送_取响应文本()', '调试输出(推送_取响应文本())'),

  // ── 企业微信群机器人（无签名）──
  command('推送_发企业微信文本', [
    { name: '地址', type: 'wideString', description: webhookUrlArg },
    { name: '内容', type: 'wideString', description: '消息正文（原文即可，不必转义）；上限 2048 字节（UTF-8 字节不是字数，约 680 个汉字），超长直接失败并给中文原因。' },
    { name: '手机号列表', type: 'wideString', description: mobileListArg },
    { name: '是否所有人', type: 'bool', description: atAllArg }
  ], 'bool',
    '发企业微信群机器人文本消息，可按手机号 @ 人或 @ 所有人。红线：文本上限 2048 字节（UTF-8）；@ 只支持手机号（mentioned_mobile_list）；带引号/换行的内容由运行时自动转义，直接给原文即可。',
    '推送_发企业微信文本("${1:https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx}", "${2:构建完成}", "", 假)',
    '推送_发企业微信文本(地址, "构建完成：" + 工程名, "", 假)'),
  command('推送_发企业微信Markdown', [
    { name: '地址', type: 'wideString', description: webhookUrlArg },
    { name: '内容', type: 'wideString', description: 'Markdown 正文（原文即可）；上限 4096 字节（UTF-8），支持加粗、引用、链接、颜色等部分语法。' }
  ], 'bool',
    '发企业微信群机器人 Markdown 消息。红线：企业微信的 Markdown 类型不支持 @ 人（官方限制），需要 @ 人请改用 推送_发企业微信文本。',
    '推送_发企业微信Markdown("${1:https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx}", "${2:## 构建完成\\n> 工程名}")',
    '推送_发企业微信Markdown(地址, "## 构建完成\\n> " + 工程名)'),
  command('推送_发企业微信图片', [
    { name: '地址', type: 'wideString', description: webhookUrlArg },
    { name: '图片路径', type: 'wideString', description: '本地图片完整路径；仅支持 jpg/png，不超过 2MB，Base64 与 MD5 由运行时自动计算。' }
  ], 'bool',
    '发企业微信群机器人图片消息。只需给本地路径，运行时自动读文件、算 Base64 与 MD5（小写十六进制）并组包；格式（jpg/png）、大小（≤2MB）在本地预校验，失败给中文原因。',
    '推送_发企业微信图片("${1:https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx}", "${2:D:\\\\截图\\\\结果.png}")',
    '推送_发企业微信图片(地址, "D:\\\\截图\\\\结果.png")'),
  command('推送_发企业微信图文', [
    { name: '地址', type: 'wideString', description: webhookUrlArg },
    { name: '图文条目文本', type: 'wideString', description: '每行一条图文，格式「标题|描述|跳转链接|图片URL」，竖线用全角｜也可以；标题与跳转链接必填（企业微信要求 url 必填），描述/图片可留空；1~8 条。' }
  ], 'bool',
    '发企业微信群机器人图文消息（news 卡片链接），一次 1~8 条。条目按行拆、字段按竖线拆，全部由运行时组装与转义；条数不在 1~8 内或跳转链接缺失直接失败并给中文原因。',
    '推送_发企业微信图文("${1:https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx}", "${2:发布公告|点此查看详情|https://example.com|https://example.com/cover.png}")',
    '推送_发企业微信图文(地址, "发布公告|点此查看|https://example.com")'),
  command('推送_上传企业微信文件', [
    { name: '地址', type: 'wideString', description: '企业微信群机器人 webhook 地址（从中提取 key 参数调官方 upload_media 接口）。' },
    { name: '文件路径', type: 'wideString', description: '本地文件完整路径；不超过 20MB。media_id 有效期 3 天。' }
  ], 'wideString',
    '上传本地文件到企业微信临时素材，返回 media_id（供 推送_发企业微信文件 发送）；multipart/form-data 组包由运行时完成。失败返回空文本，原因读 推送_取错误()。media_id 三天有效，过期需重新上传。',
    '推送_上传企业微信文件("${1:https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx}", "${2:D:\\\\报告\\\\月报.pdf}")',
    '局部 文本型 编号\\n编号 = 推送_上传企业微信文件(地址, "D:\\\\报告\\\\月报.pdf")\\n推送_发企业微信文件(地址, 编号)'),
  command('推送_发企业微信文件', [
    { name: '地址', type: 'wideString', description: webhookUrlArg },
    { name: 'media_id', type: 'wideString', description: '推送_上传企业微信文件 返回的素材编号。' }
  ], 'bool',
    '发企业微信群机器人文件消息（先 推送_上传企业微信文件 拿 media_id，再用本命令发送）。文件上限 20MB、media_id 三天有效。注意：语音（voice）类型 webhook 不支持，本模块未提供。',
    '推送_发企业微信文件("${1:https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx}", "${2:media_id}")',
    '推送_发企业微信文件(地址, 编号)'),

  // ── 钉钉自定义机器人（加签密钥一律最后一位参数）──
  command('推送_发钉钉文本', [
    { name: '地址', type: 'wideString', description: webhookUrlArg },
    { name: '内容', type: 'wideString', description: '消息正文（原文即可）；机器人开了「自定义关键词」时内容必须包含任一关键词。' },
    { name: '手机号列表', type: 'wideString', description: mobileListArg },
    { name: '是否所有人', type: 'bool', description: atAllArg },
    { name: '加签密钥', type: 'wideString', description: dingtalkSecretArg }
  ], 'bool',
    '发钉钉自定义机器人文本消息（atMobiles/isAtAll 语义），时间戳与 sign 由运行时拼进地址。红线：约 20 条/分钟限流；机器人安全设置三选一——关键词（内容里带关键词）、加签（传本密钥）、IP 白名单；关键词与加签可以叠加，叠加时内容既要带关键词签名也要合法。',
    '推送_发钉钉文本("${1:https://oapi.dingtalk.com/robot/send?access_token=xxx}", "${2:构建失败}", "", 假, "${3:SECxxxx}")',
    '如果(推送_发钉钉文本(地址, "构建失败", "", 假, 密钥) = 假)\n    调试输出(推送_取错误())'),
  command('推送_发钉钉Markdown', [
    { name: '地址', type: 'wideString', description: webhookUrlArg },
    { name: '内容', type: 'wideString', description: 'Markdown 正文（原文即可）；支持加粗、链接、引用、图片等部分语法。' },
    { name: '手机号列表', type: 'wideString', description: mobileListArg },
    { name: '是否所有人', type: 'bool', description: atAllArg },
    { name: '加签密钥', type: 'wideString', description: dingtalkSecretArg }
  ], 'bool',
    '发钉钉自定义机器人 Markdown 消息。与企微相反：钉钉的 Markdown 能 @ 人——运行时把 atMobiles/isAtAll 组进 at 字段，并自动在正文末尾补上缺失的 @手机号 文本（钉钉要求正文里出现 @手机号 才显示 @）；会话列表标题（title）自动取正文首个非空行（去掉行首井号，截 20 字）。机器人开了关键词校验时，关键词要出现在 Markdown 正文里。',
    '推送_发钉钉Markdown("${1:https://oapi.dingtalk.com/robot/send?access_token=xxx}", "${2:## 构建失败}", "", 假, "${3:SECxxxx}")',
    '推送_发钉钉Markdown(地址, "## 构建失败\\n> " + 工程名, "", 假, 密钥)'),
  command('推送_发钉钉链接', [
    { name: '地址', type: 'wideString', description: webhookUrlArg },
    { name: '标题', type: 'wideString', description: '卡片标题，会话列表里预览用。' },
    { name: '内容', type: 'wideString', description: '描述文本（原文即可）。' },
    { name: '跳转链接', type: 'wideString', description: '点击卡片跳转的 URL，不能为空。' },
    { name: '图片链接', type: 'wideString', description: '卡片配图 URL；空文本表示不带图。' },
    { name: '加签密钥', type: 'wideString', description: dingtalkSecretArg }
  ], 'bool',
    '发钉钉自定义机器人 Link 消息（标题 + 描述 + 跳转 + 可选配图），适合推送带跳转的通知。跳转链接不能为空。',
    '推送_发钉钉链接("${1:https://oapi.dingtalk.com/robot/send?access_token=xxx}", "${2:版本发布}", "${3:点此查看更新说明}", "${4:https://example.com/release}", "", "${5:SECxxxx}")',
    '推送_发钉钉链接(地址, "版本发布", "点此查看更新说明", "https://example.com", "", 密钥)'),
  command('推送_发钉钉卡片单按钮', [
    { name: '地址', type: 'wideString', description: webhookUrlArg },
    { name: '标题', type: 'wideString', description: '卡片标题。' },
    { name: '内容', type: 'wideString', description: '卡片正文，支持 Markdown 部分语法（原文即可）。' },
    { name: '按钮标题', type: 'wideString', description: '整体跳转按钮的文字，如「查看日志」。' },
    { name: '跳转链接', type: 'wideString', description: '点击按钮跳转的 URL，不能为空。' },
    { name: '加签密钥', type: 'wideString', description: dingtalkSecretArg }
  ], 'bool',
    '发钉钉自定义机器人 ActionCard 整体跳转卡片（单按钮），典型用法：构建失败卡片 + 「查看日志」按钮。',
    '推送_发钉钉卡片单按钮("${1:https://oapi.dingtalk.com/robot/send?access_token=xxx}", "${2:构建失败}", "${3:错误摘要}", "${4:查看日志}", "${5:https://example.com/log}", "${6:SECxxxx}")',
    '推送_发钉钉卡片单按钮(地址, "构建失败", 错误摘要, "查看日志", 日志地址, 密钥)'),
  command('推送_发钉钉卡片多按钮', [
    { name: '地址', type: 'wideString', description: webhookUrlArg },
    { name: '标题', type: 'wideString', description: '卡片标题。' },
    { name: '内容', type: 'wideString', description: '卡片正文，支持 Markdown 部分语法（原文即可）。' },
    { name: '按钮列表文本', type: 'wideString', description: '每行一个按钮，格式「按钮标题|跳转链接」，竖线用全角｜也可以。' },
    { name: '是否横排', type: 'bool', description: '真时按钮横向排列（btnOrientation=1），假时纵向。' },
    { name: '加签密钥', type: 'wideString', description: dingtalkSecretArg }
  ], 'bool',
    '发钉钉自定义机器人 ActionCard 独立跳转卡片（多按钮），按钮按行拆、字段按竖线拆，由运行时组装转义。',
    '推送_发钉钉卡片多按钮("${1:https://oapi.dingtalk.com/robot/send?access_token=xxx}", "${2:构建报告}", "${3:请选择操作}", "${4:查看日志|https://a.com\\n重新构建|https://b.com}", 真, "${5:SECxxxx}")',
    '推送_发钉钉卡片多按钮(地址, "构建报告", "请选择操作", "查看日志|https://a.com\\n重新构建|https://b.com", 真, 密钥)'),
  command('推送_发钉钉图文', [
    { name: '地址', type: 'wideString', description: webhookUrlArg },
    { name: '图文条目文本', type: 'wideString', description: '每行一条，格式「标题|跳转链接|图片URL」，竖线用全角｜也可以；标题与跳转链接必填。' },
    { name: '加签密钥', type: 'wideString', description: dingtalkSecretArg }
  ], 'bool',
    '发钉钉自定义机器人 FeedCard 多图文卡片，适合一次推多条带图资讯。红线：钉钉 webhook 不支持直接发图片消息（那是接口方式的权限），带图只能用本命令的图片 URL 形式。',
    '推送_发钉钉图文("${1:https://oapi.dingtalk.com/robot/send?access_token=xxx}", "${2:今日资讯|https://a.com|https://a.com/cover.png}", "${3:SECxxxx}")',
    '推送_发钉钉图文(地址, "今日资讯|https://a.com|https://a.com/cover.png", 密钥)'),

  // ── 飞书自定义机器人（加签密钥写进请求体）──
  command('推送_发飞书文本', [
    { name: '地址', type: 'wideString', description: webhookUrlArg },
    { name: '内容', type: 'wideString', description: '消息正文（原文即可）。要 @ 人也可以直接在正文里写内联标签 <at user_id="open_id"></at>。' },
    { name: '用户ID列表', type: 'wideString', description: feishuIdListArg },
    { name: '是否所有人', type: 'bool', description: atAllArg },
    { name: '加签密钥', type: 'wideString', description: feishuSecretArg }
  ], 'bool',
    '发飞书自定义机器人文本消息。@ 人语义与另两家都不同：飞书按 open_id 内联标签（<at user_id="...">），不是手机号——运行时把列表包成标签追加到正文末尾，@ 所有人追加 <at user_id="all">所有人</at>。签名校验的密钥（开启时）由运行时计算并写进请求体 timestamp/sign 字段。',
    '推送_发飞书文本("${1:https://open.feishu.cn/open-apis/bot/v2/hook/xxx}", "${2:部署完成}", "", 假, "${3:}")',
    '推送_发飞书文本(地址, "部署完成", "", 假, "")'),
  command('推送_发飞书富文本', [
    { name: '地址', type: 'wideString', description: webhookUrlArg },
    { name: '多行文本', type: 'wideString', description: '每行一个段落的纯文本（原文即可）；空行自动忽略。需要超链接/图片/@ 元素的复杂富文本改用 推送_发JSON 直发 post 结构。' },
    { name: '加签密钥', type: 'wideString', description: feishuSecretArg }
  ], 'bool',
    '发飞书自定义机器人富文本（post）消息，本命令封装「每行一个文本段落」的最常用形态：一行变一个 text 元素，段落转义由运行时完成；机器人开启签名校验时第 3 参传密钥（秒时间戳与 sign 由运行时写进请求体），空文本表示未开启。链接、图片、@ 提醒等嵌套元素走 推送_发JSON。',
    '推送_发飞书富文本("${1:https://open.feishu.cn/open-apis/bot/v2/hook/xxx}", "${2:第一段\\n第二段}", "${3:}")',
    '推送_发飞书富文本(地址, "构建完成\\n工程：" + 工程名, 密钥)')
];

export const NOTIFY_MODULE: LingBuilderModuleManifest = {
  ...createStandardModule({
    id: 'lingbuilder.notify',
    name: '消息推送模块',
    version: '1.0.0',
    category: '网络',
    description: '把文本、Markdown、图文、文件等消息主动 POST 到国内主流群机器人 webhook：企业微信群机器人、钉钉自定义机器人、飞书自定义机器人，另提供万能 推送_发JSON 兜底 Server酱/Bark/Qmsg/自建服务。内容转义、@ 人、钉钉/飞书 HMAC-SHA256 加签、企微图片 Base64/MD5 与文件 multipart 上传全部由运行时代劳，失败返回假并经 推送_取错误() 给出中文原因。只做出站推送，不做消息接收。',
    tags: ['推送', '企业微信', '钉钉', '飞书', 'webhook', '通知'],
    snippets: [
      {
        label: '钉钉加签告警',
        insertText: '推送_发钉钉Markdown("${1:https://oapi.dingtalk.com/robot/send?access_token=xxx}", "${2:## 构建失败\\n> 工程：LingBuilder}", "", 假, "${3:SEC加签密钥}")\n如果(推送_取错误() ≠ "")\n    调试输出(推送_取错误())',
        description: '钉钉自定义机器人（关键词+加签叠加校验）：Markdown 正文需包含机器人关键词，密钥空文本表示未开启加签。'
      },
      {
        label: '企微 Markdown 通知',
        insertText: '推送_发企业微信Markdown("${1:https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx}", "${2:## 构建完成\\n> 结果：成功}")\n调试输出(推送_取响应文本())',
        description: '企业微信群机器人 Markdown 通知；企微 Markdown 不支持 @ 人，@ 人用 推送_发企业微信文本。'
      },
      {
        label: '企微模板卡片(发JSON)',
        insertText: '推送_发JSON("${1:https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx}", "${2:{\\"msgtype\\":\\"template_card\\",\\"template_card\\":{\\"card_type\\":\\"text_notice\\",\\"source\\":{\\"icon_url\\":\\"\\",\\"desc\\":\\"LingBuilder\\"},\\"main_title\\":{\\"title\\":\\"构建完成\\"},\\"emphasis_content\\":{\\"title\\":\\"成功\\",\\"desc\\":\\"构建结果\\"}}}}")\n调试输出(推送_取响应文本())',
        description: '企微模板卡片等复杂结构走万能兜底：JSON 须自己转义（本命令不代劳），字段见官方 template_card 文档。'
      },
      {
        label: '飞书段落',
        insertText: '推送_发飞书富文本("${1:https://open.feishu.cn/open-apis/bot/v2/hook/xxx}", "${2:第一段\\n第二段}", "${3:}")\n调试输出(推送_取响应文本())',
        description: '飞书自定义机器人富文本：一行一个段落；@ 人用 推送_发飞书文本 的 open_id 列表。'
      }
    ],
    commands
  }),
  targets: [
    { id: 'windows-msvc-win32', platform: 'windows', arch: 'win32', toolchain: 'msvc', defines: ['LINGBUILDER_NOTIFY_MODULE'] },
    { id: 'windows-msvc-x64', platform: 'windows', arch: 'x64', toolchain: 'msvc', defines: ['LINGBUILDER_NOTIFY_MODULE'] }
  ]
};

NOTIFY_MODULE.contributes.constants = [
  {
    name: '推送_默认超时毫秒',
    type: '整数型',
    value: 10000,
    description: '推送_发JSON 省略 超时毫秒 参数时使用的默认请求超时（毫秒）；三平台群机器人与 Server酱/Bark 类服务在正常网络下响应都在该时限内。'
  }
];
