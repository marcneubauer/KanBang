import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [svelte({ hot: false })],
  test: {
    name: 'web',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    environment: 'jsdom',
  },
});
