import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { createLcppSourcePackageService } from '../electron/lcppSourcePackageService';
import { ARIA2_COMMAND_SPECS } from '../src/services/modules/aria2Module';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import type { InstalledModule } from '../src/services/modules/types';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import type { LingWindowProject } from '../src/services/windowDesigner/types';
import { exportVisualStudioProject } from '../src/services/windowDesigner/visualStudioProjectExporter';

const repositoryRoot = path.resolve(import.meta.dirname, '..', '..');
const projectId = 'aria2-api-demo';
const demoRoot = path.join(repositoryRoot, 'examples', 'aria2-complete-demo');
const exportPath = path.join(repositoryRoot, 'exports', 'Aria2下载模块-完整交互演示.lcpppkg');
const execFileAsync = promisify(execFile);

const mainSource = `包 Aria2 下载模块完整交互演示
使用 Win32窗口基础模块
使用 Win32高级控件模块
使用 Aria2下载模块

类 MainWindow : 公开 窗体
    Aria2任务 当前任务
    逻辑型 当前任务有效 = 假
    Aria2任务 HTTP任务
    Aria2任务 HTTPS任务
    Aria2任务 单连接任务
    Aria2任务 八连接任务
    Aria2任务 十六连接任务
    Aria2任务 FTP任务
    Aria2任务 磁力任务
    Aria2任务 断点任务
    逻辑型 已记录完成 = 假
    逻辑型 单连接已记录完成 = 假
    逻辑型 八连接已记录完成 = 假
    逻辑型 十六连接已记录完成 = 假
    整数型 日志序号 = 0

    事件 _MainWindow_创建完毕()
        写日志("Aria2 下载模块完整演示已就绪。")
        写日志("模块仅支持 Windows x64；每个下载按钮只创建一种指定任务。")
        写日志("HTTP/HTTPS/FTP 地址可直接在对应文本框中替换；磁力链接请使用有权下载的合法资源。")
        @ SetTimer(hwnd_, 0xA201, 500, [](HWND hwnd, UINT, UINT_PTR, DWORD) {
        @     auto* self = reinterpret_cast<MainWindow*>(GetWindowLongPtrW(hwnd, GWLP_USERDATA));
        @     if (self) self->实时刷新任务面板();
        @     if (self) self->实时刷新并发任务面板();
        @ });
        更新当前任务摘要()
        实时刷新并发任务面板()
    结束

    空 写日志(文本型 内容)
        日志序号 = 日志序号 + 1
        控件_设置文本(运行日志, 格式化文本("{}[{}] {}\\r\\n", 控件_取文本(运行日志), 日志序号, 内容))
        调试输出(内容)
    结束

    空 设置当前任务(Aria2任务 任务, 文本型 名称)
        当前任务 = 任务
        已记录完成 = 假
        如果 (任务 == 0)
            当前任务有效 = 假
            写日志(名称 + "：无法创建任务，请检查地址、目录、文件名及 x64 运行环境。")
        否则
            当前任务有效 = 真
            写日志(格式化文本("{}：已创建任务，句柄={}。", 名称, 任务))
        如果结束
        更新当前任务摘要()
    结束

    空 记录任务快照(文本型 名称, Aria2任务 任务)
        如果 (任务 == 0)
            写日志(名称 + "：尚未创建任务。")
        否则
            写日志(格式化文本("{}：状态={}，进度={}%，已下载={} 字节，总字节={}，速度={} 字节/秒，目录={}，错误={}", 名称, Aria2_取状态(任务), Aria2_取进度(任务), Aria2_取已下载字节(任务), Aria2_取总字节(任务), Aria2_取下载速度(任务), Aria2_取保存目录(任务), Aria2_取错误(任务)))
        如果结束
    结束

    空 实时刷新任务面板()
        如果 (当前任务有效 == 假)
            控件_设置文本(当前任务摘要, "当前任务：未选择")
            控件_设置数值(当前任务进度, 0)
            控件_设置文本(当前任务详情, "等待创建下载任务。")
        否则
            局部 文本型 状态
            局部 文本型 目录
            局部 整数型 进度
            局部 长整数型 已下载
            局部 长整数型 总字节
            局部 长整数型 速度
            状态 = Aria2_取状态(当前任务)
            目录 = Aria2_取保存目录(当前任务)
            进度 = Aria2_取进度(当前任务)
            已下载 = Aria2_取已下载字节(当前任务)
            总字节 = Aria2_取总字节(当前任务)
            速度 = Aria2_取下载速度(当前任务)
            控件_设置文本(当前任务摘要, 格式化文本("当前任务：{} · {}%", 状态, 进度))
            控件_设置数值(当前任务进度, 进度)
            控件_设置文本(当前任务详情, 格式化文本("状态：{}  |  已下载：{} 字节  |  总字节：{}  |  速度：{} 字节/秒\\r\\n保存目录：{}", 状态, 已下载, 总字节, 速度, 目录))
            如果 (状态 == "已完成")
                如果 (已记录完成 == 假)
                    写日志("下载完成，保存目录：" + 目录)
                    已记录完成 = 真
                如果结束
            如果结束
        如果结束
    结束

    空 更新当前任务摘要()
        实时刷新任务面板()
    结束

    空 实时刷新并发任务面板()
        如果 (单连接任务 == 0)
            控件_设置数值(单连接进度, 0)
            控件_设置文本(单连接状态, "1 连接：等待创建任务。")
        否则
            控件_设置数值(单连接进度, Aria2_取进度(单连接任务))
            如果 (Aria2_取状态(单连接任务) == "已完成")
                控件_设置文本(单连接状态, 格式化文本("1 连接：已完成 · {} 字节/秒\r\n保存目录：{}", Aria2_取下载速度(单连接任务), Aria2_取保存目录(单连接任务)))
                如果 (单连接已记录完成 == 假)
                    写日志(格式化文本("1 连接下载完成，保存目录：{}", Aria2_取保存目录(单连接任务)))
                    单连接已记录完成 = 真
                如果结束
            否则
                控件_设置文本(单连接状态, 格式化文本("1 连接：{} · {}% · {} 字节/秒", Aria2_取状态(单连接任务), Aria2_取进度(单连接任务), Aria2_取下载速度(单连接任务)))
            如果结束
        如果结束

        如果 (八连接任务 == 0)
            控件_设置数值(八连接进度, 0)
            控件_设置文本(八连接状态, "8 连接：等待创建任务。")
        否则
            控件_设置数值(八连接进度, Aria2_取进度(八连接任务))
            如果 (Aria2_取状态(八连接任务) == "已完成")
                控件_设置文本(八连接状态, 格式化文本("8 连接：已完成 · {} 字节/秒\r\n保存目录：{}", Aria2_取下载速度(八连接任务), Aria2_取保存目录(八连接任务)))
                如果 (八连接已记录完成 == 假)
                    写日志(格式化文本("8 连接下载完成，保存目录：{}", Aria2_取保存目录(八连接任务)))
                    八连接已记录完成 = 真
                如果结束
            否则
                控件_设置文本(八连接状态, 格式化文本("8 连接：{} · {}% · {} 字节/秒", Aria2_取状态(八连接任务), Aria2_取进度(八连接任务), Aria2_取下载速度(八连接任务)))
            如果结束
        如果结束

        如果 (十六连接任务 == 0)
            控件_设置数值(十六连接进度, 0)
            控件_设置文本(十六连接状态, "16 连接：等待创建任务。")
        否则
            控件_设置数值(十六连接进度, Aria2_取进度(十六连接任务))
            如果 (Aria2_取状态(十六连接任务) == "已完成")
                控件_设置文本(十六连接状态, 格式化文本("16 连接：已完成 · {} 字节/秒\r\n保存目录：{}", Aria2_取下载速度(十六连接任务), Aria2_取保存目录(十六连接任务)))
                如果 (十六连接已记录完成 == 假)
                    写日志(格式化文本("16 连接下载完成，保存目录：{}", Aria2_取保存目录(十六连接任务)))
                    十六连接已记录完成 = 真
                如果结束
            否则
                控件_设置文本(十六连接状态, 格式化文本("16 连接：{} · {}% · {} 字节/秒", Aria2_取状态(十六连接任务), Aria2_取进度(十六连接任务), Aria2_取下载速度(十六连接任务)))
            如果结束
        如果结束
    结束

    事件 单连接下载进度(Aria2任务 任务, 整数型 进度, 长整数型 已下载字节, 长整数型 总字节, 长整数型 速度字节每秒, 文本型 状态)
        如果 (任务 == 单连接任务)
            控件_设置数值(单连接进度, 进度)
            控件_设置文本(单连接状态, 格式化文本("1 连接：{} · {}% · {} 字节/秒\\r\\n已下载：{} / {} 字节", 状态, 进度, 速度字节每秒, 已下载字节, 总字节))
            如果 (状态 == "已完成")
                如果 (单连接已记录完成 == 假)
                    写日志(格式化文本("1 连接下载完成，保存目录：{}", Aria2_取保存目录(任务)))
                    单连接已记录完成 = 真
                如果结束
            如果结束
        如果结束
    结束

    事件 八连接下载进度(Aria2任务 任务, 整数型 进度, 长整数型 已下载字节, 长整数型 总字节, 长整数型 速度字节每秒, 文本型 状态)
        如果 (任务 == 八连接任务)
            控件_设置数值(八连接进度, 进度)
            控件_设置文本(八连接状态, 格式化文本("8 连接：{} · {}% · {} 字节/秒\\r\\n已下载：{} / {} 字节", 状态, 进度, 速度字节每秒, 已下载字节, 总字节))
            如果 (状态 == "已完成")
                如果 (八连接已记录完成 == 假)
                    写日志(格式化文本("8 连接下载完成，保存目录：{}", Aria2_取保存目录(任务)))
                    八连接已记录完成 = 真
                如果结束
            如果结束
        如果结束
    结束

    事件 十六连接下载进度(Aria2任务 任务, 整数型 进度, 长整数型 已下载字节, 长整数型 总字节, 长整数型 速度字节每秒, 文本型 状态)
        如果 (任务 == 十六连接任务)
            控件_设置数值(十六连接进度, 进度)
            控件_设置文本(十六连接状态, 格式化文本("16 连接：{} · {}% · {} 字节/秒\\r\\n已下载：{} / {} 字节", 状态, 进度, 速度字节每秒, 已下载字节, 总字节))
            如果 (状态 == "已完成")
                如果 (十六连接已记录完成 == 假)
                    写日志(格式化文本("16 连接下载完成，保存目录：{}", Aria2_取保存目录(任务)))
                    十六连接已记录完成 = 真
                如果结束
            如果结束
        如果结束
    结束

    事件 _启动HTTP按钮_被单击()
        HTTP任务 = Aria2_下载(控件_取文本(HTTP地址), "downloads/http", "http-demo.bin", 4, 4)
        设置当前任务(HTTP任务, "HTTP（4 连接）")
    结束

    事件 _启动HTTPS按钮_被单击()
        HTTPS任务 = Aria2_下载(控件_取文本(HTTPS地址), "downloads/https", "https-demo.bin", 4, 4)
        设置当前任务(HTTPS任务, "HTTPS（4 连接）")
    结束

    事件 _启动单连接按钮_被单击()
        单连接已记录完成 = 假
        单连接任务 = Aria2_下载(控件_取文本(并发地址), 控件_取文本(并发保存目录), 控件_取文本(单连接文件名), 1, 8, &单连接下载进度)
        设置当前任务(单连接任务, "单连接下载")
        实时刷新并发任务面板()
    结束

    事件 _启动八连接按钮_被单击()
        八连接已记录完成 = 假
        八连接任务 = Aria2_下载(控件_取文本(并发地址), 控件_取文本(并发保存目录), 控件_取文本(八连接文件名), 8, 8, &八连接下载进度)
        设置当前任务(八连接任务, "8 连接并发下载")
        实时刷新并发任务面板()
    结束

    事件 _启动十六连接按钮_被单击()
        十六连接已记录完成 = 假
        十六连接任务 = Aria2_下载(控件_取文本(并发地址), 控件_取文本(并发保存目录), 控件_取文本(十六连接文件名), 16, 8, &十六连接下载进度)
        设置当前任务(十六连接任务, "16 连接并发下载（模块上限）")
        实时刷新并发任务面板()
    结束

    事件 _打开单连接目录按钮_被单击()
        如果 (单连接任务 == 0)
            写日志("打开 1 连接下载目录：尚未创建任务。")
        否则
            写日志(格式化文本("打开 1 连接下载目录返回={}；目录={}", Aria2_打开目录(单连接任务), Aria2_取保存目录(单连接任务)))
        如果结束
    结束

    事件 _打开八连接目录按钮_被单击()
        如果 (八连接任务 == 0)
            写日志("打开 8 连接下载目录：尚未创建任务。")
        否则
            写日志(格式化文本("打开 8 连接下载目录返回={}；目录={}", Aria2_打开目录(八连接任务), Aria2_取保存目录(八连接任务)))
        如果结束
    结束

    事件 _打开十六连接目录按钮_被单击()
        如果 (十六连接任务 == 0)
            写日志("打开 16 连接下载目录：尚未创建任务。")
        否则
            写日志(格式化文本("打开 16 连接下载目录返回={}；目录={}", Aria2_打开目录(十六连接任务), Aria2_取保存目录(十六连接任务)))
        如果结束
    结束

    事件 _启动FTP按钮_被单击()
        FTP任务 = Aria2_下载(控件_取文本(FTP地址), "downloads/ftp", "ftp-demo.zip", 4, 4)
        设置当前任务(FTP任务, "FTP（4 连接）")
    结束

    事件 _启动磁力按钮_被单击()
        磁力任务 = Aria2_下载(控件_取文本(磁力地址), "downloads/magnet", "magnet-demo", 16, 8)
        设置当前任务(磁力任务, "BT 磁力链接（16 连接上限）")
    结束

    事件 _开始断点下载按钮_被单击()
        断点任务 = Aria2_下载(控件_取文本(断点地址), "downloads/resume", "resume-demo.bin", 8, 8)
        设置当前任务(断点任务, "断点续传：开始下载")
    结束

    事件 _停止断点下载按钮_被单击()
        如果 (断点任务 == 0)
            写日志("断点续传：尚未创建可停止的任务。")
        否则
            写日志(格式化文本("断点续传：停止返回={}；.aria2 元数据将保留。", Aria2_停止(断点任务)))
            当前任务 = 断点任务
            当前任务有效 = 真
            更新当前任务摘要()
        如果结束
    结束

    事件 _继续断点下载按钮_被单击()
        如果 (断点任务 == 0)
            写日志("断点续传：请先开始下载，再停止它以生成可续传数据。")
        否则
            如果 (Aria2_取状态(断点任务) != "已停止")
                写日志("断点续传：当前任务尚未停止，请先点击“停止并保留断点”。")
            否则
                Aria2_释放(断点任务)
                断点任务 = Aria2_下载(控件_取文本(断点地址), "downloads/resume", "resume-demo.bin", 8, 8)
                设置当前任务(断点任务, "断点续传：继续同目录同文件名任务")
            如果结束
        如果结束
    结束

    事件 _查看断点任务按钮_被单击()
        记录任务快照("断点续传任务", 断点任务)
        更新当前任务摘要()
    结束

    事件 _刷新当前任务按钮_被单击()
        记录任务快照("当前任务", 当前任务)
        更新当前任务摘要()
    结束

    事件 _等待当前任务按钮_被单击()
        如果 (当前任务有效 == 假)
            写日志("等待检查：尚未选择任务。")
        否则
            写日志(格式化文本("Aria2_等待(当前任务, 0) 返回={}", Aria2_等待(当前任务, 0)))
            更新当前任务摘要()
        如果结束
    结束

    事件 _停止当前任务按钮_被单击()
        如果 (当前任务有效 == 假)
            写日志("停止任务：尚未选择任务。")
        否则
            写日志(格式化文本("Aria2_停止 返回={}；未完成下载可用同目录同文件名继续。", Aria2_停止(当前任务)))
            更新当前任务摘要()
        如果结束
    结束

    事件 _释放当前任务按钮_被单击()
        如果 (当前任务有效 == 假)
            写日志("释放任务：尚未选择任务。")
        否则
            写日志(格式化文本("Aria2_释放 返回={}", Aria2_释放(当前任务)))
            当前任务有效 = 假
            更新当前任务摘要()
        如果结束
    结束

    事件 _打开下载目录按钮_被单击()
        如果 (当前任务有效 == 假)
            写日志("打开下载目录：尚未选择任务。")
        否则
            写日志(格式化文本("打开下载目录返回={}；目录={}", Aria2_打开目录(当前任务), Aria2_取保存目录(当前任务)))
        如果结束
    结束

    事件 _清空日志按钮_被单击()
        日志序号 = 0
        控件_设置文本(运行日志, "")
    结束
结束类
`;

const readme = `# Aria2 下载模块完整交互演示

此项目用于演示内置模块 \`lingbuilder.net.aria2\` 的全部公开命令和任务生命周期。

## 标签页

- **HTTP / HTTPS**：分别启动 HTTP 与 HTTPS 下载，地址可直接修改。
- **并发下载**：可编辑公共下载地址和保存目录，分别设置 1、8、16 路任务的文件名；三组任务各自显示实时进度、速度、完成后的保存目录，并各有独立的打开目录按钮。
- **FTP 与磁力链接**：演示 FTP 与 BT 磁力链接入口。磁力文本框请替换为有权下载的合法 \`magnet:?\` 链接。
- **断点续传与任务管理**：开始下载、停止并保留 aria2 元数据、在相同保存目录和文件名下继续下载；每 500ms 自动刷新进度条、下载速度、任务目录和完成状态，并提供“打开下载目录”按钮。

## 运行限制

- 仅支持 Windows x64 MSVC 生成项目。
- 多连接实际并行度依赖服务器是否支持 Range 分段下载、文件大小及服务端限制。
- 只可使用 HTTP、HTTPS、FTP、FTPS 和 \`magnet:?\` 地址。
- 生成目录会携带 \`aria2c.exe\`、\`COPYING\` 与 \`NOTICE.md\`。
`;

function projectModules() {
  return {
    schemaVersion: 1,
    enabledModuleIds: [
      'lingbuilder.win32.basic',
      'lingbuilder.win32.common-controls',
      'lingbuilder.net.aria2'
    ],
    pinnedVersions: {
      'lingbuilder.win32.basic': '1.0.0',
      'lingbuilder.win32.common-controls': '1.0.0',
      'lingbuilder.net.aria2': '1.37.0'
    }
  };
}

function createDesignerProject(): LingWindowProject {
  const controls: Record<string, unknown>[] = [];
  const common = {
    fontSize: 11,
    fontFamily: 'Microsoft YaHei UI',
    fontBold: false,
    background: 'transparent',
    foreground: '#0F172A',
    isEnabled: true,
    visibility: 'Visible'
  };
  const add = (
    id: string,
    type: string,
    name: string,
    content: string,
    x: number,
    y: number,
    width: number,
    height: number,
    options: Record<string, unknown> = {}
  ) => controls.push({ id, type, name, content, x, y, width, height, ...common, ...options });
  const label = (id: string, name: string, content: string, x: number, y: number, width: number, height = 26, slot?: string) => add(
    id, 'Label', name, content, x, y, width, height,
    {
      parentId: slot ? '功能选项卡' : undefined,
      containerSlot: slot,
      properties: { staticStyle: 'text', textAlign: 'left' }
    }
  );
  const textBox = (id: string, name: string, content: string, x: number, y: number, width: number, slot: string) => add(
    id, 'TextBox', name, content, x, y, width, 34,
    {
      parentId: '功能选项卡',
      containerSlot: slot,
      background: '#FFFFFF',
      foreground: '#111827',
      properties: { multiline: false, readOnly: false, numeric: false, textAlign: 'left', verticalAlign: 'center', scrollBars: 'none' }
    }
  );
  const button = (id: string, name: string, content: string, x: number, y: number, width: number, slot: string, handler: string) => add(
    id, 'Button', name, content, x, y, width, 42,
    {
      parentId: '功能选项卡',
      containerSlot: slot,
      background: '#2563EB',
      foreground: '#FFFFFF',
      properties: { buttonStyle: 'push' },
      events: { Click: handler }
    }
  );

  add('标题', 'Label', '标题', 'Aria2 下载模块 · 完整交互演示', 24, 16, 650, 32, {
    fontSize: 20,
    fontBold: true,
    foreground: '#F8FAFC',
    properties: { staticStyle: 'text', textAlign: 'left' }
  });
  add('副标题', 'Label', '副标题', 'HTTP / HTTPS / FTP / BT 磁力链接 · 1 / 8 / 16 连接并发 · 断点续传 · 状态与日志', 26, 50, 820, 24, {
    foreground: '#BFDBFE',
    properties: { staticStyle: 'text', textAlign: 'left' }
  });
  add('当前任务摘要', 'Label', '当前任务摘要', '当前任务：未选择', 890, 24, 294, 30, {
    background: '#172554',
    foreground: '#DBEAFE',
    properties: { staticStyle: 'text', textAlign: 'center' }
  });
  add('功能选项卡', 'TabControl', '功能选项卡', '', 24, 88, 1172, 472, {
    background: '#F8FAFC',
    foreground: '#0F172A',
    properties: {
      tabs: [
        { id: 'web', title: 'HTTP / HTTPS', image: -1 },
        { id: 'connections', title: '并发下载', image: -1 },
        { id: 'protocols', title: 'FTP 与磁力链接', image: -1 },
        { id: 'resume', title: '断点续传与任务管理', image: -1 }
      ],
      selectedIndex: 0,
      hideHeader: false,
      imageListId: ''
    }
  });

  label('web-title', '网页下载标题', 'HTTP 与 HTTPS：两个按钮分别创建独立下载任务，默认使用 4 路连接、4 MB 最小分段。', 26, 22, 1080, 30, 'web');
  label('http-label', 'HTTP地址标签', 'HTTP 地址（可编辑）', 26, 64, 220, 24, 'web');
  textBox('HTTP地址', 'HTTP地址', 'http://speedtest.tele2.net/10MB.zip', 26, 90, 1080, 'web');
  label('https-label', 'HTTPS地址标签', 'HTTPS 地址（可编辑）', 26, 142, 220, 24, 'web');
  textBox('HTTPS地址', 'HTTPS地址', 'https://proof.ovh.net/files/10Mb.dat', 26, 168, 1080, 'web');
  button('start-http', '启动HTTP按钮', '启动 HTTP（4 连接）', 26, 226, 248, 'web', '_启动HTTP按钮_被单击');
  button('start-https', '启动HTTPS按钮', '启动 HTTPS（4 连接）', 290, 226, 248, 'web', '_启动HTTPS按钮_被单击');
  label('web-note', '网页下载提示', '下载地址由服务端决定是否支持分段；可在“断点续传与任务管理”页刷新、等待、停止或释放当前任务。', 26, 296, 1080, 40, 'web');

  // TabControl 页内容从约 y=111 开始；地址与目录控件必须落在可见内容区内。
  label('connections-label', '并发地址标签', '下载地址（支持 Range 分段的 HTTP / HTTPS 地址，可编辑）', 26, 114, 520, 20, 'connections');
  textBox('并发地址', '并发地址', 'https://proof.ovh.net/files/100Mb.dat', 26, 138, 1080, 'connections');
  label('connections-directory-label', '并发保存目录标签', '保存目录（可编辑；三个任务使用此目录）', 26, 174, 420, 18, 'connections');
  textBox('并发保存目录', '并发保存目录', 'downloads/connections', 26, 196, 1080, 'connections');
  label('one-file-label', '单连接文件名标签', '1 连接文件名', 26, 232, 340, 18, 'connections');
  label('eight-file-label', '八连接文件名标签', '8 连接文件名', 392, 232, 340, 18, 'connections');
  label('sixteen-file-label', '十六连接文件名标签', '16 连接文件名', 758, 232, 340, 18, 'connections');
  textBox('单连接文件名', '单连接文件名', 'connection-1.bin', 26, 254, 340, 'connections');
  textBox('八连接文件名', '八连接文件名', 'connection-8.bin', 392, 254, 340, 'connections');
  textBox('十六连接文件名', '十六连接文件名', 'connection-16.bin', 758, 254, 340, 'connections');
  button('start-one', '启动单连接按钮', '启动 1 连接下载', 26, 290, 340, 'connections', '_启动单连接按钮_被单击');
  button('start-eight', '启动八连接按钮', '启动 8 连接下载', 392, 290, 340, 'connections', '_启动八连接按钮_被单击');
  button('start-sixteen', '启动十六连接按钮', '启动 16 连接下载（上限）', 758, 290, 340, 'connections', '_启动十六连接按钮_被单击');
  add('single-progress', 'ProgressBar', '单连接进度', '0', 26, 334, 340, 20, {
    parentId: '功能选项卡', containerSlot: 'connections', background: '#E2E8F0', foreground: '#2563EB',
    properties: { minimum: 0, maximum: 100, value: 0, marquee: false, toolTip: '1 连接任务下载进度', toolTipDelay: 500 }
  });
  add('eight-progress', 'ProgressBar', '八连接进度', '0', 392, 334, 340, 20, {
    parentId: '功能选项卡', containerSlot: 'connections', background: '#E2E8F0', foreground: '#2563EB',
    properties: { minimum: 0, maximum: 100, value: 0, marquee: false, toolTip: '8 连接任务下载进度', toolTipDelay: 500 }
  });
  add('sixteen-progress', 'ProgressBar', '十六连接进度', '0', 758, 334, 340, 20, {
    parentId: '功能选项卡', containerSlot: 'connections', background: '#E2E8F0', foreground: '#2563EB',
    properties: { minimum: 0, maximum: 100, value: 0, marquee: false, toolTip: '16 连接任务下载进度', toolTipDelay: 500 }
  });
  for (const [id, name, content, x] of [
    ['single-status', '单连接状态', '1 连接：等待创建任务。', 26],
    ['eight-status', '八连接状态', '8 连接：等待创建任务。', 392],
    ['sixteen-status', '十六连接状态', '16 连接：等待创建任务。', 758]
  ] as const) {
    add(id, 'TextBox', name, content, x, 358, 340, 42, {
      parentId: '功能选项卡', containerSlot: 'connections', background: '#FFFFFF', foreground: '#111827',
      properties: { multiline: true, readOnly: true, numeric: false, textAlign: 'left', verticalAlign: 'top', scrollBars: 'vertical' }
    });
  }
  button('open-one-directory', '打开单连接目录按钮', '打开 1 连接下载目录', 26, 404, 340, 'connections', '_打开单连接目录按钮_被单击');
  button('open-eight-directory', '打开八连接目录按钮', '打开 8 连接下载目录', 392, 404, 340, 'connections', '_打开八连接目录按钮_被单击');
  button('open-sixteen-directory', '打开十六连接目录按钮', '打开 16 连接下载目录', 758, 404, 340, 'connections', '_打开十六连接目录按钮_被单击');

  label('protocols-title', '协议下载标题', 'FTP 与 BT 磁力链接：每种协议各有一个独立启动按钮。BT 使用 aria2 的 magnet 输入，不提供本地 .torrent 文件参数。', 26, 22, 1080, 30, 'protocols');
  label('ftp-label', 'FTP地址标签', 'FTP / FTPS 地址（可编辑）', 26, 64, 300, 24, 'protocols');
  textBox('FTP地址', 'FTP地址', 'ftp://speedtest.tele2.net/1MB.zip', 26, 90, 1080, 'protocols');
  label('magnet-label', '磁力地址标签', 'BT 磁力链接（请替换为有权下载的合法 magnet:? 地址）', 26, 142, 560, 24, 'protocols');
  textBox('磁力地址', '磁力地址', 'magnet:?xt=urn:btih:请替换为合法资源的哈希&dn=合法演示资源', 26, 168, 1080, 'protocols');
  button('start-ftp', '启动FTP按钮', '启动 FTP（4 连接）', 26, 226, 248, 'protocols', '_启动FTP按钮_被单击');
  button('start-magnet', '启动磁力按钮', '启动 BT 磁力链接', 290, 226, 248, 'protocols', '_启动磁力按钮_被单击');
  label('protocols-note', '协议下载提示', '请仅下载你有权获取的资源。磁力任务的实际连接方式由 torrent swarm、tracker 与网络环境决定。', 26, 296, 1080, 40, 'protocols');

  label('resume-title', '断点续传标题', '断点续传与任务管理：先开始，再停止并保留 .aria2 元数据，最后以同目录、同文件名继续下载。', 26, 22, 1080, 30, 'resume');
  label('resume-label', '断点地址标签', '支持 Range 的 HTTPS 地址（可编辑）', 26, 64, 360, 24, 'resume');
  textBox('断点地址', '断点地址', 'https://proof.ovh.net/files/100Mb.dat', 26, 90, 1080, 'resume');
  button('start-resume', '开始断点下载按钮', '开始可续传下载', 26, 148, 220, 'resume', '_开始断点下载按钮_被单击');
  button('stop-resume', '停止断点下载按钮', '停止并保留断点', 262, 148, 220, 'resume', '_停止断点下载按钮_被单击');
  button('continue-resume', '继续断点下载按钮', '继续未完成下载', 498, 148, 220, 'resume', '_继续断点下载按钮_被单击');
  button('show-resume', '查看断点任务按钮', '查看断点任务状态', 734, 148, 220, 'resume', '_查看断点任务按钮_被单击');
  label('management-title', '任务管理标题', '当前任务面板每 500ms 自动刷新。下载完成时会在日志中记录实际保存目录。', 26, 214, 1080, 24, 'resume');
  add('当前任务进度', 'ProgressBar', '当前任务进度', '0', 26, 246, 1080, 22, {
    parentId: '功能选项卡',
    containerSlot: 'resume',
    background: '#E2E8F0',
    foreground: '#2563EB',
    properties: { minimum: 0, maximum: 100, value: 0, marquee: false, toolTip: '当前任务下载进度', toolTipDelay: 500 }
  });
  add('current-detail', 'TextBox', '当前任务详情', '等待创建下载任务。', 26, 278, 1080, 48, {
    parentId: '功能选项卡',
    containerSlot: 'resume',
    background: '#FFFFFF',
    foreground: '#111827',
    properties: { multiline: true, readOnly: true, numeric: false, textAlign: 'left', verticalAlign: 'top', scrollBars: 'vertical' }
  });
  button('refresh-current', '刷新当前任务按钮', '手动刷新任务面板', 26, 344, 200, 'resume', '_刷新当前任务按钮_被单击');
  button('wait-current', '等待当前任务按钮', 'Aria2_等待(0) 检查', 242, 344, 180, 'resume', '_等待当前任务按钮_被单击');
  button('stop-current', '停止当前任务按钮', '停止当前任务', 438, 344, 160, 'resume', '_停止当前任务按钮_被单击');
  button('release-current', '释放当前任务按钮', '释放当前任务句柄', 614, 344, 170, 'resume', '_释放当前任务按钮_被单击');
  button('open-directory', '打开下载目录按钮', '打开下载目录', 800, 344, 180, 'resume', '_打开下载目录按钮_被单击');
  button('clear-log', '清空日志按钮', '清空日志', 996, 344, 110, 'resume', '_清空日志按钮_被单击');

  add('日志标题', 'Label', '日志标题', '运行日志', 24, 578, 220, 24, {
    fontSize: 13,
    fontBold: true,
    foreground: '#E2E8F0',
    properties: { staticStyle: 'text', textAlign: 'left' }
  });
  add('运行日志', 'TextBox', '运行日志', '', 24, 606, 1172, 196, {
    fontFamily: 'Consolas',
    fontSize: 11,
    background: '#0B1220',
    foreground: '#D1FAE5',
    properties: { multiline: true, readOnly: true, numeric: false, textAlign: 'left', verticalAlign: 'top', scrollBars: 'vertical' }
  });
  add('页脚', 'Label', '页脚', '提示：所有下载均使用随生成程序分发的 aria2c.exe，不读取系统 PATH，也不接受任意命令行参数。', 26, 814, 1120, 24, {
    foreground: '#94A3B8',
    properties: { staticStyle: 'text', textAlign: 'left' }
  });

  return {
    schemaVersion: 2,
    id: projectId,
    name: 'Aria2 下载模块完整交互演示',
    resources: [],
    windows: [{
      id: 'main-window',
      fileName: 'MainWindow.xml',
      className: 'MainWindow',
      title: 'LingBuilder Aria2 下载模块 · 完整交互演示',
      width: 1220,
      height: 880,
      background: '#0F172A',
      titleBarBackground: '#020617',
      titleBarForeground: '#F8FAFC',
      description: 'HTTP、HTTPS、FTP、BT 磁力链接、多连接并发与断点续传的 Aria2 模块完整演示。',
      designerBackend: 'win32',
      openPlacement: 'center',
      resizable: true,
      maximizable: true,
      events: { Loaded: '_MainWindow_创建完毕' },
      controls
    }]
  } as unknown as LingWindowProject;
}

async function writeJson(targetPath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function writeDemoWorkspace(): Promise<void> {
  const sourceRoot = path.join(demoRoot, 'src', projectId);
  await fs.mkdir(sourceRoot, { recursive: true });
  await fs.mkdir(path.join(demoRoot, 'config', projectId), { recursive: true });
  await fs.writeFile(path.join(sourceRoot, 'MainWindow.lcpp'), mainSource, 'utf8');
  await fs.writeFile(path.join(sourceRoot, '项目数据类型.lcpp'), '// 本示例不需要项目级自定义数据类型。\n', 'utf8');
  await fs.writeFile(path.join(sourceRoot, '项目全局变量.lcpp'), '// 本示例的 Aria2 任务句柄保存在 MainWindow 类成员中。\n', 'utf8');
  await fs.writeFile(path.join(sourceRoot, 'README.md'), readme, 'utf8');
  await fs.writeFile(path.join(demoRoot, 'config', projectId, 'config.ini'), '[aria2-demo]\nname=Aria2 下载模块完整交互演示\n', 'utf8');
  await writeJson(path.join(demoRoot, '.lingbuilder', 'solution.json'), {
    schemaVersion: 2,
    id: 'aria2-complete-demo',
    name: 'Aria2 下载模块完整交互演示',
    startupProjectId: projectId,
    startupProjectIds: [projectId],
    projects: [{
      type: 'visual-cpp',
      id: projectId,
      name: 'Aria2 下载模块完整交互演示',
      sourceRoot: `src/${projectId}`,
      configRoot: `config/${projectId}`,
      designerPath: `.lingbuilder/projects/${projectId}/window-designer.json`,
      isDefault: true,
      references: []
    }]
  });
  await writeJson(path.join(demoRoot, '.lingbuilder', 'projects', projectId, 'project-modules.json'), projectModules());
  await writeJson(path.join(demoRoot, '.lingbuilder', 'projects', projectId, 'window-designer.json'), createDesignerProject());
}

function builtin(moduleId: string): InstalledModule {
  const manifest = BUILTIN_MODULES.find(item => item.id === moduleId);
  if (!manifest) throw new Error(`缺少内置模块：${moduleId}`);
  return { manifest, installPath: `builtin://${moduleId}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
}

async function validateDemo(): Promise<{
  project: LingWindowProject;
  buttonCount: number;
  generatedFileCount: number;
  generatedFiles: ReturnType<typeof generateLingCppNativeWin32Project>['files'];
  enabledModules: InstalledModule[];
}> {
  const sourceRoot = path.join(demoRoot, 'src', projectId);
  const designerPath = path.join(demoRoot, '.lingbuilder', 'projects', projectId, 'window-designer.json');
  const source = await fs.readFile(path.join(sourceRoot, 'MainWindow.lcpp'), 'utf8');
  const project = JSON.parse(await fs.readFile(designerPath, 'utf8')) as LingWindowProject;
  const missingCommands = ARIA2_COMMAND_SPECS.map(command => command.name).filter(command => !source.includes(`${command}(`));
  if (missingCommands.length > 0) throw new Error(`演示源码缺少 Aria2 命令：${missingCommands.join('、')}`);

  const window = project.windows[0];
  assert.ok(window, '演示项目缺少主窗口。');
  const tabControl = window.controls.find(control => control.type === 'TabControl');
  assert.ok(tabControl, '演示界面缺少 TabControl。');
  const tabs = Array.isArray(tabControl.properties?.tabs) ? tabControl.properties.tabs : [];
  assert.equal(tabs.length, 4, '演示界面必须包含 4 个功能标签页。');
  const logControl = window.controls.find(control => control.name === '运行日志');
  assert.equal(logControl?.type, 'TextBox', '演示界面缺少日志文本框。');
  assert.equal(logControl?.properties?.multiline, true, '运行日志必须为多行文本框。');
  const progressControl = window.controls.find(control => control.name === '当前任务进度');
  assert.equal(progressControl?.type, 'ProgressBar', '演示界面缺少当前任务进度条。');
  assert.equal(progressControl?.properties?.minimum, 0, '当前任务进度条最小值必须为 0。');
  assert.equal(progressControl?.properties?.maximum, 100, '当前任务进度条最大值必须为 100。');
  const detailControl = window.controls.find(control => control.name === '当前任务详情');
  assert.equal(detailControl?.type, 'TextBox', '演示界面缺少下载速度与保存目录详情框。');
  assert.equal(detailControl?.properties?.multiline, true, '当前任务详情框必须支持多行目录显示。');
  assert.equal(detailControl?.properties?.readOnly, true, '当前任务详情框必须为只读。');
  const buttons = window.controls.filter(control => control.type === 'Button');
  assert.equal(buttons.length, 20, `演示按钮数量不正确：${buttons.length}`);
  const handlers = new Set<string>();
  for (const button of buttons) {
    const click = button.events?.Click;
    assert.equal(typeof click, 'string', `按钮 ${button.name} 没有独立点击事件。`);
    assert.ok(!handlers.has(click as string), `按钮事件重复绑定：${String(click)}`);
    handlers.add(click as string);
    assert.match(source, new RegExp(`事件\\s+${String(click).replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\s*\\(`, 'u'), `按钮 ${button.name} 缺少事件实现。`);
    const page = tabs.find(tab => String((tab as { id?: unknown }).id || '') === button.containerSlot);
    assert.ok(page, `按钮 ${button.name} 未放入有效标签页。`);
    assert.ok(button.x >= 0 && button.y >= 0 && button.x + button.width <= tabControl.width && button.y + button.height <= tabControl.height,
      `按钮 ${button.name} 越出标签页可视区域。`);
  }

  const openDirectoryButton = buttons.find(button => button.name === '打开下载目录按钮');
  assert.equal(openDirectoryButton?.events?.Click, '_打开下载目录按钮_被单击', '打开下载目录必须使用独立按钮事件。');
  assert.match(source, /Aria2_打开目录\(当前任务\)/u, '打开下载目录按钮没有调用受控任务目录接口。');
  assert.match(source, /Aria2_取下载速度\(当前任务\)/u, '当前任务面板没有刷新下载速度。');
  assert.match(source, /Aria2_取保存目录\(当前任务\)/u, '当前任务面板没有刷新保存目录。');
  for (const item of [
    { file: '单连接文件名', progress: '单连接进度', status: '单连接状态', button: '打开单连接目录按钮', handler: '_打开单连接目录按钮_被单击', task: '单连接任务' },
    { file: '八连接文件名', progress: '八连接进度', status: '八连接状态', button: '打开八连接目录按钮', handler: '_打开八连接目录按钮_被单击', task: '八连接任务' },
    { file: '十六连接文件名', progress: '十六连接进度', status: '十六连接状态', button: '打开十六连接目录按钮', handler: '_打开十六连接目录按钮_被单击', task: '十六连接任务' }
  ]) {
    assert.equal(window.controls.find(control => control.name === item.file)?.type, 'TextBox', `${item.file} 必须可编辑。`);
    assert.equal(window.controls.find(control => control.name === item.progress)?.type, 'ProgressBar', `${item.progress} 必须存在。`);
    const status = window.controls.find(control => control.name === item.status);
    assert.equal(status?.type, 'TextBox', `${item.status} 必须显示任务状态与完成目录。`);
    assert.equal(status?.properties?.multiline, true, `${item.status} 必须支持显示完成目录。`);
    assert.equal(status?.properties?.readOnly, true, `${item.status} 必须为只读。`);
    assert.equal(buttons.find(button => button.name === item.button)?.events?.Click, item.handler, `${item.button} 必须有独立目录打开事件。`);
    assert.match(source, new RegExp(`Aria2_打开目录\\(${item.task}\\)`, 'u'), `${item.button} 没有打开对应任务目录。`);
    assert.match(source, new RegExp(`Aria2_取下载速度\\(${item.task}\\)`, 'u'), `${item.status} 没有刷新下载速度。`);
    assert.match(source, new RegExp(`Aria2_取保存目录\\(${item.task}\\)`, 'u'), `${item.status} 没有显示完成目录。`);
  }
  assert.equal(window.controls.find(control => control.name === '并发地址')?.type, 'TextBox', '并发下载页必须提供下载地址输入框。');
  assert.equal(window.controls.find(control => control.name === '并发保存目录')?.type, 'TextBox', '并发下载页必须提供保存目录输入框。');
  const connectionAddress = window.controls.find(control => control.name === '并发地址');
  const connectionDirectory = window.controls.find(control => control.name === '并发保存目录');
  assert.ok((connectionAddress?.y || 0) >= 111, '并发地址输入框必须位于 TabControl 的可见内容区。');
  assert.ok((connectionDirectory?.y || 0) >= 111, '并发保存目录输入框必须位于 TabControl 的可见内容区。');
  for (const handler of ['单连接下载进度', '八连接下载进度', '十六连接下载进度']) {
    assert.match(source, new RegExp(`事件\\s+${handler}\\s*\\(Aria2任务`, 'u'), `${handler} 必须声明为 Aria2 进度事件。`);
    assert.match(source, new RegExp(`Aria2_下载\\([^\\n]+&${handler}\\)`, 'u'), `${handler} 必须通过 &处理器名 传入 Aria2_下载。`);
  }
  for (let index = 0; index < buttons.length; index += 1) {
    for (let next = index + 1; next < buttons.length; next += 1) {
      const left = buttons[index];
      const right = buttons[next];
      if (left.containerSlot !== right.containerSlot) continue;
      const overlaps = left.x < right.x + right.width && left.x + left.width > right.x && left.y < right.y + right.height && left.y + left.height > right.y;
      assert.equal(overlaps, false, `标签页 ${left.containerSlot} 的按钮 ${left.name} 与 ${right.name} 重叠。`);
    }
  }

  const enabledModules = [
    builtin('lingbuilder.win32.basic'),
    builtin('lingbuilder.win32.common-controls'),
    builtin('lingbuilder.net.aria2')
  ];
  const generated = generateLingCppNativeWin32Project(project, {
    activeWindowId: window.id,
    lingCppSources: [
      { filePath: `src/${projectId}/MainWindow.lcpp`, sourceCode: source },
      { filePath: `src/${projectId}/项目数据类型.lcpp`, sourceCode: await fs.readFile(path.join(sourceRoot, '项目数据类型.lcpp'), 'utf8') },
      { filePath: `src/${projectId}/项目全局变量.lcpp`, sourceCode: await fs.readFile(path.join(sourceRoot, '项目全局变量.lcpp'), 'utf8') }
    ],
    enabledModules
  });
  if (generated.blockingDiagnostics.length > 0) throw new Error(`演示源码存在阻断诊断：\n${generated.blockingDiagnostics.join('\n')}`);
  const generatedMain = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.ok(generatedMain, '演示项目未生成 main.cpp。');
  for (const token of ['Aria2_下载_窗口', 'DispatchAria2ProgressEvent', 'LingAria2::ProgressMessage']) {
    assert.ok(generatedMain.includes(token), `演示项目未生成 Aria2 进度回调桥：${token}`);
  }
  return { project, buttonCount: buttons.length, generatedFileCount: generated.files.length, generatedFiles: generated.files, enabledModules };
}

async function verifyNativeBuild(
  project: LingWindowProject,
  generatedFiles: ReturnType<typeof generateLingCppNativeWin32Project>['files'],
  enabledModules: InstalledModule[]
): Promise<string[]> {
  const buildRoot = path.join(repositoryRoot, '.lingbuilder-build', 'aria2-api-demo-verify');
  if (!buildRoot.startsWith(`${repositoryRoot}${path.sep}`)) throw new Error('原生验证目录越出工作区。');
  await fs.rm(buildRoot, { recursive: true, force: true });
  await fs.mkdir(buildRoot, { recursive: true });
  for (const file of generatedFiles) {
    const target = path.resolve(buildRoot, file.relativePath);
    if (!target.startsWith(`${buildRoot}${path.sep}`)) throw new Error(`生成文件越界：${file.relativePath}`);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, file.content, 'utf8');
  }
  const defaultIcon = path.join(repositoryRoot, 'image', 'lingbuilder-ide-icon-v2.ico');
  await fs.mkdir(path.join(buildRoot, 'resources'), { recursive: true });
  await fs.copyFile(defaultIcon, path.join(buildRoot, 'resources', 'lingbuilder-app.ico'));

  const exported = await exportVisualStudioProject({
    projectDir: buildRoot,
    projectId: project.id,
    generatedFiles,
    enabledModules
  });
  const vswhere = path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');
  const installation = (await execFileAsync(vswhere, [
    '-latest', '-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath'
  ], { windowsHide: true })).stdout.trim();
  if (!installation) throw new Error('未找到包含 MSVC C++ 工具链的 Visual Studio。');
  const msbuild = path.join(installation, 'MSBuild', 'Current', 'Bin', 'MSBuild.exe');
  try {
    await execFileAsync(msbuild, [
      exported.solutionPath,
      '/m',
      '/t:Build',
      '/p:Configuration=Release',
      '/p:Platform=x64',
      '/v:minimal'
    ], { cwd: buildRoot, windowsHide: true, timeout: 10 * 60 * 1000, maxBuffer: 32 * 1024 * 1024 });
  } catch (error) {
    const failure = error as NodeJS.ErrnoException & { stdout?: string; stderr?: string };
    throw new Error(`Aria2 演示项目 MSVC 编译失败：\n${failure.stdout || ''}\n${failure.stderr || ''}`.trim());
  }
  return ['x64'];
}

async function verifyPackage(): Promise<{ packageBytes: number; packageSha256: string; fileCount: number }> {
  const service = createLcppSourcePackageService(demoRoot);
  const exported = await service.exportProject(projectId, exportPath, '0.3.0');
  const preview = await service.inspectPackage(exportPath);
  assert.ok(preview.manifest.modules.some(module => module.id === 'lingbuilder.net.aria2' && module.builtin), '源码包缺少 Aria2 内置模块声明。');
  const importParent = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-aria2-demo-import-'));
  try {
    const imported = await service.importPackage(exportPath, importParent);
    await fs.access(path.join(imported.workspacePath, 'src', projectId, 'MainWindow.lcpp'));
    await fs.access(path.join(imported.workspacePath, '.lingbuilder', 'projects', projectId, 'window-designer.json'));
  } finally {
    await fs.rm(importParent, { recursive: true, force: true });
  }
  return { packageBytes: preview.totalBytes, packageSha256: preview.packageSha256, fileCount: exported.fileCount };
}

async function main(): Promise<void> {
  const replace = process.argv.includes('--replace');
  const verifyNative = process.argv.includes('--verify-native');
  if (await exists(exportPath)) {
    if (!replace) throw new Error(`目标源码包已存在，拒绝覆盖：${exportPath}`);
  }
  await writeDemoWorkspace();
  const validation = await validateDemo();
  const nativePlatforms = verifyNative
    ? await verifyNativeBuild(validation.project, validation.generatedFiles, validation.enabledModules)
    : [];
  if (await exists(exportPath)) await fs.rm(exportPath, { force: true });
  const packaged = await verifyPackage();
  console.log(JSON.stringify({
    ok: true,
    packagePath: exportPath,
    tabCount: 4,
    buttonCount: validation.buttonCount,
    generatedFileCount: validation.generatedFileCount,
    nativePlatforms,
    packageBytes: packaged.packageBytes,
    packageSha256: packaged.packageSha256,
    packagedFiles: packaged.fileCount
  }, null, 2));
}

async function exists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
