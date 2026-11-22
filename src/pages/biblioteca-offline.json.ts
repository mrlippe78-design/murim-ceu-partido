import { paginasOrdenadas } from '../lib/biblioteca';

// Lista de todas as páginas da biblioteca, usada pelo service worker para leitura offline.
export async function GET() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const paginas = await paginasOrdenadas();
  const urls = ['/biblioteca/', '/glossario/', '/npcs/', '/bestiario/', ...paginas.map((p) => `/biblioteca/${p.id}/`)].map((u) => base + u);
  return new Response(JSON.stringify(urls), { headers: { 'Content-Type': 'application/json' } });
}
