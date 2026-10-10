/* PMP Website Value dashboard. No dependencies. Reads:
   ../data/<slug>.json, ../data/benchmark.json, ../data/values.json              */
(() => {
  "use strict";

  // ---------- helpers ----------
  const $ = (s, r = document) => r.querySelector(s);
  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") n.className = v;
      else if (k === "html") n.innerHTML = v;
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    }
    for (const k of kids) if (k != null) n.append(k);
    return n;
  };
  const SVGNS = "http://www.w3.org/2000/svg";
  const svg = (tag, attrs = {}, ...kids) => {
    const n = document.createElementNS(SVGNS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    for (const k of kids) if (k != null) n.append(k);
    return n;
  };
  const gbp = (v, dp) => {
    const a = Math.abs(v);
    const d = dp != null ? dp : a >= 1000 ? 0 : a >= 100 ? 0 : 2;
    return (v < 0 ? "−" : "") + "£" + a.toLocaleString("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d });
  };
  const gbpShort = (v) => {
    const a = Math.abs(v), s = v < 0 ? "−" : "";
    if (a >= 1e6) return s + "£" + (a / 1e6).toFixed(1) + "m";
    if (a >= 1e3) return s + "£" + (a / 1e3).toFixed(a >= 1e4 ? 0 : 1) + "k";
    return s + "£" + Math.round(a);
  };
  const int = (v) => Math.round(v).toLocaleString("en-GB");
  const pct = (v, dp = 0) => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(dp) + "%";
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const mean = (a) => (a.length ? sum(a) / a.length : 0);
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const mLabel = (m, withYear = true) => `${MONTHS[+m.slice(5, 7) - 1]}${withYear ? " " + m.slice(2, 4) : ""}`;
  const mLong = (m) => `${MONTHS[+m.slice(5, 7) - 1]} ${m.slice(0, 4)}`;
  const dLong = (d) => { const [y, m, dd] = d.split("-"); return `${+dd} ${MONTHS[+m - 1]} ${y}`; };
  const addMonths = (m, n) => { const d = new Date(+m.slice(0, 4), +m.slice(5, 7) - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
  const SLOT = { 1: "var(--s1)", 2: "var(--s2)", 3: "var(--s3)", 4: "var(--s4)", 5: "var(--s5)", 6: "var(--s6)", 7: "var(--s7)" };
  const CH = ["var(--c1)", "var(--c2)", "var(--c3)", "var(--c4)", "var(--c5)", "var(--c6)"];

  // ---------- tiny sha256 for the passcode gate (works on file:// too) ----------
  function sha256(str) {
    const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
    let H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    const bytes = new TextEncoder().encode(str);
    const l = bytes.length, padLen = ((l + 9 + 63) >> 6) << 6;
    const buf = new Uint8Array(padLen); buf.set(bytes); buf[l] = 0x80;
    const dv = new DataView(buf.buffer); dv.setUint32(padLen - 4, l * 8 >>> 0); dv.setUint32(padLen - 8, Math.floor(l * 8 / 2 ** 32));
    const w = new Uint32Array(64), rotr = (x, n) => (x >>> n) | (x << (32 - n));
    for (let i = 0; i < padLen; i += 64) {
      for (let t = 0; t < 16; t++) w[t] = dv.getUint32(i + t * 4);
      for (let t = 16; t < 64; t++) { const s0 = rotr(w[t-15],7)^rotr(w[t-15],18)^(w[t-15]>>>3), s1 = rotr(w[t-2],17)^rotr(w[t-2],19)^(w[t-2]>>>10); w[t] = (w[t-16]+s0+w[t-7]+s1)>>>0; }
      let [a,b,c,d,e,f,g,h] = H;
      for (let t = 0; t < 64; t++) { const S1 = rotr(e,6)^rotr(e,11)^rotr(e,25), ch = (e&f)^(~e&g), t1 = (h+S1+ch+K[t]+w[t])>>>0, S0 = rotr(a,2)^rotr(a,13)^rotr(a,22), mj = (a&b)^(a&c)^(b&c), t2 = (S0+mj)>>>0; h=g; g=f; f=e; e=(d+t1)>>>0; d=c; c=b; b=a; a=(t1+t2)>>>0; }
      H = H.map((x, i) => (x + [a,b,c,d,e,f,g,h][i]) >>> 0);
    }
    return H.map((x) => x.toString(16).padStart(8, "0")).join("");
  }

  function gate(hash, key) {
    return new Promise((resolve) => {
      if (!hash || hash === "{{HASH}}" || hash === "") return resolve();
      // Already unlocked this session. The overview needs the passcode itself (to unseal client links),
      // so a session that only remembers the hash from an older version is asked once more.
      try {
        const code = sessionStorage.getItem("pmp-key-" + key);
        if (sessionStorage.getItem("pmp-gate-" + key) === hash && (code || key !== "overview")) return resolve(code || undefined);
      } catch (e) {}
      const remember = (code) => { try { sessionStorage.setItem("pmp-gate-" + key, hash); sessionStorage.setItem("pmp-key-" + key, code); } catch (e) {} };
      // A link can carry the passcode after # (never sent to the server): .../thrums/#k=thrums-2026
      const mk = location.hash.match(/[#&]k=([^&]+)/);
      if (mk && sha256(decodeURIComponent(mk[1]).trim()) === hash) {
        const code = decodeURIComponent(mk[1]).trim();
        remember(code);
        history.replaceState(null, "", location.pathname + location.search);
        return resolve(code);
      }
      const err = el("div", { class: "err" });
      const input = el("input", { type: "password", placeholder: "Passcode", autocomplete: "current-password", "aria-label": "Passcode" });
      const form = el("form", { onsubmit: (ev) => {
        ev.preventDefault();
        if (sha256(input.value.trim()) === hash) {
          remember(input.value.trim());
          box.remove(); resolve(input.value.trim());
        } else { err.textContent = "That passcode didn't match. Try again."; input.select(); }
      } }, input, el("button", { type: "submit" }, "Open"));
      const logoSrc = (document.querySelector(".pmp-logo") || {}).src || "../assets/pmp-logo.png";
      const box = el("div", { class: "gate" }, el("div", { class: "box" },
        el("div", { class: "brand" }, el("img", { class: "pmp-logo", src: logoSrc, alt: "Practice Made Purrfect" })),
        el("h1", {}, "This dashboard is private"),
        el("p", {}, "Enter the passcode we sent you to see your practice's figures."),
        form, err));
      document.body.append(box); input.focus();
    });
  }

  // ---------- tooltip ----------
  function makeTip(container) {
    const t = el("div", { class: "tooltip", role: "status" });
    container.append(t);
    return {
      show(x, y, html) { t.innerHTML = html; t.style.left = x + "px"; t.style.top = y + "px"; t.classList.add("show"); },
      hide() { t.classList.remove("show"); },
    };
  }
  const niceMax = (v) => { if (v <= 0) return 1; const p = 10 ** Math.floor(Math.log10(v)); const n = v / p; const m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10; return m * p; };
  // Pick a round tick step so axis labels read 0, 10k, 20k... never 12.5k
  const niceScale = (max, targetTicks = 4) => { const step = niceMax(max / targetTicks); const top = step * Math.ceil(max / step - 1e-9); return { step, top, ticks: Math.round(top / step) }; };
  const hostWidth = (host) => Math.max(320, Math.round(host.getBoundingClientRect().width) || 760);
  const labelEvery = (n, step) => (step >= 44 ? 1 : step >= 24 ? 2 : step >= 16 ? 3 : step >= 11 ? 4 : 6);

  // ---------- charts ----------
  // Stacked monthly bars with optional dashed reference line.
  function stackedBars(host, { months, series, ref, markers = [], fmt = gbpShort, fmtFull = gbp, unit = "" }) {
    host.innerHTML = "";
    const W = hostWidth(host), H = W < 480 ? 240 : 300, m = { t: 18, r: 16, b: 34, l: 52 };
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    const totals = months.map((_, i) => sum(series.map((s) => s.values[i])));
    const sc = niceScale(Math.max(...totals, ref ? ref.value * 1.15 : 0) * 1.08);
    const yMax = sc.top, ticks = sc.ticks;
    const y = (v) => m.t + ih - (v / yMax) * ih;
    const n = months.length, step = iw / n, bw = Math.min(Math.max(step * 0.62, 6), 44);
    const root = svg("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Stacked bar chart" });
    const grid = svg("g", { class: "grid" }), axis = svg("g", { class: "axis" }), labels = svg("g");
    for (let i = 0; i <= ticks; i++) {
      const v = (yMax / ticks) * i, yy = y(v);
      grid.append(svg("line", { x1: m.l, x2: W - m.r, y1: yy, y2: yy }));
      labels.append(svg("text", { x: m.l - 8, y: yy + 4, "text-anchor": "end" }, fmt(v)));
    }
    axis.append(svg("line", { x1: m.l, x2: W - m.r, y1: y(0), y2: y(0) }));
    root.append(grid, axis, labels);
    const every = labelEvery(n, step);
    const bars = svg("g");
    const tip = makeTip(host);
    months.forEach((mo, i) => {
      const cx = m.l + step * i + step / 2;
      let acc = 0;
      const g = svg("g", { class: "bar" });
      series.forEach((s) => {
        const v = s.values[i]; if (!v) return;
        const y1 = y(acc + v), y0 = y(acc);
        const h = Math.max(y0 - y1 - 2, 0);
        const isTop = acc + v >= totals[i] - 1e-9;
        const r = isTop ? 4 : 0;
        const x0 = cx - bw / 2;
        const path = isTop
          ? `M${x0},${y1 + r} a${r},${r} 0 0 1 ${r},-${r} h${bw - 2 * r} a${r},${r} 0 0 1 ${r},${r} v${h - r} h${-bw} z`
          : `M${x0},${y1} h${bw} v${h} h${-bw} z`;
        g.append(svg("path", { d: path, fill: s.color }));
        acc += v;
      });
      if (i % every === 0) labels.append(svg("text", { x: cx, y: H - 12, "text-anchor": "middle" }, mLabel(mo, every > 1 || n > 12 || i === 0 || mo.endsWith("-01"))));
      const hit = svg("rect", { class: "hit", x: m.l + step * i, y: m.t, width: step, height: ih });
      const show = () => {
        bars.querySelectorAll(".bar").forEach((b) => b.classList.add("dim")); g.classList.remove("dim");
        const rows = series.map((s) => s.values[i] ? `<div class="tr"><span><i class="sw" style="background:${s.color}"></i>${s.label}</span><span>${fmtFull(s.values[i])}${unit}</span></div>` : "").join("");
        const rect = host.getBoundingClientRect(), sx = rect.width / W;
        tip.show(cx * sx, y(totals[i]) * sx, `<b>${mLong(mo)}</b>${rows}<div class="tr tot"><span>Total</span><span>${fmtFull(totals[i])}${unit}</span></div>`);
      };
      const hide = () => { bars.querySelectorAll(".bar").forEach((b) => b.classList.remove("dim")); tip.hide(); };
      hit.addEventListener("mouseenter", show); hit.addEventListener("mouseleave", hide);
      hit.setAttribute("tabindex", "0"); hit.addEventListener("focus", show); hit.addEventListener("blur", hide);
      bars.append(g, hit);
    });
    root.append(bars);
    if (ref) {
      const yy = y(ref.value);
      const g = svg("g", { class: "ref" }, svg("line", { x1: m.l, x2: W - m.r, y1: yy, y2: yy }),
        svg("text", { x: m.l + 6, y: yy - 6, "text-anchor": "start", style: "paint-order:stroke;stroke:var(--surface);stroke-width:4px;stroke-linejoin:round" }, ref.label));
      root.append(g);
    }
    // Annotations: what we did, and when. Drawn on the month boundary, labelled at the top.
    const shown = markers.filter((mk) => months.includes(mk.month));
    if (shown.length) {
      const g = svg("g", { class: "marker" });
      shown.forEach((mk, idx) => {
        const i = months.indexOf(mk.month);
        const xx = m.l + step * i + step / 2 - bw / 2 - Math.max((step - bw) / 2, 3);
        g.append(svg("line", { x1: xx, x2: xx, y1: m.t - 4, y2: y(0), stroke: "var(--accent)", "stroke-width": 1.5, "stroke-dasharray": "2 3", opacity: 0.9 }));
        g.append(svg("circle", { cx: xx, cy: m.t - 4, r: 8, fill: "var(--accent)" }));
        g.append(svg("text", { x: xx, y: m.t - 0.5, "text-anchor": "middle", fill: "#fff", "font-size": "10", "font-weight": "700" }, String(idx + 1)));
      });
      root.append(g);
    }
    host.append(root);
    const lg = el("div", { class: "legend" });
    series.forEach((s) => lg.append(el("span", {}, el("i", { class: "sw", style: `background:${s.color}` }), s.label)));
    if (ref) lg.append(el("span", {}, el("i", { class: "sw line", style: "background:var(--ink-2)" }), ref.label));
    host.append(lg);
    if (shown.length) {
      const notes = el("div", { class: "notes" });
      shown.forEach((mk, idx) => notes.append(el("span", {}, el("i", { class: "n" }, String(idx + 1)), el("b", {}, mk.label), el("span", { class: "muted" }, ` · ${dLong(mk.date)}`))));
      host.append(notes);
    }
  }

  // Multi-line chart with optional p25–p75 band on one series.
  function lineChart(host, { months, series, band, fmt = gbpShort, fmtFull = gbp, zeroLine = true, unit = "" }) {
    host.innerHTML = "";
    const W = hostWidth(host), H = W < 480 ? 230 : 280, m = { t: 20, r: 64, b: 34, l: 52 };
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    const all = series.flatMap((s) => s.values).concat(band ? band.hi.concat(band.lo) : []);
    const rawMax = Math.max(...all, 0), rawMin = Math.min(...all, 0);
    const scTop = niceScale(rawMax * 1.1 || 1);
    const yMax = scTop.top, yMin = rawMin < 0 ? -scTop.step * Math.ceil((-rawMin * 1.1) / scTop.step) : 0;
    const ticks = Math.round((yMax - yMin) / scTop.step);
    const y = (v) => m.t + ih - ((v - yMin) / (yMax - yMin)) * ih;
    const n = months.length, x = (i) => m.l + (n === 1 ? iw / 2 : (iw * i) / (n - 1));
    const root = svg("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Line chart" });
    const grid = svg("g", { class: "grid" }), labels = svg("g"), axis = svg("g", { class: "axis" });
    for (let i = 0; i <= ticks; i++) {
      const v = yMin + ((yMax - yMin) / ticks) * i, yy = y(v);
      grid.append(svg("line", { x1: m.l, x2: W - m.r, y1: yy, y2: yy }));
      labels.append(svg("text", { x: m.l - 8, y: yy + 4, "text-anchor": "end" }, fmt(v)));
    }
    if (zeroLine) axis.append(svg("line", { x1: m.l, x2: W - m.r, y1: y(0), y2: y(0) }));
    root.append(grid, axis, labels);
    const every = labelEvery(n, iw / Math.max(n - 1, 1));
    months.forEach((mo, i) => { if (i % every === 0) labels.append(svg("text", { x: x(i), y: H - 12, "text-anchor": "middle" }, mLabel(mo))); });
    if (band) {
      const hiP = band.hi.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join(" ");
      const loP = [...band.lo].map((v, i) => [x(i), y(v)]).reverse().map(([px, py]) => `L${px},${py}`).join(" ");
      root.append(svg("path", { class: "area", d: `${hiP} ${loP} Z`, fill: band.color }));
    }
    series.forEach((s) => {
      const d = s.values.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join(" ");
      root.append(svg("path", { class: "line", d, stroke: s.color }));
      const last = s.values[n - 1];
      root.append(svg("circle", { class: "dot", cx: x(n - 1), cy: y(last), r: 4, fill: s.color }));
      root.append(svg("text", { class: "dlabel", x: x(n - 1) + 9, y: y(last) + 4 }, fmt(last) + unit));
    });
    // crosshair + tooltip
    const tip = makeTip(host);
    const cross = svg("line", { x1: 0, x2: 0, y1: m.t, y2: m.t + ih, stroke: "var(--axis)", "stroke-width": 1, opacity: 0 });
    root.append(cross);
    const dots = series.map((s) => { const c = svg("circle", { class: "dot", r: 5, fill: s.color, opacity: 0 }); root.append(c); return c; });
    const hit = svg("rect", { class: "hit", x: m.l, y: m.t, width: iw, height: ih });
    hit.addEventListener("mousemove", (ev) => {
      const rect = host.getBoundingClientRect(), sx = rect.width / W;
      const px = (ev.clientX - rect.left) / sx;
      const i = Math.max(0, Math.min(n - 1, Math.round(((px - m.l) / iw) * (n - 1))));
      cross.setAttribute("x1", x(i)); cross.setAttribute("x2", x(i)); cross.setAttribute("opacity", 1);
      series.forEach((s, k) => { dots[k].setAttribute("cx", x(i)); dots[k].setAttribute("cy", y(s.values[i])); dots[k].setAttribute("opacity", 1); });
      const rows = series.map((s) => `<div class="tr"><span><i class="sw" style="background:${s.color}"></i>${s.label}</span><span>${fmtFull(s.values[i])}${unit}</span></div>`).join("");
      const bandRow = band ? `<div class="tr"><span><i class="sw" style="background:${band.color};opacity:.4"></i>${band.label}</span><span>${fmtFull(band.lo[i])}–${fmtFull(band.hi[i])}${unit}</span></div>` : "";
      tip.show(x(i) * sx, Math.min(...series.map((s) => y(s.values[i]))) * sx, `<b>${mLong(months[i])}</b>${rows}${bandRow}`);
    });
    hit.addEventListener("mouseleave", () => { cross.setAttribute("opacity", 0); dots.forEach((d) => d.setAttribute("opacity", 0)); tip.hide(); });
    root.append(hit);
    host.append(root);
    if (series.length > 1 || band) {
      const lg = el("div", { class: "legend" });
      series.forEach((s) => lg.append(el("span", {}, el("i", { class: "sw line", style: `background:${s.color}` }), s.label)));
      if (band) lg.append(el("span", {}, el("i", { class: "sw", style: `background:${band.color};opacity:.35` }), band.label));
      host.append(lg);
    }
  }

  function tableView(host, { months, series, fmtFull = (v) => v, unit = "" }) {
    host.innerHTML = "";
    const t = el("table", { class: "num" });
    const head = el("tr", {}, el("th", {}, "Month"));
    series.forEach((s) => head.append(el("th", { class: "r" }, s.label)));
    if (series.length > 1) head.append(el("th", { class: "r" }, "Total"));
    t.append(el("thead", {}, head));
    const tb = el("tbody");
    months.forEach((mo, i) => {
      const tr = el("tr", {}, el("td", {}, mLong(mo)));
      series.forEach((s) => tr.append(el("td", { class: "r" }, fmtFull(s.values[i]) + unit)));
      if (series.length > 1) tr.append(el("td", { class: "r" }, fmtFull(sum(series.map((s) => s.values[i]))) + unit));
      tb.append(tr);
    });
    t.append(tb); host.append(t);
  }

  // Card with chart/table toggle
  function chartCard({ title, desc, render, renderTable, span2 = false }) {
    const body = el("div", { class: "chart" });
    const btnChart = el("button", { class: "ghost", "aria-pressed": "true" }, "Chart");
    const btnTable = el("button", { class: "ghost", "aria-pressed": "false" }, "Table");
    let mode = "chart";
    const draw = () => (mode === "chart" ? render(body) : renderTable(body));
    btnChart.onclick = () => { mode = "chart"; btnChart.setAttribute("aria-pressed", "true"); btnTable.setAttribute("aria-pressed", "false"); draw(); };
    btnTable.onclick = () => { mode = "table"; btnChart.setAttribute("aria-pressed", "false"); btnTable.setAttribute("aria-pressed", "true"); draw(); };
    const card = el("section", { class: "card" + (span2 ? " span2" : "") },
      el("div", { class: "card-head" }, el("div", {}, el("h2", {}, title), el("p", {}, desc)), el("div", { class: "card-tools" }, btnChart, btnTable)), body);
    card.redraw = draw;
    draw();
    return card;
  }

  // ---------- data model ----------
  function model(data, valuesCfg, bench) {
    const conv = valuesCfg.conversions;
    const keys = Object.keys(conv);
    const eff = {}, sr = {}, unit = {}; // effective £ per counted event; success rate; £ per completed action
    for (const k of keys) {
      const o = (data.value_overrides || {})[k] || {};
      sr[k] = o.success_rate ?? conv[k].success_rate ?? 1;
      unit[k] = o.value ?? conv[k].value;
      eff[k] = unit[k] * sr[k];
    }
    const today = new Date(); const cur = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    const byMonth = new Map();
    for (const r of data.daily) {
      const mo = r.d.slice(0, 7);
      if (mo >= cur) continue; // complete months only
      let a = byMonth.get(mo);
      if (!a) { a = { month: mo, sessions: 0, users: 0, conv: Object.fromEntries(keys.map((k) => [k, 0])), channels: {}, cc: {}, ads: { cost: 0, clicks: 0, impressions: 0 }, hasCC: false, lastDay: r.d }; byMonth.set(mo, a); }
      a.sessions += r.sessions; a.users += r.users; a.lastDay = r.d;
      for (const k of keys) a.conv[k] += (r.conv || {})[k] || 0;
      for (const [c, v] of Object.entries(r.channels || {})) a.channels[c] = (a.channels[c] || 0) + v;
      if (r.cc) { a.hasCC = true; for (const [c, ks] of Object.entries(r.cc)) { const t = a.cc[c] || (a.cc[c] = {}); for (const [k, v] of Object.entries(ks)) t[k] = (t[k] || 0) + v; } }
      if (r.ads) { a.ads.cost += r.ads.cost || 0; a.ads.clicks += r.ads.clicks || 0; a.ads.impressions += r.ads.impressions || 0; }
    }
    const months = [...byMonth.values()].sort((a, b) => (a.month < b.month ? -1 : 1));
    for (const a of months) {
      a.value = sum(keys.map((k) => a.conv[k] * eff[k]));
      // value and estimated actions by channel (only for days that carry the channel split)
      a.ccValue = Object.fromEntries(Object.entries(a.cc).map(([c, ks]) => [c, sum(keys.map((k) => (ks[k] || 0) * eff[k]))]));
      a.ccActions = Object.fromEntries(Object.entries(a.cc).map(([c, ks]) => [c, sum(keys.map((k) => (ks[k] || 0) * sr[k]))]));
      // "conversions" = estimated completed actions: counted events × success rate, so a page view
      // counted at 25% is a quarter of an action, not a whole one
      a.est = Object.fromEntries(keys.map((k) => [k, a.conv[k] * sr[k]]));
      a.conversions = sum(keys.map((k) => a.est[k]));
      a.valuePer1k = a.sessions ? (a.value / a.sessions) * 1000 : 0;
    }
    let bl = data.baseline;
    if (!bl || !bl.start || !bl.end) {
      // Auto baseline: the first three complete months in which the tracked actions were actually
      // firing (value > 0) on a site with real traffic. Months before tracking worked would make
      // the baseline zero and credit the whole history as "uplift".
      const pos = months.filter((a) => a.value > 0).map((a) => a.value).sort((x, y) => x - y);
      const medV = pos.length ? pos[Math.floor(pos.length / 2)] : 0;
      const ok = (a) => a && a.value >= 0.25 * medV && a.sessions >= 100;
      let i0 = months.findIndex((a, i) => ok(a) && ok(months[i + 1]) && ok(months[i + 2]));
      if (i0 < 0) i0 = Math.max(0, months.findIndex((a) => a.value > 0 && a.sessions >= 100));
      const first = months.slice(i0, i0 + 3);
      bl = first.length ? { start: first[0].month + "-01", end: first[first.length - 1].month + "-28", auto: true } : { start: "0000-00", end: "0000-00" };
    }
    const blMonths = months.filter((a) => a.month >= bl.start.slice(0, 7) && a.month <= bl.end.slice(0, 7));
    const base = {
      months: blMonths,
      value: mean(blMonths.map((a) => a.value)),                  // £ per month
      sessions: mean(blMonths.map((a) => a.sessions)),            // sessions per month
      conversions: mean(blMonths.map((a) => a.conversions)),
      perSession: sum(blMonths.map((a) => a.value)) / Math.max(1, sum(blMonths.map((a) => a.sessions))),
      convRate: Object.fromEntries(keys.map((k) => [k, sum(blMonths.map((a) => a.est[k])) / Math.max(1, sum(blMonths.map((a) => a.sessions)))])),
      label: `${mLabel(bl.start.slice(0, 7))}–${mLabel(bl.end.slice(0, 7))}`,
      auto: !!bl.auto,
    };
    const annotations = (data.annotations || []).filter((a) => a && a.date && a.label).map((a) => ({ month: a.date.slice(0, 7), label: a.label, date: a.date }));
    const benchByMonth = new Map((bench.monthly || []).map((b) => [b.month, b]));
    return { keys, conv, eff, sr, unit, months, base, benchByMonth, annotations, lastDay: months.length ? months[months.length - 1].lastDay : null };
  }

  function slice(M, period) {
    const all = M.months;
    if (!all.length) return [];
    if (period === "6m") return all.slice(-6);
    if (period === "12m") return all.slice(-12);
    if (period === "ytd") { const y = all[all.length - 1].month.slice(0, 4); return all.filter((a) => a.month.startsWith(y)); }
    return all; // since tracking began
  }

  // ---------- render ----------
  async function main() {
    const slug = document.body.dataset.slug;
    const hash = document.body.dataset.gate;
    await gate(hash, slug);

    // Data comes from ../data/*.json, or from window.PMP_INLINE when exported as a single file
    const load = (name) => (window.PMP_INLINE && window.PMP_INLINE[name]) ? Promise.resolve(window.PMP_INLINE[name]) : fetch(`../data/${name}.json`).then((r) => r.json());
    const [data, bench, valuesCfg] = await Promise.all([load(slug), load("benchmark"), load("values")]);
    const M = model(data, valuesCfg, bench);
    if (data.accent) document.documentElement.style.setProperty("--accent", data.accent);
    document.title = `${data.name} · Website value dashboard`;
    if (data.sample) $("#sample-flag").classList.remove("hidden");
    $("#updated").textContent = M.lastDay ? `Data to ${dLong(M.lastDay)}` : "No data yet";

    let period = "12m";
    const seg = $("#period");
    seg.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
      period = b.dataset.p; seg.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); render();
    }));

    const app = $("#app");
    let cards = [];
    let rt; window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => cards.forEach((c) => c.redraw()), 120); });
    function render() {
      app.innerHTML = ""; cards = [];
      const P = slice(M, period);
      if (!P.length) { app.append(el("div", { class: "empty" }, "No complete months of data yet.")); return; }
      const n = P.length, keys = M.keys, B = M.base;
      const periodLabel = { "6m": "last 6 months", "12m": "last 12 months", ytd: `${P[0].month.slice(0, 4)} so far`, all: "since tracking began" }[period];
      const rangeLabel = `${mLong(P[0].month)} to ${mLong(P[n - 1].month)}`;
      const V = sum(P.map((a) => a.value)), S = sum(P.map((a) => a.sessions)), C = sum(P.map((a) => a.conversions));
      const uplift = V - B.value * n;
      const fromTraffic = (S - B.sessions * n) * B.perSession;
      const fromConversion = V - S * B.perSession;
      const you1k = S ? (V / S) * 1000 : 0;
      const bMonths = P.map((a) => M.benchByMonth.get(a.month)).filter(Boolean);
      const bench1k = bMonths.length ? mean(bMonths.map((b) => b.value_per_1k_sessions.median)) : null;
      const benchN = bMonths.length ? Math.max(...bMonths.map((b) => b.n)) : 0;

      // Hero
      const dir = uplift >= 0 ? "more" : "less";
      const hero = el("section", { class: "hero" },
        el("div", {},
          el("p", { class: "lede" }, `Estimated value your website generated, ${periodLabel}`),
          el("div", { class: "big num" }, gbp(V, 0)),
          el("p", { class: "sub", html: `That's <b>${gbp(Math.abs(uplift), 0)} ${dir}</b> than it would have been at your baseline rate of ${gbp(B.value, 0)} a month.` }),
          el("p", { class: "baseline-note" }, `Baseline: ${B.label} average${B.auto ? " (first three months of tracking)" : ""}. Values held constant throughout. ${rangeLabel}.`)),
        el("div", { class: "split" },
          el("p", { class: "small muted", style: "font-weight:600" }, "Where the difference comes from"),
          splitRow("More people visiting the site", fromTraffic, Math.abs(fromTraffic) + Math.abs(fromConversion)),
          splitRow("More of them taking action", fromConversion, Math.abs(fromTraffic) + Math.abs(fromConversion))));
      app.append(hero);

      // Tiles
      const mAvg = (x) => x / n;
      const chg = (now, then) => (then ? ((now - then) / then) * 100 : 0);
      const tiles = el("div", { class: "tiles" },
        tile("Estimated value", gbp(V, 0), `${gbp(mAvg(V), 0)} a month, vs ${gbp(B.value, 0)} at baseline`, chg(mAvg(V), B.value)),
        tile("Estimated actions", int(C), `${int(mAvg(C))} a month, vs ${int(B.conversions)} at baseline`, chg(mAvg(C), B.conversions)),
        tile("Website sessions", int(S), `${int(mAvg(S))} a month, vs ${int(B.sessions)} at baseline`, chg(mAvg(S), B.sessions)),
        tile("Value per 1,000 sessions", gbp(you1k, 0), `Baseline ${gbp(B.perSession * 1000, 0)}`, chg(you1k, B.perSession * 1000)),
        tile("PMP practices average", bench1k != null ? gbp(bench1k, 0) : "—", bench1k != null ? `Median value per 1,000 sessions across ${benchN} practices` : "Not enough practices yet", bench1k != null ? chg(you1k, bench1k) : null, "you vs average"));
      app.append(tiles);

      // Latest month in brief: two plain sentences for the owner who won't read the charts
      const L = M.months[M.months.length - 1], Lp = M.months[M.months.length - 2];
      const Ly = M.months.find((a) => a.month === addMonths(L.month, -12));
      if (L) {
        const vsBase = B.value ? ((L.value - B.value) / B.value) * 100 : 0;
        const vsPrev = Lp && Lp.value ? ((L.value - Lp.value) / Lp.value) * 100 : null;
        const vsYear = Ly && Ly.value ? ((L.value - Ly.value) / Ly.value) * 100 : null;
        const top = keys.map((k) => ({ k, v: L.conv[k] * M.eff[k] })).sort((a, b) => b.v - a.v)[0];
        const best = keys.filter((k) => L.conv[k] > 0 && L.conv[k] >= Math.max(...M.months.map((a) => a.conv[k]))).map((k) => M.conv[k].label.toLowerCase());
        let t1 = `${mLong(L.month)}: ${gbp(L.value, 0)} of estimated value, ${pct(vsBase)} against baseline`;
        if (vsPrev != null) t1 += ` and ${pct(vsPrev)} on ${mLabel(Lp.month, false)}`;
        if (vsYear != null) t1 += ` (${pct(vsYear)} on ${mLong(Ly.month)})`;
        t1 += ".";
        let t2 = top ? `${M.conv[top.k].label} was the biggest contributor at ${gbp(top.v, 0)}.` : "";
        if (best.length) t2 += ` Best month yet for ${best.join(" and ")}.`;
        app.append(el("section", { class: "card brief" }, el("div", { class: "card-head" }, el("div", {}, el("h2", {}, "Latest month in brief"))), el("p", {}, t1 + " " + t2)));
      }

      // Year on year: the last three complete months against the same three months in earlier years
      const last3 = M.months.slice(-3);
      if (last3.length === 3) {
        const byMonth = new Map(M.months.map((a) => [a.month, a]));
        const periods = [0, 1, 2].map((y) => {
          const ms = last3.map((a) => byMonth.get(addMonths(a.month, -12 * y))).filter(Boolean);
          if (ms.length < 3) return null;
          const V = sum(ms.map((a) => a.value)), S = sum(ms.map((a) => a.sessions)), C = sum(ms.map((a) => a.conversions));
          return { y, label: `${mLabel(ms[0].month, false)}–${mLabel(ms[2].month, false)} ${ms[0].month.slice(0, 4)}`, V, S, C, per1k: S ? (V / S) * 1000 : 0 };
        }).filter(Boolean);
        if (periods.length >= 2) {
          const rows = [["Estimated value", (p) => gbp(p.V, 0), "V"], ["Conversions", (p) => int(p.C), "C"], ["Website sessions", (p) => int(p.S), "S"], ["Value per 1,000 sessions", (p) => gbp(p.per1k, 0), "per1k"]];
          const tbl = el("table", { class: "num" }, el("thead", {}, el("tr", {}, el("th", {}, ""), ...periods.map((p) => el("th", { class: "r" }, p.label)))));
          const tb = el("tbody");
          for (const [label, fmt, key] of rows) {
            tb.append(el("tr", {}, el("td", {}, label), ...periods.map((p, i) => {
              const prev = periods[i + 1];
              const cell = el("td", { class: "r" }, el("b", {}, fmt(p)));
              if (prev && prev[key]) cell.append(el("span", { class: "chg" }, `${pct(((p[key] - prev[key]) / prev[key]) * 100)} on ${prev.label.split(" ").pop()}`));
              return cell;
            })));
          }
          tbl.append(tb);
          const maxV = Math.max(...periods.map((p) => p.V));
          const bars = el("div", { class: "yoy-bars" }, ...periods.map((p, i) => el("div", { class: "row " + (i === 1 ? "prev" : i === 2 ? "prev2" : "") },
            el("span", {}, p.label), el("div", { class: "track" }, el("i", { style: `width:${(p.V / maxV) * 100}%` })), el("span", { class: "v num" }, gbpShort(p.V)))));
          const first = periods[0], oldest = periods[periods.length - 1];
          const growth = oldest.V ? ((first.V - oldest.V) / oldest.V) * 100 : 0;
          app.append(el("section", { class: "card brief" }, el("div", { class: "card-head" }, el("div", {}, el("h2", {}, "Same three months, year on year"),
            el("p", {}, `${first.label} against the same months in earlier years. Same season, same values, so the change is real. Value is ${pct(growth)} on ${oldest.label.split(" ").pop()}.`))),
            el("div", { class: "yoy" }, el("div", { style: "overflow-x:auto" }, tbl), bars)));
        }
      }

      const grid = el("div", { class: "grid" });

      // 1. Monthly value stacked
      const monthsArr = P.map((a) => a.month);
      const valueSeries = keys.map((k) => ({ key: k, label: M.conv[k].label, color: SLOT[M.conv[k].slot], values: P.map((a) => a.conv[k] * M.eff[k]) }));
      grid.append(chartCard({
        title: "Monthly website value", desc: `Estimated value of each month's conversions, against your ${B.label} baseline.`, span2: true,
        render: (h) => stackedBars(h, { months: monthsArr, series: valueSeries, markers: M.annotations, ref: { value: B.value, label: `Baseline ${gbpShort(B.value)}/month` } }),
        renderTable: (h) => tableView(h, { months: monthsArr, series: valueSeries, fmtFull: (v) => gbp(v, 0) }),
      }));

      // 2. Cumulative uplift
      let acc = 0; const cum = P.map((a) => (acc += a.value - B.value));
      grid.append(chartCard({
        title: "Extra value above baseline, running total", desc: "Each month's value minus the baseline monthly average, added up over time.",
        render: (h) => lineChart(h, { months: monthsArr, series: [{ label: "Running total", color: "var(--accent)", values: cum }], fmtFull: (v) => gbp(v, 0) }),
        renderTable: (h) => tableView(h, { months: monthsArr, series: [{ label: "Running total", values: cum }], fmtFull: (v) => gbp(v, 0) }),
      }));

      // 3. Value per 1k sessions vs PMP median
      const you1kSeries = P.map((a) => a.valuePer1k);
      const hasBench = P.some((a) => M.benchByMonth.get(a.month));
      const med = P.map((a) => M.benchByMonth.get(a.month)?.value_per_1k_sessions.median ?? null);
      const fillGaps = (arr) => arr.map((v, i, s) => v ?? s.slice(0, i).reverse().find((x) => x != null) ?? s.find((x) => x != null) ?? 0);
      const lo = fillGaps(P.map((a) => M.benchByMonth.get(a.month)?.value_per_1k_sessions.p25 ?? null));
      const hi = fillGaps(P.map((a) => M.benchByMonth.get(a.month)?.value_per_1k_sessions.p75 ?? null));
      const series1k = [{ label: data.name, color: "var(--accent)", values: you1kSeries }];
      if (hasBench) series1k.push({ label: "PMP practices median", color: "var(--bench)", values: fillGaps(med) });
      grid.append(chartCard({
        title: "Value per 1,000 sessions", desc: "How hard the site works per visitor, compared with the anonymised PMP median and middle 50% range.",
        render: (h) => lineChart(h, { months: monthsArr, series: series1k, band: hasBench ? { lo, hi, color: "var(--bench)", label: "PMP middle 50%" } : null, fmtFull: (v) => gbp(v, 0) }),
        renderTable: (h) => tableView(h, { months: monthsArr, series: series1k, fmtFull: (v) => gbp(v, 0) }),
      }));

      // 4. Conversion table
      const tbl = el("table", { class: "num" }, el("thead", {}, el("tr", {},
        el("th", {}, "Action"), el("th", { class: "r" }, "Est. actions"), el("th", { class: "r" }, "Value each"), el("th", { class: "r" }, "Est. value"),
        el("th", { class: "r" }, "Per month"), el("th", { class: "r" }, "vs baseline"), el("th", { class: "r" }, "Per 1k sessions"), el("th", { class: "r" }, "PMP median"))));
      const tb = el("tbody");
      for (const k of keys) {
        const raw = sum(P.map((a) => a.conv[k])), c = raw * M.sr[k], v = raw * M.eff[k];
        const per1k = S ? (c / S) * 1000 : 0;
        const bm = bMonths.length ? mean(bMonths.map((b) => b.per_1k_sessions[k]?.median ?? 0)) : null;
        const blRate = B.convRate[k] * 1000;
        const d = blRate ? ((per1k - blRate) / blRate) * 100 : 0;
        tb.append(el("tr", {},
          el("td", {}, el("i", { class: "sw", style: `background:${SLOT[M.conv[k].slot]}` }), M.conv[k].label),
          el("td", { class: "r" }, int(c), M.sr[k] < 1 ? el("span", { class: "muted small", style: "display:block" }, `${int(raw)} counted × ${Math.round(M.sr[k] * 100)}%`) : null),
          el("td", { class: "r" }, gbp(M.unit[k], 0)), el("td", { class: "r" }, gbp(v, 0)),
          el("td", { class: "r" }, (c / n).toFixed(1)),
          el("td", { class: "r" }, chip(d, "rate")),
          el("td", { class: "r" }, per1k.toFixed(1)),
          el("td", { class: "r muted" }, bm != null ? bm.toFixed(1) : "—")));
      }
      tbl.append(tb, el("tfoot", {}, el("tr", {}, el("td", {}, "All actions"), el("td", { class: "r" }, int(C)), el("td"), el("td", { class: "r" }, gbp(V, 0)),
        el("td", { class: "r" }, (C / n).toFixed(1)), el("td", { class: "r" }, chip(chg(C / S, B.conversions / B.sessions), "rate")), el("td", { class: "r" }, (S ? (C / S) * 1000 : 0).toFixed(1)),
        el("td", { class: "r muted" }, bMonths.length ? mean(bMonths.map((b) => b.per_1k_sessions.all_conversions.median)).toFixed(1) : "—"))));
      grid.append(el("section", { class: "card span2" }, el("div", { class: "card-head" }, el("div", {}, el("h2", {}, "What people did on the site"),
        el("p", {}, `Conversion actions ${rangeLabel}. "vs baseline" compares the rate per 1,000 sessions, so it isolates the site's effectiveness from traffic volume.`))), el("div", { style: "overflow-x:auto" }, tbl)));

      // 5. Benchmark bars
      if (bMonths.length) {
        const rows = el("div", { class: "bench-rows" });
        for (const k of keys) {
          const c = sum(P.map((a) => a.est[k])); const you = S ? (c / S) * 1000 : 0;
          const st = { median: mean(bMonths.map((b) => b.per_1k_sessions[k]?.median ?? 0)), p25: mean(bMonths.map((b) => b.per_1k_sessions[k]?.p25 ?? 0)), p75: mean(bMonths.map((b) => b.per_1k_sessions[k]?.p75 ?? 0)) };
          rows.append(benchRow(M.conv[k].label, you, st));
        }
        const youAll = S ? (C / S) * 1000 : 0;
        const stAll = { median: mean(bMonths.map((b) => b.per_1k_sessions.all_conversions.median)), p25: mean(bMonths.map((b) => b.per_1k_sessions.all_conversions.p25)), p75: mean(bMonths.map((b) => b.per_1k_sessions.all_conversions.p75)) };
        rows.append(benchRow("All actions", youAll, stAll));
        grid.append(el("section", { class: "card" }, el("div", { class: "card-head" }, el("div", {}, el("h2", {}, "How you compare"),
          el("p", {}, `Conversions per 1,000 sessions against ${benchN} PMP practices (anonymised). Grey bar is the middle 50%; the line is the median.`))), rows,
          el("div", { class: "bench-key" }, el("span", {}, el("i", { class: "dotk" }), data.name), el("span", {}, el("i", { class: "medk" }), "PMP median"), el("span", {}, el("i", { class: "rangek" }), "Middle 50% of practices"))));
      }

      // 6. Channels: where the value came from, and where the visitors came from
      const chNames = valuesCfg.channel_groups || [];
      const chSeries = chNames.map((c, i) => ({ label: c, color: CH[i % CH.length], values: P.map((a) => a.channels[c] || 0) })).filter((s) => sum(s.values) > 0);
      const hasCC = P.some((a) => a.hasCC);
      const cvSeries = chNames.map((c, i) => ({ label: c, color: CH[i % CH.length], values: P.map((a) => a.ccValue[c] || 0) })).filter((s) => sum(s.values) > 0);
      if (hasCC && cvSeries.length) {
        grid.append(chartCard({
          title: "Where the value came from", desc: "Estimated value by the channel that brought the visitor: organic search, direct, paid, social and so on.",
          render: (h) => stackedBars(h, { months: monthsArr, series: cvSeries }),
          renderTable: (h) => tableView(h, { months: monthsArr, series: cvSeries, fmtFull: (v) => gbp(v, 0) }),
        }));
      }
      grid.append(chartCard({
        title: "Where visitors came from", desc: "Monthly sessions by channel.",
        render: (h) => stackedBars(h, { months: monthsArr, series: chSeries, fmt: (v) => (v >= 1000 ? (v / 1000).toFixed(v >= 10000 ? 0 : 1) + "k" : String(Math.round(v))), fmtFull: int }),
        renderTable: (h) => tableView(h, { months: monthsArr, series: chSeries, fmtFull: int }),
      }));
      if (hasCC && cvSeries.length) {
        // per-channel table: sessions, actions, value, £ per 1k, share of value
        const ct = el("table", { class: "num" }, el("thead", {}, el("tr", {}, el("th", {}, "Channel"), el("th", { class: "r" }, "Sessions"), el("th", { class: "r" }, "Est. actions"), el("th", { class: "r" }, "Est. value"), el("th", { class: "r" }, "£ per 1k sessions"), el("th", { class: "r" }, "Share of value"))));
        const ctb = el("tbody");
        const chRows = chNames.map((c, i) => ({ c, color: CH[i % CH.length], S: sum(P.map((a) => a.channels[c] || 0)), A: sum(P.map((a) => a.ccActions[c] || 0)), V: sum(P.map((a) => a.ccValue[c] || 0)) })).filter((r) => r.S > 0 || r.V > 0).sort((a, b) => b.V - a.V);
        const totV = sum(chRows.map((r) => r.V)) || 1;
        chRows.forEach((r) => ctb.append(el("tr", {}, el("td", {}, el("i", { class: "sw", style: `background:${r.color}` }), r.c), el("td", { class: "r" }, int(r.S)), el("td", { class: "r" }, int(r.A)), el("td", { class: "r" }, gbp(r.V, 0)), el("td", { class: "r" }, gbp(r.S ? (r.V / r.S) * 1000 : 0, 0)), el("td", { class: "r" }, pct((r.V / totV) * 100).replace("+", "")))));
        ct.append(ctb);
        grid.append(el("section", { class: "card span2" }, el("div", { class: "card-head" }, el("div", {}, el("h2", {}, "Value by channel"), el("p", {}, `${rangeLabel}. £ per 1,000 sessions shows which channels bring people who act, not just people.`))), el("div", { style: "overflow-x:auto" }, ct)));
      }

      // 7. Google Ads, where the GA4 property is linked to an Ads account
      const adsCost = sum(P.map((a) => a.ads.cost));
      if (adsCost > 0 || data.google_ads) {
        const paidS = sum(P.map((a) => a.channels["Paid Search"] || 0));
        const paidA = sum(P.map((a) => a.ccActions["Paid Search"] || 0));
        const paidV = sum(P.map((a) => a.ccValue["Paid Search"] || 0));
        const clicks = sum(P.map((a) => a.ads.clicks));
        const adsMonths = P.filter((a) => a.ads.cost > 0).length;
        const adsTiles = el("div", { class: "tiles", style: "grid-template-columns: repeat(5, 1fr); margin: 0 0 14px" },
          tile("Spend", gbp(adsCost, 0), `${adsMonths} month${adsMonths === 1 ? "" : "s"} with spend · ${int(clicks)} ad clicks`),
          tile("Paid search sessions", int(paidS), `${pct(S ? (paidS / S) * 100 : 0).replace("+", "")} of all sessions`),
          tile("Paid actions", int(paidA), `${paidA ? gbp(adsCost / paidA, 0) : "—"} cost per action`),
          tile("Paid value", gbp(paidV, 0), `${pct(V ? (paidV / V) * 100 : 0).replace("+", "")} of all value`),
          tile("Value per £1 spent", adsCost ? `£${(paidV / adsCost).toFixed(2)}` : "—", "estimated value from paid search ÷ spend"));
        const adsSeries = [{ label: "Spend", color: "var(--bench)", values: P.map((a) => a.ads.cost) }, { label: "Value from paid search", color: "var(--s2)", values: P.map((a) => a.ccValue["Paid Search"] || 0) }];
        const adsCard = chartCard({
          title: "Google Ads", desc: "Spend from the linked Google Ads account against the estimated value of actions by visitors who arrived from paid search. Top line only; campaign detail lives in Google Ads.", span2: true,
          render: (h) => lineChart(h, { months: monthsArr, series: adsSeries, fmtFull: (v) => gbp(v, 0) }),
          renderTable: (h) => tableView(h, { months: monthsArr, series: [...adsSeries, { label: "Ad clicks", values: P.map((a) => a.ads.clicks) }, { label: "Paid search sessions", values: P.map((a) => a.channels["Paid Search"] || 0) }], fmtFull: (v) => (Number.isInteger(v) ? int(v) : gbp(v, 0)) }),
        });
        adsCard.insertBefore(adsTiles, adsCard.querySelector(".chart"));
        if (!adsCost) adsCard.insertBefore(el("p", { class: "muted small", style: "margin:-6px 0 12px" }, "No spend is reaching GA4 yet. The Google Ads account needs linking to this GA4 property (GA4 Admin, Product links, Google Ads links); spend appears the day after."), adsCard.querySelector(".chart"));
        grid.append(adsCard);
      }

      app.append(grid);
      cards = [...grid.querySelectorAll("section.card")].filter((c) => c.redraw);
      cards.forEach((c) => c.redraw());

      // Methodology
      const vt = el("table", {}, el("thead", {}, el("tr", {}, el("th", {}, "Action"), el("th", { class: "r" }, "Value (ex VAT)"), el("th", { class: "r" }, "Completion assumed"))));
      const vtb = el("tbody");
      for (const k of keys) { const o = (data.value_overrides || {})[k] || {}; vtb.append(el("tr", {}, el("td", {}, M.conv[k].label), el("td", { class: "r num" }, gbp(o.value ?? M.conv[k].value, 0)), el("td", { class: "r num" }, Math.round((o.success_rate ?? M.conv[k].success_rate ?? 1) * 100) + "%"))); }
      vt.append(vtb);
      app.append(el("section", { class: "card" }, el("div", { class: "card-head" }, el("div", {}, el("h2", {}, "How we work this out"))),
        el("div", { class: "method" },
          el("div", {},
            el("p", {}, `We track the moments on your website where a client commits to something: clicking to book, starting a health plan sign-up, tapping to call, emailing, or applying for a job. Each action carries a notional value, agreed with you and based on what that outcome is typically worth to a practice.`),
            el("p", {}, `Where a tool lets us see a confirmation page we count completions. Where it doesn't, we count the click or page that starts the journey and keep the value conservative to allow for people who don't finish.`),
            el("p", {}, `The important thing is that the values never change month to month. That means any rise or fall in the chart is real movement in client behaviour, not a change in how we count. Your baseline is the ${B.label} average, set before our marketing work took effect.`),
            el("p", {}, `The PMP average is calculated per 1,000 sessions across the independent practices we work with, so a two-site practice and a ten-site group are compared fairly. No practice can be identified from it.`)),
          el("div", {}, el("h3", { style: "margin-bottom:8px" }, "Values used"), vt))));
      app.append(el("div", { class: "footer" }, el("span", {}, `Prepared by Practice Made Purrfect for ${data.name}. Source: Google Analytics 4.`), el("span", {}, $("#updated").textContent)));
    }

    function tile(k, v, d, delta, deltaLabel) {
      const t = el("div", { class: "tile" }, el("div", { class: "k" }, k), el("div", { class: "v num" }, v), el("div", { class: "d" }, d));
      if (delta != null && isFinite(delta)) t.append(el("div", { style: "margin-top:6px" }, chip(delta, deltaLabel)));
      return t;
    }
    function chip(delta, label) {
      const cls = delta > 0.5 ? "up" : delta < -0.5 ? "down" : "";
      const arrow = delta > 0.5 ? "▲ " : delta < -0.5 ? "▼ " : "";
      return el("span", { class: "chip " + cls }, `${arrow}${pct(delta)}${label ? " " + label : ""}`);
    }
    function splitRow(label, v, total) {
      const w = total ? Math.min(100, (Math.abs(v) / total) * 100) : 0;
      return el("div", {}, el("div", { class: "label" }, el("span", {}, label), el("b", { class: "num " + (v < 0 ? "down" : "") }, gbp(v, 0))),
        el("div", { class: "bar" }, el("i", { style: `width:${w}%${v < 0 ? ";background:var(--bad)" : ""}` })));
    }
    function benchRow(label, you, st) {
      const max = Math.max(you, st.p75) * 1.25 || 1;
      const px = (v) => (v / max) * 100;
      const diff = st.median ? ((you - st.median) / st.median) * 100 : 0;
      return el("div", { class: "bench-row" },
        el("div", { class: "lbl" }, el("span", {}, label), el("span", {}, el("b", { class: "num" }, you.toFixed(1)), el("span", { class: "muted" }, ` vs ${st.median.toFixed(1)} median `), chip(diff))),
        el("div", { class: "track" },
          el("div", { class: "range", style: `left:${px(st.p25)}%;width:${Math.max(px(st.p75) - px(st.p25), 0.5)}%` }),
          el("div", { class: "med", style: `left:${px(st.median)}%` }),
          el("div", { class: "you", style: `left:${px(you)}%` }, el("i"))));
    }

    render();
  }

  window.PMPV = { model, slice, gate, sha256, el, gbp, gbpShort, int, pct, mean, sum, mLong, mLabel, dLong, stackedBars, lineChart, tableView, chartCard, SLOT };
  if (document.body.dataset.slug) {
    main().catch((e) => { console.error(e); const a = $("#app"); if (a) a.innerHTML = `<div class="empty">Couldn't load the dashboard data. ${e.message}</div>`; });
  }
})();
