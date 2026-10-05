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

No Render, cria um **Web Service** com runtime Docker na pasta `bot_ui`, ou aplica o `render.yaml`. Configura `HF_TOKEN` nos Environment Variables apenas se precisares de autenticação/quota adicional nos Spaces. `NEXT_PUBLIC_SITE_URL` define o domínio absoluto usado nas pré-visualizações de links; o padrão é `https://akira-ia.onrender.com`. O serviço usa o `PORT` que o Render fornece e tem health check em `/api/health`.

O workflow GitHub Actions `Render health ping` chama o endpoint `/api/health` de cinco em cinco minutos, mesmo sem ninguém com o browser aberto. Depois do deploy, define a variável **Actions → Variables** do repositório `RENDER_HEALTH_URL` com o URL HTTPS completo do teu serviço Render terminado em `/api/health` (por exemplo, `https://akira-ia.onrender.com/api/health`). Também podes executar o workflow manualmente em **Actions**. Isto pode reduzir o tempo de suspensão, mas cron do GitHub não é um SLA: a execução pode atrasar ou ser desativada por inatividade do repositório, e manter um serviço Free acordado pode não estar de acordo com os termos/plano atuais do Render. Confirma as regras do teu plano; para disponibilidade garantida, usa um plano pago.

As etiquetas Open Graph e Twitter usam `public/akira-share-v2.png`, uma imagem de partilha 1200 × 630 com contraste reforçado e URL versionado para evitar o cache anterior do logo. A URL de partilha também inclui a versão da pré-visualização. Depois do deploy, partilha `https://akira-ia.onrender.com/?share=akira-v2`; algumas plataformas ainda podem exigir uma atualização no seu depurador de partilhas.

Esta aplicação não pode ser publicada como site estático: as rotas `/api/chat` e `/api/image` precisam do servidor Next para encaminhar os pedidos à AKIRA sem expor credenciais. As conversas e as imagens ficam no IndexedDB do browser; não são armazenadas no container Render.
