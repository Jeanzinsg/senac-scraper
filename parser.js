// Le a tabela "Financeiro" da pagina escolheSistema.php5 do portal do aluno
const cheerio = require('cheerio');

const BASE = 'https://apsweb.senacrs.com.br/modulos/aluno/';

function dataISO(br) {
  const m = (br || '').match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

function valorNum(txt) {
  const limpo = (txt || '').replace(/[^\d,]/g, '').replace(',', '.');
  return limpo ? Number(limpo) : null;
}

function parseBoletos(html) {
  const $ = cheerio.load(html);
  const boletos = [];

  $('table tbody tr').each((_, tr) => {
    const tds = $(tr).find('td');
    if (tds.length < 7) return;

    const acoes = $(tds[6]);
    const copiar = acoes.find('a[onclick*="copyToClip"]').attr('onclick') || '';
    const linha = (copiar.match(/copyToClip\(\s*["']([\d\s]+)["']/) || [])[1];
    const href = acoes.find('a[href*="baixarBoleto"]').attr('href');

    boletos.push({
      conta: 'Faculdade SENAC',
      parcela: $(tds[1]).text().trim(),
      descricao: $(tds[2]).text().trim(),
      vencimento: dataISO($(tds[3]).text()),
      status: $(tds[4]).text().replace(/[^\p{L}\s]/gu, '').trim(),
      atrasado: $(tr).hasClass('parcela-atrasada'),
      valor: valorNum($(tds[5]).text()),
      linhaDigitavel: linha ? linha.replace(/\s/g, '') : null,
      pdfUrl: href ? new URL(href, BASE).toString() : null,
    });
  });

  return boletos;
}

module.exports = { parseBoletos };
