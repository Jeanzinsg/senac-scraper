# senac-scraper

Busca os boletos de mensalidade no Portal do Aluno do Senac-RS (GVcollege) e devolve em JSON,
com linha digitavel e PDF. Usado por um workflow do n8n que manda os boletos no Telegram.

## Rodar

Variaveis de ambiente (nunca commitar): `SENAC_USER`, `SENAC_PASS`, `API_TOKEN`.

```
docker compose up -d --build
curl -H "x-api-token: $API_TOKEN" "http://localhost:3100/senac/boletos?pdf=1"
```

## Como funciona

- Playwright faz o login (o portal codifica a senha em JS antes de enviar).
- `parser.js` le a tabela "Financeiro" com cheerio.
- O PDF e baixado direto ou, se o link devolver HTML, a pagina do boleto e impressa como PDF.

`n8n-boletos-senac.json`: workflow que roda as 8h e avisa na vespera, no dia e enquanto houver atraso.
