// redline.js: turns a changed spot (whole removed lines + whole added lines) into a
// word-level redline, so a one-word edit shows as one struck word and one lit word
// inside the sentence, not as two near-identical paragraphs.
//
//   segments(hunk) -> [{ kind: "pair", ops }, { kind: "rem", text }, { kind: "add", text }]
//     pair: a removed line matched with the added line it became; ops is a list of
//           { t: "eq" | "del" | "ins", text } runs to render in order
//     rem / add: a line that was only removed or only added
//   renames(hunks) -> [{ from, to, count }] for the same swap repeated in 3+ places

const tokens = (s) => s.match(/\S+\s*/g) ?? [];
const bare = (t) => t.trim().toLowerCase();

// Word sets for pairing lines that are about the same thing.
const STOP = new Set("the a an and or of to in on for with we you your our is are be may this that it its as by at from will not can if any".split(" "));
const keySet = (s) => new Set((s.toLowerCase().match(/[a-z0-9']+/g) ?? []).filter((w) => !STOP.has(w)));
function similarity(a, b) {
  const A = keySet(a), B = keySet(b);
  if (!A.size || !B.size) return 0;
  let shared = 0;
  for (const w of A) if (B.has(w)) shared++;
  return shared / Math.min(A.size, B.size);
}

// Longest-common-subsequence word diff. Returns merged runs.
const MAX_CELLS = 400000; // a 600x600-word comparison; bigger blocks fall back to whole lines
export function wordDiff(before, after) {
  const a = tokens(before), b = tokens(after);
  if (a.length * b.length > MAX_CELLS) return null;
  const n = a.length, m = b.length;
  const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      L[i][j] = bare(a[i]) === bare(b[j]) ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const ops = [];
  const push = (t, text) => {
    const last = ops.at(-1);
    if (last && last.t === t) last.text += text;
    else ops.push({ t, text });
  };
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (bare(a[i]) === bare(b[j])) { push("eq", b[j]); i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) push("del", a[i++]);
    else push("ins", b[j++]);
  }
  while (i < n) push("del", a[i++]);
  while (j < m) push("ins", b[j++]);
  return tidy(ops);
}

// Make edits read like a person marked them up: a one- or two-word "unchanged" run
// sandwiched between edits ("AI at [Meta] AI") is folded into the edit, and each
// stretch of edits becomes one removed phrase followed by one added phrase
// ("AI at Meta" -> "Meta AI") instead of alternating fragments.
function tidy(ops) {
  const isEdit = (o) => o && o.t !== "eq";
  const absorbed = ops.flatMap((o, k) =>
    o.t === "eq" && tokens(o.text).length <= 2 && isEdit(ops[k - 1]) && isEdit(ops[k + 1])
      ? [{ t: "del", text: o.text }, { t: "ins", text: o.text }]
      : [o],
  );
  const out = [];
  let del = "", ins = "";
  const flush = () => {
    if (del) out.push({ t: "del", text: del });
    if (ins) out.push({ t: "ins", text: ins });
    del = ins = "";
  };
  for (const o of absorbed) {
    if (o.t === "del") del += o.text;
    else if (o.t === "ins") ins += o.text;
    else { flush(); out.push(o); }
  }
  flush();
  // keep the space before the next unchanged word outside the edit
  for (let k = 0; k < out.length; k++) {
    const o = out[k];
    if (o.t !== "eq" && /\s$/.test(o.text) && out[k + 1]?.t === "eq") {
      const sp = o.text.match(/\s+$/)[0];
      if (out[k - 1]?.t !== "eq" || o.t === "ins") { o.text = o.text.slice(0, -sp.length); out[k + 1].text = sp + out[k + 1].text; }
    }
  }
  return out;
}

// Pair each removed line with the most similar unused added line (they must share
// most of their words), then word-diff the pairs. Order follows the removed lines,
// with unpaired added lines after them.
export function segments(hunk) {
  const removed = hunk.removed ?? [], added = hunk.added ?? [];
  const used = new Set();
  const out = [];
  for (const r of removed) {
    let best = -1, bestScore = 0.6;
    added.forEach((a, k) => {
      if (used.has(k)) return;
      const s = similarity(r, a);
      if (s > bestScore) { best = k; bestScore = s; }
    });
    const ops = best >= 0 ? wordDiff(r, added[best]) : null;
    // only worth merging when most of the sentence survived
    const kept = ops ? ops.filter((o) => o.t === "eq").reduce((n, o) => n + tokens(o.text).length, 0) : 0;
    if (ops && kept >= tokens(r).length * 0.5) {
      used.add(best);
      out.push({ kind: "pair", ops });
    } else out.push({ kind: "rem", text: r });
  }
  added.forEach((a, k) => { if (!used.has(k)) out.push({ kind: "add", text: a }); });
  return out;
}

// The same small swap ("AI at Meta" -> "Meta AI") repeated across a change.
export function renames(hunks, min = 3) {
  const counts = new Map();
  for (const h of hunks) {
    for (const seg of segments(h)) {
      if (seg.kind !== "pair") continue;
      const ops = seg.ops;
      for (let k = 0; k < ops.length; k++) {
        // a short swap (removed phrase then added phrase), or a short phrase that was
        // only added or only removed; tidy() has already merged each stretch of edits
        const o = ops[k];
        if (o.t === "eq") continue;
        let from = "", to = "";
        if (o.t === "del") { from = o.text.trim(); if (ops[k + 1]?.t === "ins") { to = ops[k + 1].text.trim(); k++; } }
        else to = o.text.trim();
        const short = (s) => !s || s.split(/\s+/).length <= 8;
        if ((!from && !to) || !short(from) || !short(to)) continue;
        const key = `${from}\u0000${to}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
  }
  return [...counts.entries()]
    .filter(([, c]) => c >= min)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([key, count]) => { const [from, to] = key.split("\u0000"); return { from, to, count }; });
}
