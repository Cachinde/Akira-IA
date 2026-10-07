# AKIRA UI

Interface em Next.js para conversar com o Space público `akra35567/AKIRA-SOFTEDGE`, que atende o chat e a geração/análise de imagens. Inclui histórico no browser, pesquisa na web, análise de imagens e geração de imagens.

## Executar localmente

Requisitos: Node.js 22 e npm.

```powershell
Copy-Item .env.example .env.local
npm ci
npm run dev
```

Abre `http://localhost:3000`. O ID do Space já vem configurado em `.env.example`; `HF_TOKEN` é opcional e só deve ser definido no servidor.

## Endpoints do Space

O chat e as imagens ligam-se ao Space Gradio `akra35567/AKIRA-SOFTEDGE`. A URL `https://akra35567-akira-softedge.hf.space/api` não é, na publicação atual, uma API REST JSON; o Space está publicado como Gradio:

- `/_send` (AKIRA-SOFTEDGE) — resposta de conversa, com o histórico anterior da sessão.
- `/generate_image` (AKIRA-SOFTEDGE) — geração de imagem com prompt, estilo e contexto recente da conversa.
- `/describe_image` — análise de uma imagem codificada em base64.

As rotas Next `/api/chat` e `/api/image` fazem as chamadas no servidor para não expor o token Hugging Face ao browser. Por padrão, ambas usam `akra35567/AKIRA-SOFTEDGE`; `AKIRA_CHAT_SPACE_ID` e `HF_SPACE_ID` podem ser configurados explicitamente. Erros do Space são devolvidos como erros HTTP explícitos, em vez de mensagens com aparência de sucesso.

A geração de imagens no Space `akra35567/AKIRA-SOFTEDGE` tenta primeiro FLUX.1-dev através da Hugging Face Inference. Pollinations só é usado quando os tokens HF configurados atingem a quota (HTTP 402/429); erros de configuração, autenticação ou acesso ao modelo são devolvidos em vez de mascarados pelo fallback. Os tokens para inferência devem estar nas Variables and secrets do Space `AKIRA-SOFTEDGE`; o `HF_TOKEN` desta UI serve para a UI aceder ao Space e não substitui os secrets de inferência do backend.

## Docker e Render

O `Dockerfile` produz uma imagem standalone, multi-stage, com runtime Node.js 22. Para testar localmente:

```powershell
docker build -t akira-ui .
docker run --rm -p 3000:3000 -e HF_SPACE_ID=akra35567/AKIRA-SOFTEDGE akira-ui
```

No Render, cria um **Web Service** com runtime Docker na pasta `bot_ui`, ou aplica o `render.yaml`. Configura `HF_TOKEN` nos Environment Variables apenas se precisares de autenticação/quota adicional nos Spaces. As credenciais usadas em runtime configuram-se em **Render Dashboard → serviço → Environment** (e, no caso do SSO, também no serviço Railway da SoftEdge); **não** em GitHub → Settings → Secrets and variables → Actions, que só fornece segredos a workflows. `NEXT_PUBLIC_SITE_URL` define o domínio absoluto usado nas pré-visualizações e links partilhados; o padrão é `https://akira-ia.onrender.com`. O serviço usa o `PORT` que o Render fornece e só fica healthy quando `/api/health/ready` confirma o PostgreSQL e o segredo de sessão. A rota `/api/health` continua disponível como liveness. A geração de links rejeita hosts de bind ou endereços privados como `0.0.0.0:10000` e recorre ao domínio público do Render/configurado.

O Blueprint completo `render.yaml` declara a aplicação e o serviço estático `akira-wake`. Para criar **apenas** a tela estática sem duplicar a aplicação ou voltar a introduzir as variáveis secretas, cria um Blueprint separado e define o **Blueprint Path** como `render-wake.yaml`. O serviço será publicado em `https://akira-wake.onrender.com`; confirma que fica Live e que o URL já não devolve 404. Usa esse endereço como porta de entrada: mostra uma tela própria da AKIRA, consulta `/api/health/ready` enquanto o Web Service gratuito acorda e encaminha para o chat quando estiver pronto. Como a página inicial do Render Free é devolvida pelo proxy do Render antes de o container responder, não é possível substituí-la no próprio domínio `akira-ia.onrender.com`; quem abrir esse domínio diretamente ainda pode ver a tela de arranque do Render. O endereço `akira-wake.onrender.com` evita essa tela no percurso de entrada, mas é um serviço separado. O valor `AKIRA_WAKE_ORIGIN` restringe a permissão CORS do endpoint de readiness ao domínio estático. Partilha o endereço `akira-wake.onrender.com` como entrada para que as pessoas não abram o serviço adormecido diretamente.

## Indexação nos motores de pesquisa

A página inicial e `/plans` têm títulos e descrições próprios, URL canónico, metadados Open Graph/Twitter e dados estruturados `WebSite`, `Organization` e `SoftwareApplication`. `GET /robots.txt` orienta os crawlers e `GET /sitemap.xml` lista as páginas públicas; login, APIs e confirmação de conta não são páginas para indexar, e as respostas partilhadas são marcadas como `noindex`.

Depois de publicar o deploy no domínio final, verifica `https://akira-ia.onrender.com/robots.txt` e `https://akira-ia.onrender.com/sitemap.xml`. Em seguida, adiciona e verifica a propriedade de domínio `akira-ia.onrender.com` no [Google Search Console](https://search.google.com/search-console/about), envia o sitemap `https://akira-ia.onrender.com/sitemap.xml` e usa a inspeção de URL para pedir a indexação da página inicial. A propriedade de domínio requer verificação DNS; o Search Console também oferece verificação por prefixo de URL. A descoberta e a posição dependem do rastreamento do Google, conteúdo útil e sinais externos: nenhum metadado ou pedido de indexação garante uma posição específica ou a primeira página.

## Variáveis de ambiente

Define as variáveis no **Render Dashboard → AKIRA Web Service → Environment**. `render.yaml` já preenche os IDs públicos dos Spaces, os domínios e o nome do remetente. Preenche as restantes conforme as funcionalidades que queres ativar:

| Variável | Valor/instrução | Necessária para |
| --- | --- | --- |
| `AKIRA_CHAT_SPACE_ID` | `akra35567/AKIRA-SOFTEDGE` (predefinido) | Respostas do chat |
| `HF_SPACE_ID` | `akra35567/AKIRA-SOFTEDGE` (predefinido) | Geração e análise de imagens |
| `HF_TOKEN` | Token pessoal Hugging Face; deixa vazio se os Spaces públicos funcionarem sem autenticação | Opcional; acesso/quota dos Spaces |
| `NEXT_PUBLIC_SITE_URL` | `https://akira-ia.onrender.com` | URLs públicos, pré-visualizações e partilhas |
| `DATABASE_URL` | URL **PostgreSQL** da base criada no Render; prefere a ligação interna | Contas, limites, sessão, links e assinaturas |
| `BILLING_COOKIE_SECRET` | Segredo aleatório, mínimo 32 caracteres; mantém privado | Sessões, OAuth e assinatura do cookie |
| `SMTP_HOST` | Servidor SMTP, por exemplo `smtp.gmail.com` | Envio de links de acesso por e-mail |
| `SMTP_PORT` | Porta SMTP, por exemplo `587` | Envio de links de acesso por e-mail |
| `SMTP_USERNAME` | Utilizador SMTP | Envio de links de acesso por e-mail |
| `SMTP_PASSWORD` | Palavra-passe/app password SMTP | Envio de links de acesso por e-mail |
| `SMTP_ENCRYPTION` | `tls` para STARTTLS na porta 587 ou `ssl` para TLS implícito | Envio de links de acesso por e-mail |
| `SMTP_FROM_EMAIL` | Endereço autorizado pelo fornecedor SMTP | Remetente dos links |
| `SMTP_FROM_NAME` | Opcional; `AKIRA — SoftEdge Corporation` se omitido | Nome apresentado no remetente |
| `GOOGLE_CLIENT_ID` | OAuth Client ID Web do Google | Entrada AKIRA com Google |
| `GOOGLE_CLIENT_SECRET` | Segredo do mesmo OAuth Client | Entrada AKIRA com Google |
| `AKIRA_SSO_SECRET` | Segredo aleatório com pelo menos 32 bytes; **o mesmo valor** no Render e no Railway | Entrada com conta SoftEdge |
| `SOFTEDGE_SSO_URL` | `https://softedge-corporation.up.railway.app` | Destino do SSO SoftEdge |
| `STRIPE_SECRET_KEY` | Chave secreta Stripe `sk_test_...` ou `sk_live_...` | Checkout e Customer Portal |
| `STRIPE_WEBHOOK_SECRET` | Segredo `whsec_...` do endpoint AKIRA no mesmo modo Stripe | Atualização de assinaturas |
| `STRIPE_PRICE_PRO` | Price ID recorrente USD 5/mês | Plano Pro |
| `STRIPE_PRICE_ULTRA` | Price ID recorrente USD 12/mês | Plano Ultra |

Para ativar o início de sessão Google na **SoftEdge**, configura também as variáveis no **Railway → serviço Next.js da SoftEdge → Variables**: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXT_PUBLIC_SITE_URL=https://softedge-corporation.up.railway.app`, `AKIRA_PUBLIC_URL=https://akira-ia.onrender.com` e `AKIRA_SSO_SECRET` com o mesmo valor definido no Render. Regista no Google Cloud Console os callbacks de ambos os serviços: `https://akira-ia.onrender.com/api/auth/google/callback` e `https://softedge-corporation.up.railway.app/api/auth/google/callback`.

`PORT`, `NODE_ENV` e `RENDER_EXTERNAL_URL` são fornecidos/geridos pela plataforma; não precisas de os criar manualmente. Não uses `DATABASE_URL` MySQL da SoftEdge na AKIRA: a base exigida pela AKIRA é PostgreSQL. As variáveis de **GitHub Actions Secrets** não são enviadas automaticamente para Render ou Railway. Nunca coloques chaves privadas em variáveis `NEXT_PUBLIC_*`, no código ou no repositório.

## Assinaturas, limites e ficheiros

A primeira visita pede apenas um nome de tratamento; esse nome personaliza a saudação e fica associado ao perfil. Sem conta, a pessoa pode enviar dez mensagens no total. Depois, é necessário confirmar um e-mail através de um link de acesso sem senha, com validade de 15 minutos. A conta confirmada tem o limite Gratuito de 20 mensagens e 3 ficheiros por dia. O envio de links é limitado por e-mail (1 por minuto e 5 por hora). O histórico de conversas continua apenas no armazenamento local desse navegador; a conta não sincroniza o histórico entre dispositivos.

A página `/plans` apresenta três planos pagos em USD: Gratuito (10 mensagens de teste sem conta; depois de criar conta, 20 mensagens e 3 ficheiros/dia), Pro ($5/mês; 1.000 mensagens e 100 ficheiros/mês) e Ultra ($12/mês; 5.000 mensagens e 500 ficheiros/mês). As quotas são aplicadas no servidor com contadores atómicos PostgreSQL. O plano Gratuito também precisa do PostgreSQL para manter as quotas. O login suporta Google, conta SoftEdge (SSO entre os dois servidores, sem partilha de palavras-passe) e link de acesso por e-mail.

Para ativar os métodos de entrada:

1. No Google Cloud Console, cria um OAuth Client do tipo Web e regista `https://akira-ia.onrender.com/api/auth/google/callback` como URI de redirecionamento autorizado. Define `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` no serviço AKIRA do Render.
2. Cria um segredo aleatório com pelo menos 32 caracteres e define o mesmo valor em `AKIRA_SSO_SECRET` no Render (AKIRA) e no Railway (serviço Next.js da SoftEdge). No Railway, define também `AKIRA_PUBLIC_URL=https://akira-ia.onrender.com`. O SSO usa um ticket assinado, de uso único e válido por 60 segundos; a palavra-passe SoftEdge nunca é transmitida à AKIRA.
3. O URL público do serviço da SoftEdge tem de ser `https://softedge-corporation.up.railway.app`. Se mudares o domínio, atualiza `SOFTEDGE_SSO_URL` no Render e o emissor SSO no código da SoftEdge.

Na página `/login`, os erros de configuração do servidor não são expostos a quem usa a aplicação; ficam registados nos logs do serviço para diagnóstico. `GET /api/health` é apenas liveness. `GET /api/health/ready` verifica o PostgreSQL e devolve apenas se o serviço está pronto, sem revelar nomes de variáveis ou detalhes da base.

Para ativar faturação:

1. Cria uma instância PostgreSQL no Render e define `DATABASE_URL` no Web Service com a connection string **interna** dessa base de dados. O schema AKIRA é criado automaticamente.
2. No Stripe, cria dois preços recorrentes ativos: **USD 5 por mês** e **USD 12 por mês**. Copia o **Price ID** (`price_...`, não o Product ID `prod_...`) para `STRIPE_PRICE_PRO` e `STRIPE_PRICE_ULTRA`. O preço tem de estar ativo, ser mensal, em USD, e pertencer ao mesmo modo (teste ou live) da `STRIPE_SECRET_KEY`.
3. Define `STRIPE_SECRET_KEY` e `BILLING_COOKIE_SECRET` nos Environment Variables do Render. Gera um segredo aleatório com pelo menos 32 caracteres; não o coloques no código ou no browser.
4. Regista no Stripe o webhook `https://akira-ia.onrender.com/api/billing/webhook` e subscreve `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.created`, `customer.subscription.updated` e `customer.subscription.deleted`. Define o signing secret fornecido pelo Stripe em `STRIPE_WEBHOOK_SECRET`.
5. Ativa o Customer Portal no Stripe para permitir que os clientes gerem/cancelem as assinaturas.

Checkout, portal e webhook usam HTTPS e a assinatura oficial Stripe; eventos são idempotentes e atualizações fora de ordem não substituem estados mais recentes. Após voltar do checkout, a página consulta automaticamente o estado da assinatura enquanto o webhook é processado. As quotas, contas e partilhas de respostas (90 dias) necessitam de PostgreSQL. A sessão usa um cookie seguro e assinado; as contas confirmadas podem ser recuperadas noutro dispositivo pedindo um novo link por e-mail.

Usa todas as chaves, Price IDs e o segredo de webhook do **mesmo modo Stripe**. Para testar, usa `sk_test_...`, Price IDs criados no modo de teste e um webhook de teste com o respetivo `whsec_...`; em produção, troca todos para os valores live (`sk_live_...`, preços live e `whsec_...` live). No Render, confirma em **Environment → Environment Variables** que `STRIPE_SECRET_KEY`, `STRIPE_PRICE_PRO` e `STRIPE_PRICE_ULTRA` pertencem ao mesmo modo e que os dois últimos começam por `price_`. Depois de alterar variáveis, guarda e faz redeploy do serviço AKIRA. Ativa também o Customer Portal no Stripe. Os logs do Render registam o motivo técnico quando o Stripe rejeita um Price ID ou quando os atributos do preço não correspondem ao plano, sem registar a chave secreta.

O envio dos links de acesso usa SMTP. Configura no serviço Web do Render as variáveis `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_ENCRYPTION`, `SMTP_FROM_EMAIL` e, opcionalmente, `SMTP_FROM_NAME`. Para reutilizar o serviço de e-mail documentado na pasta da SoftEdge, copia **os valores SMTP** dessa configuração para o Web Service AKIRA no Render. As variáveis de Railway não são partilhadas automaticamente com Render; não copies a `DATABASE_URL` MySQL da SoftEdge, pois a AKIRA exige PostgreSQL.

Anexos de imagem continuam a usar o Space AKIRAGPU. Também é possível enviar TXT, Markdown, CSV, JSON, PDF (até 30 páginas) e DOCX; os documentos são extraídos no servidor e enviados como contexto para o Space de conversa, com limite de 8 MB por ficheiro e 50.000 caracteres extraídos. A geração/análise de imagens também consome a quota de mensagens/ficheiros correspondente. Os ficheiros e conversas não são persistidos no servidor. Os links de partilha são públicos para quem os tiver e expiram após 90 dias.

O `render.yaml` continua no plano Free, que pode suspender o Web Service após inatividade. Nesse plano, não há uma forma gratuita e fiável de garantir que o serviço nunca adormece. O site estático `akira-wake` oferece uma tela de entrada com a marca durante o cold start, mas não impede a suspensão nem substitui a resposta do proxy quando alguém abre diretamente o domínio do Web Service. O workflow `Render health check` é manual e serve apenas para diagnóstico; não faz keep-alive. A aplicação mantém `/api/health` para liveness e `/api/health/ready` para verificar o PostgreSQL.

As etiquetas Open Graph e Twitter usam `public/akira-share-v2.png`, uma imagem de partilha 1200 × 630 com contraste reforçado e URL versionado para evitar o cache anterior do logo. A URL de partilha também inclui a versão da pré-visualização. Depois do deploy, partilha `https://akira-ia.onrender.com/?share=akira-v2`; algumas plataformas ainda podem exigir uma atualização no seu depurador de partilhas.

Esta aplicação não pode ser publicada como site estático: as rotas `/api/chat` e `/api/image` precisam do servidor Next para encaminhar os pedidos à AKIRA sem expor credenciais. As conversas e as imagens ficam no IndexedDB do browser; não são armazenadas no container Render.
