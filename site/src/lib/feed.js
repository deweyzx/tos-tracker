// feed.js: builds the Atom feeds (feed.xml for every company, feed/<company>.xml
// for one). A feed reader, or a feed-to-email service, checks the address and shows
// new changes as they're found. Atom rather than RSS 2.0: its dates and ids are
// stricter, and every reader that takes RSS takes Atom too.

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const SEVERITY = { major: "Major", moderate: "Moderate", minor: "Minor" };

export function atomFeed({ site, base, title, path, changes, builtAt }) {
  const root = new URL(`${base}/`, site).href;
  const self = new URL(`${base}/${path}`, site).href;
  const items = changes.slice(0, 50); // newest first; older ones are on the site
  const updated = items[0] ? `${items[0].date}T12:00:00Z` : builtAt;
  const entry = (c) => {
    const link = new URL(`${base}/change/${c.id}/`, site).href;
    const rating = SEVERITY[c.severity] ? `${SEVERITY[c.severity]} change. ` : "";
    const text = c.summary ?? `${c.changedWords} words changed.`;
    const action = c.whatYouCanDo ? ` What you can do: ${c.whatYouCanDo}` : "";
    return `  <entry>
    <title>${esc(c.headline)}</title>
    <link href="${esc(link)}"/>
    <id>${esc(link)}</id>
    <updated>${c.date}T12:00:00Z</updated>
    <category term="${esc(c.companyName)}"/>
    <summary>${esc(`${c.companyName}'s ${c.docName}. ${rating}${text}${action}`)}</summary>
  </entry>`;
  };
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${esc(title)}</title>
  <subtitle>Changes to privacy policies and terms of service, found by checking each page every day.</subtitle>
  <link href="${esc(root)}"/>
  <link rel="self" href="${esc(self)}"/>
  <id>${esc(self)}</id>
  <updated>${updated}</updated>
  <author><name>ToS Tracker</name></author>
${items.map(entry).join("\n")}
</feed>
`;
}

export const atomResponse = (xml) => new Response(xml, { headers: { "Content-Type": "application/atom+xml; charset=utf-8" } });
