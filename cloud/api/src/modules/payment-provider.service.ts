import crypto from 'node:crypto';
import { Injectable, type OnModuleInit } from '@nestjs/common';

export type PaymentProviderId = 'WECHAT' | 'ALIPAY';
export interface PaymentGatewayResponse { providerOrderId: string; paymentUrl: string }
export interface VerifiedPaymentEvent { eventId: string; providerOrderId: string; status: 'paid' | 'refunded'; amountMinor: string; currency: string }
export type PaymentHeaders = Record<string, string | string[] | undefined>;

@Injectable()
export class PaymentProviderService implements OnModuleInit {
  onModuleInit() {
    if (process.env.NODE_ENV !== 'production') return;
    const status = this.configurationStatus();
    const missing = status.providers.filter(item => !item.ready).map(item => `${item.label}：${item.missing.join('、')}`);
    if (missing.length) throw new Error(`生产支付配置不完整：${missing.join('；')}`);
  }

  configurationStatus() {
    const wechatRequired = ['WECHAT_PAY_MCH_ID', 'WECHAT_PAY_APP_ID', 'WECHAT_PAY_CERT_SERIAL_NO', 'WECHAT_PAY_PRIVATE_KEY_PEM', 'WECHAT_PAY_API_V3_KEY', 'WECHAT_PAY_PLATFORM_PUBLIC_KEY_PEM', 'WECHAT_PAY_NOTIFY_URL'];
    const alipayRequired = ['ALIPAY_APP_ID', 'ALIPAY_PRIVATE_KEY_PEM', 'ALIPAY_PUBLIC_KEY_PEM', 'ALIPAY_NOTIFY_URL'];
    const provider = (id: PaymentProviderId, label: string, required: string[]) => {
      const missing = required.filter(name => !process.env[name]?.trim());
      const notifyName = id === 'WECHAT' ? 'WECHAT_PAY_NOTIFY_URL' : 'ALIPAY_NOTIFY_URL';
      if (process.env.NODE_ENV === 'production' && process.env[notifyName] && !process.env[notifyName]!.startsWith('https://')) missing.push(`${notifyName}(必须为 HTTPS)`);
      return { id: id.toLowerCase(), label, mode: 'official-direct', ready: missing.length === 0, missing: [...new Set(missing)] };
    };
    const providers = [provider('WECHAT', '微信支付 Native', wechatRequired), provider('ALIPAY', '支付宝当面付', alipayRequired)];
    return { ready: providers.every(item => item.ready), providers };
  }

  async createOrder(provider: PaymentProviderId, order: { id: string; subject: string; amountMinor: bigint; expiresAt: Date }): Promise<PaymentGatewayResponse> {
    return provider === 'WECHAT' ? await this.createWechatOrder(order) : await this.createAlipayOrder(order);
  }

  verifyWebhook(provider: PaymentProviderId, rawBody: string, headers: PaymentHeaders): VerifiedPaymentEvent {
    return provider === 'WECHAT' ? this.verifyWechatWebhook(rawBody, headers) : this.verifyAlipayWebhook(rawBody);
  }

  private async createWechatOrder(order: { id: string; subject: string; amountMinor: bigint; expiresAt: Date }) {
    const config = this.wechatConfig();
    const url = new URL('/v3/pay/transactions/native', process.env.WECHAT_PAY_API_ORIGIN || 'https://api.mch.weixin.qq.com');
    const body = JSON.stringify({
      appid: config.appId,
      mchid: config.mchId,
      description: order.subject.slice(0, 127),
      out_trade_no: order.id,
      time_expire: order.expiresAt.toISOString().replace(/\.\d{3}Z$/u, '+00:00'),
      notify_url: config.notifyUrl,
      amount: { total: Number(order.amountMinor), currency: 'CNY' }
    });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = crypto.randomBytes(16).toString('hex');
    const canonical = `POST\n${url.pathname}${url.search}\n${timestamp}\n${nonce}\n${body}\n`;
    const signature = crypto.sign('RSA-SHA256', Buffer.from(canonical), config.merchantPrivateKey).toString('base64');
    const authorization = `WECHATPAY2-SHA256-RSA2048 mchid="${config.mchId}",nonce_str="${nonce}",timestamp="${timestamp}",serial_no="${config.serialNo}",signature="${signature}"`;
    const response = await fetch(url, { method: 'POST', headers: { authorization, accept: 'application/json', 'content-type': 'application/json', 'user-agent': 'LingBuilder-Cloud/1.0' }, body });
    const rawResponse = await response.text();
    if (response.ok) this.verifyWechatMessage(rawResponse, Object.fromEntries(response.headers.entries()), config.platformPublicKey);
    const value: any = parseJson(rawResponse);
    if (!response.ok || typeof value.code_url !== 'string') throw gatewayFailure(value.message || value.code || '微信支付创建订单失败。');
    return { providerOrderId: order.id, paymentUrl: value.code_url };
  }

  private async createAlipayOrder(order: { id: string; subject: string; amountMinor: bigint; expiresAt: Date }) {
    const config = this.alipayConfig();
    const params: Record<string, string> = {
      app_id: config.appId,
      method: 'alipay.trade.precreate',
      format: 'JSON',
      charset: 'utf-8',
      sign_type: 'RSA2',
      timestamp: formatChinaTimestamp(new Date()),
      version: '1.0',
      notify_url: config.notifyUrl,
      biz_content: JSON.stringify({ out_trade_no: order.id, total_amount: minorToDecimal(order.amountMinor), subject: order.subject.slice(0, 256), timeout_express: '15m' })
    };
    params.sign = crypto.sign('RSA-SHA256', Buffer.from(canonicalAlipay(params)), config.merchantPrivateKey).toString('base64');
    const response = await fetch(config.gatewayUrl, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded;charset=utf-8', 'user-agent': 'LingBuilder-Cloud/1.0' }, body: new URLSearchParams(params).toString() });
    const rawResponse = await response.text();
    const value: any = parseJson(rawResponse);
    const result = value.alipay_trade_precreate_response;
    const signedContent = extractAlipayResponseNode(rawResponse, 'alipay_trade_precreate_response');
    if (!value.sign || !signedContent || !crypto.verify('RSA-SHA256', Buffer.from(signedContent), config.alipayPublicKey, Buffer.from(String(value.sign), 'base64'))) throw gatewayFailure('支付宝同步响应签名校验失败。');
    if (!response.ok || result?.code !== '10000' || typeof result?.qr_code !== 'string') throw gatewayFailure(result?.sub_msg || result?.msg || '支付宝创建订单失败。');
    return { providerOrderId: order.id, paymentUrl: result.qr_code };
  }

  private verifyWechatWebhook(rawBody: string, headers: PaymentHeaders): VerifiedPaymentEvent {
    const config = this.wechatConfig();
    this.verifyWechatMessage(rawBody, headers, config.platformPublicKey);
    const envelope: any = parseJson(rawBody);
    if (typeof envelope.id !== 'string' || !envelope.resource) throw invalidWebhook('微信支付回调内容无效。');
    const resource = envelope.resource;
    const ciphertext = Buffer.from(String(resource.ciphertext || ''), 'base64');
    if (ciphertext.length <= 16) throw invalidWebhook('微信支付回调密文无效。');
    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(config.apiV3Key, 'utf8'), Buffer.from(String(resource.nonce || ''), 'utf8'));
    decipher.setAAD(Buffer.from(String(resource.associated_data || ''), 'utf8'));
    decipher.setAuthTag(ciphertext.subarray(ciphertext.length - 16));
    const decrypted = Buffer.concat([decipher.update(ciphertext.subarray(0, -16)), decipher.final()]).toString('utf8');
    const value: any = parseJson(decrypted);
    const eventType = String(envelope.event_type || '');
    if (eventType === 'TRANSACTION.SUCCESS' && value.trade_state === 'SUCCESS') return { eventId: envelope.id, providerOrderId: String(value.out_trade_no || ''), status: 'paid', amountMinor: String(value.amount?.total ?? ''), currency: String(value.amount?.currency || 'CNY') };
    if (eventType === 'REFUND.SUCCESS' && value.refund_status === 'SUCCESS') return { eventId: envelope.id, providerOrderId: String(value.out_trade_no || ''), status: 'refunded', amountMinor: '0', currency: String(value.amount?.currency || 'CNY') };
    throw invalidWebhook('微信支付回调事件不是已支付或已退款状态。');
  }

  private verifyAlipayWebhook(rawBody: string): VerifiedPaymentEvent {
    const config = this.alipayConfig();
    const params = new URLSearchParams(rawBody);
    const signature = params.get('sign') || '';
    const values: Record<string, string> = {};
    for (const [key, value] of params.entries()) if (key !== 'sign' && key !== 'sign_type') values[key] = value;
    if (!signature || !crypto.verify('RSA-SHA256', Buffer.from(canonicalAlipay(values)), config.alipayPublicKey, Buffer.from(signature, 'base64'))) throw invalidWebhook('支付宝回调签名无效。');
    if (params.get('app_id') !== config.appId) throw invalidWebhook('支付宝回调 app_id 不匹配。');
    if (config.sellerId && params.get('seller_id') !== config.sellerId) throw invalidWebhook('支付宝回调 seller_id 不匹配。');
    const status = params.get('trade_status') || '';
    const refunded = Boolean(params.get('refund_fee')) && status === 'TRADE_CLOSED';
    if (!refunded && !['TRADE_SUCCESS', 'TRADE_FINISHED'].includes(status)) throw invalidWebhook('支付宝回调不是已支付或已退款状态。');
    return {
      eventId: params.get('notify_id') || crypto.createHash('sha256').update(rawBody).digest('hex'),
      providerOrderId: params.get('out_trade_no') || '',
      status: refunded ? 'refunded' : 'paid',
      amountMinor: refunded ? '0' : decimalToMinor(params.get('total_amount') || ''),
      currency: 'CNY'
    };
  }

  private verifyWechatMessage(rawBody: string, headers: PaymentHeaders, publicKey: crypto.KeyObject) {
    const get = (name: string) => {
      const value = headers[name] ?? headers[name.toLowerCase()] ?? headers[name.toUpperCase()];
      return Array.isArray(value) ? value[0] : String(value || '');
    };
    const timestamp = get('wechatpay-timestamp');
    const nonce = get('wechatpay-nonce');
    const signature = get('wechatpay-signature');
    const serial = get('wechatpay-serial');
    const expectedSerial = process.env.WECHAT_PAY_PLATFORM_SERIAL_NO?.trim();
    if (!timestamp || !nonce || !signature || (expectedSerial && serial !== expectedSerial)) throw invalidWebhook('微信支付签名响应头不完整或证书序列号不匹配。');
    const message = `${timestamp}\n${nonce}\n${rawBody}\n`;
    if (!crypto.verify('RSA-SHA256', Buffer.from(message), publicKey, Buffer.from(signature, 'base64'))) throw invalidWebhook('微信支付签名校验失败。');
  }

  private wechatConfig() {
    const apiV3Key = required('WECHAT_PAY_API_V3_KEY');
    if (Buffer.byteLength(apiV3Key, 'utf8') !== 32) throw gatewayFailure('WECHAT_PAY_API_V3_KEY 必须正好是 32 字节。');
    return { mchId: required('WECHAT_PAY_MCH_ID'), appId: required('WECHAT_PAY_APP_ID'), serialNo: required('WECHAT_PAY_CERT_SERIAL_NO'), merchantPrivateKey: crypto.createPrivateKey(pem('WECHAT_PAY_PRIVATE_KEY_PEM')), platformPublicKey: crypto.createPublicKey(pem('WECHAT_PAY_PLATFORM_PUBLIC_KEY_PEM')), apiV3Key, notifyUrl: requiredHttps('WECHAT_PAY_NOTIFY_URL') };
  }

  private alipayConfig() {
    return { appId: required('ALIPAY_APP_ID'), merchantPrivateKey: crypto.createPrivateKey(pem('ALIPAY_PRIVATE_KEY_PEM')), alipayPublicKey: crypto.createPublicKey(pem('ALIPAY_PUBLIC_KEY_PEM')), notifyUrl: requiredHttps('ALIPAY_NOTIFY_URL'), gatewayUrl: process.env.ALIPAY_GATEWAY_URL?.trim() || 'https://openapi.alipay.com/gateway.do', sellerId: process.env.ALIPAY_SELLER_ID?.trim() || '' };
  }
}

function required(name: string) { const value = process.env[name]?.trim(); if (!value) throw gatewayFailure(`缺少支付配置 ${name}。`); return value; }
function pem(name: string) { return required(name).replace(/\\n/gu, '\n'); }
function requiredHttps(name: string) { const value = required(name); if (process.env.NODE_ENV === 'production' && !value.startsWith('https://')) throw gatewayFailure(`${name} 必须使用 HTTPS。`); return value; }
function canonicalAlipay(values: Record<string, string>) { return Object.keys(values).filter(key => values[key] !== '').sort().map(key => `${key}=${values[key]}`).join('&'); }
function minorToDecimal(value: bigint) { return `${value / 100n}.${(value % 100n).toString().padStart(2, '0')}`; }
function decimalToMinor(value: string) { const match = /^(\d+)(?:\.(\d{1,2}))?$/u.exec(value); if (!match) throw invalidWebhook('支付宝回调金额格式无效。'); return (BigInt(match[1]) * 100n + BigInt((match[2] || '').padEnd(2, '0'))).toString(); }
function formatChinaTimestamp(value: Date) { const parts = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).formatToParts(value); const get = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value || ''; return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`; }
function extractAlipayResponseNode(raw: string, key: string) { const marker = `"${key}":`; const start = raw.indexOf(marker); if (start < 0) return ''; let index = start + marker.length; while (/\s/u.test(raw[index] || '')) index += 1; if (raw[index] !== '{') return ''; const contentStart = index; let depth = 0; let inString = false; let escaped = false; for (; index < raw.length; index += 1) { const char = raw[index]; if (inString) { if (escaped) escaped = false; else if (char === '\\') escaped = true; else if (char === '"') inString = false; continue; } if (char === '"') inString = true; else if (char === '{') depth += 1; else if (char === '}' && --depth === 0) return raw.slice(contentStart, index + 1); } return ''; }
function parseJson(value: string) { try { return JSON.parse(value || '{}'); } catch { throw gatewayFailure('支付服务返回了无效 JSON。'); } }
function gatewayFailure(message: string) { return Object.assign(new Error(message), { status: 503, code: 'MODULE_ACCESS_UNAVAILABLE' }); }
function invalidWebhook(message: string) { return Object.assign(new Error(message), { status: 401, code: 'AUTH_INVALID' }); }
