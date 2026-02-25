import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';

// Docs: https://rsbuild.rs/config/
export default defineConfig({
  plugins: [pluginReact()],
  html: {
    title: 'Game Hub · 游戏合集',
    tags: [
      {
        tag: 'link',
        attrs: { rel: 'manifest', href: '/manifest.json' },
        publicPath: false,
      },
    ],
  },
  resolve: {
    alias: {
      '@': './src',
    },
  },
  server: {
    historyApiFallback: true,
  },
});
