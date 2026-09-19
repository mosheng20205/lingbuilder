# Table 表格 Table · 惯用要点与红线

- 列与行都用**制表符分隔的 key=value 协议**（不是 JSON）：`NE表格_设置列(表格, "title=订单编号\tkey=id\twidth=180\ntitle=客户\tkey=customer\twidth=240")`，一行一列、`\t` 分字段；源码里的 `\t` 会被确定性解释成真实制表符。
- 行数据同样按列键寻址，**列位置变化不会串列**：`NE表格_设置行数据` / `NE表格_添加行(表格, "c0=…\tc1=…")`；追加行建议带稳定 `key=`，否则只能靠行号定位、刷新时极易错行。
- 设计器模型里对应 `columns`/`rows`（简单形态）与 `tableColumnsEx`/`tableRowsEx`（结构化：对齐、冻结、类型、隐藏、转义）；结构化数据存在时生成器只发 Ex 协议，不要再手工拼基础标题文本。
- 双击编辑要显式开：`NE_EU_SetTableDoubleClickEdit(当前窗口, 表格, 1)`，可再按列 `NE_EU_SetTableColumnDoubleClickEdit(当前窗口, 表格, 1, 列号)`；编辑结果靠 `单元格编辑(整数型 行号, 整数型 列号, 整数型 动作, 文本型 文本)` 回收。
- 行数计数用 `NE_EU_GetTableRowCount(当前窗口, 表格)`；删除/清空分别 `NE_EU_DeleteTableRow`、`NE_EU_ClearTableRows`。**别用「设置行数据传空串」冒充清空**。
- 几千行以上必须走 `虚拟行数据源(整数型 行号)` 虚拟化，逐行 `NE表格_添加行` 会把界面线程压死；选中语义看 `selectionMode`（0 不允许、1 单选一行、2 多选）。
- 事件全清单（单元格点击/动作/编辑/右键菜单/虚拟行数据源）以本卡「事件与处理器命名」表为准，处理器参数类型不得省略。

```lcpp
局部 NE表格 订单表格 = 控件_创建NE表格(当前窗口, 24, 60, 840, 360, "订单表格", "订单表格", 1)
NE表格_设置列(订单表格, "title=订单编号\tkey=id\twidth=180\ntitle=客户\tkey=customer\twidth=240")
NE表格_设置行数据(订单表格, "c0=SO-001\tc1=灵码科技")
NE表格_绑定单元格编辑(订单表格, &单元格编辑完成)
```
