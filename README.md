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

## Observação sobre rate limit / bloqueio do Instagram

O Instagram bloqueia com frequência requisições sem login vindas de IPs de
datacenter (Render, Vercel, etc.). Isso é uma limitação do próprio
Instagram, não um bug da API.

### O que foi tentado e o que se descobriu (testado ao vivo)

1. **Primeira versão**: chamava direto o endpoint JSON interno do Instagram
   (`api/v1/users/web_profile_info`). Esse endpoint devolvia 429 (rate limit)
   consistentemente a partir do IP do Render.
2. **Segunda versão** (atual): em vez do endpoint JSON, busca a própria
   página pública do perfil (`instagram.com/<usuario>/`) usando um
   User-Agent de crawler conhecido (o mesmo truque que Facebook/Google usam
   pra gerar preview de link) — quando reconhece esse UA, o Instagram
   server-renderiza o perfil inteiro (nome, bio, seguidores exatos, foto)
   direto no HTML, sem passar pelo endpoint bloqueado.
   - **Da minha máquina/rede aqui, funcionou 100% das vezes testadas**
     (contas @instagram, @nasa, @natgeo, todas com dados reais).
   - **Do IP do Render, continua falhando** (a mesma conta que funciona
     daqui volta como "não encontrado" de lá).

Isso confirma que o gargalo é a **reputação do IP do Render** especificamente
— o Instagram provavelmente verifica se quem alega ser um crawler (Google,
Facebook) realmente vem de um IP desses provedores, e recusa esse tratamento
especial pra IPs de datacenter genéricos como o do Render, não importa qual
técnica de scraping seja usada por trás.

**Isso também responde à pergunta de usar a própria IA (Claude) fazendo a
busca ao vivo por lead**: não ajudaria nesse ponto especificamente. O
gargalo real é de qual IP a requisição sai, não de quem/o que faz a
requisição — um agente de IA controlando um navegador de dentro do Render
esbarraria na mesma reputação de IP. Sairia mais caro (cada busca vira uma
chamada paga à API da Anthropic, cobrada da própria conta de quem for
rodar) sem resolver o problema de fundo. A única forma de contornar isso de
verdade é fazer as requisições saírem de um IP com boa reputação — um proxy
residencial/rotativo pago (Bright Data, Smartproxy, Oxylabs) ou uma API de
terceiros que já resolve isso (providers de "Instagram Scraper" no
RapidAPI).

Isso já está preparado no código: basta configurar a variável de ambiente
`PROXY_URL` no Render (Settings → Environment) com a URL do proxy (formato
`http://usuario:senha@host:porta`) e o `instagram.js` passa a rotear as
requisições por ele automaticamente, sem precisar mexer em mais nada.

### O que o código já faz pra amenizar (sem custo extra)

- Retry automático com backoff (até 3 tentativas) em caso de bloqueio.
- Fila interna que espaça as chamadas ao Instagram (evita rajadas de vários
  visitantes ao mesmo tempo).
- Cache de 30 minutos por perfil (menos chamadas repetidas).
- Quando mesmo assim falha, o front (`script.js`) nunca mostra erro cru —
  cai num card com traços (`–`) nas estatísticas e uma mensagem honesta
  ("prévia indisponível agora"), sem inventar número de seguidores.
