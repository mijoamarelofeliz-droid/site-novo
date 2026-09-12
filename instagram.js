const axios = require("axios");
const { HttpsProxyAgent } = require("https-proxy-agent");

// Se a variável de ambiente PROXY_URL estiver definida (ex: um proxy
// residencial/rotativo pago), as chamadas ao Instagram passam por ele em vez
// de sair direto do IP do servidor.
const proxyAgent = process.env.PROXY_URL ? new HttpsProxyAgent(process.env.PROXY_URL) : undefined;

// Buscamos a própria página pública do perfil (não a API JSON interna, que
// está sendo bloqueada com 429). Quando a requisição chega com um User-Agent
// de crawler conhecido (o mesmo truque que Facebook/Google usam pra gerar
// preview de link), o Instagram faz server-side render do perfil e embute os
// dados (nome, bio, seguidores, foto...) direto no HTML da resposta - sem
// precisar da chamada à API interna que está bloqueada.
const CRAWLER_USER_AGENTS = [
  "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
];

class InstagramError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = "InstagramError";
    this.statusCode = statusCode;
  }
}

function sanitizeUsername(raw) {
  if (!raw || typeof raw !== "string") {
    throw new InstagramError("Informe um nome de usuário (@perfil).", 400);
  }
  const username = raw.trim().replace(/^@/, "");
  if (!/^[a-zA-Z0-9._]{1,30}$/.test(username)) {
    throw new InstagramError("Nome de usuário inválido.", 400);
  }
  return username;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Fila simples: nunca dispara duas chamadas ao Instagram com menos de
// MIN_GAP_MS de intervalo, mesmo com vários visitantes ao mesmo tempo.
// Rajadas de requisições são o que mais rápido derruba no rate limit.
const MIN_GAP_MS = 1500;
let queue = Promise.resolve();

function throttled(task) {
  const run = queue.then(() => sleep(MIN_GAP_MS)).then(task);
  queue = run.catch(() => {});
  return run;
}

// Extrai um objeto JSON balanceado (contando chaves, ignorando as que estão
// dentro de strings) a partir do índice onde o "{" de abertura começa.
// Precisa ser string-aware porque a biografia do usuário pode conter "{" ou
// "}" como texto literal, o que quebraria uma contagem ingênua de chaves.
function extractBalancedObject(text, startIndex) {
  let depth = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = startIndex; i < text.length; i++) {
    const ch = text[i];
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (ch === "\\") {
      escapeNext = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(startIndex, i + 1);
    }
  }
  return null;
}

function decodeHtmlEntities(str) {
  return str
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}

// Converte "8,584" ou "1.2M" ou "687K" no número correspondente.
function parseAbbreviatedNumber(str) {
  const match = str.trim().match(/^([\d.,]+)\s*([KMB])?$/i);
  if (!match) return null;
  let num = parseFloat(match[1].replace(/,/g, ""));
  if (Number.isNaN(num)) return null;
  const suffix = (match[2] || "").toUpperCase();
  if (suffix === "K") num *= 1e3;
  else if (suffix === "M") num *= 1e6;
  else if (suffix === "B") num *= 1e9;
  return Math.round(num);
}

// O contador de posts só vem na meta tag og:description (texto tipo
// "8,584 Posts"), não no blob JSON - o resto dos números vem do JSON, que é
// exato, então só essa métrica depende desse parsing de texto.
function parsePostCount(html) {
  const meta = html.match(/<meta property="og:description" content="([^"]*)"/);
  if (!meta) return null;
  const desc = decodeHtmlEntities(meta[1]);
  const postsMatch = desc.match(/([\d.,]+\s?[KMB]?)\s+Posts?/i);
  return postsMatch ? parseAbbreviatedNumber(postsMatch[1]) : null;
}

function parseProfileHtml(html) {
  const marker = '"xig_user_by_igid_v2":';
  const markerIdx = html.indexOf(marker);
  if (markerIdx === -1) return null;

  const objStart = html.indexOf("{", markerIdx + marker.length);
  if (objStart === -1) return null;

  const objStr = extractBalancedObject(html, objStart);
  if (!objStr) return null;

  let data;
  try {
    data = JSON.parse(objStr);
  } catch {
    return null;
  }
  if (!data || !data.username) return null;

  return {
    username: data.username,
    nome: data.full_name || null,
    foto: data.profile_pic_url || null,
    biografia: data.biography || "",
    seguidores: typeof data.follower_count === "number" ? data.follower_count : null,
    seguindo: typeof data.following_count === "number" ? data.following_count : null,
    publicacoes: parsePostCount(html),
    privado: !!data.is_private,
    verificado: !!data.is_verified,
    linkExterno: null,
  };
}

async function requestProfilePage(username) {
  const maxAttempts = 3;
  let response;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const userAgent = CRAWLER_USER_AGENTS[Math.floor(Math.random() * CRAWLER_USER_AGENTS.length)];
    try {
      response = await axios.get(`https://www.instagram.com/${username}/`, {
        headers: {
          "User-Agent": userAgent,
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9",
        },
        timeout: 15000,
        validateStatus: () => true,
        httpsAgent: proxyAgent,
        proxy: false,
      });
    } catch (err) {
      if (attempt === maxAttempts) {
        throw new InstagramError("Falha ao conectar ao Instagram.", 502);
      }
      await sleep(1200 * attempt);
      continue;
    }

    if (response.status === 429 && attempt < maxAttempts) {
      await sleep(2000 * attempt);
      continue;
    }

    return response;
  }

  return response;
}

async function fetchProfile(rawUsername) {
  const username = sanitizeUsername(rawUsername);
  const response = await throttled(() => requestProfilePage(username));

  if (response.status === 429) {
    throw new InstagramError(
      "Muitas requisições agora (rate limit do Instagram). Tente novamente em instantes.",
      429
    );
  }
  if (response.status !== 200) {
    throw new InstagramError(
      `Instagram respondeu com status inesperado (${response.status}).`,
      502
    );
  }

  const perfil = parseProfileHtml(response.data);
  if (!perfil) {
    throw new InstagramError("Perfil não encontrado ou é privado/inexistente.", 404);
  }

  return perfil;
}

module.exports = { fetchProfile, InstagramError, sanitizeUsername };
