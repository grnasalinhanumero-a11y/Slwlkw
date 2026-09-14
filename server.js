const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;


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
