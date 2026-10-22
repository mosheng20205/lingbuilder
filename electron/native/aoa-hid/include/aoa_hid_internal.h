#pragma once
// 转发头：内部头唯一真源在 ../src/aoa_hid_internal.h。
// 历史教训：本目录曾放一份旧副本（缺 1.1.0 新增字段），tests/ 与 src/ 各编到不同布局，
// SessionImpl 字段错位导致 rawread 读到 iface=2/ep=0、data_send 往端点 0 写超时（2026-10-20 实锤）。
// 改成转发后此 bug 结构性不可能复发；不要在这里恢复实体定义。
#include "../src/aoa_hid_internal.h"
