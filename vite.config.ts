import path from 'path';
import { execSync } from 'child_process';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const buildInfo = (() => {
  try {
    const commit = execSync('git rev-parse --short HEAD').toString().trim();
    return {
      commit,
      buildTime: new Date().toISOString()
    } as const;
  } catch (error) {
    console.warn('[Desk] Failed to read git metadata for build stamp', error);
    return {
      commit: 'unknown',
      buildTime: new Date().toISOString()
    } as const;
  }
})();

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    envPrefix: 'VITE_',
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      __BUILD_INFO__: JSON.stringify(buildInfo)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
