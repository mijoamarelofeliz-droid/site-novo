const express = require("express");
const NodeCache = require("node-cache");
const { fetchProfile, InstagramError } = require("./instagram");

const app = express();
const PORT = process.env.PORT || 3000;

// Libera acesso para o front-end estático (aberto em outra origem/porta).
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  next();
});

// Cache de 5 minutos para não martelar o Instagram com a mesma consulta
// (evita rate limit e deixa respostas repetidas instantâneas).
const cache = new NodeCache({ stdTTL: 300 });

app.get("/", (req, res) => {
  res.json({
    nome: "Instagram Profile API",
    uso: "GET /perfil/:username  (ex: /perfil/instagram ou /perfil/@instagram)",
    aviso:
      "Consulta apenas dados públicos de perfis públicos, via endpoint público do Instagram. Sem login, sem acesso a contas privadas.",
  });
});

app.get("/perfil/:username", async (req, res) => {
  const raw = req.params.username;

  const cached = cache.get(raw.toLowerCase());
  if (cached) {
    return res.json({ ...cached, cache: true });
  }

  try {
    const perfil = await fetchProfile(raw);
    cache.set(raw.toLowerCase(), perfil);
    res.json({ ...perfil, cache: false });
  } catch (err) {
    if (err instanceof InstagramError) {
      return res.status(err.statusCode).json({ erro: err.message });
    }
    console.error(err);
    res.status(500).json({ erro: "Erro interno." });
  }
});

app.use((req, res) => {
  res.status(404).json({ erro: "Rota não encontrada." });
});

app.listen(PORT, () => {
  console.log(`API rodando em http://localhost:${PORT}`);
});
