const express = require('express');
const { chromium } = require('playwright');
const { parseBoletos } = require('./parser');

const { SENAC_USER, SENAC_PASS, API_TOKEN, PORT = 3100 } = process.env;
if (!SENAC_USER || !SENAC_PASS || !API_TOKEN) {
  console.error('Faltam variaveis: SENAC_USER, SENAC_PASS, API_TOKEN');
  process.exit(1);
}

const fs = require('fs/promises');

// O link "Gerar Boleto" pode devolver: o PDF direto, um download,
// uma pagina com o PDF num iframe/embed, ou o boleto em HTML.
// Tenta nessa ordem e, no ultimo caso, imprime a pagina como PDF.
async function baixarPdf(context, url) {
  const page = await context.newPage();
  try {
    const download = page.waitForEvent('download', { timeout: 20000 }).catch(() => null);
    let resp = null;
    try {
      resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    } catch (e) {
      if (!/download/i.test(e.message)) throw e;
    }

    // 1) virou download
    if (!resp) {
      const d = await download;
      if (!d) throw new Error('nem pagina nem download');
      return { buffer: await fs.readFile(await d.path()), origem: 'download' };
    }

    // 2) resposta ja e o PDF
    const tipo = resp.headers()['content-type'] || '';
    if (tipo.includes('pdf')) return { buffer: await resp.body(), origem: 'pdf-direto' };

    // 3) pagina com o PDF embutido
    const src = await page.evaluate(() => {
      const el = document.querySelector('iframe[src], embed[src], object[data], frame[src]');
      return el ? el.src || el.data : null;
    });
    if (src) {
      const r = await context.request.get(new URL(src, page.url()).toString());
      if (r.ok() && (r.headers()['content-type'] || '').includes('pdf')) {
        return { buffer: await r.body(), origem: 'pdf-embutido' };
      }
    }

    // 4) boleto em HTML: imprime como PDF
    await page.emulateMedia({ media: 'print' });
    const buffer = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' } });
    return { buffer, origem: 'html-impresso' };
  } finally {
    await page.close();
  }
}

const LOGIN_URL = 'https://apsweb.senacrs.com.br/modulos/aluno/login.php5';

async function buscarBoletos({ comPdf }) {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ locale: 'pt-BR', acceptDownloads: true });
    const page = await context.newPage();

    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
    await page.fill('#usr-login', SENAC_USER);
    await page.fill('#usr-password', SENAC_PASS);
    await Promise.all([
      page.waitForURL((u) => !u.pathname.endsWith('login.php5'), { timeout: 30000 }),
      page.click('#btnEntrar'),
    ]).catch(() => {
      throw new Error('Login falhou (senha errada ou portal mudou)');
    });

    await page.waitForSelector('table', { timeout: 30000 });
    const boletos = parseBoletos(await page.content());

    if (comPdf) {
      for (const b of boletos) {
        if (!b.pdfUrl) continue;
        try {
          const r = await baixarPdf(context, b.pdfUrl);
          b.pdfBase64 = r.buffer.toString('base64');
          b.pdfOrigem = r.origem;
        } catch (e) {
          b.pdfErro = e.message;
        }
      }
    }
    return boletos;
  } finally {
    await browser.close();
  }
}

const app = express();

app.use((req, res, next) => {
  if (req.get('x-api-token') !== API_TOKEN) return res.status(401).json({ erro: 'token invalido' });
  next();
});

let rodando = false;
app.get('/senac/boletos', async (req, res) => {
  if (rodando) return res.status(429).json({ erro: 'ja tem uma busca rodando' });
  rodando = true;
  try {
    const boletos = await buscarBoletos({ comPdf: req.query.pdf === '1' });
    res.json({ ok: true, buscadoEm: new Date().toISOString(), boletos });
  } catch (e) {
    console.error(e);
    res.status(502).json({ ok: false, erro: e.message });
  } finally {
    rodando = false;
  }
});

app.listen(PORT, () => console.log(`senac-scraper ouvindo na porta ${PORT}`));
