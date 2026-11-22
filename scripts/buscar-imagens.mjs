// Busca imagens de domínio público no Wikimedia Commons e grava os originais em assets-originais/.
// Uso: node scripts/buscar-imagens.mjs  (só precisa rodar de novo se quiser trocar as fontes)
// Para cada espaço, procura o título do arquivo e confere a licença (PD/CC0) nos metadados.
// Já baixados (listados em assets-originais/creditos.json) são pulados.
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';

const UA = 'murim-site-builder/1.0 (projeto academico)';
const alvos = {
  'hero': 'File:Fan Kuan - Travelers Among Mountains and Streams - Google Art Project.jpg',
  'nevoa-montanha': 'File:Guo Xi - Early Spring (large).jpg',
  'rio': 'File:Xia Gui - Pure and Remote Views of Streams and Mountains.jpg',
  'pinheiros': 'Li Tang Wind in Pines Among a Myriad Valleys',
  'caminho': 'File:Ma Yuan - Walking on a Mountain Path in Spring.jpg',
  'mil-li': 'Wang Ximeng Thousand Li of Rivers and Mountains',
  'inwang': 'Jeong Seon Inwangjesaekdo',
  'bambu': 'Wen Tong Ink Bamboo',
  'viagem-shu': "Emperor Minghuang's Journey to Shu",
  'lu-shan': 'Shen Zhou Lofty Mount Lu',
  'neve': 'Fan Kuan Travelers in a Wintry Forest',
  'cavaleiros': 'Hu Gui Hunting Khitan horsemen',
};

const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
async function baixar(url) {
  for (let i = 0; i < 6; i++) {
    const r = await fetch(url, { headers: { 'User-Agent': UA } });
    if (r.status !== 429) return r;
    await pausa(10000 * (i + 1));
  }
  return { ok: false, status: 429 };
}
async function api(params) {
  await pausa(2000);
  const url = 'https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({ format: 'json', origin: '*', ...params });
  const r = await baixar(url);
  return r.json();
}
const info = (titulo) => api({ action: 'query', titles: titulo, prop: 'imageinfo', iiprop: 'url|extmetadata|size', iiurlwidth: '1920' });

async function procurar(titulo) {
  if (titulo.startsWith('File:')) {
    const j = await info(titulo);
    const page = Object.values(j.query.pages)[0];
    if (page.missing === undefined) return page;
    titulo = titulo.replace(/^File:/, '').replace(/\.[a-z]+$/i, '');
  }
  const s = await api({ action: 'query', list: 'search', srsearch: titulo, srnamespace: '6', srlimit: '8' });
  const hit = s.query.search.find((h) => /\.(jpe?g|png|tiff?)$/i.test(h.title));
  if (!hit) return null;
  const j = await info(hit.title);
  return Object.values(j.query.pages)[0];
}

await mkdir('assets-originais', { recursive: true });
const arqCred = 'assets-originais/creditos.json';
const creditos = existsSync(arqCred) ? JSON.parse(readFileSync(arqCred, 'utf8')) : [];
for (const [chave, titulo] of Object.entries(alvos)) {
  if (creditos.some((c) => c.chave === chave)) continue;
  const page = await procurar(titulo);
  if (!page?.imageinfo) { console.log('NAO ACHEI', chave); continue; }
  const ii = page.imageinfo[0];
  const m = ii.extmetadata;
  const licenca = m.LicenseShortName?.value ?? '?';
  if (!/public domain|^pd|cc0/i.test(licenca)) { console.log('LICENCA RECUSADA', chave, licenca); continue; }
  const r = await baixar(ii.thumburl);
  if (!r.ok) { console.log('FALHA DOWNLOAD', chave, r.status); continue; }
  await writeFile(`assets-originais/${chave}.jpg`, Buffer.from(await r.arrayBuffer()));
  creditos.push({
    chave,
    arquivo: page.title,
    autor: (m.Artist?.value ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(),
    licenca,
    fonte: ii.descriptionurl,
  });
  await writeFile(arqCred, JSON.stringify(creditos, null, 2));
  console.log('OK', chave, page.title, licenca);
}
