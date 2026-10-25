# -*- coding: utf-8 -*-
"""钉钉 @ 字段回显器：解析请求体里的 at.atMobiles / at.isAtAll / 正文 @ 文本，回显判定。"""
import json
from http.server import BaseHTTPRequestHandler, HTTPServer

LAST = {}

class H(BaseHTTPRequestHandler):
    def do_POST(self):
        n = int(self.headers.get('Content-Length', 0) or 0)
        body = self.rfile.read(n).decode('utf-8', 'replace') if n else ''
        LAST['body'] = body
        print('BODY:', body, flush=True)
        try:
            j = json.loads(body)
            at = j.get('at') or {}
            mobiles = at.get('atMobiles') or []
            is_all = at.get('isAtAll', False)
            content = ((j.get('text') or {}).get('content') or '') + ((j.get('markdown') or {}).get('text') or '')
            at_cnt = content.count('@138')
            msg = f"atMobiles={len(mobiles)}个 isAtAll={'true' if is_all else 'false'} 正文@文本={at_cnt}处"
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

HTTPServer(('127.0.0.1', 18778), H).serve_forever()
