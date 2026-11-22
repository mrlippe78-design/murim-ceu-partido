// @ts-check
import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import { glossarioRehype } from './src/lib/glossario-rehype.mjs';

// Endereço do site publicado no GitHub Pages.
// Se o repositório mudar de nome, troque o `base`.
export default defineConfig({
  site: 'https://mrlippe78-design.github.io',
  base: '/murim-ceu-partido',
  trailingSlash: 'ignore',
  build: { format: 'directory' },
  markdown: { processor: unified({ rehypePlugins: [glossarioRehype] }) },
  vite: { server: { fs: { allow: ['.'] } } },
});
