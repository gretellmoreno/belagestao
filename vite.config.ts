import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import fs from 'fs';
import path from 'path';

// Plugin personalizado para criar arquivos de redirecionamento
const createRedirectsPlugin = () => {
  return {
    name: 'create-redirects',
    closeBundle: () => {
      // Verifica se o diretório dist existe
      if (fs.existsSync('dist')) {
        // Cria o arquivo _redirects para Netlify
        fs.writeFileSync('dist/_redirects', '/* /index.html 200');
        console.log('Arquivo _redirects criado com sucesso!');
        
        // Cria o arquivo 404.html para GitHub Pages
        const notFoundContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Redirecionando...</title>
  <script>
    // Armazena a URL atual para redirecionamento
    sessionStorage.setItem('redirectUrl', window.location.href);
    // Redireciona para a página inicial
    window.location.href = '/';
  </script>
</head>
<body>
  <p>Redirecionando para a página inicial...</p>
</body>
</html>
        `;
        fs.writeFileSync('dist/404.html', notFoundContent.trim());
        console.log('Arquivo 404.html criado com sucesso!');
        
        // Cria arquivo .htaccess para Apache
        const htaccessContent = `
RewriteEngine On
RewriteBase /
RewriteRule ^index\.html$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteCond %{REQUEST_FILENAME} !-l
RewriteRule . /index.html [L]
        `;
        fs.writeFileSync('dist/.htaccess', htaccessContent.trim());
        console.log('Arquivo .htaccess criado com sucesso!');
        
        // Copia arquivos da pasta public para dist se existir
        const publicDir = path.resolve(__dirname, 'public');
        if (fs.existsSync(publicDir)) {
          // Verifica se existe o arquivo .htaccess na pasta public
          const publicHtaccess = path.resolve(publicDir, '.htaccess');
          if (fs.existsSync(publicHtaccess)) {
            fs.copyFileSync(publicHtaccess, 'dist/.htaccess');
            console.log('Arquivo .htaccess copiado da pasta public');
          }
        }
      }
    }
  };
};

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    createRedirectsPlugin() // Adiciona o plugin personalizado
  ],
  // Configuração de cache para evitar requisições desnecessárias
  server: {
    hmr: {
      overlay: false, // Desabilita overlay para reduzir requisições
    },
  },
  optimizeDeps: {
    include: [
      'react', 
      'react-dom', 
      'react-router-dom',
      'date-fns',
      'lodash',
      'react-toastify',
      'framer-motion'
    ],
    // Evite excluir bibliotecas para melhorar o bundle
    // exclude: ['lucide-react'],
  },
  build: {
    // Reduza o número de chunks usando o manualChunks
    cssCodeSplit: false, // Gera um único arquivo CSS
    sourcemap: false, // Desativa sourcemaps em produção
    minify: 'terser', // Minificador mais eficiente
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.logs
        drop_debugger: true, // Remove debugger statements
      },
    },
    rollupOptions: {
      output: {
        // Reduz o número de chunks criados
        manualChunks: {
          vendor: [
            'react', 
            'react-dom', 
            'react-router-dom',
            'framer-motion',
            'date-fns',
            'lodash',
          ]
        },
        // Limita número de arquivos js
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
      input: {
        main: resolve(__dirname, 'index.html'),
      },
    },
  },
});
