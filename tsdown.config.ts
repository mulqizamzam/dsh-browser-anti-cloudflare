import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  dts: true,
  clean: true,
  outputOptions: { inlineDynamicImports: true },
  sourcemap: false,
  banner: { js: '' },
  footer: { js: '' },
})
