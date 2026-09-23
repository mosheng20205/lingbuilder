# com.example.electron 模块

这是 LingBuilder schemaVersion 2 模块。

## 打包

```bash
lingbuilder module validate .
lingbuilder module pack . --out com.example.electron.lbmod
```

## AI Bridge 源码门禁与取证脚本

- 窗口项目构建/应用前有两道源码门禁（唯一实现在 `src/services/lingCpp/`）：`controlReferenceAdmission.ts`（控件引用必须存在于设计器模型）与 `argumentTypeAdmission.ts`（模块命令实参类型与形参声明不符时给出行列中文诊断并阻断生成，如把字节集传给文本型形参）。
- 字符串字面量区间扫描统一在 `src/services/lingCpp/stringLiteralRegions.ts`（`collectLingCppStringLiteralRegions` / `buildLingCppStringLiteralMask`）：`\"` 转义与连续反斜杠奇偶、中文引号 `“”` 的处理只有一个实现，表达式二元拆分、实参拆分、形参表/默认值拆分全部复用它，新增解析器禁止再手写引号状态机。生成端兜底不透传含引号/全角标点的原文：无法翻译的表达式降级为 `L"" /* 无法翻译的表达式：<原文> */` 并在编译前给出 `<源文件> 第 N 行` 的中文阻断诊断；未闭合字符串另有 `lingcpp-string-unterminated-*`（带行列）编辑器诊断。
- 生成 exe 的崩溃取证：`scripts/analyze-lbdump.ps1`（LocalDumps 已对 `LingBuilderPreview.exe` 开启全内存转储，目录 `%TEMP%\lbdumps`；脚本用 cdb 提取异常码、出错线程调用栈与堆状态）。
