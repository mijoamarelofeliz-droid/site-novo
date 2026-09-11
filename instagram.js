const axios = require("axios");

// Endpoint público usado pelo próprio site do Instagram para carregar
// os dados de um perfil (o mesmo que roda no navegador ao abrir instagram.com/<user>).
// Só funciona para contas PÚBLICAS. Nenhuma autenticação/login é usada.
const PROFILE_URL = "https://www.instagram.com/api/v1/users/web_profile_info/";

// x-ig-app-id é um ID público fixo usado pelo site web do Instagram, não é um segredo de conta.
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "x-ig-app-id": "936619743392459",
  Accept: "*/*",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
};

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

async function fetchProfile(rawUsername) {
  const username = sanitizeUsername(rawUsername);

  let response;
  try {
    response = await axios.get(PROFILE_URL, {
      params: { username },
      headers: HEADERS,
      timeout: 10000,
      validateStatus: () => true,
    });
  } catch (err) {
    throw new InstagramError("Falha ao conectar ao Instagram.", 502);
  }

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
