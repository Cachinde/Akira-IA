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

No Render, cria um **Web Service** com runtime Docker na pasta `bot_ui`, ou aplica o `render.yaml`. Configura `HF_TOKEN` nos Environment Variables apenas se precisares de autenticação/quota adicional no Space. O serviço usa o `PORT` que o Render fornece e tem health check em `/api/health`.

Esta aplicação não pode ser publicada como site estático: as rotas `/api/chat` e `/api/image` precisam do servidor Next para encaminhar os pedidos à AKIRA sem expor credenciais. As conversas e as imagens ficam no IndexedDB do browser; não são armazenadas no container Render.
