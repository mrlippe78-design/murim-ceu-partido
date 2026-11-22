import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

// Biblioteca: um arquivo Markdown por página, organizado em pastas por seção.
// Para criar uma página nova, copie um arquivo da mesma pasta e mude o texto.
const biblioteca = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/biblioteca' }),
  schema: z.object({
    titulo: z.string(),
    secao: z.enum(['comece', 'mundo', 'faccoes', 'personagem', 'cultivo', 'artes', 'combate', 'evolucao', 'sistemas']),
    ordem: z.number(),
    resumo: z.string(),
    ideograma: z.string().optional(),
    imagem: z.string().optional(), // chave de src/data/imagens.json
    atualizado: z.string().optional(),
  }),
});

export const collections = { biblioteca };
