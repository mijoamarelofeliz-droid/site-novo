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
- `instagram.js` — lógica de consulta ao Instagram (scraper gratuito).
- `claude-lookup.js` — busca via Claude/`web_fetch` (método principal quando
  `ANTHROPIC_API_KEY` está configurada — ver seção sobre bloqueio abaixo).
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

### Terceira versão: busca via Claude (`claude-lookup.js`) — a que resolve de verdade

A pergunta certa acabou sendo "será que a infraestrutura da própria Anthropic
consegue acessar o Instagram, já que o Render não consegue?" — testei e a
resposta é **sim**. A API da Anthropic tem uma ferramenta oficial chamada
`web_fetch`: você manda pro Claude buscar uma URL, ele busca a partir da
infraestrutura da própria Anthropic (não do seu servidor) e devolve o
conteúdo. Testei isso ao vivo contra `instagram.com/natgeo/` e voltou com os
dados reais — a infraestrutura da Anthropic não está na mesma lista de
bloqueio que o IP do Render está.

**Como ativar:** defina a variável de ambiente `ANTHROPIC_API_KEY` no Render
(Settings → Environment) com uma chave da sua conta em
[console.anthropic.com](https://console.anthropic.com). Assim que essa
variável existir, `instagram.js` passa a usar `claude-lookup.js` como método
principal automaticamente — sem chave configurada, continua caindo no
scraper gratuito (segunda versão, acima) como já fazia.

**Custo real:** `web_fetch` em si não tem cobrança adicional, só os tokens
normais do modelo. Uso o modelo Haiku 4.5 por padrão
(`CLAUDE_LOOKUP_MODEL` pra trocar) porque essa é uma extração simples — não
precisa de um modelo caro. Estimativa por busca: internacional de ~8-9 mil
tokens de entrada (a página do Instagram é grande, por isso limito com
`max_content_tokens`) + resposta curta, o que dá algo em torno de
**US$0,01-0,02 por busca**. Isso é um custo real e recorrente por lead, na
sua própria conta da Anthropic — bem mais barato que um proxy residencial
pago, mas ainda assim escala com tráfego (100 buscas/dia ≈ US$1-2/dia).

Não consegui testar essa parte ao vivo porque preciso da sua chave da API,
que eu não tenho (nem devo reaproveitar as credenciais desta sessão do
Claude Code pra isso — são contas/faturamento diferentes). Testei que o
fallback pro scraper gratuito continua funcionando normalmente sem a chave
configurada. Quando você configurar `ANTHROPIC_API_KEY` no Render, vale
testar uma busca e conferir os logs do serviço se algo não bater.

### Alternativas que ainda funcionam (proxy pago)

A opção de rodar as requisições atuais (scraper gratuito) através de um
proxy residencial/rotativo pago (Bright Data, Smartproxy, Oxylabs) continua
disponível e é mais barata em alto volume, já que não depende de tokens por
busca. Basta configurar `PROXY_URL` no Render (formato
`http://usuario:senha@host:porta`) e o `instagram.js` passa a rotear por ele
automaticamente — mas isso só afeta o scraper gratuito, não a busca via
Claude (que já sai da infraestrutura da Anthropic, não precisa de proxy).

### O que o código já faz pra amenizar o scraper gratuito (sem custo extra)

- Retry automático com backoff (até 3 tentativas) em caso de bloqueio.
- Fila interna que espaça as chamadas ao Instagram (evita rajadas de vários
  visitantes ao mesmo tempo).
- Cache de 30 minutos por perfil (menos chamadas repetidas, vale tanto pro
  scraper gratuito quanto pra busca via Claude).
- Quando mesmo assim falha, o front (`script.js`) nunca mostra erro cru —
  cai num card com traços (`–`) nas estatísticas e uma mensagem honesta
  ("prévia indisponível agora"), sem inventar número de seguidores.
