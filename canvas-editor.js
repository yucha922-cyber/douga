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
  /** @type {{text:string, start:number, end:number, animationType:string}[]} */
  let textCues = [];

  const ANIM_DURATION = 0.3; // seconds for enter/exit animation

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
    const defaultAnim = $("#animationType").value;
    const parsed = $("#textInput").value
      .split("\n").map((s) => s.trim()).filter(Boolean)
      .map((line) => parseLine(line, defaultAnim));
    const mode = $("#distributeMode").value;
    const total = totalDuration();
    if (!parsed.length) {
      textCues = [];
      renderSchedule();
      return;
    }
    const each =
      mode === "even" && total > 0
        ? total / parsed.length
        : Math.max(0.1, parseFloat($("#perDuration").value) || 3);
    textCues = parsed.map(({ text, animationType }, i) => ({
      text,
      animationType,
      start: i * each,
      end: (i + 1) * each,
    }));
    renderSchedule();
  });

  function parseLine(line, fallback) {
    const m = /^(pop|slide|fade|none):\s*(.+)$/i.exec(line);
    if (m) return { animationType: m[1].toLowerCase(), text: m[2] };
    return { animationType: fallback, text: line };
  }

  function renderSchedule() {
    $("#schedule").innerHTML = textCues
      .map(
        (c, i) =>
          `<div>#${i + 1} [${c.start.toFixed(1)}–${c.end.toFixed(1)}s] (${c.animationType}) ${escapeHTML(c.text)}</div>`
      )
      .join("");
  }

  function escapeHTML(s) {
    return s.replace(/[&<>"]/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])
    );
  }

  function currentCue(t) {
    for (const c of textCues) {
      if (t >= c.start && t < c.end) return c;
    }
    return null;
  }

  // ---------- Animation engine (driven by currentTime) ----------
  const easeOutQuad   = (t) => 1 - (1 - t) * (1 - t);
  const easeInOutQuad = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const easeOutCubic  = (t) => 1 - Math.pow(1 - t, 3);
  const easeInCubic   = (t) => t * t * t;
  const lerp = (a, b, t) => a + (b - a) * t;

  function getAnimState(cue, t) {
    const localT = t - cue.start;
    const dur = cue.end - cue.start;
    let scale = 1, opacity = 1, dx = 0, dy = 0;

    // ---- Enter phase ----
    if (localT < ANIM_DURATION) {
      const p = Math.max(0, localT / ANIM_DURATION); // 0..1
      if (cue.animationType === "pop") {
        // 0..0.5 : 0   -> 1.2  (overshoot, easeOutQuad)
        // 0.5..1 : 1.2 -> 1.0  (settle,    easeInOutQuad)
        if (p < 0.5) {
          scale = lerp(0, 1.2, easeOutQuad(p * 2));
        } else {
          scale = lerp(1.2, 1.0, easeInOutQuad((p - 0.5) * 2));
        }
      } else if (cue.animationType === "slide") {
        const e = easeOutCubic(p);
        dy = (1 - e) * canvas.height * 0.08;
        opacity = e;
      } else if (cue.animationType === "fade") {
        opacity = easeOutQuad(p);
      }
    }
    // ---- Exit phase ----
    else if (localT > dur - ANIM_DURATION) {
      const p = Math.max(0, (dur - localT) / ANIM_DURATION); // 1..0
      if (cue.animationType === "slide") {
        const e = easeInCubic(1 - p);
        dy = -e * canvas.height * 0.08;
        opacity = p;
      } else if (cue.animationType === "fade") {
        opacity = p;
      } else if (cue.animationType === "pop") {
        opacity = p;
        scale = lerp(0.9, 1.0, p);
      }
    }

    return { scale, opacity, dx, dy };
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

  function drawText(cue, t) {
    if (!cue || !cue.text) return;
    const { scale, opacity, dx, dy } = getAnimState(cue, t);
    if (opacity <= 0 || scale <= 0) return;

    const weight = style.bold ? "900" : "500";
    ctx.font = `${weight} ${style.fontSize}px ${style.fontFamily}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.miterLimit = 2;

    const cx = canvas.width / 2;
    const cy = (canvas.height * style.posY) / 100;

    const maxWidth = (canvas.width * 0.9) / scale;
    const lines = wrapText(ctx, cue.text, maxWidth);
    const lh = style.fontSize * 1.2;
    const offsetY = -(lines.length - 1) * lh / 2;

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.translate(cx + dx, cy + dy);
    ctx.scale(scale, scale);

    if (style.strokeWidth > 0) {
      ctx.strokeStyle = style.strokeColor;
      ctx.lineWidth = style.strokeWidth * 2;
      lines.forEach((ln, i) => ctx.strokeText(ln, 0, offsetY + i * lh));
    }
    ctx.fillStyle = style.fillColor;
    lines.forEach((ln, i) => ctx.fillText(ln, 0, offsetY + i * lh));

    ctx.restore();
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
    drawText(currentCue(currentTime), currentTime);
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

  // ---------- Export (MediaRecorder, synced with preview) ----------
  // Strategy: record canvas.captureStream() in realtime while the same RAF loop
  // drives both preview and recording. Since drawing is deterministic from
  // `currentTime`, every frame on screen is the frame that gets recorded.
  let recorder = null;
  let sharedAudioCtx = null;
  const exportBtn = $("#exportBtn");
  const exportStatus = $("#exportStatus");

  exportBtn.addEventListener("click", async () => {
    if (recorder && recorder.state === "recording") {
      recorder.stop();
      return;
    }
    if (!media.length) {
      exportStatus.textContent = "メディアがありません";
      return;
    }

    const fps = Math.max(10, Math.min(60, +$("#exportFps").value || 30));
    const stream = canvas.captureStream(fps);

    if ($("#exportAudio").checked) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        sharedAudioCtx = sharedAudioCtx || new AC();
        const dest = sharedAudioCtx.createMediaStreamDestination();
        for (const m of media) {
          m.video.muted = false;
          // createMediaElementSource can only be called once per element — cache it
          if (!m._audioSrc) {
            m._audioSrc = sharedAudioCtx.createMediaElementSource(m.video);
            m._audioSrc.connect(sharedAudioCtx.destination);
          }
          m._audioSrc.connect(dest);
        }
        dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
      } catch (e) {
        console.warn("audio capture failed", e);
      }
    }

    const mime = pickMimeType();
    const chunks = [];
    recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: chunks[0]?.type || "video/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `canvas-edit-${Date.now()}.webm`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      exportBtn.textContent = "録画開始 (WebM)";
      exportBtn.disabled = false;
      exportStatus.textContent = "完了 ✓";
      recorder = null;
    };

    exportBtn.textContent = "■ 停止";
    exportStatus.textContent = "録画中…";

    // Drive playback deterministically from the same RAF loop as preview.
    seekTo(0);
    // Wait one frame so the seeked frame is painted before the recorder starts.
    await new Promise((r) => requestAnimationFrame(r));
    recorder.start(100);
    play();

    // Auto-stop at end of timeline
    const total = totalDuration();
    const stopAtEnd = () => {
      if (!recorder || recorder.state !== "recording") return;
      if (currentTime >= total - 1 / fps) {
        recorder.stop();
      } else {
        requestAnimationFrame(stopAtEnd);
      }
    };
    requestAnimationFrame(stopAtEnd);
  });

  function pickMimeType() {
    const candidates = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
      "video/mp4",
    ];
    return candidates.find((m) => MediaRecorder.isTypeSupported?.(m)) || "";
  }

  // Initial paint
  render();
})();
