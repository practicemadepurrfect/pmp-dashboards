/* PMP master dashboard: every practice at a glance. Uses helpers and charts from app.js. */
(async () => {
  const { model, gate, sha256, el, gbp, gbpShort, int, pct, mean, sum, dLong, mLabel, mLong, stackedBars, lineChart, tableView, chartCard, SLOT } = window.PMPV;
  const $ = (s) => document.querySelector(s);
  const adminCode = await gate(document.body.dataset.gate, "overview");

  // One-click links to client dashboards. build_site.py seals each practice passcode with the
  // admin passcode (see seal() there); with the admin passcode in hand we can open them.
  function unseal(slug, hex) {
    if (!adminCode || !hex) return null;
    const data = hex.match(/../g).map((b) => parseInt(b, 16));
    let stream = [];
    for (let i = 0; stream.length < data.length; i++) stream = stream.concat(sha256(`${adminCode}:${slug}:${i}`).match(/../g).map((b) => parseInt(b, 16)));
    return new TextDecoder().decode(new Uint8Array(data.map((b, i) => b ^ stream[i])));
  }
  let sealed = {};
  try { sealed = JSON.parse(document.body.dataset.links || "{}"); } catch (e) {}
  const openLink = (slug) => { const code = unseal(slug, sealed[slug]); return code ? `${slug}/#k=${encodeURIComponent(code)}` : `${slug}/`; };
  const hasKey = (slug) => !!(adminCode && sealed[slug]);

  const [index, bench, valuesCfg, alerts] = await Promise.all([
    fetch("data/index.json").then((r) => r.json()),
    fetch("data/benchmark.json").then((r) => r.json()),
    fetch("data/values.json").then((r) => r.json()),
    fetch("data/alerts.json").then((r) => (r.ok ? r.json() : { alerts: [] })).catch(() => ({ alerts: [] })),
  ]);
  const practices = index.practices;
  const datasets = await Promise.all(practices.map((p) => fetch(`data/${p.slug}.json`).then((r) => r.json())));
  const conv = valuesCfg.conversions, keys = Object.keys(conv);
  const models = datasets.map((d) => model(d, valuesCfg, bench));
  const meta = Object.fromEntries(practices.map((p) => [p.slug, p]));

  let period = "12m";
  let sortKey = "uplift", sortDir = -1;

  // Which practices are in view. Segments (small animal, equine, farm, group site) and individual
  // toggles; remembered for the session. Everything on the page, including the median, follows it.
  const segments = index.segments || { "small-animal": "Small animal", equine: "Equine", farm: "Farm", group: "Group site" };
  const segOf = (slug) => (meta[slug] && meta[slug].segment) || "small-animal";
  let selected = new Set(practices.map((p) => p.slug));
  try { const saved = JSON.parse(sessionStorage.getItem("pmp-ov-selected") || "null"); if (Array.isArray(saved) && saved.length) selected = new Set(saved.filter((s) => meta[s])); } catch (e) {}
  const remember = () => { try { sessionStorage.setItem("pmp-ov-selected", JSON.stringify([...selected])); } catch (e) {} };
  const median = (arr) => { const a = [...arr].sort((x, y) => x - y); const n = a.length; return n ? (n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2) : null; };
  const quantile = (arr, q) => { const a = [...arr].sort((x, y) => x - y); if (!a.length) return null; const pos = (a.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos); return a[lo] + (a[hi] - a[lo]) * (pos - lo); };
  // Live benchmark over the selected practices: value per 1,000 sessions per month, median and middle 50%,
  // only months with 3+ practices reporting 100+ sessions. Same definition as the published pool.
  function liveBench(W, Ms) {
    return W.map((m) => {
      const vals = Ms.map((M) => M.months.find((a) => a.month === m)).filter((a) => a && a.sessions >= 100).map((a) => a.valuePer1k);
      return vals.length >= 3 ? { month: m, n: vals.length, median: median(vals), p25: quantile(vals, 0.25), p75: quantile(vals, 0.75) } : null;
    });
  }
  const seg = $("#period");
  seg.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
    period = b.dataset.p; seg.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); render();
  }));

  // One shared month window so every practice is compared over the same calendar months.
  const allMonths = [...new Set(models.flatMap((M) => M.months.map((a) => a.month)))].sort();
  function windowMonths() {
    if (!allMonths.length) return [];
    const last = allMonths[allMonths.length - 1];
    if (period === "6m") return allMonths.slice(-6);
    if (period === "12m") return allMonths.slice(-12);
    if (period === "ytd") return allMonths.filter((m) => m.startsWith(last.slice(0, 4)));
    return allMonths;
  }

  const chip = (d, cls = "") => { const c = d > 0.5 ? "up" : d < -0.5 ? "down" : ""; return el("span", { class: `chip ${c} ${cls}` }, `${d > 0.5 ? "▲ " : d < -0.5 ? "▼ " : ""}${pct(d)}`); };
  const spark = (vals) => {
    const w = 110, h = 28, max = Math.max(...vals, 1), min = Math.min(...vals, 0);
    const x = (i) => (vals.length === 1 ? w / 2 : (i / (vals.length - 1)) * w), y = (v) => h - 2 - ((v - min) / (max - min || 1)) * (h - 4);
    const d = vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
    const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.setAttribute("viewBox", `0 0 ${w} ${h}`); s.setAttribute("class", "spark");
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path"); p.setAttribute("d", d); s.append(p);
    return s;
  };
  const tileEl = (k, v, d) => el("div", { class: "tile" }, el("div", { class: "k" }, k), el("div", { class: "v num" }, v), el("div", { class: "d" }, d));
  const fillGaps = (arr) => arr.map((v, i, s) => v ?? s.slice(0, i).reverse().find((x) => x != null) ?? s.find((x) => x != null) ?? 0);

  let cards = [];
  let rt; window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => cards.forEach((c) => c.redraw()), 120); });

  function render() {
    const W = windowMonths();
    const Wset = new Set(W);
    const rows = [];
    let latest = null;
    const onModels = models.filter((M, i) => selected.has(datasets[i].slug));
    const bmLive = liveBench(W, onModels);
    const liveByMonth = new Map(bmLive.filter(Boolean).map((b) => [b.month, b]));
    datasets.forEach((data, i) => {
      const M = models[i], pm = meta[data.slug] || {};
      const on = selected.has(data.slug);
      const P = M.months.filter((a) => Wset.has(a.month));
      if (M.lastDay && (!latest || M.lastDay > latest)) latest = M.lastDay;
      const tracked = new Set(data.tracked || pm.tracked || []);
      if (!P.length) { rows.push({ data, M, pm, on, tracked, empty: true, name: data.name, lastDay: M.lastDay }); return; }
      const n = P.length, V = sum(P.map((a) => a.value)), S = sum(P.map((a) => a.sessions)), C = sum(P.map((a) => a.conversions));
      const uplift = V - M.base.value * n;
      const upPct = M.base.value ? (uplift / (M.base.value * n)) * 100 : 0;
      const you1k = S ? (V / S) * 1000 : 0;
      const bm = P.map((a) => liveByMonth.get(a.month)).filter(Boolean);
      const bench1k = bm.length ? mean(bm.map((b) => b.median)) : null;
      const vsMed = bench1k ? ((you1k - bench1k) / bench1k) * 100 : null;
      const byKey = Object.fromEntries(keys.map((k) => [k, sum(P.map((a) => a.conv[k]))]));
      rows.push({ data, M, pm, on, tracked, name: data.name, n, V, S, C, uplift, upPct, you1k, bench1k, vsMed, byKey,
        monthly: W.map((m) => P.find((a) => a.month === m)?.value ?? 0), base: M.base, lastDay: M.lastDay });
    });

    // ----- totals and combined series (selected practices only) -----
    const shown = rows.filter((r) => r.on);
    const live = shown.filter((r) => !r.empty);
    const tot = { V: sum(live.map((r) => r.V)), up: sum(live.map((r) => r.uplift)), C: sum(live.map((r) => r.C)), S: sum(live.map((r) => r.S)) };
    const combined = keys.map((k) => ({ key: k, label: conv[k].label, color: SLOT[conv[k].slot],
      values: W.map((m) => sum(onModels.map((M) => { const a = M.months.find((x) => x.month === m); return a ? a.conv[k] * M.eff[k] : 0; }))) }));
    const reporting = W.map((m) => onModels.filter((M) => M.months.some((x) => x.month === m && x.sessions > 0)).length);
    const hasBench = bmLive.some(Boolean);
    const med = fillGaps(bmLive.map((b) => b?.median ?? null));
    const lo = fillGaps(bmLive.map((b) => b?.p25 ?? null));
    const hi = fillGaps(bmLive.map((b) => b?.p75 ?? null));
    const lastB = [...bmLive].reverse().find(Boolean) || null;
    const selLabel = selected.size === practices.length ? "all practices" : `${selected.size} of ${practices.length} practices`;

    const app = $("#app"); app.innerHTML = ""; cards = [];

    // ----- tracking health -----
    const issues = alerts.alerts || [];
    const untracked = rows.filter((r) => r.tracked.size === 0).map((r) => r.name);
    if (issues.length || untracked.length) {
      const serious = issues.some((a) => a.level === "serious");
      const ul = el("ul");
      issues.forEach((a) => ul.append(el("li", {}, el("b", {}, a.name + ": "), a.message)));
      if (untracked.length) ul.append(el("li", {}, el("b", {}, "No actions mapped yet: "), untracked.join(", "), ". These sites count sessions only until rules are added in config/practices.json."));
      const count = issues.length + (untracked.length ? 1 : 0);
      app.append(el("section", { class: "card alerts" + (serious ? "" : " warn") }, el("div", { class: "card-head" }, el("div", {}, el("h2", {}, `Tracking health: ${count} thing${count > 1 ? "s" : ""} to check`),
        el("p", {}, "If an event stops firing, the baseline comparison stops being true. Fix these before anyone reads their dashboard."))), ul));
    } else {
      app.append(el("section", { class: "card", style: "margin-bottom:16px;border-left:5px solid var(--good)" }, el("div", { class: "card-head" }, el("div", {}, el("h2", {}, "Tracking health: all clear"), el("p", {}, "Fresh data for every practice, every mapped event still firing.")))));
    }

    // ----- which practices -----
    const segBtns = el("div", { class: "seg" });
    const allOn = selected.size === practices.length;
    const mk = (label, pressed, fn) => { const b = el("button", { "aria-pressed": String(pressed) }, label); b.onclick = () => { fn(); remember(); render(); }; return b; };
    segBtns.append(mk("All", allOn, () => { selected = new Set(practices.map((p) => p.slug)); }));
    Object.entries(segments).forEach(([k, label]) => {
      const members = practices.filter((p) => segOf(p.slug) === k).map((p) => p.slug);
      if (!members.length) return;
      const allIn = members.every((s) => selected.has(s));
      segBtns.append(mk(`${label} (${members.length})`, allIn && !allOn, () => {
        // click a segment: show only that segment; click it again while it's the only thing shown: back to all
        const onlyThis = allIn && [...selected].every((s) => segOf(s) === k);
        selected = onlyThis ? new Set(practices.map((p) => p.slug)) : new Set(members);
      }));
    });
    const chips = el("div", { class: "pchips" });
    [...practices].sort((a, b) => a.name.localeCompare(b.name)).forEach((p) => {
      const on = selected.has(p.slug);
      const c = el("button", { class: "pchip" + (on ? " on" : ""), "aria-pressed": String(on), title: segments[segOf(p.slug)] || "" }, p.name.replace(/ Vets?$/, ""));
      c.onclick = () => { if (on) { if (selected.size > 1) selected.delete(p.slug); } else selected.add(p.slug); remember(); render(); };
      chips.append(c);
    });
    app.append(el("section", { class: "card", style: "margin-bottom:16px" }, el("div", { class: "card-head" }, el("div", {}, el("h2", {}, `Showing ${selLabel}`),
      el("p", {}, "Pick a segment, or switch individual practices on and off. Totals, charts, the table and the median all follow. Equine and farm sites run a different model from small animal, so compare like with like."))),
      segBtns, chips));

    // ----- client dashboard buttons -----
    const pubs = practices.filter((p) => p.public !== false).sort((a, b) => a.name.localeCompare(b.name));
    if (pubs.length) {
      const btns = el("div", { class: "seg links" });
      pubs.forEach((p) => btns.append(el("a", { class: "btn", href: openLink(p.slug), target: "_blank", rel: "noopener", title: hasKey(p.slug) ? "Opens unlocked in a new tab" : "Opens in a new tab (passcode needed)" }, p.name.replace(/ Vets?$/, ""))));
      const copyAll = el("button", { class: "ghost", onclick: async () => {
        const text = pubs.map((p) => `${p.name}: ${new URL(openLink(p.slug), location.href).href}`).join("\n");
        try { await navigator.clipboard.writeText(text); copyAll.textContent = "Copied"; setTimeout(() => (copyAll.textContent = "Copy all links"), 1500); } catch (e) { prompt("Copy these links", text); }
      } }, "Copy all links");
      app.append(el("section", { class: "card", style: "margin-bottom:16px" }, el("div", { class: "card-head" }, el("div", {}, el("h2", {}, "Client dashboards"),
        el("p", {}, hasKey(pubs[0].slug) ? "Each button opens that practice's dashboard already unlocked, in a new tab. The link it opens carries the passcode after the #, so it's safe to paste straight to the client."
          : "Each button opens that practice's dashboard in a new tab.")), el("div", { class: "card-tools" }, copyAll)), btns));
    }

    // ----- headline -----
    const publicCount = practices.filter((p) => p.public !== false).length;
    const label = period === "6m" ? "last 6 months" : period === "12m" ? "last 12 months" : period === "ytd" ? "this year" : "since tracking began";
    app.append(el("section", { class: "hero" },
      el("div", {},
        el("div", { class: "lede" }, `Combined website value, ${label}`),
        el("div", { class: "big num" }, gbp(tot.V, 0)),
        el("p", { class: "sub" }, "Across ", el("b", {}, `${live.length} practice${live.length === 1 ? "" : "s"}`), " with complete months in this window. ",
          el("b", { class: tot.up >= 0 ? "" : "" }, gbp(tot.up, 0)), ` ${tot.up >= 0 ? "above" : "below"} what their baselines would have produced.`),
        el("div", { class: "baseline-note" }, W.length ? `${mLong(W[0])} to ${mLong(W[W.length - 1])} · complete months only · each practice measured against its own baseline` : "")),
      el("div", { class: "split" },
        splitRow("Est. actions", int(tot.C), "counted events × success rate"),
        splitRow("Sessions", int(tot.S), `${gbp(tot.S ? (tot.V / tot.S) * 1000 : 0, 0)} per 1,000`),
        splitRow("Median of selection", lastB ? gbp(lastB.median, 0) : "—", lastB ? `per 1,000 sessions, ${mLong(lastB.month)}, ${lastB.n} practices` : "needs 3+ practices with data"))));

    app.append(el("div", { class: "tiles", style: "grid-template-columns: repeat(4, 1fr)" },
      tileEl("Practices tracked", String(practices.length), `${publicCount} with a client dashboard · ${practices.length - publicCount} internal only`),
      tileEl("Client benchmark pool", `${bench.practices_in_pool}`, "small-animal practices in the anonymised average clients see"),
      tileEl("Full coverage", String(shown.filter((r) => r.tracked.size === keys.length).length), `of the ${shown.length} shown measure all ${keys.length} actions`),
      tileEl("Values version", String(valuesCfg.values_version || "—").split(" ")[0], (String(valuesCfg.values_version || "").split(" ").slice(1).join(" ").replace(/^\(|\)$/g, "") || "config/values.json") + " · history re-rates consistently")));

    // ----- charts -----
    const grid = el("div", { class: "grid" });
    grid.append(chartCard({
      title: "Combined monthly value", desc: `Estimated value of the ${selLabel} added together, by action. Practices join as their tracking starts, so the median chart is the like-for-like view.`, span2: true,
      render: (h) => stackedBars(h, { months: W, series: combined }),
      renderTable: (h) => tableView(h, { months: W, series: combined, fmtFull: (v) => gbp(v, 0) }),
    }));
    if (hasBench) {
      const s = [{ label: "Median", color: "var(--bench)", values: med }];
      grid.append(chartCard({
        title: "Value per 1,000 sessions: median of selection", desc: `The middle practice each month among the ${selLabel}, with the middle 50% shaded. Controls for traffic and for how many practices are reporting. Recalculated live as you change the selection.`,
        render: (h) => lineChart(h, { months: W, series: s, band: { lo, hi, color: "var(--bench)", label: "Middle 50%" }, fmtFull: (v) => gbp(v, 0) }),
        renderTable: (h) => tableView(h, { months: W, series: [...s, { label: "p25", values: lo }, { label: "p75", values: hi }], fmtFull: (v) => gbp(v, 0) }),
      }));
    }
    const chNames = valuesCfg.channel_groups || [];
    const CHC = ["var(--c1)", "var(--c2)", "var(--c3)", "var(--c4)", "var(--c5)", "var(--c6)"];
    const cvSeries = chNames.map((c, i) => ({ label: c, color: CHC[i % CHC.length], values: W.map((m) => sum(onModels.map((M) => { const a = M.months.find((x) => x.month === m); return a ? (a.ccValue[c] || 0) : 0; }))) })).filter((s) => sum(s.values) > 0);
    if (cvSeries.length) {
      grid.append(chartCard({
        title: "Where the value came from", desc: `Estimated value of the ${selLabel} by the channel that brought the visitor.`,
        render: (h) => stackedBars(h, { months: W, series: cvSeries }),
        renderTable: (h) => tableView(h, { months: W, series: cvSeries, fmtFull: (v) => gbp(v, 0) }),
      }));
    }
    grid.append(chartCard({
      title: "Practices reporting", desc: "How many properties had sessions each month. A drop here usually means a tag fell off a site.",
      render: (h) => lineChart(h, { months: W, series: [{ label: "Practices", color: "var(--brand)", values: reporting }], fmt: (v) => String(Math.round(v)), fmtFull: (v) => String(Math.round(v)) }),
      renderTable: (h) => tableView(h, { months: W, series: [{ label: "Practices", values: reporting }], fmtFull: (v) => String(v) }),
    }));
    app.append(grid);
    cards = [...grid.children];

    // ----- practice table -----
    const cols = [
      { key: "name", label: "Practice", sort: (r) => r.name.toLowerCase(), str: true },
      { key: "trend", label: "Trend" },
      { key: "V", label: "Est. value", r: true, sort: (r) => r.V },
      { key: "uplift", label: "vs baseline", r: true, sort: (r) => r.uplift },
      { key: "C", label: "Est. actions", r: true, sort: (r) => r.C },
      { key: "S", label: "Sessions", r: true, sort: (r) => r.S },
      { key: "you1k", label: "£ per 1k", r: true, sort: (r) => r.you1k },
      { key: "vsMed", label: "vs median", r: true, sort: (r) => r.vsMed ?? -Infinity },
      { key: "cov", label: "Tracks", r: true, sort: (r) => r.tracked.size },
      { key: "lastDay", label: "Data to", sort: (r) => r.lastDay || "" },
    ];
    const sorted = [...shown].sort((a, b) => {
      const c = cols.find((x) => x.key === sortKey);
      if (!c?.sort) return 0;
      if (a.empty !== b.empty) return a.empty ? 1 : -1;
      const va = c.sort(a), vb = c.sort(b);
      return (va < vb ? -1 : va > vb ? 1 : 0) * sortDir;
    });
    const head = el("tr");
    cols.forEach((c) => {
      const th = el("th", { class: (c.r ? "r " : "") + (c.sort ? "sortable" : ""), "aria-sort": sortKey === c.key ? (sortDir < 0 ? "descending" : "ascending") : "none" }, c.label, c.sort && sortKey === c.key ? (sortDir < 0 ? " ▼" : " ▲") : "");
      if (c.sort) th.onclick = () => { if (sortKey === c.key) sortDir *= -1; else { sortKey = c.key; sortDir = c.str ? 1 : -1; } render(); };
      head.append(th);
    });
    const t = el("table", { class: "num ov-table" }, el("thead", {}, head));
    const tb = el("tbody");
    for (const r of sorted) {
      const isPublic = r.pm.public !== false;
      const nameCell = el("td", {}, isPublic ? el("a", { href: openLink(r.data.slug), target: "_blank", rel: "noopener" }, r.name) : el("span", { style: "font-weight:700" }, r.name),
        isPublic ? null : el("span", { class: "chip", style: "margin-left:8px" }, "internal"),
        r.pm.benchmark_include === false && isPublic ? el("span", { class: "chip", style: "margin-left:8px", title: "Not in the anonymised benchmark" }, "not in pool") : null);
      if (r.empty) { tb.append(el("tr", {}, nameCell, el("td", { colspan: cols.length - 1, class: "muted" }, r.M.months.length ? "No complete months in this window" : "No complete months yet"))); continue; }
      tb.append(el("tr", {},
        nameCell,
        el("td", {}, spark(r.monthly)),
        el("td", { class: "r" }, gbp(r.V, 0)),
        el("td", { class: "r" }, el("span", { class: "delta " + (r.uplift >= 0 ? "up" : "down") }, gbp(r.uplift, 0)), " ", chip(r.upPct)),
        el("td", { class: "r" }, int(r.C)), el("td", { class: "r" }, int(r.S)),
        el("td", { class: "r" }, gbp(r.you1k, 0)),
        el("td", { class: "r" }, r.vsMed != null ? chip(r.vsMed) : "—"),
        el("td", { class: "r" }, `${r.tracked.size}/${keys.length}`),
        el("td", { class: "muted small" }, r.lastDay ? dLong(r.lastDay) : "—")));
    }
    t.append(tb, el("tfoot", {}, el("tr", {}, el("td", {}, `${live.length} of ${shown.length} shown`), el("td"), el("td", { class: "r" }, gbp(tot.V, 0)),
      el("td", { class: "r " + (tot.up >= 0 ? "up" : "down") }, gbp(tot.up, 0)), el("td", { class: "r" }, int(tot.C)), el("td", { class: "r" }, int(tot.S)),
      el("td", { class: "r" }, gbp(tot.S ? (tot.V / tot.S) * 1000 : 0, 0)), el("td"), el("td"), el("td"))));
    app.append(el("section", { class: "card", style: "margin-bottom:16px" }, el("div", { class: "card-head" }, el("div", {}, el("h2", {}, "All practices"),
      el("p", {}, "Click a column to sort. Uplift is each practice's value above its own baseline, over the same calendar months. \"vs median\" compares with the median of the practices currently shown. Names link to the client dashboard where there is one."))),
      el("div", { style: "overflow-x:auto" }, t)));

    // ----- coverage grid -----
    const ct = el("table", { class: "num cov-table" });
    const ch = el("tr", {}, el("th", {}, "Practice"));
    keys.forEach((k) => ch.append(el("th", { class: "r" }, el("i", { class: "sw", style: `background:${SLOT[conv[k].slot]}` }), conv[k].short || conv[k].label)));
    ch.append(el("th", { class: "r" }, "Value"));
    ct.append(el("thead", {}, ch));
    const cb = el("tbody");
    const byName = [...shown].sort((a, b) => a.name.localeCompare(b.name));
    for (const r of byName) {
      const tr = el("tr", {}, el("td", {}, r.name));
      keys.forEach((k) => {
        if (!r.tracked.has(k)) { tr.append(el("td", { class: "r off" }, "—")); return; }
        const n = r.empty ? 0 : r.byKey[k];
        const sr = (r.data.value_overrides || {})[k]?.success_rate ?? conv[k].success_rate ?? 1;
        tr.append(el("td", { class: "r on", style: `background:color-mix(in srgb, ${SLOT[conv[k].slot]} 12%, white)`, title: sr < 1 ? `${int(n)} counted × ${Math.round(sr * 100)}% success rate` : `${int(n)} counted` },
          int(n), sr < 1 ? el("span", { class: "sr" }, `×${sr}`) : null));
      });
      tr.append(el("td", { class: "r" }, r.empty ? "—" : gbp(r.V, 0)));
      cb.append(tr);
    }
    const foot = el("tr", {}, el("td", {}, "Sites tracking it"));
    keys.forEach((k) => foot.append(el("td", { class: "r" }, `${shown.filter((r) => r.tracked.has(k)).length}/${shown.length}`)));
    foot.append(el("td"));
    ct.append(cb, el("tfoot", {}, foot));
    app.append(el("section", { class: "card" }, el("div", { class: "card-head" }, el("div", {}, el("h2", {}, "What each site measures"),
      el("p", {}, `Counts for the selected period. A dash means no rule is set for that action on that site, so it earns nothing there. ×0.5 and the like show the success rate applied when we count a page view or click rather than a confirmation.`))),
      el("div", { style: "overflow-x:auto" }, ct)));

    $("#updated").textContent = latest ? `Data to ${dLong(latest)}` : "";
  }
  function splitRow(k, v, d) {
    return el("div", { class: "row" }, el("div", {}, el("div", { class: "small muted" }, k), el("div", { class: "small", style: "color:var(--ink-2)" }, d)), el("div", { class: "num", style: "font-weight:800;font-size:1.25rem" }, v));
  }
  render();
})().catch((e) => { console.error(e); document.querySelector("#app").innerHTML = `<div class="empty">Couldn't load. ${e.message}</div>`; });
