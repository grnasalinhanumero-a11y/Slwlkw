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
const stringSession = new StringSession('1AQAOMTQ5LjE1NC4xNzUuNTcBu0J5K8bR+JcYc9I5HFY5UdjVArBg7Rb0oNMTSepXlWv2u+Lwgn6V7D555NtV8j2q961wqrzwzvWJEqxclc3poDru/+ZiQWQr3HuhoYnYx+mG7e6G+zo+/i7FO1Rx0E6RvGLaCfeBW9PIvM1lb9Ux66xLA+p8V5MEKKranw4PD7ah0RaQlR4rI6yawt3JiKbBZaxjxlRSC8y2nyQAWsivDS9xSghGIuj3XFnsbyNRcwd1GiJEO+G9Tfua2hRZ1vFKP8SzXLIjD8uR6GdpBASGL9SGlxIeNmuwTvOeyDbi/MXjvG7JZrJ+9eDNh8x7DHnFnwLM9bQxhmmsQUiKYmivUWE=');
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
  let browser = null;
  try {
    console.log('\n================================');
    console.log('🌐 ACESSANDO URL (PUPPETEER):', url);
    console.log('================================\n');

    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();
    
    // Configura User Agent realista
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');

    // Tenta acessar a URL
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Aguarda um pouco para garantir que scripts de proteção rodem
    await new Promise(r => setTimeout(r, 2000));

    const html = await page.content();
    const $ = cheerio.load(html);

    let resultadoFinal = {
      dados: null,
      fotos: []
    };

    // 1. EXTRAÇÃO DE FOTOS
    $('img').each((i, el) => {
      let src = $(el).attr('src') || $(el).attr('data-src');
      if (src && !src.includes('data:image') && !src.includes('base64')) {
        if (src.startsWith('//')) src = 'https:' + src;
        else if (src.startsWith('/')) {
            const urlObj = new URL(url);
            src = urlObj.origin + src;
        }
        if (!resultadoFinal.fotos.includes(src)) resultadoFinal.fotos.push(src);
      }
    });

    // 2. EXTRAÇÃO DE JSON (Executa direto no contexto da página se possível)
    const pageData = await page.evaluate(() => {
        const vars = ['dadosPessoais', 'dados', 'resultado', 'userData', 'info'];
        for (const v of vars) {
            if (window[v]) return window[v];
        }
        return null;
    });

    if (pageData) {
        resultadoFinal.dados = pageData;
        console.log('✅ JSON extraído via contexto do Navegador');
    } else {
        // Fallback: Busca no HTML via Cheerio
        const scriptContent = $('script').map((i, el) => $(el).html()).get().join('\n');
        const jsonMatch = scriptContent.match(/(?:const|let|var|window\.)(?:dadosPessoais|dados|resultado|userData|info) = (\{[\s\S]*?\}|\[[\s\S]*?\]);/);
        if (jsonMatch && jsonMatch[1]) {
            try {
                resultadoFinal.dados = eval(`(${jsonMatch[1].trim().replace(/;$/, '')})`);
            } catch (e) {}
        }
    }

    // 3. EXTRAÇÃO ESTRUTURADA (Heurística)
    if (!resultadoFinal.dados) {
      const dadosEstruturados = {};
      $('section.card, .result-box, .data-section, table').each((i, section) => {
        const $section = $(section);
        let titulo = $section.find('h3, h2, .title, th').first().text().trim() || `Info_${i+1}`;
        const campos = {};
        $section.find('p, div, li, tr').each((j, item) => {
            const $item = $(item);
            const label = $item.find('span, label, b, strong, td:first-child').first().text().replace(':', '').trim();
            const value = $item.find('strong, span, .val, td:last-child').last().text().trim();
            if (label && value && label !== value && label.length < 50) campos[label] = value;
        });
        if (Object.keys(campos).length > 0) dadosEstruturados[titulo] = campos;
      });
      if (Object.keys(dadosEstruturados).length > 0) resultadoFinal.dados = dadosEstruturados;
    }

    console.log('✅ Extração concluída com sucesso');
    return resultadoFinal;
  } catch (error) {
    console.error('\n❌ ERRO NO PUPPETEER:', error.message);
    return { dados: null, fotos: [], erro: error.message };
  } finally {
    if (browser) await browser.close();
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
