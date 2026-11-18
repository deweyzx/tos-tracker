# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Everyday people who use big tech apps (Spotify, Discord, Google, TikTok, Meta, OpenAI and others) and want to know what changed in a privacy policy or terms of service without reading a 10,000-word document. Students and journalists are secondary audiences who also value the exact wording and sources.

## Product Purpose

ToS Tracker reads the privacy policies and terms of service of 12 companies (17 pages) every morning, detects real wording changes (not formatting or date stamps), and explains each change in plain English with the exact text that was removed and added. Past changes back to 2023 are rebuilt from Internet Archive copies.

Success in a visitor's first 30 seconds: they see what changed recently, can tell fresh and major changes apart at a glance, and can open one to read the exact before/after wording and the summary.

## Positioning

Every change is shown word for word next to its AI summary, with links to the archived copies before and after, so a reader can check the summary themselves instead of trusting it. Changes are dated by when they were first seen and found automatically every day.

## Operating Context

- A static Astro site in `site/`, published to GitHub Pages (https://deweyzx.github.io/tos-tracker/) and rebuilt after the daily GitHub Actions check.
- Data is files in the repo, not a database: `sources.json` (what is watched), `policies/` (today's text), `changes/` (daily change reports) and `changes/archive/` (history from the Internet Archive).
- AI summaries come from Claude Haiku via `summarize.py`. Many archive changes do not have a summary yet; the site must handle that state.
- Visitors arrive from search or a shared link, on desktop or phone.

## Capabilities and Constraints

- Tabs: Overview, Latest (all changes by month, filterable), Companies (with pins saved in the browser), History (policy length over time). One page per change with the exact wording.
- Some sites (Reddit, Meta) need a real browser to scrape; the site says so instead of hiding it.
- Email alerts do not exist yet (planned). Do not show signup forms or buttons for them until they work.
- No server: everything is prebuilt HTML plus a small script.

## Brand Commitments

- Name: ToS Tracker. Built by Owen Moran.
- Voice: plain English, sentence case, no hype; say what something is or does.
- Binding visual commitments (owner's choice, Nov 17, 2026): fresh changes are marked more strongly than old ones, fading over a year (the "afterglow" rule), and the featured change carries one slow moving line around its border. In the current newspaper "corrections column" world these are drawn as fresh ink marks and a red pencil line, not as glow (the owner allowed earlier requests to be overridden for a better result, Nov 17).

## Evidence on Hand

- Real data: 206 detected changes across 17 pages (2023 to now), all with AI summaries (55 rated major, Nov 18), each linked to Internet Archive copies.
- No testimonials, user counts, press or partners exist. Never invent them, or any other numbers.

## Product Principles

1. Show the evidence: exact removed and added wording and its sources come with every claim.
2. Fresh and important first: a visitor should spot what changed recently and what matters most without reading everything.
3. Honest about state: say when a summary is missing, a site can't be read, or a feature isn't built yet.
4. Plain language over legal language, for people who will never read the full policy.

## Accessibility & Inclusion

WCAG 2.1 AA: all text at least 4.5:1 contrast, full keyboard use with visible focus and a skip link, tap targets at least 44px on phones, and the system "reduce motion" setting respected (the circling light switches off). Information is never shown by color or glow alone.
