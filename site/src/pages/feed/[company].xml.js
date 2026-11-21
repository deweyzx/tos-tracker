// /feed/<company>.xml: one company's changes, newest first.
import { loadData } from "../../lib/data.js";
import { atomFeed, atomResponse } from "../../lib/feed.js";

export function getStaticPaths() {
  return loadData().companies.map((c) => ({ params: { company: c.id }, props: { company: c } }));
}

export function GET({ site, props }) {
  const data = loadData();
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const changes = data.changes.filter((c) => c.company === props.company.id);
  return atomResponse(atomFeed({ site, base, title: `ToS Tracker: ${props.company.name}`, path: `feed/${props.company.id}.xml`, changes, builtAt: data.builtAt }));
}
