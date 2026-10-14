// Configuration guide: https://rstack.rs/config
import { define } from 'rstack';

define.app(async () => {
  const { pluginReact } = await import('@rsbuild/plugin-react');

  return {
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
          attrs: { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
          publicPath: false,
        },
        {
          tag: 'link',
          attrs: {
            rel: 'preconnect',
            href: 'https://fonts.gstatic.com',
            crossorigin: 'anonymous',
          },
          publicPath: false,
        },
        {
          tag: 'link',
          attrs: {
            rel: 'stylesheet',
            href: 'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;600;700&family=Noto+Serif+SC:wght@500;600;700&display=swap',
          },
          publicPath: false,
        },
        {
          tag: 'link',
          attrs: { rel: 'manifest', href: '/manifest.json' },
          publicPath: false,
        },
        {
          tag: 'meta',
          attrs: {
            name: 'viewport',
            content: 'width=device-width, initial-scale=1, viewport-fit=cover',
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
      proxy: {
        '/api/v1': {
          target: 'http://127.0.0.1:8787',
          changeOrigin: false,
        },
        '/healthz': {
          target: 'http://127.0.0.1:8787',
          changeOrigin: false,
        },
        '/ws': {
          target: 'ws://127.0.0.1:8787',
          ws: true,
          changeOrigin: false,
        },
      },
    },
  };
});

define.test({
  setupFiles: ['./tests/rstest.setup.ts'],
  coverage: {
    provider: 'istanbul',
    include: ['src/lib/**/*.ts', 'src/pages/mahjong/japanese/**/*.{ts,tsx}'],
    reporters: ['text-summary', 'html'],
  },
});

define.lint(
  ({
    globalIgnores,
    globals,
    js,
    reactHooksPlugin,
    reactPlugin,
    rstestPlugin,
    ts,
  }) => [
    globalIgnores(['.cursor/**']),
    js.configs.recommended,
    ts.configs.recommended,
    reactPlugin.configs.recommended,
    reactHooksPlugin.configs.recommended,
    {
      languageOptions: {
        globals: {
          ...globals.browser,
          ...globals.node,
        },
      },
      rules: {
        'react/no-array-index-key': 'off',
        'react/react-in-jsx-scope': 'off',
        'react-hooks/exhaustive-deps': 'off',
      },
    },
    {
      ...rstestPlugin.configs.recommended,
      files: ['**/*.{test,spec}.{ts,tsx}'],
      rules: {
        'rstest/no-conditional-expect': 'off',
        'rstest/valid-expect': 'off',
        'rstest/expect-expect': 'off',
      },
    },
  ],
);

define.fmt({
  singleQuote: true,
  trailingComma: 'all',
  ignorePatterns: ['.cursor'],
});
