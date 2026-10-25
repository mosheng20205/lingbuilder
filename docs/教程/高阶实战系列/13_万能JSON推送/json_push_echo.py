# -*- coding: utf-8 -*-
"""万能 JSON 推送回显器：合法 JSON 回 errcode=0+摘要，残缺 JSON 回 errcode=1+原因。"""
import json
from http.server import BaseHTTPRequestHandler, HTTPServer

class H(BaseHTTPRequestHandler):
    def do_POST(self):
        n = int(self.headers.get('Content-Length', 0) or 0)
        body = self.rfile.read(n).decode('utf-8', 'replace') if n else ''
        print('BODY:', body, flush=True)
        try:
            j = json.loads(body)
            title = j.get('title', '')
            keys = ','.join(list(j.keys())[:4])
            msg = f"ok 已收 {len(body)} 字节 字段={keys}" + (f" title={title}" if title else "")
            code = 0
        except Exception as e:
            msg = f"JSON 解析失败：{e}"
            code = 1
        print('VERDICT:', code, msg, flush=True)
        resp = json.dumps({"errcode": code, "errmsg": msg}, ensure_ascii=False).encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(resp)))
        self.end_headers()
        self.wfile.write(resp)
    def log_message(self, *a):
        pass

HTTPServer(('127.0.0.1', 18781), H).serve_forever()
