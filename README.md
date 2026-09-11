# apiinsta

Site com um modal que consulta o perfil público do Instagram do cão do usuário,
usando uma API própria (Express) para buscar os dados sem esbarrar em CORS.

## Estrutura

Servidor único: o mesmo `server.js` serve o site estático (`index.html`,
`styles.css`, `script.js`) e a API (`GET /perfil/:username`), na mesma
origem — por isso o front chama `/perfil/...` direto, sem CORS e sem URL
de API separada pra manter em sincronia.

- `index.html`, `styles.css`, `script.js` — site.
- `server.js` — servidor Express (serve os arquivos estáticos + a API).
- `instagram.js` — lógica de consulta ao Instagram.
- `render.yaml` — configuração de deploy no Render (Blueprint).

## Rodando localmente

```
npm install
node server.js
```

Abre `http://localhost:3000` no navegador — site e API já saem juntos.

## Checklist de deploy

- [ ] `git push -u origin master` — código no GitHub.
- [ ] Deploy no **Render**: New → Blueprint → conectar este repositório
      (ele lê o `render.yaml` sozinho) → Apply/Deploy.
- [ ] Testar o fluxo completo na URL pública que o Render gerar: abrir o
      site, clicar em "Ver Dieta", digitar um @ público real e conferir se
      o perfil carrega.

Só isso — não precisa mais de um segundo deploy pro frontend (Vercel/Netlify),
já que o mesmo servidor cuida de tudo.

## Observação sobre rate limit

O Instagram bloqueia com frequência requisições sem login vindas de IPs de
datacenter (Render, Vercel, etc.), retornando 429. Isso é uma limitação do
próprio Instagram, não um bug da API. Testei ao vivo no deploy do Render
(https://apiinsta-f9ux.onrender.com/perfil/instagram) e confirmei 429 lá.

O que já foi feito no código pra amenizar isso (`instagram.js`):
- Retry automático com backoff (até 3 tentativas) quando o Instagram responde 429.
- Fila interna que espaça as chamadas ao Instagram (evita rajadas de vários
  visitantes ao mesmo tempo, que são o gatilho mais comum de bloqueio).
- Headers mais parecidos com um navegador real (Referer, X-Requested-With etc.).
- Cache de 30 minutos por perfil (menos chamadas repetidas ao Instagram).
- Quando mesmo assim falha, o front (`script.js`) nunca mostra o erro cru —
  cai num card com traços (`–`) nas estatísticas e uma mensagem honesta
  ("prévia indisponível agora"), sem inventar número de seguidores.

Nada disso garante 100% de sucesso — é a mesma limitação de sempre (IP
compartilhado sendo visto como scraper pelo Instagram), só que com uma taxa
de sucesso mais alta que antes.

**Se quiser confiabilidade de verdade** (a foto/dados aparecerem quase
sempre), a solução real é rodar as chamadas ao Instagram através de um proxy
residencial/rotativo pago (ex: Bright Data, Smartproxy, Oxylabs) ou uma API
de terceiros já pronta pra isso (ex: providers de "Instagram Scraper" no
RapidAPI). Isso já está preparado no código: basta configurar a variável de
ambiente `PROXY_URL` no Render (Settings → Environment) com a URL do proxy
(formato `http://usuario:senha@host:porta`) e o `instagram.js` passa a usar
esse proxy automaticamente, sem precisar mexer em mais nada.
