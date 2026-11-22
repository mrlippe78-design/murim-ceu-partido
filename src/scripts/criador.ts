// Criador de ficha passo a passo, com validação ao vivo e rascunho salvo automaticamente.
import { supabase, exigirLogin, toast, copiar, jogo, esc, link, nomes, mensagemErro, adiar, param, $, $$, ROTULO_RARIDADE } from './app';
import {
  DADOS, ATRIBUTOS, NOME_ATRIBUTO, validarFicha, pontosTalento, tetosCriacao, derivados, avaliarTecnica, limiteTecnica,
  origem as infoOrigem, seita as infoSeita, type Ficha, type Tecnica, type Atributo,
} from '../../supabase/functions/_shared/regras';
import { textoFicha } from '../lib/textos';

type Linha = Record<string, any>;
let p: Linha;
let ficha: Ficha;
let passo = 0;
let editavel = true;
let outrasFaccoes: string[] = [];
let pendentes: Linha[] = [];
const TOTAL = 8;

const tecnicaVazia = (): Tecnica => ({ nome: '', grau: 'basica', tipo: 'externa', distribuicao: {}, custoQi: 80, recarga: 1, defensiva: false, descricao: '' });

function normalizar(f: Ficha): Ficha {
  return {
    talentos: { vantagens: [], desvantagens: [], ...(f.talentos ?? {}) },
    atributos: { forca: 1000, agilidade: 1000, resistencia: 1000, precisao: 1000, vigor: 1000, ...(f.atributos ?? {}) },
    tecnicas: f.tecnicas?.length ? f.tecnicas : [tecnicaVazia(), tecnicaVazia(), tecnicaVazia()],
    arteInterna: { nome: '', natureza: '', passiva: '', ...(f.arteInterna ?? {}) },
    arma: { nome: '', tipo: 'comum', ...(f.arma ?? {}) },
    ...f,
  } as Ficha;
}

// ───────── salvar ─────────
const salvarAgora = async () => {
  if (!editavel) return;
  $('#salvo').textContent = 'Salvando…';
  const { error } = await supabase.from('personagens').update({ ficha, nome: p.nome }).eq('id', p.id);
  if (error) { $('#salvo').textContent = 'Não salvou.'; toast(mensagemErro(error), true); return; }
  $('#salvo').textContent = `Rascunho salvo às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
};
const salvar = adiar(salvarAgora, 700);
function mudou() { atualizarResumo(); salvar(); }

// ───────── resumo lateral ─────────
function validar() {
  return validarFicha(ficha, { corpo: p.corpo, linhagemRara: p.linhagem_rara, sorteUsada: p.sorte_usada, outrasFaccoes });
}
function atualizarResumo() {
  const d = derivados(ficha, p.corpo, p.linhagem_rara);
  const t = pontosTalento(ficha, p.corpo);
  const soma = ATRIBUTOS.reduce((a, k) => a + Number(ficha.atributos?.[k] ?? 0), 0);
  const linhas: [string, string][] = [
    ['Linhagem', nomes.linhagem(ficha.linhagem)],
    ['Origem', nomes.origem(ficha.origem)],
    ['Seita', nomes.seita(ficha.seita)],
    ['Talentos', `${t.gastos} / ${t.disponiveis} pts`],
    ['Atributos', `${soma} / ${DADOS.criacao.pontos}`],
    ['Vida', d.vida.toLocaleString('pt-BR')],
    ['Qi', `${d.qiMax.toLocaleString('pt-BR')} (${d.anosEnergia} anos)`],
    ['Corpo', nomes.corpo(p.corpo)],
    ['Raiz', nomes.raiz(p.raiz)],
    ['Leituras', String(p.leituras)],
  ];
  $('#resumo').innerHTML = linhas.map(([a, b]) => `<dt>${a}</dt><dd>${esc(b)}</dd>`).join('');
  const v = validar();
  $('#erros-lateral').innerHTML = v.erros.length ? `<strong>Falta resolver (${v.erros.length})</strong><ul>${v.erros.slice(0, 6).map((e) => `<li>${esc(e)}</li>`).join('')}</ul>` : '';
  marcarPassos(v.erros);
}
function marcarPassos(erros: string[]) {
  const tem = (re: RegExp) => erros.some((e) => re.test(e));
  const feitos = [
    !tem(/linhagem/i), !tem(/origem/i), !tem(/facç|seita/i), !tem(/talento|desvantagem|pontos, mas/i),
    !tem(/Força|Agilidade|Resistência|Precisão|Vigor|atributo/i), !tem(/Técnica|Arte Interna|arma/i), pendentes.length === 0, erros.length === 0,
  ];
  $$('.passos button').forEach((b, i) => b.classList.toggle('feito', feitos[i]));
}

// ───────── passos ─────────
const opcao = (tipo: 'radio' | 'checkbox', nome: string, valor: string, marcado: boolean, titulo: string, det: string, extra = '', desabilitado = false) =>
  `<label class="opcao"><input type="${tipo}" name="${nome}" value="${esc(valor)}" ${marcado ? 'checked' : ''} ${desabilitado || !editavel ? 'disabled' : ''} />
    <strong>${esc(titulo)}</strong><span class="det">${det}</span>${extra}</label>`;

const render: Array<() => string> = [
  // 1. Linhagem
  () => `<h2>1. Linhagem</h2><p class="mudo">De onde vem o seu sangue. As linhagens raras só aparecem pela Leitura do Destino e se somam a esta.</p>
    <div class="opcoes duas">${DADOS.linhagens.filter((l) => l.livre).map((l) => opcao('radio', 'linhagem', l.chave, ficha.linhagem === l.chave, l.nome, `${esc(l.texto)}<br><em>${esc(l.desvantagem)}</em>`)).join('')}</div>
    ${p.linhagem_rara ? `<p class="nota">Linhagem rara (Leitura do Destino): <strong>${esc(nomes.linhagem(p.linhagem_rara))}</strong></p>` : ''}`,
  // 2. Origem
  () => `<h2>2. Origem</h2><p class="mudo">O que você era antes da história começar.</p>
    <div class="opcoes">${DADOS.origens.map((o) => {
      const fs = (o as { faccoes?: string[] }).faccoes;
      return opcao('radio', 'origem', o.chave, ficha.origem === o.chave, o.nome, `${esc(o.texto)}<br><em>${esc(o.obrigacao)}</em>${fs ? `<br><small class="ouro">Exige: ${fs.map((f) => esc(nomes.faccao(f))).join(' ou ')}</small>` : ''}`);
    }).join('')}</div>`,
  // 3. Facção e seita
  () => `<h2>3. Facção e seita</h2><p class="mudo">A quem você deve lealdade. Cada seita tem uma vantagem e uma obrigação. <a href="${link('/biblioteca/faccoes/alianca/')}" target="_blank" rel="noopener">Ler sobre as facções</a></p>
    ${outrasFaccoes.length ? `<p class="nota">Seu outro personagem é da facção <strong>${esc(outrasFaccoes.map((f) => nomes.faccao(f)).join(', '))}</strong>: escolha outra.</p>` : ''}
    <div class="opcoes duas">${DADOS.faccoes.map((f) => opcao('radio', 'faccao', f.chave, ficha.faccao === f.chave, `${f.ideograma}  ${f.nome}`, `${f.seitas.length} seitas`, '', outrasFaccoes.includes(f.chave))).join('')}</div>
    ${ficha.faccao ? `<h3>Seita</h3><div class="opcoes">${DADOS.faccoes.find((f) => f.chave === ficha.faccao)!.seitas.map((s) => opcao('radio', 'seita', s.chave, ficha.seita === s.chave, s.nome, `<strong class="ok" style="font:inherit;display:inline">Vantagem:</strong> ${esc(s.vantagem)}<br><strong class="erro" style="font:inherit;display:inline">Obrigação:</strong> ${esc(s.obrigacao)}`)).join('')}</div>` : ''}`,
  // 4. Talentos
  () => {
    const t = pontosTalento(ficha, p.corpo);
    const vs = ficha.talentos!.vantagens, ds = ficha.talentos!.desvantagens;
    return `<h2>4. Talentos</h2><p class="mudo">Vantagens custam pontos; desvantagens dão pontos (no máximo ${DADOS.talentos.maxPontosDesvantagem}). Pelo menos 1 desvantagem é obrigatória.</p>
      <div class="contador" aria-live="polite"><span>Base<strong>${t.base}</strong></span><span>Desvantagens<strong>+${t.ganhos}</strong></span><span>Gastos<strong>${t.gastos}</strong></span><span>Sobra<strong class="${t.sobra < 0 ? 'erro' : 'ok'}">${t.sobra}</strong></span></div>
      <h3>Vantagens</h3><div class="opcoes duas">${DADOS.talentos.vantagens.map((v) => opcao('checkbox', 'vantagem', v.chave, vs.includes(v.chave), v.nome, esc(v.texto), `<span class="custo">${v.custo} pt</span>`, v.chave === 'sorte_do_ceu' && p.sorte_usada)).join('')}</div>
      <h3>Desvantagens</h3><div class="opcoes duas">${DADOS.talentos.desvantagens.map((v) => opcao('checkbox', 'desvantagem', v.chave, ds.includes(v.chave), v.nome, esc(v.texto), `<span class="custo">+${v.pontos} pt</span>`)).join('')}</div>`;
  },
  // 5. Atributos
  () => {
    const tetos = tetosCriacao(ficha);
    const d = derivados(ficha, p.corpo, p.linhagem_rara);
    const soma = ATRIBUTOS.reduce((a, k) => a + Number(ficha.atributos?.[k] ?? 0), 0);
    const resta = DADOS.criacao.pontos - soma;
    return `<h2>5. Atributos</h2><p class="mudo">Distribua exatamente ${DADOS.criacao.pontos} pontos (mínimo ${DADOS.criacao.minimo}, máximo indicado em cada um). Bônus de linhagem e corpo entram depois. <a href="${link('/biblioteca/personagem/atributos/')}" target="_blank" rel="noopener">O que cada atributo faz</a></p>
      <div class="contador" aria-live="polite"><span>Restam<strong class="${resta === 0 ? 'ok' : 'erro'}">${resta}</strong></span><span>Vida<strong>${d.vida.toLocaleString('pt-BR')}</strong></span><span>Qi<strong>${d.qiMax.toLocaleString('pt-BR')}</strong></span></div>
      ${ATRIBUTOS.map((k) => `<div class="attr-linha">
        <label for="a-${k}">${NOME_ATRIBUTO[k]}</label>
        <div class="attr-ctrl"><button type="button" data-delta="-50" data-attr="${k}" aria-label="Diminuir ${NOME_ATRIBUTO[k]}" ${editavel ? '' : 'disabled'}>−</button>
          <input type="number" id="a-${k}" data-attr="${k}" min="${DADOS.criacao.minimo}" max="${tetos[k]}" step="10" value="${ficha.atributos?.[k] ?? 0}" ${editavel ? '' : 'disabled'} />
          <button type="button" data-delta="50" data-attr="${k}" aria-label="Aumentar ${NOME_ATRIBUTO[k]}" ${editavel ? '' : 'disabled'}>+</button></div>
        <input type="range" data-attr="${k}" min="${DADOS.criacao.minimo}" max="${tetos[k]}" step="10" value="${ficha.atributos?.[k] ?? 0}" aria-label="${NOME_ATRIBUTO[k]} (controle deslizante)" ${editavel ? '' : 'disabled'} />
        <span class="final">Máximo ${tetos[k]} · valor final com bônus: <strong>${d.atributos[k].toLocaleString('pt-BR')}</strong></span>
      </div>`).join('')}`;
  },
  // 6. Artes
  () => {
    const ori = infoOrigem(ficha.origem) as { tecnicaExtra?: number } | undefined;
    const maxTec = DADOS.criacao.tecnicasBasicas + (ori?.tecnicaExtra ?? 0) + (infoSeita(ficha.seita)?.tecnicaExtra ?? 0);
    const tipos = DADOS.tiposArte.filter((t) => t.chave !== 'interna' && t.chave !== 'movimento' && (t.chave !== 'demoniaca' || ficha.faccao === 'culto' || ficha.origem === 'culto'));
    const naturezas = Object.entries(DADOS.elementos).filter(([k]) => k !== 'sangue' || ['culto', 'heterodoxa'].includes(ficha.faccao ?? ''));
    const ai = ficha.arteInterna!;
    const dis = editavel ? '' : 'disabled';
    return `<h2>6. Arte Interna e técnicas</h2><p class="mudo">Uma Arte Interna e ${DADOS.criacao.tecnicasBasicas} técnicas Básicas${maxTec > 3 ? ` (+${maxTec - 3} pela origem/seita)` : ''}. Básica: +300 de bônus (defensiva +20%, demoníaca +30%), Qi 60–100, recarga 1. <a href="${link('/biblioteca/artes/criando-tecnicas/')}" target="_blank" rel="noopener">Como criar técnicas</a></p>
      <div class="tecnica-bloco"><h3>Arte Interna</h3><div class="grade-campos">
        <div class="campo"><label for="ai-nome">Nome</label><input id="ai-nome" data-ai="nome" value="${esc(ai.nome)}" maxlength="80" ${dis} /></div>
        <div class="campo"><label for="ai-nat">Natureza do Qi</label><select id="ai-nat" data-ai="natureza" ${dis}><option value="">Escolha…</option>${naturezas.map(([k, n]) => `<option value="${k}" ${ai.natureza === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
        <div class="campo"><label for="ai-pas">Efeito passivo</label><input id="ai-pas" data-ai="passiva" value="${esc(ai.passiva)}" maxlength="200" placeholder="Ex.: +10% de recuperação em meditação" ${dis} /></div>
      </div></div>
      ${ficha.tecnicas!.map((t, i) => {
        const a = avaliarTecnica(t, 'terceira');
        const lim = limiteTecnica(t);
        return `<div class="tecnica-bloco" data-tec="${i}"><h3>Técnica ${i + 1}</h3>
          <div class="grade-campos">
            <div class="campo"><label for="t${i}-nome">Nome</label><input id="t${i}-nome" data-t="nome" value="${esc(t.nome)}" maxlength="80" ${dis} /></div>
            <div class="campo"><label for="t${i}-tipo">Tipo</label><select id="t${i}-tipo" data-t="tipo" ${dis}>${tipos.map((x) => `<option value="${x.chave}" ${t.tipo === x.chave ? 'selected' : ''}>${x.nome}</option>`).join('')}</select></div>
            <label class="opcao" style="padding:1rem 1rem 1rem 3rem;align-self:end"><input type="checkbox" data-t="defensiva" ${t.defensiva ? 'checked' : ''} ${dis} /><strong style="font-size:1rem">Defensiva</strong><span class="det">+20% de orçamento</span></label>
          </div>
          <p class="rotulo ouro">Bônus: ${a.usado} de ${lim}</p>
          <div class="barra ${a.usado > lim ? 'estourou' : ''}"><span style="width:${Math.min(100, (a.usado / Math.max(1, lim)) * 100)}%"></span></div>
          <div class="grade-campos cinco">${ATRIBUTOS.map((k) => `<div class="campo"><label for="t${i}-${k}">${NOME_ATRIBUTO[k]}</label><input type="number" id="t${i}-${k}" data-dist="${k}" min="0" step="10" value="${t.distribuicao?.[k] ?? ''}" ${dis} /></div>`).join('')}</div>
          <div class="grade-campos">
            <div class="campo"><label for="t${i}-qi">Custo de Qi (60–100)</label><input type="number" id="t${i}-qi" data-t="custoQi" min="60" max="100" value="${t.custoQi}" ${dis} /></div>
            <div class="campo"><label for="t${i}-rec">Recarga (turnos)</label><input type="number" id="t${i}-rec" data-t="recarga" min="1" max="4" value="${t.recarga}" ${dis} /></div>
            <div class="campo"><label for="t${i}-desc">Descrição curta</label><input id="t${i}-desc" data-t="descricao" value="${esc(t.descricao ?? '')}" maxlength="240" ${dis} /></div>
          </div>
          ${a.erros.length && t.nome ? `<ul class="lista-erros">${a.erros.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>` : ''}
          ${ficha.tecnicas!.length > DADOS.criacao.tecnicasBasicas && editavel ? `<button type="button" class="btn fantasma pequeno" data-remover="${i}">Remover técnica</button>` : ''}
        </div>`;
      }).join('')}
      ${ficha.tecnicas!.length < maxTec && editavel ? `<button type="button" class="btn fantasma" id="add-tec">+ Técnica extra</button>` : ''}
      <div class="tecnica-bloco"><h3>Arma</h3><div class="campo"><label for="arma">Arma Comum (ou "punhos")</label><input id="arma" value="${esc(ficha.arma?.nome ?? '')}" maxlength="80" placeholder="Ex.: espada de ferro do pai" ${dis} /></div></div>`;
  },
  // 7. Destino
  () => {
    const liberada = p.leitura_liberada_em ? new Date(p.leitura_liberada_em) : null;
    return `<h2>7. Leitura do Destino</h2><p class="mudo">O sorteio acontece no servidor e não pode ser refeito. Escolha antes o que ler: Corpo Marcial, Raiz de Qi ou Linhagem rara. <a href="${link('/biblioteca/personagem/leitura-do-destino/')}" target="_blank" rel="noopener">Probabilidades</a></p>
      <div class="resultado-destino">
        <div class="painel"><span>Corpo Marcial</span><strong class="r-${nomes.raridadeCorpo(p.corpo)}"><span class="raridade">${esc(ROTULO_RARIDADE[nomes.raridadeCorpo(p.corpo)])}</span> ${esc(nomes.corpo(p.corpo))}</strong></div>
        <div class="painel"><span>Raiz de Qi</span><strong>${esc(nomes.raiz(p.raiz))}</strong></div>
        <div class="painel"><span>Linhagem rara</span><strong>${esc(p.linhagem_rara ? nomes.linhagem(p.linhagem_rara) : 'Nenhuma')}</strong></div>
        <div class="painel"><span>Fios do Destino</span><strong>${p.fios} / 40</strong></div>
      </div>
      ${pendentes.map((l) => `<div class="nota">Você tirou <strong>${esc(l.detalhes?.nome ?? l.resultado)}</strong> (${esc(l.tipo)}). Qual manter?
        <div class="linha-flex" style="margin-top:.6rem"><button class="btn pequeno" data-escolha="${l.id}" data-novo="1">Manter o novo</button><button class="btn fantasma pequeno" data-escolha="${l.id}" data-novo="0">Manter o atual</button></div></div>`).join('')}
      <p style="margin-top:1.5rem">Leituras disponíveis: <strong class="numero">${p.leituras}</strong>
        ${p.leituras === 0 && liberada ? `<br><span class="mudo">A Leitura de criação será liberada em ${liberada.toLocaleDateString('pt-BR')}.</span>` : ''}
        ${p.leituras === 0 && !p.sorte_usada && ficha.talentos?.vantagens.includes('sorte_do_ceu') ? '<br><span class="ok">Sorte do Céu: você tem uma Leitura extra esperando.</span>' : ''}</p>
      <a class="btn" href="${link(`/conta/leitura/?id=${p.id}`)}">Ir para a Leitura do Destino</a>`;
  },
  // 8. Ficha final
  () => {
    const v = validar();
    const dis = editavel ? '' : 'disabled';
    return `<h2>8. Ficha final</h2>
      ${p.status === 'recusada' ? `<div class="lista-erros"><strong>Ficha recusada:</strong> ${esc(p.motivo_recusa ?? '')}</div>` : ''}
      <div class="grade-campos">
        <div class="campo"><label for="f-nome">Nome do personagem</label><input id="f-nome" value="${esc(p.nome)}" maxlength="60" ${dis} /></div>
        <div class="campo"><label for="f-idade">Idade (16–35)</label><input id="f-idade" type="number" min="16" max="35" value="${ficha.idade ?? ''}" ${dis} /></div>
      </div>
      <div class="campo"><label for="f-apar">Aparência</label><textarea id="f-apar" data-f="aparencia" rows="3" maxlength="1500" ${dis}>${esc(ficha.aparencia ?? '')}</textarea></div>
      <div class="campo"><label for="f-pers">Personalidade</label><textarea id="f-pers" data-f="personalidade" rows="3" maxlength="1500" ${dis}>${esc(ficha.personalidade ?? '')}</textarea></div>
      <div class="campo"><label for="f-hist">História</label><textarea id="f-hist" data-f="historia" rows="8" maxlength="8000" ${dis}>${esc(ficha.historia ?? '')}</textarea><p class="ajuda">Inclua quem caça você, a quem deve e o que teme, se escolheu essas desvantagens.</p></div>
      ${v.erros.length ? `<div class="lista-erros"><strong>Antes de enviar:</strong><ul>${v.erros.map((e) => `<li>${esc(e)}</li>`).join('')}</ul></div>` : '<p class="ok">Tudo certo com as regras. Pode enviar.</p>'}
      ${v.avisos.map((a) => `<p class="nota">${esc(a)}</p>`).join('')}
      <h3>Prévia no formato do WhatsApp</h3>
      <pre class="texto-pronto" id="previa">${esc(textoFicha(p as never))}</pre>
      <div class="linha-flex" style="margin-top:1rem">
        <button type="button" class="btn fantasma" id="copiar-ficha">Copiar para o WhatsApp</button>
        ${editavel ? `<button type="button" class="btn" id="enviar-ficha" ${v.erros.length ? 'aria-disabled="true"' : ''}>Enviar para aprovação</button>` : `<span class="mudo">Status: ${esc(nomes.status(p.status))}</span>`}
        ${editavel ? `<button type="button" class="btn fantasma pequeno" id="apagar">Apagar personagem</button>` : ''}
      </div>`;
  },
];

function irPara(n: number) {
  passo = Math.max(0, Math.min(TOTAL - 1, n));
  $('#palco').innerHTML = render[passo]();
  $$('.passos button').forEach((b, i) => { if (i === passo) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
  ($('#anterior') as HTMLButtonElement).disabled = passo === 0;
  $('#proximo').textContent = passo === TOTAL - 1 ? 'Voltar ao início' : 'Próximo →';
  history.replaceState(null, '', `?id=${p.id}&passo=${passo + 1}`);
  ligar();
  atualizarResumo();
}

function rerender() {
  const foco = document.activeElement as HTMLElement | null;
  const id = foco?.id;
  const pos = (foco as HTMLInputElement | null)?.selectionStart;
  $('#palco').innerHTML = render[passo]();
  ligar();
  atualizarResumo();
  if (id) {
    const el = document.getElementById(id) as HTMLInputElement | null;
    el?.focus();
    if (el && pos !== null && pos !== undefined && 'setSelectionRange' in el && el.type !== 'number') try { el.setSelectionRange(pos, pos); } catch { /* */ }
  }
}

function ligar() {
  const palco = $('#palco');
  palco.querySelectorAll<HTMLInputElement>('input[name="linhagem"]').forEach((i) => i.onchange = () => { ficha.linhagem = i.value; mudou(); });
  palco.querySelectorAll<HTMLInputElement>('input[name="origem"]').forEach((i) => i.onchange = () => { ficha.origem = i.value; mudou(); });
  palco.querySelectorAll<HTMLInputElement>('input[name="faccao"]').forEach((i) => i.onchange = () => { ficha.faccao = i.value; ficha.seita = undefined; mudou(); rerender(); });
  palco.querySelectorAll<HTMLInputElement>('input[name="seita"]').forEach((i) => i.onchange = () => { ficha.seita = i.value; mudou(); });
  palco.querySelectorAll<HTMLInputElement>('input[name="vantagem"], input[name="desvantagem"]').forEach((i) => i.onchange = () => {
    const lista = i.name === 'vantagem' ? ficha.talentos!.vantagens : ficha.talentos!.desvantagens;
    const ix = lista.indexOf(i.value);
    if (i.checked && ix < 0) lista.push(i.value);
    if (!i.checked && ix >= 0) lista.splice(ix, 1);
    mudou(); rerender();
  });
  // atributos
  const setAttr = (k: Atributo, v: number) => { ficha.atributos![k] = Math.round(v); mudou(); rerender(); };
  palco.querySelectorAll<HTMLInputElement>('input[data-attr]').forEach((i) => {
    i.onchange = () => setAttr(i.dataset.attr as Atributo, Number(i.value));
    if (i.type === 'range') i.oninput = () => setAttr(i.dataset.attr as Atributo, Number(i.value));
  });
  palco.querySelectorAll<HTMLButtonElement>('button[data-delta]').forEach((b) => b.onclick = () => {
    const k = b.dataset.attr as Atributo;
    setAttr(k, Number(ficha.atributos![k] ?? 0) + Number(b.dataset.delta));
  });
  // arte interna e técnicas
  palco.querySelectorAll<HTMLInputElement>('[data-ai]').forEach((i) => i.oninput = i.onchange = () => { (ficha.arteInterna as Record<string, string>)[i.dataset.ai!] = i.value; mudou(); });
  palco.querySelectorAll<HTMLElement>('[data-tec]').forEach((bloco) => {
    const t = ficha.tecnicas![Number(bloco.dataset.tec)];
    bloco.querySelectorAll<HTMLInputElement>('[data-t]').forEach((i) => {
      const k = i.dataset.t as keyof Tecnica;
      const ev = () => {
        const v = i.type === 'checkbox' ? i.checked : i.type === 'number' ? Number(i.value) : i.value;
        (t as unknown as Record<string, unknown>)[k] = v;
        mudou();
      };
      i.oninput = ev;
      i.onchange = () => { ev(); rerender(); };
    });
    bloco.querySelectorAll<HTMLInputElement>('[data-dist]').forEach((i) => {
      i.onchange = () => { t.distribuicao[i.dataset.dist as Atributo] = Number(i.value) || 0; mudou(); rerender(); };
    });
  });
  palco.querySelectorAll<HTMLButtonElement>('[data-remover]').forEach((b) => b.onclick = () => { ficha.tecnicas!.splice(Number(b.dataset.remover), 1); mudou(); rerender(); });
  const add = palco.querySelector<HTMLButtonElement>('#add-tec');
  if (add) add.onclick = () => { ficha.tecnicas!.push(tecnicaVazia()); mudou(); rerender(); };
  const arma = palco.querySelector<HTMLInputElement>('#arma');
  if (arma) arma.oninput = () => { ficha.arma = { nome: arma.value, tipo: 'comum' }; mudou(); };
  // destino
  palco.querySelectorAll<HTMLButtonElement>('[data-escolha]').forEach((b) => b.onclick = async () => {
    const { error } = await supabase.rpc('escolher_leitura', { p_leitura: Number(b.dataset.escolha), p_manter_novo: b.dataset.novo === '1' });
    if (error) return toast(mensagemErro(error), true);
    toast('Escolha registrada.');
    await carregar();
    irPara(passo);
  });
  // ficha final
  const fn = palco.querySelector<HTMLInputElement>('#f-nome');
  if (fn) fn.oninput = () => { p.nome = fn.value.trim() || p.nome; $('#nome-personagem').textContent = p.nome; mudou(); };
  const fi = palco.querySelector<HTMLInputElement>('#f-idade');
  if (fi) fi.oninput = () => { ficha.idade = Number(fi.value); mudou(); };
  palco.querySelectorAll<HTMLTextAreaElement>('[data-f]').forEach((t) => t.oninput = () => { (ficha as Record<string, unknown>)[t.dataset.f!] = t.value; mudou(); });
  palco.querySelector('#copiar-ficha')?.addEventListener('click', () => copiar(textoFicha(p as never)));
  palco.querySelector('#enviar-ficha')?.addEventListener('click', enviar);
  palco.querySelector('#apagar')?.addEventListener('click', apagar);
}

async function enviar() {
  const v = validar();
  if (v.erros.length) return toast(`Ainda há ${v.erros.length} pendência(s) na ficha.`, true);
  await salvarAgora();
  try {
    const r = await jogo<{ ok: boolean; erros?: string[] }>('enviar_ficha', { personagem: p.id });
    if (!r.ok) return toast(r.erros?.[0] ?? 'A ficha não passou na validação do servidor.', true);
    toast('Ficha enviada! A administração vai avaliar.');
    setTimeout(() => (location.href = link('/conta/')), 1200);
  } catch (e) { toast((e as Error).message, true); }
}

async function apagar() {
  if (!confirm(`Apagar ${p.nome}? A Leitura do Destino NÃO volta, e um novo personagem nos próximos 30 dias só recebe a Leitura de criação depois do prazo.`)) return;
  const { error } = await supabase.rpc('excluir_personagem', { p_id: p.id });
  if (error) return toast(mensagemErro(error), true);
  location.href = link('/conta/');
}

async function carregar() {
  const id = param('id');
  const { data, error } = await supabase.from('personagens').select('*').eq('id', id).single();
  if (error || !data) { $('#palco').innerHTML = '<p class="erro">Personagem não encontrado.</p>'; throw new Error('nf'); }
  p = data;
  ficha = normalizar(p.ficha ?? {});
  p.ficha = ficha;
  editavel = ['rascunho', 'recusada'].includes(p.status) && p.vivo;
  const { data: outros } = await supabase.from('personagens').select('faccao, ficha').eq('dono', p.dono).is('excluido_em', null).eq('vivo', true).neq('id', p.id);
  outrasFaccoes = (outros ?? []).map((o) => o.faccao ?? o.ficha?.faccao).filter(Boolean);
  const { data: lei } = await supabase.from('leituras').select('*, escolhas_leitura(leitura)').eq('personagem', p.id).eq('precisa_escolha', true);
  pendentes = (lei ?? []).filter((l) => !l.escolhas_leitura?.length);
}

export async function iniciarCriador() {
  await exigirLogin();
  await carregar();
  $('#nome-personagem').textContent = p.nome;
  $('#salvo').textContent = editavel ? 'Rascunho salvo automaticamente.' : `Ficha ${nomes.status(p.status).toLowerCase()}: somente leitura.`;
  $$('.passos button').forEach((b) => b.onclick = () => irPara(Number(b.dataset.passo)));
  $('#anterior').onclick = () => { irPara(passo - 1); $('#palco').focus(); };
  $('#proximo').onclick = () => { irPara(passo === TOTAL - 1 ? 0 : passo + 1); $('#palco').focus(); window.scrollTo({ top: 0 }); };
  irPara(Number(param('passo') ?? 1) - 1);
}
