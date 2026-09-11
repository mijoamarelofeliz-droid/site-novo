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
próprio Instagram, não um bug da API — o tratamento de erro já cobre esse
caso e devolve uma mensagem amigável em vez de quebrar.
