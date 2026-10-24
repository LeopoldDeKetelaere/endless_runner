import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// Het adres /admin (zonder .html) moet admin.html tonen, ook tijdens het ontwikkelen.
// (Op Vercel regelt vercel.json dat.)
function adminAdres() {
  const herschrijf = (verzoek, antwoord, volgende) => {
    const pad = (verzoek.url ?? '').split('?')[0];
    if (pad === '/admin' || pad === '/admin/') verzoek.url = '/admin.html' + (verzoek.url.includes('?') ? '?' + verzoek.url.split('?')[1] : '');
    volgende();
  };
  return {
    name: 'admin-adres',
    configureServer(server) { server.middlewares.use(herschrijf); },
    configurePreviewServer(server) { server.middlewares.use(herschrijf); },
  };
}

export default defineConfig({
  plugins: [adminAdres()],
  build: {
    // Twee pagina's: het spel (index.html) en de adminpagina (admin.html)
    rolldownOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        admin: fileURLToPath(new URL('./admin.html', import.meta.url)),
      },
    },
  },
});
