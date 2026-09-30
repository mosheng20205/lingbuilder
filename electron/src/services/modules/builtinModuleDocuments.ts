/**
 * 内置模块文档集中登记表（2026-09-27）。
 *
 * 背景：101 个内置模块中 60 个的清单经 createStandardModule / spread 合并等工厂形态生成，
 * 逐家往 contributes 里内联 docs 行既繁琐又容易漏；本表统一登记「模块 ID → 文档包内路径」，
 * 由 builtinModules.ts 在聚合链尾对 contributes.docs 为空的内置清单做合并注入。
 *
 * 文档正文由 `npm run module:builtin-docs`（scripts/generate-builtin-module-docs.ts）从同一份
 * 模块清单确定性生成到 `electron/<路径>`；tests/modules.test.ts 的文档门禁保证：
 * 每个内置模块至少登记 1 篇文档、登记文件必须存在、生成文档与清单保持同步。
 *
 * 维护规则：
 * - 新增内置模块：在本表补一行，并重跑 `npm run module:builtin-docs` 生成文档。
 * - 接管手工维护：把 contributes.docs 写回该模块清单，再从本表删除该行，随后即可自由改写文档。
 * - 清单命令/常量变化后重跑生成脚本，否则门禁（--check）会以内容漂移拒绝。
 */
export const BUILTIN_MODULE_DOCUMENT_PATHS: Readonly<Record<string, string>> = {
  'lingbuilder.std.buffer': 'docs/modules/std-buffer/README.md',
  'lingbuilder.std.bytes': 'docs/modules/std-bytes/README.md',
  'lingbuilder.std.datetime': 'docs/modules/std-datetime/README.md',
  'lingbuilder.std.encoding': 'docs/modules/std-encoding/README.md',
  'lingbuilder.std.math': 'docs/modules/std-math/README.md',
  'lingbuilder.std.text': 'docs/modules/std-text/README.md',
  'lingbuilder.crypto.asymmetric': 'docs/modules/crypto-asymmetric/README.md',
  'lingbuilder.crypto.hash': 'docs/modules/crypto-hash/README.md',
  'lingbuilder.crypto.password': 'docs/modules/crypto-password/README.md',
  'lingbuilder.crypto.symmetric': 'docs/modules/crypto-symmetric/README.md',
  'lingbuilder.crypto.windows': 'docs/modules/crypto-windows/README.md',
  'lingbuilder.image.bitmap': 'docs/modules/image-bitmap/README.md',
  'lingbuilder.image.capture': 'docs/modules/image-capture/README.md',
  'lingbuilder.image.core': 'docs/modules/image-core/README.md',
  'lingbuilder.image.icon': 'docs/modules/image-icon/README.md',
  'lingbuilder.image.recognition': 'docs/modules/image-recognition/README.md',
  'lingbuilder.net.cookie': 'docs/modules/net-cookie/README.md',
  'lingbuilder.net.dns': 'docs/modules/net-dns/README.md',
  'lingbuilder.net.ftp': 'docs/modules/net-ftp/README.md',
  'lingbuilder.net.imap': 'docs/modules/imap/README.md',
  'lingbuilder.net.mail': 'docs/modules/net-mail/README.md',
  'lingbuilder.net.pop3': 'docs/modules/pop3/README.md',
  'lingbuilder.net.tcp': 'docs/modules/net-tcp/README.md',
  'lingbuilder.net.udp': 'docs/modules/net-udp/README.md',
  'lingbuilder.net.url': 'docs/modules/net-url/README.md',
  'lingbuilder.console': 'docs/modules/console/README.md',
  'lingbuilder.fs.core': 'docs/modules/fs-core/README.md',
  'lingbuilder.fs.path': 'docs/modules/fs-path/README.md',
  'lingbuilder.config.ini': 'docs/modules/config-ini/README.md',
  'lingbuilder.config.registry': 'docs/modules/config-registry/README.md',
  'lingbuilder.win32.accessibility': 'docs/modules/win32-accessibility/README.md',
  'lingbuilder.win32.menu': 'docs/modules/win32-menu/README.md',
  'lingbuilder.win32.monitor': 'docs/modules/win32-monitor/README.md',
  'lingbuilder.win32.tray': 'docs/modules/win32-tray/README.md',
  'lingbuilder.system.disk': 'docs/modules/system-disk/README.md',
  'lingbuilder.system.info': 'docs/modules/system-info/README.md',
  'lingbuilder.advanced.assembly': 'docs/modules/advanced-assembly/README.md',
  'lingbuilder.advanced.driver': 'docs/modules/advanced-driver/README.md',
  'lingbuilder.advanced.hook': 'docs/modules/advanced-hook/README.md',
  'lingbuilder.advanced.memory': 'docs/modules/advanced-memory/README.md',
  'lingbuilder.data.xml': 'docs/modules/data-xml/README.md',
  'lingbuilder.database.odbc': 'docs/modules/database-odbc/README.md',
  'lingbuilder.archive': 'docs/modules/archive/README.md',
  'lingbuilder.ipc': 'docs/modules/ipc/README.md',
  'lingbuilder.process': 'docs/modules/process/README.md',
  'lingbuilder.media.audio': 'docs/modules/media-audio/README.md',
  'lingbuilder.cef3.automation': 'docs/modules/cef3-automation/README.md',
  'lingbuilder.cef3.devtools': 'docs/modules/cef3-devtools/README.md',
  'lingbuilder.cef3.events': 'docs/modules/cef3-events/README.md',
  'lingbuilder.cef3.network': 'docs/modules/cef3-network/README.md',
  'lingbuilder.cef3.objects': 'docs/modules/cef3-objects/README.md',
  'lingbuilder.cef3.osr': 'docs/modules/cef3-osr/README.md',
  'lingbuilder.cef3.platform': 'docs/modules/cef3-platform/README.md',
  'lingbuilder.cef3.session': 'docs/modules/cef3-session/README.md',
  'lingbuilder.cef3.transfer': 'docs/modules/cef3-transfer/README.md',
  'lingbuilder.cef3.views': 'docs/modules/cef3-views/README.md',
  'lingbuilder.fbro.automation': 'docs/modules/fbro-automation/README.md',
  'lingbuilder.fbro.events': 'docs/modules/fbro-events/README.md',
  'lingbuilder.fbro.network': 'docs/modules/fbro-network/README.md',
  'lingbuilder.fbro.objects': 'docs/modules/fbro-objects/README.md',
  'lingbuilder.fbro.session': 'docs/modules/fbro-session/README.md',
  'lingbuilder.fbro.transfer': 'docs/modules/fbro-transfer/README.md',
  'lingbuilder.fbro.vip': 'docs/modules/fbro-vip/README.md'
};
