# Murim: Céu Partido

Site oficial do RPG de WhatsApp **Murim: Céu Partido**: convite, biblioteca de regras, fichas com login, Leitura do Destino sorteada no servidor e painel da administração.

- **Site:** https://mrlippe78-design.github.io/murim-ceu-partido/
- **Código:** este repositório
- **Tecnologia:** Astro (site estático no GitHub Pages) + Supabase (login, banco de dados e o servidor do sorteio)

---

## Guia rápido para quem não programa

Tudo o que você precisa mudar no dia a dia está em **arquivos de texto**. Dá para editar direto no site do GitHub:

1. Abra o arquivo no GitHub.
2. Clique no lápis (**Edit this file**).
3. Mude o texto.
4. Clique em **Commit changes** (verde).
5. Espere uns 2 minutos: o site se publica sozinho (aba **Actions** mostra o andamento).

### Editar as regras e a lore

As páginas da biblioteca ficam em `src/content/biblioteca/`, uma pasta por seção e **um arquivo por página** (`.md`). Exemplo: `src/content/biblioteca/faccoes/hwa.md` é a página do Clã Hwa.

Cada arquivo começa com um cabeçalho entre `---`:

```
---
titulo: "Clã Hwa"
secao: faccoes
ordem: 22
resumo: "Flores, agulhas e veneno."
ideograma: 花
---
```

- `titulo` e `resumo`: sempre entre aspas.
- `secao`: a pasta (comece, mundo, faccoes, personagem, cultivo, artes, combate, evolucao, sistemas).
- `ordem`: posição no menu (números menores vêm primeiro).
- Depois do cabeçalho, o texto normal. `**negrito**`, `*itálico*`, `## Título de seção`, listas com `-` e tabelas com `|`.

**Página nova:** copie um arquivo da mesma pasta, mude o nome do arquivo e o conteúdo. Ela aparece no menu e na busca sozinha.

**Números das regras:** além do texto, as contas automáticas (criador de ficha, calculadoras, servidor) leem `supabase/functions/_shared/dados.json`. Se mudar um número de regra (por exemplo, o bônus de uma técnica Básica), mude **nos dois lugares**: no `.md` (o que o jogador lê) e no `dados.json` (o que o site calcula). Mudanças que afetam o servidor exigem publicar a função de novo (veja abaixo).

**Avisar sobre regra nova:** acrescente um item no topo de `src/data/novidades.json` (data, título, o que mudou e por quê). O site mostra uma faixa "Regra nova" para quem já tinha visitado.

### Trocar imagens

1. Coloque a imagem nova (JPG ou PNG) na pasta `arte-propria/` (crie a pasta se não existir).
2. No computador, rode `npm run imagens`: ela vira WebP otimizado em `public/assets/img/` (uma versão grande e uma de celular, com `-m` no nome).
3. Abra `src/data/imagens.json` e troque o `arquivo` do espaço que você quer. Exemplo, para trocar o fundo do convite:

```json
"hero": { "arquivo": "/assets/img/minha-arte.webp", "alt": "Descrição da imagem em português" },
```

4. Escreva um `alt` que descreva a imagem (é o que leitores de tela leem).
5. Se a imagem não for sua, acrescente o crédito em `CREDITS.md`.

Sem computador? Converta a imagem para WebP num site qualquer, envie para `public/assets/img/` pelo GitHub (**Add file → Upload files**) e mude a linha no `imagens.json`.

### Mudar o link do grupo e o contato

Arquivo `src/data/site.json`: troque `linkGrupo` pelo link de convite do WhatsApp e ajuste `contatoAdmin`.

### Mudar as porcentagens da Leitura do Destino

Arquivo `supabase/functions/_shared/destino-config.json`. Os pesos são em **10.000 avos**: `8955` = 89,55%. A soma de cada bloco precisa dar `10000`.

Depois de salvar, é preciso **publicar a função do servidor** (o sorteio acontece lá, não no site):

```
npx supabase login
npx supabase functions deploy jogo --project-ref pzlfgbygekasqhzlfnko --no-verify-jwt
```

Confira no painel da administração, aba **Destino 100k**: ela roda 100.000 leituras no servidor e mostra se as porcentagens batem.

### Publicar de novo

Qualquer alteração enviada para a branch `main` publica o site sozinha (GitHub Actions → "Publicar no GitHub Pages"). Para forçar: aba **Actions** → **Publicar no GitHub Pages** → **Run workflow**.

---

## Administração

### Virar administrador

Administradores são definidos pela tabela `admin_emails` do banco. Para dar admin a alguém:

1. No painel do Supabase, abra **SQL Editor**.
2. Rode (com o e-mail da pessoa):

```sql
insert into public.admin_emails (email) values ('email@exemplo.com');
update public.perfis set papel = 'admin'
  where id = (select id from auth.users where lower(email) = lower('email@exemplo.com'));
```

A primeira linha vale para quem ainda vai se cadastrar; a segunda, para quem já tem conta. O e-mail nunca fica no repositório.

### O que o painel faz (`/admin/`)

- **Fila:** aprovar ou recusar fichas, treinos, missões e pedidos de avanço (com os bônus do gargalo). Botão **Fechar a semana** (salários, custo de vida, maldições).
- **Personagens:** somar ou tirar PE, PA, taéis, Fama, Infâmia, Corrupção, Leituras e Contribuição; editar inventário, ferimentos, afinidades, meridianos, região e alcunha; conceder conquistas; registrar morte. Todo ajuste exige um motivo.
- **Contas:** banir e desbanir.
- **Rolagens:** histórico imutável de Leituras e rolagens oficiais.
- **Mural, Listas, Calendário:** avisos, Dragões Ascendentes, Procurados e eventos.
- **Estatísticas:** jogadores ativos, personagens por reino e facção, corpos, filas.
- **Simulador:** combate turno a turno e 1.000 lutas para testar equilíbrio.
- **Destino 100k:** prova estatística do sorteio.
- **Histórico:** tudo o que cada admin alterou, com antes, depois e motivo.

---

## Login com Google ou Discord (opcional)

Hoje o login é por e-mail e senha. Para ligar Google ou Discord:

1. Crie um app OAuth no [Google Cloud Console](https://console.cloud.google.com/apis/credentials) ou no [Discord Developer Portal](https://discord.com/developers/applications).
2. Use como URL de retorno: `https://pzlfgbygekasqhzlfnko.supabase.co/auth/v1/callback`.
3. No Supabase: **Authentication → Sign In / Providers**, ative o provedor e cole o Client ID e o Client Secret.
4. Peça para acrescentar os botões na página `src/pages/conta/index.astro` (uma linha com `supabase.auth.signInWithOAuth({ provider: 'google' })`).

---

## Backup semanal

O workflow `.github/workflows/backup.yml` roda todo domingo, exporta o banco e guarda um arquivo **cifrado** por 90 dias (em Actions → Backup semanal → Artifacts). Para ligar:

1. No Supabase: **Connect → Session pooler**, copie a string de conexão (com a senha do banco).
2. No GitHub: **Settings → Secrets and variables → Actions → New repository secret**:
   - `SUPABASE_DB_URL` = a string de conexão;
   - `BACKUP_SENHA` = uma senha longa que só você sabe.

### Restaurar

```
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in backup-AAAA-MM-DD.tgz.enc -out backup.tgz
tar xzf backup.tgz
pg_restore --clean --if-exists --no-owner -d "STRING_DE_CONEXAO" murim-AAAA-MM-DD.dump
```

Para recriar tudo do zero num projeto Supabase novo: rode os arquivos de `supabase/migrations/` em ordem no SQL Editor, publique a função `jogo` e restaure o backup.

---

## Para quem programa

```
npm install
cp .env.example .env      # preencha com as chaves públicas
npm run dev               # http://localhost:4321/murim-ceu-partido/
npm test                  # testes das regras, do sorteio e do combate
npm run build             # site + índice de busca em dist/
npm run og                # regenera as prévias de link (public/og)
npm run imagens           # converte imagens para WebP
```

- `src/content/biblioteca/`: páginas em Markdown.
- `src/data/`: configuração, imagens, glossário, NPCs, bestiário, mapa, novidades.
- `supabase/functions/_shared/`: **regras compartilhadas** entre o site e o servidor (`regras.ts`, `destino.ts`, `dados.json`, `destino-config.json`).
- `supabase/functions/jogo/`: Edge Function (Leitura do Destino, gargalo, envio e aprovação de ficha, simulação).
- `supabase/migrations/`: tabelas, RLS, gatilhos e funções SQL.
- `src/lib/combate.ts`: motor do simulador de combate.

### Segurança

- RLS em todas as tabelas. Valores de jogo só mudam por funções do servidor ou por admin; um gatilho impede o dono de alterar qualquer coisa além de nome, alcunha e ficha, e só em rascunho.
- Leituras, rolagens, escolhas e o histórico de admin são **imutáveis** (gatilho bloqueia UPDATE e DELETE, até para admin).
- Aleatoriedade: `crypto.getRandomValues` com amostragem por rejeição, no servidor.
- A chave secreta (service role) só existe dentro do Supabase. O repositório tem apenas a chave pública.
