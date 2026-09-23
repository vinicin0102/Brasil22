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

Seção `#oferta`: App Brasil 22 completo por R$ 12,90 e três adicionais (order bumps) de R$ 5,90 cada:
`figurinhas`, `artes_pt` e `foto_mito`. O total é calculado na página.

**Pendente:** ligar o botão ao checkout PIX da ZuckPay na função `abrirCheckout(adicionais, total)`.
O valor cobrado precisa ser calculado no servidor a partir dos ids — nunca confie no total enviado pelo navegador.
Checkout com PHP exige hospedagem com PHP (GitHub Pages e Vercel estático não executam PHP).
