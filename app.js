// AdCut Studio — Quick create demo
(() => {
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  // ---------- State ----------
  const defaults = {
    headline: "30% OFF",
    subline:  "5/31 (土) まで",
    cta:      "今すぐチェック",
    palette:  "sunset",
    template: "ec",
    bgm:      "dova21848",
    enabledSizes: { "1:1": true, "9:16": true },
  };
  const BGM_URL = "https://dova-s.jp/bgm/detail/21848/download";
  const TARGET_DURATION = 15;   // 仕上がり尺 (秒)
  const MAX_CLIPS = 8;
  const state = JSON.parse(JSON.stringify(defaults));
  /** @type {{id:number,name:string,url:string,duration:number,in:number,out:number}[]} */
  const clips = [];
  let clipIdSeq = 0;

  const palettes = {
    sunset: { c1: "rgba(0,200,255,.45)",  c2: "rgba(255,58,140,.45)", base: "linear-gradient(135deg,#1a2440,#341a4a 60%,#4a1a3a)" },
    ocean:  { c1: "rgba(0,255,255,.35)",  c2: "rgba(0,100,255,.45)",  base: "linear-gradient(135deg,#003049,#0077b6 50%,#00c8ff)" },
    forest: { c1: "rgba(43,182,115,.45)", c2: "rgba(255,209,102,.45)", base: "linear-gradient(135deg,#1a3a2f,#2bb673 55%,#0a3a2a)" },
    mono:   { c1: "rgba(255,255,255,.18)", c2: "rgba(180,180,180,.25)", base: "linear-gradient(135deg,#0a0a0a,#2a2a2a 60%,#0a0a0a)" },
    candy:  { c1: "rgba(255,58,140,.45)", c2: "rgba(255,209,102,.45)", base: "linear-gradient(135deg,#ff3a8c,#ffd166 60%,#6f5cff)" },
  };

  const templates = {
    ec:    { headline: "30% OFF",      subline: "5/31 (土) まで", cta: "今すぐチェック",   palette: "sunset", bgm: "dova21848" },
    app:   { headline: "¥3,000 引き",  subline: "6/30 まで",      cta: "App Store で見る", palette: "ocean",  bgm: "dova21848" },
    brand: { headline: "新作発売",      subline: "限定 100 点",    cta: "詳細を見る",       palette: "mono",   bgm: "dova21848" },
    event: { headline: "入場無料",      subline: "5/10 (土) 12:00",cta: "参加登録する",     palette: "candy",  bgm: "dova21848" },
  };

  // ---------- Render ----------
  function render() {
    $$(".size-card").forEach((card) => {
      const size = card.dataset.size;
      card.classList.toggle("disabled", !state.enabledSizes[size]);

      card.querySelector(".ad-headline").textContent = state.headline;
      card.querySelector(".ad-subline").textContent  = state.subline;
      card.querySelector(".ad-cta").textContent      = state.cta;

      const frame = card.querySelector(".ad-frame");
      const p = palettes[state.palette];
      frame.style.background = p.base;
      frame.style.setProperty("--c1", p.c1);
      frame.style.setProperty("--c2", p.c2);
    });
  }

  // ---------- Inputs (text fields) ----------
  const fieldMap = {
    headline: $("#headlineInput"),
    subline:  $("#sublineInput"),
    cta:      $("#ctaInput"),
  };
  Object.entries(fieldMap).forEach(([key, el]) => {
    el.addEventListener("input", () => {
      state[key] = el.value;
      render();
    });
  });

  // ---------- Palette / Template / BGM ----------
  $$(".pal").forEach((b) => {
    b.addEventListener("click", () => {
      $$(".pal").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      state.palette = b.dataset.palette;
      render();
    });
  });

  $$(".tpl-chip[data-tpl]").forEach((b) => {
    b.addEventListener("click", () => {
      $$(".tpl-chip[data-tpl]").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      const t = templates[b.dataset.tpl];
      state.template = b.dataset.tpl;
      Object.assign(state, t);
      // sync inputs
      fieldMap.headline.value = state.headline;
      fieldMap.subline.value  = state.subline;
      fieldMap.cta.value      = state.cta;
      // sync palette pill
      $$(".pal").forEach((x) => x.classList.toggle("active", x.dataset.palette === state.palette));
      // sync bgm pill
      $$(".tpl-chip[data-bgm]").forEach((x) => x.classList.toggle("active", x.dataset.bgm === state.bgm));
      render();
      toast(`テンプレ「${b.textContent.trim()}」を適用しました`);
    });
  });

  $$(".tpl-chip[data-bgm]").forEach((b) => {
    b.addEventListener("click", () => {
      $$(".tpl-chip[data-bgm]").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      state.bgm = b.dataset.bgm;
      toast(`BGM を「${b.textContent.trim()}」に変更しました`);
    });
  });

  // ---------- Size toggles ----------
  $$('.chk input[type="checkbox"]').forEach((cb) => {
    cb.addEventListener("change", () => {
      state.enabledSizes[cb.dataset.size] = cb.checked;
      render();
    });
  });

  // ---------- Voice input (Web Speech API) ----------
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recIndicator = $("#recIndicator");
  let activeMic = null;

  function showHintNoSupport() {
    $("#micHint").textContent = "このブラウザでは音声入力に対応していません。Chrome / Edge / Safari でお試しください。";
    $("#micHint").style.color = "#ffb4b4";
  }

  function startRecognition({ onResult, onEnd }) {
    if (!SR) {
      showHintNoSupport();
      toast("音声入力はこのブラウザでは利用できません");
      onEnd && onEnd();
      return null;
    }
    const rec = new SR();
    rec.lang = "ja-JP";
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    recIndicator.classList.add("show");

    rec.onresult = (e) => {
      const text = Array.from(e.results).map((r) => r[0].transcript).join("").trim();
      if (text) onResult(text);
    };
    rec.onerror = (e) => {
      toast("音声入力エラー: " + (e.error || "不明"));
    };
    rec.onend = () => {
      recIndicator.classList.remove("show");
      onEnd && onEnd();
    };
    try {
      rec.start();
    } catch (err) {
      toast("音声入力を開始できませんでした");
      recIndicator.classList.remove("show");
      onEnd && onEnd();
      return null;
    }
    return rec;
  }

  // Main prompt mic
  $("#micPrompt").addEventListener("click", () => {
    const btn = $("#micPrompt");
    if (btn.classList.contains("recording") && activeMic) {
      activeMic.stop();
      return;
    }
    btn.classList.add("recording");
    activeMic = startRecognition({
      onResult: (text) => {
        const cur = $("#aiPrompt").value.trim();
        $("#aiPrompt").value = cur ? cur + " " + text : text;
      },
      onEnd: () => { btn.classList.remove("recording"); activeMic = null; },
    });
  });

  // Per-field mic
  $$(".mic-mini").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.classList.contains("recording") && activeMic) {
        activeMic.stop();
        return;
      }
      const target = btn.dataset.target;
      btn.classList.add("recording");
      activeMic = startRecognition({
        onResult: (text) => {
          state[target] = text;
          fieldMap[target].value = text;
          render();
          toast(`${labelOf(target)}を「${text}」に更新しました`);
        },
        onEnd: () => { btn.classList.remove("recording"); activeMic = null; },
      });
    });
  });
  function labelOf(k) {
    return { headline: "オファー / 割引", subline: "期限", cta: "CTA" }[k] || k;
  }

  // ---------- Generate (auto-edit + apply text + play) ----------
  $("#genBtn").addEventListener("click", () => {
    const raw = $("#aiPrompt").value.trim();
    let textApplied = false;
    if (raw) {
      const parsed = parsePrompt(raw);
      Object.assign(state, parsed);
      fieldMap.headline.value = state.headline;
      fieldMap.subline.value  = state.subline;
      fieldMap.cta.value      = state.cta;
      $$(".pal").forEach((x) => x.classList.toggle("active", x.dataset.palette === state.palette));
      textApplied = true;
    }
    const hasClips = clips.length > 0;
    if (hasClips) autoArrangeClips();
    render();
    if (hasClips) {
      playStitched();
      toast(textApplied
        ? "プロンプトを反映し、15 秒に自動編集して再生中…"
        : "クリップを 15 秒に自動編集して再生中…");
    } else if (textApplied) {
      toast("プロンプトを反映しました（クリップを取り込むと自動編集できます）");
    } else {
      toast("プロンプトを入力するか、クリップを取り込んでください");
    }
  });

  function parsePrompt(text) {
    // 1) split into segments by full-width or half-width separators
    const parts = text.split(/[、,。.\n]+/).map((s) => s.trim()).filter(Boolean);
    const out = {};
    // 1a) prioritize: detect discount-like phrase → headline, deadline-like phrase → subline,
    //     CTA-like phrase → cta. Fall back to positional order.
    const DISCOUNT_RE = /(\d+\s*%\s*off|\d+\s*%\s*オフ|オフ|割引|セール|sale|¥\s*[\d,]+\s*引|[\d,]+\s*円\s*引|無料|free)/i;
    const DEADLINE_RE = /(\d{1,2}\s*[\/\.月]\s*\d{1,2}|まで$|までに|締切|締め切り|期限|until|by\s+\d)/i;
    const CTA_RE      = /(チェック|登録|購入|予約|見る|store|app|click|今すぐ|いますぐ|応募|問い?合)/i;

    const used = new Set();
    const pickBy = (re) => {
      const idx = parts.findIndex((p, i) => !used.has(i) && re.test(p));
      if (idx >= 0) { used.add(idx); return parts[idx]; }
      return null;
    };
    const offer    = pickBy(DISCOUNT_RE);
    const deadline = pickBy(DEADLINE_RE);
    const ctaPart  = pickBy(CTA_RE);
    if (offer)    out.headline = offer;
    if (deadline) out.subline  = deadline;
    if (ctaPart)  out.cta      = ctaPart;
    // positional fallback for anything still missing
    const remaining = parts.filter((_, i) => !used.has(i));
    if (!out.headline && remaining[0]) out.headline = remaining.shift();
    if (!out.subline  && remaining[0]) out.subline  = remaining.shift();
    if (!out.cta      && remaining[0]) out.cta      = remaining.shift();
    // 2) keyword-driven palette inference
    const lc = text.toLowerCase();
    if (/夏|サマー|summer|セール|sale|割引/.test(lc))      out.palette = "sunset";
    else if (/海|ocean|青|空|cool|tech/.test(lc))           out.palette = "ocean";
    else if (/自然|forest|エコ|オーガニック|緑/.test(lc)) out.palette = "forest";
    else if (/高級|luxury|ラグジュアリー|モノトーン|black/.test(lc)) out.palette = "mono";
    else if (/カラフル|ポップ|キャンディ|お祝い|フェス/.test(lc)) out.palette = "candy";
    return out;
  }

  // ---------- Clip import & auto-edit ----------
  const dropzone     = $("#dropzone");
  const clipInput    = $("#clipInput");
  const clipListEl   = $("#clipList");
  const totalMetaEl  = $("#totalMeta");
  const adVideos     = $$(".ad-video");

  function fmt(t) {
    if (!isFinite(t)) return "0.0s";
    return t.toFixed(1) + "s";
  }
  function totalLength() {
    return clips.reduce((s, c) => s + Math.max(0, c.out - c.in), 0);
  }
  function updateTotalMeta() {
    if (!totalMetaEl) return;
    const tot = totalLength();
    const flag = clips.length && Math.abs(tot - TARGET_DURATION) > 0.6;
    totalMetaEl.innerHTML =
      `合計 <strong>${fmt(tot)}</strong> / ${clips.length} 本` +
      (flag ? ` <span class="warn">（目標 ${TARGET_DURATION}s）</span>` : "");
  }

  async function readVideoMeta(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const v = document.createElement("video");
      v.preload = "metadata";
      v.muted = true;
      v.src = url;
      v.onloadedmetadata = () => resolve({ url, duration: v.duration || 0 });
      v.onerror = () => { URL.revokeObjectURL(url); reject(new Error("動画を読み込めませんでした")); };
    });
  }

  async function addFiles(fileList) {
    const files = Array.from(fileList).filter((f) => f.type.startsWith("video/"));
    if (!files.length) { toast("動画ファイルを選択してください"); return; }
    for (const f of files) {
      if (clips.length >= MAX_CLIPS) { toast(`クリップは最大 ${MAX_CLIPS} 本までです`); break; }
      try {
        const { url, duration } = await readVideoMeta(f);
        const clip = {
          id: ++clipIdSeq,
          name: f.name,
          url,
          duration: duration || 0,
          in: 0,
          out: Math.min(duration || 0, 4),
        };
        clips.push(clip);
      } catch (e) {
        toast(`「${f.name}」を読み込めませんでした`);
      }
    }
    autoArrangeClips();
    renderClipList();
    toast(`${files.length} 本を取り込み、自動で 15 秒に並べ替えました`);
  }

  // 各クリップから「中央付近のいい所」を均等に切り出して合計 TARGET_DURATION 秒に収める
  function autoArrangeClips() {
    if (!clips.length) return;
    let target = TARGET_DURATION;
    const n = clips.length;
    // 1) まず均等割り
    let per = target / n;
    clips.forEach((c) => {
      const len = Math.min(per, Math.max(0.5, c.duration));
      const start = Math.max(0, (c.duration - len) / 2);
      c.in = start;
      c.out = Math.min(c.duration, start + len);
    });
    // 2) 短いクリップで埋まらなかった分を、長いクリップに振り分け
    let actual = totalLength();
    let pass = 0;
    while (actual < target - 0.05 && pass < 3) {
      const slack = target - actual;
      const expandable = clips.filter((c) => c.out < c.duration);
      if (!expandable.length) break;
      const each = slack / expandable.length;
      expandable.forEach((c) => {
        const room = c.duration - c.out;
        c.out = Math.min(c.duration, c.out + Math.min(each, room));
      });
      actual = totalLength();
      pass++;
    }
    updateTotalMeta();
  }

  function renderClipList() {
    if (!clipListEl) return;
    clipListEl.innerHTML = "";
    clips.forEach((c, idx) => {
      const row = document.createElement("div");
      row.className = "clip-row";
      row.innerHTML = `
        <div class="clip-thumb-wrap">
          <video class="clip-thumb" muted playsinline preload="metadata"></video>
          <span class="clip-idx">${idx + 1}</span>
        </div>
        <div class="clip-info">
          <div class="clip-name" title="${c.name}">${c.name}</div>
          <div class="clip-meta">
            <span class="clip-range">使用 <strong>${fmt(c.in)}</strong> → <strong>${fmt(c.out)}</strong></span>
            <span class="clip-total">/ 全 ${fmt(c.duration)}</span>
          </div>
          <div class="clip-sliders">
            <label>IN  <input type="range" min="0" max="${c.duration.toFixed(2)}" step="0.1" value="${c.in.toFixed(2)}" data-edit="in" data-id="${c.id}"></label>
            <label>OUT <input type="range" min="0" max="${c.duration.toFixed(2)}" step="0.1" value="${c.out.toFixed(2)}" data-edit="out" data-id="${c.id}"></label>
          </div>
        </div>
        <button class="clip-del" data-del="${c.id}" title="このクリップを削除">×</button>
      `;
      const thumb = row.querySelector(".clip-thumb");
      thumb.src = c.url;
      thumb.addEventListener("loadedmetadata", () => { try { thumb.currentTime = c.in; } catch {} });
      clipListEl.appendChild(row);
    });
    updateTotalMeta();
  }

  if (clipInput) {
    clipInput.addEventListener("change", () => {
      addFiles(clipInput.files);
      clipInput.value = "";
    });
  }
  if (dropzone) {
    ["dragenter","dragover"].forEach((ev) => {
      dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.add("drag"); });
    });
    ["dragleave","drop"].forEach((ev) => {
      dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.remove("drag"); });
    });
    dropzone.addEventListener("drop", (e) => {
      if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files);
    });
  }

  if (clipListEl) {
    clipListEl.addEventListener("input", (e) => {
      const t = e.target;
      if (t.matches('input[type="range"][data-edit]')) {
        const id = Number(t.dataset.id);
        const c = clips.find((x) => x.id === id);
        if (!c) return;
        const v = Number(t.value);
        if (t.dataset.edit === "in")  c.in  = Math.min(v, c.out - 0.2);
        if (t.dataset.edit === "out") c.out = Math.max(v, c.in  + 0.2);
        const meta = t.closest(".clip-row").querySelector(".clip-range");
        if (meta) meta.innerHTML = `使用 <strong>${fmt(c.in)}</strong> → <strong>${fmt(c.out)}</strong>`;
        updateTotalMeta();
      }
    });
    clipListEl.addEventListener("click", (e) => {
      const t = e.target.closest("[data-del]");
      if (!t) return;
      const id = Number(t.dataset.del);
      const idx = clips.findIndex((x) => x.id === id);
      if (idx < 0) return;
      try { URL.revokeObjectURL(clips[idx].url); } catch {}
      clips.splice(idx, 1);
      renderClipList();
      toast("クリップを削除しました");
    });
  }

  $("#autoArrangeBtn") && $("#autoArrangeBtn").addEventListener("click", () => {
    if (!clips.length) { toast("先にクリップを取り込んでください"); return; }
    autoArrangeClips();
    renderClipList();
    toast(`${TARGET_DURATION} 秒に自動編集しました`);
  });
  $("#clearClipsBtn") && $("#clearClipsBtn").addEventListener("click", () => {
    if (!clips.length) return;
    clips.forEach((c) => { try { URL.revokeObjectURL(c.url); } catch {} });
    clips.length = 0;
    renderClipList();
    stopStitched();
    toast("クリップをすべて消去しました");
  });

  // ---------- Stitched playback (sync across both size cards) ----------
  let playState = null; // { idx, clip, raf, onTime }

  function stopStitched() {
    if (playState && playState.onTime) {
      adVideos.forEach((v) => v.removeEventListener("timeupdate", playState.onTime));
    }
    adVideos.forEach((v) => { try { v.pause(); } catch {} });
    playState = null;
    setProgress(0);
    stopBgm && stopBgm();
  }

  function setProgress(ratio) {
    $$(".ad-progress-fill").forEach((bar) => {
      bar.style.transition = "width .15s linear";
      bar.style.width = (Math.max(0, Math.min(1, ratio)) * 100).toFixed(2) + "%";
    });
  }

  function playStitched() {
    if (!clips.length) { toast("先にクリップを取り込んでください"); return; }
    stopStitched();
    const seq = clips.slice();
    const totals = seq.map((c) => Math.max(0, c.out - c.in));
    const grandTotal = totals.reduce((a, b) => a + b, 0);
    let cumPrev = 0;
    let i = 0;

    const playClip = (idx) => {
      const c = seq[idx];
      adVideos.forEach((v) => {
        v.src = c.url;
        const setTime = () => { try { v.currentTime = c.in; } catch {} };
        if (v.readyState >= 1) setTime();
        else v.addEventListener("loadedmetadata", setTime, { once: true });
        const playWhenReady = () => v.play().catch(() => {});
        if (v.readyState >= 2) playWhenReady();
        else v.addEventListener("loadeddata", playWhenReady, { once: true });
      });
    };

    const onTime = () => {
      const v = adVideos[0];
      if (!v) return;
      const c = seq[i];
      const local = Math.max(0, v.currentTime - c.in);
      const ratio = grandTotal ? (cumPrev + Math.min(local, totals[i])) / grandTotal : 0;
      setProgress(ratio);
      // sync the second video
      if (adVideos[1]) {
        const drift = Math.abs(adVideos[1].currentTime - v.currentTime);
        if (drift > 0.2) adVideos[1].currentTime = v.currentTime;
      }
      if (v.currentTime >= c.out - 0.05) {
        cumPrev += totals[i];
        i++;
        if (i >= seq.length) {
          stopStitched();
          toast("再生終了");
          return;
        }
        playClip(i);
      }
    };

    playState = { idx: 0, onTime };
    adVideos.forEach((v) => v.addEventListener("timeupdate", onTime));
    playClip(0);
    playBgm && playBgm();
  }

  // ---------- Export actions ----------
  $("#exportAll").addEventListener("click", () => {
    const sizes = Object.keys(state.enabledSizes).filter((k) => state.enabledSizes[k]);
    if (!sizes.length) { toast("書き出すサイズが選択されていません"); return; }
    runExport(sizes, "MP4");
  });

  $("#duplicateBtn").addEventListener("click", () => {
    state.enabledSizes["1:1"]  = true;
    state.enabledSizes["9:16"] = true;
    $$('.chk input[type="checkbox"]').forEach((cb) => (cb.checked = true));
    render();
    flashAll();
    toast("1080×1080 / 1080×1920 に自動複製しました");
  });

  $("#exportPpro").addEventListener("click", () => {
    const sizes = Object.keys(state.enabledSizes).filter((k) => state.enabledSizes[k]);
    runExport(sizes, "Premiere Pro (.prproj)");
  });
  $("#exportAe").addEventListener("click", () => {
    const sizes = Object.keys(state.enabledSizes).filter((k) => state.enabledSizes[k]);
    runExport(sizes, "After Effects (.aep)");
  });

  function runExport(sizes, kind) {
    toast(`${kind} を ${sizes.length} サイズで書き出し中…`);
    flashAll();
    setTimeout(() => {
      toast(`書き出し完了: ${sizes.join(" / ")} を ${kind} で生成しました`);
    }, 1400);
  }

  function flashAll() {
    $$(".ad-progress-fill").forEach((bar) => {
      bar.style.transition = "none"; bar.style.width = "0%";
      requestAnimationFrame(() => {
        bar.style.transition = "width 1.2s ease";
        bar.style.width = "100%";
      });
    });
  }

  // ---------- Reset to defaults ----------
  $("#resetBtn").addEventListener("click", () => {
    Object.assign(state, JSON.parse(JSON.stringify(defaults)));
    fieldMap.headline.value = state.headline;
    fieldMap.subline.value  = state.subline;
    fieldMap.cta.value      = state.cta;
    $("#aiPrompt").value = "";
    $$(".pal").forEach((x) => x.classList.toggle("active", x.dataset.palette === state.palette));
    $$(".tpl-chip[data-tpl]").forEach((x) => x.classList.toggle("active", x.dataset.tpl === state.template));
    $$(".tpl-chip[data-bgm]").forEach((x) => x.classList.toggle("active", x.dataset.bgm === state.bgm));
    $$('.chk input[type="checkbox"]').forEach((cb) => {
      cb.checked = state.enabledSizes[cb.dataset.size];
    });
    render();
    toast("初期状態にリセットしました");
  });

  // ---------- BGM (DOVA-SYNDROME) ----------
  const bgmAudio  = $("#bgmAudio");
  const bgmToggle = $("#bgmToggle");
  const bgmStatus = $("#bgmStatus");

  function setBgmLabel(playing) {
    if (!bgmToggle) return;
    bgmToggle.textContent = playing ? "■ 停止" : "▶ BGM を試聴";
  }
  function setBgmStatus(msg) { if (bgmStatus) bgmStatus.textContent = msg; }

  function playBgm() {
    if (!bgmAudio) return;
    if (bgmAudio.src !== BGM_URL) bgmAudio.src = BGM_URL;
    const p = bgmAudio.play();
    if (p && p.catch) {
      p.catch(() => {
        setBgmLabel(false);
        setBgmStatus("ブラウザ側の制限で直接再生できませんでした。リンクから DL してください。");
        toast("BGM を直接再生できませんでした。リンクからダウンロードしてください。");
      });
    }
  }
  function stopBgm() { if (bgmAudio) bgmAudio.pause(); }

  if (bgmAudio && bgmToggle) {
    bgmToggle.addEventListener("click", () => {
      if (bgmAudio.paused) playBgm(); else stopBgm();
    });
    bgmAudio.addEventListener("play",  () => { setBgmLabel(true);  setBgmStatus("再生中: DOVA-SYNDROME #21848"); });
    bgmAudio.addEventListener("pause", () => setBgmLabel(false));
    bgmAudio.addEventListener("ended", () => setBgmLabel(false));
    bgmAudio.addEventListener("error", () => {
      setBgmLabel(false);
      setBgmStatus("読み込みに失敗しました。リンクから DL してください。");
    });
  }

  // ---------- Play all (preview animation) ----------
  $("#playAll").addEventListener("click", () => {
    if (clips.length) {
      playStitched();
      toast("全サイズを同時再生中…");
    } else {
      flashAll();
      playBgm();
      toast("クリップ未取り込みのため BGM のみ再生");
    }
  });

  // ---------- Toast ----------
  let toastTimer = null;
  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2400);
  }

  // ---------- Init ----------
  if (!SR) showHintNoSupport();
  render();
})();
