# AKIRA UI

Interface em Next.js para conversar com o Space público `akra35567/Akiragpu`. Inclui histórico no browser, pesquisa na web, análise de imagens e geração de imagens.

## Executar localmente

Requisitos: Node.js 22 e npm.

```powershell
Copy-Item .env.example .env.local
npm ci
npm run dev
```

Abre `http://localhost:3000`. O ID do Space já vem configurado em `.env.example`; `HF_TOKEN` é opcional e só deve ser definido no servidor.

## Endpoints do Space

O proxy usa a API Gradio pública do `akra35567/Akiragpu`:

- `/chat` — resposta de conversa, com o histórico anterior da sessão.
- `/generate_image` — geração de imagem com prompt e estilo.
- `/describe_image` — análise de uma imagem codificada em base64.

As rotas Next `/api/chat` e `/api/image` fazem as chamadas no servidor para não expor o token Hugging Face ao browser. Erros do Space são devolvidos como erros HTTP explícitos, em vez de mensagens com aparência de sucesso.

## Docker e Render

O `Dockerfile` produz uma imagem standalone, multi-stage, com runtime Node.js 22. Para testar localmente:

```powershell
docker build -t akira-ui .
docker run --rm -p 3000:3000 -e HF_SPACE_ID=akra35567/Akiragpu akira-ui
```

No Render, cria um **Web Service** com runtime Docker na pasta `bot_ui`, ou aplica o `render.yaml`. Configura `HF_TOKEN` nos Environment Variables apenas se precisares de autenticação/quota adicional no Space. `NEXT_PUBLIC_SITE_URL` define o domínio absoluto usado nas pré-visualizações de links; atualiza-o se usares um domínio personalizado. O serviço usa o `PORT` que o Render fornece e tem health check em `/api/health`.

O workflow GitHub Actions `Render health ping` chama o endpoint `/api/health` de cinco em cinco minutos, mesmo sem ninguém com o browser aberto. Depois do deploy, define a variável **Actions → Variables** do repositório `RENDER_HEALTH_URL` com o URL HTTPS completo do teu serviço Render terminado em `/api/health` (por exemplo, `https://akira-ui.onrender.com/api/health`). Também podes executar o workflow manualmente em **Actions**. Isto pode reduzir o tempo de suspensão, mas cron do GitHub não é um SLA: a execução pode atrasar ou ser desativada por inatividade do repositório, e manter um serviço Free acordado pode não estar de acordo com os termos/plano atuais do Render. Confirma as regras do teu plano; para disponibilidade garantida, usa um plano pago.

As etiquetas Open Graph e Twitter usam o logótipo da AKIRA para que apps de mensagens e redes sociais mostrem a marca ao partilhares o link. Algumas plataformas guardam as pré-visualizações em cache; depois de publicar, pode ser necessário pedir-lhes para atualizar essa cache.

Esta aplicação não pode ser publicada como site estático: as rotas `/api/chat` e `/api/image` precisam do servidor Next para encaminhar os pedidos à AKIRA sem expor credenciais. As conversas e as imagens ficam no IndexedDB do browser; não são armazenadas no container Render.
