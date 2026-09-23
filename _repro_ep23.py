# -*- coding: utf-8 -*-
"""循环复现 ep23 提前退出：每轮完整步骤，进程死亡即停（退出栈已在 C:/Temp/ep23_quit.log）。"""
import ctypes, ctypes.wintypes as wt, subprocess, time, os, sys

user32 = ctypes.windll.user32
user32.SetProcessDPIAware()
BASE = r'T:\electron\lingbuilder\AI 视频自主生产\EdgeView 浏览器模块合集\23 事件决策·菜单·通知·证书'
EXE = os.path.join(BASE, r'示例项目\.lingbuilder-build\edgeview-ep23-event-decisions\Win32\Debug\bin\LingBuilderPreview.exe')
ENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, wt.HWND, wt.LPARAM)

def window_title(hwnd):
    n = user32.GetWindowTextLengthW(hwnd); buf = ctypes.create_unicode_buffer(n + 1)
    user32.GetWindowTextW(hwnd, buf, n + 1); return buf.value

def find_host():
    out = []
    @ENUMPROC
    def cb(hwnd, lparam):
        if user32.IsWindowVisible(hwnd) and '事件决策' in window_title(hwnd): out.append(hwnd)
        return True
    user32.EnumWindows(cb, 0); return out[0] if out else None

def click_button(host, part):
    hits = []
    @ENUMPROC
    def cb(child, lparam):
        cls = ctypes.create_unicode_buffer(64); user32.GetClassNameW(child, cls, 64)
        if cls.value == 'Button' and part in window_title(child): hits.append(child)
        return True
    user32.EnumChildWindows(host, cb, 0)
    if hits:
        user32.SendMessageW(hits[0], 0x00F5, 0, 0); return True
    return False

STEPS = [
    ('授权通知权限', 4),
    ('页面发通知', 8),
    ('通知报告单击', 2),
    ('通知报告关闭', 2),
    ('回菜单页', None),
    ('点target=_blank链接', 3),
    ('页面confirm(原生接管)', 4),
    ('清除证书错误决策', 4),
]

for round_no in range(1, 7):
    subprocess.run(['powershell', '-Command', 'Get-Process LingBuilderPreview -ErrorAction SilentlyContinue | Stop-Process -Force'], capture_output=True)
    time.sleep(1.5)
    proc = subprocess.Popen([EXE], cwd=os.path.dirname(EXE))
    host = None
    for _ in range(30):
        time.sleep(1); host = find_host()
        if host: break
    if host is None:
        print('round %d: no host' % round_no)
        try: proc.kill()
        except Exception: pass
        continue
    print('round %d begin' % round_no); sys.stdout.flush()
    dead = False
    for kw, wait in STEPS:
        click_button(host, kw)
        if wait:
            time.sleep(wait)
        if proc.poll() is not None:
            print('  round %d: 进程在步骤「%s」后退出!' % (round_no, kw))
            dead = True
            break
    if dead:
        break
    try:
        user32.PostMessageW(host, 0x0010, 0, 0)
    except Exception:
        pass
    time.sleep(2)
    try: proc.kill()
    except Exception: pass
print('loop end')
