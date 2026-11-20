# Design

## Choix du skill design-ui
- **Date / mode / direction**: 2026-11-17, init, custom (derived from the developer's choice among mockups), method for tools and dashboards (`impeccable`, if present).
- **Users**: the developer and friends on a few private servers, 5–20 people, French speaking, on desktop and phone, quick glances or longer exploration.
- **Three main tasks and frequency**:
  1. See the summary of the current month for my server (every visit, several times a week).
  2. See who I spend time with and compare members (weekly).
  3. Look at records and one member's profile (occasionally, plus a yearly recap).
- **Platforms**: web, responsive by available width (compact < 600 px, medium 600–839 px, expanded >= 840 px).
- **Tone (3 words)**: sober, serious, precise. **Anti-goals**: playful or decorative styles (arcade, kawaii, brutalism), giant numerals, several accent colours, gaming-neon look, anything that looks like a copy of Discord.
- **Constraints**: French UI text, light and dark themes, no external chart library, fast on phone, WCAG AA contrast.

## Direction chosen: "Rail and table" (mockup 23), without the rail since 2026-11-18
Update 2026-11-18: the side rail and the bottom bar were removed after the owner's feedback (see DECISIONS). The page is one full-width dashboard grid; navigation returns, probably as top tabs, when a second page exists. The rest below still holds.
Original description: a narrow navigation rail on the left (bottom bar on compact widths), a period selector (7 days / 30 days / 1 year), a strip of key figures, a member table with an hourly mini-bar profile, a day × hour heatmap and a records list. Strict grid, hairline borders, one accent colour per theme, tabular figures in a monospaced font.
Why it fits: the audience reads statistics often and wants density without noise; the table scales from 5 to 20 members; the structure maps directly to the three main tasks.

## Directions rejected
Arcade, full-screen recap, audio studio, neo-brutalism, Japanese minimalism, terminal, metro map, risograph fanzine, Swiss poster (closest early favourite: kept "sober, one colour, strict grid" but not giant numerals), kawaii pastel, constructivist, Bauhaus, inverted Swiss, giant typography, data-art, financial press, sober blue, modular table (18), Braun-style instrument (20), dense spreadsheet (21), dials (22), technical plan (24). The yearly recap may later get its own, more expressive treatment: to decide when F7 starts.

## Evidence & references
- Direction chosen by the developer's own review of about 25 mockups on a design canvas (private, not linked here); no external UX studies or galleries were searched for this decision, and none are cited. Add sources here if a research pass is done before F5.
- Fonts to confirm online before use (licence and availability): Public Sans, JetBrains Mono (both published on Google Fonts at the time of the mockups; not re-verified).

## Tokens (starting point, from the mockup; contrast to be measured in apply mode)
| Token | Light | Dark |
|---|---|---|
| background | `#F4F7F6` | `#0D1211` |
| card | `#FFFFFF` | `#141B19` |
| text | `#0F1A17` | `#E8EFEC` |
| muted text | `#51615C` | `#9BAAA5` |
| line | `#D3DDD9` | `#27322F` |
| accent | `#0E7C66` | `#3DDBB5` |
| text on accent | `#FFFFFF` | `#06201A` |
- Heatmap: accent colour with opacity from 0.07 to 1.0 by value, so one hue carries the whole scale.
- Type: Public Sans for text; JetBrains Mono for figures. **Currently system font stacks** (privacy: no external font service; self-host after a licence check, see DECISIONS). Sizes: 12 px labels, 14–15 px body, 26 px page title, 26–30 px key figures.
- Spacing: 4 px base; card padding 14–16 px; gaps 12–20 px. Radius 8 px on cards, 2 px on heatmap cells. Borders 1 px.
- Motion: nothing lasts more than 150 ms (a page rising 6 px while it fades in, gauges filling, a change of period moving the bars), plus the slow shimmer of a loading placeholder; all of it is removed under `prefers-reduced-motion` (placeholders stay, still).
- Loading: placeholders shaped like the page, at the real heights, never a line of text; the previous page of the same scope stays, dimmed, while its next version loads; data is prefetched on hover, focus and touch.

## Patterns
- Navigation: rail with four entries, current one outlined in the accent; bottom bar below 600 px. Server selector and period selector always visible.
- Density: tables and heatmap first; cards only for grouping. No card inside a card.
- States: loading (skeleton rows), empty ("Pas encore de données pour cette période"), error (what happened and how to retry), content.
- Accessibility: 44 px touch targets, visible focus, full keyboard use, colour never the only signal (values are also in text and tooltips), `prefers-reduced-motion` respected.

- Day strips and day page (2026-11-18): same single accent hue as the heat map (cell darkness = people present), one line per day from 06:00 to 06:00, bars 22 px with the channel name inside (text on accent), a hairline at each time mark, a table version for screen readers and keyboards, a zoom on the active hours. Avatars are 24 to 44 px circles, neutral initials as fallback; they never replace the name.

- Member list (2026-11-18): the name on the first line and the `@username` (and the "toi" marker) on the second, small and muted. On wide screens the sessions cell shows only the number (the column header says what it is); on phones the word stays, with the time on the right and the 24-bar hourly profile across the full row (2 px gaps, rounded tops).
- Hourly profiles show all 24 hours from 06:00 (so a regular evening schedule is one block, not split at midnight), and an empty hour keeps a thin mark in the line colour: a baseline instead of a blank. Each bar is coloured on a continuous scale of the accent (a quarter of the colour at least), darker as the hour weighs more in that member's own profile, so colour and height say the same thing. Cropping to the group's active hours was tried on 2026-11-18 and dropped at the owner's request (empty hours must stay visible). The heat map and the member page also show the whole day.
- Header (2026-11-18): top bar = context (server with its picture on the left, the logged-in person with name and @username, "Déconnexion" and the theme on the right); title row = page title and, only where it applies, the period selector. On phones the server takes the first row, then the person and the buttons; the @username is dropped under 480 px and the name ends with an ellipsis rather than overflowing. The heat map's cells are always square (stretching its rows to fill a tall card made them rectangles, 2026-11-19); a tall neighbour is balanced by stacking a second card beside it (heat map over records on the home page) instead.
- No explanatory captions under or over charts (owner's call, 2026-11-18): headings, axes and tooltips explain; definitions of terms live in tooltips; every chart keeps an accessible text label. Lists of gauges use a fixed value column (and fixed sub-columns for "own % / group %") so gauges and figures line up from row to row; below 1024 px the gauge goes under its label.
- Weeks and months (2026-11-18): the real timeline for a week (bars at their hour, seven days end to end, a hairline at each change of day); for a month a calendar where a cell is only tinted (at most 22 % accent, so its text keeps its contrast) and filled at the bottom like a gauge, never solid colour behind text. On a phone a week keeps its full width (an hour is about 2 px): it shows the pattern, the tooltip and the table give the detail; calendar cells show a short duration ("10 h").
- A year (2026-11-18) opens on a contribution-style grid (53 weeks, 18 px cells on a wide screen; 11 px cells and sideways scrolling on a phone, with the weekday labels staying at the left) and offers twelve small month calendars behind a Grille / Mois switch. The month calendars are readable on a phone without sideways scrolling (two columns, cells of about 19 px), and each month title leads to its page. Cells are plain tinted squares with a tooltip (no 365 tab stops); the titles are the links.
- Time bars (2026-11-19): the day and week timelines are SVG, bars in real pixels: at least 2 px wide (1 px only when cut back to clear a neighbour), corner radius 3 px and at most half the width, a 1 px separator before the next bar, the channel name inside only from 40 px (tooltip and table carry it otherwise). Colours come from CSS classes, never SVG attributes, so themes and the accent apply live.
- Day layers (2026-11-20, replaces the 2026-11-19 colours): four toggle chips (44 px, two per line on a phone) above the day timeline, each with the group's total; a checked chip takes the accent for its border and tint, and its small square is a swatch of the layer (solid accent for voice, solid tone for screen sharing, the same diagonal or bar hatch as on the bar for microphone and headphones). Layers are drawn over the voice bar (24 px) and are cut to it in pure layout code (`clipToBars`): same corner radius, no stroke, never past the bar's ends or across the separator at a change of channel. Screen sharing takes the top half, microphone off (diagonal hatch) the bottom half, headphones off (vertical bars) over it in the same half (deafened includes microphone off). The channel name is hidden while a layer is shown. Colours are tones of the chosen accent, precomputed per accent and theme in `accents.ts` (`layers`: share, hatch base, microphone stripes, headphone bars; CSS variables `--layer-*`): light tints in the light theme, deep tones in the dark one, locked by `accents.test.ts` (share 3:1 and hatch base 4.5:1 against the accent, headphone bars 4.5:1 against their base). The microphone stripes are soft (about 2:1): the pattern carries the meaning, colour is never the only signal.
- Tooltips: one shared `TooltipLayer` shows any `data-tip` text at once (the browser's `title` waits about half a second), follows the pointer, flips near the edges and also appears on keyboard focus and touch. It is a hint only: the same facts exist as text or in the table view.

## Spacing rules (owner's standing request, 2026-11-18)
Generous by default; audit every UI change critically instead of waiting for remarks. Scale in `web/src/styles.css`: `--space-1..6` = 4, 8, 12, 16, 24, 32 px.
- Page: 24 px top and between blocks, 32 px at the sides (16 px on phones).
- Card: 22 px inside (18 px on phones), 16 px between its title and its content.
- List rows (`rows`, `bars`, `compare`): 12 px above and below, a hairline between rows; members 14 px (16 px on phones). When a gauge sits under its label, 10 px between them.
- Key figures 16 x 20 px. Gauges 10 px high. Day cells 24 px, timeline tracks 32 px, 10 px between timeline rows.
- A large picture next to a title: about a third of its size as gap, and room above it (it has no line height to give air).
- Alignment: one value-column width per list, so gauges and figures line up from row to row; no `auto` columns in a repeated row. Names break between words, never letter by letter; a figure never breaks across lines.
- Check before reporting: browser measurements and screenshots at 390, 768, 1024 and 1280 px, with long names and @usernames, and the neighbours of every changed element.

## Aesthetic risk and guard-rail
Risk: the sober table look may feel cold for a friends' recap. Guard-rail: keep the accent small and consistent, and reserve any expressive treatment for the optional yearly recap view.

## Change log
- 2026-11-17: initial direction chosen (rail and table), light and dark.
- Settings menu (2026-11-19): a panel under a "Réglages" button; one row per setting, choices as 44 px segmented buttons, the accent as a row of 8 swatches (radio group). The accent has a light and a dark variant per hue, both at least 4.8:1 (light) and 7:1 (dark) against the surfaces and for the text on it, locked by a test. Density scales the spacing tokens (`--density`, 0.75 when compact); reduced animations is a kill switch on `data-motion`.
