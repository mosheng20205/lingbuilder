$ErrorActionPreference = 'Stop'

# 所有项目路径都相对于仓库根目录，避免从 electron/ 调用时误读 electron/.lingbuilder。
$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location -LiteralPath $workspaceRoot

$base = 'http://127.0.0.1:17863/api/ai-bridge'
$headers = @{ Authorization = 'Bearer module-cli-smoke-20260723' }

function Invoke-BridgePost([string]$path, [string]$json) {
  Write-Host "请求 $path JSON 字符数：$($json.Length)"
  return Invoke-RestMethod -Method Post -Uri "$base/$path" -Headers $headers -ContentType 'application/json; charset=utf-8' -Body $json
}

function ConvertTo-JsonString([AllowEmptyString()][string]$value) {
  return ConvertTo-Json -InputObject $value -Compress
}

$solutionPath = '.lingbuilder/solution.json'
$solutionOriginal = Get-Content -LiteralPath $solutionPath -Raw -Encoding UTF8
$solution = $solutionOriginal | ConvertFrom-Json
if (-not ($solution.projects | Where-Object id -eq 'module-cli-smoke')) {
  $solution.projects += [pscustomobject]@{
    type = 'visual-cpp'
    id = 'module-cli-smoke'
    name = '新增模块 CLI 冒烟测试'
    sourceRoot = 'examples/module-cli-smoke/src'
    configRoot = 'examples/module-cli-smoke/config'
    designerPath = '.lingbuilder/projects/module-cli-smoke/window-designer.json'
    isDefault = $false
    references = @()
  }
}
Write-Output '准备解决方案草稿...'
$solutionUpdated = $solution | ConvertTo-Json -Depth 8

$moduleIds = @(
  'lingbuilder.win32.basic',
  'lingbuilder.std.text', 'lingbuilder.std.bytes', 'lingbuilder.std.encoding', 'lingbuilder.std.math', 'lingbuilder.std.datetime', 'lingbuilder.std.regex', 'lingbuilder.data.json', 'lingbuilder.data.xml',
  'lingbuilder.fs.core', 'lingbuilder.fs.path', 'lingbuilder.config.ini', 'lingbuilder.config.registry', 'lingbuilder.system.info', 'lingbuilder.system.disk', 'lingbuilder.system.clipboard', 'lingbuilder.system.shell', 'lingbuilder.process', 'lingbuilder.input.keyboard', 'lingbuilder.input.mouse', 'lingbuilder.win32.window-utils', 'lingbuilder.win32.monitor',
  'lingbuilder.net.http-client', 'lingbuilder.net.tcp', 'lingbuilder.net.udp', 'lingbuilder.net.dns', 'lingbuilder.net.url', 'lingbuilder.net.cookie', 'lingbuilder.net.ftp',
  'lingbuilder.data.csv', 'lingbuilder.crypto.hash', 'lingbuilder.crypto.windows', 'lingbuilder.database.odbc', 'lingbuilder.database.sqlite', 'lingbuilder.image.core', 'lingbuilder.image.capture', 'lingbuilder.image.bitmap', 'lingbuilder.image.icon', 'lingbuilder.image.recognition', 'lingbuilder.media.audio',
  'lingbuilder.archive', 'lingbuilder.net.mail', 'lingbuilder.ipc', 'lingbuilder.win32.menu', 'lingbuilder.win32.tray', 'lingbuilder.win32.accessibility', 'lingbuilder.advanced.memory', 'lingbuilder.advanced.hook', 'lingbuilder.advanced.process-memory', 'lingbuilder.advanced.com', 'lingbuilder.advanced.assembly', 'lingbuilder.advanced.driver'
)
$pinned = [ordered]@{}
foreach ($id in $moduleIds) { $pinned[$id] = '1.0.0' }
Write-Output '准备模块引用草稿...'
$projectModules = [ordered]@{ schemaVersion = 1; enabledModuleIds = $moduleIds; pinnedVersions = $pinned } | ConvertTo-Json -Depth 8

$designerObject = [ordered]@{
  schemaVersion = 2
  id = 'module-cli-smoke'
  name = '新增模块 CLI 冒烟测试'
  windows = @([ordered]@{
    id = 'module-smoke-main'
    fileName = 'ModuleSmokeMain.xml'
    className = '模块功能测试窗体'
    title = 'LingBuilder 新增模块 CLI 冒烟测试'
    width = 760
    height = 420
    background = '#1E1E24'
    description = '通过 LingBuilder CLI 验证新增模块的项目引用、诊断、生成、编译和确定性运行时功能。'
    events = [ordered]@{ Loaded = '_模块功能测试窗体_创建完毕' }
    controls = @()
  })
  resources = @()
}
Write-Output '准备设计器草稿...'
$designer = $designerObject | ConvertTo-Json -Depth 8

$source = @'
包 新增模块CLI测试
使用 Win32窗口基础模块
使用 文本处理模块
使用 字节与十六进制模块
使用 编码转换模块
使用 数学与随机模块
使用 日期时间模块
使用 正则表达式模块
使用 JSON数据模块
使用 XML文本模块
使用 文件目录模块
使用 路径处理模块
使用 INI配置模块
使用 系统信息模块
使用 磁盘信息模块
使用 进程管理模块
使用 显示器与DPI模块
使用 DNS与IP模块
使用 URL解析模块
使用 Cookie文本模块
使用 CSV数据模块
使用 哈希摘要模块
使用 Windows数据保护模块
使用 SQLite数据库桥接模块
使用 基础识图模块
使用 位图像素模块
使用 受控内存模块
使用 CPU指令能力模块

类 模块功能测试窗体 : 窗口
公开
  事件 _模块功能测试窗体_创建完毕()
    调试输出("开始执行新增模块 CLI 冒烟测试")

    // 下列普通中文调用用于验证模块命令诊断与中文命令到 C++ binding。
    文本_取长度("中文")
    编码_Base64编码("LingBuilder")
    数学_平方根(81)
    JSON_是否有效("{}")
    路径_取扩展名("demo.txt")
    URL_取主机("https://example.com/path")
    哈希_SHA256文本("abc")
    CPU_取厂商()

    @ int passed = 0;
    @ int failed = 0;
    @ std::wstring report = L"LingBuilder 新增模块 CLI 冒烟测试\r\n================================\r\n";
    @ auto check = [&](bool ok, const wchar_t* name) { report += ok ? L"[PASS] " : L"[FAIL] "; report += name; report += L"\r\n"; if (ok) ++passed; else ++failed; };
    @ check(文本_取长度(L"中文IDE") == 5, L"文本_取长度");
    @ check(std::wstring(文本_替换(L"A+B", L"+", L"-")) == L"A-B", L"文本_替换");
    @ std::wstring hexText = 字节_文本转十六进制(L"中文");
    @ check(字节_十六进制是否有效(hexText.c_str()) && std::wstring(字节_十六进制转文本(hexText.c_str())) == L"中文", L"字节十六进制往返");
    @ std::wstring base64Text = 编码_Base64编码(L"LingBuilder中文");
    @ check(std::wstring(编码_Base64解码(base64Text.c_str())) == L"LingBuilder中文", L"Base64 UTF-8 往返");
    @ std::wstring encodedUrlText = 编码_URL编码(L"中文 空格");
    @ check(std::wstring(编码_URL解码(encodedUrlText.c_str())) == L"中文 空格", L"URL 编解码");
    @ check(数学_平方根(81.0) == 9.0 && 数学_限制范围(120.0, 0.0, 100.0) == 100.0, L"数学函数");
    @ int randomValue = 数学_随机整数(3, 7);
    @ check(randomValue >= 3 && randomValue <= 7, L"随机整数边界");
    @ check(时间_当前时间戳() > 1700000000LL && wcslen(时间_格式化当前(L"%Y-%m-%d")) == 10, L"日期时间");
    @ check(正则_完全匹配(L"12345", L"[0-9]+") && 正则_匹配数量(L"a1b2c3", L"[0-9]") == 3, L"正则表达式");
    @ const wchar_t* jsonText = L"{\"name\":\"LingBuilder\",\"count\":7,\"ok\":true}";
    @ check(JSON_是否有效(jsonText) && std::wstring(JSON_取文本(jsonText, L"name")) == L"LingBuilder" && JSON_取整数(jsonText, L"count", 0) == 7, L"JSON 数据");
    @ std::wstring xmlText = XML_生成节点(L"名称", L"中文<&>");
    @ check(XML_是否包含节点(xmlText.c_str(), L"名称") && std::wstring(XML_取节点文本(xmlText.c_str(), L"名称")) == L"中文<&>", L"XML 文本");
    @ check(std::wstring(路径_取扩展名(L"data/report.txt")) == L".txt" && std::wstring(路径_取文件名(L"data/report.txt")) == L"report.txt", L"路径处理");
    @ const wchar_t* dataFile = L"module-cli-smoke-data.txt";
    @ check(文件_写入文本(dataFile, L"模块文件测试") && 文件_是否存在(dataFile), L"文件写入与存在");
    @ check(std::wstring(文件_读取文本(dataFile)) == L"模块文件测试" && 文件_取大小(dataFile) > 0, L"文件读取与大小");
    @ const wchar_t* iniFile = L"module-cli-smoke.ini";
    @ check(INI_写整数(iniFile, L"测试", L"数量", 42) && INI_读整数(iniFile, L"测试", L"数量", 0) == 42, L"INI 读写");
    @ check(系统_取处理器数量() > 0 && wcslen(系统_取用户名()) > 0 && wcslen(系统_取临时目录()) > 0, L"系统信息");
    @ check(磁盘_总容量MB(L".") > 0 && 磁盘_可用容量MB(L".") >= 0, L"磁盘信息");
    @ int currentPid = 进程_取当前ID();
    @ check(currentPid > 0 && 进程_是否运行(currentPid), L"进程状态");
    @ check(显示器_数量() > 0 && 显示器_主屏宽度() > 0 && 显示器_系统DPI() >= 96, L"显示器与 DPI");
    @ check(!std::wstring(DNS_解析首个地址(L"localhost")).empty(), L"DNS localhost 解析");
    @ const wchar_t* url = L"https://example.com:443/path?q=1";
    @ check(URL_是否有效(url) && URL_是否HTTPS(url) && std::wstring(URL_取主机(url)) == L"example.com", L"URL 解析");
    @ std::wstring cookieText = Cookie_设置(L"a=1; b=2", L"b", L"中文");
    @ check(Cookie_是否存在(cookieText.c_str(), L"b") && std::wstring(Cookie_取值(cookieText.c_str(), L"b")) == L"中文", L"Cookie 文本");
    @ std::wstring csvLine = CSV_生成三列(L"A", L"B,2", L"中文");
    @ check(CSV_字段数量(csvLine.c_str()) == 3 && std::wstring(CSV_取字段(csvLine.c_str(), 1)) == L"B,2", L"CSV 数据");
    @ check(std::wstring(哈希_SHA256文本(L"abc")) == L"BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD", L"SHA-256 摘要");
    @ std::wstring protectedText = 数据保护_加密文本(L"LingBuilder安全测试");
    @ check(!protectedText.empty() && std::wstring(数据保护_解密文本(protectedText.c_str())) == L"LingBuilder安全测试", L"Windows DPAPI 往返");
    @ check(!SQLite_加载运行库(L"__lingbuilder_missing_sqlite3__.dll") && wcslen(SQLite_取错误()) > 0, L"SQLite 缺失运行库明确报错");
    @ check(识图_颜色相似度(0xFF112233LL, 0xFF112233LL) == 0 && 位图_取像素红色(0xFF7F2040LL) == 0x7F, L"图像颜色工具");
    @ long long memoryHandle = 内存_申请(64);
    @ bool memoryIntegerOk = memoryHandle != 0 && 内存_写整数(memoryHandle, 0, 20260723) && 内存_读整数(memoryHandle, 0) == 20260723;
    @ bool memoryTextOk = memoryHandle != 0 && 内存_写UTF8文本(memoryHandle, 8, L"中文内存") && std::wstring(内存_读UTF8文本(memoryHandle, 8, 40)) == L"中文内存";
    @ check(memoryIntegerOk && memoryTextOk && 内存_释放(memoryHandle), L"受控内存读写释放");
    @ check(wcslen(CPU_取厂商()) > 0 && 位运算_统计一位数量(15) == 4, L"CPU 与位运算");
    @ 文件_删除(dataFile);
    @ 文件_删除(iniFile);
    @ report += L"--------------------------------\r\n通过=" + std::to_wstring(passed) + L"，失败=" + std::to_wstring(failed) + L"\r\n";
    @ bool reportWritten = 文件_写入文本(L"module-cli-smoke-report.txt", report.c_str());
    @ 调试输出(report.c_str());
    @ if (!reportWritten || failed != 0) SetWindowTextW(hwnd_, L"模块测试失败");
    @ else SetWindowTextW(hwnd_, L"模块测试全部通过");
    结束()
  结束
结束类
'@

$requestObject = [ordered]@{
  filePath = 'examples/module-cli-smoke/src/模块功能测试窗体.lcpp'
  sourceCode = $source
  projectId = 'module-cli-smoke'
  designerProject = $designerObject
  project = $designerObject
  activeWindowId = 'module-smoke-main'
  lingCppSourceCode = $source
  lingCppSourceFilePath = 'examples/module-cli-smoke/src/模块功能测试窗体.lcpp'
  run = $true
  approved = $true
}
Write-Output '准备 CLI 请求草稿...'
$requestJson = $requestObject | ConvertTo-Json -Depth 8

$readme = @'
# 新增模块 CLI 冒烟测试

该项目通过 LingBuilder CLI / AI Bridge 验证本轮新增的 51 个模块：

- 项目引用中启用全部新增模块，验证模块扫描、启用状态和 C++ 运行时注入。
- `.lcpp` 包含普通中文模块命令，验证诊断和 `bindings.commands` 映射。
- CLI 执行诊断、原生预览、导出、构建和运行。
- 运行时执行文本、编码、数学、时间、正则、JSON、XML、文件、INI、系统、磁盘、进程、显示器、DNS、URL、Cookie、CSV、哈希、DPAPI、SQLite 错误边界、图像颜色、受控内存和 CPU 等确定性测试。
- 网络客户端、输入模拟、注册表、跨进程内存、Hook、COM、驱动、托盘、音频等有外部依赖或副作用的模块只验证启用、生成和编译，不在冒烟程序中触发。

运行命令（在 `electron` 目录）：

```powershell
node dist/cli.cjs project diagnose --workspace .. --request ../examples/module-cli-smoke/project-request.json --json
node dist/cli.cjs project export --workspace .. --request ../examples/module-cli-smoke/project-request.json --yes --json
node dist/cli.cjs project build --workspace .. --request ../examples/module-cli-smoke/project-request.json --yes --json
```

一次性 `project run` 会在 CLI 命令退出时回收其受控子进程，适合验证启动但不保证程序有时间写完运行报告。完整运行期验收应启动长驻 Bridge：

```powershell
node dist/cli.cjs ai-server --workspace .. --host 127.0.0.1 --port 17863 --token module-cli-smoke-local --permission preview

$body = Get-Content ../examples/module-cli-smoke/project-request.json -Raw -Encoding UTF8
Invoke-RestMethod -Method Post `
  -Uri http://127.0.0.1:17863/api/ai-bridge/build/run `
  -Headers @{ Authorization = 'Bearer module-cli-smoke-local' } `
  -ContentType 'application/json; charset=utf-8' `
  -Body $body
```

运行报告生成在 `.lingbuilder-build/module-cli-smoke/bin/module-cli-smoke-report.txt`。
'@

$files = @(
  [pscustomobject]@{ filePath = $solutionPath; updatedSource = $solutionUpdated },
  [pscustomobject]@{ filePath = '.lingbuilder/projects/module-cli-smoke/project-modules.json'; updatedSource = $projectModules },
  [pscustomobject]@{ filePath = '.lingbuilder/projects/module-cli-smoke/window-designer.json'; updatedSource = $designer },
  [pscustomobject]@{ filePath = 'examples/module-cli-smoke/src/模块功能测试窗体.lcpp'; updatedSource = $source },
  [pscustomobject]@{ filePath = 'examples/module-cli-smoke/project-request.json'; updatedSource = $requestJson },
  [pscustomobject]@{ filePath = 'examples/module-cli-smoke/README.md'; updatedSource = $readme }
)
$workspaceFiles = @(
  [pscustomobject]@{ filePath = $solutionPath; sourceCode = $solutionOriginal },
  [pscustomobject]@{ filePath = '.lingbuilder/projects/module-cli-smoke/project-modules.json'; sourceCode = '' },
  [pscustomobject]@{ filePath = '.lingbuilder/projects/module-cli-smoke/window-designer.json'; sourceCode = '' },
  [pscustomobject]@{ filePath = 'examples/module-cli-smoke/src/模块功能测试窗体.lcpp'; sourceCode = '' },
  [pscustomobject]@{ filePath = 'examples/module-cli-smoke/project-request.json'; sourceCode = '' },
  [pscustomobject]@{ filePath = 'examples/module-cli-smoke/README.md'; sourceCode = '' }
)

Write-Output '正在通过 AI Bridge 创建可预览编辑提案...'
Write-Host "草稿字符数 solution=$($solutionUpdated.Length), modules=$($projectModules.Length), designer=$($designer.Length), source=$($source.Length), request=$($requestJson.Length), readme=$($readme.Length)"
$workspaceJson = '[' + (($workspaceFiles | ForEach-Object {
  '{"filePath":' + (ConvertTo-JsonString $_.filePath) + ',"sourceCode":' + (ConvertTo-JsonString $_.sourceCode) + '}'
}) -join ',') + ']'
$filesJson = '[' + (($files | ForEach-Object {
  '{"filePath":' + (ConvertTo-JsonString $_.filePath) + ',"updatedSource":' + (ConvertTo-JsonString $_.updatedSource) + '}'
}) -join ',') + ']'
$proposalJson = '{"filePath":' + (ConvertTo-JsonString $solutionPath) +
  ',"sourceCode":' + (ConvertTo-JsonString $solutionOriginal) +
  ',"instruction":' + (ConvertTo-JsonString '创建新增模块 CLI 冒烟测试项目并启用全部 51 个新增模块') +
  ',"projectId":"module-cli-smoke","workspaceFiles":' + $workspaceJson + ',"files":' + $filesJson + '}'
$proposal = Invoke-BridgePost 'edit/propose' $proposalJson
Write-Output '正在通过 AI Bridge 应用已批准提案...'
$applyJson = '{"proposalId":' + (ConvertTo-JsonString $proposal.proposal.id) + ',"approved":true,"workspaceFiles":' + $workspaceJson + '}'
$apply = Invoke-BridgePost 'edit/apply' $applyJson

[pscustomobject]@{
  proposalId = $proposal.proposal.id
  changeCount = $proposal.proposal.changes.Count
  appliedFiles = @($apply.appliedFiles.filePath)
  moduleCount = $moduleIds.Count
} | ConvertTo-Json -Depth 10
