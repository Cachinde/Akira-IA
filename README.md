# AKIRA UI

Interface em Next.js para conversar com os Spaces públicos AKIRA. Usa `akra35567/AKIRA-SOFTEDGE` para respostas de chat e `akra35567/Akiragpu` para geração e análise de imagens. Inclui histórico no browser, pesquisa na web, análise de imagens e geração de imagens.

## Executar localmente

Requisitos: Node.js 22 e npm.

```powershell
Copy-Item .env.example .env.local
npm ci
npm run dev
```

Abre `http://localhost:3000`. O ID do Space já vem configurado em `.env.example`; `HF_TOKEN` é opcional e só deve ser definido no servidor.

## Endpoints do Space

O chat liga-se ao Space Gradio `akra35567/AKIRA-SOFTEDGE`, usando a função publicada `/_send` e o histórico no formato Chatbot do Gradio. A URL `https://akra35567-akira-softedge.hf.space/api` não é, na publicação atual, uma API REST JSON; o Space está publicado como Gradio. As imagens continuam a usar o Space `akra35567/Akiragpu`:

- `/_send` (AKIRA-SOFTEDGE) — resposta de conversa, com o histórico anterior da sessão.
- `/generate_image` — geração de imagem com prompt e estilo.
- `/describe_image` — análise de uma imagem codificada em base64.

As rotas Next `/api/chat` e `/api/image` fazem as chamadas no servidor para não expor o token Hugging Face ao browser. Define `AKIRA_CHAT_SPACE_ID` para o Space de chat e `HF_SPACE_ID` para o Space de imagens. Erros do Space são devolvidos como erros HTTP explícitos, em vez de mensagens com aparência de sucesso.

## Docker e Render

O `Dockerfile` produz uma imagem standalone, multi-stage, com runtime Node.js 22. Para testar localmente:

```powershell
docker build -t akira-ui .
docker run --rm -p 3000:3000 -e HF_SPACE_ID=akra35567/Akiragpu akira-ui
```

No Render, cria um **Web Service** com runtime Docker na pasta `bot_ui`, ou aplica o `render.yaml`. Configura `HF_TOKEN` nos Environment Variables apenas se precisares de autenticação/quota adicional nos Spaces. As credenciais usadas em runtime configuram-se em **Render Dashboard → serviço → Environment** (e, no caso do SSO, também no serviço Railway da SoftEdge); **não** em GitHub → Settings → Secrets and variables → Actions, que só fornece segredos a workflows. `NEXT_PUBLIC_SITE_URL` define o domínio absoluto usado nas pré-visualizações e links partilhados; o padrão é `https://akira-ia.onrender.com`. O serviço usa o `PORT` que o Render fornece e só fica healthy quando `/api/health/ready` confirma o PostgreSQL e o segredo de sessão. A rota `/api/health` continua disponível como liveness. A geração de links rejeita hosts de bind ou endereços privados como `0.0.0.0:10000` e recorre ao domínio público do Render/configurado.

## Assinaturas, limites e ficheiros

A primeira visita pede apenas um nome de tratamento; esse nome personaliza a saudação e fica associado ao perfil. Sem conta, a pessoa pode enviar cinco mensagens no total. Depois, é necessário confirmar um e-mail através de um link de acesso sem senha, com validade de 15 minutos. A conta confirmada tem o limite Gratuito de 20 mensagens e 3 ficheiros por dia. O envio de links é limitado por e-mail (1 por minuto e 5 por hora). O histórico de conversas continua apenas no armazenamento local desse navegador; a conta não sincroniza o histórico entre dispositivos.

A página `/plans` apresenta três planos pagos em USD: Gratuito (5 mensagens de teste sem conta; depois de criar conta, 20 mensagens e 3 ficheiros/dia), Pro ($5/mês; 1.000 mensagens e 100 ficheiros/mês) e Ultra ($12/mês; 5.000 mensagens e 500 ficheiros/mês). As quotas são aplicadas no servidor com contadores atómicos PostgreSQL. O plano Gratuito também precisa do PostgreSQL para manter as quotas. O login suporta Google, conta SoftEdge (SSO entre os dois servidores, sem partilha de palavras-passe) e link de acesso por e-mail.

Para ativar os métodos de entrada:

1. No Google Cloud Console, cria um OAuth Client do tipo Web e regista `https://akira-ia.onrender.com/api/auth/google/callback` como URI de redirecionamento autorizado. Define `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` no serviço AKIRA do Render.
2. Cria um segredo aleatório com pelo menos 32 caracteres e define o mesmo valor em `AKIRA_SSO_SECRET` no Render (AKIRA) e no Railway (serviço Next.js da SoftEdge). No Railway, define também `AKIRA_PUBLIC_URL=https://akira-ia.onrender.com`. O SSO usa um ticket assinado, de uso único e válido por 60 segundos; a palavra-passe SoftEdge nunca é transmitida à AKIRA.
3. O URL público do serviço da SoftEdge tem de ser `https://softedge-corporation.up.railway.app`. Se mudares o domínio, atualiza `SOFTEDGE_SSO_URL` no Render e o emissor SSO no código da SoftEdge.

Na página `/login`, os erros de configuração do servidor não são expostos a quem usa a aplicação; ficam registados nos logs do serviço para diagnóstico. `GET /api/health` é apenas liveness. `GET /api/health/ready` verifica o PostgreSQL e devolve apenas se o serviço está pronto, sem revelar nomes de variáveis ou detalhes da base.

Para ativar faturação:

1. Cria uma instância PostgreSQL no Render e define `DATABASE_URL` no Web Service com a connection string **interna** dessa base de dados. O schema AKIRA é criado automaticamente.
2. No Stripe, cria dois preços recorrentes ativos: **USD 5 por mês** e **USD 12 por mês**. Coloca os Price IDs em `STRIPE_PRICE_PRO` e `STRIPE_PRICE_ULTRA`; o servidor valida moeda, valor e periodicidade antes de iniciar o checkout.
3. Define `STRIPE_SECRET_KEY` e `BILLING_COOKIE_SECRET` nos Environment Variables do Render. Gera um segredo aleatório com pelo menos 32 caracteres; não o coloques no código ou no browser.
4. Regista no Stripe o webhook `https://akira-ia.onrender.com/api/billing/webhook` e subscreve `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.created`, `customer.subscription.updated` e `customer.subscription.deleted`. Define o signing secret fornecido pelo Stripe em `STRIPE_WEBHOOK_SECRET`.
5. Ativa o Customer Portal no Stripe para permitir que os clientes gerem/cancelem as assinaturas.

Checkout, portal e webhook usam HTTPS e a assinatura oficial Stripe; eventos são idempotentes e atualizações fora de ordem não substituem estados mais recentes. Após voltar do checkout, a página consulta automaticamente o estado da assinatura enquanto o webhook é processado. As quotas, contas e partilhas de respostas (90 dias) necessitam de PostgreSQL. A sessão usa um cookie seguro e assinado; as contas confirmadas podem ser recuperadas noutro dispositivo pedindo um novo link por e-mail.

Usa todas as chaves, Price IDs e o segredo de webhook do **mesmo modo Stripe**. Para testar, usa `sk_test_...`, Prices criados no modo de teste e um webhook de teste com o respetivo `whsec_...`; em produção, troca todos para os valores live. Ativa também o Customer Portal no Stripe. Sem estas credenciais externas não é possível iniciar nem verificar pagamentos; a interface mostra uma mensagem de indisponibilidade sem expor erros internos.

O envio dos links de acesso usa SMTP. Configura no serviço Web do Render as variáveis `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_ENCRYPTION`, `SMTP_FROM_EMAIL` e, opcionalmente, `SMTP_FROM_NAME`. Para reutilizar o serviço de e-mail documentado na pasta da SoftEdge, copia **os valores SMTP** dessa configuração para o Web Service AKIRA no Render. As variáveis de Railway não são partilhadas automaticamente com Render; não copies a `DATABASE_URL` MySQL da SoftEdge, pois a AKIRA exige PostgreSQL.

Anexos de imagem continuam a usar o Space AKIRAGPU. Também é possível enviar TXT, Markdown, CSV, JSON, PDF (até 30 páginas) e DOCX; os documentos são extraídos no servidor e enviados como contexto para o Space de conversa, com limite de 8 MB por ficheiro e 50.000 caracteres extraídos. A geração/análise de imagens também consome a quota de mensagens/ficheiros correspondente. Os ficheiros e conversas não são persistidos no servidor. Os links de partilha são públicos para quem os tiver e expiram após 90 dias.

O ping JavaScript no browser foi removido; não é uma estratégia de disponibilidade e só corria com a página aberta. O workflow `Render health check` é manual e serve apenas para diagnóstico: cron do GitHub não garante uptime nem impede de forma fiável a suspensão. O `render.yaml` ainda seleciona o plano Free, que pode suspender o serviço após inatividade. Para evitar cold starts de forma fiável em produção, muda o Web Service para um plano Render pago que não suspenda; isso tem custo recorrente e deve ser ativado no Dashboard/Blueprint após aprovação. A aplicação mantém `/api/health` para liveness e `/api/health/ready` para verificar o PostgreSQL.

As etiquetas Open Graph e Twitter usam `public/akira-share-v2.png`, uma imagem de partilha 1200 × 630 com contraste reforçado e URL versionado para evitar o cache anterior do logo. A URL de partilha também inclui a versão da pré-visualização. Depois do deploy, partilha `https://akira-ia.onrender.com/?share=akira-v2`; algumas plataformas ainda podem exigir uma atualização no seu depurador de partilhas.

Esta aplicação não pode ser publicada como site estático: as rotas `/api/chat` e `/api/image` precisam do servidor Next para encaminhar os pedidos à AKIRA sem expor credenciais. As conversas e as imagens ficam no IndexedDB do browser; não são armazenadas no container Render.
