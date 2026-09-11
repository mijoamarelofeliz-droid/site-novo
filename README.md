# apiinsta

Site com um modal que consulta o perfil público do Instagram do cão do usuário,
usando uma API própria (Express) para buscar os dados sem esbarrar em CORS.

## Estrutura

- `index.html`, `styles.css`, `script.js` — site estático (frontend).
- `api/` — API Node/Express (`server.js` + `instagram.js`) que consulta o
  Instagram e expõe `GET /perfil/:username`.
- `render.yaml` — configuração de deploy da API no Render (Blueprint).
- `.vercelignore` — exclui a pasta `api/` do deploy do frontend no Vercel
  (evita que o Vercel trate `api/*.js` como serverless functions).

## Rodando localmente

1. API:
   ```
   cd api
   npm install
   node server.js
   ```
   Sobe em `http://localhost:3000`.
2. Frontend: abra `index.html` no navegador (ou sirva com a extensão Live
   Server do VS Code). O `script.js` chama a API em `http://localhost:3000`.

## Checklist de deploy

- [ ] `git push -u origin master` — código no GitHub.
- [ ] Deploy da API no **Render**: New → Blueprint → conectar este repositório
      (ele lê o `render.yaml` sozinho) → Apply/Deploy. Copiar a URL pública
      gerada (ex: `https://instagram-profile-api-xxxx.onrender.com`).
- [ ] Atualizar `API_BASE_URL` em `script.js` (linha ~113) para essa URL de
      produção, e dar `git commit` + `git push`.
- [ ] Deploy do frontend na **Vercel**: Add New → Project → importar este
      repositório → Framework preset "Other" → Root Directory `.` → Deploy.
      Copiar a URL do site (ex: `https://apiinsta.vercel.app`).
- [ ] Testar o fluxo completo no ar: abrir a URL da Vercel, clicar em
      "Ver Dieta", digitar um @ público real e conferir se o perfil carrega.

## Observação sobre rate limit

O Instagram bloqueia com frequência requisições sem login vindas de IPs de
datacenter (Render, Vercel, etc.), retornando 429. Isso é uma limitação do
próprio Instagram, não um bug da API — o tratamento de erro já cobre esse
caso e devolve uma mensagem amigável em vez de quebrar.
