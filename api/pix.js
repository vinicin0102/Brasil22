'use strict';

/**
 * Cria uma cobrança PIX na ZuckPay.
 *
 * POST { plano, adicionais?, pedido, nome, cpf, email, telefone, rastreio? }
 * -> { transactionId, qrcode, qrcode_image, checkout_url, expiracao, valor, plano, pedido }
 */

const crypto = require('crypto');
const z = require('./_zuckpay');

const RASTREIO = [
  'utm_source', 'utm_campaign', 'utm_medium', 'utm_content', 'utm_term',
  'fbc', 'fbp', 'fbclid', 'gclid', 'ttclid', 'wbraid', 'gbraid',
  'kclid', 'click_id', 'src', 'sck',
];

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return z.responder(res, 405, { erro: 'Método não permitido.' });

  const cfg = z.config(req);
  if (!cfg.clientId || !cfg.clientSecret) {
    z.registrarErro('pix', 'client_id/client_secret não configurados nas variáveis de ambiente');
    return z.responder(res, 500, { erro: 'Pagamento indisponível no momento.' });
  }

  const corpo = await z.corpoJson(req);

  // Preço vem do servidor. Valor enviado pelo navegador é ignorado de propósito.
  const planoId = typeof corpo.plano === 'string' ? corpo.plano : '';
  const plano = Object.prototype.hasOwnProperty.call(z.PLANOS, planoId) ? z.PLANOS[planoId] : null;
  if (!plano) return z.responder(res, 400, { erro: 'Plano inválido.' });

  // Adicionais: só ids conhecidos; repetidos contam uma vez.
  const escolhidos = Array.isArray(corpo.adicionais) ? corpo.adicionais : [];
  const ids = [];
  for (const id of escolhidos) {
    if (typeof id !== 'string' || !Object.prototype.hasOwnProperty.call(z.ADICIONAIS, id)) {
      return z.responder(res, 400, { erro: 'Adicional inválido.' });
    }
    if (!ids.includes(id)) ids.push(id);
  }
  ids.sort();

  let centavos = Math.round(plano.valor * 100);
  let descricao = plano.nome;
  for (const id of ids) {
    centavos += Math.round(z.ADICIONAIS[id].valor * 100);
    descricao += ' + ' + z.ADICIONAIS[id].nome;
  }
  const valor = centavos / 100;
  descricao = descricao.slice(0, 250);

  const nome = String(corpo.nome || '').trim();
  const cpf = String(corpo.cpf || '').replace(/\D/g, '');
  const email = String(corpo.email || '').trim();
  const telefone = String(corpo.telefone || '').replace(/\D/g, '');

  const erros = {};
  if (nome.length < 3 || nome.length > 100) erros.nome = 'Informe seu nome completo.';
  if (!z.cpfValido(cpf)) erros.cpf = 'CPF inválido.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 150) erros.email = 'E-mail inválido.';
  if (telefone.length < 10 || telefone.length > 11) erros.telefone = 'Telefone inválido. Use DDD + número.';
  if (Object.keys(erros).length) return z.responder(res, 422, { erro: 'Dados inválidos.', campos: erros });

  /**
   * Idempotência: o navegador manda o mesmo "pedido" se o comprador clicar
   * duas vezes. Os adicionais entram no id: trocar a seleção gera outra
   * cobrança, com o valor certo, em vez de devolver a anterior.
   */
  let pedido = String(corpo.pedido || '').replace(/[^A-Za-z0-9-]/g, '');
  if (pedido.length < 8 || pedido.length > 60) pedido = crypto.randomBytes(12).toString('hex');
  const selecao = crypto.createHash('sha1').update(ids.join(',')).digest('hex').slice(0, 6);

  const payload = {
    nome, cpf, valor, email, telefone,
    urlnoty: cfg.webhookUrl,
    descricao,
    external_id_client: `B22-${planoId}-${selecao}-${pedido}`,
  };
  if (cfg.productId) payload.product_id = cfg.productId;

  const rastreio = corpo.rastreio && typeof corpo.rastreio === 'object' ? corpo.rastreio : {};
  for (const chave of RASTREIO) {
    const v = rastreio[chave];
    if (typeof v === 'string' && v !== '') payload[chave] = v.slice(0, 255);
  }

  const [status, resposta] = await z.chamarZuckpay(cfg, 'POST', '/qrcode', payload);

  if (status === 429) {
    z.registrarErro('pix', 'rate limit da ZuckPay');
    return z.responder(res, 429, { erro: 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.' });
  }
  if (status === 403) {
    z.registrarErro('pix', 'HTTP 403 — provável IP whitelist bloqueando o servidor');
    return z.responder(res, 502, { erro: 'Pagamento indisponível no momento. Já estamos verificando.' });
  }
  if (status !== 200 || !resposta.transactionId) {
    const ref = crypto.randomBytes(4).toString('hex');
    z.registrarErro('pix', `ref=${ref} HTTP ${status} ${JSON.stringify(resposta)}`);
    const saida = { erro: 'Não foi possível gerar o PIX agora. Tente novamente em instantes.', ref };
    if (cfg.debug) {
      const { cpf: _c, email: _e, telefone: _t, ...enviado } = payload;
      saida.debug = { http: status, resposta, enviado };
    }
    return z.responder(res, 502, saida);
  }

  // Só o que o navegador precisa. Nada de credencial, nada de valor líquido.
  return z.responder(res, 200, {
    transactionId: String(resposta.transactionId),
    qrcode: String(resposta.qrcode || resposta.pix_code || ''),
    qrcode_image: String(resposta.qrcode_image || ''),
    checkout_url: String(resposta.checkout_url || ''),
    expiracao: parseInt(resposta.calendar && resposta.calendar.expiration, 10) || 1200,
    valor,
    plano: descricao,
    pedido,
  });
};
