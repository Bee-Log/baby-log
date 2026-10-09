# Baby Log: design update for Claude Design (4 October 2026)

This note shows how the app looks and works **now**. Some screens changed from the first designs, and a few screens are new.
Please use it to bring the designs up to date.

- The first designs are the artboards in `features/*/artifacts/*.dc.html` ("1 · Today (home)", "3 · Daily summary", "5 · Baby profile", "6 · Sleep", and the Feed screen).
- The screenshots are in the `screenshots/` folder of this pack. They are from the TEST app on a 390 px wide phone, with made-up sample data (babies called "Bean" and "Pip"). They are not real data.
- The older note `docs/ux/feed-and-edit-experience.md` has more detail on the Feed screen.
- The pack is `docs/ux/claude-design-update-2026-10-04.zip` (this note as README.md, and the screenshots). To make the screenshots again: `NODE_PATH=/opt/node-tools/node_modules node scripts/ux-screenshots.mjs <folder>`.

## The rules behind the changes

**Design language (5 October):** every screen now uses one spacing scale, one card shape and a small set of text sizes. See `docs/ux/design-language.md` (in the pack as `design-language.md`). Please use the same values in the designs.

1. **Logging and editing look and work the same.** Editing an entry opens the same screen that made it, with the saved values.
2. **Delete needs two taps.** The first tap turns the button red: "Tap again to delete". After 4 seconds it goes back. There is no Undo.
3. **Messages never cover a button.** A message is a small, see-through dark pill ("Wee saved"). It shows for 2.5 seconds, and taps go through it. On Today it sits above the tabs. On a full screen it appears at the top. (Changed on 5 October: before, it was a wide dark bar.)
4. **Buttons are at least 44 px tall**, and every screen fits a 320 px wide phone without sideways scrolling.
5. **A time can never be in the future.** Up to 5 minutes ahead is allowed, because the time pickers work in 5-minute steps.
6. **"Today" is 6 am to 6 am.**
7. The **TEST** app has an orange banner at the top. The real app does not.

---

## 1. Today

Screenshots: `01-today.png`, `16-today-asleep.png`, `19-today-footer-sync-status.png`, `20-today-320px.png`.
First design: artboard "1 · Today (home)".

**Same as the design**
- The header with the photo spot, the date and age ("Sat 3 Oct · 3 weeks old"), and the nickname.
- The **Last feed** card ("2h 15m ago", then the time and details).
- The sleep card. When awake it is white, with "Awake since" and **Start sleep**. When asleep it is dark, with "Asleep since" and a gold **Wake up**.
- The three big buttons: **Feed**, **Wee**, **Poo**.
- The **Today** list, newest first.

**Changed or added**
- **Tapping the header opens the Babies screen** (section 10), not the profile. A small down arrow after the name shows that it switches.
- **Poo icon:** a little poo shape, not a circle with a line. The owner asked for this.
- **Sleeps in the list:** a finished sleep shows at the time the baby woke: "Woke up · slept 1h 40m". A sleep that is still running shows "Fell asleep · asleep now".
- **Every row opens its edit screen,** including sleeps.
- **A small line at the bottom of Today** shows the sync status ("Sign in to sync" or "Synced · 5:17 pm"), "Ready to work offline" and the version. It is not in the design.
- **Not built:** the "Share with partner" button in the header. Both phones now use one shared Google account (see section 8), so there is nobody to invite.

**For you to decide**
- Where "Sign in to sync" should live. A parent needs it about once an hour, and today it is a small link at the very bottom. A slim bar under the header may work better.
- What the "Share with partner" button should do now, or whether to remove it.

## 2. Feed (logging a feed)

Screenshots: `02-feed-breast-timer.png`, `03-feed-breast-manual.png`, `04-feed-bottle.png`.
First design: the Feed screen.

**Changed or added**
- **Left and Right are two compact rows,** not two big round buttons. Each row shows that side's time and one button: **Start**, **Pause** or **Switch**. The running row is highlighted. The whole form fits on one screen with the Save button.
- **A line under the switch** shows the last feed of that kind ("Last breast feed: Both · 3:02 pm").
- **Enter time manually** (new). This text button sits under the rows when no timer is running. It swaps the timer for minutes per side (**−**, a number, **+**) and **Started at**. The button then says **Use the timer instead**.
- **Bottle:** as designed. The bottle drawing is a little smaller on narrow phones, so **Expressed** fits in its button.
- **Note** is in a card on both Breast and Bottle, with **Started at** or **Fed at**.

## 3. Edit a feed, edit a nappy

Screenshots: `05-edit-feed-breast.png`, `06-edit-feed-delete-armed.png`, `07-edit-nappy.png`.
These screens were not in the first designs.

- **Edit feed** is the Feed screen itself: the same Breast | Bottle switch and the same controls. Breast shows minutes per side and the total. At the bottom are **Save changes** and **Delete this entry** (two taps).
- **Edit nappy** is a small screen: the date and time, **Save changes** and **Delete this entry**. A "Wee + Poo" row is two entries. Changing the date or time moves both, and Delete removes both. (The date was added on 2026-10-09; before that it was the time only.)
- **Add a nappy at another time** (new 2026-10-09, not in the first designs): a link under the Wee and Poo buttons, **Wee or Poo at another time**, opens a small screen with the date and time (starting at now), a choice of Wee, Poo or both, and **Save nappy**. The two buttons still log "now" with one tap.

## 4. Sleep page and "Add a past sleep"

Screenshots: `08-sleep-page.png`, `09-sleep-add-overlap.png`, `10-sleep-add-last-evening.png`, `21-sleep-page-320px.png`.
First design: artboard "6 · Sleep".

**Same as the design**
- The live sleep card at the top.
- The step buttons (+5m, +10m, +20m, +1h, a minus button for the last step, and a reset arrow).
- The 12-hour clock ring, with the tinted face and the two dots.
- The **Logged sleeps** list.

**Changed or added**
- **Parts of the day are two circles, AM and PM** (the owner asked for this). They replace the four square buttons.
  - The halves sit like on a clock face: 12 to 6 on the right, 6 to 12 on the left (owner decision, 5 October).
  - AM: **Morning 6a–12p** | **Dawn 12a–6a**.
  - PM: **Night 6p–12a** | **Afternoon 12p–6p**.
  - Each half shows its icon, its hours and **Today** or **Yesterday**. Unpicked halves have the tint of their part on the clock face. A picked half is dark.
  - The rule is the same as before: pick one part, or two neighbours.
- **Which day.** Each part means the last time it happened, so it is always within the last 24 hours. At 2 pm, "Night" is last night, and it says "Yesterday".
- **Dragging:** only the two dots and the arc can be dragged. A finger anywhere else on the clock scrolls the page. Before this, scrolling changed the sleep by accident.
- **Dragging stays within the last 24 hours.** A sleep can be dragged across the 12 and 6 lines. The parts follow it.
- **Date and time fields** replace the time-only fields. Any older sleep is added by typing its date.
- **Problems are shown, and Add is turned off.** The arc turns orange with a message: "Overlaps a sleep already logged." or "That time has not happened yet." (`09-sleep-add-overlap.png`).
- **After Add,** a green "Added." appears. The same length is offered in the next free space.
- **Logged sleeps rows open Edit sleep** (section 5).
- On a 320 px phone, the step-button text gets smaller so the buttons do not overlap.

- **Very short sleeps are not kept** (owner decision, 5 October). Tapping Wake up less than a minute after Start sleep removes the sleep and says "Sleep discarded: shorter than 1 minute."

## 5. Edit sleep (new screen)

Screenshots: `11-edit-sleep.png`, `12-edit-sleep-delete-armed.png`.
This screen is not in the first designs. The owner asked for a way to delete a sleep, with **Delete easy to find at the top**.

- The top bar has a close button on the left, "Edit sleep" in the middle, and a **trash button** on the right. The first tap makes it a red "Tap again to delete" button.
- **Fell asleep** and **Woke up** are date-and-time fields, with **Save changes** at the bottom.
- A sleep that is still running shows only **Fell asleep**, with the line "This sleep is still going. It ends when you tap Wake up."
- The messages are the same as on the add card, plus "Woke up must be after fell asleep." and "A sleep can be 12 hours at most."

**For you to design:** the look of this screen, and whether the trash button at the top should also come to Edit feed and Edit nappy (they have Delete at the bottom).

## 6. Daily summary

Screenshot: `13-summary.png`. First design: artboard "3 · Daily summary".

**Built as designed:** day arrows, the four totals, and "Feeds · last 7 days" with the chosen day highlighted.

**How the numbers work (the design left these open)**
- **Avg. gap:** the average time from the start of one feed to the start of the next. It needs 2 feeds, or it shows "—".
- **Sleep that crosses 6 am** is split between the two days, so the days add up.
- **Nappies** counts nappy changes. A wee and a poo within 2 minutes is one nappy. So "Nappies 2" can show "Wee 2 · Poo 1".

**Not built:** the "Shared with [Partner]" row.

## 7. Baby profile

Screenshot: `14-profile.png`. First design: artboard "5 · Baby profile".

**Built as designed.** One change: **Save profile** stays grey until the nickname, the date of birth and the gender are all filled in. The photo is cut to a square and made small.

Since section 10 (more than one baby), the profile opens from **Edit** on the Babies screen. For a new baby it is empty, and the title says **Add a baby** (`24-add-a-baby.png`). The back button returns to the Babies screen.

## 8. Sync and data (new screen)

Screenshots: `17-sync-sign-in.png`, `18-sync-synced.png`, `19-today-footer-sync-status.png`.
This screen is not in the first designs. It opens from the sync line at the bottom of Today.

- **How sync works for a parent:**
  - Both phones sign in with **one shared Google account**.
  - After one tap on **Sign in with Google**, the phone sends and receives entries by itself. It does this after each change, when the app comes back to the front, and every 3 minutes.
  - Google asks to sign in again **about once an hour**. Google's window only opens when someone taps **Sign in**. It never opens by itself.
- **Sign out on this phone** (added 2026-10-09): a button on the status card, shown only while the phone is signed in. It signs out this phone only. The entries stay, and the other phone stays signed in. The next sign-in shows Google's account list, so a parent can choose another account. The card also says when the sign-in ends ("This phone stays signed in until 6:17 pm").
- **The status card** shows one of: "Sync is not set up yet", "Sign in to sync", "Syncing…", "Synced", "Waiting for network", "Could not sync". After a failure, a small "Details:" line shows the reason.
- **Your data:** **Download CSV (spreadsheet)** and **Download JSONL (all entries)**.

**For you to design:** this screen, and a friendly way to ask for the sign-in about once an hour (see section 1).

## 9. Growth

Screenshots: `15-growth.png`, `15b-add-measurement.png`. First design: the Growth artboard.

**Built as designed** (5 October), with the official WHO numbers for every day from birth to 2 years.

**Changed or added**
- **The chart grows with the baby.** It starts at birth and ends a little after the baby's age today: at least 4 weeks, at most 2 years. The labels are weeks ("Wk 1") up to 13 weeks, then months ("2 mo").
- **"+250 g in 7 days"** compares the newest measurement with the one before it, and says how many days apart they are.
- **The percentile label** is worked out with WHO's own formula, then rounded to 5 ("About 75th percentile"). Outside the lines it says "Below 3rd percentile" or "Above 97th percentile".
- **Add measurement** (new, the design only had the button): a date, the weight in kg and the length in cm. One of the two is enough. Rows in History open the same form to edit or delete (two taps), like the other edit screens.
- A small credit line at the bottom: "Growth data: WHO Child Growth Standards, © World Health Organization."

**For you to design:** the Add measurement form.

## 10. Babies (new screens)

Screenshots: `22-babies-switch.png`, `23-welcome-new-phone.png`, `24-add-a-baby.png`, `25-welcome-entries-from-before.png`.
These screens are not in the first designs. The owner asked for them: every entry belongs to one baby, it is easy to switch, and one baby opens by itself.

- **Babies screen** (`22`). It opens from the header on Today. Each baby is a row: photo, name, age, and an **Edit** button. A tick marks the baby on screen. Tap a row to switch. **Add a baby** is at the bottom.
- **Welcome** (`23`). A phone without a baby always opens here, and nothing can be logged yet. It offers **Sign in with Google** (to load the baby from the other phone) and **Add a baby**. After signing in:
  - one baby found → Today opens with that baby;
  - two or more → "Which baby?" and the list;
  - none → "No baby was found in the Google account. Add your baby to start."
- **Entries without a baby** (`25`, changed 5 October). Entries logged before babies had their own entries are not shown under any baby. Today shows a small yellow notice, "6 older entries have no baby. Review". The Babies screen has a card with **Add them to [baby]** and **Delete them**.
- Each baby has its own entries, sleep card and breast timer. Twins can sleep or feed at the same time.

**For you to design:** the Babies screen and the welcome screen, and how the header shows that it switches babies.

---

## Questions for design, in one list

1. ~~The AM and PM circle halves: time order, or clock order?~~ Decided: clock order.
2. A home for "Sign in to sync" on Today, since a parent needs it about once an hour.
3. "Share with partner": what should it do now, or should it go?
4. A design for **Edit sleep**, and whether Delete should move to the top bar on all edit screens.
5. A design for **Sync and data**.
6. ~~Ignore sleeps shorter than 1 minute?~~ Decided: yes, with a "discarded" message.
7. Older open questions: whether Undo comes back, and a dark look for night use.
8. A design for the **Babies** and **welcome** screens, and the switch sign in the Today header.
