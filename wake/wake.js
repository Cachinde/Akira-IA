(() => {
  const appUrl = document.body.dataset.appUrl;
  const status = document.getElementById("wake-status");
  const retryButton = document.getElementById("retry-button");
  let attempts = 0;
  let runId = 0;

  if (!appUrl || !status || !retryButton) return;

  function destination() {
    const requested = new URLSearchParams(window.location.search).get("next");
    if (requested && requested.startsWith("/") && !requested.startsWith("//") && !requested.includes("\\")) {
      return new URL(requested, appUrl).toString();
    }
    return new URL("/", appUrl).toString();
  }

  function wait(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  async function checkReady(currentRun) {
    while (currentRun === runId) {
      attempts += 1;
      status.textContent = attempts === 1
        ? "A iniciar uma ligação segura…"
        : "A AKIRA está a acordar. Obrigado por aguardares.";

      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 12000);

      try {
        const response = await fetch(`${appUrl}/api/health/ready`, {
          cache: "no-store",
          mode: "cors",
          signal: controller.signal,
        });
        if (response.ok) {
          const health = await response.json();
          if (currentRun === runId && health && health.status === "ready") {
            status.textContent = "Tudo pronto. A abrir a AKIRA…";
            window.location.replace(destination());
            return;
          }
        }
      } catch {
        // A cold-start request can time out or hit Render's temporary boot page; retry.
      } finally {
        window.clearTimeout(timeout);
      }

      if (currentRun !== runId) return;
      await wait(Math.min(2500 + attempts * 1000, 8000));
    }
  }

  retryButton.addEventListener("click", () => {
    attempts = 0;
    runId += 1;
    void checkReady(runId);
  });

  void checkReady(runId);
})();
