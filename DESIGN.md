# ToS Tracker design

The look of the website, written down so every page follows the same rules. The actual values live in `site/src/styles/site.css` as CSS variables; this file explains what each one is for.

**Direction:** a calm, dark reading tool for legal documents. The thing people come for is the *redline*, the old wording struck out next to the new, so that gets the boldness and everything else stays quiet. Flat, solid panels with hairline borders; no glass, gradients or decorative motion. Glow is used only by the "afterglow" rule below. References: Open Terms Archive (one plain sentence saying what it does), GitHub's changelog (a feed grouped by month) and Wikipedia's diff view (plain red/blue markers on the text).

*Changed Nov 17, 2026:* the first version was a frosted-glass "macOS dashboard" (blur, glowing edges, a circling light beam, gradient buttons with a shine, count-up numbers). Design reviews flagged it as the generic AI-dashboard look, so it was taken out. The backup of the old version is described in PROJECT_NOTES.md.

## Color

| Token | Value | Role |
|---|---|---|
| `--bg` | `#06090F` | Page background |
| `--panel` | `#0C1119` | Every card and panel (solid, no blur) |
| `--inset` | `#080C13` | Boxes inside a panel: the quoted wording, notes, meters |
| `--raise` | `#141B26` | Hover rows, menus, tooltips, the pinned bar |
| `--edge` / `--edge-hi` | `#1B2230` / `#2A3344` | Hairlines / borders of buttons and inputs |
| `--strong` | `#F2F4FA` | Headings and the new wording |
| `--text` | `#BFCDE8` | Body text |
| `--soft` | `#A3A8C3` | Secondary text |
| `--faint` | `#8389A7` | Dates and hints. The darkest text allowed: 5.0:1 on a panel |
| `--accent` | `#4A8CFF` | The one accent as a line: underlines under new wording, chart line, dots |
| `--accent-fill` | `#2563EB` | The accent behind white text: buttons, the selected tab (5.2:1) |
| `--accent-ink` | `#8DB4FF` | The accent as text (counts, "Moderate") |
| `--major` | `#FF6B8A` | Red is reserved for removed wording and "Major" changes |
| `--ok` / `--amber` | green / amber | Status dots: working / needs a browser |

Rules: **blue means "added, selected or clickable"; red means "removed or major"; everything else is gray.** All text is at least 4.5:1 against its background.

## Type

- **Inter** for everything the site says (our words).
- **A serif for the companies' own words** (the quote on the overview and the exact wording on change pages): Iowan Old Style, Charter, Cambria or Georgia, whichever the device has. Nothing is downloaded. The switch of typeface tells you at a glance whose words you're reading.
- Page title 34px, change headlines 28–30px, body 14px (16px for summaries), line height 1.5–1.65. Numbers use tabular figures.
- Sentence case everywhere. No all-caps labels, no labels above every heading.

## The one bold thing

The redline: old sentence struck through in red, new sentence underlined in blue, in the serif at 19px, in its own inset box. Removed and added lines on change pages use the same colors with a 2px bar on the left, like a diff.

## Glow: "afterglow"

**Light comes from change.** New wording and fresh changes give off light, which fades as they get older; removed and old things stay dark. Glow is information, never wallpaper. (Added Nov 17, 2026: the owner missed the glow from the first version, so it came back with a rule behind it. Linear's changelog does the same with one lit dot on its newest entry.)

| Where | What glows | Why |
|---|---|---|
| The redline | New wording: soft blue light around the text; on change pages, a blue halo on the left bar of added lines | The new words are the news. Removed words stay dark |
| Latest feed and History timeline | A dot by each date. Bright with a halo = found in the last month; plain blue = last 3 months; dim = last year; dark ring = older. Red instead of blue for Major | You can see at a glance what's fresh. The feed footer explains it, and the date is always written too, so nothing depends on the light alone |
| History chart | A soft halo on the line; changes from the last 3 months glow | Same rule as the feed |
| Totals | This year's bar in "changes found" | It's the year still counting |
| "Major" tag | Faint red halo | Red means "this matters" |
| Logo | The red (struck) and blue (added) lines are faintly lit | It's a tiny redline |
| Top of the page | One still blue light behind the opening sentence | The single light source. It doesn't move or breathe |
| Things you act on | The main button and the selected tab have a soft blue glow; on hover, the featured change's border lights up under your pointer | Glow that answers you |
| The featured change | A slow light circles its border, one loop every 7 seconds | The headline change reads as "live". **The only thing on the page that moves by itself**, so it stays special. Off for anyone with "reduce motion" on |

Tokens: `--glow` (74,140,255) and `--glow-red` (255,107,138), written as r,g,b so any strength can be used. Apart from the circling light, nothing moves by itself (checked: exactly 1 running animation).

## Surfaces and components

- **Panel** (`.panel`): solid `--panel`, 1px `--edge` border, 14px radius. Inner boxes 10px, buttons and tags 6–8px.
- **Main button** (`.cta`): solid `--accent-fill`, white text. **Secondary** (`.ghost`): outline only. One main button per screen.
- **Tabs:** the selected tab is filled `--accent-fill`; the fill slides to the tab you pick (motion that answers a click).
- **Severity tags:** Major (red outline and tint), Moderate (blue outline), Minor (plain). Changes without an AI summary show no tag at all, and the feed says how big the change was instead.
- **Latest feed:** grouped under month headings, newest first.
- **Pinned bar:** appears only after you pin a company. Nothing is pinned by default.
- **Menus, search, tooltips:** `--raise` with an `--edge-hi` border and one soft shadow (the only shadows on the site, because they float above the page).

## Motion

- None on load. Content is visible immediately.
- One always-moving element: the light circling the featured change (see Glow).
- Otherwise only motion that answers something you did: the tab marker sliding, menus opening, hover color changes.
- Everything respects the system's "reduce motion" setting.

## Layout

- 12-column grid, 14px gaps, max width 1360px. The overview opens with one plain sentence about what the site does.
- On phones everything stacks into one column, the four tabs share the width, and tap targets are at least 44px.
- Each tab shows one job: Overview (what this is and the latest major change), Latest (all changes by month, with a filter), Companies (who's tracked, pins), History (policy length over time).
- A "Skip to content" link is the first thing keyboard users reach.
