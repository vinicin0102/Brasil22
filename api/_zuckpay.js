'use strict';

/**
 * Utilitários compartilhados pelas funções do checkout (Vercel).
 * Arquivos com "_" na pasta api/ não viram rota — este não responde nada sozinho.
 *
 * Configuração por variáveis de ambiente (Vercel > Settings > Environment Variables):
 *   client_id / client_secret      credenciais da ZuckPay (obrigatórias)
 *   ZUCKPAY_API_BASE               padrão https://www.zuckpay.com.br/conta/v3/pix
 *   ZUCKPAY_WEBHOOK_SECRET         Webhook Secret do painel (recomendado)
 *   ZUCKPAY_WEBHOOK_URL            padrão https://<domínio>/api/webhook
 *   ZUCKPAY_PRODUCT_ID             id do produto no painel (opcional)
 *   ZUCKPAY_DEBUG_TOKEN            libera /api/diagnostico?token=... (vazio = desligado)
 *   ZUCKPAY_DEBUG=1                devolve o erro real da ZuckPay (só para investigar)
 */

const crypto = require('crypto');

/**
 * Preços ficam AQUI, no servidor. O navegador envia só os ids — um valor
 * vindo do cliente é sempre ignorado. Os ids dos adicionais precisam ser os
 * mesmos do index.html (value dos checkboxes name="bump").
 */
const PLANOS = {
  app: { nome: 'Brasil 22 — App completo', valor: 12.90 },
};
const ADICIONAIS = {
  figurinhas: { nome: '+30 figurinhas', valor: 5.90 },
  artes_pt: { nome: 'Artes para quando o PT perder', valor: 5.90 },
  foto_mito: { nome: 'Foto ao lado do mito', valor: 5.90 },
};

function env(...nomes) {
  for (const n of nomes) {
    const v = process.env[n];
    if (typeof v === 'string' && v.trim() !== '') return v.trim();
  }
  return '';
}

function config(req) {
  const host = (req && req.headers && (req.headers['x-forwarded-host'] || req.headers.host)) || '';
  return {
    clientId: env('client_id', 'ZUCKPAY_CLIENT_ID', 'CLIENT_ID'),
    clientSecret: env('client_secret', 'ZUCKPAY_CLIENT_SECRET', 'CLIENT_SECRET'),
    apiBase: env('ZUCKPAY_API_BASE', 'api_base') || 'https://www.zuckpay.com.br/conta/v3/pix',
    webhookSecret: env('ZUCKPAY_WEBHOOK_SECRET', 'webhook_secret'),
    webhookUrl: env('ZUCKPAY_WEBHOOK_URL', 'webhook_url') || (host ? `https://${host}/api/webhook` : ''),
    productId: parseInt(env('ZUCKPAY_PRODUCT_ID', 'product_id'), 10) || 0,
    debugToken: env('ZUCKPAY_DEBUG_TOKEN', 'debug_token'),
    debug: env('ZUCKPAY_DEBUG') === '1',
  };
}

function responder(res, status, dados) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(dados));
}

/** Registra no log da função (Vercel > Logs), sem devolver detalhes ao cliente. */
function registrarErro(contexto, detalhe) {
  console.error(`[zuckpay][${contexto}] ${detalhe}`);
}

/** Lê o corpo cru — necessário para validar o HMAC do webhook byte a byte. */
function lerCorpoRaw(req) {
  return new Promise((resolve, reject) => {
    const partes = [];
    req.on('data', (c) => partes.push(c));
    req.on('end', () => resolve(Buffer.concat(partes).toString('utf8')));
    req.on('error', reject);
  });
}

async function corpoJson(req) {
  try {
    const dados = JSON.parse(await lerCorpoRaw(req));
    return dados && typeof dados === 'object' ? dados : {};
  } catch (_) {
    return {};
  }
}

/** Valida CPF incluindo os dígitos verificadores. */
function cpfValido(cpf) {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  for (let pos = 9; pos < 11; pos++) {
    let soma = 0;
    for (let i = 0; i < pos; i++) soma += Number(cpf[i]) * (pos + 1 - i);
    if (((10 * soma) % 11) % 10 !== Number(cpf[pos])) return false;
  }
  return true;
}

/**
 * Chamada autenticada à API da ZuckPay. O client_secret nunca sai do servidor.
 *
 * Redirecionamentos NÃO são seguidos: seguir um 3xx num POST autenticado
 * reenviaria o Authorization e costuma descartar o corpo. Devolvemos o
 * destino para que o api_base seja corrigido.
 *
 * @returns {Promise<[number, object, string]>} [status http, corpo, destino do redirect]
 */
async function chamarZuckpay(cfg, metodo, caminho, payload) {
  const url = cfg.apiBase.replace(/\/+$/, '') + caminho;
  const headers = {
    Accept: 'application/json',
    Authorization: 'Basic ' + Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64'),
  };
  const opcoes = { method: metodo, headers, redirect: 'manual', signal: AbortSignal.timeout(25000) };
  if (metodo === 'POST') {
    headers['Content-Type'] = 'application/json';
    opcoes.body = JSON.stringify(payload);
  }

  let r;
  try {
    r = await fetch(url, opcoes);
  } catch (e) {
    registrarErro('fetch', String(e && e.message));
    return [0, {}, ''];
  }

  let destino = '';
  if (r.status >= 300 && r.status < 400) {
    destino = r.headers.get('location') || '';
    registrarErro('redirect', `HTTP ${r.status} -> ${destino}`);
  }

  const texto = await r.text();
  try {
    const dados = JSON.parse(texto);
    return [r.status, dados && typeof dados === 'object' ? dados : {}, destino];
  } catch (_) {
    registrarErro('resposta', `HTTP ${r.status} com corpo não-JSON`);
    return [r.status, {}, destino];
  }
}

/**
 * Valida o header X-ZuckPay-Signature.
 * Formato: t=<timestamp>,v1=<hmac_sha256_hex>
 * Cálculo: HMAC-SHA256("<timestamp>.<corpo_raw>", webhook_secret)
 */
function assinaturaWebhookValida(header, corpoRaw, segredo) {
  if (!header) return [false, 'header X-ZuckPay-Signature ausente'];
  const partes = Object.fromEntries(
    String(header).split(',').map((p) => p.trim().split('=')).filter((p) => p.length === 2)
  );
  const ts = partes.t || '';
  const v1 = partes.v1 || '';
  if (!/^\d+$/.test(ts) || !/^[0-9a-f]+$/i.test(v1)) return [false, 'header malformado'];

  // Anti-replay: recusa assinaturas velhas ou com data no futuro.
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return [false, 'timestamp fora da janela de 5 minutos'];

  const esperado = crypto.createHmac('sha256', segredo).update(`${ts}.${corpoRaw}`).digest('hex');
  const a = Buffer.from(esperado, 'hex');
  const b = Buffer.from(v1, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return [false, 'assinatura não confere'];
  return [true, ''];
}

const ID_TRANSACAO = /^[A-Za-z0-9._-]{8,128}$/;

module.exports = {
  PLANOS, ADICIONAIS, ID_TRANSACAO,
  config, responder, registrarErro, lerCorpoRaw, corpoJson,
  cpfValido, chamarZuckpay, assinaturaWebhookValida,
};
