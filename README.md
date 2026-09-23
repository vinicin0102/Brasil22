# Brasil 22 — Landing page

Página de vendas estática do aplicativo **Brasil 22** (notícias políticas e alertas no celular).
Arquivo único: `index.html` (HTML + CSS + JS, sem build). Basta publicar em qualquer hospedagem estática.

## Configuração

No topo do `<script>` no fim do `index.html`:

- `APP_URL` — link da loja/download do app. Vazio = os botões levam até o vídeo.
- `VIDEO_URL` — caminho de um arquivo de vídeo (padrão: `assets/video.mp4`) ou URL de incorporação (ex.: `https://www.youtube.com/embed/ID`).
- `LINKS` — Termos de Uso, Política de Privacidade e Contato.

## Arquivos

- `assets/fundo-hero.jpg` — fundo da primeira dobra
- `assets/foto-destaque.png` — imagem do painel da primeira dobra
- `assets/video.mp4` — vídeo da seção "Entenda o que está acontecendo no Brasil"

## Oferta

Seção `#oferta`: App Brasil 22 completo por **R$ 12,90** e três adicionais (order bumps) de **R$ 5,90**:
`figurinhas`, `artes_pt` e `foto_mito`. O botão abre o checkout PIX da ZuckPay com os itens marcados.

## Checkout PIX (ZuckPay) — funções da Vercel

```
api/pix.js          cria a cobrança PIX (produto + adicionais)
api/status.js       consulta o status do pagamento
api/webhook.js      recebe a notificação da ZuckPay
api/diagnostico.js  checagem da integração (protegido por token)
api/_zuckpay.js     preços, validação e chamada autenticada à API
```

A Vercel não executa PHP, por isso o checkout roda como funções Node na pasta `api/`.
Configure em **Vercel > Settings > Environment Variables** (Production):

| Variável | Obrigatória | Para quê |
|---|---|---|
| `client_id` | sim | Client ID da ZuckPay |
| `client_secret` | sim | Client Secret da ZuckPay |
| `ZUCKPAY_WEBHOOK_SECRET` | recomendado | valida a assinatura dos postbacks |
| `ZUCKPAY_API_BASE` | não | padrão `https://www.zuckpay.com.br/conta/v3/pix` |
| `ZUCKPAY_WEBHOOK_URL` | não | padrão `https://<domínio>/api/webhook` |
| `ZUCKPAY_PRODUCT_ID` | não | vincula a venda ao produto no painel |
| `ZUCKPAY_DEBUG_TOKEN` | não | libera `/api/diagnostico?token=...` — remova depois |

Depois de mudar variáveis, faça **Redeploy** para valerem.

- Preços ficam em `api/_zuckpay.js` (`PLANOS` e `ADICIONAIS`). O navegador envia só os ids;
  qualquer valor vindo da página é ignorado. Se mudar preço, mude também os valores exibidos no `index.html`.
- Cadastre `https://<seu-domínio>/api/webhook` em Integrações > Webhooks no painel da ZuckPay.
- **IP Whitelist:** a Vercel não tem IP fixo. Se a whitelist da ZuckPay estiver ativa, o PIX é recusado (403).
- Se o PIX não gerar, crie `ZUCKPAY_DEBUG_TOKEN`, faça redeploy e abra `/api/diagnostico?token=SEU_TOKEN`.
- Erros aparecem em Vercel > Logs, com o prefixo `[zuckpay]`.

**Pendente:** entrega do produto. `api/webhook.js` tem um `TODO` no ponto onde entra a liberação do
app e o envio dos adicionais. Como a Vercel não tem disco persistente, use um banco (Vercel KV / Upstash)
para garantir que cada pagamento seja entregue uma única vez.
