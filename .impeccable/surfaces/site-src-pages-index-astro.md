---
version: 1
slug: "site-src-pages-index-astro"
primary_target: "site/src/pages/index.astro"
related_targets: ["site/src/pages/change/[id].astro","site/src/layouts/Base.astro"]
---

# Surface brief: ToS Tracker site (overview, Latest, Companies, History, change pages)

Scope: the whole public site. Mode: Read (visitors scan what changed and read the exact wording). Code-led.
Audience and job: everyday app users who heard a policy changed; see what changed recently, open one, read the exact wording and its sources.
Constraints: static Astro, WCAG AA, all usability work stays (feed excerpts, word-level redlines with "Repeated throughout", filters in the URL, Back restores place, 44px phone targets, no fake features). Brand commitments (PRODUCT.md) are translated, not dropped: afterglow becomes fresh ink, the circling light becomes a red pencil line travelling around the correction box.

## Direction contract

THESIS: The site is a newspaper's corrections column for the documents you agreed to: every change is printed as a correction, struck in red pencil and added in blue. It refuses both category defaults: the dark glowing dashboard and the cream "editorial" page.

OWN-WORLD: Cool newsprint white (#F4F5F2) with true ink (#16181D) rules. Two editor's pencils: red (#C1121F) strikes what was removed, blue (#1D4ED8) underlines what was added and marks what you can click. Archivo, condensed and heavy, is the newspaper gothic for everything we say; Source Serif 4 sets every word the companies wrote. No cards: rules, columns and whitespace group things. The one box on the site is the correction notice.

STORY: The visitor reads one headline sentence of purpose, meets the newest change printed as a correction, scans the columns of recent corrections below (a flag shows where their last visit ended), opens one, reads the word-level redline, checks the archived sources.

FIRST VIEWPORT: Masthead: nameplate left, section links centre with an ink bar under the current one, search right, a heavy and a thin rule beneath. Left 8 columns: a 56px condensed headline, a one-paragraph standfirst, then the correction box (1.5px ink border, a red pencil line slowly travelling around it): headline, the redline in 21px serif, one meta line, "Read the whole change". Right 4 columns behind a vertical rule: "How it works" as a sidebar column. "More recent changes" starts at the fold under a heavy section rule.

FORM: The newspaper corrections column, candidate 7 of my seven-item list (1 nutrition / privacy label, 2 Word track changes, 3 bank change-in-terms mailer, 4 Consumer Reports ratings, 5 thermal receipt, 6 product recall notice, 7 newspaper corrections box). seed:5b26a800bed02090. Raised by declined challengers: from the film cutting bench, state is a mark not a hue (a "you were last here" flag in the feed); from the cracktro scroller, nothing is enclosed except the one correction box; from the brick instructions, one shared module (8px) that every rule and gap sits on. Signature interaction: the red pencil line circles the correction box (off with reduced motion). Motion grammar (amended Nov 18, owner's request for animated features): every motion is a pencil doing its job. The red pencil line is the only loop; the featured correction is marked up once on load (strike, then insertion); changed spots on change pages are inked once when reached; the History pen draws each chart once; the logo strike redraws on hover; the featured headline carries over to its own page (view transition). Tab bar and menus answer clicks. Reduced motion shows every mark fully drawn and nothing moving.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
