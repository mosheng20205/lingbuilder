# -*- coding: utf-8 -*-
"""钉钉卡片结构回显器：解析 actionCard（按钮数/横排）与 feedCard（条目数），回显判定。"""
import json
from http.server import BaseHTTPRequestHandler, HTTPServer

class H(BaseHTTPRequestHandler):
    def do_POST(self):
        n = int(self.headers.get('Content-Length', 0) or 0)
        body = self.rfile.read(n).decode('utf-8', 'replace') if n else ''
        print('BODY:', body, flush=True)
        try:
            j = json.loads(body)
            if 'actionCard' in j:
                ac = j['actionCard']
                btns = ac.get('btns') or []
                orient = '横排' if str(ac.get('btnOrientation', '0')) == '1' else '竖排'
                msg = f"actionCard 按钮={len(btns)}个 {orient} 独立跳转"
            elif 'feedCard' in j:
                links = (j['feedCard'] or {}).get('links') or []
                msg = f"feedCard 图文条目={len(links)}条"
            else:
                msg = "未识别的消息类型:" + ",".join(j.keys())
        except Exception as e:
            msg = f"解析失败:{e}"
        print('VERDICT:', msg, flush=True)
        resp = json.dumps({"errcode": 0, "errmsg": msg}, ensure_ascii=False).encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(resp)))
        self.end_headers()
        self.wfile.write(resp)
    def log_message(self, *a):
        pass

HTTPServer(('127.0.0.1', 18779), H).serve_forever()
