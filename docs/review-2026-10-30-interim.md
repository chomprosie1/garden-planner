# Interim review: 30 Oct 2026, release 57a
The six testers ran against 0.57.1, the same build as the live site, after Nadia's run on 0.57.0. This pulls their reports together so fixes can be planned. Their full lists are in `docs/feedback-2026-10-30-<name>.md`.

**Read this first:** the panel are personas played against the running app, in a browser. Their scores compare rounds and find problems. They aren't evidence of what customers would do. No real phone, real TalkBack or printed page was involved.

## Two things are wrong on the live site now
Neither has been fixed: the testers needed one fixed build to work from.

**1. On a phone, the page collapses whenever an Undo message shows.**
- **What happens:** on any screen up to 700 px wide, the page shrinks to a strip 86 px wide at Standard text, and to nothing at Extra large, for up to 30 seconds after adding or deleting something. Pressing ✕ brings it back. iPad width and the plan view are fine.
- **Cause:** a stylesheet ordering mistake. The phone rule puts `.toast` in column 1, and a later general rule puts it back in column 2, so the page gains a second column.
- **Since:** release 53, today.
- **Why we missed it:** tests don't cover layout, and the browser checks read the page's text, which is still there when nothing can be seen. Only a screenshot shows it. Ruth's was the first run to look.

**2. Crops added as already Harvesting are told to go on the compost heap.**
- **What happens:** Margaret's parsnips, sown in April and added as Harvesting, get "Clear and compost: Its season's over. Pull it up" on Today from October to March. Ticking it takes them off the plan.
- **Cause:** release 57a, my change. With no date for reaching Harvesting, the timeline now counts from the sowing date.
- **Reach:** any annual crop added as already Harvesting with an earlier date.
- **Why we missed it:** the 57a tests and browser checks used plantings with a Harvesting date, or stopped at Growing.

## Scores
| Tester | Usability | Keep using | Trust | Recommend | Would pay? |
| --- | --- | --- | --- | --- | --- |
| Priya | 7 → 8 | 7 → 8 | 5 → 7 | 6 → 7 | Maybe, £15 a year |
| Margaret | 7 → 8 | 6 → 6 | 6 → 5 | 6 → 5 | Maybe, £15–20 once |
| Jordan | 7 → 8 | 6 → 8 | 7 → 8 | 7 → 8 | Maybe, £12–15 a year |
| Sam | 5 → 7 | 3 → 6 | 4 → 6 | 3 → 6 | No → Maybe, £10–15 a year |
| Ruth | 6 → 6 | 6 → 6 | 6 → 7 | 6 → 5 | Maybe, £10–15 once |
| Callum | 5 → 7 | 3 → 6 | 3 → 6 | 3 → 6 | No → Maybe, £10–15 once |
| **Average of the six** | **6.2 → 7.3** | **5.2 → 6.7** | **5.2 → 6.5** | **5.2 → 6.2** | |
| Nadia (0.57.0, for attack) | 5 | 4 | 3 | 3 | No |

Nobody says a plain no now, among the six, which is new. Priya's and Sam's scores don't allow for the collapsing page, which they'd each take a point off for. Ruth's and Margaret's drops come from the two live problems: Ruth would give 8 and Margaret 7 to recommend without them.

## What this round settled
- **Each tester's top complaint is fixed,** apart from Margaret's, which got worse (see above):
  - Priya: autumn timelines run forwards.
  - Jordan: lawn to beds works, from the question in setup to the job, the wording and the shopping list.
  - Sam: the balcony questions, watering per pot, and the kits.
  - Ruth: tap a job's name to tick it, Extra large and High contrast on the first screen, and 508 pieces of text in High contrast all over 4.5:1.
  - Callum: his own frost dates now move sowing and planting.
- **"Telling it what grew changed nothing" is reproduced.** Choosing from the drop-down does nothing. A button, "Add it to 2026", appears, and at 1366 × 768 it's below the screen. Pressing it works.
- **Backups:** each tester's file restored into a fresh browser, with the garden, its answers and its frost dates intact. It's still only judged in a browser.

## What to fix, in order
This is now planned as releases 57b to 57h: see Phase 2b in the [build plan](build-plan.md).

**Now (live, and small)**
1. The collapsing page.
2. The parsnips.

**Next: wrong or misleading, and seen by a tester**
3. Harvest dates in a short season: potatoes after the first frost, leeks planted a month early and first picked two months late, and garlic 4–5 weeks early (Callum).
4. "A row" makes 99 single plants in a bed with crops in (Priya).
5. Adding a bed with a name in use renames the existing one to "Bed 1 1" (Margaret).
6. Add a plant starts on Fill: one thyme became 21, and filled the bed (Ruth).
7. Switching to a plan: 11 of 12 beds and pots land outside the boundary, and checks go from 2 to 13 (Priya).
8. "What grew here" needs to act when chosen, and mixed beds should rotate by family (Callum).
9. The frost hollow's last frost is two weeks too late: 21 June against early June (Callum).
10. Watering ignores weather and season (Sam). This one's bigger than it looks.
11. Balcony leftovers: greenhouse lines in sow jobs, and fleece in November (Sam).
12. Swaps: daffodils for basil (Sam).

**Then: small untruths and tidying**
13. "Nothing sown yet" above sown trays; "It's full now" on an over-full pot; "80 litres (3 bags of 40)"; "Taken until about March… Free again from about September"; a 35 cm pot behaving differently from the 35 cm preset; the job count rising on a tick.
14. Pots missing from the shopping list, and no cost (Jordan).
15. Late leek months, blackcurrant flowers in June, and raspberries and broad beans early (Margaret).
16. Small controls and the main landmark (Ruth), and the print-out's repeated lines (Margaret).

**Still open from Nadia:** 22 of her 29 flaws, listed in her report. That includes overflow at Extra large on small phones, the safety line's contrast in other looks, bad data accepted by restore, and search. The plant library check is separate, and all 521 plants are still unverified.

## How we test from now on
The two live problems point to one change. Reading text proves a page has words, not that anyone can see them. Each release should take a screenshot of the main screens at a phone width, and with a message showing. A test for each way of adding a crop as already growing, at each stage, would have caught the parsnips.

Two tester sessions also had their results thrown out and redone because of faults in the test scripts, and those are noted in the reports only where they changed what was tested.

## What wasn't tested
Real phones, real TalkBack, Safari, Firefox, printing on paper, a phone's share sheet, drawing on the plan with a finger, and pinch or swipe. Jordan didn't redo the drawing, and Callum entered his garden as a list.
