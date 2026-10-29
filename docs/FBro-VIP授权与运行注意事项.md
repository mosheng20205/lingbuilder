# FBro 浏览器 VIP 授权失效与运行注意事项

> 适用版本：LingBuilder 0.8.36（C++ LocMaster），FBro SDK 135.0.21 / 桥 2.9.4
> 记录时间：2026-10-27/28
> 涉及工程：`T:\逆向\B站\src\cookie-harvester`（无头 Cookie 收割机）

---

## 一、一句话结论

**`FBroVIP_实例应用指纹JSON` 返回 `-4`，不代表 Key 无效，而是「当前运行的这个 exe 进程里根本没有 FBro VIP Key」。**
Key 只由 LingBuilder IDE 在**它自己拉起程序**时通过环境变量注入；「编译当前项目 + 手动双击 exe」这种启动方式永远拿不到 Key。

Key 本身有效（已用同一把 Key 启动同一个 exe 验证：指纹应用成功、收割到 Cookie）。

---

## 二、错误码语义（桥 `LB_FBro_ApplyFingerprintJson`）

| 返回值 | 含义 | 典型原因 |
|---|---|---|
| `-1` | 实例句柄无效，或浏览器尚未就绪 | 刚建立还没创建完，可下一轮重试 |
| `-2` | JSON 为空 | 指纹串是空文本 |
| `-3` | JSON 不是合法对象 | 指纹 JSON 拼错 |
| **`-4`** | **VIP 控制器不可用（进程里没有 Key）** | **双击 exe / 非 IDE 启动；未配置 Key** |
| **`-5`** | **Key 传进来了，但联网校验失败** | **Key 无效、过期、机器不符、网络不通** |

判断口诀：**-4 查"有没有传进去"，-5 查"Key 对不对"。**

---

## 三、Key 是怎么进入程序的（链路）

1. 在 IDE「设置 → 浏览器凭据」保存 Key；
   - 通过 Electron `safeStorage` 加密存放在
     `%APPDATA%\lingbuilder-electron\credentials\fbro-vip-key.bin`（按 Windows 用户加密）；
2. IDE 主进程读取凭据，写进本地服务（utilityProcess）的环境变量 `LINGBUILDER_FBRO_VIP_KEY`；
3. 本地服务启动时把它摘出来存内存，并**从自己的环境变量里删除**（防止泄露给其它子进程）；
4. 只有 IDE 的受控运行（工具栏「运行」/ F5 / 重新运行 / AI Bridge `build.run`）在
   `spawn` 编译产物时，再把 `LINGBUILDER_FBRO_VIP_KEY` 注入子进程环境；
5. FBro 桥 DLL 初始化时读取这个变量，应用授权后**立即清除该变量**（只读一次）。

由此得出三条硬规则：

- **Key 不写进 exe、不写进源码、不写进构建产物**（安全设计，无法从 exe 反推）。
- **双击 / 资源管理器 / 自己写的启动脚本** → 没有这个环境变量 → 必然 `-4`。
- **改完 Key 不需要重启 IDE**：下一次「运行」立即生效；但对已经在运行的 exe 无效（它启动时已读过一次）。

### 判定"这次是不是 IDE 拉起的"

IDE 受控运行会在构建目录生成 `run.log`：

```
T:\逆向\B站\.lingbuilder-build\cookie-harvester\x64\Release\run.log
```

**没有 `run.log` = 不是 IDE 启动的**（双击、资源管理器、脚本都算）。这是最快的判据。

---

## 四、三种启动方式对照

| 启动方式 | 带 Key | 说明 |
|---|---|---|
| 工具栏「运行」/ F5 /「重新运行」 | ✅ | 会保存 → 编译 → 启动，并注入 Key；每次都会重新编译 |
| 带环境变量的 bat | ✅ | 适合"编译一次、之后反复手动启动" |
| 直接双击 exe | ❌ | 必然 `-4`，与 Key 内容无关 |

### bat 启动器示例（放在 exe 同目录）

```bat
@echo off
set LINGBUILDER_FBRO_VIP_KEY=<你的 FBro VIP Key>
start "" "无头Cookie收割机.exe"
```

> 安全提示：bat 里是明文 Key，不要连同目录一起发给别人，也不要提交到 Git。
> 想避免明文文件，可改用用户环境变量：`setx LINGBUILDER_FBRO_VIP_KEY "..."`，
> 之后新开的资源管理器/终端里的进程都能继承（个别机器需重启一次资源管理器）。
> 两者都是明文存储，优先级仍建议在 IDE 设置里保存、用「运行」启动。

---

## 五、日志怎么读（本次已加诊断）

失败时日志会先打一条**进程级**授权诊断（只打一次，避免多线程刷屏），再按错误码给处置文案：

```
FBro VIP 授权诊断：licenseAttempted=是否收到 Key，licenseValid=是否校验通过，error=失败原因；
{"licenseAttempted":false,"licenseValid":false,"extensionPlusRequested":false,
 "extensionPlusEnabled":false,"sdkReportsLicense":false,
 "machineCode":"7BA7EABA-...","expirationTime":"","registrationTime":"",
 "version":"","functions":"","licenseType":"","licenseStartDate":"",
 "licenseEndDate":"","devTools":"","licensedFunctions":"","systemVersion":"","error":""}

线程 1：指纹应用失败（代码 -4）：当前进程没有拿到 FBro VIP Key（IDE 的「运行/F5」会注入，双击 exe 不会），或 VIP 控制器不可用
```

Key 填错时（`-5`）会直接给出 FBro 原始原因：

```
... "licenseAttempted":true,"licenseValid":false, ... "error":"授权码错误：licenceID is error"
线程 1：指纹应用失败（代码 -5）：FBro VIP Key 校验失败，请到「设置 → 浏览器凭据」核对 Key 是否属于本机并已生效
```

### 排查顺序

1. 看是否有「FBro VIP 授权诊断」这一行；
2. `licenseAttempted=false` → **Key 没传进进程**：检查启动方式（有没有 `run.log`），改用「运行」或 bat；
3. `licenseAttempted=true` 且 `licenseValid=false` → **Key 内容问题**（`error` 字段有原因），检查 Key、机器码、账号、网络；
4. `licenseValid=true` 却仍失败 → 桥/运行时版本问题（重装模块或升级 IDE）。

---

## 六、30 线程主窗口"无响应"问题（本次修复）

### 根因

界面线程被**成批同步调用**堵住，不是实例本身的问题：

1. **等加载阶段**：每 500ms 对每个槽执行 `FBro_实例执行JS("document.readyState")`。
   该命令要等 JS 返回值，桥内最长等 **5 秒**；30 个槽一轮就是几十秒。
2. **收割阶段**：`FBro_实例取Cookie` 同步等待（最长 2 秒），30 个线程几乎同时完成时连取 30 次。
3. **指纹阶段**：一轮里连续应用 30 个指纹（VIP 设置均为同步调用）。

### 改法（`src/cookie-harvester/Cookie收割窗体.lcpp`）

- 加载判断改为**不阻塞查询**：`FBro_实例等待加载超时(实例, 0)`（只查 `IsLoading`），
  另加 500ms 宽限，避免导航刚发起就误判"已加载"。
- 新增**阶段 4 = 待收割**，并给每轮加预算：
  - 补建实例：每轮最多 8 个；
  - 应用指纹：每轮最多 8 个；
  - 取 Cookie：每轮最多 3 个（加载完的槽先排队，轮转消费）。
- **未导航的槽不再取 Cookie**：指纹/导航失败（包括 -4/-5）直接关实例，
  省掉每个槽最多 2 秒的同步等待；停止时已导航的槽同样走阶段 4 限量。
- 状态机：`0=未创建 1=应用指纹 2=导航 3=等加载完成 4=待收割 9=终态`。

### 实测（同机、30 线程、同一把 Key）

| 指标 | 改前 | 改后 |
|---|---|---|
| 任务总耗时 | 17.7 秒 | 13.2 秒 |
| 主窗口最长无响应 | **3 秒以上**（采样顶到 3000ms 上限） | **836 毫秒** |
| 超过 500ms 的卡顿 | 2 次 | 3 次（均 < 1 秒） |
| 无 Key（-4）30 线程 | 每槽排队等 2 秒取 Cookie | 2.5 秒结束，最长 107ms |

低于 1 秒的波动来自 30 个 CEF 实例同时启动的 CPU 竞争，不会触发 Windows「未响应」。
代价是总耗时比不节流版本多几秒，用响应性换总时长。

---

## 七、写 FBro 多线程程序的红线清单

1. **不要在界面线程用 `FBro_实例执行JS` 轮询页面状态**。
   它要等 JS 返回值（最长 5 秒）。判断加载完成用：
   - `FBro_实例等待加载超时(实例句柄, 0)`：非阻塞查询，1=已加载；
   - 窗口程序也可以 `FBro_实例绑定事件(实例句柄, "LoadEnd", &处理器)`。
2. **`FBro_实例取Cookie` 是同步等待（最长 2 秒）**，批量收割必须分轮限量。
3. **`FBroVIP_实例应用指纹JSON` 是同步调用**，一次应用几十个同样会卡界面，分批。
4. **`FBro_后台创建` 本身很快**（只是投递启动任务），但一次建几十个会因 CEF 启动抢占 CPU 造成界面发滞，建议每轮 8 个左右。
5. **`FBro_实例关闭` 是异步的**，可以连续调用。
6. 定时器回调里只做**有界工作**：每轮固定上限 + 轮转游标，不要按线程总数全量遍历。
7. 超时一律按**墙钟时间**（`时间_单调毫秒`）判断，不要按轮次估算。
8. 每个线程独立缓存目录（`数据\实例N`）才能做到会话隔离；要保登录态就不要下发 `clearAllData`。
9. 线程数按机器量力：每个 CEF 实例数百 MB 内存与大量磁盘缓存，30 线程已属较重负载。
10. **VIP 控制器不可用时，后台实例仍能创建、Cookie 仍能取**（只有指纹族被拦），
    所以"实例已建立 + 收割 0 条 + -4"并不矛盾——指纹失败后没有导航，自然没有 Cookie。
11. 诊断入口：`FBroVIP_取授权信息JSON()`（脱敏，不返回 Key），字段：
    `licenseAttempted / licenseValid / extensionPlusEnabled / machineCode / expirationTime / error`。
12. 控制台项目没有消息泵，不要依赖事件处理器，用"等待加载超时 + 执行JS"同步链路。

---

## 八、常见问题

**Q：设置里明明填了 Key，为什么还是 -4？**
A：Key 存在了，但这次运行的不是 IDE 拉起的进程。看构建目录有没有 `run.log`；用「运行」按钮或 bat。

**Q：-4 和 -5 有什么区别？**
A：-4 = 进程里没有 Key（没传进来）；-5 = Key 传进来了但校验失败（Key 错/过期/机器不符/网络问题）。

**Q：改完 Key 要重启 IDE 吗？**
A：不需要。下一次「运行」就会用新 Key；已经启动的 exe 不会重读。

**Q：为什么日志里 30 个线程都是"收割 0 条 Cookie"？**
A：指纹应用失败 → 该线程没有导航 → 页面上没有任何 Cookie。授权修好后就会正常收割（匿名访问 B 站通常 14 条左右）。

**Q：把 Key 写进源码或 exe 里不是更省事吗？**
A：不行，这是安全红线。Key 只在受控启动时以环境变量注入，且桥读完立即从环境变量清除，不落盘、不进日志。

**Q：手动启动能否也自动带 Key？**
A：可以，用 bat 设环境变量后启动，或 `setx` 设用户环境变量；但都是明文存储，注意不要把文件/变量泄露出去。
