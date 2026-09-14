const express = require('express');
const path = require('path');

// ============================================================
// IMPORTS DO SEU PROJETO
// ============================================================
// Mantenha aqui os imports/declarações que você já usa para:
// client
// axios
// cheerio
// NewMessage
// EditedMessage
//
// Exemplo:
// const axios = require('axios');
// const cheerio = require('cheerio');
// const { NewMessage } = require('telegram/events');
// const { EditedMessage } = require('telegram/events');

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

  res.sendFile(filePathHtml, (err) => {
    if (!err) {
      return;
    }

    res.sendFile(filePathTxt, (err) => {
      if (!err) {
        return;
      }

      res.status(404).sendFile(
        path.join(__dirname, 'html', '404.html')
      );
    });
  });
});


// ============================================================
// FUNÇÃO PARA EXTRAIR DADOS DE URL
// ============================================================

async function extrairDadosDaUrl(url) {
  try {
    const response = await axios.get(url);

    const html = response.data;
    const $ = cheerio.load(html);

    const resultadoFinal = {
      dados: null,
      fotos: []
    };


    // --------------------------------------------------------
    // 1. EXTRAÇÃO DE FOTOS
    // --------------------------------------------------------

    $('img').each((i, el) => {
      const src = $(el).attr('src');

      if (
        src &&
        !src.includes('data:image')
      ) {
        resultadoFinal.fotos.push(src);
      }
    });


    // --------------------------------------------------------
    // 2. TENTATIVA DE EXTRAÇÃO DE JSON
    // --------------------------------------------------------

    const jsonMatch = html.match(
      /(?:const|let|var) (?:dadosPessoais|dados|resultado) = (\[.*?\]|\{.*?\});/s
    );

    if (jsonMatch && jsonMatch[1]) {
      try {
        resultadoFinal.dados = eval(jsonMatch[1]);
      } catch (e) {
        console.log(
          'Falha ao processar variável JSON, tentando HTML...'
        );
      }
    }


    // --------------------------------------------------------
    // 3. EXTRAÇÃO DE HTML ESTRUTURADO
    // --------------------------------------------------------

    if (!resultadoFinal.dados) {
      const dadosEstruturados = {};
      let secaoAtual = 'Geral';

      $('h2, p').each((i, el) => {
        const tag = el.tagName.toLowerCase();
        const texto = $(el).text().trim();

        if (tag === 'h2') {
          secaoAtual = texto;

          dadosEstruturados[secaoAtual] = {};
        }

        else if (
          tag === 'p' &&
          texto.includes(':')
        ) {
          const partes = texto.split(':');

          const chave = partes[0].trim();

          const valor = partes
            .slice(1)
            .join(':')
            .trim();

          if (secaoAtual === 'Geral') {
            dadosEstruturados[chave] = valor;
          } else {
            dadosEstruturados[secaoAtual][chave] = valor;
          }
        }
      });

      if (
        Object.keys(dadosEstruturados).length > 0
      ) {
        resultadoFinal.dados = dadosEstruturados;
      }
    }


    return resultadoFinal;

  } catch (error) {
    console.error(
      'Erro ao buscar dados da URL:',
      url,
      error.message
    );

    return null;
  }
}


// ============================================================
// CONSULTA COM BOTÃO
// ============================================================

async function realizarConsultaComBotao(q, nomeBotao) {
  try {

    if (!q) {
      return {
        status: false,
        erro: 'Informe o parâmetro ?q='
      };
    }


    // --------------------------------------------------------
    // ENVIA A CONSULTA
    // --------------------------------------------------------

    await client.sendMessage('@SantSearchhBot', {
      message: q
    });


    // --------------------------------------------------------
    // AGUARDA A RESPOSTA
    // --------------------------------------------------------

    const resultado = await new Promise((resolve, reject) => {

      let respostaFinal = null;
      let linksProcessados = [];
      let timer = null;
      let finalizado = false;


      // ------------------------------------------------------
      // FINALIZAR
      // ------------------------------------------------------

      const finalizar = () => {

        if (finalizado) {
          return;
        }

        finalizado = true;

        if (timer) {
          clearTimeout(timer);
        }

        client.removeEventHandler(handler);

        resolve({
          texto: respostaFinal,
          links: linksProcessados
        });
      };


      // ------------------------------------------------------
      // HANDLER
      // ------------------------------------------------------

      const handler = async (event) => {

        try {

          const message = event.message;

          if (!message) {
            return;
          }


          const texto = message.message || '';
          const markup = message.replyMarkup;


          // --------------------------------------------------
          // IGNORA MENSAGENS DE PROCESSAMENTO
          // --------------------------------------------------

          if (
            texto.includes('🔄') ||
            texto.includes('⏳') ||
            texto.includes('Processando')
          ) {
            return;
          }


          // --------------------------------------------------
          // MENSAGEM COM BOTÕES
          // --------------------------------------------------

          if (markup?.rows) {

            console.log(
              '💎 Resposta com botões detectada!'
            );


            let temLink = false;


            for (const row of markup.rows) {

              if (!row.buttons) {
                continue;
              }


              for (const button of row.buttons) {


                // ------------------------------------------
                // BOTÃO COM URL
                // ------------------------------------------

                if (button.url) {

                  temLink = true;

                  const extraido =
                    await extrairDadosDaUrl(
                      button.url
                    );


                  linksProcessados.push({
                    texto: button.text,
                    url: button.url,

                    dados:
                      extraido?.dados || null,

                    fotos:
                      extraido?.fotos || []
                  });

                }


                // ------------------------------------------
                // BOTÃO CALLBACK
                // ------------------------------------------

                else if (
                  !temLink &&
                  button.data
                ) {

                  // Só processa o botão solicitado
                  const textoBotao =
                    String(button.text || '')
                      .toUpperCase();

                  const nomeSolicitado =
                    String(nomeBotao || '')
                      .toUpperCase();


                  if (
                    textoBotao.includes(
                      nomeSolicitado
                    )
                  ) {

                    console.log(
                      `🔘 CLICANDO NO BOTÃO: ${button.text}`
                    );


                    try {

                      await message.click({
                        i: markup.rows.indexOf(row),
                        j: row.buttons.indexOf(button)
                      });


                      // Reinicia o timer
                      clearTimeout(timer);

                      return;

                    } catch (e) {

                      console.error(
                        'Erro ao clicar no botão:',
                        e.message
                      );
                    }
                  }
                }
              }
            }


            // ------------------------------------------------
            // ENCONTROU LINKS
            // ------------------------------------------------

            if (temLink) {

              respostaFinal = texto;

              clearTimeout(timer);

              timer = setTimeout(
                finalizar,
                1000
              );
            }
          }


          // --------------------------------------------------
          // APENAS TEXTO
          // --------------------------------------------------

          else {

            if (
              !texto.includes('🔄') &&
              !texto.includes('⏳') &&
              !texto.includes('neymar')
            ) {

              respostaFinal = texto;

              clearTimeout(timer);

              timer = setTimeout(
                finalizar,
                3000
              );
            }
          }

        } catch (error) {

          console.error(
            'Erro no handler:',
            error.message
          );
        }
      };


      // ------------------------------------------------------
      // ESCUTA NOVAS MENSAGENS
      // ------------------------------------------------------

      client.addEventHandler(
        handler,
        new NewMessage({})
      );


      // ------------------------------------------------------
      // ESCUTA MENSAGENS EDITADAS
      // ------------------------------------------------------

      client.addEventHandler(
        handler,
        new EditedMessage({})
      );


      // ------------------------------------------------------
      // TIMEOUT DE SEGURANÇA
      // ------------------------------------------------------

      setTimeout(() => {

        if (finalizado) {
          return;
        }

        finalizado = true;

        if (timer) {
          clearTimeout(timer);
        }

        client.removeEventHandler(handler);

        resolve({
          status: false,
          erro: 'Tempo esgotado'
        });

      }, 30000);

    });


    return {
      status: true,
      resultado
    };


  } catch (err) {

    console.error(
      'Erro em realizarConsultaComBotao:',
      err
    );

    return {
      status: false,
      resultado: 'Erro interno'
    };
  }
}


// ============================================================
// ROTAS ESPECÍFICAS
// ============================================================

app.get('/credlink', async (req, res) => {

  try {

    const { q } = req.query;

    const resultado =
      await realizarConsultaComBotao(
        q,
        'CRED'
      );

    res.json(resultado);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      status: false,
      resultado: 'Erro interno'
    });
  }
});


app.get('/cnh', async (req, res) => {

  try {

    const { q } = req.query;

    const resultado =
      await realizarConsultaComBotao(
        q,
        'CNH'
      );

    res.json(resultado);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      status: false,
      resultado: 'Erro interno'
    });
  }
});


app.get('/cadsus', async (req, res) => {

  try {

    const { q } = req.query;

    const resultado =
      await realizarConsultaComBotao(
        q,
        'CADSUS'
      );

    res.json(resultado);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      status: false,
      resultado: 'Erro interno'
    });
  }
});


app.get('/sipni', async (req, res) => {

  try {

    const { q } = req.query;

    const resultado =
      await realizarConsultaComBotao(
        q,
        'PNI'
      );

    res.json(resultado);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      status: false,
      resultado: 'Erro interno'
    });
  }
});


// ============================================================
// CONSULTA GENÉRICA
// ============================================================

app.get('/consulta/:comando', async (req, res) => {

  try {

    const comando =
      req.params.comando;

    const q =
      req.query.q;


    if (!q) {

      return res.json({
        status: false,
        resultado:
          'Informe o parâmetro ?q='
      });
    }


    // --------------------------------------------------------
    // ENVIA CONSULTA
    // --------------------------------------------------------

    await client.sendMessage(
      '@SantSearchhBot',
      {
        message: `/${comando} ${q}`
      }
    );


    // --------------------------------------------------------
    // AGUARDA RESPOSTA
    // --------------------------------------------------------

    const resultado =
      await new Promise((resolve, reject) => {

        let finalizado = false;


        const handler =
          async (event) => {

            try {

              const message =
                event.message;

              if (!message) {
                return;
              }


              const texto =
                message.message || '';


              // --------------------------------------------
              // IGNORA PROCESSAMENTO
              // --------------------------------------------

              if (
                texto.includes('🔄') ||
                texto.includes('⏳') ||
                texto.includes('Processando')
              ) {
                return;
              }


              const links = [];

              const markup =
                message.replyMarkup;


              // --------------------------------------------
              // BOTÕES
              // --------------------------------------------

              if (markup?.rows) {

                for (
                  const row of markup.rows
                ) {

                  if (!row.buttons) {
                    continue;
                  }


                  for (
                    const button of row.buttons
                  ) {

                    if (button.url) {

                      const extraido =
                        await extrairDadosDaUrl(
                          button.url
                        );


                      links.push({
                        texto:
                          button.text,

                        url:
                          button.url,

                        dados:
                          extraido?.dados ||
                          null,

                        fotos:
                          extraido?.fotos ||
                          []
                      });
                    }
                  }
                }
              }


              if (finalizado) {
                return;
              }

              finalizado = true;


              client.removeEventHandler(
                handler
              );


              resolve({
                texto,
                links
              });

            } catch (err) {

              console.error(
                'Erro no handler:',
                err
              );
            }
          };


        // ----------------------------------------------
        // ESCUTA NOVAS MENSAGENS
        // ----------------------------------------------

        client.addEventHandler(
          handler,
          new NewMessage({})
        );


        // ----------------------------------------------
        // TIMEOUT
        // ----------------------------------------------

        setTimeout(() => {

          if (finalizado) {
            return;
          }

          finalizado = true;

          client.removeEventHandler(
            handler
          );

          reject(
            new Error(
              'Tempo esgotado'
            )
          );

        }, 30000);

      });


    return res.json({
      status: true,
      resultado
    });


  } catch (err) {

    console.error(err);

    return res.json({
      status: false,
      resultado: 'Erro interno'
    });
  }
});


// ============================================================
// 404 — DEVE SER A ÚLTIMA ROTA
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
