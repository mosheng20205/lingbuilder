# -*- coding: utf-8 -*-
"""飞书加签验签器：官方口径 base64(hmac_sha256(key="秒时间戳\\n密钥", msg=b""))，回显判定。"""
import json, hmac, hashlib, base64
from http.server import BaseHTTPRequestHandler, HTTPServer

SEC = "SECdemoFeishu0123456789abcdef"

class H(BaseHTTPRequestHandler):
    def do_POST(self):
        n = int(self.headers.get('Content-Length', 0) or 0)
        body = self.rfile.read(n).decode('utf-8', 'replace') if n else ''
        print('BODY:', body, flush=True)
        try:
            j = json.loads(body)
            ts = str(j.get('timestamp', ''))
            sign = str(j.get('sign', ''))
            string_to_sign = f"{ts}\n{SEC}"
            expected = base64.b64encode(hmac.new(string_to_sign.encode('utf-8'), digestmod=hashlib.sha256).digest()).decode()
            ok = (expected == sign)
            print('SIGN_OK:', ok, 'expected:', expected, flush=True)
            msg = ("验签通过 sign=" + sign[:24] + "…（官方口径：拼接串当密钥、消息为空）") if ok else ("验签失败 sign=" + sign[:24] + "…")
        except Exception as e:
            ok = False
            msg = f"解析失败:{e}"
        resp = json.dumps({"code": 0 if ok else 1, "msg": msg}, ensure_ascii=False).encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(resp)))
        self.end_headers()
        self.wfile.write(resp)
    def log_message(self, *a):
        pass

HTTPServer(('127.0.0.1', 18780), H).serve_forever()
