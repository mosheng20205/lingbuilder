# 微信 4.1.10.27 多开项目

## 一键分享

在 LingBuilder 中选择“文件 → 一键导出当前项目源码包…”，生成 `微信4.1.10.27多开.lcpppkg`。源码包导出位置固定为当前项目根目录的 `exports/` 文件夹。接收方使用“文件 → 打开 LCPP 源码包…”或直接把 `.lcpppkg` 拖入 IDE，LingBuilder 会校验并导入为独立工作区，然后打开其中的 `.lbsln` 解决方案。

源码包会携带本项目实际启用的 `lingbuilder.wxhook.manager` 模块目录以及 Host、Agent、SQLite 等运行时文件，不需要访问官方模块市场，也不需要手工复制 `T:` 盘文件。

## 单独使用模块

若只需要把模块安装到已有工作区，使用随项目提供的 `.lbmod`：

```text
.lingbuilder/module-packages/lingbuilder.wxhook.manager.lbmod
```

在 IDE 的模块管理中选择“本地模块包 / 导入模块包”，先预览再确认安装；也可以把 `.lbmod` 拖入桌面版 IDE。安装后在项目的“模块”组启用“微信 4.1.10.27 多开管理模块”，无需生成或维护官方市场索引。

## 源码入口

- `MainWindow.lcpp`：启动微信、刷新实例和显示日志的窗口代码。
- `.lingbuilder/projects/wxmore-tool/window-designer.json`：窗口和控件布局。
- `.lingbuilder/modules/lingbuilder.wxhook.manager/`：导入包内的本地模块实现与运行时。
