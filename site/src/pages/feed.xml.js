// /feed.xml: every company's changes, newest first.
import { loadData } from "../lib/data.js";
import { atomFeed, atomResponse } from "../lib/feed.js";

export function GET({ site }) {
  const data = loadData();
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return atomResponse(atomFeed({ site, base, title: "ToS Tracker: all changes", path: "feed.xml", changes: data.changes, builtAt: data.builtAt }));
}
