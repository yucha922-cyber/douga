// AdCut Studio — Quick create demo
(() => {
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  // ---------- State ----------
  const FONT_STACKS = {
    gothic:  '"Hiragino Sans","Yu Gothic","Noto Sans JP","Hiragino Kaku Gothic ProN",system-ui,sans-serif',
    mincho:  '"Hiragino Mincho ProN","Yu Mincho","Sawarabi Mincho","Noto Serif JP",serif',
    maru:    '"Hiragino Maru Gothic ProN","Hiragino Maru Gothic Pro","M PLUS Rounded 1c","Yu Gothic",sans-serif',
    impact:  '"Impact","Anton","Helvetica Inserat","Hiragino Sans","Yu Gothic",sans-serif',
    cursive: '"Klee","Klee One","Sawarabi Mincho","Yu Mincho",cursive',
    system:  'system-ui,-apple-system,sans-serif',
  };
  const FONT_LABELS = {
    gothic:  "ゴシック",
    mincho:  "明朝",
    maru:    "丸ゴシック",
    impact:  "インパクト",
    cursive: "手書き",
    system:  "システム",
  };

  const fineDefaults = {
    duration:    15,
    textPos:     "center",
    layout: {
      headline: { x: 50, y: 42 },
      subline:  { x: 50, y: 54 },
      cta:      { x: 50, y: 70 },
    },
    textScale:   1.0,
    dimAmount:   0.55,
    textColor:   "#ffffff",
    strokeColor: "#000000",
    strokeWidth: 0,           // 0..8 (px in preview, scaled for export)
    ctaBg:       "#ffffff",
    ctaColor:    "#0e1218",
    shadow:      "strong",
    transition:  "dissolve",
    fontFamily:  "gothic",
    showHeadline:true,
    showSubline: true,
    showCta:     true,
  };

  // ---------- Captions (time-bound text overlays) ----------
  /** @type {{id:string,text:string,startSec:number,endSec:number,x:number,y:number,fontSize:number,color:string,strokeColor:string,strokeWidth:number,fontFamily:string,enterAnim:string}[]} */
  const captions = [];
  let capIdSeq = 0;
  const CAPTION_ANIMS = {
    "none":       "なし",
    "fade":       "フェード",
    "slide-up":   "下からスライド",
    "slide-down": "上からスライド",
    "slide-left": "右からスライド",
    "slide-right":"左からスライド",
    "scale":      "拡大",
    "pop":        "ポップ",
  };
  const CAPTION_ENTER_DUR = 0.35; // seconds

  function captionFactory(overrides) {
    const def = {
      id:          `cap-${++capIdSeq}`,
      text:        "テキスト",
      startSec:    0,
      endSec:      Math.min(3, state.fine ? state.fine.duration : 15),
      x:           50,
      y:           80,
      fontSize:    1.0,
      color:       "#ffffff",
      strokeColor: "#0e1218",
      strokeWidth: 2,
      fontFamily:  "gothic",
      enterAnim:   "fade",
    };
    return Object.assign(def, overrides || {});
  }
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
    // Restore caption visibility for editing
    updateCaptionsForTime(0, false);
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
      // "cut" = no animation; "dissolve" relies on CSS opacity transition driven by .active swap
      if (type === "cut" || type === "dissolve") return;
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
        const usedSoFar = cumPrev + Math.min(local, totals[i]);
        const ratio = grandTotal ? usedSoFar / grandTotal : 0;
        setProgress(ratio);
        updateCaptionsForTime(usedSoFar, true);
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
          // Capture references BEFORE flipping bufIdx
          const oldFrontVids = front().slice();   // these will fade out
          const newFrontVids = back().slice();    // already preloaded with seq[i]
          const isDissolve   = (state.fine.transition === "dissolve");

          // Make sure the new front begins playing
          newFrontVids.forEach((nv) => {
            const playNow = () => nv.play().catch(() => {});
            if (nv.readyState >= 2) playNow();
            else nv.addEventListener("loadeddata", playNow, { once: true });
          });

          if (isDissolve) {
            // === Cross-dissolve (rAF-driven, no black) ===
            // Swap .active class so subsequent state is consistent, but
            // override opacity inline during the blend.
            bufIdx = 1 - bufIdx;
            showFront();
            // Force initial opacities right at the boundary
            oldFrontVids.forEach((v) => { v.style.transition = "none"; v.style.opacity = "1"; });
            newFrontVids.forEach((v) => { v.style.transition = "none"; v.style.opacity = "0"; });

            const startMs = performance.now();
            const DUR_MS  = TRANSITION_DUR * 1000;
            const tick = () => {
              if (!playState) return;
              const t = Math.min(1, (performance.now() - startMs) / DUR_MS);
              oldFrontVids.forEach((v) => { v.style.opacity = String(1 - t); });
              newFrontVids.forEach((v) => { v.style.opacity = String(t); });
              if (t < 1) requestAnimationFrame(tick);
              else {
                // Done — clear inline overrides and pause/preload behind the scenes
                oldFrontVids.forEach((v) => { v.style.opacity = ""; v.style.transition = ""; try { v.pause(); } catch {} });
                newFrontVids.forEach((v) => { v.style.opacity = ""; v.style.transition = ""; });
                if (seq[i + 1]) loadInto(back(), seq[i + 1], false);
              }
            };
            requestAnimationFrame(tick);
          } else {
            // === Other transitions: instant swap, optional keyframe animation ===
            bufIdx = 1 - bufIdx;
            showFront();
            oldFrontVids.forEach((v) => { try { v.pause(); } catch {} });
            if (seq[i + 1]) loadInto(back(), seq[i + 1], false);
            scheduleTransitionForClip(i);
          }
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

  // ---------- Library: Captions (timed text overlays) ----------
  const capListEl = $("#captionList");

  function escAttr(s) { return String(s).replace(/"/g, "&quot;"); }
  function escHtml(s) { return String(s).replace(/[&<>]/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;" }[c])); }

  function renderCaptionList() {
    if (!capListEl) return;
    capListEl.innerHTML = "";
    captions.forEach((c) => {
      const animOpts = Object.entries(CAPTION_ANIMS)
        .map(([k, label]) => `<option value="${k}" ${c.enterAnim === k ? "selected" : ""}>${label}</option>`).join("");
      const fontOpts = Object.entries(FONT_LABELS)
        .map(([k, label]) => `<option value="${k}" ${c.fontFamily === k ? "selected" : ""}>${label}</option>`).join("");
      const row = document.createElement("div");
      row.className = "caption-row";
      row.dataset.capId = c.id;
      row.innerHTML = `
        <div class="cap-line cap-line-1">
          <input class="cap-text" type="text" value="${escAttr(c.text)}" placeholder="テキスト" />
          <button class="cap-del" data-cap-del="${c.id}" type="button" title="削除">×</button>
        </div>
        <div class="cap-line cap-line-2">
          <label>開始 <input class="cap-start" type="number" min="0" step="0.5" value="${c.startSec}" /> s</label>
          <label>終了 <input class="cap-end"   type="number" min="0" step="0.5" value="${c.endSec}" /> s</label>
          <label>登場 <select class="cap-anim">${animOpts}</select></label>
        </div>
        <div class="cap-line cap-line-3">
          <label class="cap-color-wrap">色 <input class="cap-color" type="color" value="${c.color}" /></label>
          <label class="cap-color-wrap">縁 <input class="cap-stroke-color" type="color" value="${c.strokeColor}" /></label>
          <label>枠 <input class="cap-stroke-w" type="range" min="0" max="8" step="0.5" value="${c.strokeWidth}" /></label>
          <label>大 <input class="cap-size" type="range" min="0.5" max="2.2" step="0.05" value="${c.fontSize}" /></label>
          <select class="cap-font">${fontOpts}</select>
        </div>
      `;
      capListEl.appendChild(row);
    });
    const cnt = $("#libCntCap");
    if (cnt) cnt.textContent = `${captions.length} 件`;
  }

  function captionElById(id) { return captions.find((c) => c.id === id); }

  function applyCaptionStyle(el, c) {
    el.style.left   = c.x + "%";
    el.style.top    = c.y + "%";
    el.style.color  = c.color;
    el.style.fontFamily = FONT_STACKS[c.fontFamily] || FONT_STACKS.gothic;
    el.style.fontSize   = `calc(clamp(11px, 4cqw, 28px) * ${c.fontSize})`;
    if (c.strokeWidth > 0) {
      el.style.webkitTextStroke = `${c.strokeWidth}px ${c.strokeColor}`;
      el.style.textStroke       = `${c.strokeWidth}px ${c.strokeColor}`;
    } else {
      el.style.webkitTextStroke = "";
      el.style.textStroke       = "";
    }
    el.textContent = c.text;
  }

  function renderCaptionsDOM() {
    $$(".size-card").forEach((card) => {
      const stack = card.querySelector(".ad-stack");
      if (!stack) return;
      // Remove existing caption nodes in this stack
      stack.querySelectorAll(".ad-caption").forEach((n) => n.remove());
      // Add fresh nodes (one per caption)
      captions.forEach((c) => {
        const el = document.createElement("div");
        el.className = "ad-caption";
        el.dataset.capId = c.id;
        applyCaptionStyle(el, c);
        stack.appendChild(el);
        bindCaptionDrag(el, c.id);
      });
    });
  }

  function bindCaptionDrag(elem, id) {
    elem.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const c = captionElById(id);
      if (!c) return;
      const frame = elem.closest(".ad-frame");
      if (!frame) return;
      try { elem.setPointerCapture(e.pointerId); } catch {}
      elem.classList.add("dragging");
      const rect    = frame.getBoundingClientRect();
      const startX  = e.clientX, startY = e.clientY;
      const startPx = c.x, startPy = c.y;
      const onMove = (ev) => {
        const dx = ((ev.clientX - startX) / rect.width)  * 100;
        const dy = ((ev.clientY - startY) / rect.height) * 100;
        c.x = clampN(startPx + dx, 2, 98);
        c.y = clampN(startPy + dy, 2, 98);
        $$(".ad-stack .ad-caption[data-cap-id='" + id + "']").forEach((el) => {
          el.style.left = c.x + "%"; el.style.top = c.y + "%";
        });
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
  }

  // Drive caption visibility + entrance animations from the playback timeline
  function updateCaptionsForTime(globalT, isPlaying) {
    $$(".size-card").forEach((card) => {
      card.querySelectorAll(".ad-caption").forEach((el) => {
        const c = captionElById(el.dataset.capId);
        if (!c) return;
        if (!isPlaying) {
          // Idle: keep all visible (semi) so user can edit / drag
          el.style.display = "";
          el.style.opacity = "0.85";
          el.style.transform = "translate(-50%, -50%)";
          return;
        }
        const inRange = globalT >= c.startSec && globalT <= c.endSec;
        if (!inRange) { el.style.display = "none"; return; }
        el.style.display = "";
        const tIn = Math.max(0, globalT - c.startSec);
        if (tIn < CAPTION_ENTER_DUR && c.enterAnim !== "none") {
          const p = tIn / CAPTION_ENTER_DUR;
          const eased = 1 - Math.pow(1 - p, 3);
          let tx = "-50%", ty = "-50%", scale = 1, alpha = 1;
          switch (c.enterAnim) {
            case "fade":        alpha = eased; break;
            case "slide-up":    alpha = eased; ty = `calc(-50% + ${(1 - eased) * 24}%)`; break;
            case "slide-down":  alpha = eased; ty = `calc(-50% - ${(1 - eased) * 24}%)`; break;
            case "slide-left":  alpha = eased; tx = `calc(-50% + ${(1 - eased) * 24}%)`; break;
            case "slide-right": alpha = eased; tx = `calc(-50% - ${(1 - eased) * 24}%)`; break;
            case "scale":       alpha = eased; scale = 0.7 + 0.3 * eased; break;
            case "pop":         alpha = eased; scale = 0.4 + 0.6 * (1 - Math.pow(1 - p, 4)) + 0.05 * Math.sin(p * Math.PI * 2); break;
          }
          el.style.opacity   = String(alpha);
          el.style.transform = `translate(${tx}, ${ty}) scale(${scale})`;
        } else {
          el.style.opacity   = "1";
          el.style.transform = "translate(-50%, -50%)";
        }
      });
    });
  }

  function addCaption(over) {
    captions.push(captionFactory(over));
    renderCaptionList();
    renderCaptionsDOM();
    updateCaptionsForTime(0, false);
    return captions[captions.length - 1];
  }
  function deleteCaption(id) {
    const i = captions.findIndex((c) => c.id === id);
    if (i < 0) return;
    captions.splice(i, 1);
    renderCaptionList();
    renderCaptionsDOM();
  }

  function autoGenerateCaptions() {
    const dur = state.fine.duration || 15;
    if (!captions.length) {
      toast("タイムラインにテキストを追加してから自動配置してください");
      return;
    }
    const each = dur / captions.length;
    captions.forEach((c, i) => {
      c.startSec = +(i * each).toFixed(2);
      c.endSec   = +Math.min(dur, (i + 1) * each).toFixed(2);
    });
    renderCaptionList();
    renderCaptionsDOM();
    updateCaptionsForTime(0, false);
    toast(`${captions.length} 件のテキストの表示タイミングを均等に割り振りました`);
  }

  // Wire caption list edits + folder buttons
  function bindCaptionControls() {
    if (capListEl) {
      capListEl.addEventListener("input", (e) => {
        const row = e.target.closest(".caption-row");
        if (!row) return;
        const id = row.dataset.capId;
        const c = captionElById(id);
        if (!c) return;
        const t = e.target;
        if (t.classList.contains("cap-text"))         c.text = t.value;
        else if (t.classList.contains("cap-start"))   c.startSec = Math.max(0, Number(t.value) || 0);
        else if (t.classList.contains("cap-end"))     c.endSec   = Math.max(0, Number(t.value) || 0);
        else if (t.classList.contains("cap-color"))   c.color = t.value;
        else if (t.classList.contains("cap-stroke-color")) c.strokeColor = t.value;
        else if (t.classList.contains("cap-stroke-w"))     c.strokeWidth = Number(t.value);
        else if (t.classList.contains("cap-size"))         c.fontSize    = Number(t.value);
        // Apply visual update to all stacks
        $$(".ad-stack .ad-caption[data-cap-id='" + id + "']").forEach((el) => applyCaptionStyle(el, c));
      });
      capListEl.addEventListener("change", (e) => {
        const row = e.target.closest(".caption-row");
        if (!row) return;
        const id = row.dataset.capId;
        const c = captionElById(id);
        if (!c) return;
        const t = e.target;
        if (t.classList.contains("cap-anim")) c.enterAnim = t.value;
        else if (t.classList.contains("cap-font")) {
          c.fontFamily = t.value;
          $$(".ad-stack .ad-caption[data-cap-id='" + id + "']").forEach((el) => applyCaptionStyle(el, c));
        }
      });
      capListEl.addEventListener("click", (e) => {
        const del = e.target.closest("[data-cap-del]");
        if (del) { deleteCaption(del.dataset.capDel); }
      });
    }
    $("#captionAdd")     && $("#captionAdd").addEventListener("click", () => {
      const c = addCaption();
      toast("テキストを追加しました");
      // Focus the text input of the just-added row
      const row = capListEl && capListEl.querySelector(`.caption-row[data-cap-id='${c.id}'] .cap-text`);
      row && row.focus();
    });
    $("#captionAutoGen") && $("#captionAutoGen").addEventListener("click", autoGenerateCaptions);
    $("#captionClear")   && $("#captionClear").addEventListener("click", () => {
      if (!captions.length) return;
      captions.length = 0;
      renderCaptionList();
      renderCaptionsDOM();
      toast("テキストを全消去しました");
    });
  }

  // ---------- Library: Fine-tune controls ----------
  function applyFine() {
    const F = state.fine;
    // CSS vars on each .ad-frame so live preview updates immediately
    $$(".ad-frame").forEach((f) => {
      f.style.setProperty("--text-scale",   String(F.textScale));
      f.style.setProperty("--dim-amount",   String(F.dimAmount));
      f.style.setProperty("--text-color",   String(F.textColor));
      f.style.setProperty("--stroke-color", String(F.strokeColor));
      f.style.setProperty("--stroke-w",     String(F.strokeWidth));
      f.style.setProperty("--cta-bg",       String(F.ctaBg));
      f.style.setProperty("--cta-color",    String(F.ctaColor));
      f.style.setProperty("--font-stack",   FONT_STACKS[F.fontFamily] || FONT_STACKS.gothic);
      f.dataset.shadow = F.shadow;
      f.dataset.trans  = F.transition;
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
    if (el("tuneStrokeColor")) el("tuneStrokeColor").value = f.strokeColor;
    if (el("tuneStrokeColorVal")) el("tuneStrokeColorVal").textContent = f.strokeColor.toUpperCase();
    if (el("tuneStrokeW"))   el("tuneStrokeW").value   = f.strokeWidth;
    if (el("tuneStrokeWVal"))el("tuneStrokeWVal").textContent = String(f.strokeWidth);
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
    $$("#tuneFontPills [data-font]").forEach((b) => b.classList.toggle("active", b.dataset.font === f.fontFamily));
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
    $$("#tuneFontPills [data-font]").forEach((b) => {
      b.addEventListener("click", () => {
        state.fine.fontFamily = b.dataset.font;
        setActive("#tuneFontPills [data-font]", b);
        applyFine();
        toast(`フォントを「${FONT_LABELS[state.fine.fontFamily] || state.fine.fontFamily}」に変更しました`);
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
    colorBind("tuneTextColor",   "tuneTextColorVal",   "textColor");
    colorBind("tuneStrokeColor", "tuneStrokeColorVal", "strokeColor");
    colorBind("tuneCtaBg",       "tuneCtaBgVal",       "ctaBg");
    colorBind("tuneCtaColor",    "tuneCtaColorVal",    "ctaColor");

    $("#tuneStrokeW") && $("#tuneStrokeW").addEventListener("input", (e) => {
      state.fine.strokeWidth = Number(e.target.value);
      $("#tuneStrokeWVal").textContent = String(state.fine.strokeWidth);
      applyFine();
    });

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

  function drawCaptionsOnCanvas(ctx, W, H, globalT) {
    const base = Math.min(W, H);
    captions.forEach((c) => {
      if (globalT < c.startSec || globalT > c.endSec) return;
      const tIn = Math.max(0, globalT - c.startSec);
      const inDur = CAPTION_ENTER_DUR;
      let alpha = 1, dx = 0, dy = 0, scale = 1;
      if (tIn < inDur && c.enterAnim !== "none") {
        const p = tIn / inDur;
        const eased = 1 - Math.pow(1 - p, 3);
        switch (c.enterAnim) {
          case "fade":        alpha = eased; break;
          case "slide-up":    alpha = eased; dy =  (1 - eased) * H * 0.05; break;
          case "slide-down":  alpha = eased; dy = -(1 - eased) * H * 0.05; break;
          case "slide-left":  alpha = eased; dx =  (1 - eased) * W * 0.05; break;
          case "slide-right": alpha = eased; dx = -(1 - eased) * W * 0.05; break;
          case "scale":       alpha = eased; scale = 0.7 + 0.3 * eased; break;
          case "pop":         alpha = eased; scale = 0.4 + 0.6 * (1 - Math.pow(1 - p, 4)); break;
        }
      }
      const cx = (c.x / 100) * W + dx;
      const cy = (c.y / 100) * H + dy;
      const fontStack = FONT_STACKS[c.fontFamily] || FONT_STACKS.gothic;
      const size = Math.round(base * 0.06 * (c.fontSize || 1));

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(cx, cy);
      if (scale !== 1) ctx.scale(scale, scale);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `700 ${size}px ${fontStack}`;
      // Outline
      const strokeScale = base / 540;
      const sw = (c.strokeWidth || 0) * strokeScale;
      if (sw > 0) {
        ctx.lineWidth   = sw * 1.6;
        ctx.strokeStyle = c.strokeColor;
        ctx.lineJoin    = "round";
        ctx.miterLimit  = 2;
        ctx.strokeText(c.text || "", 0, 0);
      }
      ctx.fillStyle = c.color;
      ctx.fillText(c.text || "", 0, 0);
      ctx.restore();
    });
  }

  function drawExportFrame(ctx, video, W, H, progress, trans, backVideo, globalT) {
    trans = trans || { type: "cut", phase: "none", p: 0 };
    // 1) Background gradient — always rendered so transparent / partial templates
    //    don't reveal raw black canvas. Template image is drawn LAST (frontmost).
    {
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

    // 2b) Cross dissolve overlay: during "in" phase of dissolve, the previous
    //     clip (backVideo) keeps playing and is drawn on top of the new front
    //     with alpha = trans.p (1 → 0), producing a smooth A→B blend with no black.
    if (trans.type === "dissolve" && trans.phase === "in" && backVideo &&
        backVideo.readyState >= 2 && backVideo.videoWidth && backVideo.videoHeight) {
      const bvw = backVideo.videoWidth, bvh = backVideo.videoHeight;
      const sr = bvw / bvh, dr = W / H;
      let sx, sy, sw, sh;
      if (sr > dr) { sh = bvh; sw = bvh * dr; sx = (bvw - sw) / 2; sy = 0; }
      else         { sw = bvw; sh = bvw / dr; sx = 0; sy = (bvh - sh) / 2; }
      const prevAlpha = ctx.globalAlpha;
      ctx.globalAlpha = trans.p;
      try { ctx.drawImage(backVideo, sx, sy, sw, sh, 0, 0, W, H); } catch {}
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
    const exportFontStack = FONT_STACKS[F.fontFamily] || FONT_STACKS.gothic;
    const sSize = Math.round(base * 0.045 * sc);
    const cSize = Math.round(base * 0.038 * sc);

    // Stroke / outline scale relative to canvas size so it matches the live preview
    const strokeScale = base / 540;
    const exportStrokeW = (F.strokeWidth || 0) * strokeScale;

    if (F.showHeadline) {
      ctx.font = `900 ${hSize}px ${exportFontStack}`;
      const hx = px(layout.headline.x), hy = py(layout.headline.y);
      if (exportStrokeW > 0) {
        ctx.lineWidth   = exportStrokeW * 1.6;
        ctx.strokeStyle = F.strokeColor;
        ctx.lineJoin    = "round";
        ctx.miterLimit  = 2;
        ctx.strokeText(state.headline || "", hx, hy);
      }
      ctx.fillText(state.headline || "", hx, hy);
    }
    if (F.showSubline) {
      ctx.font = `600 ${sSize}px ${exportFontStack}`;
      const sx = px(layout.subline.x), sy = py(layout.subline.y);
      if (exportStrokeW > 0) {
        ctx.lineWidth   = exportStrokeW * 1.2;
        ctx.strokeStyle = F.strokeColor;
        ctx.lineJoin    = "round";
        ctx.strokeText(state.subline || "", sx, sy);
      }
      ctx.fillText(state.subline || "", sx, sy);
    }

    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    if (F.showCta) {
      ctx.font = `800 ${cSize}px ${exportFontStack}`;
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

    // 5b) Captions — drawn after primary text/progress, before template overlay
    if (typeof globalT === "number" && captions.length) {
      drawCaptionsOnCanvas(ctx, W, H, globalT);
    }

    // 6) Template image overlay — drawn LAST so it sits on top of everything
    //    (banner / frame designs use transparent areas to reveal video / text).
    if (bgImageEl && bgImageEl.complete && bgImageEl.naturalWidth) {
      const iw = bgImageEl.naturalWidth, ih = bgImageEl.naturalHeight;
      const sr = iw / ih, dr = W / H;
      let sx, sy, sw, sh;
      if (sr > dr) { sh = ih; sw = ih * dr; sx = (iw - sw) / 2; sy = 0; }
      else         { sw = iw; sh = iw / dr; sx = 0; sy = (ih - sh) / 2; }
      try { ctx.drawImage(bgImageEl, sx, sy, sw, sh, 0, 0, W, H); } catch {}
    }

    // 7) Final fade-through-black overlay (only for "fade" transition)
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

        const globalT = elapsed + (c ? Math.min(local, c.out - c.in) : 0);
        drawExportFrame(ctx, frontSrc, W, H, ratio, trans, backSrc, globalT);

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
          const oldFront = frontSrc;
          frontSrc = backSrc;
          backSrc  = oldFront;
          frontSrc.play().catch(() => {});
          // For "dissolve", keep the old front (now back) playing for the
          // crossfade window so its frames composite under the incoming clip.
          if (state.fine.transition === "dissolve") {
            setTimeout(() => {
              try { oldFront.pause(); } catch {}
              if (clips[i + 1]) loadInto(oldFront, clips[i + 1]);
            }, TRANSITION_DUR * 1000);
          } else {
            try { oldFront.pause(); } catch {}
            if (clips[i + 1]) loadInto(oldFront, clips[i + 1]);
          }
        }

        // Pass backSrc as the previous-clip source so dissolve can overlay it
        // (drawExportFrame uses it only when trans.type === "dissolve").
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
  renderCaptionList();
  renderCaptionsDOM();
  bindTuneControls();
  bindCaptionControls();
  bindElementDrag();
  syncTuneInputs();
  applyFine();
  updateCaptionsForTime(0, false);
  updateTplResetVisibility();
  updateTotalMeta();
  render();
})();
