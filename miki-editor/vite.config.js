import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  // .env 파일 로드
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react()],
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
          target:'http://127.0.0.1:3003',
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