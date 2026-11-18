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
| `--edge-hover` / `--accent-fill-hover` | `#3A4559` / `#1D55D0` | Hover borders and the hover state of the main button |
| `--glow-hi` / `--glow-red-hi` | `#9CC1FF` / `#FFB3C3` | The bright center of a freshly lit dot (blue / red) |

No color is typed directly into the pages or the chart script; everything reads these tokens.

Rules: **blue means "added, selected or clickable"; red means "removed or major"; everything else is gray.** All text is at least 4.5:1 against its background.

## Type

- **Inter** for everything the site says (our words).
- **A serif for the companies' own words** (the quote on the overview and the exact wording on change pages): Iowan Old Style, Charter, Cambria or Georgia, whichever the device has. Nothing is downloaded. The switch of typeface tells you at a glance whose words you're reading.
- Page title 34px, change headlines 28–30px, body 14px (16px for summaries), line height 1.5–1.65. Numbers use tabular figures.
- Sentence case everywhere. No all-caps labels, and no small label ("eyebrow") above a heading: the heading says it.
- Reading width: summaries and notes stop at about 34em (~75 characters); the companies' wording at about 42em.

## The one bold thing

The redline: old sentence struck through in red, new sentence underlined in blue and lit, in the serif at 20px. It's set as **type between two hairlines, not a box inside the panel**. On change pages each changed spot is a passage separated by hairlines, and the redline is **word-level**: a sentence that was edited shows once (marked ±), with only the changed words struck in red or underlined and lit in blue. Sentences that were only removed or only added show whole, marked − or +, so the difference never depends on color alone. When the same small edit repeats across the policy ("Added 'our features that are part of' in 14 places"), a "Repeated throughout" list above the passages says it once. The diff logic is `site/src/lib/redline.js`. Removed and added text is real `<del>`/`<ins>` markup with hidden "Removed:" / "Added:" labels for screen readers.

The redline also leads the **Latest feed**: until a change has an AI summary, its row shows one sentence of the company's changed wording in the serif, starting with a blue + (added) or a red − with strikethrough (removed), with the size of the change underneath. An AI summary, when there is one, is the strongest text in the row. The severity tag sits under the company name. Changes where 80%+ of the page changed at once are labelled "mostly a page-layout or archive change" instead of quoted.

## Glow: "afterglow"

**Light comes from change.** New wording and fresh changes give off light, which fades as they get older; removed and old things stay dark. Glow is information, never wallpaper. (Added Nov 17, 2026: the owner missed the glow from the first version, so it came back with a rule behind it. Linear's changelog does the same with one lit dot on its newest entry.)

| Where | What glows | Why |
|---|---|---|
| The redline | New wording gives off a soft blue light (on the overview quote and on every added line of a change page) | The new words are the news. Removed words stay dark |
| Latest feed and History timeline | A dot by each date. Bright with a halo = found in the last month; plain blue = last 3 months; dim = last year; dark ring = older. Red instead of blue for Major | You can see at a glance what's fresh. The feed footer explains it, and the date is always written too, so nothing depends on the light alone |
| History chart | A soft halo on the line; changes from the last 3 months glow | Same rule as the feed |
| "Major" tag | Faint red halo, **on every Major tag regardless of age** | Red means "this matters". The one deliberate exception to "glow = fresh": the owner chose to keep it (Nov 17, 2026) because a major change always matters |
| Logo | The red (struck) and blue (added) lines are faintly lit | It's a tiny redline |
| Top of the page | One still blue light behind the opening sentence | The single light source. It doesn't move or breathe |
| Things you act on | The main button and the selected tab have a soft blue glow; on hover, the featured change's border lights up under your pointer | Glow that answers you |
| The featured change | A slow light circles its border, one loop every 7 seconds | The featured slot always holds the **newest significant change** (a rated change from the last 3 months first, otherwise the newest real change, never a layout-sized one), so the light always sits on something fresh. **The only thing on the page that moves by itself.** Off for anyone with "reduce motion" on |

Tokens: `--glow` (74,140,255) and `--glow-red` (255,107,138), written as r,g,b so any strength can be used. Apart from the circling light, nothing moves by itself (checked: exactly 1 running animation).

Impeccable's detector flags any colored glow on a dark background as an AI tell. These glows are the owner's confirmed choice, so `.impeccable/config.json` records a narrow exception for `dark-glow` and `radial-halo` in `site/src/styles/site.css` only, with that reason. Anything glowing outside these rules is still flagged.

## Surfaces and components

- **Panel** (`.panel`): solid `--panel`, 1px `--edge` border, 14px radius. Buttons and tags 6–8px. **No boxes inside panels and no colored side stripes**: inside a panel, group with hairlines and spacing.
- **Main button** (`.cta`): solid `--accent-fill`, white text. **Secondary** (`.ghost`): outline only. One main button per screen.
- **Tabs:** the selected tab is filled `--accent-fill`; the fill slides to the tab you pick (motion that answers a click).
- **Severity tags:** Major (red outline and tint), Moderate (blue outline), Minor (plain). Changes without an AI summary show no tag at all, and the feed says how big the change was instead.
- **Latest feed:** grouped under month headings, newest first. About the first 30 changes show; older months fold behind "Show N older changes" (a filtered list always shows every match). The filter offers All, Major only, each company, and topics once 10+ changes have summaries. The filter lives in the address (`#latest/spotify`), and Back from a change page returns to the same list and scroll position.
- **"Find a company"** (Ctrl K / ⌘K): Enter opens that company's changes; the circle next to each name pins it.
- **Filters say so:** a filtered list shows "Showing Spotify only." with a "Show all changes" button; the Latest tab and "See all" links always open the full list. Company names on the Companies tab link to that company's changes.
- **Overview:** the opening sentence, the featured change, a "How it works" panel of plain facts (no progress bars or big-number tiles), and "More recent changes" (the next 5).
- **Pinned bar:** appears only after you pin a company. Nothing is pinned by default.
- **Menus, search, tooltips:** `--raise` with an `--edge-hi` border and one soft shadow (the only shadows on the site, because they float above the page).

## Motion

- None on load. Content is visible immediately.
- One always-moving element: the light circling the featured change (see Glow).
- Otherwise only motion that answers something you did: the tab marker sliding, menus opening, hover color changes.
- Everything respects the system's "reduce motion" setting.

## Layout

- 12-column grid, 14px gaps, max width 1360px. The overview opens with one plain sentence about what the site does.
- On phones everything stacks into one column; the header is one 67px row (logo mark, the four tabs, search icon); every tap target is at least 44px; on change pages the exact wording comes before "Where this came from". Below 1000px the search button shows only its icon.
- Each tab shows one job: Overview (what this is and what changed recently), Latest (all changes by month, with a filter), Companies (who's tracked, pins), History (policy length over time; the menu lists the most recently changed policy first).
- Browser surfaces follow the palette: text selection, scrollbars, the text cursor and form accents.
- A "Skip to content" link is the first thing keyboard users reach.
