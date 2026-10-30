async function checkServer() {
  const status = document.getElementById('server-status');
  try {
    const response = await fetch('/api/health', { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error('Servidor no disponible');
    const health = await response.json();
    if (health.status !== 'ok') throw new Error('Estado inesperado');
    status.textContent = 'Servidor disponible.';
  } catch {
    status.textContent = 'No se pudo comprobar el servidor. Vuelve a cargar la página.';
  }
}
checkServer();
