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
  try {
    console.log('\n================================');
    console.log('🌐 ACESSANDO URL (STEALTH MODE):', url);
    console.log('================================\n');

    // CONFIGURAÇÃO DE HEADERS AVANÇADA PARA EVITAR 403
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'max-age=0',
      'Referer': 'https://www.google.com/' // Simula que veio do Google
    };

    const response = await axios.get(url, {
      timeout: 20000,
      headers: headers,
      maxRedirects: 5,
      validateStatus: (status) => status < 500 // Aceita 403 para debug
    });

    if (response.status === 403) {
        console.error('❌ ERRO 403: O site bloqueou o servidor cloud.');
        console.log('💡 DICA: Se o erro persistir, você precisará usar um Proxy Residencial.');
        return { dados: null, fotos: [], erro: 'Bloqueio 403 (Cloud detectado)' };
    }

    console.log('✅ STATUS:', response.status);
    const html = response.data;
    const $ = cheerio.load(html);

    let resultadoFinal = {
      dados: null,
      fotos: []
    };

    // --- LÓGICA DE EXTRAÇÃO (MESMA DO TESTE BEM SUCEDIDO) ---
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

    const scriptContent = $('script').map((i, el) => $(el).html()).get().join('\n');
    const jsonMatch = scriptContent.match(/(?:const|let|var|window\.)(?:dadosPessoais|dados|resultado|userData|info) = (\{[\s\S]*?\}|\[[\s\S]*?\]);/);

    if (jsonMatch && jsonMatch[1]) {
      try {
        let rawJson = jsonMatch[1].trim().replace(/;$/, '');
        try {
            resultadoFinal.dados = JSON.parse(rawJson);
        } catch (e) {
            resultadoFinal.dados = eval(`(${rawJson})`);
        }
      } catch (e) {}
    }

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

      if (Object.keys(dadosEstruturados).length > 0) {
        resultadoFinal.dados = dadosEstruturados;
      } else {
        // Fallback final: busca texto puro com ":"
        $('p').each((i, p) => {
            const t = $(p).text().trim();
            if (t.includes(':')) {
                const parts = t.split(':');
                if (parts[0].length < 40) dadosEstruturados[parts[0].trim()] = parts.slice(1).join(':').trim();
            }
        });
        if (Object.keys(dadosEstruturados).length > 0) resultadoFinal.dados = dadosEstruturados;
      }
    }

    return resultadoFinal;
  } catch (error) {
    console.error('\n❌ ERRO NA REQUISIÇÃO:', error.message);
    return { dados: null, fotos: [], erro: error.message };
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
