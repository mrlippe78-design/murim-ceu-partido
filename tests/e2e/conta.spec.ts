// Fluxo do jogador: cadastro → tutorial/quiz → ficha → Leitura do Destino → envio.
// Usa uma conta de teste nova a cada execução (e-mail fictício; a confirmação por e-mail está desligada).
import { test, expect, type Page } from '@playwright/test';

test.describe.configure({ mode: 'serial' });
test.beforeEach(({}, info) => test.skip(info.project.name !== 'computador', 'fluxo com conta roda uma vez, no desktop'));

const sufixo = Date.now().toString(36);
const email = `jogador.${sufixo}@teste.murim.dev`;
const senha = `Teste-${sufixo}-Qi!`;
let personagemId = '';

async function entrar(page: Page) {
  await page.goto('conta/');
  await page.getByRole('tab', { name: 'Entrar' }).click();
  await page.fill('#e-email', email);
  await page.fill('#e-senha', senha);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.locator('#logado')).toBeVisible();
}

test('cadastro com e-mail e nome de exibição', async ({ page }) => {
  await page.goto('conta/?criar=1');
  await page.fill('#c-nome', 'Jogador de Teste');
  await page.fill('#c-email', email);
  await page.fill('#c-senha', senha);
  await page.check('#c-aceite');
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page.locator('#logado')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('#aviso-quiz')).toBeVisible();
  await expect(page.locator('#form-novo')).toBeHidden();
});

test('quiz libera a criação de ficha', async ({ page }) => {
  await entrar(page);
  await page.goto('tutorial/');
  for (const [q, v] of Object.entries({ q1: 'b', q2: 'c', q3: 'a', q4: 'c', q5: 'b', q6: 'a' })) await page.check(`input[name="${q}"][value="${v}"]`);
  await page.getByRole('button', { name: 'Conferir respostas' }).click();
  await expect(page.locator('#resultado')).toContainText('6 de 6');
});

test('criador de ficha com rascunho automático e validação', async ({ page }) => {
  await entrar(page);
  await page.fill('#novo-nome', 'Yun Seo-ah');
  await page.getByRole('button', { name: 'Começar ficha' }).click();
  await page.waitForURL(/conta\/ficha\/\?id=/);
  personagemId = new URL(page.url()).searchParams.get('id')!;
  // 1 linhagem
  await page.locator('input[name="linhagem"][value="humano_planicies"]').check();
  await page.click('#proximo');
  // 2 origem
  await page.locator('input[name="origem"][value="discipulo"]').check();
  await page.click('#proximo');
  // 3 facção e seita
  await page.locator('input[name="faccao"][value="alianca"]').check();
  await page.locator('input[name="seita"][value="montanha_celeste"]').check();
  await page.click('#proximo');
  // 4 talentos
  await page.locator('input[name="vantagem"][value="coracao_calmo"]').check();
  await page.locator('input[name="desvantagem"][value="arrogante"]').check();
  await page.click('#proximo');
  // 5 atributos (5.000)
  const at = { forca: 900, agilidade: 1300, resistencia: 900, precisao: 1200, vigor: 700 };
  for (const [k, v] of Object.entries(at)) { await page.fill(`#a-${k}`, String(v)); await page.locator(`#a-${k}`).dispatchEvent('change'); }
  await expect(page.locator('.contador')).toContainText('Restam0');
  // máximo 1.600: tentar 1.700 gera erro no resumo
  await page.fill('#a-forca', '1700'); await page.locator('#a-forca').dispatchEvent('change');
  await expect(page.locator('#erros-lateral')).toContainText('Força no máximo 1600');
  await page.fill('#a-forca', '900'); await page.locator('#a-forca').dispatchEvent('change');
  await page.click('#proximo');
  // 6 artes
  await page.fill('#ai-nome', 'Sutra da Nuvem Parada');
  await page.selectOption('#ai-nat', 'yang');
  await page.fill('#ai-pas', '+10% de recuperação em meditação');
  const tecs = [['Corte da Primeira Chuva', 'precisao', '300'], ['Passo do Bambu Torto', 'agilidade', '300'], ['Guarda da Pedra Fria', 'resistencia', '300']];
  for (const [i, [nome, attr, v]] of tecs.entries()) {
    await page.fill(`#t${i}-nome`, nome);
    await page.fill(`#t${i}-${attr}`, v);
    await page.locator(`#t${i}-${attr}`).dispatchEvent('change');
  }
  await page.fill('#arma', 'Espada de ferro do pai');
  await page.click('#proximo');
  // 7 destino
  await expect(page.locator('#palco')).toContainText('Leituras disponíveis');
  await page.click('#proximo');
  // 8 ficha final
  await page.fill('#f-idade', '19');
  await page.fill('#f-hist', 'Filha de um lenhador do Norte, subiu os mil degraus do Pico da Garça aos doze anos.\nJurou encontrar quem matou o mestre que a acolheu.');
  await expect(page.locator('#salvo')).toContainText(/salvo às/i, { timeout: 10000 });
  // rascunho persiste após recarregar
  await page.reload();
  await expect(page.locator('#palco h2')).toBeVisible();
  await page.locator('.passos button[data-passo="4"]').click();
  await expect(page.locator('#a-agilidade')).toHaveValue('1300');
});

test('Leitura do Destino: sorteio no servidor, registro e ritual', async ({ page }) => {
  await entrar(page);
  await page.goto(`conta/leitura/?id=${personagemId}`);
  await expect(page.locator('#qtd')).toHaveText('1');
  await page.locator('.rolo[data-tipo="corpo"]').click();
  await page.locator('#confirmar button[value="sim"]').click();
  await expect(page.locator('#p-nome')).not.toBeEmpty({ timeout: 20000 });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: 'evidencias/leitura-do-destino.png', fullPage: false });
  // não pode ler de novo sem Leituras
  await page.goto(`conta/leitura/?id=${personagemId}`);
  await expect(page.locator('#qtd')).toHaveText('0');
  await expect(page.locator('.rolo[data-tipo="corpo"]')).toBeDisabled();
});

test('envio da ficha para aprovação', async ({ page }) => {
  await entrar(page);
  await page.goto(`conta/ficha/?id=${personagemId}&passo=8`);
  const erros = page.locator('#palco .lista-erros');
  if (await erros.count()) {
    // se a Leitura trouxe um corpo raro, o ponto extra do Corpo Mortal some: ajusta os talentos
    const texto = await erros.innerText();
    test.info().annotations.push({ type: 'pendencias', description: texto });
  }
  await page.getByRole('button', { name: 'Copiar para o WhatsApp' }).isVisible();
  await page.getByRole('button', { name: 'Enviar para aprovação' }).click();
  await page.waitForURL(/conta\/$/, { timeout: 15000 });
  await expect(page.locator('.lista-personagens')).toContainText('Aguardando aprovação');
});

test('painel da administração é negado a jogador', async ({ page }) => {
  await entrar(page);
  await page.goto('admin/');
  await expect(page.locator('#aviso-admin')).toContainText('só da administração');
});
