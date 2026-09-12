const Anthropic = require("@anthropic-ai/sdk");

// Usa a própria infraestrutura da Anthropic pra buscar a página pública do
// perfil (ferramenta web_fetch do Claude), em vez do servidor sair
// diretamente para o Instagram. Isso existe porque o IP do Render é
// bloqueado pelo Instagram (confirmado em produção), enquanto a
// infraestrutura da Anthropic não é - o "quem faz a requisição" não importa,
// o que importa é de qual IP ela sai, e esse aqui não está bloqueado.
//
// Custo: web_fetch em si não tem cobrança adicional, só os tokens normais do
// modelo (ver https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-fetch-tool).
// Usamos Haiku 4.5 por padrão porque essa é uma extração simples e estruturada -
// não precisa de um modelo caro - o que deixa o custo em torno de
// US$0,01-0,02 por busca em vez de dezenas de centavos.
const MODEL = process.env.CLAUDE_LOOKUP_MODEL || "claude-haiku-4-5";

let client = null;
function getClient() {
  if (!client) client = new Anthropic();
  return client;
}

function stripCodeFence(text) {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

// Retorna o perfil, ou null se o Claude reportar que o perfil não existe/não
// deu pra buscar. Lança erro em qualquer outra falha (chave inválida, rede,
// resposta que não é JSON etc.) para o chamador decidir o que fazer.
async function fetchProfileViaClaude(username) {
  const url = `https://www.instagram.com/${username}/`;

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 1024,
    tools: [
      {
        type: "web_fetch_20250910",
        name: "web_fetch",
        max_uses: 1,
        // Os dados que precisamos aparecem bem no início da página; isso
        // evita pagar tokens pela página inteira (o HTML completo do
        // Instagram tem várias centenas de KB).
        max_content_tokens: 8000,
      },
    ],
    messages: [
      {
        role: "user",
        content:
          `Fetch ${url} and extract this Instagram profile's public data.\n\n` +
          "Respond with ONLY a raw JSON object (no markdown, no code fences, no extra text) " +
          "with exactly these keys: username (string), nome (string or null - the full display name), " +
          "foto (string URL or null - the profile picture URL), " +
          "biografia (string, empty string if none), seguidores (number or null), " +
          "seguindo (number or null), publicacoes (number or null - post count), " +
          "privado (boolean), verificado (boolean).\n\n" +
          'If the profile does not exist or the page could not be fetched, respond with exactly {"erro": "nao_encontrado"}.',
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock) {
    throw new Error("Claude não retornou nenhum texto na resposta.");
  }

  const raw = stripCodeFence(textBlock.text);
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(`Resposta do Claude não é um JSON válido: ${raw.slice(0, 200)}`);
  }

  if (data.erro) return null;
  return {
    username: data.username || username,
    nome: data.nome || null,
    foto: data.foto || null,
    biografia: data.biografia || "",
    seguidores: typeof data.seguidores === "number" ? data.seguidores : null,
    seguindo: typeof data.seguindo === "number" ? data.seguindo : null,
    publicacoes: typeof data.publicacoes === "number" ? data.publicacoes : null,
    privado: !!data.privado,
    verificado: !!data.verificado,
    linkExterno: null,
  };
}

module.exports = { fetchProfileViaClaude };
