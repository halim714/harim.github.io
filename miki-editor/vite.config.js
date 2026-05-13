import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  // .env 파일 로드
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      // Phase 10.6: PWA — 보수적 precache, 비즈 로직은 SW에 두지 않음 (Capacitor 전환 용이성)
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        manifest: false, // public/manifest.json 사용
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//, /^\/callback/, /^\/import-bridge/],
          runtimeCaching: [
            // GitHub API: 캐시 금지 (실시간성 우선)
            { urlPattern: /^https:\/\/api\.github\.com\//, handler: 'NetworkOnly' },
            // CDN 폰트/스크립트: 30일 캐시
            {
              urlPattern: /^https:\/\/cdn\.jsdelivr\.net\//,
              handler: 'CacheFirst',
              options: {
                cacheName: 'cdn-cache',
                expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
          ],
          cleanupOutdatedCaches: true,
          skipWaiting: true,
          clientsClaim: true,
        },
        devOptions: { enabled: false }, // 개발 중 SW 비활성화 (HMR 충돌 방지)
      }),
    ],
    define: {
      // 브라우저에서 process.env 사용 가능하도록 설정
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
      'process.env.VITE_AI_API_TYPE': JSON.stringify(env.VITE_AI_API_TYPE || 'claude'),
      'process.env.VITE_CLAUDE_API_KEY': JSON.stringify(env.VITE_CLAUDE_API_KEY || ''),
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
      extensions: ['.js', '.jsx', '.ts', '.tsx'],
    },
    server: {
      port: 3020, // 원래 포트로 복원
      open: true,
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:3003',
          changeOrigin: true,
          onError: (err, req, res) => {
            console.log('프록시 오류:', err);
          },
          onProxyReq: (proxyReq, req, res) => {
            console.log('프록시 요청:', req.method, req.url);
          },
          onProxyRes: (proxyRes, req, res) => {
            console.log('프록시 응답:', req.method, req.url);
          }
        }
      }
    },
    esbuild: {
      loader: 'jsx',
      include: /\.(jsx|js)$/,
      exclude: [],
    },
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'zustand',
        '@tanstack/react-query',
        '@toast-ui/editor'
      ]
    },
    build: {
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom'],
            'state-vendor': ['zustand', '@tanstack/react-query'],
            'ui-vendor': ['@toast-ui/editor', '@toast-ui/editor-plugin-code-syntax-highlight'],
            'utils-vendor': ['dexie', 'date-fns']
          }
        }
      },
      sourcemap: false,
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true
        }
      }
    },
  };
});