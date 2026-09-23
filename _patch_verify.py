# -*- coding: utf-8 -*-
"""工装补丁：预清 msedgewebview2、集内 settle 6s、主窗口未出现时清锁重试一次。"""
import io

p = r'T:\electron\lingbuilder\AI 视频自主生产\EdgeView 浏览器模块合集\verify_18_24.py'
t = io.open(p, encoding='utf-8').read()
Q = chr(39)
PS = Q + 'Get-Process LingBuilderPreview,msedgewebview2 -ErrorAction SilentlyContinue | Stop-Process -Force' + Q

old_kill = Q + 'Get-Process LingBuilderPreview -ErrorAction SilentlyContinue | Stop-Process -Force' + Q
assert old_kill in t, 'kill anchor'
t = t.replace(old_kill, PS)

# settle 4s → 6s（run_episode 内第一处 time.sleep(4)）
i = t.find('def run_episode')
j = t.find('time.sleep(4)', i)
assert j != -1, 'settle anchor'
t = t[:j] + 'time.sleep(6)' + t[j + len('time.sleep(4)'):]

# 主窗口未出现 → 重试一次
i = t.find('主窗口未出现')
nl = t.find(chr(10), i) + 1
retry = (
    '    subprocess.run([' + Q + 'powershell' + Q + ', ' + Q + '-Command' + Q + ', ' + PS + '], capture_output=True)' + NL0 if False else
    '    subprocess.run([' + Q + 'powershell' + Q + ', ' + Q + '-Command' + Q + ', ' + PS + '], capture_output=True)' + chr(10) +
    '    time.sleep(3)' + chr(10) +
    '    proc = subprocess.Popen([exe], cwd=os.path.dirname(exe))' + chr(10) +
    '    for _ in range(35):' + chr(10) +
    '        time.sleep(1)' + chr(10) +
    '        host = find_host(host_title)' + chr(10) +
    '        if host:' + chr(10) +
    '            break' + chr(10)
)
t = t[:nl] + retry + t[nl:]
io.open(p, 'w', encoding='utf-8', newline='').write(t)
print('patched v2')
