import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      // Copies src/assets into dist/ so root-relative URLs like
      // "/src/assets/images/..." (e.g. generate_image output) still resolve
      // in production builds. Do not remove.
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(__dirname, 'dist');
          const srcAssets = path.resolve(__dirname, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, {recursive: true, force: true});
          }

          // Garante que dist/sw.js pré-carregue todos os bundles JS/CSS gerados em dist/assets/
          const swPath = path.resolve(distDir, 'sw.js');
          const builtAssetsDir = path.resolve(distDir, 'assets');
          if (fs.existsSync(swPath) && fs.existsSync(builtAssetsDir)) {
            const assetUrls = fs
              .readdirSync(builtAssetsDir)
              .filter((file) => /\.(js|css|woff2?|png|svg)$/i.test(file))
              .map((file) => `/assets/${file}`);
            const buildStamp = Date.now().toString(36);
            let swContent = fs.readFileSync(swPath, 'utf-8');
            swContent = swContent.replace(
              /const CACHE_NAME = ['"][^'"]+['"];/,
              `const CACHE_NAME = 'gestor-financeiro-v3-10-${buildStamp}';`,
            );
            swContent = swContent.replace(
              'const BUILD_ASSETS = [];',
              `const BUILD_ASSETS = ${JSON.stringify(assetUrls)};`,
            );
            fs.writeFileSync(swPath, swContent, 'utf-8');
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
