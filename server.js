const path = require("path");
const express = require("express");
const NodeCache = require("node-cache");
const { fetchProfile, InstagramError } = require("./instagram");

const app = express();
const PORT = process.env.PORT || 3000;

// Serve o site estático (index.html, styles.css, script.js) e a API
// a partir do mesmo servidor/origem, então o front pode chamar /perfil/:username
// direto (sem CORS, sem URL de API separada pra manter em sincronia).
app.use(express.static(__dirname));

// Cache de 30 minutos para não martelar o Instagram com a mesma consulta
// (evita rate limit e deixa respostas repetidas instantâneas).
const cache = new NodeCache({ stdTTL: 1800 });

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
