// Exécuté une fois au démarrage du serveur Next.js (côté Node uniquement)
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startAutoSync } = await import("./lib/autosync");
    startAutoSync();
  }
}
