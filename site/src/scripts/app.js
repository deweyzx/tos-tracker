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
  ? `Updated ${time(built)}`
  : `Updated ${built.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

// The daily check runs at 11:23 UTC (see daily.yml). Show it in the viewer's own time.
const runtime = $("#runtime");
if (runtime) runtime.textContent = time(new Date(Date.UTC(2026, 0, 1, 11, 23)));

/* ---------- charts: policy length over time ---------- */
// Colors come from the design tokens in site.css, so the chart follows DESIGN.md.
const css = getComputedStyle(document.documentElement);
const tok = (name) => css.getPropertyValue(name).trim();
const monthIndex = (iso, first) => (+iso.slice(0, 4) - first.y) * 12 + (+iso.slice(5, 7) - 1 - first.m);

function drawChart(wrap) {
  const ch = DATA.charts.find((c) => c.key === wrap.dataset.chart);
  if (!ch) return;
  const svg = $("svg", wrap), tip = $(".tipbox", wrap);
  const W = Math.max(300, Math.round(wrap.clientWidth)), H = W < 600 ? 210 : 230;
  const L = 46, R = 14, T = 14, B = 30;
  const first = { y: +ch.versions[0].date.slice(0, 4), m: +ch.versions[0].date.slice(5, 7) - 1 };
  const nowIso = now.toISOString().slice(0, 10);
  const lastM = Math.max(monthIndex(nowIso, first), monthIndex(ch.versions.at(-1).date, first), 1);
  const values = ch.versions.map((v) => v.words).concat(ch.today ?? []);
  // An even, readable step (500, 1k, 2k, 2.5k, 5k...) with at most about 6 labels.
  const span = Math.max(...values) - Math.min(...values) + 500;
  const stepV = [500, 1000, 2000, 2500, 5000, 10000].find((v) => span / v <= 5) ?? 20000;
  let y0 = Math.floor((Math.min(...values) - 250) / stepV) * stepV;
  let y1 = Math.ceil((Math.max(...values) + 250) / stepV) * stepV;
  const X = (m) => L + ((W - L - R) * m) / lastM;
  const Y = (v) => T + (H - T - B) * (1 - (v - y0) / (y1 - y0));
  const pts = ch.versions.map((v) => [X(monthIndex(v.date, first)), Y(v.words), v]);
  const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const area = `${line} L${pts.at(-1)[0]} ${H - B} L${pts[0][0]} ${H - B} Z`;

  const ticks = [];
  for (let v = y0; v <= y1; v += stepV) ticks.push(v);
  const gridY = ticks.map((v) =>
    `<line class="grid-l" x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}"/><text class="axis" x="${L - 8}" y="${Y(v) + 4}" text-anchor="end">${(v / 1000).toFixed(1)}k</text>`).join("");
  let years = "";
  for (let y = first.y + (first.m ? 1 : 0); ; y++) {
    const m = (y - first.y) * 12 - first.m;
    if (m > lastM) break;
    years += `<text class="axis" x="${X(m)}" y="${H - 8}">${y}</text>`;
  }
  const gid = "g" + ch.key.replace(/\W/g, ""); // id of the soft-light filter
  const marks = ch.changes.map((c) => {
    const i = ch.versions.findIndex((v) => v.date === c.date);
    if (i < 0) return "";
    const [x, y] = pts[i];
    const maj = c.severity === "major";
    // Afterglow: changes from the last 3 months still give off light.
    const fresh = (built - new Date(c.date + "T00:00:00Z")) / 864e5 <= 92;
    const rgb = maj ? tok("--glow-red") : tok("--glow");
    // Not in the tab order: the timeline list under the chart links every change.
    return `<a href="${BASE}/change/${c.id}/" class="pt" tabindex="-1" data-i="${i}" data-label="${c.label.replace(/"/g, "&quot;")}" data-sev="${c.severity}" aria-label="${c.label.replace(/"/g, "&quot;")}">
      <circle cx="${x}" cy="${y}" r="14" fill="transparent"/>
      ${fresh ? `<circle cx="${x}" cy="${y}" r="11" fill="rgba(${rgb},.25)" filter="url(#${gid})"/>` : ""}
      <circle cx="${x}" cy="${y}" r="4.5" fill="${maj ? tok("--major") : fresh ? tok("--glow-hi") : tok("--bg")}" stroke="${maj ? tok("--major") : tok("--accent")}" stroke-width="2"/></a>`;
  }).join("");
  let todayMark = "";
  if (ch.today) {
    const [lx, ly] = pts.at(-1), tx = X(lastM), ty = Y(ch.today);
    todayMark = `<path d="M${lx} ${ly} L${tx} ${ty}" fill="none" stroke="${tok("--faint")}" stroke-width="1.6" stroke-dasharray="4 5"/>
      <circle cx="${tx}" cy="${ty}" r="4.5" fill="${tok("--bg")}" stroke="${tok("--soft")}" stroke-width="2"/>
      <text class="axis" x="${tx - 8}" y="${ty - 12}" text-anchor="end" style="fill:${tok("--text")}">Today ${ch.today.toLocaleString("en-US")}</text>`;
  }
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.innerHTML = `<defs><filter id="${gid}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter></defs>
    ${gridY}${years}
    <path d="${area}" fill="rgba(${tok("--glow")},.08)"/>
    <path d="${line}" fill="none" stroke="rgba(${tok("--glow")},.55)" stroke-width="4" stroke-linejoin="round" filter="url(#${gid})"/>
    <path d="${line}" fill="none" stroke="${tok("--accent")}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    ${todayMark}${marks}`;
  const show = (g) => {
    const v = ch.versions[+g.dataset.i];
    const sc = svg.getBoundingClientRect().width / W;
    tip.innerHTML = `<b>${g.dataset.label}</b><span>${MONTHS[+v.date.slice(5, 7) - 1]} ${v.date.slice(0, 4)}, ${v.words.toLocaleString("en-US")} words</span>`;
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

/* ---------- the featured change's border lights up under your pointer ---------- */
$(".feature")?.addEventListener("pointermove", (e) => {
  const f = e.currentTarget, r = f.getBoundingClientRect();
  f.style.setProperty("--mx", e.clientX - r.left + "px");
  f.style.setProperty("--my", e.clientY - r.top + "px");
}, { passive: true });

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
  }).join("") + '<button class="addchip" id="addPin" aria-label="Pin another company">+</button>';
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
  results = COS.filter((c) => c.name.toLowerCase().includes(q));
  if (keep) { const k = results.findIndex((c) => c.name === keep); if (k >= 0) si = k; }
  si = Math.min(si, Math.max(0, results.length - 1));
  spotList.innerHTML = results.length
    ? `<div class="spot-grp">${q ? "Matches" : "Companies"}</div>` + results.map((c, i) =>
        `<div class="sr${i === si ? " focus" : ""}" role="option" id="sr-${i}" aria-selected="${i === si}" data-i="${i}"><span class="sd ${c.status}" style="width:7px;height:7px;border-radius:50%"></span><b>${c.name}</b><span class="s">${c.label}</span>${pinBtn(c, true)}</div>`).join("")
    : '<div class="spot-grp">No company matches that name. Try just the company, like "Spotify".</div>';
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
