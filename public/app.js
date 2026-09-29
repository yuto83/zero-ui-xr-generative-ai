const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const startButton = document.getElementById("startButton");
const statusEl = document.getElementById("status");
const intervalSelect = document.getElementById("interval");

const sceneEl = document.getElementById("scene");
const objectEl = document.getElementById("object");
const actionEl = document.getElementById("action");
const intentEl = document.getElementById("intent");
const confidenceEl = document.getElementById("confidence");
const evidenceEl = document.getElementById("evidence");

const overlay = document.getElementById("overlay");
const uiTitle = document.getElementById("uiTitle");
const uiBody = document.getElementById("uiBody");

let stream = null;
let timer = null;
let busy = false;
let previous = null;

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
}

async function analyzeFrame() {
  if (!stream || busy || video.readyState < 2) return;

  busy = true;
  statusEl.textContent = "生成AIが状況を理解中…";

  try {
    const maxWidth = 768;
    const scale = Math.min(1, maxWidth / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);

    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // JPEG quality is intentionally moderate to reduce request size.
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
    statusEl.textContent = "生成AIによる状況理解 完了";
  } catch (e) {
    console.error(e);
    statusEl.textContent = "AI解析エラー: " + e.message;
  } finally {
    busy = false;
  }
}

function render(data) {
  sceneEl.textContent = data.scene || "--";
  objectEl.textContent = data.object || "--";
  actionEl.textContent = data.action || "--";
  intentEl.textContent = data.intent || "--";
  confidenceEl.textContent =
    `confidence ${(Number(data.confidence || 0) * 100).toFixed(0)}%`;

  evidenceEl.innerHTML = "";
  for (const item of (data.evidence || [])) {
    const li = document.createElement("li");
    li.textContent = item;
    evidenceEl.appendChild(li);
  }

  if (data.suggested_ui?.show) {
    overlay.classList.remove("hidden");
    uiTitle.textContent = data.suggested_ui.title || "";
    uiBody.textContent = data.suggested_ui.body || "";
  } else {
    overlay.classList.add("hidden");
  }
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
