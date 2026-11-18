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
- Motion: none by default; any transition at most 150 ms and removed under `prefers-reduced-motion`.

## Patterns
- Navigation: rail with four entries, current one outlined in the accent; bottom bar below 600 px. Server selector and period selector always visible.
- Density: tables and heatmap first; cards only for grouping. No card inside a card.
- States: loading (skeleton rows), empty ("Pas encore de données pour cette période"), error (what happened and how to retry), content.
- Accessibility: 44 px touch targets, visible focus, full keyboard use, colour never the only signal (values are also in text and tooltips), `prefers-reduced-motion` respected.

- Day strips and day page (2026-11-18): same single accent hue as the heat map (cell darkness = people present), one line per day from 06:00 to 06:00, bars 22 px with the channel name inside (text on accent), a hairline at each time mark, a table version for screen readers and keyboards, a zoom on the active hours. Avatars are 24 to 44 px circles, neutral initials as fallback; they never replace the name.

## Aesthetic risk and guard-rail
Risk: the sober table look may feel cold for a friends' recap. Guard-rail: keep the accent small and consistent, and reserve any expressive treatment for the optional yearly recap view.

## Change log
- 2026-11-17: initial direction chosen (rail and table), light and dark.
