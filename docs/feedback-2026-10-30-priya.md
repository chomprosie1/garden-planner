# Feedback: Priya (30 Oct 2026, release 57a, interim round)
**Before I started:** The brief was clear. This is an interim check, played against the production build of 0.57.1 at 390 × 844, in a browser, not on a real phone. I picked "Patio or yard" and "Just a list", as last time, with the Autumn planting kit. I restored my garden from a file between sessions to save re-entering it, as anyone would with a backup. My backup and restore was between two browser sessions, so it says nothing about a real iPhone or Android phone. Where I say "not checked", I didn't get to it.

I'm Priya, 34, in Bristol (BS6 5AA): two raised beds (2.4 × 1.2 m) and a dozen pots. I resized the kit's bed, added a second, added eight pots, put in a bay, apple, rosemary and thyme as already in the ground, then broad beans, winter lettuce and corn salad. I ticked a sowing on Today, sowed another from the Shed, opened the timelines, read the shopping list and next year's draft, switched to a plan, backed up and restored, and looked at Today on 2 and 20 November. Screenshots are in `scratchpad/testers/priya/`.

**Added after Ruth's run:** Ruth found that on a phone, in a list, the page collapses to a strip 86 px wide for up to 30 seconds whenever an Undo message shows. My session read the page's text, so I didn't see it, but I was in that list at that size. My scores below don't allow for it. A real phone user would hit it on every add: I'd take a point off usability, and it's bug 1 for me too.

## Scores
| Measure | 29 Oct | Now | Why, in a line |
| --- | --- | --- | --- |
| Usability (1–10) | 7 | 8 | It opens straight on Today, done jobs fold away and the Shed links up. Switching to a plan is still a mess. |
| Would I keep using it? (1–10, plus Yes / Probably / Probably not / No) | 7, Probably | 8, Probably | Monday's list is now one I trust and can clear. |
| Trust in the advice (1–10) | 5 | 7 | The timelines finally run forwards. The frost date and apple dates still feel off. |
| Speed to get something useful (1–10) | 8 | 8 | Real October jobs within minutes. |
| Looks and feel (1–10) | 7 | 7 | Calm in the list. The plan is the same pots-in-a-line picture. |
| Compared with last time (better / same / worse) | | Better | My top complaint has gone. |

I'd recommend it to a friend: 7/10, up from 6. I'd say "great for jobs; stay in the list".

## Would I pay for it?
**Maybe, and closer than last time.** About £15 a year, or a one-off £20, not monthly. Before I paid:
- switching to a plan mustn't throw everything outside the garden;
- a backup needs to go somewhere off the phone without me thinking about it.

I'd cancel if I lost my garden, or if a wrong date caught me out twice in a month.

## Does the safety line settle my worry?
**Mostly.** "Saved only in this browser on this device. No copy yet. Keep a copy" says exactly what's true, and "Last copy today" replaces it afterwards. Download a backup gave me `my-patio-2026-10-30.json`, and a fresh browser opened it from "I have a backup": 14 features and 13 plantings, straight on Today, no setting up. I trust the file. What's still missing is a backup that happens by itself: the line tells me to act, and on the bus I won't. I can only judge this from a browser.

## Does Today keep in step, and does it nag less?
**Yes on both.**
- Ticking "Lettuce, winter" made the count 1 of 9, folded the job away and put a tray in the Shed under Sown for the plan.
- Sowing corn salad from the Shed offered "For Raised bed 1, where it's planned", and Today's job went and the bed changed to Sown.
- It opens on Today after a reload. The five-button welcome has gone.
- Thyme and parsley no longer turn up as Ready to pick. Pots are off the weeding job.
- "Around the garden" was only "Gather fallen leaves to make leaf mould", with no greenhouse or cold-frame jobs.

## What I like (keep it)
- **Winter lettuce sown 30 Oct:** Up about 7 Nov, Hardening off 5 Dec, Planted out 12 Dec, Growing 2 Jan, Ready from about 23 Jan. In order, and it all starts after sowing.
- **The apple How to is now right:** "Cup it in your hand, lift gently and give a slight twist… laid out so they don't touch, somewhere cool, dark and frost-free."
- **"Probably ready to pick now"** on the apple card, matching Today's Ready to pick. The contradiction I reported has gone.
- **The bay's timeline** is clean: Planted 1 Oct 2025, Growing, Harvesting, with no loop.
- **The How to's buttons** are "I've done this", "Show in the garden" and "Close". Nobody can tick by accident now.
- **The shopping list** splits Buy now from Buy by February, and my spinach is rightly under February.
- **Pot sizes** are in cm now. I typed 40 and got 40 cm.
- **"Things to check"** on the Garden page scrolls to the warnings.
- **Autumn planting** is now garlic and onions with tulips and daffodils in pots, so it no longer warns about itself.

## What I don't like
Worst first.
1. **Switching to a plan still throws everything outside the garden.** The garden stays 5 × 4 m, and eleven of my twelve beds and pots are outside it. Today's 2 things to check became 13, of which 11 are "is outside your garden's boundary". Settings promises "beds added in a list are set out neatly on the plan, ready to arrange". The pots do sit in a tidy line, but it's a line outside the garden, and Raised bed 1 ends up half off the patio (`30-plan.png`).
2. **"A row" of spinach made 99 separate plants.** In a bed with garlic and onions already in it, I asked for A row of spinach and got "99 spinach plants in Raised bed 1", as 99 single plantings. In an empty bed the same action gives a proper 20. It's still shown as one line, "Spinach × 99", and the shopping list wants seed for 99.
3. **The Shed says "Nothing sown yet" above my sown trays.** My bug 10, unchanged.
4. **Next year's draft contradicts itself about one bed.** "Raised bed 1: Taken until about March by garlic, onion, overwintering, corn salad and spinach… Free again from about September." The Add a plant dialog says the same bed is taken until about September. March is wrong for garlic.
5. **"It's full now" when it's over-full.** 24 tulips into a 35 cm pot with 34 grape hyacinths: the toast says "It's full now" and the card says "Over-full". And lasagne planting is still called too crowded, though that's how you plant a bulb pot.
6. **The compost sums don't add up.** "About 80 litres (3 bags of 40 litres)". That's 120 litres, or two bags.
7. **The first frost date.** Still "about 3 Nov". For inner Bristol I'd expect mid to late November. That's my knowledge against the app's estimate, so check it, but it's a date I don't believe.
8. **Apple dates.** Flowering about 23 Mar is early for Bristol, and "Harvesting about 28 Jul 2027" sits beside "Harvest Aug–Oct" on the same card.
9. **Pot on offers full pots.** The bay's Pot on offers "Apple pot, 45 cm" and "Pot 1, 50 cm", which both have plants in. "this bay pot is" is still lower-cased mid-sentence.
10. **Two cards I've dismissed in my head are still on Today:** Garden journal, and Put it on your home screen. The note "Harvest and winter jobs start once a planting has a sowing date" is still under All October jobs, and reads like instructions.

## Contradictions
- Raised bed 1: "Taken until about March" and "Free again from about September" in one paragraph; "until about September" in Add a plant.
- Bulb pot 3: "It's full now" against "Over-full".
- Things to check: 2 in the list, 13 on the plan, for the same garden.
- The Shed: "Nothing sown yet" above two sown trays.
- Apple: "Harvest Aug–Oct" against "Harvesting about 28 Jul 2027".
- Compost: 80 litres against 3 × 40.
- "Plenty of room" and "About half full" stayed on Raised bed 1 after 99 spinach went in.

## What's superfluous
- **Garden journal and Put it on your home screen** on Today, every visit.
- **"Your garden" card:** fine, but it repeats the Garden tab.
- **"Show Lettuce, winter"** beside every job in a list, where there's no plan to show it on.

## What's missing
- **A backup that happens by itself**, or a reminder that's a tap away.
- **Follow-on crops I can tap** in next year's draft.
- **Lasagne planting** in a pot.
- **Search for "salad"** still finds only 3 plants, and "dwarf apple" and "what to sow now" find none in Plants.

## Bugs and rough edges
| # | What happened | Steps | Severity | Screenshot file |
| --- | --- | --- | --- | --- |
| 1 | Switching to a plan leaves 11 of 12 beds and pots outside the 5 × 4 m boundary, and checks go from 2 to 13. | Set up a list as above, add a second bed and eight pots; Garden → Switch to a plan → A plan; Garden. | annoying | 30-plan.png, 31-plan-checks.png |
| 2 | "A row" creates 99 single plantings. | Raised bed 1 (2.4 × 1.2 m) with 2 garlic rows and 2 onion rows; Add a plant → Spinach → A row → Add. In an empty bed it gives 20. | data (wrong count) | none |
| 3 | "Nothing sown yet" above trays under Sown for the plan. | Tick a Sow under cover job, or sow for a bed from the Shed; Shed → Trays. | cosmetic | 21-shed.png, 28-shed-sown.png |
| 4 | Next year's draft: "Taken until about March… Free again from about September" for one bed. | Raised bed 1 as above; Today → Next year → Draft it. | wrong advice | 27-draft.png |
| 5 | "It's full now" toast on a pot the card calls Over-full. | 35 cm pot, Fill with grape hyacinth, then add 24 tulips. | annoying | none |
| 6 | "About 80 litres (3 bags of 40 litres)". | Today → Shopping list. | wrong advice (mild) | 26-shopping.png |
| 7 | Pot on offers pots with plants in. | Bay in a 40 cm pot, Timeline tab, Pot on. | cosmetic | 23-Bay.png |
| 8 | Apple: "Harvesting about 28 Jul 2027" against "Harvest Aug–Oct". | Apple, already in the ground, over a year ago, Growing; Timeline. | wrong advice (mild) | 23-Apple.png |

No JavaScript errors were logged.

## Last time's complaints: fixed?
| What I said on 29 Oct | Fixed / partly / not fixed | Note |
| --- | --- | --- |
| Autumn sowings get dates in the past | Fixed | Lettuce and corn salad run forwards from the sowing. |
| November "Ready to pick" for seed sown today | Fixed | Not on November's list. |
| The kit contradicts itself | Fixed | Garlic and onions together, no warning. |
| "Room" means three things | Partly | "No room left" didn't reappear, but "It's full now" against "Over-full" did. |
| Moving into a full pot ignores what's there | Not checked | I added to the pot rather than moving. |
| Switching to a plan makes a mess | Partly | Pots stay small and no longer get spacing checks, but everything's outside the garden. |
| "Block of tulip overlaps block of tulip" | Not checked | |
| One short row of broad beans | Fixed | A row is now 16 along the 2.4 m bed. |
| Apple soft-fruit How to | Fixed | |
| Apple "Ready to pick" against "Growing" | Fixed | The card now agrees. |
| Bay timeline loops | Fixed | |
| Pot nags on by default | Not fixed | Two pot warnings remain, though "I know, it's fine" clears them. |
| Bulb feed disagrees | Fixed | Bulbs have no bonemeal line on the list now. |
| Welcome-back screen | Fixed | |
| Mixed units | Fixed for pots | |
| Herbs as monthly Ready to pick | Fixed | |
| Generic jobs I can't do | Fixed | |
| Done jobs in prime space | Fixed | They fold away. |
| Getting started checklist | Fixed | Gone from my Today. |
| Shed: "Nothing sown yet" | Not fixed | |
| Shed: "(6 rows)" | Fixed | |
| Want to grow count | Fixed | Reads 0, as it should. |
| "A frost date I believe" | Not fixed | Still about 3 Nov. |
| Search | Not fixed | |
| Lengthen rows in a list | Not checked | |

## My top five changes
1. **Make switching to a plan fit the garden to the beds.** Grow the boundary to hold what's in the list, and set the pots on the paving.
2. **Fix "A row" in a part-filled bed:** one row, or a clear "no room for a row here".
3. **Fix the small untruths:** "Nothing sown yet", "It's full now", 80 litres in 3 bags, "Taken until about March".
4. **Let a pot of bulbs be layered** without calling it over-full.
5. **Check the first frost for inner cities**, and drop the Journal and Install cards from Today after the first few visits.
