/* ───────────────────────────────────────────────────────────────
   Iskola — közös lecke-motor
   1920×1080 logikai színpad (vászon + DOM réteg), jobb oldalt
   magyarázó panel, lépésenkénti (fejezetes) animáció.

   Használat:
     const L = Lesson.create({
       subject: 'Fizika',
       title:   'A kompresszoros hűtés',
       steps: [
         { title: '…', text: '<p>…</p>',
           enter(L) {}, leave(L) {},          // opcionális
           controls(L) { L.slider({...}); L.button('…', fn); } // opcionális
         }, …
       ],
       init(L) {},     // egyszer, a betűtípusok betöltése után
       draw(L) {},     // minden képkockán
     });

   A draw(L)-ben elérhető:
     L.ctx   2D kontextus, 1920×1080 logikai koordinátákban (a transzformáció már be van állítva)
     L.W, L.H        1920, 1080
     L.VW            1360 — a szabad vizuális terület szélessége (ettől jobbra a panel takar)
     L.t, L.dt       teljes idő / képkocka-idő másodpercben (dt ≤ 0.05)
     L.step          aktuális lépés indexe (0-tól)
     L.st            az aktuális lépésbe lépés óta eltelt másodperc
     L.sp            simított lépés-index (lebegőpontos, kb. 0.6 s alatt követi L.step-et) — kamerához, áttűnéshez
     L.prog(a, b)    0..1: hol tart L.st az [a, b] másodperc-intervallumban
     L.layer         DOM réteg a vászon fölött (1920×1080, absolute) — SVG/HTML elemekhez
     L.pointer       {x, y, down, inside} logikai koordinátákban
   ─────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  const W = 1920, H = 1080, VW = 1360;

  const U = {
    clamp: (v, a = 0, b = 1) => Math.min(b, Math.max(a, v)),
    lerp: (a, b, t) => a + (b - a) * t,
    map: (v, a, b, c, d) => c + (d - c) * U.clamp((v - a) / (b - a)),
    smooth: (t) => { t = U.clamp(t); return t * t * (3 - 2 * t); },
    inOut: (t) => { t = U.clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
    out: (t) => 1 - Math.pow(1 - U.clamp(t), 3),
    in: (t) => Math.pow(U.clamp(t), 3),
    outBack: (t) => { t = U.clamp(t); const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
    outElastic: (t) => { t = U.clamp(t); if (t === 0 || t === 1) return t; return Math.pow(2, -10 * t) * Math.sin((t * 10 - .75) * (2 * Math.PI) / 3) + 1; },
    /* determinisztikus véletlen: const r = U.rng(42); r() → [0,1) */
    rng: (seed) => { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; },
    /* "#rrggbb" + alfa → rgba() */
    rgba: (hex, a = 1) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; },
    /* két "#rrggbb" szín keverése */
    mix: (h1, h2, t) => { const a = parseInt(h1.slice(1), 16), b = parseInt(h2.slice(1), 16); const c = (s) => Math.round(U.lerp(a >> s & 255, b >> s & 255, U.clamp(t))); return `rgb(${c(16)},${c(8)},${c(0)})`; },
    TAU: Math.PI * 2,
  };

  function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  function create(cfg) {
    const L = {
      W, H, VW, U, cfg, steps: cfg.steps, step: 0, st: 0, sp: 0, t: 0, dt: 0, dir: 1,
      pointer: { x: 0, y: 0, down: false, inside: false }, scale: 1,
    };
    L.prog = (a, b) => U.clamp((L.st - a) / (b - a));

    // ── DOM váz ──
    document.title = cfg.title + ' — ' + cfg.subject;
    const vp = el('div'); vp.id = 'lesson-viewport';
    const stage = el('div'); stage.id = 'lesson-stage';
    const canvas = el('canvas'); canvas.id = 'lesson-canvas';
    const layer = el('div'); layer.id = 'lesson-layer';
    const panel = el('aside'); panel.id = 'lesson-panel';
    panel.innerHTML = `
      <div class="lp-top"><span class="lp-subject"></span><a class="lp-home" href="${cfg.home || 'index.html'}">← tantárgyak</a></div>
      <div class="lp-lesson"></div>
      <div class="lp-rule"></div>
      <div class="lp-body" style="display:flex;flex-direction:column;flex:1 1 auto;min-height:0">
        <div class="lp-count"></div>
        <h2 class="lp-title"></h2>
        <div class="lp-text"></div>
        <div class="lp-controls"></div>
      </div>
      <div class="lp-nav">
        <button class="lp-arrow prev" title="Előző (←)">←</button>
        <button class="lp-arrow replay" title="Lépés újrajátszása (R)">↻</button>
        <div class="lp-dots"></div>
        <button class="lp-arrow next" title="Következő (→)">→</button>
      </div>
      <div class="lp-hint"><kbd>←</kbd> <kbd>→</kbd> léptetés · <kbd>R</kbd> újra · <kbd>F</kbd> teljes képernyő</div>`;
    stage.append(canvas, layer, panel); vp.append(stage); document.body.append(vp);
    panel.querySelector('.lp-subject').textContent = cfg.subject;
    panel.querySelector('.lp-lesson').textContent = cfg.title;
    const $count = panel.querySelector('.lp-count'), $title = panel.querySelector('.lp-title'),
      $text = panel.querySelector('.lp-text'), $controls = panel.querySelector('.lp-controls'),
      $dots = panel.querySelector('.lp-dots'), $prev = panel.querySelector('.prev'), $next = panel.querySelector('.next'),
      $body = panel.querySelector('.lp-body');
    L.stage = stage; L.canvas = canvas; L.layer = layer; L.panel = panel; L.controlsEl = $controls;
    L.ctx = canvas.getContext('2d');

    cfg.steps.forEach((s, i) => { const d = el('button', 'lp-dot'); d.title = (i + 1) + '. ' + s.title.replace(/<[^>]+>/g, ''); d.onclick = () => L.go(i); $dots.append(d); });

    // ── vezérlő-segédek (a lépés controls(L) függvényéből hívhatók) ──
    L.slider = ({ label, min = 0, max = 1, step = 0.01, value = 0, format = (v) => v, onInput }) => {
      const w = el('div', 'lp-slider'); const lb = el('label', '', label); const out = el('output');
      const inp = el('input'); inp.type = 'range'; inp.min = min; inp.max = max; inp.step = step; inp.value = value;
      const upd = () => { out.textContent = format(+inp.value); };
      inp.addEventListener('input', () => { upd(); onInput && onInput(+inp.value); });
      upd(); w.append(lb, out, inp); $controls.append(w);
      return { el: w, input: inp, set: (v) => { inp.value = v; upd(); } };
    };
    L.button = (label, onClick) => {
      let row = $controls.lastElementChild; if (!row || !row.classList.contains('lp-btnrow')) { row = el('div', 'lp-btnrow'); $controls.append(row); }
      const b = el('button', 'lp-btn', label); b.addEventListener('click', () => onClick && onClick(b)); row.append(b); return b;
    };

    // ── lépésváltás ──
    function render() {
      const s = cfg.steps[L.step], n = cfg.steps.length;
      $count.innerHTML = `<b>${String(L.step + 1).padStart(2, '0')}</b> <span>/ ${String(n).padStart(2, '0')}</span>`;
      $title.innerHTML = s.title; $text.innerHTML = s.text || '';
      $controls.innerHTML = ''; if (s.controls) s.controls(L);
      $body.classList.remove('lp-anim'); void $body.offsetWidth; $body.classList.add('lp-anim');
      [...$dots.children].forEach((d, i) => { d.classList.toggle('cur', i === L.step); d.classList.toggle('done', i < L.step); });
      $prev.disabled = L.step === 0; $next.disabled = L.step === n - 1;
      try { history.replaceState(null, '', '#' + (L.step + 1)); } catch (e) { /* file:// alatt is megy, de biztos ami biztos */ }
    }
    L.go = (i, force) => {
      i = U.clamp(i, 0, cfg.steps.length - 1); if (i === L.step && !force) return;
      const old = cfg.steps[L.step]; if (old && old.leave && L.started) old.leave(L);
      L.dir = i >= L.step ? 1 : -1; L.prevStep = L.step; L.step = i; L.st = 0;
      render(); const s = cfg.steps[i]; if (s.enter) s.enter(L);
    };
    L.next = () => L.go(L.step + 1); L.prev = () => L.go(L.step - 1);
    L.replay = () => L.go(L.step, true);
    $prev.onclick = L.prev; $next.onclick = L.next; panel.querySelector('.replay').onclick = L.replay;

    window.addEventListener('keydown', (e) => {
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) && e.target.type !== 'range') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key;
      if (k === 'ArrowRight' || k === 'PageDown' || k === ' ') { e.preventDefault(); L.next(); }
      else if (k === 'ArrowLeft' || k === 'PageUp') { e.preventDefault(); L.prev(); }
      else if (k === 'Home') L.go(0); else if (k === 'End') L.go(cfg.steps.length - 1);
      else if (k === 'r' || k === 'R') L.replay();
      else if (k === 'f' || k === 'F') { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen(); }
      else if (/^[1-9]$/.test(k)) L.go(+k - 1);
      else if (cfg.onKey) cfg.onKey(e, L);
    });

    // ── méretezés (letterbox) + HiDPI vászon ──
    function fit() {
      const s = Math.min(innerWidth / W, innerHeight / H); L.scale = s;
      stage.style.transform = `scale(${s}) translate(-50%, -50%)`;
      const k = U.clamp(s * (window.devicePixelRatio || 1), 1, 2.5);
      const cw = Math.round(W * k), ch = Math.round(H * k);
      if (canvas.width !== cw) { canvas.width = cw; canvas.height = ch; }
      L.k = cw / W;
    }
    window.addEventListener('resize', fit); fit();

    // ── mutató (logikai koordináták) ──
    L.toStage = (e) => { const r = stage.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; };
    stage.addEventListener('pointermove', (e) => { const p = L.toStage(e); L.pointer.x = p.x; L.pointer.y = p.y; L.pointer.inside = true; });
    stage.addEventListener('pointerdown', (e) => { const p = L.toStage(e); L.pointer.x = p.x; L.pointer.y = p.y; L.pointer.down = true; });
    window.addEventListener('pointerup', () => { L.pointer.down = false; });
    stage.addEventListener('pointerleave', () => { L.pointer.inside = false; });

    // ── főciklus ──
    let last = 0;
    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000 || 0); last = now;
      L.dt = dt; L.t += dt; L.st += dt;
      L.sp += (L.step - L.sp) * (1 - Math.exp(-dt * 5.5)); if (Math.abs(L.step - L.sp) < 0.0005) L.sp = L.step;
      L.ctx.setTransform(L.k, 0, 0, L.k, 0, 0);
      if (cfg.draw) cfg.draw(L);
      requestAnimationFrame(frame);
    }
    function start() {
      if (cfg.init) cfg.init(L);
      const h = parseInt((location.hash || '').slice(1), 10);
      L.step = -1; L.go(h >= 1 && h <= cfg.steps.length ? h - 1 : 0, true); L.sp = L.step; L.started = true;
      stage.classList.add('ready'); requestAnimationFrame((n) => { last = n; frame(n); });
    }
    const fonts = ['560 40px Fraunces', 'italic 400 40px Fraunces', '400 24px "Bricolage Grotesque"', '700 24px "Bricolage Grotesque"', '500 20px "JetBrains Mono"'];
    const ready = document.fonts && document.fonts.load ? Promise.all(fonts.map((f) => document.fonts.load(f, 'őűÁ'))).catch(() => { }) : Promise.resolve();
    Promise.race([ready, new Promise((r) => setTimeout(r, 2500))]).then(start);

    window.__lesson = L;
    return L;
  }

  window.Lesson = { create, U, W, H, VW };
})();
