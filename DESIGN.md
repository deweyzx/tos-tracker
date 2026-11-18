---
name: ToS Tracker
description: A newspaper corrections column for the documents you agreed to, printing what big tech changed in its privacy policies and terms word for word.
colors:
  bg: "#F4F5F2"
  panel: "#FBFBF9"
  inset: "#EEF0EC"
  raise: "#E8EAE5"
  ink: "#16181D"
  accent-fill-hover: "#2D3139"
  strong: "#121418"
  text: "#24282F"
  soft: "#4C525C"
  faint: "#646A74"
  struck-text: "#6B4048"
  edge: "#D5D8D2"
  edge-hi: "#B4B8B1"
  edge-hover: "#80857D"
  major: "#C1121F"
  accent: "#1D4ED8"
  amber: "#8A5300"
typography:
  display:
    fontFamily: "Archivo Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "58px"
    fontWeight: 850
    lineHeight: 0.98
    letterSpacing: "-0.008em"
    fontVariation: "\"wdth\" 66"
  headline:
    fontFamily: "Archivo Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "48px"
    fontWeight: 850
    lineHeight: 1
    fontVariation: "\"wdth\" 66"
  headline-correction:
    fontFamily: "Archivo Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "34px"
    fontWeight: 820
    lineHeight: 1.02
    fontVariation: "\"wdth\" 70"
  nameplate:
    fontFamily: "Archivo Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "26px"
    fontWeight: 850
    lineHeight: 1
    letterSpacing: "-0.005em"
    fontVariation: "\"wdth\" 68"
  title:
    fontFamily: "Archivo Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "22px"
    fontWeight: 780
    lineHeight: 1.1
    fontVariation: "\"wdth\" 72"
  name:
    fontFamily: "Archivo Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "16px"
    fontWeight: 780
    fontVariation: "\"wdth\" 84"
  lead:
    fontFamily: "Archivo Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "19px"
    fontWeight: 400
    lineHeight: 1.5
  body:
    fontFamily: "Archivo Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Archivo Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "13px"
    fontWeight: 650
  tag:
    fontFamily: "Archivo Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 750
    fontVariation: "\"wdth\" 90"
  redline:
    fontFamily: "Source Serif 4 Variable, Georgia, Times New Roman, serif"
    fontSize: "22px"
    fontWeight: 400
    lineHeight: 1.55
  document:
    fontFamily: "Source Serif 4 Variable, Georgia, Times New Roman, serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.65
  excerpt:
    fontFamily: "Source Serif 4 Variable, Georgia, Times New Roman, serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.45
rounded:
  none: "0px"
  tag: "2px"
  control: "3px"
spacing:
  module: "8px"
  section-rule-gap: "12px"
  row: "16px 0"
  grid-column-gap: "32px"
  grid-row-gap: "40px"
  grid-row-gap-phone: "28px"
  page-gutter: "32px"
  page-gutter-phone: "16px"
  correction: "32px"
  correction-phone: "20px 18px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "#FFFFFF"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 18px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.accent-fill-hover}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 18px"
    height: "40px"
  button-ghost-hover:
    backgroundColor: "{colors.ink}"
    textColor: "#FFFFFF"
  correction:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.none}"
    padding: "{spacing.correction}"
  tag-major:
    backgroundColor: "{colors.major}"
    textColor: "#FFFFFF"
    typography: "{typography.tag}"
    rounded: "{rounded.tag}"
    padding: "2px 8px"
  tag-moderate:
    backgroundColor: "transparent"
    textColor: "{colors.accent}"
    typography: "{typography.tag}"
    rounded: "{rounded.tag}"
    padding: "2px 8px"
  tag-minor:
    backgroundColor: "transparent"
    textColor: "{colors.soft}"
    typography: "{typography.tag}"
    rounded: "{rounded.tag}"
    padding: "2px 8px"
  search-trigger:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.soft}"
    rounded: "{rounded.control}"
    height: "36px"
  menu-button:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "38px"
  menu-item-focus:
    backgroundColor: "{colors.ink}"
    textColor: "#FFFFFF"
---

# Design System: ToS Tracker

*Replaces the glossy world, Nov 17 2026.* The dark glass-and-glow system recorded here before is gone from the build. What carried over is the product's own commitments (plain voice, the redline as the point, accessibility, fresh-versus-old marking, one moving line on the featured change); the visual system below is new and is read from the shipped `site/src/styles/site.css`, `Base.astro`, `index.astro`, `change/[id].astro`, `ChangeRow.astro`, `Hunk.astro` and the chart code in `app.js`.

## Overview

**Creative North Star: "The corrections column"**

The site is a newspaper's corrections column for the documents you agreed to. Every change is printed as a correction: what was removed is struck through in red pencil, what was added is underlined in blue pencil. The page is cool newsprint with true-ink rules, a masthead with a double rule, condensed newspaper-gothic headlines for everything we say, and a book serif for every word the companies wrote. It refuses both category defaults: the dark glowing dashboard and the cream "editorial" page.

Nothing is enclosed in cards. Sections open with a heavy ink rule and divide inside with hairlines, columns and whitespace. The one box on the page is the correction notice that prints the newest significant change, and one red pencil stroke travels slowly around its border. Every motion on the site is a pencil doing its job: marking up the correction as the page opens, inking a changed spot when you reach it, drawing the History line. Nothing else moves. Recency is shown with fresh ink: a dot beside each date is solid when the change is new and fades to an outline over a year.

Density is a reading density: generous type, an 8px module under every gap and rule, and one plain sentence of purpose at the top.

**Key Characteristics:**
- Cool newsprint ground, true ink rules, no cards.
- Two editor's pencils: red strikes removed wording and marks Major; blue underlines added wording, links and fresh marks.
- Archivo condensed (width axis) for our words; Source Serif 4 only for the companies' words.
- One box (the correction), one loop (the red pencil stroke around it); all other motion is a pencil marking something once.
- Proofreader's marks in the margin: a caret for added, a dele loop for removed, a slash and caret for an edited sentence.
- Fresh ink dots encode recency; the date is always written too.
- Word-level redlines with real `<del>`/`<ins>` and hidden labels.

## Colors

Newsprint and ink, almost monochrome, with two pencil colours that each carry exactly one meaning.

### Primary
- **Blue Pencil** (`accent`): added wording (underline under `<ins>`, the caret proof mark), text links ("See all", "Show all changes"), fresh-ink dots, the pinned bead, the Moderate tag, the chart's "grew" jumps and added-line type, focus rings, text selection tint (18%) and the caret. Its r,g,b form (`--glow`, 29,78,216) drives tints: 7% behind inserted words, 8% behind pin counts, 55% for a 1–3 month dot.

### Secondary
- **Red Pencil** (`major`): removed wording (the strike under `<del>`, the dele proof mark), the Major tag (solid red, white text), Major fresh-ink dots, and the stroke travelling around the correction. Its r,g,b form (`--glow-red`, 193,18,31) gives the 55% Major dot.
- **Struck Ink** (`struck-text`): the colour of the struck words themselves, a dark red-brown so removed text stays readable under the red line.

### Tertiary
- **Needs-a-browser Amber** (`amber`): the status dot for a company whose pages load with JavaScript. Status only.

### Neutral
- **Newsprint** (`bg`): the page, the masthead, chart label halos.
- **Proof Sheet** (`panel`): the correction box and everything that floats (menus, search, tooltip, pinned bar), plus the search trigger and menu buttons.
- **Inset** (`inset`): `kbd` keys. **Raise** (`raise`): hovered rows, timeline entries, focused search results.
- **Ink** (`ink`): section rules, the masthead double rule, headlines, filled buttons, the current-section bar, the focused menu item. **Pressed Ink** (`accent-fill-hover`) is the filled button's hover.
- **Strong / Text / Soft / Faint** (`strong` / `text` / `soft` / `faint`): headings and inserted words / body / secondary text / dates and hints.
- **Hairline / Control edge / Hover edge** (`edge` / `edge-hi` / `edge-hover`): rules between rows / borders of tags, chips and the search trigger, and the ring of an old fresh-ink dot / link underlines and the pin bead ring.

### Named Rules
**The Two Pencils Rule.** Red means removed or Major; blue means added, clickable or fresh. Everything else is ink and grey. Filled buttons and "current" markers are ink, not blue.

**The Lightest Ink Rule.** `faint` (4.9:1 on newsprint) is the lightest text colour allowed. All text is at least 4.5:1 against its ground.

## Typography

**Display Font:** Archivo Variable, using its width axis (with system-ui, -apple-system, Segoe UI)
**Document Font:** Source Serif 4 Variable (with Georgia, Times New Roman)

**Character:** Archivo, condensed and heavy, is the newspaper gothic for everything the site says; the narrower and heavier it is, the more it is a headline. Source Serif 4 sets only the companies' own wording, so the typeface tells you whose words you are reading.

### Hierarchy
- **Display** (850, 58px, 0.98, width 66%; 50px below 1080px, 40px on phones): the one opening sentence on the overview.
- **Headline** (850, 48px, 1, width 66%; 38px view titles and 36px change pages on phones): tab titles and change-page headlines.
- **Correction headline** (820, 34px, 1.02, width 70%, max 22ch; 28px on phones): the headline inside the correction.
- **Nameplate** (850, 26px, width 68%; 24px on phones): "ToS Tracker" in the masthead.
- **Title** (780, 22px, 1.1, width 72%): section headings. Month headings are 15px at 780, width 80%, over a 1.5px ink rule.
- **Name** (780, 16px, width 84%): company names in rows, the Companies list and search.
- **Lead** (19px, 1.5, max 38em; 18px under tab titles and change headlines): the standfirst.
- **Body** (400, 15px, 1.5): everything else. Numbers use tabular figures.
- **Label** (650, 13px): dates, hints, notes. **Tag** (750, 12px, width 90%): severity tags.
- **Redline** (Source Serif, 22px, 1.55, max 34em; 19px on phones): the quote in the correction.
- **Document** (Source Serif, 17px, 1.65, max 40em; 16px on phones): the exact wording on change pages and the "Repeated throughout" list.
- **Excerpt** (Source Serif, 17px, 1.45, two lines max): summaries and changed wording in feed rows.

### Named Rules
**The Whose Words Rule.** Our words are Archivo; the companies' words are Source Serif 4. Never the other way round, and no third family.

**The Sentence Case Rule.** Sentence case everywhere. No all-caps labels and no small label above a heading: the heading says it.

**The Condensed Means Headline Rule.** Width tracks rank: 66% for page headlines, 70–72% for correction and section headings, 80–90% for names, tags and nav, 100% for reading text.

## Layout

- A 12-column grid in a 1240px column, 32px column gap and 40px row gap (28px rows, no column gap on phones), 32px side gutter (16px on phones). Every rule thickness and gap sits on an 8px module.
- **Masthead:** sticky, three columns (nameplate left, section links centre, "Checked daily" and search right) closed by a heavy 3px ink rule, a 4px strip of newsprint and a 1px ink rule. On phones the links drop to a second row of four equal 44px targets.
- **Overview:** the display sentence and standfirst in 8 columns; the correction directly under it (8 columns, pulled up 16px); "How it works" as a 4-column sidebar behind a 1px vertical rule (above 1080px) with its own 3px ink rule; "More recent changes" full width below. Below 1080px everything stacks.
- **Rows:** a three-column grid (96px date, 160px company, the wording up to 46em), 16px vertical padding, hairline between rows; a single column on phones. Hover fills `raise` and bleeds 12px either side.
- **Companies:** three columns, two below 900px, one on phones. **History:** full-width chart, then a timeline under a 1.5px ink rule.
- **The length chart (History):** a step line, because a policy's length only changes when a new version appears.
  - **Ink and pencils:** the flat stretches are ink (2.5px). Each jump is a pencil stroke (3px): blue if the policy grew, red if it shrank.
  - **Change dots:** small solid ink, or blue when fresh / red when Major (the fresh-ink rule).
  - **Spikes are skipped:** a copy far longer or shorter than both neighbours, where the jump was flagged as mostly page layout, is left out of the line and shown as a faint dashed ring. Its tooltip says why. (X's page shows the old and new terms together while a change is pending.)
  - **Jump labels:** the three biggest jumps of 300+ words get a direct label ("+1,170") in text ink, placed only where no dot, edge or other label is in the way.
  - **Today:** a dotted step to an ink square labelled "Today 9,778".
  - **The column of type:** the area under the line is filled with greeked rows of type (a 96×12 pattern of word-length dashes, ink at 18%), so the policy reads as a column of printed text and a longer policy is literally a taller column. The axis starts at zero because the column is filled.
  - **Added and cut lines:** after a jump, the changed band keeps its pencil colour until the next jump. Added lines are set in blue type (55%); cut lines show as faint red type (35%) above the column.
  - **No grid lines:** a short tick marks each value, and the type rows give the scale its texture. The baseline is a 1.5px ink rule.
  - **Legend:** length in words, lines added, lines cut, layout-only copy skipped.
  - **Animation:** the column fills in behind the pen, from left to right.
- **Change page:** one 860px column; the exact wording comes before "Where this came from".
- Breakpoints at 1080 (stack), 1000 (search becomes a 44px icon), 900, 760 (phone) and 400px.
- Every tap target on phones is at least 44px; the skip link is the first thing keyboard users reach.

### Named Rules
**The 8px Module Rule.** Gaps, padding and rule positions are multiples or clean halves of 8px (4, 8, 12, 16, 24, 32, 40).

## Elevation & Depth

The page is flat paper. Depth on the page comes from rules, not shadows: a 3px ink rule opens a section, a 1.5px ink rule opens a sub-list, a 1px hairline divides rows. The correction box has a 1.5px ink border and no shadow.

Only things that float above the page lift off it, with one soft ink-tinted drop shadow and a 1.5px ink border:

### Shadow Vocabulary
- **Float** (`box-shadow: 0 18px 40px -16px rgba(22,24,29,.35)`): menus and the pinned bar.
- **Dialog** (`box-shadow: 0 30px 70px -24px rgba(22,24,29,.5)`): the "Find a company" panel, over a veil of `rgba(22,24,29,.35)`.

### Named Rules
**The Rules Not Cards Rule.** Sections open with a 3px ink rule and group inside with hairlines and whitespace. No cards, no tinted section backgrounds.

**The One Box Rule.** The correction is the only enclosed block on the page. Floating things (menus, search, tooltip, pinned bar) are boxed because they are not on the page.

**The Fresh Ink Rule.** A dot by each date shows how recent a change is: solid blue (scaled 1.15) within a month, a 55% tint within three months, a blue outline within a year, a grey hairline ring after that. Major changes use red at every step and keep a red outline when old. The date is always written beside it, and the feed footer explains the marks.

## Shapes

- Square by default. Controls (buttons, search trigger, menu buttons, the pin target) have a 3px corner; tags and `kbd` 2px; the correction, menus, chips, search and the pinned bar are square. Dots and the pin bead are circles.
- Borders are ink: 1.5px on buttons, menu buttons and every boxed surface; 1px `edge-hi` on tags, chips and the search trigger.
- The logo is a tiny correction: a red struck line over a blue line.

## Components

### Buttons
- **Primary** (`.cta`): solid ink, white text, 700 weight, 40px tall (44px on phones), 18px side padding, 3px corner; hover lightens to pressed ink. One per screen.
- **Secondary** (`.ghost`): 1.5px ink outline, ink text; hover fills with ink and turns the text white.
- **Text links**: blue, 700, underlined 1.5px with a 4px offset; hover turns them ink. Footer and "Show more" links are ink with an `edge-hover` underline that darkens on hover.
- **Focus**: a 2px blue outline, 2px offset, on everything.

### Navigation
- Four section links in Archivo at 650, width 88%, `soft` grey; hover and current turn ink. A 4px ink bar under the current link slides to the one you pick (.35s). The Latest count is blue and hidden on phones.

### Severity tags
- Major: solid red with white text. Moderate: blue text and blue outline. Minor: `soft` text, `edge-hi` outline. 2px corner. Unrated changes show no tag; their size is written in a sentence instead.

### The correction (signature)
Proof-sheet fill, 1.5px ink border, 32px padding. Contents in order: the correction headline (no label above it), the redline quote in the serif, a hairline, one meta sentence led by the severity tag ("[Company] [policy], found [date]. N words changed in N places, about N% of the policy."), then "Read the whole change" and "See the old version". A single red pencil stroke (an SVG rect with `pathLength=1`, 2.5px, a 7% dash) travels the border once every 7 seconds, linear. It is hidden under reduced motion.

### The redline
Real `<del>` and `<ins>` with sr-only "Removed:" / "Added:" labels. Removed words: struck-ink colour, red line-through 1.5–2px. Added words: strong text, blue underline 2–2.5px at a 4–5px offset over a 7% blue wash. On change pages the redline is word-level: an edited sentence shows once marked ±, with only the changed words struck or underlined; sentences only removed or only added show whole, marked − (red) or + (blue), so nothing depends on colour. A "Repeated throughout" list above the passages, closed by a 1.5px ink rule, states a repeated edit once. Passages separate with hairlines; long ones fold behind "Show N more changed lines".

### Feed rows
Date with its fresh-ink dot, company name and policy with the tag under it, then the AI summary in the serif or, before there is one, one line of changed wording led by its proof mark (blue caret or red dele). A 13px note gives the size. Month headings sit over a 1.5px ink rule; "where your last visit ended" is a 2px ink rule with a label, a mark rather than a colour.

### Menus, search and pinned bar
Proof-sheet fill, 1.5px ink border, the Float or Dialog shadow. The focused menu item is filled ink with white text. Search results highlight with `raise`. The pinned bar appears only once a company is pinned; its chips are square, 36px (44px on phones), with blue counts.

### Motion: "the editor marks it up"
Every motion is a pencil doing its job. Strikes and underlines are painted as backgrounds whose width is the registered property `--d` (0% → 100%), so a pencil draws them across wrapped lines in reading order. The pen's curve is `--pen` (`cubic-bezier(.55,.05,.35,1)`).
- **Focal moment (overview, once on load):** the featured quote's strike draws (.3s delay, .6s), then the insertion's underline and tint (.85s delay, .75s), then the pencil lap fades in at 1.5s.
- **The one loop:** the red pencil stroke around the correction (7s per lap).
- **Inking (change pages):** a changed spot below the first screen is struck and underlined once when it scrolls into view (.55s, insertions .25s later). The text is always visible; only the marks wait. Print shows every mark.
- **History pen:** each chart's line is drawn the first time it opens (1.1s linear); each change dot appears as the pen passes it. Resizing doesn't replay it.
- **Logo:** the red strike redraws on hover (.45s).
- **Opening the featured change:** its headline carries over to the change page (cross-document view transition, .32s); other pages cross-fade (.14s out, .22s in).
- **Answers to the visitor:** the nav bar slide (.35s, `cubic-bezier(.2,.8,.2,1)`), menus (.12–.15s), hovers (.15–.2s).
- **Reduced motion:** every mark is shown fully drawn, the pencil is hidden, and nothing animates. **Forced colours:** marks fall back to real line-through and underline.

## Do's and Don'ts

### Do:
- **Do** open every section with a 3px ink rule and divide inside with 1px hairlines.
- **Do** keep the correction the only box on the page, with its single red pencil stroke.
- **Do** set the companies' words in Source Serif 4 and ours in condensed Archivo.
- **Do** mark removed wording with `<del>` struck red and added wording with `<ins>` underlined blue, each with a hidden label and a proofreader's mark in the margin (blue caret, red dele loop, or slash and caret for an edited sentence).
- **Do** show recency with fresh-ink dots and always write the date beside them.
- **Do** keep tap targets at least 44px on phones, text at least 4.5:1, and stop all motion under reduced motion.

### Don't:
- **Don't** wrap content in cards, tinted panels or shadowed boxes; only floating menus, search, tooltips and the pinned bar are boxed.
- **Don't** add motion that isn't a pencil marking something: no fades, slides or lifts for their own sake, and only one loop (the pencil around the correction).
- **Don't** use red for anything but removed wording and Major, or blue for anything but added wording, links, fresh marks and pins.
- **Don't** use dark glowing surfaces, glass, gradients or a cream "editorial" ground; the paper is cool newsprint.
- **Don't** put a small label above a heading or use all-caps labels.
- **Don't** use stat tiles or big numbers; say the size of a change in a sentence.
