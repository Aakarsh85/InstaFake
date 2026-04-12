// ============================================================
//  InstaGuard — script.js
// ============================================================

const API_BASE = "http://127.0.0.1:5000";

// ── DOM refs ──────────────────────────────────────────────
const manualTab      = document.getElementById("manualTab");
const bulkTab        = document.getElementById("bulkTab");
const manualPanel    = document.getElementById("manualPanel");
const bulkPanel      = document.getElementById("bulkPanel");

const predictManualBtn = document.getElementById("predictManualBtn");
const predictBulkBtn   = document.getElementById("predictBulkBtn");

const manualSkeleton = document.getElementById("manualSkeleton");
const manualResultCard = document.getElementById("manualResultCard");
const manualError    = document.getElementById("manualError");
const manualErrorText = document.getElementById("manualErrorText");

const bulkSkeleton   = document.getElementById("bulkSkeleton");
const bulkResults    = document.getElementById("bulkResults");
const bulkError      = document.getElementById("bulkError");
const bulkErrorText  = document.getElementById("bulkErrorText");

const historyList    = document.getElementById("historyList");
const clearHistoryBtn = document.getElementById("clearHistory");
const themeToggle    = document.getElementById("themeToggle");
const apiStatusText  = document.getElementById("apiStatus");
const apiStatusDot   = document.querySelector(".status-dot");

const fileInput      = document.getElementById("fileInput");
const fileSelectedInfo = document.getElementById("fileSelectedInfo");
const uploadZoneInner = document.getElementById("uploadZoneInner");
const selectedFileName = document.getElementById("selectedFileName");
const removeFileBtn  = document.getElementById("removeFileBtn");
const uploadZone     = document.getElementById("uploadZone");

// ── Session storage ──────────────────────────────────────
let sessionHistory = [];
let bulkData = [];        // store all predictions for filter/export
let currentPage = 1;
const PAGE_SIZE = 10;
let currentFilter = "all";

// ── Theme ─────────────────────────────────────────────────
const savedTheme = localStorage.getItem("ig-theme") || "dark";
if (savedTheme === "light") document.documentElement.setAttribute("data-theme", "light");

themeToggle.addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "light" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("ig-theme", next);
});

// ── Health check ──────────────────────────────────────────
async function checkHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      apiStatusText.textContent = "API Online";
      apiStatusDot.classList.add("online");
    } else {
      throw new Error();
    }
  } catch {
    apiStatusText.textContent = "API Offline";
    apiStatusDot.classList.add("offline");
  }
}
checkHealth();

// ── Particle canvas (subtle floating dots) ────────────────
(function initParticles() {
  const canvas = document.getElementById("particleCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let W, H, particles;

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function makeParticles() {
    particles = Array.from({ length: 38 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.5 + 0.4,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      alpha: Math.random() * 0.4 + 0.1
    }));
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const isDark = document.documentElement.getAttribute("data-theme") !== "light";
    particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = isDark
        ? `rgba(79,142,247,${p.alpha})`
        : `rgba(79,142,247,${p.alpha * 0.5})`;
      ctx.fill();
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0) p.x = W;
      if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H;
      if (p.y > H) p.y = 0;
    });
    requestAnimationFrame(draw);
  }

  window.addEventListener("resize", () => { resize(); makeParticles(); });
  resize();
  makeParticles();
  draw();
})();

// ── Tab switching ─────────────────────────────────────────
manualTab.addEventListener("click", () => switchTab("manual"));
bulkTab.addEventListener("click", () => switchTab("bulk"));

function switchTab(mode) {
  if (mode === "manual") {
    manualTab.classList.add("active");
    bulkTab.classList.remove("active");
    manualPanel.classList.remove("hidden");
    bulkPanel.classList.add("hidden");
  } else {
    bulkTab.classList.add("active");
    manualTab.classList.remove("active");
    bulkPanel.classList.remove("hidden");
    manualPanel.classList.add("hidden");
  }
}

// ── Reset form ─────────────────────────────────────────────
document.getElementById("resetForm").addEventListener("click", () => {
  ["followers","following","posts","len_fullname","len_desc",
   "ratio_numlen_username","ratio_numlen_fullname"].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.value = "";
      clearFieldState(el);
    }
  });
  resetPreview();
  hide(manualResultCard);
  hide(manualError);
});

// ── Drag & drop upload ────────────────────────────────────
uploadZone.addEventListener("dragover", e => {
  e.preventDefault();
  uploadZone.classList.add("drag-over");
});
uploadZone.addEventListener("dragleave", () => uploadZone.classList.remove("drag-over"));
uploadZone.addEventListener("drop", e => {
  e.preventDefault();
  uploadZone.classList.remove("drag-over");
  if (e.dataTransfer.files[0]) handleFileSelect(e.dataTransfer.files[0]);
});

fileInput.addEventListener("change", () => {
  if (fileInput.files[0]) handleFileSelect(fileInput.files[0]);
});

function handleFileSelect(file) {
  const name = file.name;
  if (!name.endsWith(".csv") && !name.endsWith(".json")) {
    showBulkError("Only CSV or JSON files are supported.");
    return;
  }
  selectedFileName.textContent = name;
  show(fileSelectedInfo);
  uploadZoneInner.classList.add("hidden");
}

removeFileBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  fileInput.value = "";
  hide(fileSelectedInfo);
  uploadZoneInner.classList.remove("hidden");
});

// ── Validation ─────────────────────────────────────────────
const fieldRules = {
  followers:   { min: 0, max: 1e8, label: "Followers" },
  following:   { min: 0, max: 1e8, label: "Following" },
  posts:       { min: 0, max: 1e6, label: "Posts" },
  len_fullname:{ min: 0, max: 200, label: "Full Name Length" },
  len_desc:    { min: 0, max: 500, label: "Bio Length" },
};

function validateField(input) {
  const id = input.id;
  const wrap = document.getElementById(`wrap_${id}`);
  const fb = document.getElementById(`fb_${id}`);
  const val = input.value.trim();

  if (!wrap || !fb) return true;

  if (val === "") {
    clearFieldState(input);
    fb.textContent = "";
    fb.className = "field-feedback";
    return true;
  }

  const num = Number(val);
  const rule = fieldRules[id];

  if (isNaN(num) || !isFinite(num)) {
    setInvalid(wrap, fb, "Must be a valid number.");
    return false;
  }
  if (num < 0) {
    setInvalid(wrap, fb, "Cannot be negative.");
    return false;
  }
  if (rule && num > rule.max) {
    setInvalid(wrap, fb, `Max allowed: ${rule.max.toLocaleString()}`);
    return false;
  }

  // Soft warnings (suspicious but allowed)
  if (id === "followers" && num === 0) {
    setWarn(wrap, fb, "0 followers — suspicious.");
    return true;
  }
  if (id === "following" && num > 5000) {
    setWarn(wrap, fb, "High following count — possible bot.");
    return true;
  }

  setValid(wrap, fb, "✓");
  return true;
}

function validateRatio(input) {
  const id = input.id;
  const wrap = document.getElementById(`wrap_${id}`);
  const fb = document.getElementById(`fb_${id}`);
  const val = input.value.trim();

  if (!wrap || !fb) return true;

  if (val === "") {
    clearFieldState(input);
    fb.textContent = "";
    fb.className = "field-feedback";
    return true;
  }

  const num = Number(val);

  if (isNaN(num) || !isFinite(num)) {
    setInvalid(wrap, fb, "Must be a decimal between 0 and 1.");
    return false;
  }
  if (num < 0 || num > 1) {
    setInvalid(wrap, fb, "Value must be between 0.0 and 1.0");
    return false;
  }
  if (num > 0.6) {
    setWarn(wrap, fb, "High ratio — unusual for real accounts.");
    return true;
  }

  setValid(wrap, fb, "✓");
  return true;
}

function setValid(wrap, fb, msg) {
  wrap.className = "field-input-wrap valid";
  fb.textContent = msg;
  fb.className = "field-feedback valid-msg";
}
function setInvalid(wrap, fb, msg) {
  wrap.className = "field-input-wrap invalid";
  fb.textContent = msg;
  fb.className = "field-feedback invalid-msg";
}
function setWarn(wrap, fb, msg) {
  wrap.className = "field-input-wrap";
  fb.textContent = "⚠ " + msg;
  fb.className = "field-feedback invalid-msg";
}
function clearFieldState(input) {
  const wrap = document.getElementById(`wrap_${input.id}`);
  if (wrap) wrap.className = "field-input-wrap";
}

function validateAll() {
  const ratioIds = ["ratio_numlen_username","ratio_numlen_fullname"];
  const normalIds = ["followers","following","posts","len_fullname","len_desc"];
  let ok = true;
  normalIds.forEach(id => {
    const el = document.getElementById(id);
    if (el && el.value.trim() !== "" && !validateField(el)) ok = false;
  });
  ratioIds.forEach(id => {
    const el = document.getElementById(id);
    if (el && el.value.trim() !== "" && !validateRatio(el)) ok = false;
  });
  return ok;
}

// ── Profile preview ────────────────────────────────────────
function updatePreview() {
  const followers = safeNum(document.getElementById("followers").value);
  const following = safeNum(document.getElementById("following").value);
  const posts     = safeNum(document.getElementById("posts").value);
  const bioLen    = safeNum(document.getElementById("len_desc").value);

  document.getElementById("previewPosts").textContent = fmt(posts);
  document.getElementById("previewFollowers").textContent = fmt(followers);
  document.getElementById("previewFollowing").textContent = fmt(following);

  const bioEl = document.getElementById("previewBio");
  if (bioLen === 0) bioEl.textContent = "No bio added.";
  else if (bioLen < 20) bioEl.textContent = `Short bio (${bioLen} chars)`;
  else bioEl.textContent = `Has a bio of ${bioLen} characters.`;
}

function resetPreview() {
  document.getElementById("previewPosts").textContent = "0";
  document.getElementById("previewFollowers").textContent = "0";
  document.getElementById("previewFollowing").textContent = "0";
  document.getElementById("previewBio").textContent = "Bio will appear here...";
  document.getElementById("previewBadge").textContent = "?";
  document.getElementById("previewBadge").className = "profile-preview-badge";
  document.getElementById("previewAvatar").style.background = "";
}

function updatePreviewBadge(label) {
  const badge = document.getElementById("previewBadge");
  const avatar = document.getElementById("previewAvatar");
  if (label === "Real Account") {
    badge.innerHTML = "✓";
    badge.className = "profile-preview-badge real-badge";
    avatar.style.background = "linear-gradient(135deg, rgba(16,185,129,0.2), rgba(16,185,129,0.05))";
  } else {
    badge.innerHTML = "✕";
    badge.className = "profile-preview-badge fake-badge";
    avatar.style.background = "linear-gradient(135deg, rgba(244,63,94,0.2), rgba(244,63,94,0.05))";
  }
}

// ── Gauge canvas ───────────────────────────────────────────
function drawGauge(percentage, isFake) {
  const canvas = document.getElementById("gaugeCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const cx = W / 2, cy = H - 10;
  const r = 78;
  const startAngle = Math.PI;
  const endAngle = 2 * Math.PI;
  const fillAngle = startAngle + (percentage / 100) * Math.PI;

  // Track
  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, endAngle);
  const isDark = document.documentElement.getAttribute("data-theme") !== "light";
  ctx.strokeStyle = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)";
  ctx.lineWidth = 12;
  ctx.lineCap = "round";
  ctx.stroke();

  // Fill gradient
  const grad = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
  if (isFake) {
    grad.addColorStop(0, "#f59e0b");
    grad.addColorStop(1, "#f43f5e");
  } else {
    grad.addColorStop(0, "#10b981");
    grad.addColorStop(1, "#4f8ef7");
  }

  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, fillAngle);
  ctx.strokeStyle = grad;
  ctx.lineWidth = 12;
  ctx.lineCap = "round";
  ctx.stroke();

  // Glow dot at tip
  const tipX = cx + r * Math.cos(fillAngle);
  const tipY = cy + r * Math.sin(fillAngle);
  ctx.beginPath();
  ctx.arc(tipX, tipY, 5, 0, Math.PI * 2);
  ctx.fillStyle = isFake ? "#f43f5e" : "#10b981";
  ctx.shadowBlur = 12;
  ctx.shadowColor = isFake ? "#f43f5e" : "#10b981";
  ctx.fill();
  ctx.shadowBlur = 0;
}

// ── Feature importance display ─────────────────────────────
const FEATURE_LABELS = {
  num_followers: "Followers",
  num_following: "Following",
  num_posts: "Posts",
  len_fullname: "Full Name Length",
  len_desc: "Bio Length",
  ratio_numlen_username: "Username Num Ratio",
  ratio_numlen_fullname: "Full Name Num Ratio"
};

function renderFeatureImportance(payload, result) {
  const container = document.getElementById("featureBars");
  if (!container) return;

  // Compute rough normalized weights
  const features = [
    { key: "num_followers", val: payload.num_followers },
    { key: "num_following", val: payload.num_following },
    { key: "num_posts", val: payload.num_posts },
    { key: "len_fullname", val: payload.len_fullname },
    { key: "len_desc", val: payload.len_desc },
    { key: "ratio_numlen_username", val: payload.ratio_numlen_username },
    { key: "ratio_numlen_fullname", val: payload.ratio_numlen_fullname }
  ];

  // Use confidence-weighted heuristic (since we don't have SHAP here)
  const isFake = result.prediction === 1;
  const score = result.confidence.score;

  const heuristics = features.map(f => {
    let influence = 0;
    const v = f.val;
    switch(f.key) {
      case "num_followers": influence = isFake ? (v < 50 ? 0.85 : v < 200 ? 0.5 : 0.2) : (v > 500 ? 0.8 : 0.4); break;
      case "num_following": influence = isFake ? (v > 2000 ? 0.9 : v > 500 ? 0.6 : 0.2) : (v < 500 ? 0.7 : 0.35); break;
      case "num_posts":     influence = isFake ? (v < 5 ? 0.8 : v < 20 ? 0.5 : 0.2) : (v > 30 ? 0.7 : 0.4); break;
      case "len_fullname":  influence = isFake ? (v < 3 ? 0.75 : 0.3) : (v > 8 ? 0.65 : 0.3); break;
      case "len_desc":      influence = isFake ? (v < 5 ? 0.7 : 0.25) : (v > 30 ? 0.7 : 0.3); break;
      case "ratio_numlen_username": influence = v > 0.4 ? 0.9 : v > 0.2 ? 0.55 : 0.15; break;
      case "ratio_numlen_fullname": influence = v > 0.3 ? 0.8 : v > 0.1 ? 0.45 : 0.1; break;
      default: influence = 0.3;
    }
    return { key: f.key, influence: Math.min(influence * score + 0.05, 1.0) };
  });

  heuristics.sort((a, b) => b.influence - a.influence);

  container.innerHTML = heuristics.map(h => {
    const pct = Math.round(h.influence * 100);
    return `
      <div class="feature-bar-row">
        <span class="fb-name">${FEATURE_LABELS[h.key] || h.key}</span>
        <div class="fb-track">
          <div class="fb-fill" style="width:${pct}%"></div>
        </div>
        <span class="fb-val">${pct}%</span>
      </div>`;
  }).join("");

  // Animate fills
  requestAnimationFrame(() => {
    container.querySelectorAll(".fb-fill").forEach((el, i) => {
      const target = heuristics[i] ? Math.round(heuristics[i].influence * 100) : 0;
      setTimeout(() => { el.style.width = target + "%"; }, 80 + i * 60);
    });
  });
}

// ── Manual predict ─────────────────────────────────────────
async function predictManual() {
  if (!validateAll()) {
    showManualError("Please fix the validation errors before predicting.");
    return;
  }

  hide(manualResultCard);
  hide(manualError);
  show(manualSkeleton);
  predictManualBtn.disabled = true;

  const payload = {
    ratio_numlen_username: safeNum(document.getElementById("ratio_numlen_username").value),
    len_fullname: safeNum(document.getElementById("len_fullname").value),
    ratio_numlen_fullname: safeNum(document.getElementById("ratio_numlen_fullname").value),
    len_desc: safeNum(document.getElementById("len_desc").value),
    num_posts: safeNum(document.getElementById("posts").value),
    num_followers: safeNum(document.getElementById("followers").value),
    num_following: safeNum(document.getElementById("following").value),
  };

  try {
    const res = await fetch(`${API_BASE}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || "Prediction failed.");

    const result = data.result;
    hide(manualSkeleton);
    renderManualResult(result, payload);
    addToHistory(result);
    updatePreviewBadge(result.label);

  } catch (err) {
    hide(manualSkeleton);
    showManualError(err.message || "Connection error. Is the backend running?");
  } finally {
    predictManualBtn.disabled = false;
  }
}

function renderManualResult(result, payload) {
  const isFake = result.prediction === 1;
  const pct = result.confidence.percentage;
  const level = result.confidence.level;

  // Icon
  const iconWrap = document.getElementById("resultIconWrap");
  const icon = document.getElementById("resultIcon");
  iconWrap.className = `result-icon-wrap ${isFake ? "fake-icon" : "real-icon"}`;
  icon.innerHTML = isFake
    ? '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>'
    : '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>';

  document.getElementById("resultLabelText").textContent = result.label;

  const badge = document.getElementById("resultBadge");
  if (level === "High" && isFake) { badge.className = "result-badge fake"; badge.textContent = "High Risk"; }
  else if (level === "High") { badge.className = "result-badge real"; badge.textContent = "Verified Real"; }
  else if (level === "Medium") { badge.className = "result-badge warn"; badge.textContent = "Medium"; }
  else { badge.className = "result-badge"; badge.textContent = level; }

  // Gauge — animate from 0
  document.getElementById("gaugePct").textContent = "0%";
  document.getElementById("gaugeLevel").textContent = level;

  let startTime = null;
  const duration = 900;
  function animateGauge(ts) {
    if (!startTime) startTime = ts;
    const progress = Math.min((ts - startTime) / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    const currentPct = Math.round(ease * pct);
    document.getElementById("gaugePct").textContent = currentPct + "%";
    drawGauge(currentPct, isFake);
    if (progress < 1) requestAnimationFrame(animateGauge);
  }
  requestAnimationFrame(animateGauge);

  // Probabilities
  const realP = result.probabilities.real;
  const fakeP = result.probabilities.fake;
  document.getElementById("probReal").textContent = realP != null ? (realP * 100).toFixed(1) + "%" : "—";
  document.getElementById("probFake").textContent = fakeP != null ? (fakeP * 100).toFixed(1) + "%" : "—";

  // Feature importance
  renderFeatureImportance(payload, result);

  show(manualResultCard);
}

// ── Bulk predict ───────────────────────────────────────────
async function predictFile() {
  if (!fileInput.files.length) {
    showBulkError("Please select a CSV or JSON file first.");
    return;
  }

  hide(bulkResults);
  hide(bulkError);
  show(bulkSkeleton);
  predictBulkBtn.disabled = true;

  try {
    const formData = new FormData();
    formData.append("file", fileInput.files[0]);

    const res = await fetch(`${API_BASE}/predict-file`, {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || "File upload failed.");

    hide(bulkSkeleton);
    bulkData = data.predictions || [];
    renderBulkResults(data.summary, bulkData);

  } catch (err) {
    hide(bulkSkeleton);
    showBulkError(err.message || "Connection error. Is the backend running?");
  } finally {
    predictBulkBtn.disabled = false;
  }
}

function renderBulkResults(summary, predictions) {
  document.getElementById("bssTotal").textContent = summary.total ?? 0;
  document.getElementById("bssReal").textContent  = summary.real  ?? 0;
  document.getElementById("bssFake").textContent  = summary.fake  ?? 0;
  document.getElementById("bssConf").textContent  = summary.average_confidence
    ? (summary.average_confidence * 100).toFixed(1) + "%" : "—";

  // Split bar
  const total = summary.total || 1;
  const realPct = ((summary.real / total) * 100).toFixed(1);
  const fakePct = ((summary.fake / total) * 100).toFixed(1);
  setTimeout(() => {
    document.getElementById("splitReal").style.width = realPct + "%";
    document.getElementById("splitFake").style.width = fakePct + "%";
  }, 50);

  currentFilter = "all";
  currentPage = 1;
  document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
  document.querySelector('.filter-btn[data-filter="all"]').classList.add("active");

  renderTable();
  show(bulkResults);
}

function renderTable() {
  const filtered = currentFilter === "all"
    ? bulkData
    : bulkData.filter(r => (currentFilter === "fake" ? r.prediction === 1 : r.prediction === 0));

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  if (currentPage > totalPages) currentPage = 1;

  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const tbody = document.getElementById("predictionsBody");
  tbody.innerHTML = pageItems.map((r, i) => {
    const globalIdx = (currentPage - 1) * PAGE_SIZE + i + 1;
    const isFake = r.prediction === 1;
    const pct = r.confidence.percentage.toFixed(1);
    const realP = r.probabilities.real != null ? (r.probabilities.real * 100).toFixed(1) : "—";
    const fakeP = r.probabilities.fake != null ? (r.probabilities.fake * 100).toFixed(1) : "—";
    const level = r.confidence.level.toLowerCase();

    return `
      <tr>
        <td style="color:var(--muted2)">${globalIdx}</td>
        <td>
          <span class="verdict-pill ${isFake ? "fake" : "real"}">
            ${isFake ? "✕ Fake" : "✓ Real"}
          </span>
        </td>
        <td>
          <span class="confidence-mini-bar">
            <span class="confidence-mini-fill ${isFake ? "fake" : "real"}" style="width:${pct}%"></span>
          </span>
          ${pct}%
        </td>
        <td>${realP}%</td>
        <td>${fakeP}%</td>
        <td><span class="level-tag ${level}">${r.confidence.level}</span></td>
      </tr>`;
  }).join("");

  // Pagination
  renderPagination(totalPages);
}

function renderPagination(totalPages) {
  const pg = document.getElementById("pagination");
  if (totalPages <= 1) { pg.innerHTML = ""; return; }

  let html = "";
  for (let i = 1; i <= totalPages; i++) {
    html += `<button class="page-btn ${i === currentPage ? "active" : ""}" onclick="goToPage(${i})">${i}</button>`;
  }
  pg.innerHTML = html;
}

function goToPage(n) {
  currentPage = n;
  renderTable();
}

// Filter buttons
document.querySelectorAll(".filter-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentFilter = btn.dataset.filter;
    currentPage = 1;
    renderTable();
  });
});

// ── Export CSV ─────────────────────────────────────────────
function exportResults() {
  if (!bulkData.length) return;
  const headers = ["#","Label","Confidence%","Real%","Fake%","Level"];
  const rows = bulkData.map((r, i) => [
    i + 1,
    r.label,
    r.confidence.percentage.toFixed(2),
    r.probabilities.real != null ? (r.probabilities.real * 100).toFixed(2) : "",
    r.probabilities.fake != null ? (r.probabilities.fake * 100).toFixed(2) : "",
    r.confidence.level
  ]);
  const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "instaguard_predictions.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ── Session history ────────────────────────────────────────
function addToHistory(result) {
  const item = {
    label: result.label,
    confidence: result.confidence.percentage.toFixed(1),
    isFake: result.prediction === 1,
    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  };
  sessionHistory.unshift(item);
  if (sessionHistory.length > 10) sessionHistory.pop();
  renderHistory();
}

function renderHistory() {
  if (!sessionHistory.length) {
    historyList.innerHTML = `
      <div class="history-empty">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
        <span>No predictions yet</span>
      </div>`;
    return;
  }
  historyList.innerHTML = sessionHistory.map(item => `
    <div class="history-item">
      <span class="hi-dot ${item.isFake ? "fake" : "real"}"></span>
      <span class="hi-label">${item.label}</span>
      <span class="hi-conf">${item.confidence}% · ${item.time}</span>
    </div>`).join("");
}

clearHistoryBtn.addEventListener("click", () => {
  sessionHistory = [];
  renderHistory();
});

// ── Helpers ────────────────────────────────────────────────
function show(el) { if (el) el.classList.remove("hidden"); }
function hide(el) { if (el) el.classList.add("hidden"); }

function showManualError(msg) {
  manualErrorText.textContent = msg;
  show(manualError);
}
function showBulkError(msg) {
  bulkErrorText.textContent = msg;
  show(bulkError);
}

function safeNum(val) {
  const n = Number(val);
  return isFinite(n) ? n : 0;
}

function fmt(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return String(n);
}

// ── Expose globals ─────────────────────────────────────────
window.predictManual = predictManual;
window.predictFile   = predictFile;
window.exportResults = exportResults;
window.goToPage      = goToPage;
window.validateField = validateField;
window.validateRatio = validateRatio;
window.updatePreview = updatePreview;
