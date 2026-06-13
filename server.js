const express = require('express');
const path = require('path');
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const axios = require('axios');
const cheerio = require('cheerio');
const { NewMessage } = require("telegram/events");
const { EditedMessage } = require("telegram/events/EditedMessage");
const readline = require("readline");
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
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

const apiId = 21844566;
const apiHash = 'ff82e94bfed22534a083c3aee236761a';
const stringSession = new StringSession('1AQAOMTQ5LjE1NC4xNzUuNTcBu3pRs0iDn+zkBwp7GstSqzgn5gi6IHcLvdUmU3Q55rvKyASIjIfjB3stMLMD0qx6PZXvYycHqFFT9fLmoU5KGwMrutoVLC4rG7Xb8FpdeMA0qmrI7TI/iQ21KPqDxD3d0iqa8QFI7GzjduXzA0UIjx0dFS+GJ51Ofi1mZn7EAJQhoUspm5jXoZ4zFt1DYe6xpiRRDg0AykwdIaYFujs1P4A7GOzeaqE5+VDba6CBhEAUBiM9Gw4RPDoYNymuO5rDI1Cpauuk8wQKwUOjPUMM3zvHF5KaC1+/rdzXbf28bvqcocK1LB2Zqy54+WHTeq3Y2WN5rlMUl78kKtZsOFEDcrc=');
const grupoChatId = -1002208588695;

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
let client;

(async () => {
  try {
    client = new TelegramClient(stringSession, apiId, apiHash, { connectionRetries: 5 });
    await client.start({
      phoneNumber: async () => new Promise((resolve) => rl.question("Número: ", resolve)),
      password: async () => new Promise((resolve) => rl.question("Senha: ", resolve)),
      phoneCode: async () => new Promise((resolve) => rl.question("Código: ", resolve)),
      onError: (err) => console.log(err),
    });
    console.log("✅ Conectado ao Telegram!");
  } catch (err) {
    console.error('❌ Erro ao iniciar:', err);
  }
})();

async function gonzalesdados(url) {
  let browser;

  try {
    console.log('\n================================');
    console.log('🌐 ACESSANDO URL:', url);
    console.log('================================\n');

    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: true
    });

    const page = await browser.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36'
    );

    console.log('🚀 Abrindo página...');

    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    console.log('⏳ Aguardando Cloudflare...');

    await new Promise(resolve => setTimeout(resolve, 5000));

    const titulo = await page.title();

    console.log('📄 TÍTULO:', titulo);

    const html = await page.content();

    console.log('📏 HTML RECEBIDO:', html.length);

    const $ = cheerio.load(html);

    let resultadoFinal = {
      dados: null,
      fotos: []
    };

    console.log('🔍 Procurando imagens...');

    $('img').each((i, el) => {
      const src = $(el).attr('src');

      if (src && !src.startsWith('data:image')) {
        resultadoFinal.fotos.push(src);
        console.log(`🖼️ Imagem ${i + 1}:`, src);
      }
    });

    console.log(
      `📸 Total de imagens encontradas: ${resultadoFinal.fotos.length}`
    );

    console.log('🔍 Procurando JSON interno...');

    const jsonMatch = html.match(
      /(?:const|let|var)\s+(?:dadosPessoais|dados|resultado)\s*=\s*(\[.*?\]|\{.*?\});/s
    );

    if (jsonMatch?.[1]) {
      try {
        resultadoFinal.dados = eval(jsonMatch[1]);

        console.log('✅ JSON encontrado');
      } catch (e) {
        console.log('❌ Erro ao converter JSON');
        console.log(e.message);
      }
    }

    if (!resultadoFinal.dados) {
      console.log('🔍 Extraindo dados estruturados...');

      const dadosEstruturados = {};

      $('section.card, section.list, div.grid').each((i, section) => {
        const titulo =
          $(section).find('h3').text().trim() || 'Geral';

        if (!dadosEstruturados[titulo]) {
          dadosEstruturados[titulo] = {};
        }

        $(section)
          .find('article.field, div.item, div.grid > div')
          .each((j, field) => {
            const chave = $(field)
              .find('span')
              .first()
              .text()
              .trim();

            const valor = $(field)
              .find('strong')
              .first()
              .text()
              .trim();

            if (chave && valor) {
              dadosEstruturados[titulo][chave] = valor;

              console.log(`📌 ${chave}: ${valor}`);
            }
          });
      });

      if (Object.keys(dadosEstruturados).length) {
        resultadoFinal.dados = dadosEstruturados;
      }
    }

    console.log('\n================================');
    console.log('✅ EXTRAÇÃO FINALIZADA');
    console.log(
      JSON.stringify(resultadoFinal, null, 2)
    );
    console.log('================================\n');

    await browser.close();

    return resultadoFinal;
  } catch (error) {
    console.log('\n================================');
    console.log('❌ ERRO EM gonzalesdados');
    console.log('URL:', url);
    console.log('MSG:', error.message);
    console.log('STACK:', error.stack);
    console.log('================================\n');

    if (browser) {
      try {
        await browser.close();
      } catch {}
    }

    return null;
  }
}


// Função principal de consulta com escolha de botão
async function realizarConsultaComBotao(q, nomeBotaoDesejado = null) {
  const comando = "/cpf"; // Comando base é sempre /cpf
  console.log(`🚀 CONSULTA: ${comando} ${q} (Buscando botão: ${nomeBotaoDesejado || 'Primeiro disponível'})`);
  
  await client.sendMessage(grupoChatId, { message: `${comando} ${q}` });

  return new Promise((resolve) => {
    let linksProcessados = [];
    let respostaFinal = null;
    let jaClicou = false;
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

      if (markup?.rows) {
        let temLink = false;
        let botoesDisponiveis = [];

        for (const row of markup.rows) {
          for (const button of row.buttons) {
            if (button.url) {
              temLink = true;
              const extraido = await gonzalesdados(button.url);
              linksProcessados.push({
                texto: button.text,
                url: button.url,
                dados: extraido?.dados || null,
                fotos: extraido?.fotos || []
              });
            } else if (!temLink && button.data && !jaClicou) {
              botoesDisponiveis.push({ text: button.text, row: markup.rows.indexOf(row), col: row.buttons.indexOf(button) });
            }
          }
        }

        // Se encontrou links, finaliza
        if (temLink) {
          respostaFinal = texto;
          clearTimeout(timer);
          timer = setTimeout(finalizar, 1000);
          return;
        }

        // Se não tem link e tem botões de callback, vamos clicar
        if (botoesDisponiveis.length > 0 && !jaClicou) {
          let alvo = null;
          
          if (nomeBotaoDesejado) {
            // Procura o botão que contém o nome desejado (ex: "CNH", "CRED")
            alvo = botoesDisponiveis.find(b => b.text.toUpperCase().includes(nomeBotaoDesejado.toUpperCase()));
          }

          // Se não achou o específico ou não foi passado nome, pega o primeiro
          if (!alvo) alvo = botoesDisponiveis[0];

          console.log(`🔘 CLICANDO NO BOTÃO: ${alvo.text}`);
          jaClicou = true;
          try {
            await message.click({ i: alvo.row, j: alvo.col });
            clearTimeout(timer);
          } catch (e) {
            console.error('Erro ao clicar:', e.message);
            jaClicou = false; // Tenta novamente se falhar
          }
        }
      } else {
        if (!texto.includes('🔄') && !texto.includes('⏳') && !texto.includes('neymar')) {
          respostaFinal = texto;
          clearTimeout(timer);
          timer = setTimeout(finalizar, 3000);
        }
      }
    };

    client.addEventHandler(handler, new NewMessage({}));
    client.addEventHandler(handler, new EditedMessage({}));
    setTimeout(() => {
      client.removeEventHandler(handler);
      resolve({ status: false, erro: 'Tempo esgotado' });
    }, 60000);
  });
}

// ROTA PADRÃO (Pega o primeiro botão que aparecer)
app.get('/gonzales/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const { q } = req.query;
    if (!q) return res.json({ status: false, resultado: 'Informe o parâmetro ?q=' });

    console.log(`🚀 CONSULTA: /${type} ${q}`);
    await client.sendMessage(grupoChatId, { message: `/${type} ${q}` });

    const resultado = await new Promise((resolve) => {
      let linksProcessados = [];
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
