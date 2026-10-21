const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// PROXY DAS APIS DE TV AO VIVO
// Mantém os endpoints sem CORS do EmbedTV acessíveis ao frontend.
// ============================================================
const API_SOURCES = {
  rei: {
    channels: 'https://api.reidoscanais.si/channels',
    sports: 'https://api.reidoscanais.si/sports'
  },
  reidosembeds: {
    channels: 'https://reidosembeds.lat/api/channels',
    events: 'https://reidosembeds.lat/api/eventos'
  },
  embedtv: {
    channels: 'https://embedtv.cc/api/channels',
    events: 'https://embedtv.cc/api/events',
    epg_all: 'https://embedtv.cc/api/epg_all'
  }
};

app.get('/api-proxy/:source/:resource', async (req, res) => {
  const source = API_SOURCES[req.params.source];
  const target = source && source[req.params.resource];

  if (!target) {
    return res.status(404).json({ success: false, error: 'Endpoint não configurado' });
  }

  try {
    const response = await fetch(target, {
      headers: { 'User-Agent': 'Iracemaflix/1.0' }
    });
    const body = await response.text();
    res.status(response.status);
    res.type(response.headers.get('content-type') || 'application/json');
    return res.send(body);
  } catch (error) {
    console.error(`Erro no proxy ${req.params.source}/${req.params.resource}:`, error.message);
    return res.status(502).json({ success: false, error: 'Fonte externa indisponível' });
  }
});


// ============================================================
// BLOQUEAR ARQUIVOS .JS
// ============================================================

app.use((req, res, next) => {
  if (req.url.endsWith('.js')) {
    return res.status(403).send('Acesso negado');
  }

  next();
});


// ============================================================
// ARQUIVOS ESTÁTICOS
// ============================================================

app.use(express.static(path.join(__dirname)));


// ============================================================
// PÁGINA INICIAL
// ============================================================

app.get('/', (req, res) => {
  res.sendFile(
    path.join(__dirname, 'html', 'index.html')
  );
});


// ============================================================
// PÁGINAS HTML / TXT
// ============================================================

app.get('/:page', (req, res) => {
  const page = req.params.page;

  const filePathHtml = path.join(
    __dirname,
    'html',
    `${page}.html`
  );

  const filePathTxt = path.join(
    __dirname,
    'html',
    `${page}.txt`
  );


  // Primeiro tenta HTML
  res.sendFile(filePathHtml, (err) => {

    if (!err) {
      return;
    }


    // Se não existir HTML, tenta TXT
    res.sendFile(filePathTxt, (err) => {

      if (!err) {
        return;
      }


      // Se não existir nenhum dos dois
      res.status(404).sendFile(
        path.join(
          __dirname,
          'html',
          '404.html'
        )
      );

    });

  });
});


// ============================================================
// 404
// ============================================================

app.use((req, res) => {
  res.status(404).sendFile(
    path.join(
      __dirname,
      'html',
      '404.html'
    )
  );
});


// ============================================================
// INICIAR SERVIDOR
// ============================================================

app.listen(PORT, () => {
  console.log(
    `Servidor rodando na porta ${PORT}`
  );
});
