// C:\Users\acer\Desktop\pj\Final Year Project\frontend\script.js
const manualBtn = document.getElementById("manualBtn");
const fileBtn = document.getElementById("fileBtn");
const manualSection = document.getElementById("manualSection");
const fileSection = document.getElementById("fileSection");

const loader = document.getElementById("loader");
const resultCard = document.getElementById("resultCard");
const bulkSummaryCard = document.getElementById("bulkSummaryCard");
const errorBox = document.getElementById("errorBox");

const resultText = document.getElementById("resultText");
const resultChip = document.getElementById("resultChip");
const confidenceText = document.getElementById("confidenceText");
const confidenceBar = document.getElementById("confidenceBar");
const probabilityText = document.getElementById("probabilityText");

const summaryTotal = document.getElementById("summaryTotal");
const summaryReal = document.getElementById("summaryReal");
const summaryFake = document.getElementById("summaryFake");

const API_BASE = "http://127.0.0.1:5000";

manualBtn.addEventListener("click", () => switchMode("manual"));
fileBtn.addEventListener("click", () => switchMode("file"));

function switchMode(mode) {
  hideError();
  resultCard.classList.add("hidden");
  bulkSummaryCard.classList.add("hidden");

  if (mode === "manual") {
    manualSection.classList.remove("hidden");
    fileSection.classList.add("hidden");
    manualBtn.classList.add("active");
    fileBtn.classList.remove("active");
  } else {
    fileSection.classList.remove("hidden");
    manualSection.classList.add("hidden");
    fileBtn.classList.add("active");
    manualBtn.classList.remove("active");
  }
}

function showLoader(state) {
  loader.classList.toggle("hidden", !state);
}

function showError(message) {
  errorBox.textContent = message;
  errorBox.classList.remove("hidden");
}

function hideError() {
  errorBox.classList.add("hidden");
  errorBox.textContent = "";
}

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function confidenceClass(level, label) {
  if (level === "High" && label === "Fake Account") return "danger";
  if (level === "High" && label === "Real Account") return "success";
  if (level === "Medium") return "warning";
  return "neutral";
}

function updateResultUI(result) {
  const label = result.label;
  const score = result.confidence.score;
  const percentage = result.confidence.percentage;
  const level = result.confidence.level;

  resultCard.classList.remove("hidden");

  resultText.textContent = label;
  confidenceText.textContent = `${level} (${percentage}%)`;
  probabilityText.textContent =
    `Real: ${(result.probabilities.real * 100).toFixed(2)}% | ` +
    `Fake: ${(result.probabilities.fake * 100).toFixed(2)}%`;

  const chipClass = confidenceClass(level, label);
  resultChip.className = `result-chip ${chipClass}`;
  resultChip.textContent = chipClass === "success" ? "Real" : chipClass === "danger" ? "Fake" : level;

  confidenceBar.style.width = `${Math.round(score * 100)}%`;
  confidenceBar.style.background =
    label === "Fake Account"
      ? "linear-gradient(90deg, #f59e0b, #ef4444)"
      : "linear-gradient(90deg, #22c55e, #3b82f6)";
}

async function predictManual() {
  hideError();
  showLoader(true);
  resultCard.classList.add("hidden");
  bulkSummaryCard.classList.add("hidden");

  try {
    const payload = {
      ratio_numlen_username: safeNumber(document.getElementById("ratio_numlen_username").value),
      len_fullname: safeNumber(document.getElementById("len_fullname").value),
      ratio_numlen_fullname: safeNumber(document.getElementById("ratio_numlen_fullname").value),
      len_desc: safeNumber(document.getElementById("len_desc").value),
      num_posts: safeNumber(document.getElementById("posts").value),
      num_followers: safeNumber(document.getElementById("followers").value),
      num_following: safeNumber(document.getElementById("following").value),
    };

    const response = await fetch(`${API_BASE}/predict`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || "Prediction failed.");
    }

    updateResultUI(data.result);
  } catch (err) {
    showError(err.message || "Something went wrong.");
  } finally {
    showLoader(false);
  }
}

async function predictFile() {
  hideError();
  showLoader(true);
  resultCard.classList.add("hidden");
  bulkSummaryCard.classList.add("hidden");

  try {
    const fileInput = document.getElementById("fileInput");
    if (!fileInput.files.length) {
      throw new Error("Please select a CSV or JSON file.");
    }

    const formData = new FormData();
    formData.append("file", fileInput.files[0]);

    const response = await fetch(`${API_BASE}/predict-file`, {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || "File upload failed.");
    }

    if (data.summary) {
      bulkSummaryCard.classList.remove("hidden");
      summaryTotal.textContent = data.summary.total ?? 0;
      summaryReal.textContent = data.summary.real ?? 0;
      summaryFake.textContent = data.summary.fake ?? 0;
    }

    if (data.predictions && data.predictions.length > 0) {
      updateResultUI(data.predictions[0]);
    }
  } catch (err) {
    showError(err.message || "Something went wrong.");
  } finally {
    showLoader(false);
  }
}

switchMode("manual");
window.predictManual = predictManual;
window.predictFile = predictFile;