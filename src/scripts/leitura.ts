// Leitura do Destino: escolha → confirmação → servidor → ritual (pergaminho, selo, raios, céu escuro).
import { supabase, exigirLogin, jogo, toast, esc, link, nomes, mensagemErro, param, $, $$, ROTULO_RARIDADE } from './app';
import { corpo as infoCorpo, linhagem as infoLinhagem, DADOS } from '../../supabase/functions/_shared/regras';

type Linha = Record<string, any>;
let p: Linha;
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
const reduzir = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const NOME_TIPO: Record<string, string> = { corpo: 'Corpo Marcial', raiz: 'Raiz de Qi', linhagem: 'Linhagem rara' };

async function carregar() {
  const { data } = await supabase.from('personagens').select('*').eq('id', param('id')).single();
  if (!data) { $('#escolhas').innerHTML = '<p class="erro">Personagem não encontrado.</p>'; throw new Error('nf'); }
  p = data;
  $('#nome-alvo').textContent = p.nome;
  $('#qtd').textContent = String(p.leituras);
  $('#fios').textContent = String(p.fios);
  ($('#barra-fios') as HTMLElement).style.width = `${Math.min(100, (p.fios / 40) * 100)}%`;
  ($('#voltar') as HTMLAnchorElement).href = link(p.status === 'aprovada' ? `/personagem/?id=${p.id}` : `/conta/ficha/?id=${p.id}&passo=7`);
  const temSorte = p.leituras === 0 && !p.sorte_usada && p.ficha?.talentos?.vantagens?.includes('sorte_do_ceu');
  const liberada = p.leituras === 0 && p.leitura_liberada_em && new Date(p.leitura_liberada_em) <= new Date();
  const pode = p.vivo && (p.leituras > 0 || temSorte || liberada);
  $$<HTMLButtonElement>('.rolo').forEach((b) => (b.disabled = !pode));
  const aviso = $('#sem-leituras');
  aviso.hidden = pode;
  if (!pode) aviso.textContent = p.leitura_liberada_em
    ? `A Leitura de criação será liberada em ${new Date(p.leitura_liberada_em).toLocaleDateString('pt-BR')} (regra anti-reroll).`
    : 'Este personagem não tem Leituras disponíveis. Novas vêm de avanço de reino, eventos e semanas ativas.';
}

function detalhes(r: Linha): string {
  if (r.tipo === 'corpo') {
    const c = infoCorpo(r.resultado);
    if (!c) return '';
    return `<p><strong>Bônus:</strong> ${esc(c.bonus)}</p><p><strong>Preço:</strong> ${esc(c.desvantagem)}</p>${r.detalhes?.selado ? '<p><em>Selado: funciona com 50% do bônus até o Despertar na Primeira Classe.</em></p>' : ''}`;
  }
  if (r.tipo === 'raiz') {
    const info = (DADOS.raizes as Record<string, { texto: string }>)[r.resultado];
    return `<p>${esc(info?.texto ?? '')}</p>`;
  }
  const l = infoLinhagem(r.resultado);
  return l ? `<p><strong>Benefício:</strong> ${esc(l.texto)}</p><p><strong>Preço:</strong> ${esc(l.desvantagem)}</p>` : '<p>O sangue não guarda nenhum segredo antigo. Você é exatamente quem parece ser.</p>';
}

async function ritual(r: Linha) {
  const altar = $('#altar');
  const perg = $('#pergaminho');
  $('#escolhas').hidden = true;
  $('#sem-leituras').hidden = true;
  perg.hidden = false;
  perg.className = `pergaminho r-${r.tipo === 'corpo' ? r.raridade : r.raridade === 'comum' ? 'comum' : r.raridade === 'variante' || r.raridade === 'rara' ? 'lendario' : 'raro'}`;
  $('#p-tipo').textContent = NOME_TIPO[r.tipo];
  $('#p-raridade').textContent = r.tipo === 'linhagem' && r.raridade === 'comum' ? '' : ROTULO_RARIDADE[r.raridade] ?? r.raridade;
  $('#p-nome').textContent = r.nome;
  $('#p-det').innerHTML = detalhes(r);
  for (const id of ['p-raridade', 'p-nome', 'p-det']) $(`#${id}`).className = `${id} tinta`;
  const audio = await import('./audio');
  const grande = r.tipo === 'corpo' && ['lendario', 'mitico'].includes(r.raridade);

  if (reduzir()) {
    $$('.tinta').forEach((e) => e.classList.add('ver'));
    $('#carimbo').classList.add('bater');
  } else {
    audio.efeito('gongo');
    if (r.raridade === 'mitico' && r.tipo === 'corpo') {
      altar.classList.add('escuro');
      await espera(2200);
      audio.efeito('trovao');
      altar.classList.add('tremer', 'relampago');
      await espera(1600);
    }
    perg.classList.add('abrir');
    await espera(1100);
    if (r.raridade === 'lendario' && r.tipo === 'corpo') {
      audio.efeito('trovao');
      altar.classList.add('relampago');
    }
    for (const id of ['p-raridade', 'p-nome', 'p-det']) { $(`#${id}`).classList.add('ver'); await espera(grande ? 900 : 500); }
    audio.efeito('selo');
    $('#carimbo').classList.add('bater');
  }

  const pos = $('#pos-leitura');
  let html = '';
  if (r.precisa_escolha) {
    html += `<div class="nota" style="text-align:left">Você já tinha um resultado especial neste tipo. Qual manter? (O outro continua no histórico.)
      <div class="linha-flex" style="margin-top:.8rem"><button class="btn" data-novo="1">Manter ${esc(r.nome)}</button><button class="btn fantasma" data-novo="0">Manter o atual</button></div></div>`;
  }
  html += `<p class="mudo">Leituras restantes: <strong>${r.leituras_restantes}</strong>${r.tipo === 'corpo' ? ` · Fios do Destino: <strong>${r.fiosDepois}</strong>/40${r.garantida ? ' (Fio cumprido: Épico garantido)' : ''}` : ''}</p>`;
  if (r.leituras_restantes > 0) html += '<button class="btn fantasma" id="outra">Fazer outra Leitura</button>';
  pos.innerHTML = html;
  pos.querySelectorAll<HTMLButtonElement>('[data-novo]').forEach((b) => b.onclick = async () => {
    const { error } = await supabase.rpc('escolher_leitura', { p_leitura: r.id, p_manter_novo: b.dataset.novo === '1' });
    if (error) return toast(mensagemErro(error), true);
    toast('Escolha registrada.');
    b.closest('.nota')?.remove();
  });
  pos.querySelector('#outra')?.addEventListener('click', async () => {
    perg.hidden = true; pos.innerHTML = ''; $('#escolhas').hidden = false;
    altar.classList.remove('escuro', 'tremer', 'relampago');
    $('#carimbo').classList.remove('bater');
    await carregar();
  });
}

async function ler(tipo: string) {
  const dlg = $('#confirmar') as HTMLDialogElement;
  $('#confirmar-titulo').textContent = `Ler ${NOME_TIPO[tipo]}?`;
  dlg.showModal();
  dlg.onclose = async () => {
    if (dlg.returnValue !== 'sim') return;
    $$<HTMLButtonElement>('.rolo').forEach((b) => (b.disabled = true));
    try {
      const r = await jogo('leitura', { personagem: p.id, tipo });
      await ritual(r);
    } catch (e) {
      toast((e as Error).message, true);
      await carregar();
    }
  };
}

export async function iniciarLeitura() {
  await exigirLogin();
  await carregar();
  $$<HTMLButtonElement>('.rolo').forEach((b) => (b.onclick = () => ler(b.dataset.tipo!)));
  void nomes;
}
