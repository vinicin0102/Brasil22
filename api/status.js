'use strict';

/**
 * Consulta o status de uma cobrança.
 * GET ?transactionId=...  ->  { status, pago, final, confirmado_em, proxima_consulta }
 */

const z = require('./_zuckpay');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return z.responder(res, 405, { erro: 'Método não permitido.' });

  const url = new URL(req.url, 'http://local');
  const transactionId = url.searchParams.get('transactionId') || '';
  if (!z.ID_TRANSACAO.test(transactionId)) return z.responder(res, 400, { erro: 'transactionId inválido.' });

  const cfg = z.config(req);
  const [status, resposta] = await z.chamarZuckpay(cfg, 'GET', '/status?transactionId=' + encodeURIComponent(transactionId));

  // 429 = rate limit da ZuckPay. Pede à página para consultar mais devagar.
  if (status === 429) {
    z.registrarErro('status', 'rate limit ao consultar ' + transactionId);
    return z.responder(res, 200, { status: 'PENDING', pago: false, confirmado_em: '', proxima_consulta: 30 });
  }
  if (status !== 200 || resposta.status === undefined) {
    z.registrarErro('status', `HTTP ${status} para ${transactionId}`);
    return z.responder(res, 502, { erro: 'Não foi possível consultar o pagamento.' });
  }

  const situacao = String(resposta.status).toUpperCase();
  return z.responder(res, 200, {
    status: situacao,
    pago: situacao === 'PAID',
    final: ['PAID', 'FAILED', 'REFUSED', 'EXPIRADO', 'REFUNDED'].includes(situacao),
    confirmado_em: String(resposta.confirmed_date || ''),
    proxima_consulta: 5,
  });
};
