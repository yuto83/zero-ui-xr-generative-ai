const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const startButton = document.getElementById("startButton");
const statusEl = document.getElementById("status");
const intervalSelect = document.getElementById("interval");

const productEl = document.getElementById("product");
const attentionEl = document.getElementById("attention");
const sceneEl = document.getElementById("scene");
const actionEl = document.getElementById("action");
const intentEl = document.getElementById("intent");
const uiStateEl = document.getElementById("uiState");
const confidenceEl = document.getElementById("confidence");
const evidenceEl = document.getElementById("evidence");

const overlay = document.getElementById("overlay");
const uiTitle = document.getElementById("uiTitle");
const uiSubtitle = document.getElementById("uiSubtitle");
const nutritionBasis = document.getElementById("nutritionBasis");
const nutritionEl = document.getElementById("nutrition");
const recipesEl = document.getElementById("recipes");
const uiTip = document.getElementById("uiTip");
const focusMarker = document.getElementById("focusMarker");

let stream = null;
let timer = null;
let busy = false;
let previous = null;
let lastProductId = "";
let sameProductCount = 0;

async function startCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    });

    video.srcObject = stream;
    await video.play();

    statusEl.textContent = "カメラ接続済み / AI解析待機中";
    startButton.textContent = "AI解析を停止";

    if (timer) clearInterval(timer);
    timer = setInterval(analyzeFrame, Number(intervalSelect.value));
    analyzeFrame();
  } catch (e) {
    console.error(e);
    statusEl.textContent = "カメラを起動できませんでした";
  }
}

function stopCamera() {
  if (timer) clearInterval(timer);
  timer = null;

  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }

  video.srcObject = null;
  startButton.textContent = "カメラを開始";
  statusEl.textContent = "停止中";
  hideOverlay();
}

async function analyzeFrame() {
  if (!stream || busy || video.readyState < 2) return;

  busy = true;
  statusEl.textContent = "生成AIが商品への注目を推定中…";

  try {
    const maxWidth = 768;
    const scale = Math.min(1, maxWidth / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);

    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const image = canvas.toDataURL("image/jpeg", 0.68);

    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image, previous })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "analysis failed");

    render(data);
    previous = data;
    statusEl.textContent = data.show_ui
      ? "商品への注目を検知 / Zero UIを表示"
      : "生成AIによる状況理解 完了";
  } catch (e) {
    console.error(e);
    statusEl.textContent = "AI解析エラー: " + e.message;
  } finally {
    busy = false;
  }
}

function render(data) {
  const productName = data.product_name || "対象商品なし";
  const attentionScore = Number(data.attention_score || 0);

  productEl.textContent = productName;
  attentionEl.textContent = `${(attentionScore * 100).toFixed(0)}%`;
  sceneEl.textContent = data.scene || "--";
  actionEl.textContent = data.action || "--";
  intentEl.textContent = data.intent || "--";
  uiStateEl.textContent = data.show_ui ? "商品情報を表示" : "待機";
  confidenceEl.textContent = `confidence ${(Number(data.confidence || 0) * 100).toFixed(0)}%`;

  evidenceEl.innerHTML = "";
  for (const item of (data.evidence || [])) {
    const li = document.createElement("li");
    li.textContent = item;
    evidenceEl.appendChild(li);
  }

  updateFocusStability(data);

  if (data.show_ui && sameProductCount >= 2) {
    showOverlay(data.suggested_ui);
  } else {
    hideOverlay();
  }
}

function updateFocusStability(data) {
  const productId = data.product_id || "unknown";

  if (data.attention && productId !== "unknown") {
    if (productId === lastProductId) sameProductCount += 1;
    else sameProductCount = 1;
    lastProductId = productId;
  } else {
    sameProductCount = 0;
    lastProductId = "";
  }

  if (data.attention && sameProductCount >= 1) focusMarker.classList.remove("hidden");
  else focusMarker.classList.add("hidden");
}

function showOverlay(ui) {
  if (!ui || !ui.show) return;

  overlay.classList.remove("hidden");
  uiTitle.textContent = ui.title || "";
  uiSubtitle.textContent = ui.subtitle || "";
  nutritionBasis.textContent = ui.nutritionBasis ? `（${ui.nutritionBasis}）` : "";

  nutritionEl.innerHTML = "";
  for (const [label, value] of (ui.nutrition || [])) {
    const item = document.createElement("div");
    item.className = "nutrition-item";
    item.innerHTML = `<span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong>`;
    nutritionEl.appendChild(item);
  }

  recipesEl.innerHTML = "";
  for (const recipe of (ui.recipes || [])) {
    const chip = document.createElement("span");
    chip.textContent = recipe;
    recipesEl.appendChild(chip);
  }

  uiTip.textContent = ui.tip || "";
}

function hideOverlay() {
  overlay.classList.add("hidden");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

startButton.addEventListener("click", () => {
  if (stream) stopCamera();
  else startCamera();
});

intervalSelect.addEventListener("change", () => {
  if (!stream) return;
  if (timer) clearInterval(timer);
  timer = setInterval(analyzeFrame, Number(intervalSelect.value));
});
