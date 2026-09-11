const axios = require("axios");
const { HttpsProxyAgent } = require("https-proxy-agent");

// Se a variável de ambiente PROXY_URL estiver definida (ex: um proxy
// residencial/rotativo pago), as chamadas ao Instagram passam por ele em vez
// de sair direto do IP do servidor. O Instagram bloqueia IPs de datacenter
// (Render, etc.) com muito mais frequência do que IPs residenciais/rotativos -
// isso não depende de mudar mais nada no código, só de configurar essa env var.
const proxyAgent = process.env.PROXY_URL ? new HttpsProxyAgent(process.env.PROXY_URL) : undefined;

// Endpoint público usado pelo próprio site do Instagram para carregar
// os dados de um perfil (o mesmo que roda no navegador ao abrir instagram.com/<user>).
// Só funciona para contas PÚBLICAS. Nenhuma autenticação/login é usada.
const PROFILE_URL = "https://www.instagram.com/api/v1/users/web_profile_info/";

// x-ig-app-id é um ID público fixo usado pelo site web do Instagram, não é um segredo de conta.
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
];

function buildHeaders(username) {
  const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  return {
    "User-Agent": userAgent,
    "x-ig-app-id": "936619743392459",
    "X-Requested-With": "XMLHttpRequest",
    "X-ASBD-ID": "129477",
    Accept: "*/*",
    "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
    // Um browser real sempre manda a página do perfil como Referer nessa
    // chamada; sem isso, a requisição fica com cara mais óbvia de bot.
    Referer: `https://www.instagram.com/${username}/`,
    "sec-fetch-site": "same-origin",
    "sec-fetch-mode": "cors",
    "sec-fetch-dest": "empty",
  };
}

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

async function requestProfile(username) {
  const maxAttempts = 3;
  let response;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      response = await axios.get(PROFILE_URL, {
        params: { username },
        headers: buildHeaders(username),
        timeout: 10000,
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

    // 429 costuma ser um bloqueio momentâneo - vale tentar de novo com um
    // intervalo maior antes de desistir, em vez de falhar na primeira.
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
  const response = await throttled(() => requestProfile(username));

  if (response.status === 404) {
    throw new InstagramError("Perfil não encontrado.", 404);
  }
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

  const user = response.data?.data?.user;
  if (!user) {
    throw new InstagramError("Perfil não encontrado ou é privado/inexistente.", 404);
  }

  return {
    username: user.username,
    nome: user.full_name || null,
    foto: user.profile_pic_url_hd || user.profile_pic_url || null,
    biografia: user.biography || "",
    seguidores: user.edge_followed_by?.count ?? null,
    seguindo: user.edge_follow?.count ?? null,
    publicacoes: user.edge_owner_to_timeline_media?.count ?? null,
    privado: !!user.is_private,
    verificado: !!user.is_verified,
    linkExterno: user.external_url || null,
  };
}

module.exports = { fetchProfile, InstagramError, sanitizeUsername };
