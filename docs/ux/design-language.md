# Baby Log design language (5 October 2026)

One set of rules for every screen, so spacing, corners and text look the same everywhere.
The values live at the top of `src/styles.css` as named tokens. A browser test (`tests/browser/layout.test.mjs`) measures every page, so the spacing cannot drift again.
Please use the same values in Claude Design.

## Space

One scale, in steps of 4 px: **4, 8, 12, 16, 24, 32**.

Each step has one job:

| Space | Token | Used for |
|---|---|---|
| 16 px | `--gap-page` | Between blocks on a page (cards, button rows, sections). |
| 12 px | `--gap-group` | Between items in a group: tiles in a grid, cards in a list, buttons stacked together. |
| 8 px | `--gap-text` | Between a heading and its content, and between lines of text inside a card. |
| 4 px | `--gap-tight` | Inside a label and value pair ("Awake since" above "1:40 pm"). |
| 16 px | `--pad-card` | Inside every card. |
| 20 px | `--page-x` | Left and right edge of the page. |

Rules:
- A block never sets its own outer margin. The page, a group or a card sets the space between its children.
- A heading and its list are one group (8 px apart). The group is 16 px from the next block.
- On a full screen, the main buttons sit at the bottom.

## Corners

| Corner | Token | Used for |
|---|---|---|
| 20 px | `--radius-lg` | Every card. |
| 16 px | `--radius-md` | Big buttons (Save, Delete, Sync), rows that act like buttons, switches. |
| 12 px | `--radius-sm` | Text fields, chips, small buttons. |
| round | `--radius-pill` | Round icon buttons, the Add pill, tags, the message pill. |

## Text

| Size | Token | Used for |
|---|---|---|
| 28 px | `--text-2xl` | Tab titles and the baby's name. |
| 22 px | `--text-xl` | Titles of full screens. |
| 18 px | `--text-lg` | Section and card titles. |
| 17 px | `--text-body` | Body text and fields. |
| 16 px | `--text-md` | Rows and buttons. |
| 14 px | `--text-sm` | Labels and second lines. |
| 12 px | `--text-xs` | Small notes. |

Titles use Bricolage Grotesque. Everything else uses Atkinson Hyperlegible.

## Colours

Each kind of entry has one colour, used the same way everywhere:
- Feeds and links: blue `#2f5da8` (soft `#e3ecf8`).
- Nappies: orange-brown `#8e3f0e` on `#fbe9dc`.
- Sleep: purple `#5a4b9c`, dark `#2b2550` (soft `#ece8f7`).
- Growth: green `#2e7a57` (soft `#e0f1e8`).
- Delete and warnings: `#9a3f0b`.
- Text: ink `#1e2227`, second `#3c4248`, muted `#5b6168`. Page `#f6f3ee`, cards white, lines `#e4ded5`.

## Fields

Every field with a label above it looks the same: the label in 14 px bold, then a box 48 px tall with 12 px corners. Dates and times are bold.

## Tap size

Anything a finger taps is at least 44 px tall (`--tap`).
