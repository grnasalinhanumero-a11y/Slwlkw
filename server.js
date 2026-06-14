const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
// bloquear arquivos.js
app.use((req, res, next) => {
  if (req.url.endsWith('.js')) {
    return res.status(403).send('Acesso negado');
  }
  next();
});
// Define o diretório público para servir os arquivos estáticos
app.use(express.static(path.join(__dirname)));

// Rota para servir o arquivo index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, './html/index.html'));
});

app.get('/:page', (req, res) => {
  const page = req.params.page;
  const filePathHtml = path.join(__dirname, 'html', `${page}.html`);
  const filePathTxt = path.join(__dirname, 'html', `${page}.txt`);

  res.sendFile(filePathHtml, (err) => {
    if (err) {
      res.sendFile(filePathTxt, (err) => {
        if (err) {
          res.status(404).sendFile(path.join(__dirname, 'html', '404.html'));
        }
      });
    }
  });
});


// Rota para lidar com erros 404 e enviar a página de erro personalizada
app.use((req, res, next) => {
  res.status(404).sendFile(path.join(__dirname, './html/404.html'));
});

// Inicia o servidor
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));

      let respostaFinal = null;
      let timer;

      const finalizar = () => {
        client.removeEventHandler(handler);
        resolve({ texto: respostaFinal, links: linksProcessados });
      };

      const handler = async (event) => {
        const message = event.message;
        if (!message) return;
        
        const texto = message.message || '';
        const markup = message.replyMarkup;

        // Se a mensagem tiver botões, vamos analisar
        if (markup?.rows) {
          console.log('💎 Resposta com botões detectada!');
          
          let temLink = false;
          for (const row of markup.rows) {
            for (const button of row.buttons) {
              // SE FOR UM BOTÃO DE LINK (URL): Processa os dados
              if (button.url) {
                temLink = true;
                const extraido = await gonzalesdados(button.url);
                linksProcessados.push({
                  texto: button.text,
                  url: button.url,
                  dados: extraido?.dados || null,
                  fotos: extraido?.fotos || []
                });
              } 
              // SE FOR UM BOTÃO DE CALLBACK (ESCOLHA DE BASE): Clica nele!
              else if (!temLink && button.data) {
                console.log(`🔘 CLICANDO NO BOTÃO: ${button.text}`);
                try {
                  await message.click({
                    i: markup.rows.indexOf(row),
                    j: row.buttons.indexOf(button)
                  });
                  // Reinicia o timer para esperar a resposta da base clicada
                  clearTimeout(timer);
                  return; 
                } catch (e) {
                  console.error('Erro ao clicar no botão:', e.message);
                }
              }
            }
          }

          if (temLink) {
            respostaFinal = texto;
            clearTimeout(timer);
            timer = setTimeout(finalizar, 1000);
          }
        } else {
          // Se for só texto, mas não for loading, guardamos como backup
          if (!texto.includes('🔄') && !texto.includes('⏳') && !texto.includes('neymar')) {
            respostaFinal = texto;
            clearTimeout(timer);
            timer = setTimeout(finalizar, 3000); // Espera um pouco mais pra ver se ela será editada
          }
        }
      };

      // Escuta tanto novas mensagens quanto edições
      client.addEventHandler(handler, new NewMessage({}));
      client.addEventHandler(handler, new EditedMessage({}));

      // Timeout de segurança global (30s)
      setTimeout(() => {
        client.removeEventHandler(handler);
        resolve({ status: false, erro: 'Tempo esgotado' });
      }, 30000);
    });

    return res.json({ status: true, resultado });
  } catch (err) {
    console.error(err);
    return res.json({ status: false, resultado: 'Erro interno' });
  }
});

// ROTAS ESPECÍFICAS MAPEADAS PARA O NOME DO BOTÃO
app.get('/credlink', async (req, res) => {
  const { q } = req.query;
  const resultado = await realizarConsultaComBotao(q, 'CRED'); // Clica no botão que tem 'CRED'
  res.json({ status: true, resultado });
});

app.get('/cnh', async (req, res) => {
  const { q } = req.query;
  const resultado = await realizarConsultaComBotao(q, 'CNH'); // Clica no botão que tem 'CNH'
  res.json({ status: true, resultado });
});

app.get('/cadsus', async (req, res) => {
  const { q } = req.query;
  const resultado = await realizarConsultaComBotao(q, 'CADSUS'); // Clica no botão que tem 'CADSUS'
  res.json({ status: true, resultado });
});

app.get('/sipni', async (req, res) => {
  const { q } = req.query;
  const resultado = await realizarConsultaComBotao(q, 'PNI'); // Clica no botão que tem 'PNI'
  res.json({ status: true, resultado });
});


async function extrairDadosDaUrl(url) {
  try {
    const response = await axios.get(url);
    const html = response.data;
    const $ = cheerio.load(html);
    
    let resultadoFinal = {
      dados: null,
      fotos: []
    };

    // 1. EXTRAÇÃO DE FOTOS
    // Busca todas as tags <img> e pega o atributo src
    $('img').each((i, el) => {
      const src = $(el).attr('src');
      if (src && !src.includes('data:image')) { // Ignora imagens em base64 se houver
        resultadoFinal.fotos.push(src);
      }
    });

    // 2. EXTRAÇÃO DE DADOS (TENTATIVA 1: JSON em variáveis)
    const jsonMatch = html.match(/(?:const|let|var) (?:dadosPessoais|dados|resultado) = (\[.*?\]|\{.*?\});/s);
    if (jsonMatch && jsonMatch[1]) {
      try {
        resultadoFinal.dados = eval(jsonMatch[1]);
      } catch (e) {
        console.log('Falha ao processar variável JSON, tentando HTML...');
      }
    }

    // 3. EXTRAÇÃO DE DADOS (TENTATIVA 2: HTML Estruturado)
    if (!resultadoFinal.dados) {
      const dadosEstruturados = {};
      let secaoAtual = "Geral";

      $('h2, p').each((i, el) => {
        const tag = el.tagName.toLowerCase();
        const texto = $(el).text().trim();

        if (tag === 'h2') {
          secaoAtual = texto;
          dadosEstruturados[secaoAtual] = {};
        } else if (tag === 'p' && texto.includes(':')) {
          const partes = texto.split(':');
          const chave = partes[0].trim();
          const valor = partes.slice(1).join(':').trim();
          
          if (secaoAtual === "Geral") {
            dadosEstruturados[chave] = valor;
          } else {
            dadosEstruturados[secaoAtual][chave] = valor;
          }
        }
      });

      if (Object.keys(dadosEstruturados).length > 0) {
        resultadoFinal.dados = dadosEstruturados;
      }
    }

    return resultadoFinal;
  } catch (error) {
    console.error('Erro ao buscar dados da URL:', url, error.message);
    return null;
  }
}

app.get('/consulta/:comando', async (req, res) => {
  try {
    const comando = req.params.comando;
    const q = req.query.q;

    if (!q) {
      return res.json({ status: false, resultado: 'Informe o parâmetro ?q=' });
    }

    await client.sendMessage('@SantSearchhBot', {
      message: `/${comando} ${q}`
    });

    const resultado = await new Promise((resolve, reject) => {
      const handler = async (event) => {
        try {
          const message = event.message;
          if (!message) return;

          const texto = message.message || '';

          if (texto.includes('🔄') || texto.includes('⏳') || texto.includes('Processando')) {
            return;
          }

          let links = [];
          const markup = message.replyMarkup;

          if (markup?.rows) {
            for (const row of markup.rows) {
              for (const button of row.buttons) {
                if (button.url) {
                  // Agora extrai tanto os DADOS quanto as FOTOS
                  const extraido = await extrairDadosDaUrl(button.url);
                  
                  links.push({
                    texto: button.text,
                    url: button.url,
                    dados: extraido?.dados || null,
                    fotos: extraido?.fotos || []
                  });
                }
              }
            }
          }

          client.removeEventHandler(handler);
          resolve({ texto, links });

        } catch (err) {
          console.error('Erro no handler:', err);
        }
      };

      client.addEventHandler(handler, new NewMessage({}));
      setTimeout(() => {
        client.removeEventHandler(handler);
        reject(new Error('Tempo esgotado'));
      }, 30000);
    });

    return res.json({
      status: true,
      resultado
    });

  } catch (err) {
    console.error(err);
    return res.json({ status: false, resultado: 'Erro interno' });
  }
});
                     

// Rota para lidar com erros 404 e enviar a página de erro personalizada
app.use((req, res, next) => {
  res.status(404).sendFile(path.join(__dirname, './html/404.html'));
});

// Inicia o servidor
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
