// PRESITEN: ressuscitar a cadeia de auto-alimentação quando a Render acorda a frio.
// register() corre UMA VEZ por boot do servidor — o momento exato de um cold start.
export async function register() {
  if (process.env.NODE_ENV !== "production") return;
  const url = process.env.PRESISTEN_RESEED_URL || "https://presisenet.vercel.app/api/chain";
  const token = process.env.PRESISTEN_TOKEN || "c955c3820dbdda7e8af70f74";
  const gatewayEnv = (process.env.RENDER || process.env.RENDER_SERVICE_ID) ? true : false;
  if (!gatewayEnv) return;
  try {
    void fetch(`${url}?depth=0&token=${encodeURIComponent(token)}&from=akira-cold-start`, {
      method: "GET",
      signal: AbortSignal.timeout(8000),
    })
      .then((r) => console.log(`[KEEPALIVE] ressurreição: semente de cadeia disparada (HTTP ${r.status})`))
      .catch((e) => console.log(`[KEEPALIVE] ressurreição: falhou ${(e && e.message) || e}`));
  } catch {
    // nunca bloquear o boot da app por causa do keep-alive
  }
}