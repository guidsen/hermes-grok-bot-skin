# Grok Bot reference spec

Measured from Grok Bot screenshots on 2026-09-14. The main capture is a 2x Retina
window, which the macOS traffic lights confirm at 24px for a 12pt control, so
every pixel value below is halved to CSS pixels.

## Palette, light

| Role | Value |
| --- | --- |
| Chat surface | `#FFFFFF` |
| Sidebar | `#F6F6F6`, hairline `#E5E5E5` divider |
| Text | `#1D1D1F` |
| Secondary text, previews, dates | `#86868B` |
| Assistant pill | `#F0F0F0` |
| User pill | `#000000`, white text |
| Composer | `#FFFFFF`, `#E3E3E3` border |
| Active row | text at 8% over the sidebar, about `#E6E6E6` |
| Busy dot | `#34C759` |
| Waiting dot / preview text | `#FF9500` / `#A15C00` |

Dark mode has not been captured. The skin's dark palette uses macOS system dark
colors in the same roles until it is.

## Type

San Francisco at 13px for message text, row titles, previews and dates.
Line pitch is about 17.5px in pills and 17px in sidebar rows.

## Sidebar rows (Bots rail)

| Property | Value |
| --- | --- |
| Row height | 46px, two lines |
| Padding | 6px vertical, 7px leading, 8px trailing |
| Avatar | 30px, 12px gap to text |
| Radius | 10px |
| Busy dot | 9px, 2px ring in the row color, near 80% x / 78% y of the avatar |
| Waiting | orange 8px dot at the row end replaces the date, preview turns amber |

## Transcript

| Property | Value |
| --- | --- |
| Gutter | full width, Hermes' own 1.5rem thread padding |
| Pill padding | 7px 11px |
| Pill radius | 18px, which reads as a stadium on one line |
| Pill max width | about 88% of the column |
| Gap between parts of one reply | 4px |
| Gap between speakers | about 14px |
| Image radius | 12px |
| Tool and question cards | same fill as pills; tool calls 0.7rem radius, question cards 16px |

## Message actions

Measured side by side with Hermes at the same capture scale.

| Property | Hermes | Grok Bot |
| --- | --- | --- |
| Icon | 14px, 50% opacity | 18px, gray at full strength |
| Hit target | bare glyph | 28px square, 8px radius |
| Hover | glyph darkens | soft gray fill |
| Order | fork, copy, read aloud, retry, react | react, reply, more |
| Time | duration at left | timestamp at far right |

## Composer

White, 37px tall single row, about 20px radius, hairline border. A 24px circular
`+` on the left and a 26px black circular send or mic button on the right.
