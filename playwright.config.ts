import { defineConfig, devices } from '@playwright/test';

// BASE_URL padrão: o site publicado. Para testar local: BASE_URL=http://localhost:4322/murim-ceu-partido/ npm run e2e
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.BASE_URL ?? 'https://mrlippe78-design.github.io/murim-ceu-partido/',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'celular', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
    { name: 'computador', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],
});
