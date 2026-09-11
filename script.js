// Matrix-style falling code background
const canvas = document.getElementById("matrix");
const ctx = canvas.getContext("2d");

let columns, drops, fontSize;

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  fontSize = 16;
  columns = Math.floor(canvas.width / fontSize);
  drops = new Array(columns).fill(0).map(() => Math.random() * -50);
}

const chars = "アイウエオカキクケコサシスセソABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function draw() {
  ctx.fillStyle = "rgba(5, 5, 10, 0.08)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.font = fontSize + "px monospace";

  for (let i = 0; i < columns; i++) {
    const char = chars[Math.floor(Math.random() * chars.length)];
    const x = i * fontSize;
    const y = drops[i] * fontSize;

    ctx.fillStyle = Math.random() > 0.95 ? "#c9a8ff" : "rgba(124, 58, 237, 0.55)";
    ctx.fillText(char, x, y);

    if (y > canvas.height && Math.random() > 0.975) {
      drops[i] = 0;
    }
    drops[i]++;
  }
}

resize();
window.addEventListener("resize", resize);
setInterval(draw, 50);

// Weekday label (Portuguese)
const weekdays = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];
document.getElementById("weekday").textContent = weekdays[new Date().getDay()];

// Animated counter
const countEl = document.getElementById("count");
const target = 112512 + Math.floor(Math.random() * 500);
let current = 0;
const step = Math.ceil(target / 80);

function tick() {
  current = Math.min(current + step, target);
  countEl.textContent = "+" + current.toLocaleString("pt-BR");
  if (current < target) requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

// Instagram handle modal flow
const overlay = document.getElementById("modalOverlay");
const openBtn = document.querySelector(".hero .cta");
const closeBtn = document.getElementById("modalClose");
const form = document.getElementById("igForm");
const input = document.getElementById("igInput");
const errorEl = document.getElementById("igError");

const stepForm = document.getElementById("stepForm");
const stepLoading = document.getElementById("stepLoading");
const stepResult = document.getElementById("stepResult");
const loadingHandle = document.getElementById("loadingHandle");
const continueBtn = document.getElementById("continueBtn");

const HANDLE_RE = /^[a-zA-Z0-9._]{1,30}$/;

function showStep(step) {
  [stepForm, stepLoading, stepResult].forEach((el) => (el.hidden = el !== step));
}

function openModal() {
  overlay.classList.add("open");
  showStep(stepForm);
  errorEl.textContent = "";
  input.value = "";
  setTimeout(() => input.focus(), 150);
  document.body.style.overflow = "hidden";
}

function closeModal() {
  overlay.classList.remove("open");
  document.body.style.overflow = "";
}

openBtn.addEventListener("click", openModal);
closeBtn.addEventListener("click", closeModal);
overlay.addEventListener("click", (e) => {
  if (e.target === overlay) closeModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && overlay.classList.contains("open")) closeModal();
});

// Searches a public Instagram profile via the Instagram Profile API served
// by this same app (see server.js). Relative URL: works the same locally
// (`node server.js`) and in production, no separate API URL to keep in sync.
async function searchInstagramProfile(handle) {
  try {
    const res = await fetch(`/perfil/${encodeURIComponent(handle)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.erro || "not ok");
    return { found: true, data };
  } catch (err) {
    return { found: false, error: err };
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const raw = input.value.trim().replace(/^@/, "");

  if (!HANDLE_RE.test(raw)) {
    errorEl.textContent = "Digite um @ válido (letras, números, pontos e _).";
    return;
  }
  errorEl.textContent = "";

  loadingHandle.textContent = "@" + raw;
  showStep(stepLoading);

  const [result] = await Promise.all([
    searchInstagramProfile(raw),
    new Promise((resolve) => setTimeout(resolve, 1800)),
  ]);

  populateResult(result, raw);
  showStep(stepResult);
});

const resultTitle = document.getElementById("resultTitle");
const resultSubtitle = document.getElementById("resultSubtitle");
const resultAvatarImg = document.getElementById("resultAvatarImg");
const resultAvatarFallback = document.getElementById("resultAvatarFallback");
const resultUsername = document.getElementById("resultUsername");
const resultName = document.getElementById("resultName");
const resultStatsGrid = document.getElementById("resultStatsGrid");
const statPosts = document.getElementById("statPosts");
const statFollowers = document.getElementById("statFollowers");
const statFollowing = document.getElementById("statFollowing");
const resultBio = document.getElementById("resultBio");
const backBtn = document.getElementById("backBtn");

function formatCount(n) {
  return typeof n === "number" ? n.toLocaleString("pt-BR") : "–";
}

function populateResult(result, handle) {
  const data = result.found ? result.data : null;

  if (data && data.foto) {
    resultAvatarImg.src = data.foto;
    resultAvatarImg.hidden = false;
    resultAvatarFallback.hidden = true;
    resultAvatarImg.onerror = () => {
      resultAvatarImg.hidden = true;
      resultAvatarFallback.hidden = false;
    };
  } else {
    resultAvatarImg.hidden = true;
    resultAvatarImg.removeAttribute("src");
    resultAvatarFallback.hidden = false;
  }

  const hasStats =
    data && (data.publicacoes != null || data.seguidores != null || data.seguindo != null);

  resultUsername.textContent = "@" + (data?.username || handle);

  if (data && data.nome) {
    resultName.textContent = data.nome;
    resultName.hidden = false;
  } else {
    resultName.hidden = true;
  }

  if (data && data.biografia) {
    resultBio.textContent = data.biografia;
    resultBio.hidden = false;
  } else {
    resultBio.hidden = true;
  }

  // Always show the stats row - dashes when the lookup didn't come back with
  // numbers, so this state still reads as a finished card instead of a
  // broken/half-loaded one. Never fill it with made-up numbers.
  statPosts.textContent = hasStats ? formatCount(data.publicacoes) : "–";
  statFollowers.textContent = hasStats ? formatCount(data.seguidores) : "–";
  statFollowing.textContent = hasStats ? formatCount(data.seguindo) : "–";
  resultStatsGrid.hidden = false;

  resultTitle.textContent = "Confirme o Instagram";
  resultSubtitle.textContent = hasStats
    ? "Encontramos esse perfil público:"
    : "Prévia indisponível agora, mas pode confirmar mesmo assim.";
}

backBtn.addEventListener("click", () => {
  showStep(stepForm);
  setTimeout(() => input.focus(), 150);
});

continueBtn.addEventListener("click", () => {
  closeModal();
});
