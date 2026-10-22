# LingBuilder AOA WinUSB 驱动包（免 Zadig 无人值守安装）

2026-10-20 真机攻坚产物：不用 Zadig、不用改手机任何设置，把 inbox WinUSB 强配到小米
MTP 引导口与 Google 配件口，`AOA_打开设备` 全链（GET_PROTOCOL → 切配件 → bulk 数据通道）
在 MTP 模式下直接打通（Mi 10 实测）。

## 文件

- `lingbuilder-aoa.inf` — WinUSB 驱动包（UTF-16LE 已转换版；源码形态见 install 脚本第一步）
- `lingbuilder-aoa.cdf` — makecat 目录描述文件
- `install-driver.ps1` — 证书创建/信任 + makecat + 签名 + `pnputil /add-driver`
- `cycle.ps1` — 重签换包 + `UpdateDriverForPlugAndPlayDevices` 强制安装一条龙

## 用法（管理员 PowerShell）

```powershell
# 首次：签名入库 + 强制安装到当前在线设备
powershell -ExecutionPolicy Bypass -File install-driver.ps1   # INF 需 UTF-16LE（脚本内含转换）
powershell -ExecutionPolicy Bypass -File cycle.ps1            # 强配 WinUSB 到 FF40
```

以后每次插线（手机回到 MTP）只需重跑 `cycle.ps1`（约 2 秒，包已在仓库里无需重签），
然后 `AOA_打开设备` 即可。配件模式（18D1:2D00 / 2D01&MI_00）驱动装一次永久有效。

## 机制结论（为什么必须这么做，2026-10-20 实锤）

1. **签名等级压倒一切**：现代 Windows 驱动排名把签名放高位（inbox `0x00FF…` 恒优于
   受信发布者自签 `0x08FF…`），标识符匹配（硬件 ID vs 兼容 ID）只在同签名等级内比较。
   所以「自签 INF + 精确硬件 ID」**排不赢** inbox wpdmtp 的 `USB\MS_COMP_MTP` 兼容 ID 匹配，
   Zadig（装的是兼容 ID 通用包，更赢不了）在 MTP 模式下漂移是机制性的，不是操作问题。
2. **正解是绕开排名**：`UpdateDriverForPlugAndPlayDevices(..., INSTALLFLAG_FORCE)` 直接把
   包配到设备节点（设备管理器"更新驱动"同款 API）。
3. **换驱动必须删节点**：`pnputil /add-driver /install` 不会动已正常工作的设备；
   `pnputil /remove-device` + `/scan-devices` 会触发重新排名（结果还是 wpdmtp 赢），
   只有 UpdateDriver 强配才会换。

## INF 红线（三条都踩过）

- **段名禁用 `NT$ARCH$`**：那是 inf2cat 打包期宏，运行时解析器不展开，整个 Models 节失效
  （症状：`No matching drivers found in single INF`）。写显式 `NTamd64`。
- **ClassGuid 必须用 USBDevice `{88BAE032-5A81-49f0-BC3D-A4FF138216D6}`**（与 inbox
  winusb.inf 一致）。配 `{36FC9E60-…}`（USB 总线类）会让 INF 在设备匹配时整体判无效。
- **INF 必须 UTF-16LE 带 BOM** 才能入库（`pnputil` 报「INF 形式与要求的形式不同」）。
- 裸注册表绑定（直接写 Enum 键 `Service=WinUSB`）不可靠：设备启动报
  `STATUS_INVALID_DEVICE_REQUEST`（问题码 10）。必须走 INF 安装。

## 本机当前状态（2026-10-20）

- 证书 `CN=LingBuilder AOA Driver`（自签）已入 `LocalMachine\My` + Root + TrustedPublisher。
- 驱动包已入库为 `oem36.inf`（版本 1.1.0.4），Mi 10 / Mi 8 的 FF40 节点与
  18D1:2D01&MI_00 幽灵节点均已绑定 WINUSB（`Get-PnpDeviceProperty DEVPKEY_Device_Service`）。
- `WUDFWpdMtp` 服务曾临时禁用，**已恢复 demand**——拔插后手机回 MTP 属正常，重跑 `cycle.ps1` 即可。
- Mi 8 的 FF40 节点（`USB\VID_2717&PID_FF40\6929B744`）被重新启用并在本次安装中一并绑了
  WinUSB；为消除多机歧义可再 `pnputil /disable-device`（find_by_serial 已加"可打开优先"补丁兜底）。

## 卸载 / 恢复 MTP

```powershell
pnputil /delete-driver oem36.inf /uninstall
# 然后重插手机 → wpdmtp 正常接管，MTP 恢复
```
