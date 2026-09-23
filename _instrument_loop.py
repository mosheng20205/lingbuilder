# -*- coding: utf-8 -*-
"""把 ep23 主消息循环改为记录 GetMessage 返回值的形态：-1（错误）/0（WM_QUIT）都落盘。"""
import io

p = r'T:\electron\lingbuilder\AI 视频自主生产\EdgeView 浏览器模块合集\23 事件决策·菜单·通知·证书\示例项目\.lingbuilder-build\edgeview-ep23-event-decisions\Win32\Debug\src\main.cpp'
t = io.open(p, encoding='utf-8').read()
NL = chr(10)

old_head = 'while (GetMessageW(&message, nullptr, 0, 0)) {' + NL + '        HWND navigationRoot = message.hwnd ? GetAncestor(message.hwnd, GA_ROOT) : startWindow;'
assert old_head in t, 'main loop anchor not found'

new_head = (
    'for (;;) {' + NL +
    '            BOOL gMsg = GetMessageW(&message, nullptr, 0, 0);' + NL +
    '            if (gMsg <= 0) {' + NL +
    '                FILE* f = nullptr; fopen_s(&f, "C:/Temp/ep23_quit.log", "ab");' + NL +
    '                if (f) { fprintf(f, "LOOP-EXIT g=%d msg=%u lasterr=%lu' + NL + '", (int)gMsg, (unsigned)message.message, GetLastError()); fclose(f); }' + NL +
    '                break;' + NL +
    '            }' + NL +
    '            {' + NL +
    '        HWND navigationRoot = message.hwnd ? GetAncestor(message.hwnd, GA_ROOT) : startWindow;'
)
t = t.replace(old_head, new_head, 1)

# 找主循环体结束的大括号：从替换点起做括号配对
k = t.find(new_head)
i = k + len(new_head) - 1  # 指向 new_head 末尾的 '{'
depth = 0
j = i
while j < len(t):
    if t[j] == '{':
        depth += 1
    elif t[j] == '}':
        depth -= 1
        if depth == 0:
            break
    j += 1
assert depth == 0, 'closing brace not found'
t = t[:j] + '            }' + NL + t[j:]  # 补一层闭合

# wWinMain 的 CEF 独立模式 return 0 打点
anchor_ret = 'CoUninitialize(); return 0; }'
if anchor_ret in t:
    t = t.replace(anchor_ret, 'CoUninitialize(); LB_LogQuit("cef-standalone-return0"); return 0; }', 1)
    print('standalone return0 tagged')

io.open(p, 'w', encoding='utf-8', newline='').write(t)
print('loop instrumented')
