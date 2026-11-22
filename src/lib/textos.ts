// Geração de textos no formato do WhatsApp (*negrito*, _itálico_).
import { ATRIBUTOS, NOME_ATRIBUTO, derivados, textoTecnica, DADOS, vantagem, desvantagem, linhagem, origem, seita, faccao, corpo as infoCorpo, reino, type Ficha } from '../../supabase/functions/_shared/regras';

interface Personagem {
  nome: string; alcunha?: string | null; ficha: Ficha; corpo: string; raiz: { tipo: string; elementos: string[] };
  linhagem_rara?: string | null; reino?: string; estagio?: string; pe?: number; taeis?: number; qi_max?: number;
}

const nomeRaiz = (r: Personagem['raiz']) => {
  const base = (DADOS.raizes as Record<string, { nome: string }>)[r?.tipo ?? 'comum']?.nome ?? 'Raiz Comum';
  const el = (r?.elementos ?? []).map((e) => (DADOS.elementos as Record<string, string>)[e]).join(' e ');
  return el ? `${base} (${el})` : base;
};

export function textoFicha(p: Personagem): string {
  const f = p.ficha ?? {};
  const d = derivados(f, p.corpo, p.linhagem_rara, p.reino ?? 'terceira', p.qi_max);
  const cp = infoCorpo(p.corpo);
  const est = DADOS.estagios.find((e) => e.chave === (p.estagio ?? 'inicial'))?.nome;
  const l = [
    `*━━━ 【 FICHA 】 ━━━*`,
    `*Nome:* ${p.nome}${p.alcunha ? ` — _"${p.alcunha}"_` : ''}`,
    `*Idade:* ${f.idade ?? '—'}`,
    `*Linhagem:* ${linhagem(f.linhagem)?.nome ?? '—'}${p.linhagem_rara ? ` + ${linhagem(p.linhagem_rara)?.nome}` : ''}`,
    `*Origem:* ${origem(f.origem)?.nome ?? '—'}`,
    `*Facção:* ${faccao(f.faccao)?.nome ?? '—'} · *Seita:* ${seita(f.seita)?.nome ?? '—'}`,
    `*Reino:* ${reino(p.reino ?? 'terceira')?.nome} ${est}${p.pe !== undefined ? ` · ${p.pe.toLocaleString('pt-BR')} PE` : ''}`,
    '',
    `*Corpo Marcial:* ${cp?.nome ?? '—'}${cp && cp.raridade !== 'comum' ? ` _(${cp.raridade}${d.selado ? ', selado' : ''})_` : ''}`,
    `*Raiz de Qi:* ${nomeRaiz(p.raiz)}`,
    `*Talentos:* ${(f.talentos?.vantagens ?? []).map((k) => vantagem(k)?.nome).join(', ') || '—'}`,
    `*Desvantagens:* ${(f.talentos?.desvantagens ?? []).map((k) => desvantagem(k)?.nome).join(', ') || '—'}`,
    '',
    `*— Atributos —*`,
    ...ATRIBUTOS.map((k) => `${NOME_ATRIBUTO[k]}: ${d.atributos[k].toLocaleString('pt-BR')}`),
    `*Vida:* ${d.vida.toLocaleString('pt-BR')} · *Qi:* ${d.qiMax.toLocaleString('pt-BR')} _(${d.anosEnergia} anos de energia)_`,
    '',
    `*— Arte Interna —*`,
    f.arteInterna ? `*${f.arteInterna.nome}* _(${(DADOS.elementos as Record<string, string>)[f.arteInterna.natureza] ?? f.arteInterna.natureza})_ — ${f.arteInterna.passiva}` : '—',
    '',
    `*— Técnicas —*`,
    ...(f.tecnicas ?? []).flatMap((t) => [textoTecnica(t), '']),
    `*Arma:* ${f.arma?.nome ?? '—'}${p.taeis !== undefined ? ` · *Taéis:* ${p.taeis}` : ''}`,
  ];
  if (f.aparencia) l.push('', `*Aparência:* ${f.aparencia}`);
  if (f.personalidade) l.push(`*Personalidade:* ${f.personalidade}`);
  if (f.historia) l.push('', `*História:*`, `_${f.historia.trim()}_`);
  return l.join('\n');
}

export const MODELOS: Record<string, { titulo: string; texto: string }> = {
  treino: {
    titulo: 'Treino',
    texto: `*━━━ 【 TREINO 】 ━━━*\n*Personagem:* \n*Foco:* (técnica, atributo, meridiano ou manual)\n*Local:* \n*Duração na história:* \n\n_(20 linhas ou mais: começo, esforço, dificuldade, pequena descoberta, final)_\n\n`,
  },
  missao: {
    titulo: 'Missão autonarrada',
    texto: `*━━━ 【 MISSÃO 】 ━━━*\n*Personagem:* \n*Dificuldade:* fácil (40+) · média (60+) · difícil (80+)\n*Contratante:* \n*Objetivo:* \n*Local:* \n\n_(Narre a missão do começo ao fim. Você descreve só as ações do seu personagem; NPCs reagem de forma plausível.)_\n\n*Resultado:* \n*Recompensa pedida:* `,
  },
  avanco: {
    titulo: 'Pedido de avanço',
    texto: `*━━━ 【 PEDIDO DE AVANÇO 】 ━━━*\n*Personagem:* \n*Reino atual:* (estágio Superior)\n*PE atual:* \n*Reino desejado:* \n*Bônus pedidos:* mestre/manual ( ) · pílula/erva ( )\n\n_(40 linhas ou mais narrando a meditação, a dor e o momento da ruptura)_\n\n`,
  },
  tecnica: {
    titulo: 'Técnica',
    texto: `*【Nome da técnica】*\n_Tipo · Grau_\n*Bônus:* +000 Atributo _(orçamento 000)_\n*Custo:* 00 de Qi · *Recarga:* 1 turno\n*Efeito:* \n\n_Descrição curta da técnica._`,
  },
  ficha: {
    titulo: 'Ficha (em branco)',
    texto: `*━━━ 【 FICHA 】 ━━━*\n*Nome:* \n*Idade:* \n*Linhagem:* \n*Origem:* \n*Facção:*  · *Seita:* \n*Reino:* Terceira Classe Inicial · 0 PE\n\n*Corpo Marcial:* Corpo Mortal\n*Raiz de Qi:* Raiz Comum\n*Talentos:* \n*Desvantagens:* \n\n*— Atributos —*\nForça: \nAgilidade: \nResistência: \nPrecisão: \nVigor: \n*Vida:*  · *Qi:* 1.000 _(10 anos de energia)_\n\n*— Arte Interna —*\n*Nome* _(natureza)_ — efeito passivo\n\n*— Técnicas —*\n1. \n2. \n3. \n\n*Arma:*  · *Taéis:* 100\n\n*Aparência:* \n*Personalidade:* \n\n*História:*\n_ _`,
  },
};
