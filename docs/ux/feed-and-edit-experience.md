# Feed, edit and messages: how it works now, and what to design next

For Claude Design. Written 2026-10-03, after the owner and partner tried the TEST app.
The words are simple on purpose. The screens in `features/*/artifacts/` are the first designs. This page is what changed since.

## The rule behind everything
**Logging and editing must look and work the same.**
A parent uses this at night, with one hand. If editing is a different form from logging, it feels wrong and slow.

## The screens today

### Today
- Three big buttons: **Feed** (blue), **Wee**, **Poo**.
- The list "Today" shows nappies and feeds, newest first. "Today" means 6 am to 6 am.
- Every row is tappable ("Tap a row to edit").
- A short message appears after a save: "Wee saved", "Feed saved". It goes away after 3.5 seconds.

### Feed screen (logging a new feed)
- Top: a **Breast | Bottle** switch.
- A small line under the switch with the last feed of that kind ("Last bottle: 90 ml · 11:50 am").
- **Breast:** a big total timer, then **two compact rows**, **Left** and **Right**, then a card with **Note**, and **Stop and save**.
- **Enter time manually** (a text button under the rows, only when no timer is running): swaps the timer for the same minutes controls and **Started at** that the edit form uses, so a feed that was not timed can be logged afterwards. The button then says **Use the timer instead**. Save needs at least 1 minute.
  - Each row shows that side's time and one button: **Start** (nothing is running), **Pause** (this side is running) or **Switch** (the other side is running). The running row is highlighted.
  - The timer keeps running if the app is closed.
- **Bottle:** a bottle drawing (drag it up and down), an amount (type, or −10 / +10), **Formula | Expressed**, a card with **Fed at** and **Note**, and **Save**.

### Editing a feed
- Tap a feed row on Today. The **same Feed screen** opens with the saved values.
- The same **Breast | Bottle** switch is there. A parent can switch the kind to fix a wrong feed.
- **Breast:** the same two rows, but each row has its own minutes: **−**, a number that can be typed, **min**, **+**. The total is shown at the top as text. **Started at** is in the card. Nobody chooses Left, Right or Both: it is worked out from the minutes.
- **Bottle:** exactly the bottle controls used for logging.
- At the bottom: **Save changes** and **Delete this entry**.
- **Delete asks for a second tap** ("Tap again to delete"), because there is no Undo.

### Editing a nappy
- A small screen: the time, **Save changes**, **Delete this entry**.
- A "Wee + Poo" row is two entries. A time change moves both. Delete removes both.

## Rules the screens follow
- A time can never be in the future (5 minutes ahead is allowed, because the time picker works in 5-minute steps).
- Editing keeps an entry inside its own "Today" (6 am to 6 am).
- Buttons are at least 44 px tall. They must fit on a 320 px wide phone.
- Messages must never cover a button. On a full screen they appear at the top.
- The note is one value. It is shared between Breast and Bottle, so switching kind never loses it.

## What the owner found, and what we did
| # | Found when testing | What we did |
|---|---|---|
| 1 | Editing was a different form from logging, with different controls. | Editing now opens the Feed screen itself, with the same switch and controls. |
| 2 | The word **Expressed** ran outside its button on a small phone. | The bottle is a little smaller on narrow phones. The buttons have room. A test checks 320, 360 and 390 px wide. |
| 3 | A stray line under **Fed at** when editing. | A line now shows only between two visible rows. **Fed at** and **Note** are in the card for both logging and editing, for both kinds. |
| 4 | The **Undo** button covered other buttons. | **Undo is removed for now.** Messages no longer have buttons. Delete asks for a second tap instead. |
| 5 | In breast edit you could select both Left and Right "somehow, sometimes". | Gone. The Left and Right rows each have their own minutes (feature 012). |
| 6 | The round Left / Right buttons use too much space. | Replaced by two compact rows, about 64 px tall each. The whole breast form now fits on one screen with the Save button. |

## Decided: the breast controls (feature 012)
The owner approved the proposal. Two compact rows, one per side, the same for logging and editing.

```
Logging (the timer is running on Right)        Editing (minutes are typed)

  Total  20:00                                   Total  20 min

  +------------------------------------+        +------------------------------------+
  | Left    08:00            [ Switch ] |        | Left        [ - ]   8 min   [ + ]  |
  +------------------------------------+        +------------------------------------+
  | Right   12:00            [ Pause  ] |        | Right       [ - ]  12 min   [ + ]  |
  +------------------------------------+        +------------------------------------+
```

- The total is the two minutes added together.
- A feed saved before this change has only a total. When it is edited, the minutes are split by a guess (all on its side, or half each for "Both"), and a note says so. Nothing is written until the parent changes a number.
- The designer can still change the look. Other options that were considered: one row of two half-width buttons with a single total (smaller, but no minutes per side), or smaller round buttons with the minutes under each.

## Data note for the designer
A feed is saved as: kind (`Breast` or `Bottle`), the time, a note; for breast the side (`Left`, `Right` or `Both`), the minutes of each side and the total; for bottle the amount (0 to 240 ml) and the milk (`Formula` or `Breast milk`).

## Not decided yet
- Whether Undo comes back, and if so, how it looks without covering anything.
- Whether Delete should also ask in words ("Delete this feed?") instead of the second tap.
- A dark look for night use (the first designs are light only).
