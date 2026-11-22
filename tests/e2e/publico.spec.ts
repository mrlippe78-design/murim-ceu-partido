// Páginas públicas: convite, biblioteca, busca, ferramentas, prévia de link e 404.
import { test, expect } from '@playwright/test';

test('convite: título, frase e botão Entrar no Jianghu', async ({ page }, info) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Murim');
  await expect(page.getByText('O céu se partiu há trinta e um anos')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Entrar no Jianghu' }).first()).toBeVisible();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `evidencias/convite-${info.project.name}.png` });
});

test('prévia de link: Open Graph e Twitter Card', async ({ page, request }) => {
  await page.goto('./');
  const og = await page.locator('meta[property="og:image"]').getAttribute('content');
  expect(og).toMatch(/\/og\/padrao\.jpg$/);
  expect(await page.locator('meta[name="twitter:card"]').getAttribute('content')).toBe('summary_large_image');
  const r = await request.get(og!);
  expect(r.status()).toBe(200);
  await page.goto('biblioteca/cultivo/gargalo/');
  expect(await page.locator('meta[property="og:image"]').getAttribute('content')).toMatch(/cultivo--gargalo\.jpg$/);
});

test('biblioteca: navegação, sumário e anterior/próximo', async ({ page }, info) => {
  await page.goto('biblioteca/combate/exemplo-de-luta/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Exemplo de luta narrada');
  await expect(page.getByRole('link', { name: /Próxima/ })).toBeVisible();
  await expect(page.locator('a[rel="prev"]')).toBeVisible();
  await page.screenshot({ path: `evidencias/biblioteca-${info.project.name}.png` });
});

test('glossário: termo mostra explicação ao tocar', async ({ page }) => {
  await page.goto('biblioteca/cultivo/gargalo/');
  const termo = page.locator('.prosa .termo').first();
  await termo.click();
  await expect(page.locator('.dica')).toBeVisible();
});

test('busca: "Desvio de Qi" leva à regra', async ({ page }) => {
  await page.goto('buscar/?q=Desvio%20de%20Qi');
  const primeiro = page.locator('.resultados a').first();
  await expect(primeiro).toBeVisible({ timeout: 15000 });
  await expect(page.locator('.resultados a[href*="desvio-de-qi"]')).toHaveCount(1);
});

test('calculadora de técnica avisa quando passa do orçamento', async ({ page }) => {
  await page.goto('ferramentas/tecnica/');
  await page.fill('#nome', 'Corte de Teste');
  await page.fill('#d-forca', '400');
  await page.locator('#d-forca').dispatchEvent('input');
  await expect(page.locator('#erros')).toContainText('Passou do orçamento');
  await page.fill('#d-forca', '300');
  await page.locator('#d-forca').dispatchEvent('input');
  await expect(page.locator('#ok')).toBeVisible();
  await expect(page.locator('#texto')).toContainText('*【Corte de Teste】*');
});

test('calculadora de progresso estima semanas', async ({ page }) => {
  await page.goto('ferramentas/progresso/');
  await page.fill('#pe', '2600');
  await page.locator('#pe').dispatchEvent('input');
  await expect(page.locator('#saida')).toContainText('Segunda Classe');
  await expect(page.locator('#saida')).toContainText('gargalo');
});

test('rolador: 3d6 interpretado e 1d6 de Desvio', async ({ page }) => {
  await page.goto('ferramentas/dados/');
  await page.click('#rolar3');
  await expect(page.locator('#res3')).toContainText(/=\s*\d+/, { timeout: 5000 });
  await page.click('#rolar1');
  await expect(page.locator('#res1')).toContainText(/Dantian|Membro|Mancha|Ferimento|Retrocesso|Avanço/);
});

test('modelos: botão copiar', async ({ page, context }, info) => {
  test.skip(info.project.name === 'celular', 'permissão de área de transferência só no desktop');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('ferramentas/modelos/');
  await page.locator('[data-copiar="treino"]').click();
  const texto = await page.evaluate(() => navigator.clipboard.readText());
  expect(texto).toContain('【 TREINO 】');
});

test('mapa, mural, listas, calendário, NPCs e bestiário abrem', async ({ page }) => {
  for (const p of ['mapa/', 'mural/', 'listas/', 'calendario/', 'npcs/', 'bestiario/', 'como-entrar/', 'creditos/', 'privacidade/', 'tutorial/', 'novidades/']) {
    const r = await page.goto(p);
    expect(r?.status(), p).toBe(200);
  }
  await page.goto('mapa/');
  await page.locator('[data-regiao="oeste"]').click();
  await expect(page.locator('#ficha-regiao')).toContainText('Oeste Vermelho');
});

test('404 temática', async ({ page }) => {
  const r = await page.goto('caminho-que-nao-existe/');
  expect(r?.status()).toBe(404);
  await expect(page.getByText('Você se perdeu no Jianghu')).toBeVisible();
});

test('PWA: manifest e service worker', async ({ request }) => {
  const m = await request.get('manifest.webmanifest');
  expect(m.status()).toBe(200);
  expect((await m.json()).display).toBe('standalone');
  expect((await request.get('sw.js')).status()).toBe(200);
});
