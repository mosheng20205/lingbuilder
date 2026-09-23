# -*- coding: utf-8 -*-
"""注入退出路径记录器 v2：DestroyWindow 插桩改为跳过已插入文本，避免死循环。"""
import io

p = r'T:\electron\lingbuilder\AI 视频自主生产\EdgeView 浏览器模块合集\23 事件决策·菜单·通知·证书\示例项目\.lingbuilder-build\edgeview-ep23-event-decisions\Win32\Debug\src\main.cpp'
t = io.open(p, encoding='utf-8').read()
NL = chr(10)
LOG = 'C:/Temp/ep23_quit.log'

helper = (
    '#include <dbghelp.h>' + NL +
    '#pragma comment(lib, "dbghelp.lib")' + NL +
    'static void LB_LogQuit(const char* tag) {' + NL +
    '    FILE* f = nullptr; fopen_s(&f, "' + LOG + '", "ab"); if (!f) return;' + NL +
    '    fprintf(f, "QUIT[%s] tid=%lu' + NL + '", tag, GetCurrentThreadId());' + NL +
    '    void* stk[24]; USHORT n = CaptureStackBackTrace(1, 24, stk, nullptr);' + NL +
    '    SymSetOptions(SYMOPT_UNDNAME | SYMOPT_DEFERRED_LOADS);' + NL +
    '    static bool init = false; if (!init) { SymInitialize(GetCurrentProcess(), nullptr, TRUE); init = true; }' + NL +
    '    SYMBOL_INFOW* si = (SYMBOL_INFOW*)calloc(1, sizeof(SYMBOL_INFOW) + 512 * sizeof(wchar_t));' + NL +
    '    si->SizeOfStruct = sizeof(SYMBOL_INFOW); si->MaxNameLen = 255;' + NL +
    '    for (USHORT i = 0; i < n; ++i) {' + NL +
    '        si->Address = (DWORD64)stk[i];' + NL +
    '        if (SymFromAddrW(GetCurrentProcess(), (DWORD64)stk[i], nullptr, si)) {' + NL +
    '            fwprintf(f, L"  # %s' + NL + '", si->Name);' + NL +
    '        }' + NL +
    '    }' + NL +
    '    free(si); fclose(f);' + NL +
    '}' + NL
)

anchor_class = 'class LingWindowBase'
assert anchor_class in t
t = t.replace(anchor_class, helper + NL + anchor_class, 1)

def ins_before(t, anchor, tag):
    assert anchor in t, tag
    return t.replace(anchor, 'LB_LogQuit("' + tag + '");' + NL + anchor, 1)

t = ins_before(t, '            PostQuitMessage(0);', 'PQ-pump')
t = ins_before(t, '            --g_openWindowCount;', 'PQ-openwindowcount')
t = ins_before(t, '            closingEventActive_ = true;', 'WM_CLOSE-main')
t = ins_before(t, '            DestroyWindowIcons();', 'WM_DESTROY-main')

# DestroyWindow 插桩：循环插并用插入长度推进游标
ins = 'LB_LogQuit("DW");' + NL + '            '
pos = 0
count = 0
target = 'DestroyWindow(hwnd_);'
while True:
    k = t.find(target, pos)
    if k == -1:
        break
    t = t[:k] + ins + t[k:]
    pos = k + len(ins)
    count += 1
    if count > 10:
        break
io.open(p, 'w', encoding='utf-8', newline='').write(t)
print('quit logger injected; DW sites:', count)
