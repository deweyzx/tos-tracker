// app.js: everything that moves or reacts on the page.
// The page works without it (all content is in the HTML); this adds tabs,
// pins, search, the filter menu and the charts.

const DATA = JSON.parse(document.getElementById("tos-data").textContent);
const BASE = DATA.base;
const HOME = document.body.dataset.home === "1";
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/* ---------- times in the top bar and the "How it works" panel ---------- */
const now = new Date();
const built = new Date(DATA.builtAt);
const sameDay = built.toDateString() === now.toDateString();
const time = (d) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
$("#checked").textContent = sameDay
  ? `Checked today, ${time(built)}`
  : `Checked ${built.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}`;

// The daily check runs at 11:23 UTC (see daily.yml). Show it in the viewer's own time.
const runtime = $("#runtime");
// Today's date, so the shown time follows daylight saving (7:23 AM Eastern in summer, 6:23 in winter).
if (runtime) { const d = new Date(); runtime.textContent = time(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 11, 23))); }

/* ---------- charts: policy length over time ---------- */
// Colors come from the design tokens in site.css, so the chart follows DESIGN.md.
const css = getComputedStyle(document.documentElement);
const tok = (name) => css.getPropertyValue(name).trim();
const monthIndex = (iso, first) => (+iso.slice(0, 4) - first.y) * 12 + (+iso.slice(5, 7) - 1 - first.m);

// When each chart was first drawn: the pen draws it then (a redraw in the same moment,
// e.g. after the fonts load, keeps drawing; later redraws on resize don't replay it).
const penStart = new Map();
function drawChart(wrap) {
  const ch = DATA.charts.find((c) => c.key === wrap.dataset.chart);
  if (!ch) return;
  if (!penStart.has(ch.key)) penStart.set(ch.key, performance.now());
  const firstTime = performance.now() - penStart.get(ch.key) < 250;
  const svg = $("svg", wrap), tip = $(".tipbox", wrap);
  const W = Math.max(300, Math.round(wrap.clientWidth)), H = W < 600 ? 240 : 280;
  const L = 46, R = 14, T = 14, B = 30;
  const first = { y: +ch.versions[0].date.slice(0, 4), m: +ch.versions[0].date.slice(5, 7) - 1 };
  const nowIso = now.toISOString().slice(0, 10);
  const lastM = Math.max(monthIndex(nowIso, first), monthIndex(ch.versions.at(-1).date, first), 1);
  // Spikes: an archive copy far longer or shorter than the copies on both sides of it,
  // where the jump in or out was flagged as mostly page layout. (X's page, for one, shows
  // the old and the new terms together while a change is pending, so it briefly doubles.)
  // Its word count isn't the policy's length, so the line holds its level there and the
  // copy gets a faint marker instead.
  const layoutOn = new Set(ch.changes.filter((c) => c.layout).map((c) => c.date));
  const level = [];
  const spike = ch.versions.map((v, i) => {
    const before = level[i - 1];
    const nextV = ch.versions[i + 1];
    const next = nextV?.words ?? ch.today;
    const isSpike = i > 0 && next != null
      && Math.abs(v.words - before) / before > 0.4
      && Math.abs(next - before) / before < 0.25
      && (layoutOn.has(v.date) || (nextV ? layoutOn.has(nextV.date) : true));
    level.push(isSpike ? before : v.words);
    return isSpike;
  });
  const values = level.concat(ch.today ?? []);
  // An even, readable step (500, 1k, 2k, 2.5k, 5k...) with at most about 5 labels.
  // The column of text starts at zero words, so its height is honest: a policy twice
  // as long is a column twice as tall. Even steps (1k, 2k, 2.5k, 5k...), about 4 labels.
  const top = Math.max(...values);
  const stepV = [1000, 2000, 2500, 5000, 10000].find((v) => top / v <= 4) ?? 20000;
  const y0 = 0;
  const y1 = Math.ceil((top * 1.1) / stepV) * stepV;
  const X = (m) => L + ((W - L - R) * m) / lastM;
  const Y = (v) => T + (H - T - B) * (1 - (v - y0) / (y1 - y0));
  const pts = ch.versions.map((v, i) => [X(monthIndex(v.date, first)), Y(level[i]), v]);
  // A step line, because a policy's length only changes when a new version appears:
  // flat ink while the text stays the same, then a jump drawn as a pencil stroke:
  // blue when the policy grew, red when it shrank (like added and removed words).
  // The ink is only the flat stretches, so the pencil marks never sit on top of it.
  const f1 = (n) => n.toFixed(1);
  const line = pts.map((p, i) => `M${f1(p[0])} ${f1(p[1])} H${f1(i < pts.length - 1 ? pts[i + 1][0] : p[0])}`).join(" ");
  // Only the biggest few jumps get a number, so the line stays readable.
  const jumps = level.slice(1).map((v, k) => Math.abs(v - level[k]));
  const labelled = new Set(jumps.map((d, k) => [d, k]).filter(([d]) => d >= 300).sort((a, b) => b[0] - a[0]).slice(0, 3).map(([, k]) => k));
  // boxes already taken by text, starting with the "Today" label (drawn later, right-aligned)
  const taken = [];
  if (ch.today) {
    const tx = X(lastM), ty = Y(ch.today), tw = `Today ${ch.today.toLocaleString("en-US")}`.length * 7;
    taken.push([tx - 10 - tw, ty - 24, tx - 10, ty - 8]);
  }
  const risers = pts.slice(1).map(([x, y], k) => {
    const prevY = pts[k][1];
    if (Math.abs(y - prevY) < 1) return "";
    const at = ((x - L) / (W - L - R)).toFixed(3);
    // a direct label for the biggest jumps ("+1,170"), placed where no dot or edge is in the way:
    // right of the jump above the new level, else left of it above the old level, else none
    const delta = level[k + 1] - level[k];
    const text = `${delta > 0 ? "+" : "−"}${Math.abs(delta).toLocaleString("en-US")}`;
    const w = text.length * 7 + 4;
    const clear = (x0, yb) => x0 >= L && x0 + w <= W - R &&
      !pts.some(([px, py]) => px > x0 - 6 && px < x0 + w + 6 && py > yb - 18 && py < yb + 8) &&
      !taken.some(([a, b, c, d]) => x0 < c + 4 && x0 + w > a - 4 && yb - 14 < d + 2 && yb > b - 2);
    let label = "";
    if (labelled.has(k)) {
      const right = [x + 10, y - 10], left = [x - 10 - w, prevY - 10];
      const spot = clear(...right) ? right : clear(...left) ? left : null;
      if (spot) taken.push([spot[0], spot[1] - 14, spot[0] + w, spot[1]]);
      if (spot) label = `<text class="delta label-on-line" style="--at:${at}" x="${f1(spot[0])}" y="${f1(spot[1])}">${text}</text>`;
    }
    return `<path class="riser" style="--at:${at}" d="M${f1(x)} ${f1(prevY)} V${f1(y)}" stroke="${y < prevY ? tok("--accent") : tok("--major")}"/>${label}`;
  }).join("");

  // The policy drawn as a column of printed text: greeked "lines of type" fill the area
  // under the length line, so a longer policy is literally a taller column.
  const base = Y(0), colEnd = ch.today ? X(lastM) : pts.at(-1)[0];
  const column = `M${f1(pts[0][0])} ${f1(base)} V${f1(pts[0][1])} ` +
    pts.slice(1).map(([x, y]) => `H${f1(x)} V${f1(y)}`).join(" ") + ` H${f1(colEnd)} V${f1(base)} Z`;
  const pat = `type-${ch.key}`;
  const ink = tok("--ink");
  const rows = (id, color, op) => `<pattern id="${id}" width="96" height="12" patternUnits="userSpaceOnUse">
      <path d="M2 3H26M31 3H40M45 3H70M75 3H94M2 9H15M20 9H47M52 9H59M64 9H88" stroke="${color}" stroke-width="2.2" stroke-opacity="${op}"/></pattern>`;
  const typeRows = rows(pat, ink, ".18") + rows(`${pat}-add`, tok("--accent"), ".55") + rows(`${pat}-cut`, tok("--major"), ".35");
  // After each jump, the band that changed keeps its pencil colour until the next jump:
  // new lines of type in blue, cut lines in faint red above the column.
  const bands = pts.slice(1).map(([x, y], k) => {
    const prevY = pts[k][1];
    if (Math.abs(y - prevY) < 1) return "";
    let j = k + 2;
    while (j < pts.length && Math.abs(pts[j][1] - y) < 1) j++;
    const x2 = j < pts.length ? pts[j][0] : colEnd;
    const at = ((x - L) / (W - L - R)).toFixed(3);
    const grew = y < prevY;
    return `<rect class="band" style="--at:${at}" x="${f1(x)}" y="${f1(Math.min(y, prevY))}" width="${f1(x2 - x)}" height="${f1(Math.abs(prevY - y))}" fill="url(#${pat}-${grew ? "add" : "cut"})"/>`;
  }).join("");
  const ticks = [];
  for (let v = y0; v <= y1; v += stepV) ticks.push(v);
  const gridY = ticks.map((v) =>
    // no grid lines: the rows of type give the scale its texture; a short tick marks each value
    `<line class="grid-l" x1="${L - 4}" x2="${L}" y1="${Y(v)}" y2="${Y(v)}"/><text class="axis" x="${L - 8}" y="${Y(v) + 4}" text-anchor="end">${v ? `${(v / 1000).toFixed(v % 1000 ? 1 : 0)}k` : "0"}</text>`).join("");
  let years = "";
  for (let y = first.y + (first.m ? 1 : 0); ; y++) {
    const m = (y - first.y) * 12 - first.m;
    if (m > lastM) break;
    years += `<text class="axis" x="${X(m)}" y="${H - 8}">${y}</text>`;
  }
  const marks = ch.changes.map((c) => {
    const i = ch.versions.findIndex((v) => v.date === c.date);
    if (i < 0) return "";
    const [x, y] = pts[i];
    const maj = c.severity === "major";
    const ghost = spike[i];
    // Afterglow: changes from the last 3 months still give off light.
    const fresh = (built - new Date(c.date + "T00:00:00Z")) / 864e5 <= 92;
    // Not in the tab order: the timeline list under the chart links every change.
    // the dot lands as the pen passes it
    return `<a href="${BASE}/change/${c.id}/" class="pt" style="--at:${((x - L) / (W - L - R)).toFixed(3)}" tabindex="-1" data-i="${i}" data-ghost="${ghost ? 1 : ""}" data-label="${c.label.replace(/"/g, "&quot;")}" data-sev="${c.severity}" aria-label="${c.label.replace(/"/g, "&quot;")}">
      <circle cx="${x}" cy="${y}" r="14" fill="transparent"/>
      ${ghost
        ? `<circle cx="${x}" cy="${y}" r="4" fill="${tok("--bg")}" stroke="${tok("--edge-hover")}" stroke-width="1.5" stroke-dasharray="2 2"/>`
        : `<circle cx="${x}" cy="${y}" r="${maj || fresh ? 4.5 : 3.5}" fill="${maj ? tok("--major") : fresh ? tok("--accent") : tok("--ink")}" stroke="${tok("--bg")}" stroke-width="2"/>`}</a>`;
  }).join("");
  let todayMark = "";
  if (ch.today) {
    const [lx, ly] = pts.at(-1), tx = X(lastM), ty = Y(ch.today);
    todayMark = `<g class="pen-today"><path d="M${lx} ${ly} H${tx} V${ty}" fill="none" stroke="${tok("--soft")}" stroke-width="1.5" stroke-dasharray="1 4" stroke-linecap="round"/>
      <rect x="${tx - 4}" y="${ty - 4}" width="8" height="8" fill="${tok("--bg")}" stroke="${tok("--ink")}" stroke-width="2"/>
      <text class="axis label-on-line" x="${tx - 10}" y="${ty - 12}" text-anchor="end" style="fill:${tok("--text")}">Today ${ch.today.toLocaleString("en-US")}</text></g>`;
  }
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.classList.toggle("pen", firstTime);
  svg.innerHTML = `<defs>${typeRows}</defs>${gridY}${years}
    <path class="column" d="${column}" fill="url(#${pat})"/>${bands}
    <line x1="${L}" x2="${W - R}" y1="${f1(base)}" y2="${f1(base)}" stroke="${ink}" stroke-width="1.5"/>
    <path class="pen-line" pathLength="1" d="${line}" fill="none" stroke="${tok("--ink")}" stroke-width="2.5" stroke-linecap="butt"/>
    ${risers}${todayMark}${marks}`;
  const show = (g) => {
    const v = ch.versions[+g.dataset.i];
    const sc = svg.getBoundingClientRect().width / W;
    const when = `${MONTHS[+v.date.slice(5, 7) - 1]} ${v.date.slice(0, 4)}`;
    tip.innerHTML = `<b>${g.dataset.label}</b><span>${g.dataset.ghost
      ? `${when}: this archive copy was mostly page layout (${v.words.toLocaleString("en-US")} words), so the line skips it`
      : `${when}, ${v.words.toLocaleString("en-US")} words`}</span>`;
    const [x, y] = pts[+g.dataset.i];
    tip.style.left = x * sc + "px";
    tip.style.top = y * sc + "px";
    tip.classList.add("on");
  };
  $$(".pt", svg).forEach((g) => {
    g.addEventListener("pointerenter", () => show(g));
    g.addEventListener("focus", () => show(g));
    g.addEventListener("pointerleave", () => tip.classList.remove("on"));
    g.addEventListener("blur", () => tip.classList.remove("on"));
  });
}
const drawVisibleCharts = () => $$(".chartwrap").forEach((w) => { if (w.offsetParent) drawChart(w); });
let resizeTimer;
addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(drawVisibleCharts, 150); });

/* ---------- marking up: a changed spot is struck and underlined when you reach it ----------
   Only spots below the first screen wait; the text is always there, only the pencil marks
   are drawn. Each spot is inked once. Skipped entirely with reduced motion. */
const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
if (!calm && "IntersectionObserver" in window) {
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.remove("to-ink");
    io.unobserve(e.target);
  }), { rootMargin: "0px 0px -15% 0px" });
  $$(".hunk, .repeats").forEach((el) => {
    if (el.getBoundingClientRect().top > innerHeight * 0.85) { el.classList.add("to-ink"); io.observe(el); }
  });
}

/* ---------- tabs ---------- */
const nav = $("#nav"), pill = $("#pillx"), tabs = $$("a", nav);
const movePill = (a) => {
  if (!a) { pill.style.opacity = 0; return; }
  pill.style.opacity = 1;
  pill.style.left = a.offsetLeft + "px";
  pill.style.width = a.offsetWidth + "px";
};
const placePill = () => {
  pill.style.transition = "none";
  movePill(tabs.find((a) => a.getAttribute("aria-current") === "page"));
  pill.offsetWidth;
  pill.style.transition = "";
};
document.fonts.ready.then(placePill);
addEventListener("resize", placePill);

const VIEWS = ["overview", "latest", "companies", "history"];
let firstView = true;

function showView(view, company) {
  const main = $("#main");
  if (!main) return;
  if (!VIEWS.includes(view)) view = "overview";
  main.dataset.view = view;
  tabs.forEach((a) => a.dataset.view === view ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current"));
  movePill(tabs.find((a) => a.dataset.view === view));
  $$("[data-v]").forEach((el) => { el.hidden = el.dataset.v !== view; });
  if (view === "history") { showChart(); drawVisibleCharts(); }
  if (view === "latest") applyFilter(company ? (DATA.companies.some((c) => c.id === company) ? `co:${company}` : company) : "all");
  if (!firstView) scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  firstView = false;
}

function fromHash() {
  const [view, company] = location.hash.slice(1).split("/");
  showView(view || "overview", company);
}

if (HOME) {
  document.addEventListener("click", (e) => {
    const a = e.target.closest?.("a[href]");
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const url = new URL(a.href, location.href);
    if (url.pathname === location.pathname && url.hash) {
      e.preventDefault();
      history.pushState(null, "", url.hash);
      fromHash();
    }
  });
  addEventListener("popstate", fromHash);
}

/* ---------- History: one policy's chart at a time ---------- */
let chartKey = DATA.charts[0]?.key;
function showChart() {
  $$("[data-chart-key]").forEach((sec) => { sec.style.display = sec.dataset.chartKey === chartKey ? "" : "none"; });
}
showChart();

// A small popup menu: arrow keys, Enter, Esc, click outside to close.
function popupMenu(btn, menu, onChoose) {
  if (!btn || !menu) return;
  const items = $$(".mi", menu);
  items.forEach((o, i) => { o.id ||= `${menu.id}-${i}`; });
  let fi = 0;
  const focusItem = () => {
    items.forEach((o, i) => o.classList.toggle("focus", i === fi));
    menu.setAttribute("aria-activedescendant", items[fi]?.id ?? "");
  };
  const place = () => {
    menu.classList.remove("up");
    const r = btn.getBoundingClientRect();
    if (r.bottom + menu.offsetHeight + 16 > innerHeight && r.top > menu.offsetHeight + 80) menu.classList.add("up");
  };
  const open = () => {
    place();
    menu.classList.add("open");
    btn.setAttribute("aria-expanded", "true");
    fi = Math.max(0, items.findIndex((o) => o.getAttribute("aria-selected") === "true"));
    focusItem();
    menu.focus();
  };
  const close = (ret) => {
    menu.classList.remove("open");
    btn.setAttribute("aria-expanded", "false");
    items.forEach((o) => o.classList.remove("focus"));
    if (ret) btn.focus();
  };
  const choose = (o) => {
    items.forEach((x) => x.setAttribute("aria-selected", x === o));
    onChoose(o);
    setTimeout(() => close(true), reduce ? 0 : 150);
  };
  btn.onclick = () => (menu.classList.contains("open") ? close() : open());
  btn.onkeydown = (e) => { if (e.key === "ArrowDown") { open(); e.preventDefault(); } };
  items.forEach((o, i) => { o.onmouseenter = () => { fi = i; focusItem(); }; o.onclick = () => choose(o); });
  menu.onkeydown = (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { fi = (fi + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length; focusItem(); e.preventDefault(); }
    else if (e.key === "Enter" || e.key === " ") { choose(items[fi]); e.preventDefault(); }
    else if (e.key === "Escape" || e.key === "Tab") close(e.key === "Escape");
  };
  document.addEventListener("click", (e) => { if (!e.composedPath().includes(btn.parentElement)) close(); });
}

popupMenu($("#hBtn"), $("#hMenu"), (o) => {
  chartKey = o.dataset.key;
  $("#hLabel").textContent = o.childNodes[1].textContent.trim();
  showChart();
  drawVisibleCharts();
});

/* ---------- filter menu ---------- */
let currentFilter = "all";
const fBtn = $("#fBtn"), fMenu = $("#fMenu");
const fo = fMenu ? $$(".mi", fMenu) : [];
let fi = 0;

const feed = $("#feed"), showOlder = $("#showOlder");
$("#clearFilter")?.addEventListener("click", () => { applyFilter("all"); $("#lcount").focus(); });
let expanded = false;
if (feed && showOlder) {
  feed.classList.add("folded"); // older months wait behind "Show older changes"
  showOlder.hidden = false;
  showOlder.onclick = () => { expanded = true; applyFilter(currentFilter); $(".month-group.older .row")?.focus(); };
}

function applyFilter(f) {
  if (!fMenu) return;
  currentFilter = f;
  const o = fo.find((x) => x.dataset.f === f) ?? fo[0];
  fo.forEach((x) => x.setAttribute("aria-selected", x === o));
  $("#fLabel").textContent = o.childNodes[1].textContent.trim();
  let n = 0;
  $$(".row", feed).forEach((r) => {
    const tags = (r.dataset.tags || "").split(" ");
    const ok = f === "all" || tags.includes(f);
    r.style.display = ok ? "" : "none";
    if (ok) n++;
  });
  // a month heading disappears when none of its changes match
  $$(".month-group", feed).forEach((g) => { g.style.display = $$(".row", g).some((r) => r.style.display !== "none") ? "" : "none"; });
  // folding only applies to the full list; a filtered list shows every match
  const folded = f === "all" && !expanded && !!showOlder;
  feed.classList.toggle("folded", folded);
  if (showOlder) showOlder.hidden = !folded;
  $("#empty").style.display = n ? "none" : "block";
  $("#lcount").textContent = n === 1 ? "1 change" : `${n} changes`;
  const note = $("#filterNote");
  if (note) {
    note.hidden = f === "all";
    const co = f.startsWith("co:") ? DATA.companies.find((c) => c.id === f.slice(3)) : null;
    $("#filterText").textContent = co ? `Showing ${co.name} only.` : f === "major" ? "Showing major changes only." : `Showing ${o.childNodes[1].textContent.trim()} only.`;
  }
  // keep the filter in the address, so Back and shared links return to it
  if (HOME && $("#main")?.dataset.view === "latest") {
    const h = f === "all" ? "#latest" : `#latest/${f.startsWith("co:") ? f.slice(3) : f}`;
    if (location.hash !== h) history.replaceState(null, "", h);
  }
}

if (fMenu) {
  const place = () => {
    fMenu.classList.remove("up");
    const r = fBtn.getBoundingClientRect();
    if (r.bottom + fMenu.offsetHeight + 16 > innerHeight && r.top > fMenu.offsetHeight + 80) fMenu.classList.add("up");
  };
  fo.forEach((o, i) => { o.id ||= `fMenu-${i}`; });
  const focusItem = () => {
    fo.forEach((o, i) => o.classList.toggle("focus", i === fi));
    fMenu.setAttribute("aria-activedescendant", fo[fi]?.id ?? "");
  };
  const open = () => {
    place();
    fMenu.classList.add("open");
    fBtn.setAttribute("aria-expanded", "true");
    fi = Math.max(0, fo.findIndex((o) => o.getAttribute("aria-selected") === "true"));
    focusItem();
    fMenu.focus();
  };
  const close = (ret) => {
    fMenu.classList.remove("open");
    fBtn.setAttribute("aria-expanded", "false");
    fo.forEach((o) => o.classList.remove("focus"));
    if (ret) fBtn.focus();
  };
  const choose = (o) => { applyFilter(o.dataset.f); setTimeout(() => close(true), reduce ? 0 : 150); };
  fBtn.onclick = () => (fMenu.classList.contains("open") ? close() : open());
  fBtn.onkeydown = (e) => { if (e.key === "ArrowDown") { open(); e.preventDefault(); } };
  fo.forEach((o, i) => { o.onmouseenter = () => { fi = i; focusItem(); }; o.onclick = () => choose(o); });
  fMenu.onkeydown = (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { fi = (fi + (e.key === "ArrowDown" ? 1 : -1) + fo.length) % fo.length; focusItem(); e.preventDefault(); }
    else if (e.key === "Enter" || e.key === " ") { choose(fo[fi]); e.preventDefault(); }
    else if (e.key === "Escape" || e.key === "Tab") close(e.key === "Escape");
  };
  document.addEventListener("click", (e) => { if (!e.composedPath().includes(fBtn.parentElement)) close(); });
}

/* ---------- remember your place in the list ---------- */
document.addEventListener("click", (e) => {
  const a = e.target.closest?.("a.row, .timeline a");
  if (!a || !HOME) return;
  try { sessionStorage.setItem("tos-back", JSON.stringify({ hash: location.hash || "#overview", y: scrollY, expanded })); } catch {}
});
let back = null;
try { back = JSON.parse(sessionStorage.getItem("tos-back") || "null"); } catch {}
const backLink = $(".back");
if (backLink && back?.hash) {
  backLink.href = `${BASE}/${back.hash}`;
  const co = DATA.companies.find((c) => back.hash === `#latest/${c.id}`);
  backLink.lastChild.textContent = co ? `Back to ${co.name} changes` : back.hash.startsWith("#latest") ? "Back to all changes" : back.hash.startsWith("#history") ? "Back to history" : "Back to the overview";
}

/* ---------- "you were last here": a mark in the feed where your previous visit ended ---------- */
// The feed is newest first, so the flag goes above the first change older than
// your last visit. Saved in this browser only; shown only when something is new.
if (feed) {
  let lastSeen = null;
  try { lastSeen = localStorage.getItem("tos-last-visit"); } catch {}
  const today = new Date().toISOString().slice(0, 10);
  if (lastSeen && lastSeen < today) {
    const rows = $$(".row", feed);
    const firstOld = rows.find((r) => (r.getAttribute("href").match(/(\d{4}-\d{2}-\d{2})/) || [])[1] <= lastSeen);
    if (firstOld && firstOld !== rows[0]) {
      const flag = document.createElement("p");
      flag.className = "last-visit";
      flag.textContent = `You were last here on ${new Date(lastSeen + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}. Everything above is new.`;
      firstOld.before(flag);
    }
  }
  try { localStorage.setItem("tos-last-visit", today); } catch {}
}

/* ---------- pins (saved in this browser only) ---------- */
const COS = DATA.companies;
let pins = []; // nothing pinned until the visitor picks
try {
  const saved = JSON.parse(localStorage.getItem("tos-pins") || "null");
  if (Array.isArray(saved)) pins = saved.filter((n) => COS.some((c) => c.name === n));
} catch {}
const savePins = () => { try { localStorage.setItem("tos-pins", JSON.stringify(pins)); } catch {} };
const bead = '<span class="bead" aria-hidden="true"></span>';
const pinBtn = (c, inSpot) => {
  const on = pins.includes(c.name);
  return `<button class="pin" aria-pressed="${on}" aria-label="${on ? "Unpin" : "Pin"} ${c.name}" data-n="${c.name}">${bead}</button>`;
};

function renderWatch() {
  const w = $("#watch");
  if (w) w.innerHTML = COS.map((c) => `<div class="w"><span class="sd ${c.status}"></span><span class="nm">${c.changes ? `<a href="${BASE}/#latest/${c.id}">${c.name}</a>` : `<b>${c.name}</b>`}<span class="docs">${c.docs.join(" and ")}</span></span><span class="s ${c.status}">${c.label}</span>${pinBtn(c)}</div>`).join("");
}
// The bar only appears once something is pinned (CSS hides it while empty).
function renderBar() {
  const bar = $("#pinbar");
  if (!pins.length) { bar.innerHTML = ""; return; }
  bar.innerHTML = '<span class="lab">Pinned</span>' + pins.map((n) => {
    const c = COS.find((x) => x.name === n);
    return c ? `<a class="chip" href="${BASE}/#latest/${c.id}" aria-label="${n}, ${c.changes} changes">${n}${c.changes ? `<span class="c">${c.changes}</span>` : ""}</a>` : "";
  }).join("") + '<button class="addchip" id="addPin" aria-label="Pin another company"><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>';
  $("#addPin").onclick = openSpot;
}
function toggle(name) {
  const was = pins.includes(name);
  pins = was ? pins.filter((x) => x !== name) : [...pins, name];
  savePins();
  renderWatch();
  renderBar();
  renderSpot(spotIn.value, name);
}
$("#watch")?.addEventListener("click", (e) => {
  const b = e.target.closest(".pin");
  if (b) { toggle(b.dataset.n); $(`#watch .pin[data-n="${b.dataset.n}"]`)?.focus(); }
});

/* ---------- search (Ctrl/Cmd K) ---------- */
const spot = $("#spot"), veil = $("#veil"), spotIn = $("#spotIn"), spotList = $("#spotList");
let results = [], si = 0, returnFocus = null;
function renderSpot(q = "", keep) {
  q = q.trim().toLowerCase();
  // match the company or one of its products ("Instagram" finds Meta, "ChatGPT" finds OpenAI)
  const via = (c) => q && !c.name.toLowerCase().includes(q) ? (c.aliases ?? []).find((a) => a.toLowerCase().includes(q)) : null;
  results = COS.filter((c) => c.name.toLowerCase().includes(q) || via(c));
  if (keep) { const k = results.findIndex((c) => c.name === keep); if (k >= 0) si = k; }
  si = Math.min(si, Math.max(0, results.length - 1));
  spotList.innerHTML = results.length
    ? `<div class="spot-grp">${q ? "Matches" : "Companies"}</div>` + results.map((c, i) =>
        `<div class="sr${i === si ? " focus" : ""}" role="option" id="sr-${i}" aria-selected="${i === si}" data-i="${i}"><span class="sd ${c.status}" style="width:7px;height:7px;border-radius:50%"></span><b>${c.name}</b>${via(c) ? `<span class="s">covers ${via(c)}</span>` : ""}<span class="s">${c.label}</span>${pinBtn(c, true)}</div>`).join("")
    : '<div class="spot-grp">No company or product matches that. Try a company, like "Spotify", or a product, like "Instagram".</div>';
  spotIn.setAttribute("aria-activedescendant", results.length ? `sr-${si}` : "");
}
function openSpot() {
  returnFocus = document.activeElement;
  si = 0;
  spotIn.value = "";
  renderSpot();
  spot.classList.add("open");
  veil.classList.add("open");
  setTimeout(() => spotIn.focus(), 30);
}
function closeSpot() { spot.classList.remove("open"); veil.classList.remove("open"); returnFocus?.focus?.(); }
// Open a company's changes in the Latest feed.
function goTo(c) {
  spot.classList.remove("open");
  veil.classList.remove("open");
  const h = `#latest/${c.id}`;
  if (HOME) { history.pushState(null, "", h); fromHash(); $("#lcount")?.focus?.(); }
  else location.href = `${BASE}/${h}`;
}
$("#openSpot").onclick = openSpot;
veil.onclick = closeSpot;
spotIn.oninput = () => { si = 0; renderSpot(spotIn.value); };
spot.addEventListener("keydown", (e) => {
  if (e.key === "Escape") return closeSpot();
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    si = (si + (e.key === "ArrowDown" ? 1 : -1) + results.length) % Math.max(1, results.length);
    renderSpot(spotIn.value);
    $(".sr.focus", spotList)?.scrollIntoView({ block: "nearest" });
    e.preventDefault();
  }
  if (e.key === "Enter" && results[si] && !e.target.closest(".pin")) { goTo(results[si]); e.preventDefault(); }
  // keep Tab inside the dialog: the input, then each pin button, then back
  if (e.key === "Tab") {
    const stops = [spotIn, ...$$(".pin", spotList)];
    const k = stops.indexOf(document.activeElement);
    const next = stops[(k + (e.shiftKey ? -1 : 1) + stops.length) % stops.length];
    next.focus();
    e.preventDefault();
  }
});
spotList.addEventListener("pointermove", (e) => {
  const r = e.target.closest(".sr");
  if (r && +r.dataset.i !== si) {
    si = +r.dataset.i;
    $$(".sr", spotList).forEach((x, i) => { x.classList.toggle("focus", i === si); x.setAttribute("aria-selected", i === si); });
  }
});
spotList.addEventListener("click", (e) => {
  const b = e.target.closest(".pin");
  if (b) { toggle(b.dataset.n); $(`.pin[data-n="${b.dataset.n}"]`, spotList)?.focus(); return; }
  const r = e.target.closest(".sr");
  if (r) goTo(results[+r.dataset.i]);
});
$("#kh").textContent = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K";
document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    spot.classList.contains("open") ? closeSpot() : openSpot();
  }
});

renderWatch();
renderBar();
if (HOME) {
  fromHash();
  if (back && back.hash === (location.hash || "#overview")) {
    if (back.expanded && showOlder) { expanded = true; applyFilter(currentFilter); }
    requestAnimationFrame(() => scrollTo(0, back.y));
    try { sessionStorage.removeItem("tos-back"); } catch {}
  }
}
