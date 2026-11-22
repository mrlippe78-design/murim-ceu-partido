# Murim: Céu Partido — design

Data: 2026-11-22. O pedido completo do usuário é a fonte da verdade; este arquivo registra as decisões tomadas a partir dele.

## Intenção
O site nasce junto com o grupo de WhatsApp. Ele tem duas funções:
1. Convite: quem abre o link no celular precisa sentir o mundo e querer entrar.
2. Biblioteca da seita: uso diário por players e administração (regras, fichas, sorteio, filas de aprovação).

O projeto é pessoal e acadêmico, sem fins comerciais. O usuário pediu execução contínua, sem parar entre as etapas.

**Antiobjetivos:** cara de "gerado por IA" (cards iguais, gradiente roxo, emoji como ícone, tudo centralizado); sorteio feito no navegador; chave secreta no front-end; conteúdo copiado de outras obras (os exemplos de Tokyo Ghoul no Drive servem só como referência de formato: Lore/Ambientação × Sistemas, um documento por facção).

## Abordagens consideradas
| Abordagem | Prós | Contras |
|---|---|---|
| **Astro puro + Pagefind (escolhida)** | Layout 100% próprio (editorial, assimétrico); zero JS por padrão (Lighthouse 90+); coleções de conteúdo em Markdown/JSON; Pagefind faz busca estática offline | Menu lateral, sumário e anterior/próximo precisam ser escritos (pouco código) |
| Astro + Starlight | Navegação, busca e sumário prontos | Visual de documentação técnica, difícil de tirar a "cara de docs" |
| HTML/JS puro | Sem build | Sem coleções de conteúdo, busca e manutenção piores |

Backend: Supabase (Auth + Postgres + RLS + Edge Functions), como pedido. Não há opção melhor para GitHub Pages + login + sorteio auditável no plano gratuito.

## Decisões
- **Stack:** Astro 7.4 (saída estática, `base: /murim-ceu-partido`), TypeScript, CSS próprio sem framework, ilhas em JS puro. Supabase JS 2.119. Pagefind 1.6. Fontes auto-hospedadas: Zen Antique (títulos e ideogramas) e Alegreya / Alegreya Sans (texto).
- **Conteúdo:** `src/content/biblioteca/**.md`, um arquivo por seita, sistema, região etc., com frontmatter (título, seção, ordem, resumo). Dados estruturados (corpos, talentos, linhagens, NPCs, mapa, calendário, changelog, glossário) em `src/data/*.json`. Imagens trocáveis em `src/data/imagens.json`.
- **Regras compartilhadas:** `src/lib/regras/*.ts` (orçamento de técnica, progresso, gargalo, validação de ficha, combate), com testes Vitest. O sorteio usa `supabase/functions/_shared/destino-config.json`, a fonte única das porcentagens, lida pelo site e pela Edge Function.
- **Sorteio:** Edge Function `leitura-destino` com `crypto.getRandomValues` e amostragem por rejeição (sem viés), pesos inteiros em 10.000 avos. Pity (Fio do Destino) aplicado no servidor. Mítico é único no servidor; se já houver dono, sorteia outro Mítico livre, e se não houver nenhum livre, vira Lendário. Registro imutável: um trigger bloqueia UPDATE/DELETE até para admin. `simular-leitura` (só admin) roda N sorteios sem gravar.
- **Dados oficiais:** Edge Function `rolar-dados` (gargalo 3d6 com modificadores calculados do estado do personagem; Desvio de Qi 1d6 automático em 7 ou menos), com registro imutável.
- **Segurança:** RLS em todas as tabelas. Valores de jogo só mudam por funções `security definer` ou por admin, com um trigger de guarda que impede o dono de alterar colunas de jogo. Toda ação de admin é registrada em `admin_log` por trigger. Contas banidas são bloqueadas nas funções. Nenhuma chave secreta no repositório.
- **Conta admin:** a tabela `admin_emails` é preenchida fora do repositório. Quando o dono desse e-mail se cadastra, vira admin automaticamente. A senha nunca passa por mim.
- **Login:** e-mail e senha, sem confirmação por e-mail: o SMTP padrão do Supabase só envia para a equipe do projeto. Google e Discord ficam documentados para ligar depois de criar os apps OAuth.
- **Imagens:** pinturas chinesas em domínio público (Wikimedia Commons) convertidas em WebP com sharp, mais SVGs próprios (selos de seita, mapa, meridianos, divisórias). Créditos em `/creditos` e `CREDITS.md`.
- **Áudio:** sintetizado com WebAudio (sem arquivo de terceiros, portanto sem licença a respeitar), desligado por padrão.
- **Cartão do personagem e prévia de link:** cartão gerado em canvas no navegador (1080×1350). Imagens OG geradas no build com sharp a partir de SVG (1200×630), por página da biblioteca. Perfis públicos usam uma OG genérica, porque o GitHub Pages é estático (limitação registrada).
- **PWA:** manifest + service worker próprio; páginas da biblioteca e assets em cache para leitura offline.
- **Backup:** workflow semanal no GitHub Actions faz `pg_dump`, cifra com AES-256 (senha em secret) e guarda como artifact por 90 dias. Restauração documentada. Depende do secret `SUPABASE_DB_URL`.

## Escopo (ordem de execução)
1. Identidade visual + convite.
2. Biblioteca completa (lore expandida, sistemas, NPCs, 4 candidatos, exemplo de luta), busca, glossário, changelog.
3. Supabase: esquema, RLS, funções, Edge Functions; login; criador de ficha com rascunho automático.
4. Leitura do Destino com animação; mural; painel admin (filas, ajustes, mortes, listas, rolagens, banir, estatísticas, simulador de combate).
5. Ferramentas (calculadoras, dados, modelos WhatsApp), mapa, calendário, tutorial com quiz, conquistas, cartão, OG, PWA, áudio, backup, 404.
6. Deploy (Pages + Actions), advisors, simulação de 100.000 Leituras, Playwright em 390/1440 px, Lighthouse.

## Fica a critério de quem implementa
Textos de lore adicionais, nomes de NPCs, paleta exata e tempos de animação, sempre dentro das regras numéricas do pedido.
