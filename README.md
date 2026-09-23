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
- `assets/foto-destaque.jpg` — foto do painel da primeira dobra
- `assets/video.mp4` — vídeo da seção "Entenda o que está acontecendo no Brasil"
