<?php
/**
 * Copie este arquivo para config.php e preencha com os dados reais.
 * config.php está no .gitignore e NUNCA deve ser versionado.
 */

return [
    // Credenciais da ZuckPay (painel > Integrações > API keys)
    'client_id'     => getenv('ZUCKPAY_CLIENT_ID')     ?: 'seu_client_id',
    'client_secret' => getenv('ZUCKPAY_CLIENT_SECRET') ?: 'seu_client_secret',

    /**
     * Base da API.
     *
     * ATENÇÃO: as duas fontes da ZuckPay divergem. A documentação completa
     * usa https://www.zuckpay.com.br; a tela de Credenciais API mostra
     * https://zuckpay.com.br (sem www). Com o host errado a API responde um
     * redirecionamento e o POST autenticado não é reenviado — a cobrança
     * nunca chega.
     *
     * Rode o api/diagnostico.php: ele detecta o redirect e testa as duas
     * variantes, dizendo qual funciona na sua conta.
     *
     * Para testes: https://www.zuckpay.com.br/conta/dev/api/pix
     */
    'api_base' => 'https://www.zuckpay.com.br/conta/v3/pix',

    /**
     * Produto vendido na página.
     *
     * O preço fica AQUI, no servidor. O navegador envia apenas o id do plano
     * ("app") e os ids dos adicionais — um valor vindo do cliente é sempre ignorado.
     *
     * product_id: id do produto cadastrado no painel da ZuckPay. É opcional
     * na API (0 = não enviar), mas preenchê-lo vincula a venda ao produto nos relatórios.
     */
    'planos' => [
        'app' => [
            'nome'       => 'Brasil 22 — App completo',
            'valor'      => 12.90,
            'product_id' => 0,
        ],
    ],

    /**
     * Adicionais (order bumps). Os ids precisam ser os mesmos do index.html
     * (value dos checkboxes name="bump"). Id desconhecido é recusado.
     */
    'adicionais' => [
        'figurinhas' => ['nome' => '+30 figurinhas',                'valor' => 5.90],
        'artes_pt'   => ['nome' => 'Artes para quando o PT perder', 'valor' => 5.90],
        'foto_mito'  => ['nome' => 'Foto ao lado do mito',          'valor' => 5.90],
    ],

    // URL pública que a ZuckPay chama quando o pagamento muda de status.
    // Cadastre-a também em Integrações > Webhooks no painel.
    'webhook_url' => 'https://SEU-DOMINIO.com.br/api/webhook.php',

    /**
     * Webhook Secret — gerado no painel em Integrações > Webhook Secret.
     * É DIFERENTE do client_secret.
     *
     * Com ele preenchido, api/webhook.php valida o header
     * X-ZuckPay-Signature e recusa qualquer POST que não venha da ZuckPay.
     * Vazio, os postbacks continuam chegando sem assinatura e a validação
     * fica só por reconsulta à API.
     */
    'webhook_secret' => '',

    // Origens autorizadas a chamar estes endpoints (CORS).
    'allowed_origins' => [
        'https://SEU-DOMINIO.com.br',
        'https://www.SEU-DOMINIO.com.br',
    ],

    // Onde gravar o log de pagamentos confirmados.
    'log_path' => __DIR__ . '/../storage/pagamentos.log',

    /**
     * Modo diagnóstico.
     *
     * Com true, os endpoints devolvem a mensagem de erro real da ZuckPay em
     * vez da mensagem genérica — útil para descobrir por que o PIX não gera.
     * DESLIGUE depois de resolver: mensagens de erro podem revelar detalhes
     * da conta.
     */
    'debug' => false,

    /**
     * Token do api/diagnostico.php. Troque por uma string aleatória.
     * Sem ele o diagnóstico responde 404.
     */
    'debug_token' => '',
];
