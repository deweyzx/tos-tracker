# ToS Tracker design

The look of the website, written down so every page follows the same rules. The actual values live in `site/src/styles/site.css` as CSS variables; this file explains what each one is for.

**Direction:** a dark navy-black dashboard in the style of a macOS app: frosted glass panels with thin bright edges, one blue accent, and motion that answers what you do (hover, open, switch) rather than decorating. Inspired by glass dashboards and dark SaaS products like Raycast and Linear, not by templates.

## Color

| Token | Value | Role |
|---|---|---|
| `--bg` | `#04070E` | Page background: near-black with a little blue |
| `--text` | `#F2F3FA` | Main text |
| `--soft` | `#A3A8C3` | Secondary text: labels, descriptions |
| `--faint` | `#6A7090` | Least important text: dates, hints, axis labels |
| `--edge` / `--edge-hi` | white at 8% / 16% | Hairline borders on glass and buttons |
| `--grad` | `#4A8CFF` → `#1E4FD8` | The one accent: active tab, main buttons, today, menu highlight, pins |
| `--v1` / `--v2` | blue / cobalt | The accent's two ends, used in charts and outlines |
| `--cy` | `#62D2FF` | Cyan, only at the start of data gradients (charts, progress bars) |
| `--major` | `#FF6B8A` | Red is reserved for "Major" changes so they stand out |
| `--ok` / `--amber` | green / amber | Status dots: working / needs a browser |

Rule: **blue means "you can act on this or it's selected"; red means "this matters"; everything else is white at different strengths.**

## Type

- **Inter** (variable, with optical sizing), the font used by Linear, Raycast and Figma. One family for everything.
- At large sizes Inter automatically switches to its tighter "Display" cut; headlines also get negative letter-spacing (−0.03em).
- Body 14px, line height 1.5. Numbers in stat cards use tabular figures so they don't jump while counting up.
- Sentence case everywhere. No all-caps labels.

## Surfaces

- **Glass panel** (`.glass`): faint white gradient, 20px background blur, a 1px inner border, a light line along the top edge, and a dark outer ring so it separates from the background.
- **Hover:** a soft glow follows the pointer across a panel and lights up its border near the cursor.
- **Featured change:** a slow beam of light circles its border (7 seconds per loop). It is the only always-moving element.
- Radius: 18px for panels, 12px for inner boxes, fully round for buttons, chips and tags.

## Components

- **Main button** (`.cta`): blue gradient pill, inner highlight, blue glow; a shine sweeps across on hover.
- **Secondary button** (`.ghost`): clear pill with a hairline border.
- **Tabs:** a sliding blue pill moves to the active tab with a slight spring.
- **Severity tags:** Major (red, glowing), Moderate (blue), Minor (plain).
- **Menus and search** (`.menu`, `.spot`): dark frosted glass, items highlight in the accent gradient, keyboard support (arrows, Enter, Esc).
- **Pinned bar:** floating glass pill at the bottom with the companies you pinned; red badge = number of changes.

## Motion

- One load sequence: panels fade and rise in order, numbers count up, the ring and chart draw in.
- Switching tabs replays a short version for the new page only.
- Everything respects the system's "reduce motion" setting.

## Layout

- 12-column grid, 14px gaps, max width 1360px. On phones everything stacks into one column and the top tabs scroll sideways.
- Each tab shows one job: Overview (headline change and key numbers), Latest (all changes with a filter), Companies (who's tracked, pins), History (policy length over time). Alerts opens from the "Get alerts" button.
