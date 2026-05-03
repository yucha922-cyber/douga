// AdCut Studio — demo interactivity
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // --- Side panel tabs ---
  $$(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      $$(".tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      const target = tab.dataset.tab;
      $$(".side-panel").forEach((p) => {
        p.classList.toggle("hidden", p.dataset.panel !== target);
      });
    });
  });

  // --- Drag assets onto timeline lanes ---
  let dragLabel = null;
  $$(".asset").forEach((a) => {
    a.addEventListener("dragstart", (e) => {
      dragLabel = a.dataset.label || a.textContent.trim();
      e.dataTransfer.setData("text/plain", dragLabel);
      e.dataTransfer.effectAllowed = "copy";
    });
  });

  $$(".lane").forEach((lane) => {
    lane.addEventListener("dragover", (e) => {
      e.preventDefault();
      lane.classList.add("drag-over");
    });
    lane.addEventListener("dragleave", () => lane.classList.remove("drag-over"));
    lane.addEventListener("drop", (e) => {
      e.preventDefault();
      lane.classList.remove("drag-over");
      const label = e.dataTransfer.getData("text/plain") || dragLabel;
      if (!label) return;
      const rect = lane.getBoundingClientRect();
      const leftPct = Math.max(0, Math.min(85, ((e.clientX - rect.left) / rect.width) * 100));
      const clip = document.createElement("div");
      const laneType = lane.dataset.lane;
      clip.className = `clip clip-${laneType}`;
      clip.style.left = leftPct.toFixed(1) + "%";
      clip.style.width = "15%";
      clip.textContent = label;
      lane.appendChild(clip);
      toast(`「${label}」を ${laneLabel(laneType)} トラックに追加しました`);

      // If a text clip dropped, update preview text
      if (laneType === "t") {
        $("#frameText").textContent = label;
      }
    });
  });

  function laneLabel(t) {
    return t === "v" ? "映像" : t === "a" ? "音声" : "テロップ";
  }

  // --- Player ---
  const playBtn = $("#playBtn");
  const playhead = $("#playhead");
  const seekFill = $("#seekFill");
  const curTime = $("#curTime");
  const totalSec = 15;
  let playing = false;
  let elapsed = 0;
  let lastTs = 0;
  let raf = null;

  function fmt(s) {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const r = Math.floor(s % 60).toString().padStart(2, "0");
    return `${m}:${r}`;
  }

  function tick(ts) {
    if (!playing) return;
    if (!lastTs) lastTs = ts;
    const dt = (ts - lastTs) / 1000;
    lastTs = ts;
    elapsed += dt;
    if (elapsed >= totalSec) {
      elapsed = 0;
      playing = false;
      playBtn.textContent = "▶";
      lastTs = 0;
    }
    render();
    if (playing) raf = requestAnimationFrame(tick);
  }

  function render() {
    const pct = (elapsed / totalSec) * 100;
    const timeline = $("#timeline");
    const tlRect = timeline.getBoundingClientRect();
    const padding = 12; // matches CSS
    const usable = tlRect.width - padding * 2;
    playhead.style.left = padding + (usable * pct) / 100 + "px";
    seekFill.style.width = pct + "%";
    curTime.textContent = fmt(elapsed);
  }

  playBtn.addEventListener("click", () => {
    playing = !playing;
    playBtn.textContent = playing ? "❚❚" : "▶";
    if (playing) {
      lastTs = 0;
      raf = requestAnimationFrame(tick);
    } else if (raf) {
      cancelAnimationFrame(raf);
    }
  });

  // --- Seek by clicking timeline ---
  $("#timeline").addEventListener("click", (e) => {
    if (e.target.closest(".clip") || e.target.closest(".lane")) return;
    const tl = $("#timeline").getBoundingClientRect();
    const pct = ((e.clientX - tl.left - 12) / (tl.width - 24)) * 100;
    elapsed = Math.max(0, Math.min(totalSec, (pct / 100) * totalSec));
    render();
  });

  // --- Aspect ratio switch ---
  $$(".ratio .r").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$(".ratio .r").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const r = btn.dataset.ratio;
      const frame = $("#previewFrame");
      frame.classList.remove("r-1-1", "r-9-16");
      if (r === "1:1") frame.classList.add("r-1-1");
      if (r === "9:16") frame.classList.add("r-9-16");
      toast(`プレビューを ${r} に切り替えました`);
    });
  });

  // --- Export buttons ---
  $("#exportMp4").addEventListener("click", () => {
    toast("MP4 を書き出しています… (デモ)");
  });
  $("#exportPpro").addEventListener("click", () => {
    toast("Premiere Pro 用 .prproj を生成しました (デモ)");
  });
  $("#exportAe").addEventListener("click", () => {
    toast("After Effects 用 .aep を生成しました (デモ)");
  });

  // --- Toast ---
  let toastTimer = null;
  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
  }

  // Initial render
  render();
})();
