// data.js: reads the tracker's own files at build time and shapes them for the pages.
//
// Nothing here is typed in by hand. Every number on the site comes from:
//   ../sources.json            which companies and pages are watched
//   ../policies/<co>/<doc>.txt  today's copy of each page (missing = the scraper can't read it)
//   ../changes/**/*.json        every change found, with its AI summary
// So adding a company to sources.json adds it to the site on the next build.

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd(), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf-8");
const exists = (p) => fs.existsSync(path.join(ROOT, p));

// Names that don't capitalize the simple way.
const NAMES = { openai: "OpenAI", tiktok: "TikTok", x: "X" };
export const companyName = (id) => NAMES[id] ?? id.charAt(0).toUpperCase() + id.slice(1);

const DOCS = { privacy: "Privacy Policy", terms: "Terms of Service" };
export const docName = (doc) => DOCS[doc] ?? doc.charAt(0).toUpperCase() + doc.slice(1);

// Plain labels for the AI's fixed category list (see CATEGORIES in summarize.py).
export const CATEGORY_LABELS = {
  ai_training: "AI training",
  data_collection: "Data collected",
  data_sharing: "Data sharing",
  advertising: "Advertising",
  your_rights: "Your rights",
  legal: "Legal terms",
  children: "Children",
  your_content: "Your content",
  account: "Accounts",
  other: "Other",
};

const words = (text) => text.split(/\s+/).filter(Boolean).length;

function allJsonFiles(dir) {
  if (!exists(dir)) return [];
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) return allJsonFiles(rel);
    return entry.name.endsWith(".json") ? [rel] : [];
  });
}

// A short headline from the AI summary: the first sentence, cut at a colon or
// a comma if it runs long. (New summaries could carry their own headline later.)
function headlineFrom(change) {
  const summary = change.ai?.summary;
  if (!summary) return `${companyName(change.company)} changed its ${docName(change.doc)}`;
  let first = summary.split(/(?<=[.!?])\s/)[0].replace(/[.!?]$/, "");
  if (first.length > 90) first = first.split(/[:;]|, (?=and |but |which )/)[0];
  if (first.length > 110) first = first.slice(0, 107).replace(/\s+\S*$/, "") + "…";
  return first;
}

// One before/after pair to quote on the featured card. Policy "lines" are whole
// paragraphs, so we compare sentences: a sentence that was removed vs one that was
// added in the same spot, preferring pairs that talk about what the AI summary
// says changed (and that share some wording, so they're about the same thing).
const STOP = new Set("the a an and or of to in on for with we you your our is are be may this that it its as by at from will not can if any which their they have has us service".split(" "));
const keyWords = (s) => new Set((s.toLowerCase().match(/[a-z']+/g) ?? []).filter((w) => !STOP.has(w)));
const sentences = (lines) =>
  lines.flatMap((l) => l.split(/(?<=[.!?])\s+/)).map((s) => s.trim()).filter((s) => s.split(/\s+/).length >= 6 && s.length <= 200);

function quoteFrom(change) {
  const topic = keyWords(`${change.ai?.summary ?? ""} ${change.company}`);
  let best = null;
  for (const h of change.hunks ?? []) {
    const removed = sentences(h.removed), added = sentences(h.added);
    for (const before of removed.filter((r) => !added.includes(r))) {
      for (const after of added.filter((a) => !removed.includes(a))) {
        const b = keyWords(before), a = keyWords(after);
        const shared = [...b].filter((w) => a.has(w)).length;
        const overlap = shared / Math.max(1, new Set([...a, ...b]).size);
        if (overlap < 0.08 || overlap > 0.8) continue;
        const onTopic = [...a].filter((w) => topic.has(w)).length + [...b].filter((w) => topic.has(w)).length;
        const score = onTopic + 2 * overlap;
        if (!best || score > best.score) best = { before, after, score };
      }
    }
  }
  return best;
}

// Order the changed spots so the ones about what the summary describes come
// first (a reordered stats table can be "big" without mattering).
function byRelevance(change) {
  const topic = keyWords(change.ai?.summary ?? "");
  const score = (h) => {
    const text = [...h.removed, ...h.added].join(" ");
    const hits = [...keyWords(text)].filter((w) => topic.has(w)).length;
    return hits / Math.sqrt(text.split(/\s+/).length + 1);
  };
  return [...(change.hunks ?? [])].sort((a, b) => score(b) - score(a));
}

export function loadData() {
  const sources = JSON.parse(read("sources.json"));

  const policies = sources.map((s) => {
    const file = `policies/${s.company}/${s.doc}.txt`;
    const readable = exists(file);
    return {
      ...s,
      key: `${s.company}-${s.doc}`,
      name: docName(s.doc),
      readable,
      words: readable ? words(read(file)) : null,
      versions: [],
    };
  });
  const byKey = Object.fromEntries(policies.map((p) => [p.key, p]));

  const changes = [];
  for (const file of allJsonFiles("changes")) {
    const report = JSON.parse(read(file));
    if (report.versions && byKey[`${report.company}-${report.doc}`]) {
      byKey[`${report.company}-${report.doc}`].versions = report.versions;
    }
    for (const c of report.changes ?? []) {
      const policy = byKey[`${c.company}-${c.doc}`];
      const sizeAfter =
        report.versions?.find((v) => v.date === c.date)?.words ?? policy?.words ?? null;
      changes.push({
        id: `${c.company}-${c.doc}-${c.date}${c.source === "daily" ? "-d" : ""}`,
        company: c.company,
        companyName: companyName(c.company),
        doc: c.doc,
        docName: docName(c.doc),
        date: c.date,
        source: c.source ?? "daily",
        changedWords: c.changed_words,
        percent: sizeAfter ? Math.min(100, Math.round((c.changed_words / sizeAfter) * 100)) : null,
        sizeAfter,
        summary: c.ai?.summary ?? null,
        severity: c.ai?.severity ?? "pending",
        categories: c.ai?.categories ?? [],
        whatYouCanDo: c.ai?.what_you_can_do ?? null,
        headline: headlineFrom(c),
        quote: quoteFrom(c),
        hunks: byRelevance(c),
        archiveBefore: c.archive_before ?? null,
        archiveAfter: c.archive_after ?? null,
        url: policy?.url ?? null,
      });
    }
  }
  changes.sort((a, b) => b.date.localeCompare(a.date));

  const companyIds = [...new Set(sources.map((s) => s.company))].sort((a, b) =>
    companyName(a).localeCompare(companyName(b)),
  );
  const companies = companyIds.map((id) => {
    const docs = policies.filter((p) => p.company === id);
    const count = changes.filter((c) => c.company === id).length;
    const readable = docs.some((p) => p.readable);
    return {
      id,
      name: companyName(id),
      docs: docs.map((p) => p.name),
      changes: count,
      status: count ? "has" : readable ? "none" : "need",
      label: count ? `${count} change${count === 1 ? "" : "s"}` : readable ? "No changes yet" : "Needs a browser",
    };
  });

  const featured = changes.find((c) => c.severity === "major") ?? changes[0] ?? null;

  // Which companies have no history loaded yet (no archive report).
  const withHistory = new Set(policies.filter((p) => p.versions.length).map((p) => p.company));
  const historyPending = companies.filter((c) => !withHistory.has(c.id)).map((c) => c.name);

  const categoryCounts = {};
  for (const c of changes) for (const cat of c.categories) categoryCounts[cat] = (categoryCounts[cat] ?? 0) + 1;

  const firstYear = 2023;
  const thisYear = new Date().getFullYear();
  const perYear = [];
  for (let y = firstYear; y <= thisYear; y++) {
    perYear.push({ year: y, count: changes.filter((c) => c.date.startsWith(String(y))).length });
  }

  return {
    builtAt: new Date().toISOString(),
    policies,
    companies,
    changes,
    featured,
    historyPending,
    categoryCounts,
    perYear,
    charts: policies
      .filter((p) => p.versions.length > 1)
      .map((p) => ({
        key: p.key,
        title: `${companyName(p.company)} ${p.name}`,
        versions: p.versions,
        today: p.words,
        changes: changes
          .filter((c) => c.company === p.company && c.doc === p.doc)
          .map((c) => ({ date: c.date, severity: c.severity, id: c.id, label: c.headline })),
      })),
  };
}
