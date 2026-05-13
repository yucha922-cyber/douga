// AI Canvas Video Editor (9:16)
//   - Free-form text placement: drag / resize / rotate handles on canvas
//   - AI scene selection: samples frames and picks the sharpest (highest
//     Laplacian variance) timestamp as the initial preview position
//   - Auto captioning: Web Speech API for live transcription + paste-based
//     fallback that splits a script proportionally across the timeline
(() => {
  const $ = (s) => document.querySelector(s);

  const canvas = $("#stage");
  const ctx = canvas.getContext("2d");

  // ---------- State ----------
  /** @type {{file:File, url:string, video:HTMLVideoElement, duration:number, start:number, bestSceneTime?:number}[]} */
  const media = [];
  /** @type {{text:string, start:number, end:number, animationType:string,
   *          fillColor?:string|null, x:number, y:number, scale:number,
   *          rotation:number, userMoved:boolean}[]} */
  let textCues = [];

  let selectedCueIndex = -1;

  const ANIM_DURATION = 0.3;

  const banners = { top: "", bottom: "", bg: "#fb2c36", fg: "#ffffff" };

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
  let playStartedAt = 0;
  let playStartedAtT = 0;
  let currentTime = 0;
  let activeVideoIdx = -1;
  let rafId = null;

  // ---------- Helpers ----------
  const totalDuration = () => media.reduce((a, m) => a + m.duration, 0);

  function defaultX() { return canvas.width / 2; }
  function defaultY() { return (canvas.height * style.posY) / 100; }

  function makeCue(text, start, end, animationType, fillColor = null) {
    return {
      text, start, end, animationType, fillColor,
      x: defaultX(), y: defaultY(),
      scale: 1, rotation: 0, userMoved: false,
    };
  }

  function rebuildOffsets() {
    let t = 0;
    for (const m of media) { m.start = t; t += m.duration; }
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
    if (media.length && t >= totalDuration() - 0.01) return media.length - 1;
    return -1;
  }

  function pauseAllExcept(idx) {
    for (let i = 0; i < media.length; i++) {
      if (i !== idx && !media[i].video.paused) media[i].video.pause();
    }
  }

  function escapeHTML(s) {
    return s.replace(/[&<>"]/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  // ---------- Media drop + AI scene analysis ----------
  const drop = $("#drop");
  const fileInput = $("#fileInput");
  drop.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", (e) => addFiles(e.target.files));
  ["dragenter", "dragover"].forEach((ev) =>
    drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("hover"); }));
  ["dragleave", "drop"].forEach((ev) =>
    drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("hover"); }));
  drop.addEventListener("drop", (e) => {
    if (e.dataTransfer?.files) addFiles(e.dataTransfer.files);
  });

  async function addFiles(fileList) {
    const files = Array.from(fileList).filter((f) => f.type.startsWith("video/"));
    const newClips = [];
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
      const clip = { file, url, video, duration: video.duration || 0, start: 0 };
      media.push(clip);
      newClips.push(clip);
    }
    rebuildOffsets();
    renderMediaList();

    if (media.length && activeVideoIdx === -1) {
      seekTo(0);
    }

    // Kick off best-scene analysis for new clips
    for (const clip of newClips) {
      analyzeAndJumpToBestScene(clip).catch((err) => console.warn("scene analysis failed", err));
    }
  }

  function renderMediaList() {
    const ul = $("#mediaList");
    ul.innerHTML = "";
    media.forEach((m, i) => {
      const best = (typeof m.bestSceneTime === "number")
        ? ` <span style="color:#22d3ee">★${m.bestSceneTime.toFixed(1)}s</span>` : "";
      const li = document.createElement("li");
      li.innerHTML =
        `<span class="name">${i + 1}. ${escapeHTML(m.file.name)}${best}</span>` +
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

  // ----- Scene analysis (Laplacian variance) -----
  function seekVideoTo(video, t) {
    return new Promise((resolve) => {
      const onSeek = () => { video.removeEventListener("seeked", onSeek); resolve(); };
      video.addEventListener("seeked", onSeek);
      try { video.currentTime = Math.min(t, video.duration - 0.01); }
      catch { resolve(); }
    });
  }

  function laplacianVariance(data, w, h) {
    const N = w * h;
    const luma = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const p = i * 4;
      luma[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
    }
    let sum = 0, sum2 = 0, count = 0;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        const lap = -4 * luma[i] + luma[i - 1] + luma[i + 1] + luma[i - w] + luma[i + w];
        sum += lap; sum2 += lap * lap; count++;
      }
    }
    if (!count) return 0;
    const mean = sum / count;
    return sum2 / count - mean * mean;
  }

  async function analyzeBestScene(video, samples) {
    const dur = video.duration;
    if (!isFinite(dur) || dur <= 0) return null;
    const margin = Math.min(0.5, dur * 0.05);
    const startT = margin;
    const endT = Math.max(dur - margin, startT + 0.1);
    const N = Math.max(3, Math.min(60, samples | 0));
    const step = (endT - startT) / Math.max(1, N - 1);

    const off = document.createElement("canvas");
    off.width = 90; off.height = 160; // 9:16, small for speed
    const octx = off.getContext("2d", { willReadFrequently: true });

    // Pause and remember state
    const wasPaused = video.paused;
    const origTime = video.currentTime;
    const wasMuted = video.muted;
    video.muted = true;
    if (!wasPaused) video.pause();

    let bestT = (startT + endT) / 2, bestScore = -1;
    const scores = [];

    for (let i = 0; i < N; i++) {
      const t = startT + step * i;
      await seekVideoTo(video, t);
      try {
        octx.drawImage(video, 0, 0, off.width, off.height);
        const data = octx.getImageData(0, 0, off.width, off.height).data;
        const s = laplacianVariance(data, off.width, off.height);
        scores.push({ t, s });
        if (s > bestScore) { bestScore = s; bestT = t; }
      } catch (e) {
        scores.push({ t, s: 0 });
      }
      $("#sceneStatus").textContent =
        `解析中… ${i + 1}/${N}  (現在のベスト: ${bestT.toFixed(1)}s, 鮮明度=${bestScore.toFixed(1)})`;
    }

    // Restore
    await seekVideoTo(video, origTime);
    video.muted = wasMuted;

    return { time: bestT, score: bestScore, samples: scores };
  }

  async function analyzeAndJumpToBestScene(clip) {
    const samples = +$("#sceneSamples").value || 20;
    $("#sceneStatus").textContent = `「${clip.file.name}」のベストシーンを解析中…`;
    const res = await analyzeBestScene(clip.video, samples);
    if (!res) {
      $("#sceneStatus").textContent = "解析に失敗しました";
      return;
    }
    clip.bestSceneTime = res.time;
    renderMediaList();
    const globalT = clip.start + res.time;
    $("#sceneStatus").textContent =
      `✓ ベストシーン: ${res.time.toFixed(2)}s (鮮明度=${res.score.toFixed(1)}) → プレビュー初期位置に設定`;
    // Only auto-jump if user hasn't interacted yet
    if (!playing && currentTime < 0.05) {
      seekTo(globalT);
    }
  }

  $("#rescanSceneBtn").addEventListener("click", async () => {
    if (!media.length) { $("#sceneStatus").textContent = "メディアがありません"; return; }
    const clip = media[Math.max(0, findClipAt(currentTime))];
    await analyzeAndJumpToBestScene(clip);
  });

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
      selectedCueIndex = -1;
      renderSchedule();
      refreshSelBox();
      render();
      return;
    }
    const each = mode === "even" && total > 0
      ? total / parsed.length
      : Math.max(0.1, parseFloat($("#perDuration").value) || 3);

    textCues = parsed.map(({ text, animationType }, i) =>
      makeCue(text, i * each, (i + 1) * each, animationType));
    selectedCueIndex = -1;
    renderSchedule();
    refreshSelBox();
    render();
  });

  $("#resetLayoutBtn").addEventListener("click", () => {
    for (const c of textCues) {
      c.x = defaultX(); c.y = defaultY();
      c.scale = 1; c.rotation = 0; c.userMoved = false;
    }
    refreshSelBox();
    render();
  });

  function parseLine(line, fallback) {
    const m = /^(pop|slide|fade|none):\s*(.+)$/i.exec(line);
    if (m) return { animationType: m[1].toLowerCase(), text: m[2] };
    return { animationType: fallback, text: line };
  }

  // ---------- Auto ad mode ----------
  function chunkText(input, chunkLen) {
    const norm = input.replace(/\s+/g, " ").trim();
    if (!norm) return [];
    const out = [];
    let buf = "";
    const flush = () => { if (buf.trim()) out.push(buf.trim()); buf = ""; };
    const isHard = (c) => /[。、！？!?,.]/.test(c);
    for (const ch of norm) {
      buf += ch;
      const overTarget = buf.length >= chunkLen;
      const wayOver = buf.length >= Math.round(chunkLen * 1.4);
      if ((overTarget && isHard(ch)) || wayOver) { flush(); continue; }
      if (overTarget && ch === " ") { flush(); }
    }
    flush();
    if (out.length >= 2 && out[out.length - 1].length < Math.max(3, chunkLen / 3)) {
      out[out.length - 2] += " " + out.pop();
    }
    return out;
  }

  const COLOR_PRESETS = {
    "alt-yellow-white": ["#facc15", "#ffffff"],
    "alt-pink-white": ["#f472b6", "#ffffff"],
  };
  function pickColor(scheme, i) {
    if (scheme === "random") {
      const palette = ["#facc15", "#f472b6", "#22d3ee", "#a3e635", "#fb923c", "#ffffff"];
      return palette[(Math.random() * palette.length) | 0];
    }
    if (scheme === "single") return null;
    const pair = COLOR_PRESETS[scheme] || COLOR_PRESETS["alt-yellow-white"];
    return pair[i % pair.length];
  }

  $("#autoGenBtn").addEventListener("click", () => {
    const input = $("#adInput").value;
    const chunkLen = Math.max(3, +$("#adChunkLen").value || 15);
    const scheme = $("#adColorScheme").value;
    const chunks = chunkText(input, chunkLen);
    if (!chunks.length) { $("#schedule").innerHTML = "<div>入力がありません</div>"; return; }

    const total = totalDuration();
    const each = total > 0 ? total / chunks.length
                           : Math.max(0.1, parseFloat($("#perDuration").value) || 3);
    const defaultAnim = $("#animationType").value;

    textCues = chunks.map((text, i) => {
      const c = makeCue(text, i * each, (i + 1) * each, defaultAnim, pickColor(scheme, i));
      return c;
    });

    banners.top    = $("#bannerTop").value.trim();
    banners.bottom = $("#bannerBottom").value.trim();
    banners.bg     = $("#bannerBg").value;
    banners.fg     = $("#bannerFg").value;

    $("#textInput").value = chunks.join("\n");
    selectedCueIndex = -1;
    renderSchedule();
    refreshSelBox();
    render();
  });

  $("#autoExportBtn").addEventListener("click", () => $("#exportBtn").click());

  // ---------- AI subtitles ----------
  // Live: Web Speech API (microphone-based, since browsers cannot tap
  //       video element audio directly with the Speech API)
  // Fallback: paste a script, auto-split by punctuation and distribute
  //          proportionally over the timeline
  let recognition = null;
  let recognitionActive = false;
  let lastSpeechAnchor = 0;

  function setSRStatus(msg) { $("#srStatus").textContent = msg; }

  $("#srToggleBtn").addEventListener("click", () => {
    if (recognitionActive && recognition) { recognition.stop(); return; }
    const Cls = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Cls) { setSRStatus("⚠️ このブラウザは Web Speech API 未対応です（Chrome系で利用可）"); return; }
    recognition = new Cls();
    recognition.lang = $("#srLang").value;
    recognition.continuous = true;
    recognition.interimResults = true;
    lastSpeechAnchor = currentTime;

    recognition.onstart = () => {
      recognitionActive = true;
      $("#srToggleBtn").textContent = "■ 停止";
      setSRStatus("🎙 待機中… マイクに話しかけてください");
    };
    recognition.onspeechstart = () => { lastSpeechAnchor = currentTime; };
    recognition.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const text = res[0].transcript.trim();
        if (!text) continue;
        if (res.isFinal) {
          const s = lastSpeechAnchor;
          const en = Math.max(s + Math.max(0.6, text.length * 0.12), currentTime);
          addLiveCue(text, s, en);
          lastSpeechAnchor = en;
        } else {
          interim = text;
        }
      }
      if (interim) setSRStatus("認識中: " + interim);
    };
    recognition.onerror = (e) => setSRStatus("エラー: " + e.error);
    recognition.onend = () => {
      recognitionActive = false;
      $("#srToggleBtn").textContent = "● 音声認識開始";
      setSRStatus("停止");
    };
    try { recognition.start(); } catch (e) { setSRStatus("開始失敗: " + e.message); }
  });

  function addLiveCue(text, start, end) {
    textCues.push(makeCue(text, start, end, $("#animationType").value));
    textCues.sort((a, b) => a.start - b.start);
    $("#textInput").value = textCues.map((c) => c.text).join("\n");
    renderSchedule();
    render();
  }

  // Paste-based auto split
  $("#captionSplitBtn").addEventListener("click", () => {
    const raw = $("#captionPaste").value.trim();
    if (!raw) return;
    const cps = Math.max(0.05, +$("#captionCps").value || 0.12);
    const total = totalDuration();

    // 1) split into sentences using punctuation / newlines
    const sentences = raw
      .split(/(?<=[。！？!?\.])\s*|\n+/u)
      .map((s) => s.trim())
      .filter(Boolean);

    // 2) further break long sentences into ~18-char chunks
    const out = [];
    for (const s of sentences) {
      if (s.length > 24) out.push(...chunkText(s, 18));
      else out.push(s);
    }
    if (!out.length) return;

    // 3) weight by character length, normalize to total duration
    const weights = out.map((c) => Math.max(0.8, c.length * cps));
    const sumW = weights.reduce((a, b) => a + b, 0);
    const scaleW = total > 0 ? total / sumW : 1;

    textCues = [];
    let t = 0;
    for (let i = 0; i < out.length; i++) {
      const dur = weights[i] * scaleW;
      textCues.push(makeCue(out[i], t, t + dur, $("#animationType").value));
      t += dur;
    }
    $("#textInput").value = out.join("\n");
    selectedCueIndex = -1;
    renderSchedule();
    refreshSelBox();
    render();
  });

  // ---------- Schedule list ----------
  function renderSchedule() {
    const div = $("#schedule");
    div.innerHTML = "";
    textCues.forEach((c, i) => {
      const el = document.createElement("div");
      el.textContent =
        `#${i + 1} [${c.start.toFixed(1)}–${c.end.toFixed(1)}s] (${c.animationType}) ${c.text}`;
      if (selectedCueIndex === i) el.classList.add("active");
      el.addEventListener("click", () => {
        selectedCueIndex = i;
        seekTo(c.start + 0.01);
        refreshSelBox();
        renderSchedule();
      });
      div.appendChild(el);
    });
  }

  function currentCue(t) {
    for (const c of textCues) {
      if (t >= c.start && t < c.end) return c;
    }
    return null;
  }

  // ---------- Animation ----------
  const easeOutQuad   = (t) => 1 - (1 - t) * (1 - t);
  const easeInOutQuad = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const easeOutCubic  = (t) => 1 - Math.pow(1 - t, 3);
  const easeInCubic   = (t) => t * t * t;
  const lerp = (a, b, t) => a + (b - a) * t;

  function getAnimState(cue, t) {
    const localT = t - cue.start;
    const dur = cue.end - cue.start;
    let scale = 1, opacity = 1, dx = 0, dy = 0;

    if (localT < ANIM_DURATION) {
      const p = Math.max(0, localT / ANIM_DURATION);
      if (cue.animationType === "pop") {
        if (p < 0.5) scale = lerp(0, 1.2, easeOutQuad(p * 2));
        else         scale = lerp(1.2, 1.0, easeInOutQuad((p - 0.5) * 2));
      } else if (cue.animationType === "slide") {
        const e = easeOutCubic(p);
        dy = (1 - e) * canvas.height * 0.08;
        opacity = e;
      } else if (cue.animationType === "fade") {
        opacity = easeOutQuad(p);
      }
    } else if (localT > dur - ANIM_DURATION) {
      const p = Math.max(0, (dur - localT) / ANIM_DURATION);
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
  $("#fontSize").addEventListener("input", (e) => { style.fontSize = +e.target.value; render(); });
  $("#fillColor").addEventListener("input", (e) => { style.fillColor = e.target.value; render(); });
  $("#strokeColor").addEventListener("input", (e) => { style.strokeColor = e.target.value; render(); });
  $("#strokeWidth").addEventListener("input", (e) => {
    style.strokeWidth = +e.target.value;
    $("#strokeWidthLabel").textContent = style.strokeWidth + " px";
    render();
  });
  $("#posY").addEventListener("input", (e) => {
    style.posY = +e.target.value;
    for (const c of textCues) { if (!c.userMoved) c.y = defaultY(); }
    render();
  });
  $("#fontFamily").addEventListener("change", (e) => { style.fontFamily = e.target.value; render(); });
  $("#bold").addEventListener("change", (e) => { style.bold = e.target.checked; render(); });

  // ---------- Drawing ----------
  function drawVideoFrame(m) {
    const v = m.video;
    if (!v.videoWidth) return;
    const cw = canvas.width, ch = canvas.height;
    const scale = Math.max(cw / v.videoWidth, ch / v.videoHeight);
    const w = v.videoWidth * scale;
    const h = v.videoHeight * scale;
    ctx.drawImage(v, (cw - w) / 2, (ch - h) / 2, w, h);
  }

  function setTextFont() {
    const weight = style.bold ? "900" : "500";
    ctx.font = `${weight} ${style.fontSize}px ${style.fontFamily}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.miterLimit = 2;
  }

  function measureCue(cue) {
    setTextFont();
    const maxWidth = (canvas.width * 0.9) / Math.max(0.2, cue.scale);
    const lines = wrapText(ctx, cue.text, maxWidth);
    const lh = style.fontSize * 1.2;
    let bw = 0;
    for (const ln of lines) bw = Math.max(bw, ctx.measureText(ln).width);
    const bh = lines.length * lh;
    return { lines, lh, bw, bh };
  }

  function drawText(cue, t) {
    if (!cue || !cue.text) return;
    const anim = getAnimState(cue, t);
    if (anim.opacity <= 0 || anim.scale <= 0) return;

    const { lines, lh, bh } = measureCue(cue);
    const offsetY = -(lines.length - 1) * lh / 2;

    ctx.save();
    ctx.globalAlpha = anim.opacity;
    ctx.translate(cue.x + anim.dx, cue.y + anim.dy);
    ctx.rotate(cue.rotation);
    ctx.scale(cue.scale * anim.scale, cue.scale * anim.scale);

    setTextFont();
    if (style.strokeWidth > 0) {
      ctx.strokeStyle = style.strokeColor;
      ctx.lineWidth = style.strokeWidth * 2;
      lines.forEach((ln, i) => ctx.strokeText(ln, 0, offsetY + i * lh));
    }
    ctx.fillStyle = cue.fillColor || style.fillColor;
    lines.forEach((ln, i) => ctx.fillText(ln, 0, offsetY + i * lh));

    ctx.restore();
  }

  function drawSelectionHandles(cue) {
    const { bw, bh } = measureCue(cue);
    const pad = style.fontSize * 0.25;
    const halfW = bw / 2 + pad;
    const halfH = bh / 2 + pad;

    ctx.save();
    ctx.translate(cue.x, cue.y);
    ctx.rotate(cue.rotation);
    ctx.scale(cue.scale, cue.scale);

    // dashed box
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 4 / cue.scale;
    ctx.setLineDash([12 / cue.scale, 8 / cue.scale]);
    ctx.strokeRect(-halfW, -halfH, halfW * 2, halfH * 2);
    ctx.setLineDash([]);

    // rotation handle (line + circle)
    const rotY = -halfH - 80 / cue.scale;
    ctx.beginPath();
    ctx.moveTo(0, -halfH);
    ctx.lineTo(0, rotY);
    ctx.stroke();
    drawHandle(0, rotY, 18 / cue.scale, true);

    // corner handles
    drawHandle(-halfW, -halfH, 16 / cue.scale);
    drawHandle( halfW, -halfH, 16 / cue.scale);
    drawHandle(-halfW,  halfH, 16 / cue.scale);
    drawHandle( halfW,  halfH, 16 / cue.scale);

    ctx.restore();
  }

  function drawHandle(x, y, r, isRotate = false) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = isRotate ? "#a3e635" : "#22d3ee";
    ctx.strokeStyle = "#0b0e14";
    ctx.lineWidth = r * 0.35;
    ctx.fill();
    ctx.stroke();
  }

  function drawBanners() {
    if (!banners.top && !banners.bottom) return;
    const W = canvas.width, H = canvas.height;
    const h = Math.round(H * 0.09);
    const fs = Math.round(h * 0.42);

    ctx.save();
    ctx.font = `900 ${fs}px ${style.fontFamily}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    if (banners.top) {
      ctx.fillStyle = banners.bg; ctx.fillRect(0, 0, W, h);
      ctx.fillStyle = banners.fg; ctx.fillText(banners.top, W / 2, h / 2);
    }
    if (banners.bottom) {
      ctx.fillStyle = banners.bg; ctx.fillRect(0, H - h, W, h);
      ctx.fillStyle = banners.fg; ctx.fillText(banners.bottom, W / 2, H - h / 2);
    }
    ctx.restore();
  }

  function wrapText(ctx, text, maxWidth) {
    const out = [];
    let line = "";
    for (const ch of text) {
      if (ch === "\n") { out.push(line); line = ""; continue; }
      const test = line + ch;
      if (ctx.measureText(test).width > maxWidth && line) {
        out.push(line); line = ch;
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

    // draw all cues that are visible at currentTime (typically one)
    const visible = currentCue(currentTime);
    if (visible) drawText(visible, currentTime);

    drawBanners();

    // Selection handles on top, but only when selected cue is visible
    const sel = textCues[selectedCueIndex];
    if (sel && currentTime >= sel.start && currentTime < sel.end) {
      drawSelectionHandles(sel);
    }
  }

  // ---------- Pointer interaction (drag / resize / rotate) ----------
  const dragState = {
    mode: null,        // 'move' | 'resize' | 'rotate' | null
    cueIndex: -1,
    pointerId: null,
    moveOffX: 0, moveOffY: 0,
    initialDist: 0, initialScale: 1,
    startAngle: 0, initialRotation: 0,
  };

  function clientToCanvas(e) {
    const r = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (canvas.width / r.width),
      y: (e.clientY - r.top) * (canvas.height / r.height),
    };
  }

  // Returns 'move' | 'rotate' | 'nw' | 'ne' | 'sw' | 'se' | null
  function hitTest(cue, px, py) {
    // Inverse transform pointer into cue's local (unrotated, unscaled) space
    const dx = px - cue.x, dy = py - cue.y;
    const cos = Math.cos(-cue.rotation), sin = Math.sin(-cue.rotation);
    const rx = dx * cos - dy * sin;
    const ry = dx * sin + dy * cos;
    const lx = rx / cue.scale;
    const ly = ry / cue.scale;

    const { bw, bh } = measureCue(cue);
    const pad = style.fontSize * 0.25;
    const halfW = bw / 2 + pad;
    const halfH = bh / 2 + pad;
    const reach = 22 / cue.scale;

    // Rotation handle
    const rotY = -halfH - 80 / cue.scale;
    if (Math.hypot(lx - 0, ly - rotY) < reach + 6 / cue.scale) return "rotate";

    // Corner handles
    const corners = [
      ["nw", -halfW, -halfH], ["ne",  halfW, -halfH],
      ["sw", -halfW,  halfH], ["se",  halfW,  halfH],
    ];
    for (const [name, hx, hy] of corners) {
      if (Math.hypot(lx - hx, ly - hy) < reach) return name;
    }
    // Body
    if (Math.abs(lx) < halfW && Math.abs(ly) < halfH) return "move";
    return null;
  }

  function findCueAtPointer(px, py) {
    // Prefer selected visible cue (so handles outside body still register)
    const sel = textCues[selectedCueIndex];
    if (sel && currentTime >= sel.start && currentTime < sel.end) {
      const h = hitTest(sel, px, py);
      if (h) return { index: selectedCueIndex, hit: h };
    }
    // Otherwise test the cue currently visible
    const visible = currentCue(currentTime);
    if (visible) {
      const i = textCues.indexOf(visible);
      const h = hitTest(visible, px, py);
      if (h) return { index: i, hit: h };
    }
    return null;
  }

  canvas.addEventListener("pointerdown", (e) => {
    const { x: px, y: py } = clientToCanvas(e);
    const hit = findCueAtPointer(px, py);
    if (!hit) {
      // Clicked empty → deselect
      if (selectedCueIndex !== -1) {
        selectedCueIndex = -1;
        renderSchedule(); refreshSelBox(); render();
      }
      return;
    }
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add("dragging");

    selectedCueIndex = hit.index;
    const cue = textCues[hit.index];

    dragState.pointerId = e.pointerId;
    dragState.cueIndex = hit.index;

    if (hit.hit === "move") {
      dragState.mode = "move";
      dragState.moveOffX = px - cue.x;
      dragState.moveOffY = py - cue.y;
    } else if (hit.hit === "rotate") {
      dragState.mode = "rotate";
      dragState.startAngle = Math.atan2(py - cue.y, px - cue.x);
      dragState.initialRotation = cue.rotation;
    } else {
      dragState.mode = "resize";
      dragState.initialDist = Math.hypot(px - cue.x, py - cue.y);
      dragState.initialScale = cue.scale;
    }
    renderSchedule(); refreshSelBox(); render();
  });

  canvas.addEventListener("pointermove", (e) => {
    if (dragState.mode == null || e.pointerId !== dragState.pointerId) return;
    const { x: px, y: py } = clientToCanvas(e);
    const cue = textCues[dragState.cueIndex];
    if (!cue) return;

    if (dragState.mode === "move") {
      cue.x = px - dragState.moveOffX;
      cue.y = py - dragState.moveOffY;
      cue.userMoved = true;
    } else if (dragState.mode === "rotate") {
      const a = Math.atan2(py - cue.y, px - cue.x);
      cue.rotation = dragState.initialRotation + (a - dragState.startAngle);
    } else if (dragState.mode === "resize") {
      const d = Math.hypot(px - cue.x, py - cue.y);
      if (dragState.initialDist > 0) {
        const r = d / dragState.initialDist;
        cue.scale = Math.max(0.2, Math.min(5, dragState.initialScale * r));
      }
    }
    refreshSelBox();
    render();
  });

  function endDrag(e) {
    if (e && e.pointerId !== dragState.pointerId) return;
    dragState.mode = null;
    dragState.pointerId = null;
    dragState.cueIndex = -1;
    canvas.classList.remove("dragging");
    try { canvas.releasePointerCapture(e.pointerId); } catch {}
  }
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);

  // ---------- Selection info box ----------
  function refreshSelBox() {
    const box = $("#selBox");
    const c = textCues[selectedCueIndex];
    if (!c) {
      box.classList.add("empty");
      box.textContent = "テキストをクリックすると、ドラッグ・拡大・回転できます";
      return;
    }
    box.classList.remove("empty");
    const preview = c.text.length > 28 ? c.text.slice(0, 28) + "…" : c.text;
    box.innerHTML = `
      <div style="margin-bottom:6px;"><strong>選択中:</strong> "${escapeHTML(preview)}"</div>
      <div class="cve-mini-row">
        X <input type="number" data-prop="x" value="${Math.round(c.x)}" />
        Y <input type="number" data-prop="y" value="${Math.round(c.y)}" />
        拡大 <input type="number" data-prop="scale" step="0.1" value="${c.scale.toFixed(2)}" />
        回転° <input type="number" data-prop="rotation" step="5" value="${Math.round(c.rotation * 180 / Math.PI)}" />
      </div>
      <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;">
        <button class="cve-btn secondary" data-act="reset">配置リセット</button>
        <button class="cve-btn danger" data-act="delete">このキューを削除</button>
      </div>
    `;
    box.querySelectorAll("input").forEach((inp) => {
      inp.addEventListener("input", () => {
        const v = parseFloat(inp.value);
        if (!isFinite(v)) return;
        const p = inp.dataset.prop;
        if (p === "rotation") c.rotation = (v * Math.PI) / 180;
        else if (p === "scale") c.scale = Math.max(0.2, Math.min(5, v));
        else { c[p] = v; c.userMoved = true; }
        render();
      });
    });
    box.querySelector('[data-act="reset"]')?.addEventListener("click", () => {
      c.x = defaultX(); c.y = defaultY();
      c.scale = 1; c.rotation = 0; c.userMoved = false;
      refreshSelBox(); render();
    });
    box.querySelector('[data-act="delete"]')?.addEventListener("click", () => {
      textCues.splice(selectedCueIndex, 1);
      selectedCueIndex = -1;
      renderSchedule(); refreshSelBox(); render();
    });
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

  // ---------- Export ----------
  let recorder = null;
  let sharedAudioCtx = null;
  const exportBtn = $("#exportBtn");
  const exportStatus = $("#exportStatus");

  exportBtn.addEventListener("click", async () => {
    if (recorder && recorder.state === "recording") { recorder.stop(); return; }
    if (!media.length) { exportStatus.textContent = "メディアがありません"; return; }

    const fps = Math.max(10, Math.min(60, +$("#exportFps").value || 30));
    const stream = canvas.captureStream(fps);

    if ($("#exportAudio").checked) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        sharedAudioCtx = sharedAudioCtx || new AC();
        const dest = sharedAudioCtx.createMediaStreamDestination();
        for (const m of media) {
          m.video.muted = false;
          if (!m._audioSrc) {
            m._audioSrc = sharedAudioCtx.createMediaElementSource(m.video);
            m._audioSrc.connect(sharedAudioCtx.destination);
          }
          m._audioSrc.connect(dest);
        }
        dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
      } catch (e) { console.warn("audio capture failed", e); }
    }

    const mime = pickMimeType();
    const chunks = [];
    recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: chunks[0]?.type || "video/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `canvas-edit-${Date.now()}.webm`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      exportBtn.textContent = "録画開始 (WebM)";
      exportBtn.disabled = false;
      exportStatus.textContent = "完了 ✓";
      recorder = null;
    };

    exportBtn.textContent = "■ 停止";
    exportStatus.textContent = "録画中…";

    // Temporarily clear selection so handles don't get baked into the export
    const prevSel = selectedCueIndex;
    selectedCueIndex = -1;

    seekTo(0);
    await new Promise((r) => requestAnimationFrame(r));
    recorder.start(100);
    play();

    const total = totalDuration();
    const stopAtEnd = () => {
      if (!recorder || recorder.state !== "recording") {
        selectedCueIndex = prevSel;
        refreshSelBox();
        return;
      }
      if (currentTime >= total - 1 / fps) {
        recorder.stop();
        selectedCueIndex = prevSel;
        refreshSelBox();
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
  refreshSelBox();
})();
