# WHO Child Growth Standards: the data for feature 010 (research, 5 October 2026)

This note is for the session that builds `features/010-track-growth-against-who`.
It says where the WHO numbers come from, how to use them, and what is still open.
Nothing here is real baby data.

## What could and could not be checked

- This cloud environment blocks `who.int`, `cdn.who.int` and `cdc.gov`. So no file was downloaded from WHO's own website.
- The numbers were taken from **WHO's own GitHub repository**, `WorldHealthOrganization/anthro` (the R version of WHO Anthro). Its DESCRIPTION names the World Health Organization as the copyright holder, with the licence GPL-3.
  - `data-raw/growthstandards/weianthro.txt` (weight-for-age)
  - `data-raw/growthstandards/lenanthro.txt` (length/height-for-age)
  - `data-raw/growthstandards/hcanthro.txt` (head circumference-for-age)
  - Tab-separated: `sex age l m s` (the length file adds `loh`). `sex` 1 = boy, 2 = girl. `age` in days, 0 to 1826.
- They were checked against copies of WHO's "expanded tables" (xlsx, by day) kept in the rOpenSci `gigs` repository. L, M and S are the same for every day 0–1826, for all three measures and both sexes. Every percentile and z-score column in the xlsx files can be rebuilt from L, M and S (to 0.001).
- All 112 numbers in the design prototype (`artifacts/Growth.dc.html`, weeks 0–3) match these tables, rounded to 1 decimal.
- WHO's web pages for the tables (for example https://www.who.int/tools/child-growth-standards/standards/weight-for-age) were seen only in search results, not opened.

Example, girls weight-for-age at birth (day 0): L 0.3809, M 3.2322, S 0.14171. That gives the 3rd percentile 2.44 kg, the median 3.232 kg and the 97th percentile 4.166 kg.

## How the numbers are used

- **Age** is in whole days: the measurement date minus the date of birth. A week is 7 days. A WHO month is 30.4375 days (WHO Anthro rounds the age to whole days before it looks up the table).
- **Length** (lying down) is used from day 0 to day 730. From day 731 the table is height (standing). The app covers 0–2 years, so it uses length.
- **Value at a z-score:** `M * (1 + L*S*z)^(1/L)`.
- **z-score of a measurement y:** `((y/M)^L - 1) / (S*L)`.
- **Percentile:** the normal distribution of z, times 100. The percentile lines in the design are z = −1.881 (3rd), −1.036 (15th), 0 (50th), +1.036 (85th), +1.881 (97th).
- **Weight beyond ±3 SD** uses WHO's "restricted" rule (only for weight): above +3, `z = 3 + (y − SD3)/(SD3 − SD2)`; below −3, `z = −3 + (y − SD3neg)/(SD2neg − SD3neg)`. Source: WHO Anthro `R/z-score-helper.R`, and the WHO technical report (chapter 7).

## What to store

- Only L, M and S per day, for days 0–730, for weight, length and head circumference, girls and boys. About 80–100 KB as JSON (about 25 KB compressed).
- Percentile and weekly or monthly tables are not needed: they come from L, M and S.
- Keep the source file next to the data, with the credit: "Source: WHO Child Growth Standards, © World Health Organization", and the URL.

## Open: the licence (the owner decides)

- WHO publications use the licence CC BY-NC-SA 3.0 IGO (free for non-commercial use, with credit, and changes shared under the same licence). This was seen only in search results for WHO's copyright page; it was not opened.
- WHO's own repository publishes the same numbers under GPL-3.
- This repository has no licence file yet.
- A free, non-commercial family app can most likely include the numbers with the credit above. The owner should confirm this before the data is added.
