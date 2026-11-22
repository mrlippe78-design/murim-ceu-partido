// Perfil do personagem: público para fichas aprovadas; o dono vê também as ações de jogo.
import { supabase, sessao, jogo, toast, copiar, esc, num, data, link, nomes, mensagemErro, param, $, ROTULO_RARIDADE } from './app';
import { ATRIBUTOS, NOME_ATRIBUTO, DADOS, derivados, progresso, nivelFama, contarLinhas, textoTecnica, vantagem, desvantagem, faccao as infoFaccao, type Ficha } from '../../supabase/functions/_shared/regras';
import { textoFicha } from '../lib/textos';
import { svgMeridianos } from './meridianos';

type Linha = Record<string, any>;
const CONQUISTAS: Record<string, string> = {
  primeiro_passo: 'Primeiro Passo', primeiro_avanco: 'Gargalo Rompido', primeira_vitoria: 'Primeiro Sangue', sobrevivente: 'Sobrevivente',
  corpo_epico: 'Tocado pelo Céu', dragao: 'Nome na Lista', procurado: 'Cabeça a Prêmio', lenda: 'Lenda Viva',
};

function blocoNumeros(c: Linha, d: ReturnType<typeof derivados>) {
  const pr = progresso(c.pe, c.reino, c.estagio);
  const r = DADOS.reinos.find((x) => x.chave === c.reino)!;
  const ini = r.pe ? r.pe[['inicial', 'intermediario', 'superior'].indexOf(c.estagio)] : 0;
  const pct = pr.proximo && Number.isFinite(pr.proximo.pe) ? Math.min(100, ((c.pe - ini) / Math.max(1, pr.proximo.pe - ini)) * 100) : 100;
  const fama = nivelFama(c.fama);
  return `<dl class="numeros">
    <div><dt>PE</dt><dd>${num(c.pe)}<small>${pr.proximo ? `faltam ${num(pr.falta)} para ${esc(nomes.reino(pr.proximo.reino))} ${esc(nomes.estagio(pr.proximo.estagio))}${pr.precisaGargalo ? ' (gargalo)' : ''}` : 'topo'}</small></dd><div class="progresso-pe"><span style="width:${pct}%"></span></div></div>
    <div><dt>PA livre</dt><dd>${num(c.pa)}<small>teto ${num(r.teto ?? 0)} por atributo</small></dd></div>
    <div><dt>Vida</dt><dd>${num(d.vida)}</dd></div>
    <div><dt>Qi</dt><dd>${num(c.qi_max)}<small>${Math.floor(c.qi_max / 100)} anos de energia</small></dd></div>
    <div><dt>Taéis</dt><dd>${num(c.taeis)}</dd></div>
    <div><dt>Corrupção</dt><dd>${c.corrupcao}<small>${c.corrupcao >= 75 ? 'voz dupla' : c.corrupcao >= 50 ? 'veias escuras' : c.corrupcao >= 25 ? 'olhos avermelhados' : 'sem marcas'}</small></dd><div class="corrup"><span style="left:${c.corrupcao}%"></span></div></div>
    <div><dt>Fama</dt><dd>${num(c.fama)}<small>${esc(fama.nivel)}</small></dd></div>
    <div><dt>Infâmia</dt><dd>${num(c.infamia)}<small>${c.infamia >= 1500 ? 'cabeça a prêmio' : ''}</small></dd></div>
    <div><dt>Contribuição</dt><dd>${num(c.contribuicao)}</dd></div>
    <div><dt>Região</dt><dd style="font-size:1rem">${esc(c.regiao ?? '—')}</dd></div>
    <div><dt>Leituras</dt><dd>${c.leituras}<small>${c.fios}/40 Fios</small></dd></div>
    <div><dt>Fichas</dt><dd style="font-size:1rem">${esc(nomes.status(c.status))}</dd></div>
  </dl>`;
}

function htmlPerfil(c: Linha, dono: boolean, extras: { diario: Linha[]; conquistas: Linha[]; envios: Linha[] }) {
  const f: Ficha = c.ficha ?? {};
  const d = derivados(f, c.corpo, c.linhagem_rara, c.reino, c.qi_max);
  const rar = nomes.raridadeCorpo(c.corpo);
  const fac = infoFaccao(c.faccao ?? f.faccao);
  const tecnicas = (f.tecnicas ?? []).map((t) => `<li><pre class="texto-pronto" style="max-height:none;margin:0">${esc(textoTecnica(t))}</pre></li>`).join('');
  return `
  <header class="perfil-cabeca">
    <span class="fantasma-ideograma" aria-hidden="true">${esc(fac?.ideograma ?? '人')}</span>
    <p class="rotulo">${esc(nomes.faccao(c.faccao ?? f.faccao))} · ${esc(nomes.seita(c.seita ?? f.seita))}</p>
    <h1>${esc(c.nome)}</h1>
    ${c.alcunha ? `<p class="alcunha">“${esc(c.alcunha)}”</p>` : ''}
    <div class="linha-flex">
      <span class="rotulo ouro">${esc(nomes.reino(c.reino))} · ${esc(nomes.estagio(c.estagio))}</span>
      <span class="corpo-destaque r-${rar}"><span class="raridade">${esc(ROTULO_RARIDADE[rar])}${d.selado ? ' · selado' : ''}</span><strong>${esc(nomes.corpo(c.corpo))}</strong></span>
    </div>
    ${!c.vivo ? `<p class="memorial">${esc(c.causa_morte ?? 'Tombou no Jianghu.')}${c.morto_em ? ` — ${new Date(c.morto_em).toLocaleDateString('pt-BR')}` : ''}</p>` : ''}
    <div class="linha-flex">
      <button class="btn fantasma pequeno" id="copiar-link">Copiar link do perfil</button>
      <button class="btn fantasma pequeno" id="copiar-ficha">Copiar ficha para o WhatsApp</button>
      <button class="btn pequeno" id="gerar-cartao">Gerar cartão</button>
    </div>
  </header>
  ${blocoNumeros(c, d)}
  <div class="perfil-grade">
    <div>
      ${dono ? `<section class="bloco acoes-dono" id="acoes"></section>` : ''}
      <section class="bloco"><h2>Atributos</h2>
        <table class="tabela-mini"><tbody>${ATRIBUTOS.map((k) => `<tr><th>${NOME_ATRIBUTO[k]}</th><td class="num">${num(d.atributos[k])}</td><td class="num sutil">base ${num(Number(f.atributos?.[k] ?? 0))}</td></tr>`).join('')}</tbody></table>
      </section>
      <section class="bloco"><h2>Artes</h2>
        <p><strong>${esc(f.arteInterna?.nome ?? '—')}</strong> <span class="mudo">(${esc((DADOS.elementos as Record<string, string>)[f.arteInterna?.natureza ?? ''] ?? '—')})</span><br>${esc(f.arteInterna?.passiva ?? '')}</p>
        <ul class="lista-simples">${tecnicas}</ul>
        <p style="margin-top:1rem"><strong>Arma:</strong> ${esc(f.arma?.nome ?? '—')}</p>
      </section>
      <section class="bloco"><h2>Diário</h2>
        <ol class="diario">${extras.diario.map((e) => `<li><time>${data(e.criado_em)}</time>${esc(e.texto)}</li>`).join('') || '<li>Nada registrado ainda.</li>'}</ol>
      </section>
    </div>
    <div>
      <section class="bloco meridianos"><h2>Meridianos</h2>${svgMeridianos(c.meridianos ?? [])}</section>
      <section class="bloco"><h2>Origem e sangue</h2>
        <ul class="lista-simples">
          <li><strong>Linhagem:</strong> ${esc(nomes.linhagem(c.linhagem ?? f.linhagem))}${c.linhagem_rara ? ` + ${esc(nomes.linhagem(c.linhagem_rara))}` : ''}</li>
          <li><strong>Origem:</strong> ${esc(nomes.origem(c.origem ?? f.origem))}</li>
          <li><strong>Raiz de Qi:</strong> ${esc(nomes.raiz(c.raiz))}</li>
          <li><strong>Talentos:</strong> ${(f.talentos?.vantagens ?? []).map((k) => esc(vantagem(k)?.nome)).join(', ') || '—'}</li>
          <li><strong>Desvantagens:</strong> ${(f.talentos?.desvantagens ?? []).map((k) => esc(desvantagem(k)?.nome)).join(', ') || '—'}</li>
          <li><strong>Idade:</strong> ${esc(f.idade ?? '—')}</li>
        </ul>
      </section>
      <section class="bloco"><h2>Ferimentos</h2><ul class="lista-simples">${(c.ferimentos ?? []).map((x: Linha) => `<li>${esc(x.texto ?? x.tipo)}${x.ate ? ` <span class="sutil">até ${new Date(x.ate).toLocaleDateString('pt-BR')}</span>` : ''}</li>`).join('') || '<li class="mudo">Ileso.</li>'}</ul></section>
      <section class="bloco"><h2>Inventário</h2><ul class="lista-simples">${(c.inventario ?? []).map((x: Linha) => `<li>${esc(typeof x === 'string' ? x : `${x.nome}${x.qtd > 1 ? ` ×${x.qtd}` : ''}`)}</li>`).join('') || '<li class="mudo">Vazio.</li>'}</ul></section>
      <section class="bloco"><h2>Afinidades</h2><ul class="lista-simples">${Object.entries(c.afinidades ?? {}).map(([k, v]) => `<li>${esc(k)}: <strong>${esc(v)}</strong>/100</li>`).join('') || '<li class="mudo">Nenhum mestre por perto.</li>'}</ul></section>
      <section class="bloco"><h2>Conquistas</h2>${extras.conquistas.map((q) => `<span class="conquista">✦ ${esc(CONQUISTAS[q.chave] ?? q.chave)}</span>`).join('') || '<p class="mudo">Nenhuma ainda.</p>'}</section>
      ${f.aparencia || f.historia ? `<section class="bloco"><h2>Quem é</h2>${f.aparencia ? `<p>${esc(f.aparencia)}</p>` : ''}${f.personalidade ? `<p>${esc(f.personalidade)}</p>` : ''}${f.historia ? `<p class="mudo">${esc(f.historia).replace(/\n/g, '<br>')}</p>` : ''}</section>` : ''}
    </div>
  </div>`;
}

function acoesDono(c: Linha, envios: Linha[]) {
  const r = DADOS.reinos.find((x) => x.chave === c.reino)!;
  const podePedir = c.estagio === 'superior';
  return `<h2>Ações</h2>
    <div class="linha-flex">
      <a class="btn fantasma pequeno" href="${link(`/conta/leitura/?id=${c.id}`)}">Leitura do Destino (${c.leituras})</a>
      ${c.gargalo_liberado ? '<button class="btn pequeno" id="rolar-gargalo">Rolar o gargalo (3d6 oficial)</button>' : ''}
    </div>
    <div id="resultado-gargalo"></div>
    ${c.pa > 0 ? `<details class="painel"><summary><strong>Distribuir ${c.pa} PA</strong> (teto ${num(r.teto ?? 0)})</summary>
      <form id="form-pa" class="grade-campos cinco" style="margin-top:1rem">${ATRIBUTOS.map((k) => `<div class="campo"><label for="pa-${k}">${NOME_ATRIBUTO[k]}</label><input type="number" id="pa-${k}" data-attr="${k}" min="0" step="10" value="0" /></div>`).join('')}
      <button class="btn pequeno" type="submit">Aplicar</button></form></details>` : ''}
    <details class="painel" ${c.vivo ? 'open' : ''}><summary><strong>Enviar treino ou missão</strong></summary>
      <form id="form-envio" style="margin-top:1rem">
        <div class="grade-campos">
          <div class="campo"><label for="env-tipo">Tipo</label><select id="env-tipo">
            <option value="treino">Treino (80+ linhas)</option><option value="missao_facil">Missão fácil (40+)</option>
            <option value="missao_media">Missão média (60+)</option><option value="missao_dificil">Missão difícil (80+)</option>
            ${podePedir ? '<option value="pedido_avanco">Pedido de avanço (40+)</option>' : ''}</select></div>
          <div class="campo"><label for="env-titulo">Título</label><input id="env-titulo" required minlength="2" maxlength="120" /></div>
          <div class="campo"><label for="env-foco">Foco do treino</label><input id="env-foco" maxlength="120" placeholder="Ex.: Guarda da Nuvem Parada" /></div>
        </div>
        <div class="campo"><label for="env-texto">Texto (cole aqui)</label><textarea id="env-texto" rows="12" required></textarea>
          <p class="contagem-linhas" id="contagem" aria-live="polite">0 linhas</p></div>
        <button class="btn" type="submit">Enviar para a fila</button>
      </form>
    </details>
    <details class="painel"><summary><strong>Meus envios (${envios.length})</strong></summary>
      <div class="tabela-rolagem"><table class="tabela-mini"><thead><tr><th>Data</th><th>Tipo</th><th>Título</th><th>Linhas</th><th>Status</th><th>PE</th></tr></thead><tbody>
      ${envios.map((e) => `<tr><td>${data(e.criado_em)}</td><td>${esc(e.tipo.replace('_', ' '))}</td><td>${esc(e.titulo)}${e.nota_admin ? `<br><small class="mudo">${esc(e.nota_admin)}</small>` : ''}</td><td class="num">${e.linhas}</td><td>${esc(e.status)}</td><td class="num">${e.pe_concedido ?? '—'}</td></tr>`).join('') || '<tr><td colspan="6" class="mudo">Nenhum envio.</td></tr>'}
      </tbody></table></div>
    </details>`;
}

function ligarDono(c: Linha) {
  const minimo: Record<string, number> = { treino: 80, missao_facil: 40, missao_media: 60, missao_dificil: 80, pedido_avanco: 40 };
  const tipo = $('#env-tipo') as HTMLSelectElement | null;
  const texto = $('#env-texto') as HTMLTextAreaElement | null;
  const atualizar = () => {
    if (!tipo || !texto) return;
    const n = contarLinhas(texto.value), m = minimo[tipo.value];
    const el = $('#contagem');
    el.textContent = `${n} linhas de ${m} necessárias`;
    el.className = `contagem-linhas ${n >= m ? 'ok' : 'erro'}`;
    ($('#env-foco') as HTMLInputElement).closest('.campo')!.toggleAttribute('hidden', tipo.value !== 'treino');
  };
  tipo?.addEventListener('change', atualizar);
  texto?.addEventListener('input', atualizar);
  atualizar();
  document.querySelector('#form-envio')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const { error } = await supabase.rpc('enviar_texto', {
      p_personagem: c.id, p_tipo: tipo!.value, p_titulo: ($('#env-titulo') as HTMLInputElement).value,
      p_foco: ($('#env-foco') as HTMLInputElement).value, p_texto: texto!.value,
    });
    if (error) return toast(mensagemErro(error), true);
    toast('Enviado! Está na fila de aprovação.');
    setTimeout(() => location.reload(), 900);
  });
  document.querySelector('#form-pa')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const at: Record<string, number> = {};
    document.querySelectorAll<HTMLInputElement>('#form-pa input[data-attr]').forEach((i) => { if (Number(i.value) > 0) at[i.dataset.attr!] = Number(i.value); });
    const { error } = await supabase.rpc('distribuir_pa', { p_id: c.id, p_atributos: at });
    if (error) return toast(mensagemErro(error), true);
    toast('PA distribuído.');
    setTimeout(() => location.reload(), 800);
  });
  document.querySelector('#rolar-gargalo')?.addEventListener('click', async (ev) => {
    if (!confirm('Fazer a rolagem oficial do gargalo agora? Ela fica registrada e não pode ser refeita.')) return;
    (ev.target as HTMLButtonElement).disabled = true;
    try {
      const r = await jogo<Linha>('gargalo', { personagem: c.id });
      const desc = r.resultado === 'avanco' ? 'AVANÇOU!' : r.resultado === 'falha' ? 'Falhou sem dano. Tente de novo em 1 semana.' : `DESVIO DE QI: ${r.desvio?.nome} — ${r.desvio?.texto}`;
      $('#resultado-gargalo').innerHTML = `<div class="painel"><p class="rotulo">3d6 oficial</p><p style="font:400 2rem var(--f-display);margin:.3rem 0">${r.dados.join(' + ')} ${r.modificadores.total >= 0 ? '+' : '−'} ${Math.abs(r.modificadores.total)} = ${r.total}</p>
        <p><strong>${esc(desc)}</strong></p><ul>${r.modificadores.lista.map((m: Linha) => `<li>${esc(m.motivo)}: ${m.valor > 0 ? '+' : ''}${m.valor}</li>`).join('')}</ul>
        ${r.desvio ? `<p class="mudo">1d6 de Desvio: ${r.desvio.dados.join(', ')}</p>` : ''}<button class="btn pequeno" onclick="location.reload()">Atualizar ficha</button></div>`;
    } catch (e) { toast((e as Error).message, true); (ev.target as HTMLButtonElement).disabled = false; }
  });
}

export async function iniciarPerfil() {
  const id = param('id');
  const raiz = $('#perfil');
  const { data: c } = await supabase.from('personagens').select('*').eq('id', id).maybeSingle();
  if (!c) { raiz.innerHTML = '<h1>Personagem não encontrado</h1><p>Ele pode ainda não ter sido aprovado, ou o link está errado.</p>'; return; }
  const s = await sessao();
  const dono = s?.user.id === c.dono;
  const [{ data: diario }, { data: conquistas }, envios] = await Promise.all([
    supabase.from('diario').select('*').eq('personagem', c.id).order('criado_em', { ascending: false }).limit(60),
    supabase.from('conquistas').select('*').eq('personagem', c.id),
    dono ? supabase.from('envios').select('id, tipo, titulo, linhas, status, pe_concedido, nota_admin, criado_em').eq('personagem', c.id).order('criado_em', { ascending: false }) : Promise.resolve({ data: [] }),
  ]);
  document.title = `${c.nome} · Murim: Céu Partido`;
  raiz.classList.toggle('morto', !c.vivo);
  raiz.innerHTML = htmlPerfil(c, dono, { diario: diario ?? [], conquistas: conquistas ?? [], envios: envios.data ?? [] });
  if (dono && c.status === 'aprovada' && c.vivo) { $('#acoes').innerHTML = acoesDono(c, envios.data ?? []); ligarDono(c); }
  else if (dono) $('#acoes').innerHTML = `<p class="nota">Ficha ${esc(nomes.status(c.status).toLowerCase())}. <a href="${link(`/conta/ficha/?id=${c.id}`)}">Abrir no criador</a></p>`;
  $('#copiar-link').onclick = () => copiar(location.href, 'Link copiado.');
  $('#copiar-ficha').onclick = () => copiar(textoFicha(c));
  $('#gerar-cartao').onclick = async () => (await import('./cartao')).baixarCartao(c);
}
