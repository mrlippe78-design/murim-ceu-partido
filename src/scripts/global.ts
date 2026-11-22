// Comportamentos presentes em todas as páginas. Mantido pequeno: o resto é carregado sob demanda.
import glossario from '../data/glossario.json';

export function toast(msg: string, erro = false) {
  const area = document.getElementById('toasts');
  if (!area) return;
  const t = document.createElement('div');
  t.className = 'toast' + (erro ? ' erro' : '');
  t.setAttribute('role', erro ? 'alert' : 'status');
  t.textContent = msg;
  area.append(t);
  setTimeout(() => t.remove(), erro ? 6000 : 3200);
}

export async function copiar(texto: string, aviso = 'Copiado. Cole no WhatsApp.') {
  try {
    await navigator.clipboard.writeText(texto);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = texto;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.append(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  toast(aviso);
}

function menu() {
  const botao = document.querySelector<HTMLButtonElement>('.botao-menu');
  const painel = document.getElementById('menu-movel');
  if (!botao || !painel) return;
  const fechar = () => { painel.hidden = true; botao.setAttribute('aria-expanded', 'false'); botao.setAttribute('aria-label', 'Abrir menu'); document.body.style.overflow = ''; };
  botao.addEventListener('click', () => {
    const abrir = painel.hidden;
    painel.hidden = !abrir;
    botao.setAttribute('aria-expanded', String(abrir));
    botao.setAttribute('aria-label', abrir ? 'Fechar menu' : 'Abrir menu');
    document.body.style.overflow = abrir ? 'hidden' : '';
    if (abrir) painel.querySelector('a')?.focus();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !painel.hidden) { fechar(); botao.focus(); } });
}

function dicas() {
  const mapa = new Map(glossario.map((g) => [g.termo, g.def]));
  let aberta: HTMLElement | null = null;
  const fechar = () => { aberta?.remove(); aberta = null; };
  const abrir = (el: HTMLElement) => {
    fechar();
    const termo = el.dataset.termo!;
    const d = document.createElement('div');
    d.className = 'dica';
    d.setAttribute('role', 'tooltip');
    d.innerHTML = `<strong></strong><span></span>`;
    d.querySelector('strong')!.textContent = termo;
    d.querySelector('span')!.textContent = mapa.get(termo) ?? '';
    document.body.append(d);
    const r = el.getBoundingClientRect();
    const larg = d.offsetWidth;
    const esq = Math.min(Math.max(8, r.left + window.scrollX), window.scrollX + document.documentElement.clientWidth - larg - 8);
    d.style.left = `${esq}px`;
    d.style.top = `${r.bottom + window.scrollY + 8}px`;
    aberta = d;
  };
  document.addEventListener('click', (e) => {
    const alvo = (e.target as HTMLElement).closest<HTMLElement>('.termo');
    if (alvo) { e.preventDefault(); if (aberta && aberta.querySelector('strong')?.textContent === alvo.dataset.termo) fechar(); else abrir(alvo); }
    else if (!(e.target as HTMLElement).closest('.dica')) fechar();
  });
  document.addEventListener('keydown', (e) => {
    const alvo = (e.target as HTMLElement).closest?.<HTMLElement>('.termo');
    if (alvo && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); abrir(alvo); }
    if (e.key === 'Escape') fechar();
  });
}

function faixaNovidade() {
  const faixa = document.getElementById('faixa-novidade');
  if (!faixa) return;
  const id = faixa.dataset.id!;
  const visto = localStorage.getItem('novidade-vista');
  if (visto === id) return;
  if (!visto) { localStorage.setItem('novidade-vista', id); return; } // primeira visita: nada é "novo" ainda
  faixa.hidden = false;
  const marcar = () => { localStorage.setItem('novidade-vista', id); faixa.hidden = true; };
  faixa.querySelector('.fechar-faixa')?.addEventListener('click', marcar);
  faixa.querySelector('a')?.addEventListener('click', marcar);
}

function linkConta() {
  const a = document.getElementById('link-conta');
  if (!a) return;
  const logado = Object.keys(localStorage).some((k) => /^sb-.*-auth-token$/.test(k));
  if (logado) a.textContent = 'Minha conta';
}

function som() {
  const b = document.getElementById('botao-som');
  if (!b) return;
  const ligado = () => localStorage.getItem('som') === '1';
  const atualizar = () => { b.textContent = `Som ambiente: ${ligado() ? 'ligado' : 'desligado'}`; b.setAttribute('aria-pressed', String(ligado())); };
  atualizar();
  b.addEventListener('click', async () => {
    localStorage.setItem('som', ligado() ? '0' : '1');
    atualizar();
    const audio = await import('./audio');
    if (ligado()) audio.ligarAmbiente(); else audio.desligarAmbiente();
  });
  if (ligado()) {
    // navegadores só tocam após um gesto: liga no primeiro toque
    const uma = async () => { (await import('./audio')).ligarAmbiente(); };
    window.addEventListener('pointerdown', uma, { once: true });
  }
}

function serviceWorker() {
  if (!('serviceWorker' in navigator) || location.hostname === 'localhost') return;
  const base = document.body.dataset.base ?? '/';
  window.addEventListener('load', () => navigator.serviceWorker.register(`${base.replace(/\/?$/, '/')}sw.js`).catch(() => {}));
}

export function iniciarGlobal() {
  menu();
  dicas();
  faixaNovidade();
  linkConta();
  som();
  serviceWorker();
}
