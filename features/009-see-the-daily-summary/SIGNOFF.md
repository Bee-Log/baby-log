---
id: 009
name: See the daily summary
slug: see-the-daily-summary
status: Done
updated: 2026-10-05
---

# 009 See the daily summary

## In one line

See daily totals and the last 7 days.

## What we decided

- The summary shows four totals, a 7-day feed chart and day arrows.

## How it should work

- See `artifacts/Summary.dc.html`.
- Day arrows move between days; the title shows the day (for example "Today · Thu 1 Oct · so far").
- Four totals: Feeds (breast and bottle, with ml), Nappies (wee and poo), Sleep (with the longest stretch), and average gap between feeds.
- "Feeds · last 7 days" shows one bar per day, today highlighted.

## Data it captures

none

## Not in this version

- The "Shared with [Partner]" row (needs partner sync).

## Open questions

- How is "average gap" calculated?
- How is sleep that crosses midnight counted?

## Artifacts

- `artifacts/Summary.dc.html` — Daily summary screen (artboard "3 · Daily summary"): day arrows, four totals, 7-day feed bars, partner sharing row, bottom navigation. For this feature: the whole screen except the sharing row. Design prototype from the "Simple Baby Log" canvas; it needs the canvas runtime (`support.js`) to run, so open it in the canvas or read it as a reference.

## Build notes
**Built (2026-10-03).** The **Summary** tab, as in `artifacts/Summary.dc.html`.
- **Day arrows** and a title: "Today", "Yesterday", or "Wed 30 Sep". Under it the date, with "· so far" for today. The next arrow is off on today. The previous arrow stops at the day of the oldest entry.
- **Four totals:** Feeds (with "Breast 2 · Bottle 2 (150 ml)"), Nappies ("Wee 2 · Poo 2"), Sleep (with the longest stretch), and Avg. gap.
- **Feeds · last 7 days:** one bar per day, oldest first, the chosen day highlighted. The busiest day fills the chart.
- A day is 6 am to 6 am, like Today.

**Open questions answered.**
- **Average gap:** the average time from the start of one feed to the start of the next, within the day. That is (last feed − first feed) ÷ (feeds − 1). It needs two feeds; with fewer it shows "—" and "Needs 2 feeds".
- **Sleep that crosses a day line:** only the minutes inside the day count. A sleep over 6 am is split between the two days, so the days add up. A sleep still running counts until now. The longest stretch is the longest piece inside the day.
- **Nappies:** a wee and a poo within 2 minutes are one nappy (the same rule as the Today list). So the count can be lower than Wee + Poo.

**Not built.** The "Shared with [Partner]" row (it needs the partner to be set up with sync; see feature 013).

**No data change.**

**Files changed.** `src/summary.js` (new: the numbers), `src/summary-ui.js` (new: the screen), `src/index.html`, `src/styles.css`, `src/app.js`, `src/sw.js`, `tests/summary.test.mjs` and `tests/browser/summary.test.mjs` (new).

**Test link.** https://oudam-meas.github.io/baby-log/test/ (open the Summary tab).

## Feedback
- 2026-10-05: Released to LIVE on the owner's instruction ("Yes live"), at commit b9e42f0.
