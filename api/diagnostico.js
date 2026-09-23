'use strict';

/**
 * Diagnóstico da integração:  /api/diagnostico?token=SEU_ZUCKPAY_DEBUG_TOKEN
 *
 * Confere a configuração e faz uma cobrança de teste de R$ 1,00, mostrando a
 * resposta real da ZuckPay. Sem ZUCKPAY_DEBUG_TOKEN responde 404.
 * Remova a variável depois de resolver.
 */

const crypto = require('crypto');
const z = require('./_zuckpay');

function mascarar(v) {
  if (!v) return '(vazio)';
  if (v.length <= 8) return '*'.repeat(v.length) + ` (${v.length} chars)`;
  return v.slice(0, 4) + '******' + v.slice(-4) + ` (${v.length} chars)`;
}

function veredito(status, resposta, redirect) {
  if (redirect) return 'REDIRECIONAMENTO — corrija ZUCKPAY_API_BASE (host com/sem www). Destino: ' + redirect;
  if (status === 0) return 'FALHA DE CONEXAO — a função não alcançou a ZuckPay.';
  if (status === 401) return 'NAO AUTORIZADO — client_id/client_secret errados, revogados ou sem permissão para PIX.';
  if (status === 403) return 'IP BLOQUEADO — a ZuckPay recusou o IP da Vercel (IP Whitelist). A Vercel não tem IP fixo: desative a whitelist ou use um plano com IP estático.';
  if (status === 429) return 'RATE LIMIT — 5 tentativas por 30 minutos. Aguarde.';
  if (status === 404) return 'ENDPOINT NAO ENCONTRADO — confira ZUCKPAY_API_BASE.';
  if (status === 200 && resposta.transactionId) return 'OK — cobrança de teste criada. A integração está funcionando.';
  return 'A API respondeu, mas sem transactionId. Veja a resposta.';
}

module.exports = async function handler(req, res) {
  const cfg = z.config(req);
  const informado = new URL(req.url, 'http://local').searchParams.get('token') || '';
  const a = Buffer.from(cfg.debugToken);
  const b = Buffer.from(informado);
  if (!cfg.debugToken || a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return z.responder(res, 404, { erro: 'Não encontrado.' });
  }

  const checagens = {
    node: process.version,
    client_id: mascarar(cfg.clientId),
    client_secret: mascarar(cfg.clientSecret),
    api_base: cfg.apiBase,
    webhook_url: cfg.webhookUrl,
    webhook_secret: cfg.webhookSecret ? mascarar(cfg.webhookSecret) : '(vazio) — gere em Integrações > Webhook Secret',
    product_id: cfg.productId || '(nenhum)',
    planos: z.PLANOS,
    adicionais: z.ADICIONAIS,
  };

  const payload = {
    nome: 'Teste Diagnostico', cpf: '52998224725', valor: 1.0,
    email: 'teste@exemplo.com', telefone: '11999998888', urlnoty: cfg.webhookUrl,
  };
  if (cfg.productId) payload.product_id = cfg.productId;

  const [status, resposta, redirect] = await z.chamarZuckpay(cfg, 'POST', '/qrcode', payload);
  const teste = { http: status, resultado: veredito(status, resposta, redirect), resposta_da_api: resposta };

  let alternativa = null;
  if (status !== 200) {
    const outra = cfg.apiBase.includes('://www.') ? cfg.apiBase.replace('://www.', '://') : cfg.apiBase.replace('://', '://www.');
    const [st2, resp2, red2] = await z.chamarZuckpay({ ...cfg, apiBase: outra }, 'POST', '/qrcode', payload);
    alternativa = { url: outra, http: st2, resultado: veredito(st2, resp2, red2) };
  }

  return z.responder(res, 200, {
    atencao: 'Endpoint de diagnóstico. Remova ZUCKPAY_DEBUG_TOKEN após resolver.',
    checagens, teste, alternativa,
  });
};
