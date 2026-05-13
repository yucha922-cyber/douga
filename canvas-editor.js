// Canvas Video Editor (9:16)
//   - Draws video onto a 9:16 canvas with text overlay
//   - Text uses ctx.strokeText for adjustable thick outlines
//   - Multiple videos can be dropped and play back concatenated
//   - Text array is auto-distributed across the timeline
(() => {
  const $ = (s) => document.querySelector(s);

  const canvas = $("#stage");
  const ctx = canvas.getContext("2d");

  // ---------- State ----------
  /** @type {{file:File, url:string, video:HTMLVideoElement, duration:number, start:number}[]} */
  const media = [];
  /** @type {{text:string, start:number, end:number}[]} */
  let textCues = [];

  const style = {
    fontSize: 96,
    fillColor: "#ffffff",
    strokeColor: "#000000",
    strokeWidth: 12,
    posY: 78,
    fontFamily: '"Hiragino Sans","Yu Gothic","Noto Sans JP",sans-serif',
    bold: true,
  };

  let playing = false;
  let playStartedAt = 0;     // performance.now() when playback started
  let playStartedAtT = 0;    // timeline time at playStartedAt
  let currentTime = 0;
  let activeVideoIdx = -1;
  let rafId = null;

  // ---------- Helpers ----------
  const totalDuration = () => media.reduce((a, m) => a + m.duration, 0);

  function rebuildOffsets() {
    let t = 0;
    for (const m of media) {
      m.start = t;
      t += m.duration;
    }
    $("#seek").max = totalDuration().toFixed(2);
    updateTimeLabel();
  }

  function updateTimeLabel() {
    $("#timeLabel").textContent =
      currentTime.toFixed(1) + " / " + totalDuration().toFixed(1);
  }

  function findClipAt(t) {
    for (let i = 0; i < media.length; i++) {
      const m = media[i];
      if (t >= m.start && t < m.start + m.duration) return i;
    }
    if (media.length && t >= totalDuration() - 0.01)
      return media.length - 1;
    return -1;
  }

  function pauseAllExcept(idx) {
    for (let i = 0; i < media.length; i++) {
      if (i !== idx && !media[i].video.paused) media[i].video.pause();
    }
  }

  // ---------- Media drop ----------
  const drop = $("#drop");
  const fileInput = $("#fileInput");
  drop.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", (e) => addFiles(e.target.files));
  ["dragenter", "dragover"].forEach((ev) =>
    drop.addEventListener(ev, (e) => {
      e.preventDefault();
      drop.classList.add("hover");
    })
  );
  ["dragleave", "drop"].forEach((ev) =>
    drop.addEventListener(ev, (e) => {
      e.preventDefault();
      drop.classList.remove("hover");
    })
  );
  drop.addEventListener("drop", (e) => {
    if (e.dataTransfer?.files) addFiles(e.dataTransfer.files);
  });

  async function addFiles(fileList) {
    const files = Array.from(fileList).filter((f) => f.type.startsWith("video/"));
    for (const file of files) {
      const url = URL.createObjectURL(file);
      const video = document.createElement("video");
      video.src = url;
      video.muted = true;
      video.playsInline = true;
      video.preload = "auto";
      await new Promise((res, rej) => {
        video.onloadedmetadata = res;
        video.onerror = () => rej(new Error("load failed: " + file.name));
      });
      media.push({
        file,
        url,
        video,
        duration: video.duration || 0,
        start: 0,
      });
    }
    rebuildOffsets();
    renderMediaList();
    if (media.length && activeVideoIdx === -1) {
      seekTo(0);
    }
  }

  function renderMediaList() {
    const ul = $("#mediaList");
    ul.innerHTML = "";
    media.forEach((m, i) => {
      const li = document.createElement("li");
      li.innerHTML =
        `<span class="name">${i + 1}. ${m.file.name}</span>` +
        `<span class="dur">${m.duration.toFixed(1)}s</span>` +
        `<button title="削除" data-i="${i}">×</button>`;
      li.querySelector("button").addEventListener("click", () => removeClip(i));
      ul.appendChild(li);
    });
  }

  function removeClip(i) {
    const [m] = media.splice(i, 1);
    URL.revokeObjectURL(m.url);
    m.video.src = "";
    rebuildOffsets();
    renderMediaList();
    seekTo(Math.min(currentTime, totalDuration()));
  }

  // ---------- Text distribution ----------
  $("#applyText").addEventListener("click", () => {
    const lines = $("#textInput").value
      .split("\n").map((s) => s.trim()).filter(Boolean);
    const mode = $("#distributeMode").value;
    const total = totalDuration();
    if (!lines.length) {
      textCues = [];
      renderSchedule();
      return;
    }
    if (mode === "even" && total > 0) {
      const each = total / lines.length;
      textCues = lines.map((text, i) => ({
        text,
        start: i * each,
        end: (i + 1) * each,
      }));
    } else {
      const each = Math.max(0.1, parseFloat($("#perDuration").value) || 3);
      textCues = lines.map((text, i) => ({
        text,
        start: i * each,
        end: (i + 1) * each,
      }));
    }
    renderSchedule();
  });

  function renderSchedule() {
    $("#schedule").innerHTML = textCues
      .map(
        (c, i) =>
          `<div>#${i + 1} [${c.start.toFixed(1)}–${c.end.toFixed(1)}s] ${escapeHTML(c.text)}</div>`
      )
      .join("");
  }

  function escapeHTML(s) {
    return s.replace(/[&<>"]/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])
    );
  }

  function currentText(t) {
    for (const c of textCues) {
      if (t >= c.start && t < c.end) return c.text;
    }
    return "";
  }

  // ---------- Style bindings ----------
  $("#fontSize").addEventListener("input", (e) => (style.fontSize = +e.target.value));
  $("#fillColor").addEventListener("input", (e) => (style.fillColor = e.target.value));
  $("#strokeColor").addEventListener("input", (e) => (style.strokeColor = e.target.value));
  $("#strokeWidth").addEventListener("input", (e) => {
    style.strokeWidth = +e.target.value;
    $("#strokeWidthLabel").textContent = style.strokeWidth + " px";
  });
  $("#posY").addEventListener("input", (e) => (style.posY = +e.target.value));
  $("#fontFamily").addEventListener("change", (e) => (style.fontFamily = e.target.value));
  $("#bold").addEventListener("change", (e) => (style.bold = e.target.checked));

  // ---------- Drawing ----------
  function drawVideoFrame(m) {
    const v = m.video;
    if (!v.videoWidth) return;
    // cover-fit into 9:16 canvas
    const cw = canvas.width, ch = canvas.height;
    const scale = Math.max(cw / v.videoWidth, ch / v.videoHeight);
    const w = v.videoWidth * scale;
    const h = v.videoHeight * scale;
    const x = (cw - w) / 2;
    const y = (ch - h) / 2;
    ctx.drawImage(v, x, y, w, h);
  }

  function drawText(text) {
    if (!text) return;
    const weight = style.bold ? "900" : "500";
    ctx.font = `${weight} ${style.fontSize}px ${style.fontFamily}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.miterLimit = 2;

    const x = canvas.width / 2;
    const y = (canvas.height * style.posY) / 100;

    // Word-wrap for long lines (simple)
    const maxWidth = canvas.width * 0.9;
    const lines = wrapText(ctx, text, maxWidth);
    const lh = style.fontSize * 1.2;
    const offsetY = -(lines.length - 1) * lh / 2;

    // Stroke first (thick outline), then fill
    if (style.strokeWidth > 0) {
      ctx.strokeStyle = style.strokeColor;
      ctx.lineWidth = style.strokeWidth * 2; // doubled because half is clipped by fill
      lines.forEach((ln, i) => ctx.strokeText(ln, x, y + offsetY + i * lh));
    }
    ctx.fillStyle = style.fillColor;
    lines.forEach((ln, i) => ctx.fillText(ln, x, y + offsetY + i * lh));
  }

  function wrapText(ctx, text, maxWidth) {
    // Wrap per character (works for CJK + latin)
    const out = [];
    let line = "";
    for (const ch of text) {
      if (ch === "\n") { out.push(line); line = ""; continue; }
      const test = line + ch;
      if (ctx.measureText(test).width > maxWidth && line) {
        out.push(line);
        line = ch;
      } else {
        line = test;
      }
    }
    if (line) out.push(line);
    return out;
  }

  function render() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (activeVideoIdx >= 0) drawVideoFrame(media[activeVideoIdx]);
    drawText(currentText(currentTime));
  }

  // ---------- Playback ----------
  function tick() {
    if (!playing) return;
    const now = performance.now();
    currentTime = playStartedAtT + (now - playStartedAt) / 1000;
    const total = totalDuration();
    if (currentTime >= total) {
      currentTime = total;
      stop();
      render();
      return;
    }
    syncActiveVideo();
    $("#seek").value = currentTime;
    updateTimeLabel();
    render();
    rafId = requestAnimationFrame(tick);
  }

  function syncActiveVideo() {
    const idx = findClipAt(currentTime);
    if (idx === -1) return;
    if (idx !== activeVideoIdx) {
      activeVideoIdx = idx;
      pauseAllExcept(idx);
    }
    const m = media[idx];
    const local = currentTime - m.start;
    // Resync if drift is large
    if (Math.abs(m.video.currentTime - local) > 0.15) {
      m.video.currentTime = Math.min(local, m.duration - 0.01);
    }
    if (playing && m.video.paused) m.video.play().catch(() => {});
  }

  function play() {
    if (!media.length) return;
    if (currentTime >= totalDuration()) currentTime = 0;
    playing = true;
    playStartedAt = performance.now();
    playStartedAtT = currentTime;
    syncActiveVideo();
    $("#playBtn").textContent = "❚❚";
    rafId = requestAnimationFrame(tick);
  }

  function stop() {
    playing = false;
    if (rafId) cancelAnimationFrame(rafId);
    pauseAllExcept(-1);
    $("#playBtn").textContent = "▶";
  }

  function seekTo(t) {
    currentTime = Math.max(0, Math.min(t, totalDuration()));
    const idx = findClipAt(currentTime);
    if (idx !== -1) {
      activeVideoIdx = idx;
      pauseAllExcept(idx);
      const m = media[idx];
      m.video.currentTime = Math.min(currentTime - m.start, m.duration - 0.01);
    }
    if (playing) {
      playStartedAt = performance.now();
      playStartedAtT = currentTime;
    }
    $("#seek").value = currentTime;
    updateTimeLabel();
    // Wait for seeked event before painting, else use loadeddata
    if (idx !== -1) {
      const m = media[idx];
      const paint = () => render();
      if (m.video.readyState >= 2) paint();
      else m.video.addEventListener("loadeddata", paint, { once: true });
    } else {
      render();
    }
  }

  $("#playBtn").addEventListener("click", () => (playing ? stop() : play()));
  $("#seek").addEventListener("input", (e) => seekTo(+e.target.value));

  // Initial paint
  render();
})();
