// Painel da administração. Todas as escritas passam por RLS (is_admin) ou por funções do servidor,
// e cada alteração fica registrada no histórico (admin_log) por gatilho.
import { supabase, perfilAtual, jogo, toast, esc, num, data, link, nomes, mensagemErro, $, $$ } from './app';
import { textoFicha } from '../lib/textos';
import { validarFicha, DADOS, derivados, type Ficha } from '../../supabase/functions/_shared/regras';
import { lutar, simularMassa, deTecnica, type Combatente } from '../lib/combate';

type Linha = Record<string, any>;
const palco = () => $('#conteudo-aba');
const v = (id: string) => ($(`#${id}`) as HTMLInputElement).value;
const n = (id: string) => Number(($(`#${id}`) as HTMLInputElement).value || 0);
async function rpc(fn: string, args: Record<string, unknown>, ok = 'Feito.') {
  const { data: r, error } = await supabase.rpc(fn, args);
  if (error) { toast(mensagemErro(error), true); throw error; }
  toast(ok);
  return r;
}

// ───────── FILA ─────────
async function fila() {
  const [{ data: fichas }, { data: envios }] = await Promise.all([
    supabase.from('personagens').select('*, perfis(nome_exibicao)').eq('status', 'aguardando').is('excluido_em', null).order('atualizado_em'),
    supabase.from('envios').select('*, personagens(nome, reino, corpo, ficha), perfis!envios_dono_fkey(nome_exibicao)').eq('status', 'pendente').order('criado_em'),
  ]);
  palco().innerHTML = `
    <div class="linha-flex" style="justify-content:space-between"><h2 style="margin:0">Fichas aguardando (${fichas?.length ?? 0})</h2>
      <button class="btn ouro pequeno" id="fechar-semana">Fechar a semana</button></div>
    ${(fichas ?? []).map((c) => {
      const val = validarFicha(c.ficha as Ficha, { corpo: c.corpo, linhagemRara: c.linhagem_rara, sorteUsada: c.sorte_usada });
      return `<article class="cartao-fila" data-ficha="${c.id}">
        <h3>${esc(c.nome)} <small class="mudo">de ${esc(c.perfis?.nome_exibicao)}</small></h3>
        <p class="mudo">${esc(nomes.seita(c.ficha?.seita))} · ${esc(nomes.corpo(c.corpo))} · ${esc(nomes.raiz(c.raiz))}</p>
        ${val.erros.length ? `<ul class="lista-erros">${val.erros.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>` : '<p class="ok">Passa em todas as regras.</p>'}
        <details><summary>Ver ficha completa</summary><pre class="texto-pronto">${esc(textoFicha(c))}</pre></details>
        <div class="grade-mini"><div class="campo"><label>Região inicial</label><select data-regiao>${['', 'Norte Gelado', 'Sul dos Rios', 'Oeste Vermelho', 'Leste Costeiro', 'Coração Imperial', 'Montanhas Centrais'].map((r) => `<option>${r}</option>`).join('')}</select></div></div>
        <div class="campo"><label>Motivo (se recusar)</label><input data-motivo maxlength="400" /></div>
        <div class="linha-flex"><button class="btn pequeno" data-aprovar>Aprovar</button><button class="btn fantasma pequeno" data-recusar>Recusar</button></div>
      </article>`;
    }).join('') || '<p class="mudo">Nenhuma ficha na fila.</p>'}
    <h2>Treinos e missões (${envios?.length ?? 0})</h2>
    ${(envios ?? []).map((e) => {
      const r = DADOS.reinos.find((x) => x.chave === e.personagens?.reino);
      const sugestao = e.tipo === 'treino' ? Math.round((r?.treino ?? 150) * (1 + (e.personagens?.corpo === 'corpo_mortal' ? 0.1 : 0) + (e.personagens?.ficha?.talentos?.vantagens?.includes('prodigio_marcial') ? 0.2 : 0))) : ({ missao_facil: 150, missao_media: 250, missao_dificil: 350 } as Record<string, number>)[e.tipo] ?? 0;
      return `<article class="cartao-fila" data-envio="${e.id}">
        <h3>${esc(e.titulo)}</h3>
        <p class="mudo">${esc(e.tipo.replace('_', ' '))} · ${esc(e.personagens?.nome)} (${esc(e.perfis?.nome_exibicao)}) · <strong>${e.linhas} linhas</strong>${e.foco ? ` · foco: ${esc(e.foco)}` : ''} · ${data(e.criado_em)}</p>
        <details><summary>Ler o texto</summary><div class="texto-envio">${esc(e.texto)}</div></details>
        <div class="grade-mini">
          ${e.tipo === 'pedido_avanco'
            ? `<label class="check"><input type="checkbox" data-mod="mestre" /> Mestre/manual +1</label><label class="check"><input type="checkbox" data-mod="pilula" /> Pílula/erva +1</label><label class="check"><input type="checkbox" data-mod="texto" /> Texto excelente +1</label>`
            : `<div class="campo"><label>PE</label><input type="number" data-pe value="${sugestao}" /></div><div class="campo"><label>Taéis</label><input type="number" data-taeis value="0" /></div>`}
        </div>
        <div class="campo"><label>Nota para o jogador</label><input data-nota maxlength="400" /></div>
        <div class="linha-flex"><button class="btn pequeno" data-ok>Aprovar</button><button class="btn fantasma pequeno" data-nao>Recusar</button></div>
      </article>`;
    }).join('') || '<p class="mudo">Nenhum envio pendente.</p>'}`;

  $$('[data-ficha]').forEach((art) => {
    const id = art.dataset.ficha!;
    art.querySelector('[data-aprovar]')!.addEventListener('click', async () => {
      try {
        const r = await jogo<{ ok: boolean; erros?: string[] }>('aprovar_ficha', { personagem: id, regiao: (art.querySelector('[data-regiao]') as HTMLSelectElement).value || null });
        if (!r.ok) return toast(r.erros?.[0] ?? 'Ficha inválida.', true);
        toast('Ficha aprovada.'); fila();
      } catch (e) { toast((e as Error).message, true); }
    });
    art.querySelector('[data-recusar]')!.addEventListener('click', async () => {
      const motivo = (art.querySelector('[data-motivo]') as HTMLInputElement).value.trim();
      if (!motivo) return toast('Escreva o motivo da recusa.', true);
      await rpc('recusar_ficha', { p_id: id, p_motivo: motivo }, 'Ficha recusada.'); fila();
    });
  });
  $$('[data-envio]').forEach((art) => {
    const id = Number(art.dataset.envio);
    const nota = () => (art.querySelector('[data-nota]') as HTMLInputElement).value.trim() || null;
    art.querySelector('[data-ok]')!.addEventListener('click', async () => {
      const pe = art.querySelector<HTMLInputElement>('[data-pe]');
      const taeis = art.querySelector<HTMLInputElement>('[data-taeis]');
      const mods: Record<string, boolean> = {};
      art.querySelectorAll<HTMLInputElement>('[data-mod]').forEach((m) => { if (m.checked) mods[m.dataset.mod!] = true; });
      await rpc('revisar_envio', { p_envio: id, p_aprovar: true, p_pe: pe ? Number(pe.value) : null, p_taeis: taeis ? Number(taeis.value) : null, p_nota: nota(), p_mods: mods }, 'Aprovado.');
      fila();
    });
    art.querySelector('[data-nao]')!.addEventListener('click', async () => {
      if (!nota()) return toast('Explique a recusa na nota.', true);
      await rpc('revisar_envio', { p_envio: id, p_aprovar: false, p_nota: nota() }, 'Recusado.'); fila();
    });
  });
  $('#fechar-semana').onclick = async () => {
    if (!confirm('Fechar a semana para todos? (salários, custo de vida, maldições)')) return;
    const r = await rpc('fechar_semana', {}, 'Semana fechada.') as { personagens: number };
    toast(`${r.personagens} personagens atualizados.`);
  };
}

// ───────── PERSONAGENS ─────────
async function personagens() {
  const { data: lista } = await supabase.from('personagens').select('id, nome, alcunha, status, reino, estagio, pe, vivo, faccao, perfis(nome_exibicao)').is('excluido_em', null).order('nome');
  palco().innerHTML = `<input class="busca-admin" id="filtro" type="search" placeholder="Filtrar por nome…" aria-label="Filtrar personagens" />
    <div class="grade-2"><ul class="lista-simples lista-sel" id="lista">${(lista ?? []).map((c) => `<li data-id="${c.id}" tabindex="0">${esc(c.nome)} <span class="mudo">· ${esc(nomes.reino(c.reino))} · ${num(c.pe)} PE · ${esc(c.status)}${c.vivo ? '' : ' · morto'} · ${esc(c.perfis?.nome_exibicao)}</span></li>`).join('')}</ul>
    <div id="editor"><p class="mudo">Escolha um personagem.</p></div></div>`;
  $('#filtro').oninput = () => $$('#lista li').forEach((li) => (li.hidden = !li.textContent!.toLowerCase().includes(v('filtro').toLowerCase())));
  $$('#lista li').forEach((li) => { li.onclick = () => editar(li.dataset.id!); li.onkeydown = (e) => { if (e.key === 'Enter') editar(li.dataset.id!); }; });
}

async function editar(id: string) {
  const { data: c } = await supabase.from('personagens').select('*').eq('id', id).single();
  if (!c) return;
  const ed = $('#editor');
  ed.innerHTML = `<div class="painel">
    <h3 style="margin-top:0"><a href="${link(`/personagem/?id=${c.id}`)}" target="_blank" rel="noopener">${esc(c.nome)}</a></h3>
    <p class="mudo">${esc(nomes.reino(c.reino))} ${esc(nomes.estagio(c.estagio))} · ${num(c.pe)} PE · ${c.taeis} taéis · Corrupção ${c.corrupcao} · Fama ${c.fama} · Infâmia ${c.infamia} · ${c.leituras} Leituras</p>
    <p class="rotulo ouro">Somar ou tirar (use negativos)</p>
    <div class="grade-mini">${['pe', 'pa', 'taeis', 'fama', 'infamia', 'corrupcao', 'leituras', 'contribuicao'].map((k) => `<div class="campo"><label for="d-${k}">${k}</label><input type="number" id="d-${k}" value="0" /></div>`).join('')}</div>
    <div class="grade-mini"><div class="campo"><label for="s-regiao">Região</label><input id="s-regiao" value="${esc(c.regiao ?? '')}" /></div><div class="campo"><label for="s-alcunha">Alcunha</label><input id="s-alcunha" value="${esc(c.alcunha ?? '')}" /></div></div>
    <div class="campo"><label for="s-inv">Inventário (um item por linha)</label><textarea id="s-inv" rows="4">${esc((c.inventario ?? []).map((x: Linha) => (typeof x === 'string' ? x : x.nome)).join('\n'))}</textarea></div>
    <div class="campo"><label for="s-fer">Ferimentos (um por linha)</label><textarea id="s-fer" rows="3">${esc((c.ferimentos ?? []).map((x: Linha) => x.texto ?? x.tipo).join('\n'))}</textarea><p class="ajuda">Escreva "interno: ..." para Ferimento Interno (conta no gargalo).</p></div>
    <div class="campo"><label for="s-afi">Afinidades (Mestre=valor, uma por linha)</label><textarea id="s-afi" rows="3">${esc(Object.entries(c.afinidades ?? {}).map(([k, x]) => `${k}=${x}`).join('\n'))}</textarea></div>
    <div class="campo"><label for="s-mer">Meridianos abertos (números 1–20 separados por vírgula; 13–20 extraordinários)</label><input id="s-mer" value="${esc((c.meridianos ?? []).join(', '))}" /></div>
    <div class="campo"><label for="motivo">Motivo (obrigatório, fica no histórico)</label><input id="motivo" maxlength="300" /></div>
    <button class="btn pequeno" id="salvar-ajuste">Aplicar ajuste</button>
    <hr />
    <div class="linha-flex"><select id="conquista" aria-label="Conquista">${[['primeira_vitoria', 'Primeiro Sangue'], ['sobrevivente', 'Sobrevivente'], ['dragao', 'Nome na Lista'], ['procurado', 'Cabeça a Prêmio'], ['lenda', 'Lenda Viva']].map(([k, t]) => `<option value="${k}">${t}</option>`).join('')}</select><button class="btn fantasma pequeno" id="dar-conquista">Conceder conquista</button></div>
    ${c.vivo ? `<div class="campo" style="margin-top:1rem"><label for="causa">Causa da morte</label><input id="causa" maxlength="300" /></div><button class="btn fantasma pequeno" id="matar">Registrar morte</button>` : `<p class="erro">Morto: ${esc(c.causa_morte)}</p>`}
  </div>`;
  $('#salvar-ajuste').onclick = async () => {
    const mud: Record<string, unknown> = {};
    for (const k of ['pe', 'pa', 'taeis', 'fama', 'infamia', 'corrupcao', 'leituras', 'contribuicao']) if (n(`d-${k}`)) mud[k] = n(`d-${k}`);
    if (v('s-regiao') !== (c.regiao ?? '')) mud.regiao = v('s-regiao');
    if (v('s-alcunha') !== (c.alcunha ?? '')) mud.alcunha = v('s-alcunha');
    mud.inventario = v('s-inv').split('\n').map((x) => x.trim()).filter(Boolean).map((nome) => ({ nome, qtd: 1 }));
    mud.ferimentos = v('s-fer').split('\n').map((x) => x.trim()).filter(Boolean).map((t) => (/^interno:/i.test(t) ? { tipo: 'interno', texto: t.replace(/^interno:\s*/i, 'Ferimento Interno: ') } : { tipo: 'outro', texto: t }));
    mud.afinidades = Object.fromEntries(v('s-afi').split('\n').map((x) => x.split('=')).filter((x) => x.length === 2).map(([k, x]) => [k.trim(), Math.max(0, Math.min(100, Number(x)))]));
    mud.meridianos = v('s-mer').split(',').map((x) => Number(x.trim())).filter((x) => x >= 1 && x <= 20);
    await rpc('ajustar_personagem', { p_id: c.id, p_mudancas: mud, p_motivo: v('motivo') }, 'Ajuste aplicado e registrado.');
    editar(c.id);
  };
  $('#dar-conquista').onclick = () => rpc('conceder_conquista', { p_personagem: c.id, p_chave: v('conquista') }, 'Conquista concedida.');
  const matar = document.getElementById('matar');
  if (matar) matar.onclick = async () => {
    if (!v('causa')) return toast('Descreva a causa da morte.', true);
    if (!confirm(`Registrar a morte de ${c.nome}? Isso vai para o mural.`)) return;
    await rpc('registrar_morte', { p_id: c.id, p_causa: v('causa') }, 'Morte registrada.');
    editar(c.id);
  };
}

// ───────── CONTAS ─────────
async function contas() {
  const { data: lista } = await supabase.from('perfis').select('*').order('criado_em', { ascending: false });
  palco().innerHTML = `<div class="tabela-rolagem"><table><thead><tr><th>Nome</th><th>Papel</th><th>Desde</th><th>Quiz</th><th>Situação</th><th></th></tr></thead><tbody>
    ${(lista ?? []).map((p) => `<tr><td>${esc(p.nome_exibicao)}</td><td>${esc(p.papel)}</td><td>${data(p.criado_em)}</td><td>${p.quiz_aprovado ? 'sim' : 'não'}</td><td>${p.banido ? '<span class="erro">banido</span>' : 'ativo'}</td>
      <td>${p.papel === 'admin' ? '' : `<button class="btn fantasma pequeno" data-ban="${p.id}" data-estado="${p.banido ? 0 : 1}">${p.banido ? 'Desbanir' : 'Banir'}</button>`}</td></tr>`).join('')}
  </tbody></table></div>`;
  $$('[data-ban]').forEach((b) => b.onclick = async () => {
    const motivo = prompt('Motivo (fica registrado):');
    if (!motivo) return;
    await rpc('banir_conta', { p_perfil: b.dataset.ban, p_banido: b.dataset.estado === '1', p_motivo: motivo });
    contas();
  });
}

// ───────── ROLAGENS ─────────
async function rolagens() {
  const [{ data: lei }, { data: rol }] = await Promise.all([
    supabase.from('leituras').select('*, personagens(nome), perfis(nome_exibicao)').order('criado_em', { ascending: false }).limit(300),
    supabase.from('rolagens').select('*, personagens(nome)').order('criado_em', { ascending: false }).limit(300),
  ]);
  palco().innerHTML = `<h2>Leituras do Destino (imutáveis)</h2><div class="tabela-rolagem"><table><thead><tr><th>Quando</th><th>Personagem</th><th>Jogador</th><th>Tipo</th><th>Raridade</th><th>Resultado</th><th class="num">Rolagem</th><th>Pity</th></tr></thead><tbody>
    ${(lei ?? []).map((l) => `<tr><td>${data(l.criado_em)}</td><td>${esc(l.personagens?.nome)}</td><td>${esc(l.perfis?.nome_exibicao)}</td><td>${esc(l.tipo)}</td><td class="r-${esc(l.raridade)}"><span class="raridade">${esc(l.raridade)}</span></td><td>${esc(l.detalhes?.nome ?? l.resultado)}</td><td class="num">${l.rolagem}</td><td>${l.garantida ? 'sim' : ''}</td></tr>`).join('') || '<tr><td colspan="8" class="mudo">Nenhuma.</td></tr>'}
  </tbody></table></div>
  <h2>Rolagens oficiais</h2><div class="tabela-rolagem"><table><thead><tr><th>Quando</th><th>Personagem</th><th>Tipo</th><th>Dados</th><th class="num">Total</th><th>Resultado</th></tr></thead><tbody>
    ${(rol ?? []).map((r) => `<tr><td>${data(r.criado_em)}</td><td>${esc(r.personagens?.nome)}</td><td>${esc(r.tipo)}</td><td>${r.dados.join(', ')}</td><td class="num">${r.total}</td><td>${esc(r.resultado)}</td></tr>`).join('') || '<tr><td colspan="6" class="mudo">Nenhuma.</td></tr>'}
  </tbody></table></div>`;
}

// ───────── MURAL ─────────
async function mural() {
  const { data: posts } = await supabase.from('mural').select('*').order('criado_em', { ascending: false }).limit(100);
  palco().innerHTML = `<form id="novo-aviso" class="painel"><div class="grade-mini"><div class="campo"><label for="m-tipo">Tipo</label><select id="m-tipo"><option value="aviso">Aviso</option><option value="regra">Regra nova</option><option value="conquista">Conquista</option><option value="promocao">Promoção</option></select></div></div>
    <div class="campo"><label for="m-titulo">Título</label><input id="m-titulo" required maxlength="160" /></div>
    <div class="campo"><label for="m-corpo">Texto</label><textarea id="m-corpo" rows="4" maxlength="3000"></textarea></div><button class="btn pequeno">Publicar no mural</button></form>
    <ul class="lista-simples" style="margin-top:1.5rem">${(posts ?? []).map((p) => `<li><strong>${esc(p.titulo)}</strong> <span class="mudo">· ${esc(p.tipo)} · ${data(p.criado_em)}</span><button class="btn fantasma pequeno" style="float:right" data-apagar="${p.id}">Apagar</button></li>`).join('')}</ul>`;
  $('#novo-aviso').addEventListener('submit', async (e) => {
    e.preventDefault();
    const p = await perfilAtual();
    const { error } = await supabase.from('mural').insert({ tipo: v('m-tipo'), titulo: v('m-titulo'), corpo: v('m-corpo'), criado_por: p!.id });
    if (error) return toast(mensagemErro(error), true);
    toast('Publicado.'); mural();
  });
  $$('[data-apagar]').forEach((b) => b.onclick = async () => {
    if (!confirm('Apagar este aviso do mural?')) return;
    const { error } = await supabase.from('mural').delete().eq('id', b.dataset.apagar);
    if (error) return toast(mensagemErro(error), true);
    mural();
  });
}

// ───────── LISTAS ─────────
async function listas() {
  const { data: itens } = await supabase.from('listas').select('*').order('lista').order('posicao');
  const bloco = (k: string, t: string) => `<h2>${t}</h2><ul class="lista-simples">${(itens ?? []).filter((i) => i.lista === k).map((i) => `<li>#${i.posicao} <strong>${esc(i.nome)}</strong> ${i.detalhe ? `<span class="mudo">· ${esc(i.detalhe)}</span>` : ''}<button class="btn fantasma pequeno" style="float:right" data-rem="${i.id}">Remover</button></li>`).join('') || '<li class="mudo">Vazia.</li>'}</ul>`;
  palco().innerHTML = `${bloco('dragoes', 'Dragões Ascendentes')}${bloco('procurados', 'Procurados')}
    <form id="nova-entrada" class="painel" style="margin-top:1.5rem"><div class="grade-mini">
      <div class="campo"><label for="l-lista">Lista</label><select id="l-lista"><option value="dragoes">Dragões</option><option value="procurados">Procurados</option></select></div>
      <div class="campo"><label for="l-pos">Posição</label><input id="l-pos" type="number" min="1" max="50" required /></div>
      <div class="campo"><label for="l-nome">Nome</label><input id="l-nome" required /></div>
      <div class="campo"><label for="l-det">Detalhe (reino, recompensa…)</label><input id="l-det" /></div>
    </div><button class="btn pequeno">Salvar posição</button><p class="ajuda">Salvar numa posição ocupada substitui a entrada.</p></form>`;
  $('#nova-entrada').addEventListener('submit', async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('listas').upsert({ lista: v('l-lista'), posicao: n('l-pos'), nome: v('l-nome'), detalhe: v('l-det') || null, atualizado_em: new Date().toISOString() }, { onConflict: 'lista,posicao' });
    if (error) return toast(mensagemErro(error), true);
    listas();
  });
  $$('[data-rem]').forEach((b) => b.onclick = async () => { await supabase.from('listas').delete().eq('id', b.dataset.rem); listas(); });
}

// ───────── CALENDÁRIO ─────────
async function calendario() {
  const { data: evs } = await supabase.from('eventos').select('*').order('inicio');
  palco().innerHTML = `<form id="novo-evento" class="painel"><div class="grade-mini">
      <div class="campo"><label for="ev-t">Título</label><input id="ev-t" required /></div>
      <div class="campo"><label for="ev-d">Início</label><input id="ev-d" type="datetime-local" required /></div>
      <div class="campo"><label for="ev-tipo">Tipo</label><select id="ev-tipo"><option value="evento">Evento</option><option value="torneio">Torneio</option><option value="leilao">Leilão</option><option value="missao">Missão narrada</option></select></div>
    </div><div class="campo"><label for="ev-desc">Descrição</label><textarea id="ev-desc" rows="3"></textarea></div><button class="btn pequeno">Adicionar</button></form>
    <ul class="lista-simples" style="margin-top:1.5rem">${(evs ?? []).map((e) => `<li><strong>${esc(e.titulo)}</strong> <span class="mudo">· ${data(e.inicio)} · ${esc(e.tipo)}</span><button class="btn fantasma pequeno" style="float:right" data-rem="${e.id}">Remover</button></li>`).join('')}</ul>`;
  $('#novo-evento').addEventListener('submit', async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('eventos').insert({ titulo: v('ev-t'), inicio: new Date(v('ev-d')).toISOString(), tipo: v('ev-tipo'), descricao: v('ev-desc') || null });
    if (error) return toast(mensagemErro(error), true);
    calendario();
  });
  $$('[data-rem]').forEach((b) => b.onclick = async () => { await supabase.from('eventos').delete().eq('id', b.dataset.rem); calendario(); });
}

// ───────── ESTATÍSTICAS ─────────
function barras(titulo: string, dados: Record<string, number> | null) {
  const ent = Object.entries(dados ?? {});
  const max = Math.max(1, ...ent.map(([, x]) => x));
  return `<h3>${titulo}</h3>${ent.map(([k, x]) => `<div class="barra-h"><span>${esc(k)}</span><i style="width:${(x / max) * 60}%"></i><strong>${x}</strong></div>`).join('') || '<p class="mudo">Sem dados.</p>'}`;
}
async function estatisticas() {
  const { data: s, error } = await supabase.rpc('estatisticas');
  if (error) return toast(mensagemErro(error), true);
  palco().innerHTML = `<dl class="numeros"><div><dt>Jogadores</dt><dd>${s.jogadores}</dd></div><div><dt>Ativos (7 dias)</dt><dd>${s.ativos_7d}</dd></div>
    <div><dt>Fichas na fila</dt><dd>${s.pendentes.fichas}</dd></div><div><dt>Envios na fila</dt><dd>${s.pendentes.envios}</dd></div></dl>
    <div class="grade-2"><div>${barras('Personagens por status', s.personagens)}${barras('Facções (aprovados)', Object.fromEntries(Object.entries(s.por_faccao ?? {}).map(([k, x]) => [nomes.faccao(k), x as number])))}</div>
    <div><h3>Por reino (PE médio)</h3>${(s.por_reino ?? []).map((r: Linha) => `<div class="barra-h"><span>${esc(r.reino)}</span><i style="width:${Math.min(60, r.n * 6)}%"></i><strong>${r.n}</strong><span class="mudo">· ${num(r.pe_medio)} PE</span></div>`).join('')}
    ${barras('Corpos', Object.fromEntries(Object.entries(s.por_corpo ?? {}).map(([k, x]) => [nomes.corpo(k), x as number])))}${barras('Leituras de corpo por raridade', s.leituras)}</div></div>`;
}

// ───────── SIMULADOR DE COMBATE ─────────
function formCombatente(id: string, titulo: string, opts: string) {
  return `<fieldset class="painel" style="border:var(--borda)"><legend class="rotulo ouro">${titulo}</legend>
    <div class="campo"><label for="${id}-sel">Personagem aprovado (ou manual)</label><select id="${id}-sel"><option value="">— Valores manuais —</option>${opts}</select></div>
    <div class="grade-mini">
      <div class="campo"><label for="${id}-nome">Nome</label><input id="${id}-nome" value="${titulo}" /></div>
      <div class="campo"><label for="${id}-reino">Reino</label><select id="${id}-reino">${DADOS.reinos.filter((r) => r.pe).map((r) => `<option value="${r.chave}">${r.nome}</option>`).join('')}</select></div>
      ${['forca', 'agilidade', 'resistencia', 'precisao', 'vigor'].map((k) => `<div class="campo"><label for="${id}-${k}">${k}</label><input type="number" id="${id}-${k}" value="1000" /></div>`).join('')}
      <div class="campo"><label for="${id}-qi">Qi</label><input type="number" id="${id}-qi" value="1000" /></div>
      <div class="campo"><label for="${id}-arma">Arma (+)</label><input type="number" id="${id}-arma" value="0" /></div>
      <div class="campo"><label for="${id}-tec">Técnica: bônus</label><input type="number" id="${id}-tec" value="300" /></div>
      <div class="campo"><label for="${id}-tecattr">Atributo da técnica</label><select id="${id}-tecattr"><option>forca</option><option>precisao</option><option>agilidade</option></select></div>
      <div class="campo"><label for="${id}-def">Defensiva: bônus</label><input type="number" id="${id}-def" value="0" /></div>
    </div></fieldset>`;
}
async function simulador() {
  const { data: ps } = await supabase.from('personagens').select('*').eq('status', 'aprovada').is('excluido_em', null).eq('vivo', true).order('nome');
  const opts = (ps ?? []).map((p) => `<option value="${p.id}">${esc(p.nome)} (${esc(nomes.reino(p.reino))})</option>`).join('');
  palco().innerHTML = `<p class="mudo">Aplica as regras de combate da biblioteca. A "variação" simula escolhas narrativas na simulação em massa (0% = luta determinística).</p>
    <div class="grade-2">${formCombatente('a', 'Lutador A', opts)}${formCombatente('b', 'Lutador B', opts)}</div>
    <div class="linha-flex" style="margin:1rem 0"><label for="var" style="margin:0">Variação</label><input id="var" type="number" value="10" min="0" max="40" style="width:6rem" />%
      <button class="btn" id="uma">Simular 1 luta</button><button class="btn fantasma" id="mil">Simular 1.000 lutas</button></div>
    <div id="saida-sim"></div>`;
  for (const lado of ['a', 'b']) {
    $(`#${lado}-sel`).onchange = () => {
      const p = (ps ?? []).find((x) => x.id === v(`${lado}-sel`));
      if (!p) return;
      const d = derivados(p.ficha, p.corpo, p.linhagem_rara, p.reino, p.qi_max);
      ($(`#${lado}-nome`) as HTMLInputElement).value = p.nome;
      ($(`#${lado}-reino`) as HTMLSelectElement).value = p.reino;
      for (const k of ['forca', 'agilidade', 'resistencia', 'precisao', 'vigor'] as const) ($(`#${lado}-${k}`) as HTMLInputElement).value = String(d.atributos[k]);
      ($(`#${lado}-qi`) as HTMLInputElement).value = String(p.qi_max);
    };
  }
  const montar = (lado: string): Combatente => {
    const p = (ps ?? []).find((x) => x.id === v(`${lado}-sel`));
    const at = Object.fromEntries(['forca', 'agilidade', 'resistencia', 'precisao', 'vigor'].map((k) => [k, n(`${lado}-${k}`)])) as Combatente['atributos'];
    const tecs = p ? (p.ficha.tecnicas ?? []).map(deTecnica) : [
      { nome: 'Técnica', principal: v(`${lado}-tecattr`) as 'forca', bonus: n(`${lado}-tec`), bonusPrecisao: v(`${lado}-tecattr`) === 'precisao' ? n(`${lado}-tec`) : 0, custoQi: 80, recarga: 1, defensiva: false, grau: 'basica' },
      ...(n(`${lado}-def`) ? [{ nome: 'Guarda', principal: 'resistencia' as const, bonus: n(`${lado}-def`), bonusPrecisao: 0, custoQi: 70, recarga: 1, defensiva: true, grau: 'basica' }] : []),
    ];
    return { nome: v(`${lado}-nome`) || lado.toUpperCase(), reino: v(`${lado}-reino`), atributos: at, vida: at.resistencia + at.vigor, qi: n(`${lado}-qi`), arma: n(`${lado}-arma`), tecnicas: tecs };
  };
  $('#uma').onclick = () => {
    const r = lutar(montar('a'), montar('b'), { variacao: n('var') / 100 });
    $('#saida-sim').innerHTML = `<p><strong>Vencedor:</strong> ${esc(r.vencedor ?? 'empate')} em ${r.turnos} turnos</p><div class="log-luta">${esc(r.log.join('\n'))}</div>`;
  };
  $('#mil').onclick = () => {
    const A = montar('a'), B = montar('b');
    const m = simularMassa(A, B, 1000, n('var') / 100);
    $('#saida-sim').innerHTML = `<dl class="numeros"><div><dt>${esc(A.nome)}</dt><dd>${(m.vitoriasA / 10).toFixed(1)}%</dd></div><div><dt>${esc(B.nome)}</dt><dd>${(m.vitoriasB / 10).toFixed(1)}%</dd></div><div><dt>Empates</dt><dd>${(m.empates / 10).toFixed(1)}%</dd></div><div><dt>Turnos médios</dt><dd>${m.turnosMedios.toFixed(1)}</dd></div></dl>`;
  };
}

// ───────── DESTINO 100k ─────────
async function destino() {
  palco().innerHTML = `<p>Roda a Leitura do Destino <strong>no servidor</strong>, com o mesmo código e o mesmo gerador criptográfico das leituras reais, sem gravar nada. Serve para provar que as porcentagens batem.</p>
    <div class="linha-flex"><select id="sim-tipo" aria-label="Tipo"><option value="corpo">Corpo Marcial</option><option value="raiz">Raiz de Qi</option><option value="linhagem">Linhagem</option></select>
    <button class="btn" id="rodar">Rodar 100.000 leituras</button></div><div id="saida-destino"></div>`;
  $('#rodar').onclick = async () => {
    $('#saida-destino').innerHTML = '<p class="mudo">Lendo cem mil destinos…</p>';
    try {
      const r = await jogo<Linha>('simular', { tipo: v('sim-tipo'), n: 100000 });
      $('#saida-destino').innerHTML = `<div class="tabela-rolagem"><table><thead><tr><th>Resultado</th><th class="num">Esperado</th><th class="num">Obtido</th><th class="num">Quantidade</th><th class="num">Diferença</th></tr></thead><tbody>
        ${r.resultado.map((x: Linha) => `<tr><td class="r-${esc(x.chave)}"><span class="raridade">${esc(x.chave)}</span></td><td class="num">${(x.esperado * 100).toFixed(2)}%</td><td class="num">${(x.obtido * 100).toFixed(3)}%</td><td class="num">${num(x.quantidade)}</td><td class="num">${((x.obtido - x.esperado) * 100).toFixed(3)} p.p.</td></tr>`).join('')}
      </tbody></table></div><p class="mudo">${num(r.n)} leituras em ${r.ms} ms no servidor. ${r.config.length ? `<span class="erro">Problemas na configuração: ${esc(r.config.join('; '))}</span>` : 'Configuração válida.'}</p>`;
    } catch (e) { $('#saida-destino').innerHTML = `<p class="erro">${esc((e as Error).message)}</p>`; }
  };
}

// ───────── HISTÓRICO ─────────
async function historico() {
  const { data: lg } = await supabase.from('admin_log').select('*').order('criado_em', { ascending: false }).limit(300);
  const ids = [...new Set((lg ?? []).map((l) => l.admin).filter(Boolean))];
  const { data: ad } = ids.length ? await supabase.from('perfis').select('id, nome_exibicao').in('id', ids) : { data: [] };
  const nome = (id: string) => ad?.find((a) => a.id === id)?.nome_exibicao ?? '—';
  palco().innerHTML = `<p class="mudo">Toda alteração feita por admin. Ninguém apaga este histórico.</p><div class="tabela-rolagem"><table><thead><tr><th>Quando</th><th>Admin</th><th>Ação</th><th>Tabela</th><th>Motivo</th><th>Detalhe</th></tr></thead><tbody>
    ${(lg ?? []).map((l) => `<tr><td>${data(l.criado_em)}</td><td>${esc(nome(l.admin))}</td><td>${esc(l.acao)}</td><td>${esc(l.tabela)}</td><td>${esc(l.motivo ?? '')}</td><td><details><summary>ver</summary><pre class="texto-pronto" style="max-width:40rem">${esc(JSON.stringify({ antes: l.antes, depois: l.depois }, null, 1).slice(0, 4000))}</pre></details></td></tr>`).join('')}
  </tbody></table></div>`;
}

const ABAS: Record<string, () => Promise<void> | void> = { fila, personagens, contas, rolagens, mural, listas, calendario, estatisticas, simulador, destino, log: historico };

export async function iniciarAdmin() {
  const p = await perfilAtual();
  if (!p || p.papel !== 'admin') {
    $('#aviso-admin').innerHTML = `Esta área é só da administração. <a href="${link('/conta/')}">Voltar à conta</a>`;
    return;
  }
  $('#aviso-admin').textContent = `Logado como ${p.nome_exibicao}.`;
  $('#painel').hidden = false;
  const ir = async (k: string) => {
    $$('.abas-admin button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.aba === k)));
    palco().innerHTML = '<p class="mudo">Carregando…</p>';
    history.replaceState(null, '', `#${k}`);
    try { await ABAS[k](); } catch (e) { console.error(e); }
  };
  $$('.abas-admin button').forEach((b) => (b.onclick = () => ir(b.dataset.aba!)));
  ir(location.hash.slice(1) in ABAS ? location.hash.slice(1) : 'fila');
}
