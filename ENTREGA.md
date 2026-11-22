# Entrega — Murim: Céu Partido

Data: 22 de novembro de 2026.

- **Site:** https://mrlippe78-design.github.io/murim-ceu-partido/
- **Repositório:** https://github.com/mrlippe78-design/murim-ceu-partido
- **Banco e servidor:** projeto Supabase `murim-ceu-partido` (ref. `pzlfgbygekasqhzlfnko`, região Américas, plano gratuito)
- **Como editar textos, trocar imagens, mudar porcentagens e o link do grupo:** `README.md` (guia para quem não programa)

## Acesso de administrador

O site não guarda nenhuma senha de admin no código. Para virar admin:

1. Cadastre-se no site com o seu e-mail (Minha conta → Criar conta).
2. No painel do Supabase → **SQL Editor**, rode:

```sql
insert into public.admin_emails (email) values ('SEU-EMAIL-AQUI');
update public.perfis set papel = 'admin'
  where id = (select id from auth.users where lower(email) = lower('SEU-EMAIL-AQUI'));
```

3. Recarregue o site: o botão **Painel da administração** aparece em Minha conta (`/admin/`).

> Eu não pude rodar esse comando por você: a inserção do seu e-mail foi bloqueada pelo filtro de segurança da sessão.

## O que foi verificado (executado de verdade)

| Verificação | Resultado |
|---|---|
| Testes das regras, do sorteio e do combate (Vitest) | **31/31** |
| 100.000 Leituras de corpo (teste local, gerador criptográfico) | dentro de 5 desvios-padrão em todas as raridades |
| Testes no navegador, 390 px e 1440 px (Playwright) | **30/30** no build local; **24/24** públicos e de segurança no site publicado |
| Cadastro → quiz → ficha → Leitura do Destino → envio para aprovação | passou |
| Rascunho automático sobrevive a recarregar a página | passou (defeito encontrado e corrigido) |
| Segurança: jogador comum tenta mudar PE, corpo, papel de admin, gravar Leitura e chamar funções do servidor | todas as tentativas **recusadas** |
| Leitura gravada não pode ser apagada | confirmado |
| Prévia de link (Open Graph 1200×630 e Twitter Card) | presente em todas as páginas; imagem responde 200 |
| Advisors do Supabase | ver abaixo |

### Lighthouse (celular, Chromium do Playwright, build de produção)

| Página | Desempenho | Acessibilidade | Boas práticas | SEO |
|---|---|---|---|---|
| Convite | 96 | 100 | 100 | 100 |
| Biblioteca: Exemplo de luta | 100 | 100 | 100 | 100 |
| Biblioteca: Regiões | 99 | 100 | 100 | 100 |
| Biblioteca: Talentos | 95 | 100 | 100 | 100 |
| Ferramentas: técnica / dados | 100 | 100 | 100 | 100 |
| Mapa | 100 | 100 | 100 | 100 |
| Minha conta | 100 | 100 | 100 | 63 (proposital: página privada com `noindex`) |

Relatórios em `evidencias/`.

### Advisors do Supabase

- Corrigido: funções auxiliares expostas a visitantes foram movidas para um esquema privado; `admin_emails` ganhou política explícita de negação; faltava permissão da chave de servidor nas tabelas (a Leitura falhava).
- Intencional: 14 funções de jogo podem ser chamadas por usuários logados (criar personagem, enviar treino, painel). Cada uma confere internamente quem chama e se é admin.
- Não disponível no plano gratuito: "proteção contra senhas vazadas" (só no Pro). Como compensação, as senhas agora exigem no mínimo 8 caracteres, com letras e números.
- Desempenho: só avisos informativos de "índice ainda não usado", normais num banco novo.

## Pendências (dependem de você)

1. **Workflows do GitHub Actions.** O seu login do `gh` não tem a permissão `workflow`, e por isso o GitHub recusou os arquivos `.github/workflows/` (publicação automática e backup semanal). Eles estão prontos na pasta local. O site está publicado pelo branch `gh-pages`. Para ligar:
   ```
   gh auth refresh -h github.com -s workflow
   ```
   Depois disso, enviar `.github/` e trocar o Pages para "GitHub Actions" leva um minuto.
2. **Backup semanal:** cadastrar os secrets `SUPABASE_DB_URL` e `BACKUP_SENHA` (README, seção "Backup semanal").
3. **Teste da aprovação pelo painel e da simulação de 100.000 Leituras no servidor:** dependem da conta de admin (item acima).
4. **Login com Google ou Discord:** exige criar os apps OAuth nos painéis do Google e do Discord (README).
5. **Link real do grupo:** trocar `linkGrupo` em `src/data/site.json`.

## Decisões criativas e técnicas

- **Astro puro em vez de Starlight ou Docusaurus.** Os temas de documentação têm "cara de manual técnico". Com Astro puro o layout ficou editorial e assimétrico, com zero JavaScript nas páginas de leitura (Lighthouse de 95 a 100). A busca é o Pagefind, que gera o índice no build e funciona sem servidor.
- **Regras com uma só fonte de verdade.** `supabase/functions/_shared/` contém as regras e as porcentagens. O mesmo código roda no navegador (contas ao vivo) e no servidor (o que vale), e é coberto pelos testes. Assim o site e o sorteio nunca discordam.
- **Sorteio auditável.** O sorteio usa `crypto.getRandomValues` com amostragem por rejeição. A gravação é transacional, com proteção contra corrida, e um Mítico nunca sai duplicado mesmo com duas Leituras simultâneas. Um gatilho no banco impede apagar ou editar Leituras até para o admin.
- **Visual.** Nanquim, papel envelhecido e vermelho-sangue, com ouro só nos detalhes. Pinturas Song e Joseon em domínio público ficam por trás de véus de tinta. Os ideogramas gigantes vêm de uma fonte reduzida a 31 KB com os 101 caracteres usados. O golpe de espada no título é animado em SVG, e as cinzas caem num canvas leve que pausa fora da tela. Nada de cards iguais, gradiente roxo ou emoji.
- **Som sintetizado (Web Audio)** em vez de trilha de terceiros. Não há licença a respeitar e não pesa no download. Fica desligado por padrão.
- **Combate determinístico + variação opcional.** O simulador aplica as regras exatamente. A "variação narrativa" (±%) só existe na simulação em massa, para medir o equilíbrio.
- **Regras que precisei definir** (o pedido deixava em aberto): o limite de 30% do ciclo compara atributos puros; recarga 1 = usar de novo no turno seguinte; os 12 meridianos principais abrem 1 por estágio e os 8 extraordinários por conquista; o Qi é uma reserva à parte dos 5.000 pontos de atributo; o selamento substitui o dano; o contra-ataque usa Resistência pura. Tudo está explicado na biblioteca.

## Bibliotecas, fontes e imagens

Lista completa, com versões e licenças, em `CREDITS.md` e na página `/creditos/`. Resumo: Astro, Supabase JS, Pagefind, Vitest e subset-font (MIT ou BSD); sharp, Playwright e Lighthouse (Apache-2.0); fontes Zen Antique e Alegreya (OFL 1.1); seis pinturas em domínio público do Wikimedia Commons (Fan Kuan, Guo Xi, Li Tang, Xia Gui, Jeong Seon, Qiu Ying).
