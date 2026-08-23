import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';

// Docs: https://rsbuild.rs/config/
export default defineConfig({
  plugins: [pluginReact()],
  // riichi-rs 是异步 WASM 模块；关闭按需编译，确保开发运行时包含异步模块加载器。
  dev: {
    lazyCompilation: false,
  },
  tools: {
    rspack: (config) => {
      config.experiments = { ...config.experiments, asyncWebAssembly: true };
      return config;
    },
  },
  html: {
    title: 'Game Hub · 游戏合集',
    tags: [
      {
        tag: 'link',
        attrs: { rel: 'manifest', href: '/manifest.json' },
        publicPath: false,
      },
      {
        tag: 'meta',
        attrs: {
          name: 'viewport',
          content:
            'width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no',
        },
      },
      {
        tag: 'meta',
        attrs: { name: 'theme-color', content: '#102218' },
      },
      {
        tag: 'meta',
        attrs: { name: 'apple-mobile-web-app-capable', content: 'yes' },
      },
      {
        tag: 'meta',
        attrs: {
          name: 'apple-mobile-web-app-status-bar-style',
          content: 'black-translucent',
        },
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
