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

## Checkout PIX (ZuckPay)

```
api/pix.php              cria a cobrança PIX (produto + adicionais)
api/status.php           consulta o status do pagamento
api/webhook.php          recebe a notificação da ZuckPay
api/diagnostico.php      checagem da integração (protegido por token)
api/_bootstrap.php       validação, CORS e chamada autenticada à API
api/config.example.php   modelo de configuração
tools/testar-webhook.php testa a validação de assinatura do webhook (CLI)
```

1. Requer hospedagem com **PHP 8+ e cURL** (GitHub Pages e Vercel estático não rodam PHP).
2. `cp api/config.example.php api/config.php` e preencha `client_id`, `client_secret`,
   `webhook_url`, `webhook_secret` e `allowed_origins`. `config.php` está no `.gitignore` — nunca versione.
3. Preços ficam em `config.php` (`planos.app` e `adicionais`). O navegador envia só os ids;
   qualquer valor vindo da página é ignorado. Se mudar preço, mude também os valores exibidos no `index.html`.
4. Se o PIX não gerar, defina `debug_token` e abra `/api/diagnostico.php?token=SEU_TOKEN`.
5. Depois de configurar o `webhook_secret`, rode `php tools/testar-webhook.php` no servidor.

**Pendente:** entrega do produto. `api/webhook.php` tem um `TODO` no ponto onde entra a liberação do
app e o envio dos adicionais; roda uma única vez por pagamento.
