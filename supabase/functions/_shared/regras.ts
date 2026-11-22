// Regras de Murim: Céu Partido — lógica pura, compartilhada entre o site e o servidor.
import dados from './dados.json' with { type: 'json' };

export const DADOS = dados;
export type Atributo = 'forca' | 'agilidade' | 'resistencia' | 'precisao' | 'vigor';
export const ATRIBUTOS: Atributo[] = ['forca', 'agilidade', 'resistencia', 'precisao', 'vigor'];
export const NOME_ATRIBUTO: Record<Atributo, string> = {
  forca: 'Força', agilidade: 'Agilidade', resistencia: 'Resistência', precisao: 'Precisão', vigor: 'Vigor',
};

export interface Tecnica {
  nome: string;
  grau: string; // basica | intermediaria | avancada | suprema | lendaria
  tipo: string; // externa | movimento | oculta | medicinal | demoniaca
  distribuicao: Partial<Record<Atributo, number>>;
  custoQi: number;
  recarga: number;
  defensiva?: boolean;
  efeitos?: string;
  descricao?: string;
}

export interface Ficha {
  linhagem?: string;
  origem?: string;
  faccao?: string;
  seita?: string;
  idade?: number;
  talentos?: { vantagens: string[]; desvantagens: string[] };
  atributos?: Partial<Record<Atributo, number>>;
  arteInterna?: { nome: string; natureza: string; passiva: string };
  tecnicas?: Tecnica[];
  arma?: { nome: string; tipo: string };
  aparencia?: string;
  personalidade?: string;
  historia?: string;
}

export interface Contexto {
  corpo: string;
  linhagemRara?: string | null;
  sorteUsada?: boolean;
  /** facções dos outros personagens ativos do mesmo jogador */
  outrasFaccoes?: string[];
  reino?: string;
}

const buscar = <T extends { chave: string }>(xs: T[], k?: string | null) => xs.find((x) => x.chave === k);
export const grau = (k: string) => buscar(dados.graus, k);
export const corpo = (k: string) => buscar(dados.corpos, k);
export const linhagem = (k?: string | null) => buscar(dados.linhagens, k);
export const origem = (k?: string | null) => buscar(dados.origens, k);
export const faccao = (k?: string | null) => buscar(dados.faccoes, k);
export const seita = (k?: string | null) => {
  for (const f of dados.faccoes) {
    const s = f.seitas.find((x) => x.chave === k);
    if (s) return { ...s, faccao: f.chave } as typeof s & { faccao: string; tetos?: Record<string, number>; corrupcao?: number; infamia?: number; taeisMax?: number; tecnicaExtra?: number };
  }
  return undefined;
};
export const vantagem = (k: string) => buscar(dados.talentos.vantagens, k);
export const desvantagem = (k: string) => buscar(dados.talentos.desvantagens, k);
export const reino = (k: string) => buscar(dados.reinos, k);
export const indiceReino = (k: string) => dados.reinos.findIndex((r) => r.chave === k);

// ───────────────────────── Técnicas ─────────────────────────
export interface AvaliacaoTecnica {
  ok: boolean;
  erros: string[];
  usado: number;
  limite: number;
  texto: string;
}

export function limiteTecnica(t: Pick<Tecnica, 'grau' | 'tipo' | 'defensiva'>): number {
  const g = grau(t.grau);
  if (!g) return 0;
  let mult = 1;
  if (t.defensiva) mult += 0.2;
  if (t.tipo === 'demoniaca') mult += 0.3;
  return Math.round(g.bonus * mult);
}

export function avaliarTecnica(t: Tecnica, reinoAtual = 'terceira'): AvaliacaoTecnica {
  const erros: string[] = [];
  const g = grau(t.grau);
  if (!g) return { ok: false, erros: ['Grau inválido.'], usado: 0, limite: 0, texto: '' };
  const limite = limiteTecnica(t);
  const usado = ATRIBUTOS.reduce((a, k) => a + Math.max(0, Number(t.distribuicao?.[k] ?? 0)), 0);
  for (const k of ATRIBUTOS) if (Number(t.distribuicao?.[k] ?? 0) < 0) erros.push(`${NOME_ATRIBUTO[k]} não pode ser negativo.`);
  if (!t.nome?.trim()) erros.push('Dê um nome à técnica.');
  if (usado > limite) erros.push(`Passou do orçamento: ${usado} de ${limite} pontos de bônus.`);
  if (usado === 0) erros.push('Distribua o bônus em pelo menos um atributo.');
  if (t.custoQi < g.qiMin || t.custoQi > g.qiMax) erros.push(`Custo de Qi de uma técnica ${g.nome} vai de ${g.qiMin} a ${g.qiMax}.`);
  if (t.recarga < g.recarga) erros.push(`A recarga mínima de uma técnica ${g.nome} é ${g.recarga}.`);
  if (t.tipo === 'movimento' && indiceReino(reinoAtual) < indiceReino('segunda')) erros.push('Técnicas de Movimento só a partir da Segunda Classe.');
  if (t.grau === 'lendaria') erros.push('Técnicas Lendárias são criadas junto com a administração (1 por personagem).');
  if (t.tipo === 'interna') erros.push('A Arte Interna é registrada à parte, não como técnica.');
  return { ok: erros.length === 0, erros, usado, limite, texto: textoTecnica(t, limite) };
}

export function textoTecnica(t: Tecnica, limite = limiteTecnica(t)): string {
  const g = grau(t.grau);
  const tipo = dados.tiposArte.find((x) => x.chave === t.tipo)?.nome ?? t.tipo;
  const dist = ATRIBUTOS.filter((k) => Number(t.distribuicao?.[k] ?? 0) > 0)
    .map((k) => `+${t.distribuicao[k]} ${NOME_ATRIBUTO[k]}`).join(', ');
  const linhas = [
    `*【${t.nome || 'Técnica sem nome'}】*`,
    `_${tipo} · ${g?.nome ?? t.grau}${t.defensiva ? ' · Defensiva' : ''}_`,
    `*Bônus:* ${dist || '—'} _(orçamento ${limite})_`,
    `*Custo:* ${t.custoQi} de Qi · *Recarga:* ${t.recarga} turno${t.recarga > 1 ? 's' : ''}`,
  ];
  if (t.efeitos?.trim()) linhas.push(`*Efeito:* ${t.efeitos.trim()}`);
  if (t.tipo === 'demoniaca') linhas.push('_Demoníaca: +2 Corrupção por uso._');
  if (t.descricao?.trim()) linhas.push('', `_${t.descricao.trim()}_`);
  return linhas.join('\n');
}

// ───────────────────────── Talentos ─────────────────────────
export function pontosTalento(ficha: Ficha, corpoAtual: string) {
  const vant = ficha.talentos?.vantagens ?? [];
  const desv = ficha.talentos?.desvantagens ?? [];
  let base = 0;
  if (ficha.linhagem === 'humano_planicies') base += 1;
  if ((corpo(corpoAtual)?.efeito as { talento?: number })?.talento) base += 1;
  const ganhosBrutos = desv.reduce((a, k) => a + (desvantagem(k)?.pontos ?? 0), 0);
  const ganhos = Math.min(ganhosBrutos, dados.talentos.maxPontosDesvantagem);
  const gastos = vant.reduce((a, k) => a + (vantagem(k)?.custo ?? 0), 0);
  return { base, ganhos, ganhosBrutos, gastos, disponiveis: base + ganhos, sobra: base + ganhos - gastos };
}

// ───────────────────────── Ficha ─────────────────────────
export function tetosCriacao(ficha: Ficha): Record<Atributo, number> {
  const t = Object.fromEntries(ATRIBUTOS.map((k) => [k, dados.criacao.maximo])) as Record<Atributo, number>;
  const aplicar = (tetos?: Record<string, number>) => {
    if (!tetos) return;
    for (const [k, v] of Object.entries(tetos)) if (k in t) t[k as Atributo] = Math.min(t[k as Atributo], v);
  };
  aplicar((origem(ficha.origem) as { tetos?: Record<string, number> })?.tetos);
  aplicar(seita(ficha.seita)?.tetos);
  return t;
}

export interface Validacao { erros: string[]; avisos: string[]; talento: ReturnType<typeof pontosTalento> }

export function validarFicha(ficha: Ficha, ctx: Contexto): Validacao {
  const erros: string[] = [];
  const avisos: string[] = [];
  const c = dados.criacao;
  const lin = linhagem(ficha.linhagem);
  if (!lin || !lin.livre) erros.push('Escolha uma linhagem livre (as raras só vêm pela Leitura do Destino).');
  const ori = origem(ficha.origem);
  if (!ori) erros.push('Escolha uma origem.');
  const fac = faccao(ficha.faccao);
  if (!fac) erros.push('Escolha uma facção.');
  const sei = seita(ficha.seita);
  if (!sei || (fac && sei.faccao !== fac.chave)) erros.push('Escolha uma seita da sua facção.');
  const oriFac = (ori as { faccoes?: string[] })?.faccoes;
  if (ori && oriFac && fac && !oriFac.includes(fac.chave)) erros.push(`A origem "${ori.nome}" exige a facção ${oriFac.map((f) => faccao(f)?.nome).join(' ou ')}.`);
  if (fac && ctx.outrasFaccoes?.includes(fac.chave)) erros.push('Seu outro personagem já é dessa facção: os dois precisam ser de facções diferentes.');

  const idade = Number(ficha.idade);
  if (!Number.isInteger(idade) || idade < c.idadeMin || idade > c.idadeMax) erros.push(`Idade entre ${c.idadeMin} e ${c.idadeMax} anos.`);

  const t = pontosTalento(ficha, ctx.corpo);
  const desv = ficha.talentos?.desvantagens ?? [];
  const vant = ficha.talentos?.vantagens ?? [];
  if (desv.length < 1) erros.push('Escolha pelo menos 1 desvantagem.');
  if (t.ganhosBrutos > dados.talentos.maxPontosDesvantagem) avisos.push(`Desvantagens dão no máximo ${dados.talentos.maxPontosDesvantagem} pontos; o excedente não conta.`);
  if (t.sobra < 0) erros.push(`Talentos custam ${t.gastos} pontos, mas você tem ${t.disponiveis}.`);
  if (new Set(vant).size !== vant.length || new Set(desv).size !== desv.length) erros.push('Talento repetido.');
  for (const k of vant) if (!vantagem(k)) erros.push(`Vantagem desconhecida: ${k}.`);
  for (const k of desv) if (!desvantagem(k)) erros.push(`Desvantagem desconhecida: ${k}.`);
  if (ctx.sorteUsada && !vant.includes('sorte_do_ceu')) erros.push('A Leitura extra de "Sorte do Céu" já foi usada: o talento não pode mais ser removido.');

  const tetos = tetosCriacao(ficha);
  let soma = 0;
  for (const k of ATRIBUTOS) {
    const v = Number(ficha.atributos?.[k] ?? 0);
    soma += v;
    if (!Number.isInteger(v)) erros.push(`${NOME_ATRIBUTO[k]} precisa ser um número inteiro.`);
    if (v < c.minimo) erros.push(`${NOME_ATRIBUTO[k]} no mínimo ${c.minimo}.`);
    if (v > tetos[k]) erros.push(`${NOME_ATRIBUTO[k]} no máximo ${tetos[k]}.`);
  }
  if (soma !== c.pontos) erros.push(`Distribua exatamente ${c.pontos} pontos de atributo (agora: ${soma}).`);

  const ai = ficha.arteInterna;
  if (!ai?.nome?.trim() || !ai?.natureza || !ai?.passiva?.trim()) erros.push('Descreva a Arte Interna: nome, natureza do Qi e efeito passivo.');
  const tecs = ficha.tecnicas ?? [];
  const extras = ((ori as { tecnicaExtra?: number })?.tecnicaExtra ?? 0) + (sei?.tecnicaExtra ?? 0);
  const maxTec = c.tecnicasBasicas + extras;
  if (tecs.length < c.tecnicasBasicas) erros.push(`Crie ${c.tecnicasBasicas} técnicas Básicas.`);
  if (tecs.length > maxTec) erros.push(`No máximo ${maxTec} técnicas na criação.`);
  tecs.forEach((tec, i) => {
    if (tec.grau !== 'basica') erros.push(`Técnica ${i + 1}: na criação todas são Básicas.`);
    if (tec.tipo === 'demoniaca' && ficha.faccao !== 'culto' && ficha.origem !== 'culto') erros.push(`Técnica ${i + 1}: artes demoníacas só para o Culto.`);
    const a = avaliarTecnica(tec, 'terceira');
    for (const e of a.erros) erros.push(`Técnica ${i + 1}: ${e}`);
  });
  if (!ficha.arma?.nome?.trim()) erros.push('Descreva sua arma comum (pode ser os punhos).');
  if (!ficha.historia || ficha.historia.trim().length < 80) avisos.push('Uma história com pelo menos algumas linhas ajuda a administração a aprovar.');
  return { erros, avisos, talento: t };
}

// ───────────────────────── Valores derivados ─────────────────────────
export interface Derivados {
  atributos: Record<Atributo, number>;
  vida: number;
  qiMax: number;
  anosEnergia: number;
  selado: boolean;
}

/** Atributos finais = base + linhagem + corpo (Lendário/Mítico selado a 50% até a Primeira Classe). */
export function derivados(ficha: Ficha, corpoChave: string, linhagemRara?: string | null, reinoAtual = 'terceira', qiBase?: number): Derivados {
  const attrs = Object.fromEntries(ATRIBUTOS.map((k) => [k, Number(ficha.atributos?.[k] ?? 0)])) as Record<Atributo, number>;
  const somarBonus = (b?: Record<string, unknown>, fator = 1) => {
    if (!b) return;
    for (const k of ATRIBUTOS) if (typeof b[k] === 'number') attrs[k] += Math.round((b[k] as number) * fator);
  };
  somarBonus(linhagem(ficha.linhagem)?.bonus);
  somarBonus(linhagem(linhagemRara)?.bonus);
  const cp = corpo(corpoChave);
  const selado = !!cp && ['lendario', 'mitico'].includes(cp.raridade) && indiceReino(reinoAtual) < indiceReino('primeira');
  const fator = selado ? 0.5 : 1;
  const ef = (cp?.efeito ?? {}) as Record<string, number>;
  somarBonus(ef, fator);
  for (const k of ATRIBUTOS) {
    const pct = ef[`${k}Pct`];
    if (typeof pct === 'number') attrs[k] = Math.round(attrs[k] * (1 + (pct * fator) / 100));
  }
  let vida = attrs.resistencia + attrs.vigor;
  let vidaPct = typeof ef.vidaPct === 'number' ? ef.vidaPct * fator : 0;
  if (ficha.talentos?.desvantagens?.includes('corpo_fragil')) vidaPct -= 10;
  vida = Math.round(vida * (1 + vidaPct / 100));
  const qiReino = reino(reinoAtual)?.qi ?? dados.criacao.qi;
  let qiPct = 0;
  if (typeof ef.qiPct === 'number') qiPct += ef.qiPct * fator;
  const lr = linhagem(linhagemRara)?.bonus as { qiPct?: number } | undefined;
  if (lr?.qiPct) qiPct += lr.qiPct;
  if (ficha.talentos?.desvantagens?.includes('meridiano_bloqueado')) qiPct -= 10;
  const qiMax = qiBase ?? Math.round(qiReino * (1 + qiPct / 100));
  return { atributos: attrs, vida, qiMax, anosEnergia: Math.floor(qiMax / 100), selado };
}

/** Valores iniciais aplicados quando a administração aprova a ficha. */
export function valoresIniciais(ficha: Ficha, corpoChave: string, linhagemRara?: string | null) {
  const ori = origem(ficha.origem) as { taeis?: number; corrupcao?: number; infamia?: number } | undefined;
  const sei = seita(ficha.seita);
  let taeis = dados.criacao.taeis + (ori?.taeis ?? 0);
  if (ficha.talentos?.vantagens?.includes('riqueza')) taeis += 200;
  if (sei?.taeisMax) taeis = Math.min(taeis, sei.taeisMax);
  const corrupcao = (ori?.corrupcao ?? 0) + (sei?.corrupcao ?? 0);
  const infamia = (ori?.infamia ?? 0) + (sei?.infamia ?? 0);
  const d = derivados(ficha, corpoChave, linhagemRara, 'terceira');
  return { taeis, corrupcao, infamia, qi_max: d.qiMax, faccao: ficha.faccao, seita: ficha.seita, origem: ficha.origem, linhagem: ficha.linhagem };
}

// ───────────────────────── Progresso ─────────────────────────
export interface Progresso {
  reino: string;
  estagio: string;
  proximo: { reino: string; estagio: string; pe: number } | null;
  falta: number;
  semanas: number | null;
  precisaGargalo: boolean;
}

/** Estágio que o PE alcança dentro do reino atual (sem atravessar o gargalo). */
export function estagioPorPe(reinoChave: string, pe: number): string {
  const r = reino(reinoChave);
  if (!r?.pe) return 'inicial';
  if (pe >= r.pe[2]) return 'superior';
  if (pe >= r.pe[1]) return 'intermediario';
  return 'inicial';
}

export function progresso(pe: number, reinoChave: string, estagioAtual?: string, pePorSemana?: number): Progresso {
  const r = reino(reinoChave);
  const idx = indiceReino(reinoChave);
  const est = estagioAtual ?? estagioPorPe(reinoChave, pe);
  const ordem = ['inicial', 'intermediario', 'superior'];
  const iEst = ordem.indexOf(est);
  let proximo: Progresso['proximo'] = null;
  let precisaGargalo = false;
  if (r?.pe) {
    if (iEst < 2) proximo = { reino: reinoChave, estagio: ordem[iEst + 1], pe: r.pe[iEst + 1] };
    else {
      const nr = dados.reinos[idx + 1];
      if (nr?.pe) { proximo = { reino: nr.chave, estagio: 'inicial', pe: nr.pe[0] }; precisaGargalo = true; }
      else if (nr) { proximo = { reino: nr.chave, estagio: 'inicial', pe: Infinity }; precisaGargalo = true; }
    }
  }
  const falta = proximo && Number.isFinite(proximo.pe) ? Math.max(0, proximo.pe - pe) : 0;
  const ritmo = pePorSemana ?? ritmoSemanalPadrao(reinoChave);
  const semanas = proximo && Number.isFinite(proximo.pe) && ritmo > 0 ? Math.ceil(falta / ritmo) : null;
  return { reino: reinoChave, estagio: est, proximo, falta, semanas, precisaGargalo };
}

/** Ritmo de referência: 3 treinos + 2 missões médias por semana. */
export function ritmoSemanalPadrao(reinoChave: string): number {
  const r = reino(reinoChave);
  if (!r?.treino) return 0;
  return 3 * r.treino + 2 * dados.missoes.missao_media.pe;
}

// ───────────────────────── Gargalo ─────────────────────────
export interface EstadoGargalo {
  corpo: string;
  talentos: string[];
  corrupcao: number;
  ferimentosInternos: number;
  primeiroGargalo: boolean;
  mods: { mestre?: boolean; pilula?: boolean; texto?: boolean };
}

export function modificadoresGargalo(e: EstadoGargalo) {
  const lista: { motivo: string; valor: number }[] = [];
  if (e.mods.mestre) lista.push({ motivo: 'Mestre ou manual da Arte Interna', valor: 1 });
  if (e.mods.pilula) lista.push({ motivo: 'Pílula ou erva de avanço', valor: 1 });
  if (e.mods.texto) lista.push({ motivo: 'Texto excelente', valor: 1 });
  if (e.talentos.includes('coracao_calmo')) lista.push({ motivo: 'Coração Calmo', valor: 1 });
  if (e.talentos.includes('coracao_inquieto')) lista.push({ motivo: 'Coração Inquieto', valor: -1 });
  const ef = (corpo(e.corpo)?.efeito ?? {}) as { gargalo?: number; gargaloPrimeiro?: number };
  if (ef.gargalo) lista.push({ motivo: corpo(e.corpo)!.nome, valor: ef.gargalo });
  if (ef.gargaloPrimeiro && e.primeiroGargalo) lista.push({ motivo: `${corpo(e.corpo)!.nome} (primeiro gargalo)`, valor: ef.gargaloPrimeiro });
  if (e.ferimentosInternos > 0) lista.push({ motivo: 'Ferimento Interno', valor: -e.ferimentosInternos });
  const c = Math.floor(e.corrupcao / 25);
  if (c > 0) lista.push({ motivo: `Corrupção ${e.corrupcao}`, valor: -c });
  return { lista, total: lista.reduce((a, b) => a + b.valor, 0) };
}

export type ResultadoGargalo = 'avanco' | 'falha' | 'desvio';
export function interpretarGargalo(total: number): ResultadoGargalo {
  if (total >= dados.gargalo.sucesso) return 'avanco';
  if (total >= dados.gargalo.falhaMin) return 'falha';
  return 'desvio';
}

/** Entre várias faces de Desvio, devolve a pior (Dantian Duplo). */
export function piorDesvio(faces: number[]): number {
  const ordem = dados.gargalo.gravidadeDesvio;
  return [...faces].sort((a, b) => ordem.indexOf(a) - ordem.indexOf(b))[0];
}

export const desvio = (face: number) => dados.gargalo.desvio.find((d) => d.face === face)!;

// ───────────────────────── Linhas de texto ─────────────────────────
export function contarLinhas(texto: string): number {
  return texto.split(/\r?\n/).filter((l) => l.trim().length > 0).length;
}

export function nivelFama(fama: number) {
  return [...dados.fama].reverse().find((f) => fama >= f.min)!;
}
