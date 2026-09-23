'use strict';

/**
 * Recebe as notificações da ZuckPay (campo urlnoty da cobrança).
 *
 * 1. Assinatura HMAC do header X-ZuckPay-Signature (com ZUCKPAY_WEBHOOK_SECRET):
 *    prova que o POST veio da ZuckPay.
 * 2. Reconsulta do status na API: prova que o pagamento está pago agora,
 *    independente do que o corpo do POST diz.
 */

const z = require('./_zuckpay');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return z.responder(res, 405, { erro: 'Método não permitido.' });

  const cfg = z.config(req);

  // O HMAC é calculado sobre os bytes exatos que chegaram.
  const corpoRaw = await z.lerCorpoRaw(req);

  if (cfg.webhookSecret) {
    const [valida, motivo] = z.assinaturaWebhookValida(req.headers['x-zuckpay-signature'], corpoRaw, cfg.webhookSecret);
    if (!valida) {
      z.registrarErro('webhook', 'assinatura recusada: ' + motivo);
      return z.responder(res, 401, { erro: 'Assinatura inválida.' });
    }
  } else {
    z.registrarErro('webhook', 'ZUCKPAY_WEBHOOK_SECRET não configurado — validando só pela API');
  }

  let corpo = {};
  try { corpo = JSON.parse(corpoRaw) || {}; } catch (_) { corpo = {}; }

  // Dois formatos: { event, transaction: { id, ... } } ou { transactionId, status, ... }
  const transacao = corpo.transaction && typeof corpo.transaction === 'object' ? corpo.transaction : {};
  const transactionId = String(transacao.id || corpo.transactionId || corpo.transaction_id || '');
  const evento = String(corpo.event || '');

  if (!z.ID_TRANSACAO.test(transactionId)) {
    z.registrarErro('webhook', 'id ausente no payload: ' + corpoRaw.slice(0, 300));
    return z.responder(res, 400, { erro: 'transactionId ausente ou inválido.' });
  }

  // Eventos que não exigem entrega: responde sem gastar chamada (rate limit).
  if (['payment_refused', 'payment_pending', 'checkout_abandoned'].includes(evento)) {
    return z.responder(res, 200, { ok: true, ignorado: evento });
  }

  const [status, resposta] = await z.chamarZuckpay(cfg, 'GET', '/status?transactionId=' + encodeURIComponent(transactionId));
  if (status !== 200 || resposta.status === undefined) {
    z.registrarErro('webhook', `falha ao verificar ${transactionId} (HTTP ${status})`);
    return z.responder(res, 502, { erro: 'Não foi possível verificar a transação.' });
  }
  if (String(resposta.status).toUpperCase() !== 'PAID') {
    return z.responder(res, 200, { ok: true, ignorado: 'nao_pago' });
  }

  // Aparece em Vercel > Logs. Não há disco persistente na Vercel.
  console.log('[zuckpay][venda] ' + JSON.stringify({
    transactionId,
    evento,
    external_id_client: transacao.external_id_client || corpo.external_id_client || null,
    valor: resposta.amount || transacao.amount || null,
    produto: transacao.product_name || null,
    confirmado_em: resposta.confirmed_date || transacao.confirmed_date || null,
  }));

  /*
   * TODO — entrega do produto (liberar o app e enviar os adicionais comprados).
   * A ZuckPay pode reenviar a mesma notificação: antes de entregar, grave o
   * transactionId num banco (ex.: Vercel KV / Upstash) e só entregue uma vez.
   */

  return z.responder(res, 200, { ok: true });
};
