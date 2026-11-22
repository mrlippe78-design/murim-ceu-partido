// Ordem das seções da biblioteca e itens do menu principal.
export const secoes = [
  { chave: 'comece', nome: 'Comece aqui', ideograma: '始' },
  { chave: 'mundo', nome: 'O Mundo', ideograma: '界' },
  { chave: 'faccoes', nome: 'Facções e Seitas', ideograma: '派' },
  { chave: 'personagem', nome: 'Personagem', ideograma: '人' },
  { chave: 'cultivo', nome: 'Cultivo', ideograma: '氣' },
  { chave: 'artes', nome: 'Artes Marciais', ideograma: '武' },
  { chave: 'combate', nome: 'Combate', ideograma: '劍' },
  { chave: 'evolucao', nome: 'Evolução e Economia', ideograma: '道' },
  { chave: 'sistemas', nome: 'Sistemas do Jianghu', ideograma: '門' },
] as const;

export const menu = [
  { href: '/biblioteca/', nome: 'Biblioteca' },
  { href: '/ferramentas/', nome: 'Ferramentas' },
  { href: '/mural/', nome: 'Mural' },
  { href: '/mapa/', nome: 'Mapa' },
  { href: '/como-entrar/', nome: 'Como entrar' },
];

export const ferramentas = [
  { href: '/ferramentas/tecnica/', nome: 'Calculadora de técnica', texto: 'Divide o bônus, confere o orçamento e gera o texto da técnica.' },
  { href: '/ferramentas/progresso/', nome: 'Calculadora de progresso', texto: 'Quanto falta para o próximo estágio e em quantas semanas.' },
  { href: '/ferramentas/dados/', nome: 'Rolador de dados', texto: '3d6 para Gargalo e 1d6 para Desvio de Qi, com a tabela.' },
  { href: '/ferramentas/modelos/', nome: 'Modelos para o WhatsApp', texto: 'Ficha, técnica, treino, missão e pedido de avanço prontos.' },
  { href: '/glossario/', nome: 'Glossário', texto: 'Qi, dantian, gargalo, Jianghu e o resto do vocabulário.' },
  { href: '/npcs/', nome: 'NPCs', texto: 'Quem manda, quem trai, quem está desaparecido.' },
  { href: '/bestiario/', nome: 'Bestiário', texto: 'Bestas espirituais: o que caçar e o que evitar.' },
  { href: '/listas/', nome: 'Listas do Jianghu', texto: 'Dragões Ascendentes e Procurados.' },
  { href: '/calendario/', nome: 'Calendário', texto: 'Eventos e torneios com contagem regressiva.' },
  { href: '/tutorial/', nome: 'Primeira vez aqui?', texto: 'Cinco minutos de regras e um quiz que libera sua ficha.' },
];
