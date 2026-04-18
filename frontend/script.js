//C:\Users\acer\Desktop\pj\Final Year Project\frontend\script.js
// ============================================================
//  InstaGuard — script.js
//  Features: history replay, demo presets, AI username fetch,
//            plain-English explanation, validation, session log
// ============================================================

const API_BASE = "https://instafake-backend-4tmw.onrender.com/";

// ── DOM refs ──────────────────────────────────────────────
const manualTab        = document.getElementById("manualTab");
const bulkTab          = document.getElementById("bulkTab");
const manualPanel      = document.getElementById("manualPanel");
const bulkPanel        = document.getElementById("bulkPanel");
const predictManualBtn = document.getElementById("predictManualBtn");
const predictBulkBtn   = document.getElementById("predictBulkBtn");
const manualSkeleton   = document.getElementById("manualSkeleton");
const manualResultCard = document.getElementById("manualResultCard");
const manualError      = document.getElementById("manualError");
const manualErrorText  = document.getElementById("manualErrorText");
const bulkSkeleton     = document.getElementById("bulkSkeleton");
const bulkResults      = document.getElementById("bulkResults");
const bulkError        = document.getElementById("bulkError");
const bulkErrorText    = document.getElementById("bulkErrorText");
const historyList      = document.getElementById("historyList");
const clearHistoryBtn  = document.getElementById("clearHistory");
const themeToggle      = document.getElementById("themeToggle");
const apiStatusText    = document.getElementById("apiStatus");
const apiStatusDot     = document.querySelector(".status-dot");
const fileInput        = document.getElementById("fileInput");
const fileSelectedInfo = document.getElementById("fileSelectedInfo");
const uploadZoneInner  = document.getElementById("uploadZoneInner");
const selectedFileName = document.getElementById("selectedFileName");
const removeFileBtn    = document.getElementById("removeFileBtn");
const uploadZone       = document.getElementById("uploadZone");
const fetchUsernameBtn = document.getElementById("fetchUsernameBtn");
const usernameInput    = document.getElementById("usernameInput");

// ── State ─────────────────────────────────────────────────
let sessionHistory = [];   // { label, confidence, isFake, time, payload, result }
let bulkData       = [];
let currentPage    = 1;
const PAGE_SIZE    = 10;
let currentFilter  = "all";

// ── Inject spin keyframe ───────────────────────────────────
const spinStyle = document.createElement("style");
spinStyle.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
document.head.appendChild(spinStyle);

// ── Theme ─────────────────────────────────────────────────
const savedTheme = localStorage.getItem("ig-theme") || "light";
if (savedTheme === "dark") document.documentElement.setAttribute("data-theme", "dark");

themeToggle?.addEventListener("click", () => {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  if (isDark) {
    document.documentElement.removeAttribute("data-theme");
    localStorage.setItem("ig-theme", "light");
  } else {
    document.documentElement.setAttribute("data-theme", "dark");
    localStorage.setItem("ig-theme", "dark");
  }
});

// ── Health check ──────────────────────────────────────────
async function checkHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(15000) });
    if (res.ok) {
      apiStatusText.textContent = "API Online";
      apiStatusDot.classList.add("online");
      apiStatusDot.classList.remove("offline");
    } else throw new Error();
  } catch {
    apiStatusText.textContent = "API Offline";
    apiStatusDot.classList.remove("online");
    apiStatusDot.classList.add("offline");
  }
}
checkHealth();

// ── Particle canvas ────────────────────────────────────────
(function initParticles() {
  const canvas = document.getElementById("particleCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let W, H, particles;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  function makeParticles() {
    particles = Array.from({ length: 32 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      r: Math.random() * 1.5 + 0.4,
      vx: (Math.random() - 0.5) * 0.22,
      vy: (Math.random() - 0.5) * 0.22,
      alpha: Math.random() * 0.35 + 0.08
    }));
  }
  function draw() {
    ctx.clearRect(0, 0, W, H);
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = isDark
        ? `rgba(79,142,247,${p.alpha})`
        : `rgba(59,99,247,${p.alpha * 0.55})`;
      ctx.fill();
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
    });
    requestAnimationFrame(draw);
  }
  window.addEventListener("resize", () => { resize(); makeParticles(); });
  resize(); makeParticles(); draw();
})();

// ── Tab switching ─────────────────────────────────────────
manualTab?.addEventListener("click", () => switchTab("manual"));
bulkTab?.addEventListener("click",   () => switchTab("bulk"));

function switchTab(mode) {
  if (mode === "manual") {
    manualTab.classList.add("active");   bulkTab.classList.remove("active");
    manualPanel.classList.remove("hidden"); bulkPanel.classList.add("hidden");
  } else {
    bulkTab.classList.add("active");   manualTab.classList.remove("active");
    bulkPanel.classList.remove("hidden"); manualPanel.classList.add("hidden");
  }
}

// ── Reset form ─────────────────────────────────────────────
document.getElementById("resetForm")?.addEventListener("click", () => {
  ["followers","following","posts","len_fullname","len_desc",
   "ratio_numlen_username","ratio_numlen_fullname"].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.value = ""; clearFieldState(el); }
  });
  if (usernameInput) usernameInput.value = "";
  resetPreview();
  hide(manualResultCard);
  hide(manualError);
});

// ── Demo Presets ───────────────────────────────────────────
const PRESETS = {
  bot: {
    username: "user73948201",
    followers: 12, following: 3842, posts: 0,
    len_fullname: 0, len_desc: 0,
    ratio_numlen_username: 0.72, ratio_numlen_fullname: 0.0
  },
  real: {
    username: "sarah.travels",
    followers: 847, following: 312, posts: 156,
    len_fullname: 14, len_desc: 87,
    ratio_numlen_username: 0.0, ratio_numlen_fullname: 0.0
  },
  edge: {
    username: "user_2024x",
    followers: 203, following: 1180, posts: 8,
    len_fullname: 6, len_desc: 22,
    ratio_numlen_username: 0.33, ratio_numlen_fullname: 0.0
  }
};

function loadPreset(type) {
  const p = PRESETS[type];
  if (!p) return;

  setField("followers",             p.followers);
  setField("following",             p.following);
  setField("posts",                 p.posts);
  setField("len_fullname",          p.len_fullname);
  setField("len_desc",              p.len_desc);
  setField("ratio_numlen_username", p.ratio_numlen_username);
  setField("ratio_numlen_fullname", p.ratio_numlen_fullname);

  if (usernameInput) usernameInput.value = p.username || "";
  updatePreview();

  // Short delay so the user sees the fields fill before prediction fires
  setTimeout(() => predictManual(), 300);
}

function setField(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  el.value = val;
  if (id.startsWith("ratio_")) validateRatio(el);
  else validateField(el);
}

// ── AI Username Estimator ──────────────────────────────────
async function fetchUsername() {
  const username = usernameInput?.value.trim();
  if (!username) {
    if (usernameInput) {
      usernameInput.style.borderColor = "var(--fake)";
      setTimeout(() => { usernameInput.style.borderColor = ""; }, 1500);
    }
    return;
  }

  fetchUsernameBtn.disabled = true;
  const origHTML = fetchUsernameBtn.innerHTML;
  fetchUsernameBtn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
      style="animation:spin 0.8s linear infinite">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg> Estimating...`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 400,
        messages: [{
          role: "user",
          content: `You are assisting a fake Instagram account detection tool. Based ONLY on the username pattern below, estimate realistic feature values. Return ONLY valid JSON — no explanation, no markdown, no backticks.

Username: "${username}"

Return exactly:
{
  "num_followers": <integer 0-50000>,
  "num_following": <integer 0-10000>,
  "num_posts": <integer 0-5000>,
  "len_fullname": <integer 0-50>,
  "len_desc": <integer 0-150>,
  "ratio_numlen_username": <float: digits in "${username}" divided by total length of "${username}">,
  "ratio_numlen_fullname": <float 0.0-1.0>
}

Rules:
- Compute ratio_numlen_username precisely: count digits in the username, divide by username length.
- If the username looks bot-like (many digits, random characters, very long number strings) → low followers (<30), high following (>2000), 0 posts, len_fullname 0, len_desc 0.
- If the username looks human (real name, words, underscores but few digits) → moderate followers (200-2000), normal following (100-600), some posts (20-300), meaningful name and bio lengths.
- Edge cases get intermediate values.`
        }]
      })
    });

    const data = await response.json();
    const raw  = data.content?.map(i => i.text || "").join("") || "";
    const clean = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    setField("followers",             parsed.num_followers         || 0);
    setField("following",             parsed.num_following         || 0);
    setField("posts",                 parsed.num_posts             || 0);
    setField("len_fullname",          parsed.len_fullname          || 0);
    setField("len_desc",              parsed.len_desc              || 0);
    setField("ratio_numlen_username", parsed.ratio_numlen_username || 0);
    setField("ratio_numlen_fullname", parsed.ratio_numlen_fullname || 0);
    updatePreview();

    // Flash success state
    fetchUsernameBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <polyline points="20 6 9 17 4 12"/>
      </svg> Done!`;
    setTimeout(() => {
      fetchUsernameBtn.innerHTML = origHTML;
      fetchUsernameBtn.disabled = false;
    }, 1600);

  } catch (err) {
    fetchUsernameBtn.innerHTML = origHTML;
    fetchUsernameBtn.disabled = false;
    showManualError("Could not estimate features. Please fill the form manually.");
  }
}

// Enter key on username input
usernameInput?.addEventListener("keydown", e => {
  if (e.key === "Enter") fetchUsername();
});

// ── Validation ─────────────────────────────────────────────
const fieldRules = {
  followers:    { max: 1e8 },
  following:    { max: 1e8 },
  posts:        { max: 1e6 },
  len_fullname: { max: 200 },
  len_desc:     { max: 500 },
};

function validateField(input) {
  const id   = input.id;
  const wrap = document.getElementById(`wrap_${id}`);
  const fb   = document.getElementById(`fb_${id}`);
  const val  = input.value.trim();
  if (!wrap || !fb) return true;
  if (val === "") { clearFieldState(input); fb.textContent = ""; fb.className = "field-feedback"; return true; }
  const num  = Number(val);
  const rule = fieldRules[id];
  if (isNaN(num) || !isFinite(num)) { setInvalid(wrap, fb, "Must be a valid number."); return false; }
  if (num < 0) { setInvalid(wrap, fb, "Cannot be negative."); return false; }
  if (rule && num > rule.max) { setInvalid(wrap, fb, `Max: ${rule.max.toLocaleString()}`); return false; }
  if (id === "followers" && num === 0)  { setWarn(wrap, fb, "0 followers — suspicious."); return true; }
  if (id === "following" && num > 5000) { setWarn(wrap, fb, "High following — possible bot."); return true; }
  setValid(wrap, fb, "✓"); return true;
}

function validateRatio(input) {
  const id   = input.id;
  const wrap = document.getElementById(`wrap_${id}`);
  const fb   = document.getElementById(`fb_${id}`);
  const val  = input.value.trim();
  if (!wrap || !fb) return true;
  if (val === "") { clearFieldState(input); fb.textContent = ""; fb.className = "field-feedback"; return true; }
  const num = Number(val);
  if (isNaN(num) || !isFinite(num)) { setInvalid(wrap, fb, "Must be 0.0 – 1.0"); return false; }
  if (num < 0 || num > 1) { setInvalid(wrap, fb, "Value must be between 0 and 1"); return false; }
  if (num > 0.6) { setWarn(wrap, fb, "High ratio — unusual for real accounts."); return true; }
  setValid(wrap, fb, "✓"); return true;
}

function setValid  (w, f, m) { w.className = "field-input-wrap valid";   f.textContent = m; f.className = "field-feedback valid-msg"; }
function setInvalid(w, f, m) { w.className = "field-input-wrap invalid"; f.textContent = m; f.className = "field-feedback invalid-msg"; }
function setWarn   (w, f, m) { w.className = "field-input-wrap";          f.textContent = "⚠ " + m; f.className = "field-feedback invalid-msg"; }
function clearFieldState(input) {
  const wrap = document.getElementById(`wrap_${input.id}`);
  if (wrap) wrap.className = "field-input-wrap";
}

function validateAll() {
  let ok = true;
  ["followers","following","posts","len_fullname","len_desc"].forEach(id => {
    const el = document.getElementById(id);
    if (el && el.value.trim() !== "" && !validateField(el)) ok = false;
  });
  ["ratio_numlen_username","ratio_numlen_fullname"].forEach(id => {
    const el = document.getElementById(id);
    if (el && el.value.trim() !== "" && !validateRatio(el)) ok = false;
  });
  return ok;
}

// ── Profile preview ────────────────────────────────────────
function updatePreview() {
  const followers = safeNum(document.getElementById("followers")?.value);
  const following = safeNum(document.getElementById("following")?.value);
  const posts     = safeNum(document.getElementById("posts")?.value);
  const bioLen    = safeNum(document.getElementById("len_desc")?.value);
  const username  = usernameInput?.value.trim() || "";
  const ratio     = safeNum(document.getElementById("ratio_numlen_username")?.value);

  document.getElementById("previewPosts").textContent     = fmt(posts);
  document.getElementById("previewFollowers").textContent = fmt(followers);
  document.getElementById("previewFollowing").textContent = fmt(following);
  document.getElementById("previewName").textContent      = username ? `@${username}` : "@username";

  const bioEl = document.getElementById("previewBio");
  if (bioEl) {
    if (bioLen === 0)    bioEl.textContent = "No bio added.";
    else if (bioLen < 20) bioEl.textContent = `Short bio (${bioLen} chars)`;
    else                 bioEl.textContent = `Has a bio of ${bioLen} characters.`;
  }

  // Live avatar border — colour shifts with risk signal
  const avatar = document.getElementById("previewAvatar");
  if (avatar) {
    const risk = computeRiskSignal(followers, following, posts, bioLen, ratio);
    if (risk > 0.65) {
      avatar.style.borderColor = "rgba(225,29,72,0.5)";
      avatar.style.boxShadow   = "0 0 14px rgba(225,29,72,0.2)";
    } else if (risk > 0.35) {
      avatar.style.borderColor = "rgba(217,119,6,0.5)";
      avatar.style.boxShadow   = "0 0 14px rgba(217,119,6,0.15)";
    } else if (followers > 0 || following > 0) {
      avatar.style.borderColor = "rgba(5,150,105,0.5)";
      avatar.style.boxShadow   = "0 0 14px rgba(5,150,105,0.15)";
    } else {
      avatar.style.borderColor = "";
      avatar.style.boxShadow   = "";
    }
  }
}

function computeRiskSignal(followers, following, posts, bioLen, ratio) {
  let score = 0;
  if (followers < 20)  score += 0.30;
  if (following > 2000) score += 0.25;
  if (posts < 3)       score += 0.20;
  if (bioLen < 5)      score += 0.15;
  if (ratio > 0.5)     score += 0.30;
  return Math.min(score, 1);
}

function resetPreview() {
  ["previewPosts","previewFollowers","previewFollowing"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = "0";
  });
  const bio  = document.getElementById("previewBio");
  const name = document.getElementById("previewName");
  const badge  = document.getElementById("previewBadge");
  const avatar = document.getElementById("previewAvatar");
  if (bio)  bio.textContent   = "Bio will appear here...";
  if (name) name.textContent  = "@username";
  if (badge) { badge.innerHTML = "?"; badge.className = "profile-preview-badge"; }
  if (avatar) { avatar.style.borderColor = ""; avatar.style.boxShadow = ""; avatar.style.background = ""; }
}

function updatePreviewBadge(label) {
  const badge  = document.getElementById("previewBadge");
  const avatar = document.getElementById("previewAvatar");
  if (!badge || !avatar) return;
  if (label === "Real Account") {
    badge.innerHTML   = "✓";
    badge.className   = "profile-preview-badge real-badge";
    avatar.style.background = "linear-gradient(135deg, rgba(5,150,105,0.12), rgba(5,150,105,0.04))";
  } else {
    badge.innerHTML   = "✕";
    badge.className   = "profile-preview-badge fake-badge";
    avatar.style.background = "linear-gradient(135deg, rgba(225,29,72,0.12), rgba(225,29,72,0.04))";
  }
}

// ── Semicircle gauge ───────────────────────────────────────
function drawGauge(percentage, isFake) {
  const canvas = document.getElementById("gaugeCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const cx = W / 2, cy = H - 10, r = 78;
  const startAngle = Math.PI;
  const fillAngle  = startAngle + (percentage / 100) * Math.PI;
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";

  // Track
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI, 2 * Math.PI);
  ctx.strokeStyle = isDark ? "rgba(255,255,255,0.06)" : "rgba(59,99,247,0.08)";
  ctx.lineWidth = 12; ctx.lineCap = "round"; ctx.stroke();

  // Fill
  const grad = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
  if (isFake) { grad.addColorStop(0, "#f59e0b"); grad.addColorStop(1, "#e11d48"); }
  else        { grad.addColorStop(0, "#059669"); grad.addColorStop(1, "#3b63f7"); }

  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, fillAngle);
  ctx.strokeStyle = grad; ctx.lineWidth = 12; ctx.lineCap = "round"; ctx.stroke();

  // Tip dot
  const tipX = cx + r * Math.cos(fillAngle);
  const tipY = cy + r * Math.sin(fillAngle);
  ctx.beginPath(); ctx.arc(tipX, tipY, 5, 0, Math.PI * 2);
  ctx.fillStyle  = isFake ? "#e11d48" : "#059669";
  ctx.shadowBlur = 12; ctx.shadowColor = ctx.fillStyle;
  ctx.fill(); ctx.shadowBlur = 0;
}

// ── Feature importance bars ────────────────────────────────
const FEATURE_LABELS = {
  num_followers: "Followers",
  num_following: "Following",
  num_posts:     "Posts",
  len_fullname:  "Full Name Length",
  len_desc:      "Bio Length",
  ratio_numlen_username: "Username Num Ratio",
  ratio_numlen_fullname: "Full Name Num Ratio"
};

function renderFeatureImportance(payload, result) {
  const container = document.getElementById("featureBars");
  if (!container) return;

  const isFake = result.prediction === 1;
  const score  = result.confidence.score;

  const features = [
    { key: "num_followers",         val: payload.num_followers },
    { key: "num_following",         val: payload.num_following },
    { key: "num_posts",             val: payload.num_posts },
    { key: "len_fullname",          val: payload.len_fullname },
    { key: "len_desc",              val: payload.len_desc },
    { key: "ratio_numlen_username", val: payload.ratio_numlen_username },
    { key: "ratio_numlen_fullname", val: payload.ratio_numlen_fullname }
  ];

  const heuristics = features.map(f => {
    let inf = 0;
    const v = f.val;
    switch (f.key) {
      case "num_followers":         inf = isFake ? (v < 50 ? 0.85 : v < 200 ? 0.5 : 0.2) : (v > 500 ? 0.8 : 0.4); break;
      case "num_following":         inf = isFake ? (v > 2000 ? 0.9 : v > 500 ? 0.6 : 0.2) : (v < 500 ? 0.7 : 0.35); break;
      case "num_posts":             inf = isFake ? (v < 5 ? 0.8 : v < 20 ? 0.5 : 0.2) : (v > 30 ? 0.7 : 0.4); break;
      case "len_fullname":          inf = isFake ? (v < 3 ? 0.75 : 0.3) : (v > 8 ? 0.65 : 0.3); break;
      case "len_desc":              inf = isFake ? (v < 5 ? 0.7 : 0.25) : (v > 30 ? 0.7 : 0.3); break;
      case "ratio_numlen_username": inf = v > 0.4 ? 0.9 : v > 0.2 ? 0.55 : 0.15; break;
      case "ratio_numlen_fullname": inf = v > 0.3 ? 0.8 : v > 0.1 ? 0.45 : 0.10; break;
      default: inf = 0.3;
    }
    return { key: f.key, influence: Math.min(inf * score + 0.05, 1.0) };
  }).sort((a, b) => b.influence - a.influence);

  container.innerHTML = heuristics.map(h => {
    const pct = Math.round(h.influence * 100);
    return `<div class="feature-bar-row">
      <span class="fb-name">${FEATURE_LABELS[h.key] || h.key}</span>
      <div class="fb-track"><div class="fb-fill" style="width:0%"></div></div>
      <span class="fb-val">${pct}%</span>
    </div>`;
  }).join("");

  // Animate bars in with stagger
  requestAnimationFrame(() => {
    container.querySelectorAll(".fb-fill").forEach((el, i) => {
      const pct = Math.round(heuristics[i]?.influence * 100 || 0);
      setTimeout(() => { el.style.width = pct + "%"; }, 80 + i * 65);
    });
  });
}

// ── Plain-English Explanation ──────────────────────────────
function generateExplanation(payload, result) {
  const isFake  = result.prediction === 1;
  const level   = result.confidence.level;
  const pct     = result.confidence.percentage.toFixed(1);
  const flags   = [];
  const reasons = [];

  // Followers
  if (payload.num_followers < 20) {
    flags.push({ text: `Only ${payload.num_followers} followers`, type: "suspicious" });
    reasons.push("very few followers");
  } else if (payload.num_followers > 800) {
    flags.push({ text: `${fmt(payload.num_followers)} followers`, type: "normal" });
  }

  // Following
  if (payload.num_following > 2000) {
    flags.push({ text: `Following ${fmt(payload.num_following)} accounts`, type: "suspicious" });
    reasons.push(`mass-following ${fmt(payload.num_following)} accounts`);
  } else if (payload.num_following < 600 && payload.num_following > 0) {
    flags.push({ text: `Normal following (${fmt(payload.num_following)})`, type: "normal" });
  }

  // Posts
  if (payload.num_posts === 0) {
    flags.push({ text: "0 posts", type: "suspicious" });
    reasons.push("no posts at all");
  } else if (payload.num_posts < 5) {
    flags.push({ text: `Only ${payload.num_posts} post${payload.num_posts !== 1 ? "s" : ""}`, type: "warning" });
    reasons.push("very few posts");
  } else {
    flags.push({ text: `${fmt(payload.num_posts)} posts`, type: "normal" });
  }

  // Username numeric ratio
  if (payload.ratio_numlen_username > 0.5) {
    flags.push({ text: `High username digit ratio (${(payload.ratio_numlen_username * 100).toFixed(0)}%)`, type: "suspicious" });
    reasons.push(`username is ${(payload.ratio_numlen_username * 100).toFixed(0)}% digits`);
  } else if (payload.ratio_numlen_username > 0.25) {
    flags.push({ text: `Some username digits (${(payload.ratio_numlen_username * 100).toFixed(0)}%)`, type: "warning" });
  } else {
    flags.push({ text: `Clean username`, type: "normal" });
  }

  // Bio
  if (payload.len_desc < 5) {
    flags.push({ text: "No bio", type: "suspicious" });
    reasons.push("no profile bio");
  } else if (payload.len_desc > 40) {
    flags.push({ text: "Detailed bio", type: "normal" });
  }

  // Display name
  if (payload.len_fullname < 3) {
    flags.push({ text: "No display name", type: "suspicious" });
    reasons.push("missing display name");
  } else {
    flags.push({ text: `Display name (${payload.len_fullname} chars)`, type: "normal" });
  }

  // Follower / following ratio
  if (payload.num_following > 0 && payload.num_followers > 0) {
    const ratio = payload.num_following / payload.num_followers;
    if (ratio > 5) {
      const r = ratio.toFixed(1);
      flags.push({ text: `Follows ${r}× more than followers`, type: "suspicious" });
      reasons.push(`follows ${r}× more than follows back`);
    }
  }

  // Build the explanation paragraph
  let text = "";
  if (isFake) {
    if (reasons.length === 0) {
      text = `The model predicted this as a <strong>fake account</strong> with <strong>${level.toLowerCase()} confidence (${pct}%)</strong>. The overall combination of feature values matched patterns commonly observed in inauthentic accounts in the training data.`;
    } else {
      text = `This account was classified as <strong>fake</strong> with <strong>${level.toLowerCase()} confidence (${pct}%)</strong>. The key signals driving this verdict were: <em>${reasons.join(", ")}</em>. These patterns are strongly associated with bot or inauthentic accounts based on the model's training data.`;
    }
  } else {
    if (reasons.length === 0) {
      text = `The model predicted this as a <strong>real account</strong> with <strong>${level.toLowerCase()} confidence (${pct}%)</strong>. The profile's feature values closely match patterns observed in authentic Instagram accounts.`;
    } else {
      text = `This account appears to be <strong>real</strong> with <strong>${level.toLowerCase()} confidence (${pct}%)</strong>. The overall profile structure — follower balance, content activity, and identity completeness — aligns with authentic account behaviour. Some minor signals were present (${reasons.join(", ")}), but not sufficient to trigger a fake classification.`;
    }
  }

  // Write to DOM
  const explanationEl = document.getElementById("explanationText");
  const flagsEl       = document.getElementById("explanationFlags");
  if (explanationEl) explanationEl.innerHTML = text;
  if (flagsEl) {
    flagsEl.innerHTML = flags.slice(0, 7).map((f, i) =>
      `<span class="exp-flag ${f.type}" style="animation-delay:${i * 0.06}s">${f.text}</span>`
    ).join("");
  }
}

// ── Render manual result ───────────────────────────────────
function renderManualResult(result, payload) {
  const isFake = result.prediction === 1;
  const pct    = result.confidence.percentage;
  const level  = result.confidence.level;

  // Result icon
  const iconWrap = document.getElementById("resultIconWrap");
  const icon     = document.getElementById("resultIcon");
  if (iconWrap) iconWrap.className = `result-icon-wrap ${isFake ? "fake-icon" : "real-icon"}`;
  if (icon) {
    icon.innerHTML = isFake
      ? '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>'
      : '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>';
  }

  const labelEl = document.getElementById("resultLabelText");
  if (labelEl) labelEl.textContent = result.label;

  // Badge
  const badge = document.getElementById("resultBadge");
  if (badge) {
    if (level === "High" && isFake)  { badge.className = "result-badge fake"; badge.textContent = "High Risk"; }
    else if (level === "High")       { badge.className = "result-badge real"; badge.textContent = "Verified Real"; }
    else if (level === "Medium")     { badge.className = "result-badge warn"; badge.textContent = "Medium Confidence"; }
    else                             { badge.className = "result-badge";      badge.textContent = level; }
  }

  // Card glow class
  const card = document.getElementById("manualResultCard");
  if (card) card.className = `result-card ${isFake ? "glow-fake" : "glow-real"}`;

  // Animate gauge from 0 → pct
  const gaugePctEl = document.getElementById("gaugePct");
  const gaugeLvlEl = document.getElementById("gaugeLevel");
  if (gaugePctEl) gaugePctEl.textContent = "0%";
  if (gaugeLvlEl) gaugeLvlEl.textContent = level;

  let startTime = null;
  const duration = 900;
  function animateGauge(ts) {
    if (!startTime) startTime = ts;
    const progress = Math.min((ts - startTime) / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    const cur  = Math.round(ease * pct);
    if (gaugePctEl) gaugePctEl.textContent = cur + "%";
    drawGauge(cur, isFake);
    if (progress < 1) requestAnimationFrame(animateGauge);
  }
  requestAnimationFrame(animateGauge);

  // Probabilities
  const realP = result.probabilities.real;
  const fakeP = result.probabilities.fake;
  const probRealEl = document.getElementById("probReal");
  const probFakeEl = document.getElementById("probFake");
  if (probRealEl) probRealEl.textContent = realP != null ? (realP * 100).toFixed(1) + "%" : "—";
  if (probFakeEl) probFakeEl.textContent = fakeP != null ? (fakeP * 100).toFixed(1) + "%" : "—";

  renderFeatureImportance(payload, result);
  generateExplanation(payload, result);
  show(card);
}

// ── Manual predict ─────────────────────────────────────────
async function predictManual() {
  if (!validateAll()) {
    showManualError("Please fix the validation errors before predicting.");
    return;
  }

  hide(manualResultCard); hide(manualError);
  show(manualSkeleton);
  if (predictManualBtn) predictManualBtn.disabled = true;

  const payload = {
    ratio_numlen_username: safeNum(document.getElementById("ratio_numlen_username")?.value),
    len_fullname:          safeNum(document.getElementById("len_fullname")?.value),
    ratio_numlen_fullname: safeNum(document.getElementById("ratio_numlen_fullname")?.value),
    len_desc:              safeNum(document.getElementById("len_desc")?.value),
    num_posts:             safeNum(document.getElementById("posts")?.value),
    num_followers:         safeNum(document.getElementById("followers")?.value),
    num_following:         safeNum(document.getElementById("following")?.value),
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
    addToHistory(result, payload);
    updatePreviewBadge(result.label);

  } catch (err) {
    hide(manualSkeleton);
    showManualError(err.message || "Connection error. Is the backend running?");
  } finally {
    if (predictManualBtn) predictManualBtn.disabled = false;
  }
}

// ── Bulk predict ───────────────────────────────────────────
async function predictFile() {
  if (!fileInput?.files.length) {
    showBulkError("Please select a CSV or JSON file first.");
    return;
  }

  hide(bulkResults); hide(bulkError);
  show(bulkSkeleton);
  if (predictBulkBtn) predictBulkBtn.disabled = true;

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
    if (predictBulkBtn) predictBulkBtn.disabled = false;
  }
}

function renderBulkResults(summary, predictions) {
  const el = id => document.getElementById(id);
  if (el("bssTotal")) el("bssTotal").textContent = summary.total ?? 0;
  if (el("bssReal"))  el("bssReal").textContent  = summary.real  ?? 0;
  if (el("bssFake"))  el("bssFake").textContent  = summary.fake  ?? 0;
  if (el("bssConf"))  el("bssConf").textContent  =
    summary.average_confidence ? (summary.average_confidence * 100).toFixed(1) + "%" : "—";

  const total   = summary.total || 1;
  const realPct = ((summary.real / total) * 100).toFixed(1);
  const fakePct = ((summary.fake / total) * 100).toFixed(1);
  setTimeout(() => {
    const sr = document.getElementById("splitReal");
    const sf = document.getElementById("splitFake");
    if (sr) sr.style.width = realPct + "%";
    if (sf) sf.style.width = fakePct + "%";
  }, 50);

  currentFilter = "all"; currentPage = 1;
  document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
  document.querySelector('.filter-btn[data-filter="all"]')?.classList.add("active");
  renderTable();
  show(document.getElementById("bulkResults"));
}

function renderTable() {
  const filtered = currentFilter === "all"
    ? bulkData
    : bulkData.filter(r => currentFilter === "fake" ? r.prediction === 1 : r.prediction === 0);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  if (currentPage > totalPages) currentPage = 1;

  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const tbody = document.getElementById("predictionsBody");
  if (!tbody) return;

  tbody.innerHTML = pageItems.map((r, i) => {
    const idx    = (currentPage - 1) * PAGE_SIZE + i + 1;
    const isFake = r.prediction === 1;
    const pct    = r.confidence.percentage.toFixed(1);
    const realP  = r.probabilities.real != null ? (r.probabilities.real * 100).toFixed(1) : "—";
    const fakeP  = r.probabilities.fake != null ? (r.probabilities.fake * 100).toFixed(1) : "—";
    const lvl    = r.confidence.level.toLowerCase();
    return `
      <tr>
        <td style="color:var(--muted2)">${idx}</td>
        <td><span class="verdict-pill ${isFake ? "fake" : "real"}">${isFake ? "✕ Fake" : "✓ Real"}</span></td>
        <td>
          <span class="confidence-mini-bar">
            <span class="confidence-mini-fill ${isFake ? "fake" : "real"}" style="width:${pct}%"></span>
          </span>${pct}%
        </td>
        <td>${realP}%</td>
        <td>${fakeP}%</td>
        <td><span class="level-tag ${lvl}">${r.confidence.level}</span></td>
      </tr>`;
  }).join("");

  renderPagination(totalPages);
}

function renderPagination(totalPages) {
  const pg = document.getElementById("pagination");
  if (!pg) return;
  if (totalPages <= 1) { pg.innerHTML = ""; return; }
  pg.innerHTML = Array.from({ length: totalPages }, (_, i) =>
    `<button class="page-btn ${i + 1 === currentPage ? "active" : ""}" onclick="goToPage(${i + 1})">${i + 1}</button>`
  ).join("");
}

function goToPage(n) { currentPage = n; renderTable(); }

// Filter buttons
document.querySelectorAll(".filter-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentFilter = btn.dataset.filter;
    currentPage   = 1;
    renderTable();
  });
});

// ── Export CSV ─────────────────────────────────────────────
function exportResults() {
  if (!bulkData.length) return;
  const headers = ["#","Label","Confidence%","Real%","Fake%","Level"];
  const rows = bulkData.map((r, i) => [
    i + 1, r.label,
    r.confidence.percentage.toFixed(2),
    r.probabilities.real != null ? (r.probabilities.real * 100).toFixed(2) : "",
    r.probabilities.fake != null ? (r.probabilities.fake * 100).toFixed(2) : "",
    r.confidence.level
  ]);
  const csv  = [headers, ...rows].map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = "instaguard_predictions.csv"; a.click();
  URL.revokeObjectURL(url);
}

// ── Session history ────────────────────────────────────────
function addToHistory(result, payload) {
  const item = {
    label:      result.label,
    confidence: result.confidence.percentage.toFixed(1),
    isFake:     result.prediction === 1,
    time:       new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    payload,        // store for replay
    result          // store for replay
  };
  sessionHistory.unshift(item);
  if (sessionHistory.length > 10) sessionHistory.pop();
  renderHistory();
}

function renderHistory() {
  if (!historyList) return;
  if (!sessionHistory.length) {
    historyList.innerHTML = `
      <div class="history-empty">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
        </svg>
        <span>No predictions yet</span>
      </div>`;
    return;
  }

  historyList.innerHTML = sessionHistory.map((item, idx) => `
    <div class="history-item" onclick="replayHistory(${idx})" title="Click to replay this prediction">
      <span class="hi-dot ${item.isFake ? "fake" : "real"}"></span>
      <span class="hi-label">${item.label}</span>
      <span class="hi-conf">${item.confidence}% · ${item.time}</span>
      <span class="hi-replay">↩</span>
    </div>`).join("");
}

// ── History replay ─────────────────────────────────────────
function replayHistory(idx) {
  const item = sessionHistory[idx];
  if (!item || !item.payload || !item.result) return;

  // Switch to manual tab
  switchTab("manual");

  // Re-populate fields
  const p = item.payload;
  setField("followers",             p.num_followers         || 0);
  setField("following",             p.num_following         || 0);
  setField("posts",                 p.num_posts             || 0);
  setField("len_fullname",          p.len_fullname          || 0);
  setField("len_desc",              p.len_desc              || 0);
  setField("ratio_numlen_username", p.ratio_numlen_username || 0);
  setField("ratio_numlen_fullname", p.ratio_numlen_fullname || 0);
  updatePreview();

  // Re-render result without hitting the API
  hide(manualError);
  hide(manualSkeleton);
  renderManualResult(item.result, p);
  updatePreviewBadge(item.result.label);

  // Scroll result into view smoothly
  setTimeout(() => {
    document.getElementById("manualResultCard")?.scrollIntoView({
      behavior: "smooth", block: "nearest"
    });
  }, 150);
}

clearHistoryBtn?.addEventListener("click", () => {
  sessionHistory = [];
  renderHistory();
});

// ── File upload UI ─────────────────────────────────────────
uploadZone?.addEventListener("dragover", e => {
  e.preventDefault();
  uploadZone.classList.add("drag-over");
});
uploadZone?.addEventListener("dragleave", () => uploadZone.classList.remove("drag-over"));
uploadZone?.addEventListener("drop", e => {
  e.preventDefault();
  uploadZone.classList.remove("drag-over");
  if (e.dataTransfer.files[0]) handleFileSelect(e.dataTransfer.files[0]);
});
fileInput?.addEventListener("change", () => {
  if (fileInput.files[0]) handleFileSelect(fileInput.files[0]);
});

function handleFileSelect(file) {
  const name = file.name;
  if (!name.endsWith(".csv") && !name.endsWith(".json")) {
    showBulkError("Only CSV or JSON files are supported.");
    return;
  }
  if (selectedFileName) selectedFileName.textContent = name;
  show(fileSelectedInfo);
  if (uploadZoneInner) uploadZoneInner.classList.add("hidden");
}

removeFileBtn?.addEventListener("click", e => {
  e.stopPropagation();
  if (fileInput) fileInput.value = "";
  hide(fileSelectedInfo);
  if (uploadZoneInner) uploadZoneInner.classList.remove("hidden");
});

// ── Helpers ────────────────────────────────────────────────
function show(el) { if (el) el.classList.remove("hidden"); }
function hide(el) { if (el) el.classList.add("hidden"); }

function showManualError(msg) {
  if (manualErrorText) manualErrorText.textContent = msg;
  show(manualError);
}
function showBulkError(msg) {
  if (bulkErrorText) bulkErrorText.textContent = msg;
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
window.replayHistory = replayHistory;
window.loadPreset    = loadPreset;
window.fetchUsername = fetchUsername;
window.validateField = validateField;
window.validateRatio = validateRatio;
window.updatePreview = updatePreview;
