# -*- coding: utf-8 -*-
# CDP 接管 FBro 浏览器：/json/list → WebSocket → Runtime.evaluate
import json
import os
import urllib.request
import websocket  # pip install websocket-client

port = os.environ.get("CDP_PORT", "0")
print("CDP_PORT =", port)

pages = json.load(urllib.request.urlopen("http://127.0.0.1:%s/json/list" % port, timeout=5))
target = None
for p in pages:
    if p.get("type") == "page":
        target = p
        break
if target is None:
    print("NO_PAGE")
    raise SystemExit(1)
print("PAGE:", target.get("title"), "|", target.get("url"))
ws = websocket.create_connection(target["webSocketDebuggerUrl"], timeout=10)


def evaluate(expr):
    ws.send(json.dumps({"id": 1, "method": "Runtime.evaluate",
                        "params": {"expression": expr, "returnByValue": True}}))
    while True:
        msg = json.loads(ws.recv())
        if msg.get("id") == 1:
            return msg.get("result", {}).get("result", {}).get("value")


print("STEP1 navigator.userAgent ==", evaluate("navigator.userAgent"))
print("STEP2 document.title ==", evaluate("document.title"))
print("STEP3 location.href ==", evaluate("location.href"))

# 外部控制页面：改标题 + 画一个横幅（右侧 exe 截图可见）
js = (
    "document.title = 'CDP 接管成功';"
    "var b = document.createElement('div');"
    "b.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:999999;"
    "background:#16a34a;color:#fff;font:700 34px sans-serif;padding:18px;"
    "text-align:center';"
    "b.textContent = 'CDP Takeover OK - Python was here';"
    "document.body.appendChild(b);"
    "'banner-ok'"
)
print("STEP4 banner ==", evaluate(js))
ws.close()
print("ALL_DONE")
