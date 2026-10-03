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
- **Breast:** a big timer, two big round buttons **Left** and **Right**, a card with **Note**, and **Stop and save**.
  - Tap a side to start. Tap the same side to pause. Tap the other side to switch.
  - The timer keeps running if the app is closed.
- **Bottle:** a bottle drawing (drag it up and down), an amount (type, or −10 / +10), **Formula | Expressed**, a card with **Fed at** and **Note**, and **Save**.

### Editing a feed
- Tap a feed row on Today. The **same Feed screen** opens with the saved values.
- The same **Breast | Bottle** switch is there. A parent can switch the kind to fix a wrong feed.
- **Breast:** instead of the timer, the minutes are typed (−1 / +1). **Started at** is in the card.
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
| 5 | In breast edit you could select both Left and Right "somehow, sometimes". | Not fixed yet. See "Open design question" below. |
| 6 | The round Left / Right buttons use too much space. | Not fixed yet. See below. |

## Open design question: the breast controls
Today the breast form uses two **big round buttons**. The owner says they use too much space, and a round shape limits what a button can show. The owner also wants to **edit Left and Right separately**.

Today we save only the side (Left, Right or Both) and the total minutes. So we cannot yet show or edit the minutes for each side.

### Proposal (needs the owner's OK on two new optional data fields)
Two compact rows, one per side. The same two rows are used for logging and editing.

```
Logging (the timer is running on Right)        Editing (minutes are typed)

  Total  12:40                                   Total  15 min

  +------------------------------------+        +------------------------------------+
  | Left    08:32              [ Start ]|        | Left        [ - ]   8 min   [ + ]  |
  +------------------------------------+        +------------------------------------+
  | Right   04:08   (running)  [ Pause ]|       | Right       [ - ]   7 min   [ + ]  |
  +------------------------------------+        +------------------------------------+
```

- Each row is about 64 px tall, so both fit above the card without scrolling.
- Logging: tapping a row's button starts, pauses or switches, as today. The running row is highlighted.
- Editing: each row has its own minutes. A side with 0 minutes was not used.
- "Left", "Right" or "Both" is worked out from the minutes. Nobody chooses it, so the "select both sometimes" confusion goes away.
- The total is the two minutes added together.

### Other options the designer can choose
- **A.** The proposal above (two rows, each with its own minutes).
- **B.** A single row of two half-width buttons ("Left | Right") with one total. Smaller still, but no minutes per side.
- **C.** Keep round buttons, but smaller, and add the minutes per side under each.

## Data note for the designer
A feed is saved as: kind (`Breast` or `Bottle`), the time, a note, and for breast the side and the total minutes; for bottle the amount (0 to 240 ml) and the milk (`Formula` or `Breast milk`).
Minutes per side would be two new optional numbers. They need the owner's approval before they are saved.

## Not decided yet
- Whether Undo comes back, and if so, how it looks without covering anything.
- Whether Delete should also ask in words ("Delete this feed?") instead of the second tap.
- A dark look for night use (the first designs are light only).
