const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
function decodePageContent(html) {
  const arrays=[]; const arrayRegex=/\b(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*\[((?:[\s\S]*?))\]/g; let match;
  while ((match=arrayRegex.exec(html))!==null) { const numeros=[...match[2].matchAll(/-?\d+/g)].map(item=>Number(item[0])); if(numeros.length) arrays.push({nome:match[1],numeros}); }
  let chaveArray=null;
  for(const array of arrays){ const nome=array.nome.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); if(new RegExp(`charCodeAt\\s*\\([^)]*\\)\\s*\\^\\s*${nome}\\s*\\[`, 'i').test(html)){chaveArray=array;break;} }
  if(!chaveArray){const xorMatch=html.match(/charCodeAt\s*\([^)]*\)\s*\^\s*([A-Za-z_$][\w$]*)\s*\[/i); if(xorMatch) chaveArray=arrays.find(item=>item.nome===xorMatch[1])||null;}
  if(!chaveArray) throw new Error('Rotina XOR ou chave numérica não encontrada.');
  const atobMatch=html.match(/\batob\s*\(\s*(["'`])([\s\S]*?)\1\s*\)/); if(!atobMatch) throw new Error('Nenhuma chamada atob() encontrada.');
  const dados=Buffer.from(atobMatch[2].replace(/\s/g,'').replace(/-/g,'+').replace(/_/g,'/'),'base64'); const chave=Buffer.from(chaveArray.numeros.map(numero=>numero&0xff)); const resultado=Buffer.allocUnsafe(dados.length);
  for(let i=0;i<dados.length;i++) resultado[i]=dados[i]^chave[i%chave.length];
  return resultado.toString('utf8').replace(/\\x([0-9a-f]{2})/gi,(_,hex)=>String.fromCharCode(parseInt(hex,16))).replace(/\\u([0-9a-f]{4})/gi,(_,hex)=>String.fromCharCode(parseInt(hex,16)));
}
async function scrapeMulticanaisPage(sourceUrl){
  const response=await axios.get(sourceUrl,{headers:{'User-Agent':'Mozilla/5.0',Accept:'text/html,application/xhtml+xml'},timeout:30000,maxRedirects:5,responseType:'text'});
  const $=cheerio.load(decodePageContent(response.data)); const players=[];
  $('[data-player-id]').each((_,el)=>{const id=$(el).attr('data-player-id'); const embed=$(el).attr('data-embed')||''; const nome=$(el).find('.label').text().trim()||$(el).text().trim(); if(id&&embed&&!players.some(player=>player.id===id)) players.push({id,nome,embed});});
  return {success:true,titulo:$('h1').first().text().trim()||$('title').text().trim(),imagem:$('meta[property="og:image"]').attr('content')||$('meta[name="twitter:image"]').attr('content')||null,time1:$('#mcchat').attr('data-home')||'',time2:$('#mcchat').attr('data-away')||'',playerAtivo:$('#player-iframe').attr('src')||'',players};
}
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


app.get('/api/assista', async (req, res) => {
  const sourceUrl = req.query.url;
  if (!sourceUrl) return res.status(400).json({ success: false, error: 'Parâmetro url não informado' });
  try { return res.json(await scrapeMulticanaisPage(sourceUrl)); }
  catch (error) { console.error('Erro ao consultar página do Multicanais:', error.message); return res.status(502).json({ success: false, error: 'Não foi possível ler a página do Multicanais' }); }
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
