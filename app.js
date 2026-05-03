// AdCut Studio — Quick create demo
(() => {
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  // ---------- State ----------
  const defaults = {
    headline: "SUMMER SALE",
    subline:  "30% OFF",
    cta:      "今すぐチェック",
    palette:  "sunset",
    template: "ec",
    bgm:      "upbeat",
    enabledSizes: { "16:9": true, "1:1": true, "9:16": true },
  };
  const state = JSON.parse(JSON.stringify(defaults));

  const palettes = {
    sunset: { c1: "rgba(0,200,255,.45)",  c2: "rgba(255,58,140,.45)", base: "linear-gradient(135deg,#1a2440,#341a4a 60%,#4a1a3a)" },
    ocean:  { c1: "rgba(0,255,255,.35)",  c2: "rgba(0,100,255,.45)",  base: "linear-gradient(135deg,#003049,#0077b6 50%,#00c8ff)" },
    forest: { c1: "rgba(43,182,115,.45)", c2: "rgba(255,209,102,.45)", base: "linear-gradient(135deg,#1a3a2f,#2bb673 55%,#0a3a2a)" },
    mono:   { c1: "rgba(255,255,255,.18)", c2: "rgba(180,180,180,.25)", base: "linear-gradient(135deg,#0a0a0a,#2a2a2a 60%,#0a0a0a)" },
    candy:  { c1: "rgba(255,58,140,.45)", c2: "rgba(255,209,102,.45)", base: "linear-gradient(135deg,#ff3a8c,#ffd166 60%,#6f5cff)" },
  };

  const templates = {
    ec:    { headline: "SUMMER SALE",      subline: "30% OFF",          cta: "今すぐチェック",   palette: "sunset", bgm: "upbeat" },
    app:   { headline: "新感覚アプリ",     subline: "ダウンロードは無料", cta: "App Store で見る", palette: "ocean",  bgm: "upbeat" },
    brand: { headline: "Make it Yours.",   subline: "Crafted since 2008",cta: "ブランドを知る",   palette: "mono",   bgm: "cinematic" },
    event: { headline: "SPRING FESTIVAL",  subline: "5/10 SAT, 12:00",  cta: "参加登録する",     palette: "candy",  bgm: "calm" },
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
    return { headline: "見出し", subline: "サブテキスト", cta: "CTA" }[k] || k;
  }

  // ---------- Generate from prompt ----------
  $("#genBtn").addEventListener("click", () => {
    const raw = $("#aiPrompt").value.trim();
    if (!raw) { toast("プロンプトを入力してください"); return; }
    const parsed = parsePrompt(raw);
    Object.assign(state, parsed);
    fieldMap.headline.value = state.headline;
    fieldMap.subline.value  = state.subline;
    fieldMap.cta.value      = state.cta;
    $$(".pal").forEach((x) => x.classList.toggle("active", x.dataset.palette === state.palette));
    render();
    toast("プロンプトから 3 サイズを生成しました");
  });

  function parsePrompt(text) {
    // 1) split into segments by full-width or half-width separators
    const parts = text.split(/[、,。.\n]+/).map((s) => s.trim()).filter(Boolean);
    const out = {};
    if (parts[0]) out.headline = parts[0];
    if (parts[1]) out.subline  = parts[1];
    if (parts[2]) out.cta      = parts[2];
    // 2) keyword-driven palette inference
    const lc = text.toLowerCase();
    if (/夏|サマー|summer|セール|sale|割引/.test(lc))      out.palette = "sunset";
    else if (/海|ocean|青|空|cool|tech/.test(lc))           out.palette = "ocean";
    else if (/自然|forest|エコ|オーガニック|緑/.test(lc)) out.palette = "forest";
    else if (/高級|luxury|ラグジュアリー|モノトーン|black/.test(lc)) out.palette = "mono";
    else if (/カラフル|ポップ|キャンディ|お祝い|フェス/.test(lc)) out.palette = "candy";
    return out;
  }

  // ---------- Export actions ----------
  $("#exportAll").addEventListener("click", () => {
    const sizes = Object.keys(state.enabledSizes).filter((k) => state.enabledSizes[k]);
    if (!sizes.length) { toast("書き出すサイズが選択されていません"); return; }
    runExport(sizes, "MP4");
  });

  $("#duplicateBtn").addEventListener("click", () => {
    state.enabledSizes["16:9"] = true;
    state.enabledSizes["1:1"]  = true;
    state.enabledSizes["9:16"] = true;
    $$('.chk input[type="checkbox"]').forEach((cb) => (cb.checked = true));
    render();
    flashAll();
    toast("16:9 / 1:1 / 9:16 に自動複製しました");
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

  // ---------- Play all (preview animation) ----------
  $("#playAll").addEventListener("click", () => {
    flashAll();
    toast("全サイズを同時再生中…");
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
