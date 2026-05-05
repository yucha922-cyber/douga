// AdCut Studio — Quick create demo
(() => {
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  // ---------- State ----------
  const fineDefaults = {
    duration:    15,         // total target seconds (5..30)
    textPos:     "center",   // "top" | "center" | "bottom"  — preset for layout
    layout: {                // per-element position (% of frame width/height)
      headline: { x: 50, y: 42 },
      subline:  { x: 50, y: 54 },
      cta:      { x: 50, y: 70 },
    },
    textScale:   1.0,        // 0.7..1.4
    dimAmount:   0.55,       // 0..0.85
    textColor:   "#ffffff",
    ctaBg:       "#ffffff",
    ctaColor:    "#0e1218",
    shadow:      "strong",   // "none" | "soft" | "strong"
    transition:  "fade",     // "cut" | "fade" | "slide" | "zoom"
    showHeadline:true,
    showSubline: true,
    showCta:     true,
  };
  const TRANSITION_DUR = 0.22; // seconds per outgoing/incoming half

  function presetLayout(pos) {
    if (pos === "top")    return { headline: { x: 50, y: 18 }, subline: { x: 50, y: 30 }, cta: { x: 50, y: 44 } };
    if (pos === "bottom") return { headline: { x: 50, y: 56 }, subline: { x: 50, y: 68 }, cta: { x: 50, y: 82 } };
    return                       { headline: { x: 50, y: 42 }, subline: { x: 50, y: 54 }, cta: { x: 50, y: 70 } };
  }
  const clampN = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const defaults = {
    headline: "30% OFF",
    subline:  "5/31 (土) まで",
    cta:      "今すぐチェック",
    palette:  "sunset",
    template: "ec",
    bgm:      "dova21848",
    bgImage:  null,
    enabledSizes: { "1:1": true, "9:16": true },
    fine: JSON.parse(JSON.stringify(fineDefaults)),
  };
  const BGM_URL = "https://dova-s.jp/bgm/detail/21848/download";
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
    ec:       { label: "EC セール",    headline: "30% OFF",      subline: "5/31 (土) まで",  cta: "今すぐチェック",   palette: "sunset", bgm: "dova21848" },
    app:      { label: "アプリ訴求",   headline: "¥3,000 引き",  subline: "6/30 まで",       cta: "App Store で見る", palette: "ocean",  bgm: "dova21848" },
    brand:    { label: "ブランド",     headline: "新作発売",      subline: "限定 100 点",     cta: "詳細を見る",       palette: "mono",   bgm: "dova21848" },
    event:    { label: "イベント",     headline: "入場無料",      subline: "5/10 (土) 12:00", cta: "参加登録する",     palette: "candy",  bgm: "dova21848" },
    food:     { label: "飲食店",       headline: "ランチ ¥800",  subline: "平日 11-14 時",   cta: "今すぐ予約",       palette: "forest", bgm: "dova21848" },
    realestate:{label: "不動産",       headline: "賃料 1ヶ月無料",subline: "5/31 まで成約で", cta: "内見を予約",       palette: "ocean",  bgm: "dova21848" },
  };

  // ---------- User-uploaded template images ----------
  /** @type {{id:string,label:string,url:string,headline:string,subline:string,cta:string}[]} */
  const userTemplates = [];
  let tplIdSeq = 0;
  /** @type {HTMLImageElement|null} preloaded for canvas export */
  let bgImageEl = null;

  // Per-template overrides for offer/deadline/CTA. Keys: built-in like "ec",
  // user templates like "user-usr-1". Only changed fields are stored.
  /** @type {Record<string, {headline?:string, subline?:string, cta?:string}>} */
  const templateOverrides = {};

  function templateBaseFor(key) {
    if (templates[key]) return templates[key];
    if (typeof key === "string" && key.startsWith("user-")) {
      const uid = key.slice(5);
      return userTemplates.find((x) => x.id === uid) || null;
    }
    return null;
  }
  function effectiveTemplate(key) {
    const base = templateBaseFor(key);
    if (!base) return null;
    const ov = templateOverrides[key] || {};
    return {
      label:    base.label || key,
      headline: ov.headline ?? base.headline ?? "",
      subline:  ov.subline  ?? base.subline  ?? "",
      cta:      ov.cta      ?? base.cta      ?? "",
      palette:  base.palette,
    };
  }
  function hasOverride(key) {
    const o = templateOverrides[key];
    return !!(o && (o.headline != null || o.subline != null || o.cta != null));
  }
  function updateTplResetVisibility() {
    const btn = $("#tplTextReset");
    if (!btn) return;
    btn.hidden = !hasOverride(state.template);
  }

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

      const img = card.querySelector(".ad-bg-image");
      if (img) {
        if (state.bgImage) {
          if (img.getAttribute("src") !== state.bgImage.url) img.src = state.bgImage.url;
          img.style.display = "";
        } else {
          img.removeAttribute("src");
          img.style.display = "none";
        }
      }
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
      // Save edit into the active template's override map so each template
      // remembers its own offer / deadline / CTA across switching.
      const tk = state.template;
      if (tk && templateBaseFor(tk)) {
        if (!templateOverrides[tk]) templateOverrides[tk] = {};
        templateOverrides[tk][key] = el.value;
        // Re-render gallery so tile previews show the updated text.
        if (typeof renderTemplateGallery === "function") renderTemplateGallery();
        if (typeof updateTplResetVisibility === "function") updateTplResetVisibility();
      }
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
      // applyTemplate() handles state, bgImage clearing, gallery + render sync
      applyTemplate(b.dataset.tpl);
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
    const tot = totalLength();
    if (totalMetaEl) {
      const flag = clips.length && Math.abs(tot - state.fine.duration) > 0.6;
      totalMetaEl.innerHTML =
        `合計 <strong>${fmt(tot)}</strong> / ${clips.length} 本` +
        (flag ? ` <span class="warn">（目標 ${state.fine.duration}s）</span>` : "");
    }
    const cnt = $("#libCntVid");
    if (cnt) cnt.textContent = `${clips.length} 本 / ${fmt(tot)}`;
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

  // 各クリップから「中央付近のいい所」を均等に切り出して合計 state.fine.duration 秒に収める
  function autoArrangeClips() {
    if (!clips.length) return;
    let target = state.fine.duration;
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
    toast(`${state.fine.duration} 秒に自動編集しました`);
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
  let playState = null; // { idx, clip, raf, onTime, transTimers:[] }

  function clearTransitionFx() {
    $$(".ad-frame").forEach((f) => {
      f.classList.remove("is-transitioning", "trans-fade", "trans-slide", "trans-zoom");
    });
  }

  function triggerLivePreviewTransition(type) {
    if (type === "cut") return;
    $$(".ad-frame").forEach((f) => {
      f.classList.remove("trans-fade", "trans-slide", "trans-zoom");
      // Force reflow so the animation restarts each time
      void f.offsetWidth;
      f.classList.add("is-transitioning", `trans-${type}`);
    });
    return setTimeout(clearTransitionFx, TRANSITION_DUR * 2 * 1000 + 60);
  }

  function stopStitched() {
    if (playState && playState.raf) cancelAnimationFrame(playState.raf);
    if (playState && playState.transTimers) {
      playState.transTimers.forEach((t) => clearTimeout(t));
    }
    $$(".ad-video").forEach((v) => { try { v.pause(); } catch {} });
    // Reset buffer A to active, B to inactive (display state for static preview)
    $$(".size-card").forEach((card) => {
      const a = card.querySelector(".ad-video-a");
      const b = card.querySelector(".ad-video-b");
      if (a) a.classList.add("active");
      if (b) b.classList.remove("active");
    });
    clearTransitionFx();
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

  // Dual-buffered stitched playback. Each size card has two <video> elements
  // (ad-video-a, ad-video-b). While one plays, the other preloads the next clip
  // so the swap at the boundary is instantaneous (no load gap).
  function playStitched() {
    if (!clips.length) { toast("先にクリップを取り込んでください"); return; }
    stopStitched();
    const seq = clips.slice();
    const totals = seq.map((c) => Math.max(0, c.out - c.in));
    const grandTotal = totals.reduce((a, b) => a + b, 0);
    let cumPrev = 0;
    let i = 0;
    let bufIdx = 0;             // 0 means buffer "a" is front, 1 means "b" is front
    const transTimers = [];

    const pairs = $$(".size-card").map((card) => [
      card.querySelector(".ad-video-a"),
      card.querySelector(".ad-video-b"),
    ]).filter(([a, b]) => a && b);

    const front = () => pairs.map((p) => p[bufIdx]);
    const back  = () => pairs.map((p) => p[1 - bufIdx]);

    const showFront = () => {
      pairs.forEach((p) => {
        p[bufIdx].classList.add("active");
        p[1 - bufIdx].classList.remove("active");
      });
    };

    const loadInto = (videos, c, autoplay) => {
      videos.forEach((v) => {
        if (v.src !== c.url) v.src = c.url;
        const setTime = () => {
          try { v.currentTime = c.in; } catch {}
          if (autoplay) v.play().catch(() => {});
          else { try { v.pause(); } catch {} }
        };
        if (v.readyState >= 1) setTime();
        else v.addEventListener("loadedmetadata", setTime, { once: true });
        if (autoplay) {
          const playWhenReady = () => v.play().catch(() => {});
          if (v.readyState >= 2) playWhenReady();
          else v.addEventListener("loadeddata", playWhenReady, { once: true });
        }
      });
    };

    const scheduleTransitionForClip = (idx) => {
      const type = state.fine.transition || "cut";
      if (type === "cut") return;
      if (idx >= seq.length - 1) return;
      const cLen = Math.max(0, seq[idx].out - seq[idx].in);
      if (cLen < TRANSITION_DUR * 2.2) return;
      const t = setTimeout(() => triggerLivePreviewTransition(type), (cLen - TRANSITION_DUR) * 1000);
      transTimers.push(t);
    };

    // Initial: buffer A = clip 0 (playing), buffer B = clip 1 (preloaded)
    bufIdx = 0;
    showFront();
    pairs.flat().forEach((v) => { try { v.pause(); } catch {} });
    loadInto(front(), seq[0], true);
    if (seq[1]) loadInto(back(), seq[1], false);
    scheduleTransitionForClip(0);

    const tick = () => {
      if (!playState) return;
      const v = front()[0];
      const c = seq[i];
      if (v && c && v.readyState >= 1) {
        const local = Math.max(0, v.currentTime - c.in);
        const ratio = grandTotal ? (cumPrev + Math.min(local, totals[i])) / grandTotal : 0;
        setProgress(ratio);
        // Keep the second card's front video in sync time-wise
        if (front()[1]) {
          const drift = Math.abs(front()[1].currentTime - v.currentTime);
          if (drift > 0.2) { try { front()[1].currentTime = v.currentTime; } catch {} }
        }
        if (v.currentTime >= c.out - 0.04) {
          cumPrev += totals[i];
          i++;
          if (i >= seq.length) {
            stopStitched();
            toast("再生終了");
            return;
          }
          // Swap buffers: back (already preloaded with seq[i]) becomes front
          bufIdx = 1 - bufIdx;
          showFront();
          front().forEach((nv) => {
            const playNow = () => nv.play().catch(() => {});
            if (nv.readyState >= 2) playNow();
            else nv.addEventListener("loadeddata", playNow, { once: true });
          });
          // Pause and rewind the (now back) old buffer to its in-point
          back().forEach((ov) => { try { ov.pause(); } catch {} });
          // Preload seq[i+1] into the new back buffer
          if (seq[i + 1]) loadInto(back(), seq[i + 1], false);
          scheduleTransitionForClip(i);
        }
      }
      playState.raf = requestAnimationFrame(tick);
    };

    playState = { raf: 0, transTimers, pairs };
    playState.raf = requestAnimationFrame(tick);
    playBgm && playBgm();
  }

  // ---------- Library: BGM tracks model ----------
  /** @type {{id:string,name:string,source:'remote'|'local',url:string,buffer?:AudioBuffer,exportable:boolean}[]} */
  const bgmTracks = [
    { id: "dova21848", name: "DOVA-SYNDROME #21848 (試聴のみ)", source: "remote", url: BGM_URL, exportable: false },
  ];
  let selectedBgmId = "dova21848";
  let bgmIdSeq = 0;
  const bgmAudio  = $("#bgmAudio");
  const bgmStatus = $("#bgmStatus");
  const bgmListEl = $("#bgmList");

  function selectedTrack() {
    return bgmTracks.find((t) => t.id === selectedBgmId) || null;
  }
  function setBgmStatus(msg) { if (bgmStatus) bgmStatus.textContent = msg; }

  function renderBgmList() {
    if (!bgmListEl) return;
    bgmListEl.innerHTML = "";
    bgmTracks.forEach((t) => {
      const li = document.createElement("li");
      li.className = "lib-aud-row" + (t.id === selectedBgmId ? " selected" : "");
      const note  = t.exportable ? "書き出しに焼き込み可" : "ブラウザ制約で書き出しは無音 (試聴のみ)";
      li.innerHTML = `
        <label class="aud-pick">
          <input type="radio" name="bgmpick" value="${t.id}" ${t.id === selectedBgmId ? "checked" : ""} />
          <span class="aud-icon">${t.source === "local" ? "🎵" : "🌐"}</span>
          <span class="aud-info">
            <span class="aud-name">${t.name}</span>
            <span class="aud-note">${note}</span>
          </span>
        </label>
        <button class="aud-play btn btn-ghost btn-sm" data-play="${t.id}" type="button">▶ 試聴</button>
        ${t.source === "local" ? `<button class="aud-del" data-del="${t.id}" type="button" title="削除">×</button>` : ""}
      `;
      bgmListEl.appendChild(li);
    });
    const cnt = $("#libCntAud");
    if (cnt) cnt.textContent = `${bgmTracks.length} 曲`;
    const sel = selectedTrack();
    setBgmStatus(sel ? `選択中: ${sel.name}` : "未選択");
  }

  if (bgmListEl) {
    bgmListEl.addEventListener("change", (e) => {
      const r = e.target.closest('input[name="bgmpick"]');
      if (!r) return;
      selectedBgmId = r.value;
      renderBgmList();
      const sel = selectedTrack();
      toast(sel ? `BGM「${sel.name}」を選択しました` : "");
    });
    bgmListEl.addEventListener("click", (e) => {
      const playBtn = e.target.closest("[data-play]");
      const delBtn  = e.target.closest("[data-del]");
      if (playBtn) {
        const id = playBtn.dataset.play;
        const t  = bgmTracks.find((x) => x.id === id);
        if (!t || !bgmAudio) return;
        if (!bgmAudio.paused && bgmAudio.dataset.playingId === id) {
          bgmAudio.pause();
          return;
        }
        bgmAudio.src = t.url;
        bgmAudio.dataset.playingId = id;
        bgmAudio.play().catch(() => toast("ブラウザ制約で再生できませんでした"));
      } else if (delBtn) {
        const id = delBtn.dataset.del;
        const i  = bgmTracks.findIndex((x) => x.id === id);
        if (i < 0) return;
        const t = bgmTracks[i];
        try { URL.revokeObjectURL(t.url); } catch {}
        bgmTracks.splice(i, 1);
        if (selectedBgmId === id) selectedBgmId = bgmTracks[0] ? bgmTracks[0].id : "";
        renderBgmList();
        toast("BGM を削除しました");
      }
    });
  }
  if (bgmAudio) {
    bgmAudio.addEventListener("play",  () => { /* could update per-row label */ });
    bgmAudio.addEventListener("pause", () => { bgmAudio.dataset.playingId = ""; });
    bgmAudio.addEventListener("ended", () => { bgmAudio.dataset.playingId = ""; });
  }

  // ---------- Library: Templates gallery ----------
  function templatePreviewCSS(p) {
    const c = palettes[p];
    return c ? c.base : "#1a2440";
  }
  function renderTemplateGallery() {
    const grid = $("#libGridTpl");
    if (!grid) return;
    grid.innerHTML = "";

    // 1) Built-in templates (palette-based)
    Object.keys(templates).forEach((key) => {
      const eff = effectiveTemplate(key);
      const isActive = state.template === key && !state.bgImage;
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = "lib-tile lib-tile-tpl" + (isActive ? " selected" : "");
      tile.dataset.tpl = key;
      tile.innerHTML = `
        <div class="tpl-prev" style="background:${templatePreviewCSS(eff.palette)}">
          <div class="tpl-prev-h">${eff.headline}</div>
          <div class="tpl-prev-s">${eff.subline}</div>
          <div class="tpl-prev-c">${eff.cta}</div>
        </div>
        <div class="tpl-tile-name">${eff.label}${hasOverride(key) ? ' <span class="tpl-edited">·編集済</span>' : ""}</div>
      `;
      tile.addEventListener("click", () => applyTemplate(key));
      grid.appendChild(tile);
    });

    // 2) User-uploaded templates
    userTemplates.forEach((u) => {
      const key = `user-${u.id}`;
      const eff = effectiveTemplate(key);
      const isActive = state.bgImage && state.bgImage.id === u.id;
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = "lib-tile lib-tile-tpl lib-tile-tpl-user" + (isActive ? " selected" : "");
      tile.dataset.userTpl = u.id;
      tile.innerHTML = `
        <div class="tpl-prev" style="background-image:url('${u.url}')">
          <div class="tpl-prev-dim"></div>
          <div class="tpl-prev-h">${eff.headline}</div>
          <div class="tpl-prev-s">${eff.subline}</div>
          <div class="tpl-prev-c">${eff.cta}</div>
        </div>
        <div class="tpl-tile-name" title="${u.label}">${u.label}${hasOverride(key) ? ' <span class="tpl-edited">·編集済</span>' : ""}</div>
        <button class="tpl-del" data-tpl-del="${u.id}" type="button" title="削除">×</button>
      `;
      tile.addEventListener("click", (e) => {
        if (e.target.closest("[data-tpl-del]")) return;
        applyUserTemplate(u.id);
      });
      grid.appendChild(tile);
    });

    // 3) "+ Add" tile
    const addTile = document.createElement("button");
    addTile.type = "button";
    addTile.className = "lib-tile lib-tile-add";
    addTile.innerHTML = `
      <div class="tpl-add-prev">
        <div class="tpl-add-icon">＋</div>
        <div class="tpl-add-text">画像を追加</div>
        <div class="tpl-add-sub">JPG / PNG / WebP</div>
      </div>
    `;
    addTile.addEventListener("click", () => tplFileInput.click());
    grid.appendChild(addTile);

    const cnt = $("#libCntTpl");
    if (cnt) cnt.textContent = `${Object.keys(templates).length + userTemplates.length} 種類`;
  }

  function applyTemplate(key) {
    const t = effectiveTemplate(key);
    if (!t) return;
    state.template = key;
    state.bgImage  = null;
    bgImageEl      = null;
    state.headline = t.headline;
    state.subline  = t.subline;
    state.cta      = t.cta;
    if (t.palette) state.palette = t.palette;
    fieldMap.headline.value = state.headline;
    fieldMap.subline.value  = state.subline;
    fieldMap.cta.value      = state.cta;
    $$(".pal").forEach((x) => x.classList.toggle("active", x.dataset.palette === state.palette));
    $$(".tpl-chip[data-tpl]").forEach((x) => x.classList.toggle("active", x.dataset.tpl === key));
    renderTemplateGallery();
    render();
    updateTplResetVisibility();
    toast(`テンプレ「${t.label || key}」を適用しました`);
  }

  function applyUserTemplate(id) {
    const u = userTemplates.find((x) => x.id === id);
    if (!u) return;
    const key = `user-${id}`;
    const eff = effectiveTemplate(key);
    state.bgImage = { id: u.id, url: u.url, name: u.label };
    state.template = key;
    if (eff) {
      state.headline = eff.headline;
      state.subline  = eff.subline;
      state.cta      = eff.cta;
      fieldMap.headline.value = state.headline;
      fieldMap.subline.value  = state.subline;
      fieldMap.cta.value      = state.cta;
    }
    // Preload for canvas export
    bgImageEl = new Image();
    bgImageEl.crossOrigin = "anonymous";
    bgImageEl.src = u.url;
    bgImageEl.onload = () => render();
    $$(".tpl-chip[data-tpl]").forEach((x) => x.classList.remove("active"));
    renderTemplateGallery();
    render();
    updateTplResetVisibility();
    toast(`画像テンプレ「${u.label}」を適用しました`);
  }

  // Hidden file input for template image upload (created once, multi-select)
  const tplFileInput = document.createElement("input");
  tplFileInput.type = "file";
  tplFileInput.accept = "image/*";
  tplFileInput.multiple = true;
  tplFileInput.style.display = "none";
  document.body.appendChild(tplFileInput);
  tplFileInput.addEventListener("change", () => {
    const files = Array.from(tplFileInput.files || []).filter((f) => f.type.startsWith("image/"));
    if (!files.length) return;
    let lastId = null;
    files.forEach((f) => {
      const id    = `usr-${++tplIdSeq}`;
      const url   = URL.createObjectURL(f);
      const label = f.name.replace(/\.[^.]+$/, "");
      // Capture current text as the user-template's defaults
      userTemplates.push({
        id, label, url,
        headline: state.headline,
        subline:  state.subline,
        cta:      state.cta,
      });
      lastId = id;
    });
    renderTemplateGallery();
    if (lastId) applyUserTemplate(lastId);
    tplFileInput.value = "";
    toast(`${files.length} 枚をテンプレ画像フォルダに追加しました`);
  });

  // Delete user-uploaded template
  document.addEventListener("click", (e) => {
    const del = e.target.closest("[data-tpl-del]");
    if (!del) return;
    e.preventDefault();
    e.stopPropagation();
    const id = del.dataset.tplDel;
    const i  = userTemplates.findIndex((x) => x.id === id);
    if (i < 0) return;
    try { URL.revokeObjectURL(userTemplates[i].url); } catch {}
    userTemplates.splice(i, 1);
    if (state.bgImage && state.bgImage.id === id) {
      state.bgImage = null;
      bgImageEl     = null;
    }
    renderTemplateGallery();
    render();
    toast("テンプレ画像を削除しました");
  });

  // ---------- Drag-to-position for offer / deadline / CTA ----------
  function bindElementDrag() {
    const pairs = [
      { sel: ".ad-headline", key: "headline" },
      { sel: ".ad-subline",  key: "subline"  },
      { sel: ".ad-cta",      key: "cta"      },
    ];
    $$(".size-card").forEach((card) => {
      pairs.forEach(({ sel, key }) => {
        const elem = card.querySelector(sel);
        if (!elem) return;
        elem.addEventListener("pointerdown", (e) => {
          if (e.button !== 0) return;
          // Don't fight text-selection inputs — but ad-stack has no inputs.
          e.preventDefault();
          const frame = elem.closest(".ad-frame");
          if (!frame) return;
          try { elem.setPointerCapture(e.pointerId); } catch {}
          elem.classList.add("dragging");
          const rect    = frame.getBoundingClientRect();
          const startX  = e.clientX, startY = e.clientY;
          const startPx = state.fine.layout[key].x;
          const startPy = state.fine.layout[key].y;

          const onMove = (ev) => {
            const dx = ((ev.clientX - startX) / rect.width)  * 100;
            const dy = ((ev.clientY - startY) / rect.height) * 100;
            state.fine.layout[key].x = clampN(startPx + dx, 2, 98);
            state.fine.layout[key].y = clampN(startPy + dy, 2, 98);
            applyFine();
          };
          const onUp = () => {
            elem.classList.remove("dragging");
            try { elem.releasePointerCapture(e.pointerId); } catch {}
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup",   onUp);
            window.removeEventListener("pointercancel", onUp);
          };
          window.addEventListener("pointermove", onMove);
          window.addEventListener("pointerup",   onUp);
          window.addEventListener("pointercancel", onUp);
        });
      });
    });
  }

  // ---------- Library: Fine-tune controls ----------
  function applyFine() {
    const F = state.fine;
    // CSS vars on each .ad-frame so live preview updates immediately
    $$(".ad-frame").forEach((f) => {
      f.style.setProperty("--text-scale", String(F.textScale));
      f.style.setProperty("--dim-amount", String(F.dimAmount));
      f.style.setProperty("--text-color", String(F.textColor));
      f.style.setProperty("--cta-bg",     String(F.ctaBg));
      f.style.setProperty("--cta-color",  String(F.ctaColor));
      f.dataset.shadow = F.shadow;
    });
    $$(".size-card").forEach((card) => {
      const stack = card.querySelector(".ad-stack");
      if (stack) {
        stack.dataset.pos = F.textPos;
        const L = F.layout || presetLayout(F.textPos);
        stack.style.setProperty("--h-x", L.headline.x + "%");
        stack.style.setProperty("--h-y", L.headline.y + "%");
        stack.style.setProperty("--s-x", L.subline.x + "%");
        stack.style.setProperty("--s-y", L.subline.y + "%");
        stack.style.setProperty("--c-x", L.cta.x + "%");
        stack.style.setProperty("--c-y", L.cta.y + "%");
      }
      const h = card.querySelector(".ad-headline");
      const s = card.querySelector(".ad-subline");
      const c = card.querySelector(".ad-cta");
      if (h) h.style.display = F.showHeadline ? "" : "none";
      if (s) s.style.display = F.showSubline  ? "" : "none";
      if (c) c.style.display = F.showCta      ? "" : "none";
    });
    // Auto-arrange button text reflects current target duration
    const arr = $("#autoArrangeBtn");
    if (arr) arr.textContent = `⚡ ${state.fine.duration} 秒に自動編集`;
    updateTotalMeta();
  }

  function syncTuneInputs() {
    const f = state.fine;
    const el = (id) => $("#" + id);
    if (el("tuneScale"))     el("tuneScale").value     = f.textScale;
    if (el("tuneScaleVal"))  el("tuneScaleVal").textContent  = `×${Number(f.textScale).toFixed(2)}`;
    if (el("tuneDim"))       el("tuneDim").value       = f.dimAmount;
    if (el("tuneDimVal"))    el("tuneDimVal").textContent    = `${Math.round(f.dimAmount * 100)}%`;
    if (el("tuneTextColor")) el("tuneTextColor").value = f.textColor;
    if (el("tuneTextColorVal")) el("tuneTextColorVal").textContent = f.textColor.toUpperCase();
    if (el("tuneCtaBg"))     el("tuneCtaBg").value     = f.ctaBg;
    if (el("tuneCtaBgVal"))  el("tuneCtaBgVal").textContent  = f.ctaBg.toUpperCase();
    if (el("tuneCtaColor"))  el("tuneCtaColor").value  = f.ctaColor;
    if (el("tuneCtaColorVal")) el("tuneCtaColorVal").textContent = f.ctaColor.toUpperCase();
    if (el("tuneShowH"))     el("tuneShowH").checked   = f.showHeadline;
    if (el("tuneShowS"))     el("tuneShowS").checked   = f.showSubline;
    if (el("tuneShowC"))     el("tuneShowC").checked   = f.showCta;
    $$("#tuneDurPills [data-dur]").forEach((b) => b.classList.toggle("active", Number(b.dataset.dur) === f.duration));
    $$("#tunePosPills [data-tpos]").forEach((b) => b.classList.toggle("active", b.dataset.tpos === f.textPos));
    $$("#tuneShadowPills [data-shadow]").forEach((b) => b.classList.toggle("active", b.dataset.shadow === f.shadow));
    $$("#tuneTransPills [data-trans]").forEach((b) => b.classList.toggle("active", b.dataset.trans === f.transition));
  }

  function bindTuneControls() {
    const setActive = (group, target) => $$(group).forEach((x) => x.classList.toggle("active", x === target));

    $$("#tuneDurPills [data-dur]").forEach((b) => {
      b.addEventListener("click", () => {
        state.fine.duration = Number(b.dataset.dur);
        setActive("#tuneDurPills [data-dur]", b);
        applyFine();
        if (clips.length) toast(`総尺を ${state.fine.duration}s に変更（自動編集ボタンで再分配できます）`);
      });
    });
    $$("#tunePosPills [data-tpos]").forEach((b) => {
      b.addEventListener("click", () => {
        state.fine.textPos = b.dataset.tpos;
        // Also snap individual element positions to the new preset
        state.fine.layout = presetLayout(state.fine.textPos);
        setActive("#tunePosPills [data-tpos]", b);
        applyFine();
      });
    });
    $("#layoutReset") && $("#layoutReset").addEventListener("click", () => {
      state.fine.layout = presetLayout(state.fine.textPos);
      applyFine();
      toast("レイアウトを初期に戻しました");
    });
    $$("#tuneShadowPills [data-shadow]").forEach((b) => {
      b.addEventListener("click", () => {
        state.fine.shadow = b.dataset.shadow;
        setActive("#tuneShadowPills [data-shadow]", b);
        applyFine();
      });
    });
    $$("#tuneTransPills [data-trans]").forEach((b) => {
      b.addEventListener("click", () => {
        state.fine.transition = b.dataset.trans;
        setActive("#tuneTransPills [data-trans]", b);
        applyFine();
        if (clips.length > 1) toast(`クリップ間エフェクトを「${b.textContent.trim()}」に変更しました`);
      });
    });
    const onScale = () => {
      state.fine.textScale = Number($("#tuneScale").value);
      $("#tuneScaleVal").textContent = `×${state.fine.textScale.toFixed(2)}`;
      applyFine();
    };
    const onDim = () => {
      state.fine.dimAmount = Number($("#tuneDim").value);
      $("#tuneDimVal").textContent = `${Math.round(state.fine.dimAmount * 100)}%`;
      applyFine();
    };
    $("#tuneScale") && $("#tuneScale").addEventListener("input", onScale);
    $("#tuneDim")   && $("#tuneDim").addEventListener("input", onDim);

    const colorBind = (inputId, valId, key) => {
      const i = $("#" + inputId), v = $("#" + valId);
      if (!i) return;
      i.addEventListener("input", () => {
        state.fine[key] = i.value;
        if (v) v.textContent = i.value.toUpperCase();
        applyFine();
      });
    };
    colorBind("tuneTextColor", "tuneTextColorVal", "textColor");
    colorBind("tuneCtaBg",     "tuneCtaBgVal",     "ctaBg");
    colorBind("tuneCtaColor",  "tuneCtaColorVal",  "ctaColor");

    $("#tuneShowH") && $("#tuneShowH").addEventListener("change", (e) => { state.fine.showHeadline = e.target.checked; applyFine(); });
    $("#tuneShowS") && $("#tuneShowS").addEventListener("change", (e) => { state.fine.showSubline  = e.target.checked; applyFine(); });
    $("#tuneShowC") && $("#tuneShowC").addEventListener("change", (e) => { state.fine.showCta      = e.target.checked; applyFine(); });

    $("#tuneReset") && $("#tuneReset").addEventListener("click", () => {
      state.fine = JSON.parse(JSON.stringify(fineDefaults));
      syncTuneInputs();
      applyFine();
      toast("詳細編集をリセットしました");
    });
  }

  // ---------- Export (Canvas + MediaRecorder + Web Audio) ----------
  let exporting = false;
  const epEl    = $("#exportProgress");
  const epLabel = $("#epLabel");
  const epFill  = $("#epFill");

  function showExportProgress(ratio, label) {
    if (!epEl) return;
    epEl.hidden = false;
    if (label && epLabel) epLabel.textContent = label;
    if (epFill) epFill.style.width = (Math.max(0, Math.min(1, ratio)) * 100).toFixed(1) + "%";
  }
  function hideExportProgress() {
    if (!epEl) return;
    epEl.hidden = true;
    if (epFill) epFill.style.width = "0%";
  }

  // BGM file upload → adds a new track to the library
  const bgmFileInput = $("#bgmFile");
  if (bgmFileInput) {
    bgmFileInput.addEventListener("change", async () => {
      const f = bgmFileInput.files && bgmFileInput.files[0];
      if (!f) return;
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const arr = await f.arrayBuffer();
        const buffer = await ctx.decodeAudioData(arr);
        try { await ctx.close(); } catch {}
        const id = `local-${++bgmIdSeq}`;
        bgmTracks.push({
          id, name: f.name, source: "local",
          url: URL.createObjectURL(f),
          buffer, exportable: true,
        });
        selectedBgmId = id;
        renderBgmList();
        toast(`BGM「${f.name}」を追加して選択しました`);
      } catch (e) {
        toast("BGM の読み込みに失敗しました");
      }
      bgmFileInput.value = "";
    });
  }

  async function loadBgmBufferForExport(audioCtx) {
    const t = selectedTrack();
    if (t && t.buffer) {
      const src = t.buffer;
      const buf = audioCtx.createBuffer(src.numberOfChannels, src.length, src.sampleRate);
      for (let ch = 0; ch < src.numberOfChannels; ch++) {
        buf.copyToChannel(src.getChannelData(ch), ch);
      }
      return buf;
    }
    if (t && t.source === "remote") {
      try {
        const res = await fetch(t.url, { mode: "cors" });
        if (!res.ok) throw new Error("fetch failed");
        const arr = await res.arrayBuffer();
        return await audioCtx.decodeAudioData(arr);
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  function pickRecorderMime() {
    if (typeof MediaRecorder === "undefined") return null;
    const candidates = [
      "video/mp4;codecs=h264,aac",
      "video/mp4;codecs=avc1,mp4a",
      "video/mp4",
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
    ];
    for (const m of candidates) {
      try { if (MediaRecorder.isTypeSupported(m)) return m; } catch {}
    }
    return "";
  }

  function downloadBlob(blob, name) {
    const a = document.createElement("a");
    const url = URL.createObjectURL(blob);
    a.href = url; a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function paletteBaseColors(name) {
    // approximation of the CSS palette used for fallback bg
    const map = {
      sunset: ["#1a2440", "#341a4a", "#4a1a3a"],
      ocean:  ["#003049", "#0077b6", "#00c8ff"],
      forest: ["#1a3a2f", "#2bb673", "#0a3a2a"],
      mono:   ["#0a0a0a", "#2a2a2a", "#0a0a0a"],
      candy:  ["#ff3a8c", "#ffd166", "#6f5cff"],
    };
    return map[name] || map.sunset;
  }

  function drawExportFrame(ctx, video, W, H, progress, trans) {
    trans = trans || { type: "cut", phase: "none", p: 0 };
    // 1) Background — user template image if available, else palette gradient
    if (bgImageEl && bgImageEl.complete && bgImageEl.naturalWidth) {
      const iw = bgImageEl.naturalWidth, ih = bgImageEl.naturalHeight;
      const sr = iw / ih, dr = W / H;
      let sx, sy, sw, sh;
      if (sr > dr) { sh = ih; sw = ih * dr; sx = (iw - sw) / 2; sy = 0; }
      else         { sw = iw; sh = iw / dr; sx = 0; sy = (ih - sh) / 2; }
      try { ctx.drawImage(bgImageEl, sx, sy, sw, sh, 0, 0, W, H); }
      catch { ctx.fillStyle = "#0a0e15"; ctx.fillRect(0, 0, W, H); }
    } else {
      const cols = paletteBaseColors(state.palette);
      const bg = ctx.createLinearGradient(0, 0, W, H);
      bg.addColorStop(0,   cols[0]);
      bg.addColorStop(0.6, cols[1]);
      bg.addColorStop(1,   cols[2]);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
    }

    // 2) Video cover-fit (with transition transform for slide / zoom)
    if (video && video.readyState >= 2 && video.videoWidth && video.videoHeight) {
      const vw = video.videoWidth, vh = video.videoHeight;
      const sr = vw / vh, dr = W / H;
      let sx, sy, sw, sh;
      if (sr > dr) { sh = vh; sw = vh * dr; sx = (vw - sw) / 2; sy = 0; }
      else         { sw = vw; sh = vw / dr; sx = 0; sy = (vh - sh) / 2; }

      let dx = 0, dy = 0, dw = W, dh = H, alpha = 1;
      if (trans.type === "slide" && trans.phase !== "none") {
        const sign = trans.phase === "out" ? -1 : +1;
        dx = sign * trans.p * W;
      } else if (trans.type === "zoom" && trans.phase !== "none") {
        const scale = 1 + trans.p * 0.25;
        dw = W * scale; dh = H * scale;
        dx = (W - dw) / 2; dy = (H - dh) / 2;
        alpha = 1 - trans.p * 0.85;
      }

      const prevAlpha = ctx.globalAlpha;
      if (alpha < 1) ctx.globalAlpha = alpha;
      try { ctx.drawImage(video, sx, sy, sw, sh, dx, dy, dw, dh); } catch {}
      ctx.globalAlpha = prevAlpha;
    }

    const F = state.fine;

    // 3) Bottom dim gradient for legibility (configurable opacity)
    const og = ctx.createLinearGradient(0, H * 0.35, 0, H);
    og.addColorStop(0, "rgba(0,0,0,0)");
    og.addColorStop(1, `rgba(0,0,0,${F.dimAmount})`);
    ctx.fillStyle = og;
    ctx.fillRect(0, 0, W, H);

    // 4) Text elements — each at its own (% of W, % of H) position
    const base   = Math.min(W, H);
    const layout = F.layout || presetLayout(F.textPos);
    const px = (p) => W * (p / 100);
    const py = (p) => H * (p / 100);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = F.textColor;
    if (F.shadow === "none") {
      ctx.shadowColor = "rgba(0,0,0,0)"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    } else {
      const strong = F.shadow === "strong";
      ctx.shadowColor   = strong ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.4)";
      ctx.shadowBlur    = base * (strong ? 0.025 : 0.015);
      ctx.shadowOffsetY = base * (strong ? 0.006 : 0.003);
    }

    const sc    = F.textScale;
    const hSize = Math.round(base * 0.105 * sc);
    const sSize = Math.round(base * 0.045 * sc);
    const cSize = Math.round(base * 0.038 * sc);

    if (F.showHeadline) {
      ctx.font = `900 ${hSize}px "Hiragino Sans","Yu Gothic","Noto Sans JP",system-ui,sans-serif`;
      ctx.fillText(state.headline || "", px(layout.headline.x), py(layout.headline.y));
    }
    if (F.showSubline) {
      ctx.font = `600 ${sSize}px "Hiragino Sans","Yu Gothic","Noto Sans JP",system-ui,sans-serif`;
      ctx.fillText(state.subline || "", px(layout.subline.x), py(layout.subline.y));
    }

    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    if (F.showCta) {
      ctx.font = `800 ${cSize}px "Hiragino Sans","Yu Gothic","Noto Sans JP",system-ui,sans-serif`;
      const cText  = state.cta || "";
      const tw     = ctx.measureText(cText).width;
      const padX   = cSize * 1.4;
      const padY   = cSize * 0.7;
      const pillW  = tw + padX * 2;
      const pillH  = cSize + padY * 2;
      const cxc    = px(layout.cta.x);
      const cyc    = py(layout.cta.y);
      const pillX  = cxc - pillW / 2;
      const pillY  = cyc - pillH / 2;
      const r      = pillH / 2;
      ctx.fillStyle = F.ctaBg;
      ctx.beginPath();
      ctx.moveTo(pillX + r, pillY);
      ctx.arcTo(pillX + pillW, pillY, pillX + pillW, pillY + r, r);
      ctx.arcTo(pillX + pillW, pillY + pillH, pillX + pillW - r, pillY + pillH, r);
      ctx.arcTo(pillX, pillY + pillH, pillX, pillY + pillH - r, r);
      ctx.arcTo(pillX, pillY, pillX + r, pillY, r);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = F.ctaColor;
      ctx.fillText(cText, cxc, cyc + cSize * 0.05);
    }

    // 5) Progress bar at bottom
    const barH = Math.max(3, Math.round(H * 0.005));
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(0, H - barH, W, barH);
    const pg = ctx.createLinearGradient(0, 0, W, 0);
    pg.addColorStop(0, "#00c8ff");
    pg.addColorStop(1, "#6f5cff");
    ctx.fillStyle = pg;
    ctx.fillRect(0, H - barH, W * Math.max(0, Math.min(1, progress)), barH);

    // 6) Final fade-through-black overlay (only for "fade" transition)
    if (trans.type === "fade" && trans.phase !== "none" && trans.p > 0) {
      ctx.fillStyle = `rgba(0,0,0,${trans.p})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  async function encodeOne(W, H, label, onProgress) {
    const mime = pickRecorderMime();
    if (mime === null) throw new Error("このブラウザは MediaRecorder に対応していません");

    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");
    drawExportFrame(ctx, null, W, H, 0); // prime first frame

    // Two source videos for dual-buffering — eliminates load gap between clips
    const srcA = document.createElement("video");
    const srcB = document.createElement("video");
    [srcA, srcB].forEach((v) => {
      v.muted = true; v.playsInline = true; v.preload = "auto";
    });
    let frontSrc = srcA, backSrc = srcB;

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") { try { await audioCtx.resume(); } catch {} }
    const audioDest = audioCtx.createMediaStreamDestination();
    const bgmBuf = await loadBgmBufferForExport(audioCtx);
    let bgmNode = null;
    if (bgmBuf) {
      bgmNode = audioCtx.createBufferSource();
      bgmNode.buffer = bgmBuf;
      bgmNode.loop   = true;
      const g = audioCtx.createGain();
      g.gain.value = 0.85;
      bgmNode.connect(g).connect(audioDest);
    } else {
      // silent track to keep the recorder happy
      const osc  = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      gain.gain.value = 0.0001;
      osc.connect(gain).connect(audioDest);
      osc.start();
    }

    const stream = new MediaStream();
    canvas.captureStream(30).getVideoTracks().forEach((t) => stream.addTrack(t));
    audioDest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));

    const recorder = mime
      ? new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 })
      : new MediaRecorder(stream, { videoBitsPerSecond: 6_000_000 });
    const chunks = [];
    recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };

    const totalSec = totalLength();
    let elapsed = 0;
    let i = 0;
    let raf = 0;

    return new Promise((resolve, reject) => {
      recorder.onerror = (e) => reject(e.error || new Error("recorder error"));
      recorder.onstop = () => {
        cancelAnimationFrame(raf);
        try { audioCtx.close(); } catch {}
        const outMime = recorder.mimeType || mime || "video/webm";
        resolve(new Blob(chunks, { type: outMime }));
      };

      // Load a clip into a video element and resolve when its first frame is ready.
      const loadInto = (v, c) => new Promise((res) => {
        if (v.src !== c.url) v.src = c.url;
        const ready = () => { try { v.currentTime = c.in; } catch {}; res(); };
        if (v.readyState >= 1) ready();
        else v.addEventListener("loadedmetadata", ready, { once: true });
      });

      const finish = () => {
        try { frontSrc.pause(); } catch {}
        try { backSrc.pause(); } catch {}
        try { bgmNode && bgmNode.stop(); } catch {}
        try { recorder.state !== "inactive" && recorder.stop(); } catch {}
      };

      const drawLoop = () => {
        const c = clips[i] || clips[clips.length - 1];
        const local = c ? Math.max(0, frontSrc.currentTime - c.in) : 0;
        const used  = c ? Math.min(local, c.out - c.in) : 0;
        const ratio = totalSec ? (elapsed + used) / totalSec : 0;

        // Compute transition phase for this frame
        const trans = { type: state.fine.transition || "cut", phase: "none", p: 0 };
        if (c && trans.type !== "cut") {
          const cLen = c.out - c.in;
          if (cLen > TRANSITION_DUR * 2.2) {
            const remaining = cLen - local;
            if (i < clips.length - 1 && remaining < TRANSITION_DUR) {
              trans.phase = "out";
              trans.p = Math.max(0, Math.min(1, 1 - (remaining / TRANSITION_DUR)));
            } else if (i > 0 && local < TRANSITION_DUR) {
              trans.phase = "in";
              trans.p = Math.max(0, Math.min(1, 1 - (local / TRANSITION_DUR)));
            }
          }
        }

        drawExportFrame(ctx, frontSrc, W, H, ratio, trans);

        // Boundary check + dual-buffer swap
        if (c && frontSrc.currentTime >= c.out - 0.04) {
          elapsed += (c.out - c.in);
          onProgress(Math.min(1, elapsed / totalSec), label);
          i++;
          if (i >= clips.length) {
            finish();
            return;
          }
          // Swap buffers — backSrc was preloaded with clips[i] already
          const tmp = frontSrc; frontSrc = backSrc; backSrc = tmp;
          frontSrc.play().catch(() => {});
          try { backSrc.pause(); } catch {}
          // Preload clips[i+1] into the new back buffer (if any)
          if (clips[i + 1]) loadInto(backSrc, clips[i + 1]);
        }

        raf = requestAnimationFrame(drawLoop);
      };

      (async () => {
        try {
          // Initial preload: clip 0 in front, clip 1 in back
          await loadInto(srcA, clips[0]);
          if (clips[1]) loadInto(srcB, clips[1]); // background, don't await
          recorder.start(250);
          if (bgmNode) bgmNode.start();
          frontSrc.play().catch(() => {});
          drawLoop();
        } catch (err) {
          reject(err);
        }
      })();
    });
  }

  async function exportAll() {
    if (exporting) { toast("書き出し中です。完了までお待ちください"); return; }
    if (typeof MediaRecorder === "undefined") {
      toast("このブラウザは動画書き出しに対応していません（Chrome / Edge / Safari 推奨）");
      return;
    }
    if (!clips.length) { toast("先にクリップを取り込んでください"); return; }
    const sizes = Object.keys(state.enabledSizes).filter((k) => state.enabledSizes[k]);
    if (!sizes.length) { toast("書き出すサイズが選択されていません"); return; }

    exporting = true;
    stopStitched();
    showExportProgress(0, "準備中…");
    try {
      for (let s = 0; s < sizes.length; s++) {
        const size  = sizes[s];
        const W     = 1080;
        const H     = size === "9:16" ? 1920 : 1080;
        const label = `${W}×${H} を書き出し中…`;
        showExportProgress(0, label);
        const blob = await encodeOne(W, H, label, (r, lbl) => {
          // weight progress across sizes
          const overall = (s + r) / sizes.length;
          showExportProgress(overall, lbl);
        });
        const ext = (blob.type || "").includes("mp4") ? "mp4" : "webm";
        downloadBlob(blob, `adcut_${W}x${H}.${ext}`);
      }
      showExportProgress(1, "完了");
      toast(`書き出し完了: ${sizes.length} サイズをダウンロードしました`);
    } catch (err) {
      console.error(err);
      toast("書き出しに失敗しました: " + (err && err.message ? err.message : "不明なエラー"));
    } finally {
      exporting = false;
      setTimeout(hideExportProgress, 800);
    }
  }

  $("#exportAll").addEventListener("click", () => { exportAll(); });

  $("#duplicateBtn").addEventListener("click", () => {
    state.enabledSizes["1:1"]  = true;
    state.enabledSizes["9:16"] = true;
    $$('.chk input[type="checkbox"]').forEach((cb) => (cb.checked = true));
    render();
    flashAll();
    toast("1080×1080 / 1080×1920 に自動複製しました");
  });

  // Premiere Pro / After Effects buttons remain demo (project-file export needs server-side templating)
  $("#exportPpro").addEventListener("click", () => {
    toast("Premiere Pro (.prproj) の書き出しはデモです。MP4 書き出しをご利用ください");
    flashAll();
  });
  $("#exportAe").addEventListener("click", () => {
    toast("After Effects (.aep) の書き出しはデモです。MP4 書き出しをご利用ください");
    flashAll();
  });

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
  // Reset just the active template's text overrides
  const tplTextResetBtn = $("#tplTextReset");
  if (tplTextResetBtn) {
    tplTextResetBtn.addEventListener("click", () => {
      const tk = state.template;
      if (!tk || !templateOverrides[tk]) return;
      delete templateOverrides[tk];
      // Re-apply the template (built-in or user) to refresh fields
      if (templates[tk]) applyTemplate(tk);
      else if (typeof tk === "string" && tk.startsWith("user-")) applyUserTemplate(tk.slice(5));
      toast("このテンプレの文言を初期値に戻しました");
    });
  }

  $("#resetBtn").addEventListener("click", () => {
    Object.assign(state, JSON.parse(JSON.stringify(defaults)));
    bgImageEl = null;
    // Clear all per-template text overrides
    Object.keys(templateOverrides).forEach((k) => delete templateOverrides[k]);
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
    renderTemplateGallery();
    syncTuneInputs();
    applyFine();
    updateTplResetVisibility();
    render();
    toast("初期状態にリセットしました");
  });

  // ---------- BGM playback (selected track) ----------
  function playBgm() {
    if (!bgmAudio) return;
    const t = selectedTrack();
    if (!t) return;
    if (bgmAudio.src !== t.url) bgmAudio.src = t.url;
    const p = bgmAudio.play();
    if (p && p.catch) {
      p.catch(() => toast("BGM を直接再生できませんでした"));
    }
  }
  function stopBgm() { if (bgmAudio) bgmAudio.pause(); }

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
  renderTemplateGallery();
  renderBgmList();
  bindTuneControls();
  bindElementDrag();
  syncTuneInputs();
  applyFine();
  updateTplResetVisibility();
  updateTotalMeta();
  render();
})();
