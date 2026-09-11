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
const resultHandle = document.getElementById("resultHandle");
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

// Searches a public Instagram profile via the local Instagram Profile API
// (see api/server.js). Requires the API running, e.g. `npm start` inside api/.
const API_BASE_URL = "http://localhost:3000";

async function searchInstagramProfile(handle) {
  try {
    const res = await fetch(`${API_BASE_URL}/perfil/${encodeURIComponent(handle)}`);
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

  resultHandle.textContent = "@" + raw;
  showStep(stepResult);

  // Hook point: `result.found` / `result.data` has whatever came back from
  // the lookup above, in case you want to use it once a real backend/API is wired in.
  console.log("Instagram lookup result:", result);
});

continueBtn.addEventListener("click", () => {
  closeModal();
});
