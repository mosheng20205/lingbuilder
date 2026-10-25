# -*- coding: utf-8 -*-
"""钉钉加签本地验签器：核对 timestamp/sign（HMAC-SHA256(key=SEC, msg=ts+"\n"+SEC)），回显验签结论。"""
import json, hmac, hashlib, base64, urllib.parse
from http.server import BaseHTTPRequestHandler, HTTPServer

SEC = "SECdemo0123456789abcdefSECdemo0123456789abcdef"
LAST = {}

class H(BaseHTTPRequestHandler):
    def do_POST(self):
        n = int(self.headers.get('Content-Length', 0) or 0)
        body = self.rfile.read(n).decode('utf-8', 'replace') if n else ''
        q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        ts = (q.get('timestamp') or [''])[0]
        sign = (q.get('sign') or [''])[0]
        string_to_sign = f"{ts}\n{SEC}"
        expected = base64.b64encode(hmac.new(SEC.encode(), string_to_sign.encode(), hashlib.sha256).digest()).decode()
        ok = (expected == sign)
        LAST.update(path=self.path, body=body, ts=ts, sign=sign, expected=expected, ok=ok)
        print('PATH:', self.path, flush=True)
        print('BODY:', body, flush=True)
        print('SIGN_OK:', ok, 'expected:', expected, flush=True)
        msg = ("验签通过 sign=" + sign[:24] + "…") if ok else ("验签失败 sign=" + sign[:24] + "…")
        resp = json.dumps({"errcode": 0 if ok else 1, "errmsg": msg, "timestamp": ts}, ensure_ascii=False).encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(resp)))
        self.end_headers()
        self.wfile.write(resp)
    def log_message(self, *a):
        pass

HTTPServer(('127.0.0.1', 18777), H).serve_forever()
