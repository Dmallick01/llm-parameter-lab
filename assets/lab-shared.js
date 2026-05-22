/**
 * LLM Parameter Lab — shared UI (theme, i18n, deep links, hash state, glossary, viz)
 */
(function (global) {
  'use strict';

  const WIDGET_ALIASES = {
    kv: 'kv-cache',
    'kv-cache': 'kv-cache',
    quantization: 'quantization',
    quant: 'quantization',
    temperature: 'temperature',
    sampling: 'temperature',
    temp: 'temperature',
    rlhf: 'rlhf',
    rag: 'rag',
    scaling: 'scaling',
    chinchilla: 'scaling',
    scale: 'scaling',
    search: 'search-widget',
  };

  const FORMULAS = {
    'kv-cache': String.raw`RAM \approx 2 \cdot L \cdot H \cdot d_h \cdot n_{ctx} \cdot \mathrm{bytes}`,
    quantization: String.raw`\hat{w}_i = s \cdot (\mathrm{clamp}(\mathrm{round}(w_i/s)+z,\,0,\,2^b-1)-z)`,
    temperature: String.raw`P_T(x_i) \propto \exp(l_i / T)`,
    rlhf: String.raw`J(\theta) = \mathbb{E}[r] - \beta \cdot \mathrm{KL}(\pi_\theta \| \pi_{\mathrm{ref}})`,
    rag: String.raw`\mathrm{tokens}_{ctx} = k \cdot \mathrm{chunk} + \mathrm{system} + \mathrm{generation}`,
    scaling: String.raw`L(N,D) = \frac{A}{N^\alpha} + \frac{B}{D^\beta} + L_\infty`,
  };

  const LAB_VERSION = '2.1.0';

  const REFERENCES = [
    { widget: 'kv-cache', cite: 'Vaswani et al. (2017). Attention Is All You Need. NeurIPS.', url: 'https://arxiv.org/abs/1706.03762' },
    { widget: 'kv-cache', cite: 'Dao et al. (2022). FlashAttention. NeurIPS.', url: 'https://arxiv.org/abs/2205.14135' },
    { widget: 'quantization', cite: 'Jacob et al. (2018). Quantization and Training of CNNs for Efficient Integer-Arithmetic-Only Inference. CVPR.', url: 'https://arxiv.org/abs/1712.05877' },
    { widget: 'quantization', cite: 'Frantar et al. (2023). GPTQ: Accurate Post-Training Quantization for GPT.', url: 'https://arxiv.org/abs/2210.17323' },
    { widget: 'temperature', cite: 'Holtzman et al. (2020). The Curious Case of Neural Text Degeneration (nucleus sampling). ICLR.', url: 'https://arxiv.org/abs/1904.09751' },
    { widget: 'temperature', cite: 'Fan et al. (2018). Hierarchical Neural Story Generation (top-k). ACL.', url: 'https://arxiv.org/abs/1805.04833' },
    { widget: 'rlhf', cite: 'Ouyang et al. (2022). Training language models to follow instructions with human feedback (InstructGPT). NeurIPS.', url: 'https://arxiv.org/abs/2203.02155' },
    { widget: 'rlhf', cite: 'Rafailov et al. (2023). Direct Preference Optimization (DPO). NeurIPS.', url: 'https://arxiv.org/abs/2305.18290' },
    { widget: 'rag', cite: 'Lewis et al. (2020). Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks. NeurIPS.', url: 'https://arxiv.org/abs/2005.11401' },
    { widget: 'scaling', cite: 'Kaplan et al. (2020). Scaling Laws for Neural Language Models. arXiv.', url: 'https://arxiv.org/abs/2001.08361' },
    { widget: 'scaling', cite: 'Hoffmann et al. (2022). Training Compute-Optimal Large Language Models (Chinchilla). NeurIPS.', url: 'https://arxiv.org/abs/2203.15556' },
    { widget: 'scaling', cite: 'Brown et al. (2020). Language Models are Few-Shot Learners (GPT-3). NeurIPS.', url: 'https://arxiv.org/abs/2005.14165' },
  ];

  const GLOSSARY = [
    { term: 'KV cache', def: 'Stored key/value tensors per layer so autoregressive decoding does not recompute past tokens.' },
    { term: 'Quantization', def: 'Compressing weights to fewer bits (e.g. Q4_K_M) to reduce VRAM with small perplexity cost.' },
    { term: 'Temperature', def: 'Scales logits before softmax; lower T = more deterministic outputs.' },
    { term: 'Top-p / Top-k', def: 'Nucleus and fixed-size filtering that truncate the sampling distribution.' },
    { term: 'RLHF', def: 'Fine-tune with human preference rewards while penalizing KL drift from a reference model.' },
    { term: 'KL penalty (β)', def: 'Tradeoff knob: higher β keeps the policy closer to SFT, lower β allows stronger alignment.' },
    { term: 'RAG', def: 'Retrieve documents into the context window before the model generates an answer.' },
    { term: 'Chinchilla', def: 'Compute-optimal scaling: balance parameter count N and training tokens D for a fixed FLOP budget.' },
    { term: 'MFU', def: 'Model FLOPs utilization — fraction of peak GPU math throughput achieved in training.' },
    { term: 'Tokens per param', def: 'Ratio D/N; ~20× is often near compute-optimal for pretraining.' },
  ];

  const KV_PRESETS = {
    '7b': { 'kv-params': 7, 'kv-layers': 32, 'kv-heads': 32, 'kv-hdim': 128, 'kv-ctx': 4, 'kv-dtype': '2' },
    '70b': { 'kv-params': 70, 'kv-layers': 80, 'kv-heads': 64, 'kv-hdim': 128, 'kv-ctx': 8, 'kv-dtype': '2' },
    '405b': { 'kv-params': 405, 'kv-layers': 126, 'kv-heads': 128, 'kv-hdim': 128, 'kv-ctx': 32, 'kv-dtype': '2' },
  };

  let i18n = {};
  let lang = localStorage.getItem('lab-lang') || 'en';
  let booted = false;

  function assetBase() {
    const path = location.pathname.replace(/\/[^/]*$/, '');
    if (path.endsWith('/dist')) return path.replace(/\/dist$/, '') + '/assets';
    return path + '/assets';
  }

  function t(key) {
    return i18n[key] || key;
  }

  async function loadI18n(l) {
    lang = l;
    localStorage.setItem('lab-lang', l);
    try {
      const res = await fetch(`${assetBase()}/i18n/${l}.json`);
      if (res.ok) i18n = await res.json();
    } catch (_) {
      i18n = {};
    }
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const k = el.getAttribute('data-i18n');
      if (i18n[k]) el.textContent = i18n[k];
    });
    document.documentElement.lang = l;
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('lab-theme', theme);
    const btn = document.getElementById('lab-theme-btn');
    if (btn) btn.textContent = theme === 'dark' ? '☀ Light' : '☾ Dark';
  }

  function toggleTheme() {
    const cur = document.documentElement.getAttribute('data-theme') || 'light';
    applyTheme(cur === 'dark' ? 'light' : 'dark');
  }

  function resolveWidgetId(raw) {
    if (!raw) return null;
    const key = raw.toLowerCase().replace(/_/g, '-');
    return WIDGET_ALIASES[key] || key;
  }

  function findWidgetSection(id) {
    return document.getElementById(id) || document.querySelector(`[data-widget="${id}"]`);
  }

  function scrollToWidget(id) {
    const el = findWidgetSection(id);
    if (!el) return;
    document.querySelectorAll('.widget-focus').forEach((n) => n.classList.remove('widget-focus'));
    el.classList.add('widget-focus');
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => el.classList.remove('widget-focus'), 2500);
  }

  function getStateInputs() {
    return Array.from(document.querySelectorAll('input[type="range"], select')).filter(
      (el) => el.id && !el.id.startsWith('lab-')
    );
  }

  function readHashState() {
    const hash = location.hash.replace(/^#/, '');
    if (!hash || !hash.includes('=')) return null;
    const params = new URLSearchParams(hash);
    const state = {};
    params.forEach((v, k) => {
      state[k] = v;
    });
    return state;
  }

  function writeHashState() {
    const inputs = getStateInputs();
    const params = new URLSearchParams();
    inputs.forEach((el) => {
      params.set(el.id, el.value);
    });
    const w = new URLSearchParams(location.search).get('widget');
    if (w) params.set('_widget', w);
    const next = '#' + params.toString();
    if (location.hash !== next) history.replaceState(null, '', location.pathname + location.search + next);
  }

  function applyHashState() {
    const state = readHashState();
    if (!state) return;
    Object.entries(state).forEach(([id, val]) => {
      if (id === '_widget') return;
      const el = document.getElementById(id);
      if (!el) return;
      el.value = val;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      if (el.tagName === 'SELECT') el.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  function copyShareLink() {
    writeHashState();
    const url = location.href;
    navigator.clipboard.writeText(url).then(() => {
      const btn = document.getElementById('lab-share-btn');
      if (btn) {
        const prev = btn.textContent;
        btn.textContent = '✓ Copied';
        setTimeout(() => { btn.textContent = prev; }, 1500);
      }
    }).catch(() => prompt('Copy this link:', url));
  }

  function renderToolbar() {
    if (document.getElementById('lab-toolbar')) return;
    const bar = document.createElement('nav');
    bar.id = 'lab-toolbar';
    bar.className = 'lab-toolbar';
    bar.setAttribute('aria-label', 'Lab controls');
    const home = location.pathname.includes('index.html') || location.pathname.endsWith('/')
      ? 'index.html'
      : 'index.html';
    bar.innerHTML = `
      <a href="${home}" data-i18n="toolbar.home">Hub</a>
      <span class="sep">|</span>
      <a href="llm-lab.html">Lab</a>
      <a href="enhanced-toolkit.html">Toolkit</a>
      <span class="lab-version-badge">v${LAB_VERSION}</span>
      <span class="sep hide-mobile">|</span>
      <button type="button" id="lab-glossary-btn" data-i18n="toolbar.glossary">Glossary</button>
      <button type="button" id="lab-theme-btn" data-i18n="toolbar.theme">Theme</button>
      <button type="button" id="lab-share-btn" data-i18n="toolbar.share">Copy link</button>
      <select id="lab-lang-select" aria-label="Language">
        <option value="en">EN</option>
        <option value="es">ES</option>
      </select>
    `;
    document.body.prepend(bar);
    document.body.classList.add('lab-page');

    document.getElementById('lab-glossary-btn').addEventListener('click', toggleGlossary);
    document.getElementById('lab-theme-btn').addEventListener('click', toggleTheme);
    document.getElementById('lab-share-btn').addEventListener('click', copyShareLink);
    document.getElementById('lab-lang-select').value = lang;
    document.getElementById('lab-lang-select').addEventListener('change', (e) => loadI18n(e.target.value));
  }

  function renderGlossary() {
    if (document.getElementById('lab-glossary')) return;
    const aside = document.createElement('aside');
    aside.id = 'lab-glossary';
    aside.className = 'lab-glossary';
    aside.innerHTML = '<h3>Glossary</h3><input type="search" id="glossary-filter" placeholder="Filter terms…"><dl id="glossary-list"></dl>';
    document.body.appendChild(aside);
    document.body.classList.add('has-glossary');

    const dl = document.getElementById('glossary-list');
    GLOSSARY.forEach(({ term, def }) => {
      const dt = document.createElement('dt');
      dt.textContent = term;
      const dd = document.createElement('dd');
      dd.textContent = def;
      dl.appendChild(dt);
      dl.appendChild(dd);
    });

    document.getElementById('glossary-filter').addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      dl.querySelectorAll('dt').forEach((dt) => {
        const dd = dt.nextElementSibling;
        const show = !q || dt.textContent.toLowerCase().includes(q) || dd.textContent.toLowerCase().includes(q);
        dt.style.display = dd.style.display = show ? '' : 'none';
      });
    });
  }

  function toggleGlossary() {
    document.body.classList.toggle('glossary-open');
  }

  function renderReferences() {
    const host = document.getElementById('references-section');
    if (!host || host.dataset.filled) return;
    host.dataset.filled = '1';
    const byWidget = {};
    REFERENCES.forEach((r) => {
      if (!byWidget[r.widget]) byWidget[r.widget] = [];
      byWidget[r.widget].push(r);
    });
    let html = '<h3 class="references-title">Research references</h3><p class="references-lead">Formulas and sliders in this lab are inspired by the following work (educational approximations, not reproductions).</p>';
    Object.entries(byWidget).forEach(([widget, refs]) => {
      const label = widget.replace(/-/g, ' ');
      html += `<details class="references-group"><summary>${label}</summary><ol>`;
      refs.forEach((r) => {
        html += `<li><a href="${r.url}" target="_blank" rel="noopener noreferrer">${r.cite}</a></li>`;
      });
      html += '</ol></details>';
    });
    host.innerHTML = html;
  }

  function renderKatex() {
    if (typeof katex === 'undefined') return;
    document.querySelectorAll('.formula-box[data-tex]').forEach((box) => {
      const tex = box.getAttribute('data-tex');
      const target = box.querySelector('.katex-target') || box;
      try {
        katex.render(tex, target, { throwOnError: false, displayMode: true });
        box.classList.remove('katex-failed');
      } catch (_) {
        box.classList.add('katex-failed');
      }
    });
  }

  function injectFormulas() {
    Object.entries(FORMULAS).forEach(([id, tex]) => {
      const section = findWidgetSection(id);
      if (!section) return;
      const box = section.querySelector('.formula-box');
      if (!box || box.hasAttribute('data-tex')) return;
      const fallback = box.innerHTML;
      box.setAttribute('data-tex', tex);
      box.innerHTML = `<span class="formula-fallback">${fallback}</span><div class="katex-target"></div>`;
    });
  }

  function injectKvExtras() {
    const section = findWidgetSection('kv-cache');
    if (!section || section.querySelector('.lab-preset-row')) return;

    const controls = section.querySelector('.controls-group') || section.querySelector('.controls');
    if (!controls) return;

    const presetRow = document.createElement('div');
    presetRow.className = 'lab-preset-row';
    presetRow.innerHTML = `
      <button type="button" class="btn" data-preset="7b" data-i18n="preset.7b">7B preset</button>
      <button type="button" class="btn" data-preset="70b" data-i18n="preset.70b">70B preset</button>
      <button type="button" class="btn" data-preset="405b" data-i18n="preset.405b">405B preset</button>
      <button type="button" class="btn" id="kv-challenge-start" data-i18n="challenge.start">Challenge mode</button>
    `;
    controls.appendChild(presetRow);

    presetRow.querySelectorAll('[data-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const p = KV_PRESETS[btn.getAttribute('data-preset')];
        if (!p) return;
        Object.entries(p).forEach(([id, val]) => {
          const el = document.getElementById(id);
          if (el) {
            el.value = val;
            el.dispatchEvent(new Event('input', { bubbles: true }));
          }
        });
        presetRow.querySelectorAll('.btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        writeHashState();
      });
    });

    const challenge = document.createElement('div');
    challenge.id = 'kv-challenge-panel';
    challenge.className = 'challenge-panel';
    challenge.innerHTML = `
      <strong data-i18n="challenge.title">Challenge: predict KV cache RAM (GB)</strong>
      <label data-i18n="challenge.guess">Your guess (GB)</label>
      <input type="number" id="kv-challenge-guess" min="0" step="0.01" placeholder="e.g. 1.07">
      <div class="lab-action-row">
        <button type="button" class="btn" id="kv-challenge-check" data-i18n="challenge.check">Reveal answer</button>
        <button type="button" class="btn" id="kv-challenge-close" data-i18n="challenge.close">Close</button>
      </div>
      <div class="challenge-result" id="kv-challenge-result" hidden></div>
    `;
    controls.appendChild(challenge);

    document.getElementById('kv-challenge-start').addEventListener('click', () => {
      challenge.classList.add('open');
      document.getElementById('kv-challenge-result').hidden = true;
    });
    document.getElementById('kv-challenge-close').addEventListener('click', () => challenge.classList.remove('open'));
    document.getElementById('kv-challenge-check').addEventListener('click', () => {
      const ramEl = document.getElementById('kv-cache-ram');
      let actual = NaN;
      if (ramEl) {
        const m = ramEl.textContent.match(/[\d.]+/);
        if (m) actual = parseFloat(m[0]);
      }
      const guess = parseFloat(document.getElementById('kv-challenge-guess').value);
      const res = document.getElementById('kv-challenge-result');
      res.hidden = false;
      if (Number.isNaN(guess)) {
        res.textContent = 'Enter a number first.';
        res.className = 'challenge-result wrong';
        return;
      }
      const err = Math.abs(guess - actual);
      const pct = actual ? ((err / actual) * 100).toFixed(1) : '—';
      res.className = 'challenge-result' + (err <= 0.15 || err / actual < 0.1 ? '' : ' wrong');
      res.textContent = err <= 0.15 || err / actual < 0.1
        ? `Correct (within 10%): actual ≈ ${actual} GB`
        : `Actual ≈ ${actual} GB — you were off by ${pct}%`;
    });
  }

  function injectCanvasExport(sectionId, canvasId, label) {
    const section = findWidgetSection(sectionId);
    if (!section || section.querySelector(`#${canvasId}-wrap`)) return;
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const wrap = document.createElement('div');
    wrap.className = 'viz-export-row';
    wrap.innerHTML = `<button type="button" class="btn viz-export-btn" data-canvas="${canvasId}" data-i18n="export.png">Export PNG</button>`;
    canvas.parentElement.appendChild(wrap);
    wrap.querySelector('.viz-export-btn').addEventListener('click', () => exportCanvasPng(canvasId));
  }

  function exportCanvasPng(canvasId) {
    const c = document.getElementById(canvasId);
    if (!c) return;
    const a = document.createElement('a');
    a.download = `${canvasId}-${Date.now()}.png`;
    a.href = c.toDataURL('image/png');
    a.click();
  }

  function exportPanelPng(panelSelector) {
    const panel = document.querySelector(panelSelector);
    if (!panel) return;
    const canvas = document.createElement('canvas');
    const rect = panel.getBoundingClientRect();
    const scale = 2;
    canvas.width = rect.width * scale;
    canvas.height = rect.height * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--cbg').trim() || '#fff';
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--ctext').trim() || '#000';
    ctx.font = '12px monospace';
    panel.querySelectorAll('.metric-card, .metric-title, .metric-value').forEach((el, i) => {
      const r = el.getBoundingClientRect();
      const pr = panel.getBoundingClientRect();
      const y = r.top - pr.top + 14;
      ctx.fillText(el.textContent.trim().slice(0, 40), r.left - pr.left, y);
    });
    const a = document.createElement('a');
    a.download = `widget-snapshot-${Date.now()}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
  }

  function injectPanelExports() {
    document.querySelectorAll('.tool-section, .widget').forEach((section) => {
      if (section.querySelector('.panel-export-btn')) return;
      const panel = section.querySelector('.results-panel') || section.querySelector('.output-panel');
      if (!panel) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn panel-export-btn';
      btn.setAttribute('data-i18n', 'export.png');
      btn.textContent = 'Export PNG';
      btn.addEventListener('click', () => {
        const target = section.querySelector('.results-panel') || section.querySelector('.output-panel');
        if (!target) return;
        const canvas = document.createElement('canvas');
        const rect = target.getBoundingClientRect();
        const scale = 2;
        canvas.width = Math.max(1, rect.width * scale);
        canvas.height = Math.max(1, rect.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.scale(scale, scale);
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--cbg').trim() || '#fff';
        ctx.fillRect(0, 0, rect.width, rect.height);
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--ctext').trim() || '#000';
        ctx.font = '11px monospace';
        let y = 16;
        target.querySelectorAll('.metric-title, .metric-value, .output, .bar-label, .bar-value').forEach((el) => {
          const line = el.textContent.trim().replace(/\s+/g, ' ').slice(0, 72);
          if (line) { ctx.fillText(line, 12, y); y += 14; }
        });
        const a = document.createElement('a');
        a.download = `${section.id || 'panel'}-${Date.now()}.png`;
        a.href = canvas.toDataURL('image/png');
        a.click();
      });
      panel.appendChild(btn);
    });
  }

  function drawChinchilla() {
    const canvas = document.getElementById('chinchilla-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = 280 * dpr;
    canvas.style.height = '280px';
    const w = canvas.width;
    const h = canvas.height;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cw = canvas.clientWidth;
    const ch = 280;

    const bg = getComputedStyle(document.documentElement).getPropertyValue('--cbg').trim() || '#fff';
    const fg = getComputedStyle(document.documentElement).getPropertyValue('--ctext').trim() || '#000';
    const acc = getComputedStyle(document.documentElement).getPropertyValue('--chover').trim() || '#00f';
    const dim = getComputedStyle(document.documentElement).getPropertyValue('--cdisabled').trim() || '#999';

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, cw, ch);
    ctx.strokeStyle = dim;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(48, 12);
    ctx.lineTo(48, ch - 36);
    ctx.lineTo(cw - 12, ch - 36);
    ctx.stroke();

    const Ns = [];
    for (let i = 6; i <= 12; i += 0.15) Ns.push(Math.pow(10, i));
    const Ds = [];
    for (let j = 9; j <= 13; j += 0.12) Ds.push(Math.pow(10, j));

    const lossAt = (N, D) => (400 / Math.pow(N / 1e9, 0.34)) + (400 / Math.pow(D / 1e9, 0.28)) + 1.69;

    let nCur = 7e9;
    let dCur = 140e9;
    const parseN = (s) => {
      const m = String(s).match(/([\d.]+)\s*([BM])/i);
      if (!m) return 7e9;
      return parseFloat(m[1]) * (m[2].toUpperCase() === 'B' ? 1e9 : 1e6);
    };
    const nEl = document.getElementById('s-n');
    const dEl = document.getElementById('s-d');
    if (nEl && dEl) {
      nCur = parseN(nEl.textContent);
      dCur = parseN(dEl.textContent);
      if (dEl.textContent.includes('T')) dCur = parseFloat(dEl.textContent) * 1e12;
    } else if (document.getElementById('compute')) {
      const C = +document.getElementById('compute').value;
      nCur = Math.pow(C, 0.5) * 1e6;
      dCur = Math.pow(C, 0.5) * 1e9;
    }

    const losses = [];
    Ns.forEach((N) => {
      Ds.forEach((D) => losses.push(lossAt(N, D)));
    });
    const lMin = Math.min(...losses);
    const lMax = Math.max(...losses);

    const xOf = (logN) => 48 + ((logN - 6) / 6) * (cw - 60);
    const yOf = (loss) => ch - 36 - ((loss - lMin) / (lMax - lMin)) * (ch - 52);

    ctx.strokeStyle = fg;
    ctx.globalAlpha = 0.15;
    Ns.forEach((N) => {
      ctx.beginPath();
      let first = true;
      Ds.forEach((D) => {
        const L = lossAt(N, D);
        const x = xOf(Math.log10(N));
        const y = yOf(L);
        if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y);
      });
      ctx.stroke();
    });
    ctx.globalAlpha = 1;

    const optD = 20 * nCur;
    const curves = [
      { N: nCur, D: dCur, label: 'Your config' },
      { N: nCur, D: optD, label: 'Chinchilla ~20×' },
    ];
    curves.forEach((pt, i) => {
      const x = xOf(Math.log10(pt.N));
      const y = yOf(lossAt(pt.N, pt.D));
      ctx.fillStyle = i === 0 ? acc : fg;
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = fg;
    ctx.font = '11px monospace';
    ctx.fillText('log₁₀ N (params)', cw / 2 - 40, ch - 8);
    ctx.save();
    ctx.translate(14, ch / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Loss L(N,D)', 0, 0);
    ctx.restore();
  }

  function drawRagSankey() {
    const canvas = document.getElementById('rag-sankey-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = 200 * dpr;
    canvas.style.height = '200px';
    const cw = canvas.clientWidth;
    const ch = 200;

    const K = +(document.getElementById('rag-k')?.value || document.getElementById('kDocs')?.value || 5);
    const C = +(document.getElementById('rag-chunk')?.value || document.getElementById('chunkSize')?.value || 512);
    const ctxEl = document.getElementById('rag-ctx');
    const Win = ctxEl ? +ctxEl.value * 1024 : 8192;
    const rToks = K * C;
    const sys = Math.round(Win * 0.1);
    const gen = Math.max(256, Math.round((Win - sys - rToks) * 0.35));
    const free = Math.max(0, Win - sys - rToks - gen);

    const bg = getComputedStyle(document.documentElement).getPropertyValue('--cbg').trim() || '#fff';
    const fg = getComputedStyle(document.documentElement).getPropertyValue('--ctext').trim() || '#000';
    const acc = getComputedStyle(document.documentElement).getPropertyValue('--chover').trim() || '#00f';
    const dim = getComputedStyle(document.documentElement).getPropertyValue('--cdisabled').trim() || '#999';

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, cw, ch);

    const stages = [
      { label: 'Retrieval', val: rToks, color: acc },
      { label: 'System', val: sys, color: dim },
      { label: 'Generation', val: gen, color: fg },
      { label: 'Free', val: free, color: bg },
    ];
    const total = Win;
    const x0 = 24;
    const x1 = cw - 24;
    const midY = ch / 2;
    let x = x0;

    stages.forEach((s, i) => {
      const w = ((s.val / total) * (x1 - x0));
      const h = 40 + (s.val / total) * 80;
      ctx.fillStyle = s.color;
      if (s.label === 'Free') {
        ctx.strokeStyle = dim;
        ctx.strokeRect(x, midY - h / 2, w, h);
      } else {
        ctx.fillRect(x, midY - h / 2, w, h);
      }
      ctx.fillStyle = fg;
      ctx.font = '10px monospace';
      ctx.fillText(s.label, x + 4, midY - h / 2 - 4);
      ctx.fillText(Math.round((s.val / total) * 100) + '%', x + 4, midY + 4);
      if (i < stages.length - 1) {
        ctx.strokeStyle = dim;
        ctx.beginPath();
        ctx.moveTo(x + w, midY);
        ctx.lineTo(x + w + 12, midY);
        ctx.stroke();
      }
      x += w + 12;
    });

    ctx.fillStyle = dim;
    ctx.font = '10px monospace';
    ctx.fillText(`Context window: ${(Win / 1024).toFixed(0)}K tokens`, x0, ch - 8);
  }

  function injectVizCanvases() {
    const scaling = findWidgetSection('scaling');
    if (scaling && !document.getElementById('chinchilla-canvas')) {
      const wrap = document.createElement('div');
      wrap.className = 'viz-canvas-wrap';
      wrap.id = 'chinchilla-canvas-wrap';
      wrap.innerHTML = `
        <div class="viz-canvas-label">Chinchilla: loss landscape (N vs D)</div>
        <canvas id="chinchilla-canvas" width="800" height="280" aria-label="Chinchilla loss curve"></canvas>
      `;
      const verdict = scaling.querySelector('.verdict-box');
      if (verdict) verdict.before(wrap);
      else scaling.querySelector('.results-panel')?.appendChild(wrap);
    }

    const rag = findWidgetSection('rag');
    if (rag && !document.getElementById('rag-sankey-canvas')) {
      const wrap = document.createElement('div');
      wrap.className = 'viz-canvas-wrap';
      wrap.id = 'rag-sankey-canvas-wrap';
      wrap.innerHTML = `
        <div class="viz-canvas-label">RAG context budget (retrieval → system → generation → free)</div>
        <canvas id="rag-sankey-canvas" width="800" height="200" aria-label="RAG budget sankey"></canvas>
      `;
      const bars = rag.querySelector('#rag-bars') || rag.querySelector('#rag-graph');
      if (bars) bars.after(wrap);
      else rag.querySelector('.results-panel')?.appendChild(wrap);
    }
  }

  function hookUpdates() {
    let debounce;
    const refresh = () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        drawChinchilla();
        drawRagSankey();
        writeHashState();
      }, 80);
    };
    getStateInputs().forEach((el) => {
      el.addEventListener('input', refresh);
      el.addEventListener('change', refresh);
    });
    window.addEventListener('resize', () => {
      drawChinchilla();
      drawRagSankey();
    });
  }

  function initDeepLink() {
    const params = new URLSearchParams(location.search);
    const w = resolveWidgetId(params.get('widget'));
    if (w) scrollToWidget(w);
  }

  function waitForKatex(maxMs = 5000) {
    return new Promise((resolve) => {
      if (typeof katex !== 'undefined') { resolve(); return; }
      const t0 = Date.now();
      const tick = () => {
        if (typeof katex !== 'undefined' || Date.now() - t0 > maxMs) resolve();
        else requestAnimationFrame(tick);
      };
      tick();
    });
  }

  async function initLabPage() {
    renderToolbar();
    renderGlossary();
    renderReferences();
    applyTheme(localStorage.getItem('lab-theme') || 'light');
    await loadI18n(lang);
    injectFormulas();
    await waitForKatex();
    renderKatex();
    injectKvExtras();
    injectVizCanvases();
    applyHashState();
    initDeepLink();
    hookUpdates();
    injectPanelExports();
    injectCanvasExport('scaling', 'chinchilla-canvas');
    injectCanvasExport('rag', 'rag-sankey-canvas');

    drawChinchilla();
    drawRagSankey();

    const obs = new MutationObserver(() => {
      drawChinchilla();
      drawRagSankey();
    });
    ['s-n', 's-d', 'kv-cache-ram', 'scale-output', 'rag-output'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) obs.observe(el, { childList: true, characterData: true, subtree: true });
    });
  }

  async function initHubPage() {
    renderToolbar();
    renderGlossary();
    renderReferences();
    applyTheme(localStorage.getItem('lab-theme') || 'light');
    await loadI18n(lang);
    document.getElementById('lab-lang-select')?.addEventListener('change', (e) => loadI18n(e.target.value));
  }

  async function bootLab() {
    if (booted) return;
    booted = true;
    document.body.classList.add('lab-page');
    await initLabPage();
  }

  async function bootHub() {
    if (booted) return;
    booted = true;
    await initHubPage();
  }

  global.LabShared = {
    version: LAB_VERSION,
    initLabPage,
    initHubPage,
    bootLab,
    bootHub,
    drawChinchilla,
    drawRagSankey,
    scrollToWidget,
    loadI18n,
  };
})(typeof window !== 'undefined' ? window : globalThis);
