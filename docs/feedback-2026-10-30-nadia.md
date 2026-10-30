# Feedback: Nadia (30 Oct 2026, release 57)
**Before I started:** I was told to break it, so I did. I tested the production build of version 0.57.0, not the dev server, in a headless Edge, wiping storage before each run. I set the clock, sizes and text settings by script, and fed files in through the app's own file inputs. Where a tap mattered, I repeated it with real input events at finger speed. No Safari, Firefox or real phone was involved, and I wasn't able to judge TalkBack.

I'm Nadia, 41, a test lead in Sheffield. I've no loyalty to anything in this. I started with a realistic garden: a border, two beds and a chilli pot, holding tomato, chilli, blackcurrant, apple, strawberry, raspberry, garlic, leek, parsnip, rosemary, chives, carrot and lettuce at various stages. I then ran 12 attack scripts. I took 21 screenshots, saved in `scratchpad/testers/nadia/`.

## Scores
| Measure | Score | Why, in a line |
| --- | --- | --- |
| Usability (1–10) | 5 | At ordinary sizes it's sound. In landscape, or on a small phone with large text, the plan and some main buttons go. |
| Would I keep using it? (1–10, plus Yes / Probably / Probably not / No) | 4, Probably not | It misses the most obvious job of the year: strawberries in July. |
| Trust in the advice (1–10) | 3 | It says to pick tomatoes on 31 January, and all 521 plants are unverified. |
| Recommend to a friend (1–10) | 3 | Not to anyone paying, until the two worst flaws are gone. |

**Would I pay?** No. Two things stop me: a garden can be frozen by its own restore, and the app doesn't say when fruit is ready. I'd look again once the eight flaws listed at the end are closed.

## Flaw count
| Severity | Count |
| --- | --- |
| Data loss, or the risk of it | 5 |
| Wrong advice or a false claim | 7 |
| Blocks a task | 4 |
| Annoying | 8 |
| Cosmetic | 5 |
| **Total** | **29** |

## Data loss
**1. A restored backup can freeze the app for good.**
- Steps: take a backup. Edit one planting to `"count": 1000000000`, or move a planting's `x` and `y` to 10,000,000. Settings → Restore from a backup… → Replace.
- What happened: the file passes every check and reads as ready to open, then the page stops responding on Today. Every new tab that opens on Today freezes too, because the file has been saved. Restoring the same file from the first screen's "I have a backup" froze as well.
- The only way out I found: typing `#/settings`, `#/help` or `#/plants` opens those screens. I didn't test whether another restore from there clears it. An app installed on a phone has no address bar, so that person looks to be locked out.
- What should happen: the file is refused, or the garden opens anyway.
- Note: this needs a damaged or hand-edited file. I found no way to reach it in the app: Add a plant stops at 500.

**2. Two tabs silently overwrite each other.**
- Steps: open the garden in two tabs. Add "From tab A" in one, then "From tab B" in the other.
- What happened: storage ended up with From tab B only. Tab A went on showing its own bed, with no warning, and that bed isn't saved. I then added a second bed in tab A, and it hadn't reached storage after over a second, though background-tab timers may explain that.
- What should happen: a warning, or a merge.

**3. Replacing a garden has no way back.**
- Steps: Settings → Restore from a backup… → Replace.
- What happened: the screen says "Replacing can't be undone", and that's true. Choose an old file by mistake and the newer garden has gone, with no recovery. Deleting a garden, the less likely mistake, keeps it for 30 days.

**4. "Validated" files let plenty of rubbish in.** All of these restored without complaint:
- `sownOn: "banana"`, and `removedOn: "2026-13-45"`;
- two plantings with one id, and two beds with one id;
- a planting in a bed that doesn't exist;
- a plant that doesn't exist;
- a bed with no outline at all;
- `lastFrost: "02-31"`;
- sown dates in the year 0001 and 2099;
- an empty garden name, and a 5,000-character one.

None crashed the screens I checked, but they're now in the user's saved garden. What they do to later jobs, I didn't trace.

**5. Gardens with the same name can't be told apart, and one can hide.**
- Steps: Settings → Restore from a backup…, choose a backup of the garden already open, Add as a new garden.
- What happened: the app reports the garden as added, but Your gardens still shows one row until you reload, though two are stored. After a reload there are two rows called "My garden", with nothing to tell them apart.
- With a different name, the list updates straight away.

## Wrong advice and false claims
**6. Established fruit never gets "Ready to pick" in its own season.** This is the worst advice flaw I found.
- Steps: strawberry, raspberry and blackcurrant marked Growing, planted in earlier years. Set the date to 15 July 2027.
- What happened: Ready to pick lists only chilli and tomato. On 15 June, "Coming up in July" had promised blackcurrant, raspberry and strawberry. On 15 July, Coming up promises the raspberry again. The job is always next month's.
- The strawberry's own sheet on 15 July reads "Harvest Jun–Jul" and "In flower from about 1 May", a date already past. It's still "Growing" (`20-Strawberry.png`).

**7. The lists change near the end of a month.**
- On 15 January: Ready to pick leek, Ready to lift parsnip.
- On 30 January: the Month page lists only pruning.
- On 31 January: "Ready to pick: Tomato. Pick as the fruits colour", and chilli. On 30 January, neither of those.
- The same on 28 February, 30 June, 31 October and 31 December: tomato and chilli appear. Leek and parsnip are on Today on the 15th of January, February and October, and gone on 31 December, 28 February and 31 October.

**8. A crop that isn't cleared lives for ever.**
- A tomato planted in 2026 and left at Harvesting gets a feeding job and "Ready to pick" in July 2027, "Clear and compost" in November 2027, and is still being fed in June 2030.
- On 15 July 2027 its sheet says "Finished by about 16 Jul", with no year, while still telling you to keep feeding it (`20-Tomato.png`).
- A tomato can't outlive the first frost, and across those years of dates nothing asked whether this one had gone.

**9. Blackcurrants flower in June, or in 2028.**
- On 15 and 30 June: "Probably flowering by now."
- On 15 July 2027 its sheet says "In flower from about 1 Jun 2028" (`20-Blackcurrant.png`).
- The RHS says they flower in spring. The plant has no flowering months in its data, so the app takes the month before the harvest starts.

**10. None of the plant library has been checked.**
- 521 plants, 0 verified. Each plant's Source line reads like a note to the author: "Check against: RHS – sweet peas; seed packet".
- `#/check` tells anyone who opens it that "The starter plants are drafts".
- A paying customer isn't told this anywhere they'd normally look.

**11. Impossible frost dates are accepted.** Settings took a last frost of December and a first frost of January. The Shed then says "Last frost: 50:50 by about 28 Dec; play safe until about 11 Jan. First frost about 29 Jan", and jobs carry on from there, with no warning.

**12. "Last copy today" can be false.** A copy dated later than the device's clock counts as today. I saw it with the clock set to 2019 and a copy from 2026.

## Blocks a task
**13. The plan disappears on a landscape phone.** At 844 × 390, the plan is 486 × 122 px at standard text, and **0 px tall** at Extra large. There's nothing to tap or see. At 740 × 360 it's 382 × 92 px (`30-landscape-XL.png`, `35-plan-landscape.png`, `36-plan-landscape-standard.png`).

**14. On a small phone the plan barely fits.** At 320 × 568 with Extra large text, it's 212 px tall. The toolbar takes 128, the tray 123 and the bottom menu 105 (`31-plan-320-xl.png`, `34-plan-320-xl.png`).

**15. Main buttons run off small screens at Extra large.**
- Shed, Sow seeds: reaches 389 px on a 320 px screen. On a 360 px screen in the Heritage look, the Shed reaches 385 px (`30-320-XL.png`, `30-360-XL-heritage.png`).
- Garden: the action buttons reach 332 px at 320, and the page 339 px in High contrast (`30-320-XL-contrast.png`).
- Today in High contrast at 320: 329 px.
- Plants at 320: Settings reaches 322 px.
- A 412 px screen, Ruth's, is clean on every screen I tried (`40-shed-412-xl.png`).

**16. 200% browser zoom overflows.** At the 195 px that leaves of a 390 px window, Today reaches 243 px, Plants 241 px and Garden 263 px (`30-200-zoom-of-390.png`).

## Annoying
**17. The new safety line fails contrast.** Measured against WCAG's 4.5:1, it's under in 8 of the 12 look and mode pairs: Modern 2.25 and 2.54, Heritage 2.61 and 3.55, Minimal light 2.87, Cottage dark 2.79, Allotment 3.03 and 4.42. It's the line meant to reassure people.

**18. A pot in centimetres can come out in metres.** The Across box says cm. Typing 1.9 makes a pot 1.9 m across, with no question. Typing 0.1 makes one 10 cm across.

**19. Names have no limit.** A 600-character name with no spaces stretches the Garden page to 11,837 px wide.

**20. Frost dates change without a word.** Typing 99 gives 31, typing 0 or −5 gives 1, and 31 February gives 28.

**21. Search gives odd answers.** `(`, `[`, `*` and an emoji all return every plant, as if nothing had been typed. "tomatoes" finds 6, and "tomatoe" finds none.

**22. The plant total moves.** The count reads "604 of 604" while searching, and "150 of 251" with only spaces typed.

**23. Settings overflows in landscape.** The look cards reach 871 px on an 844 px screen, or 947 px at Extra large.

**24. A partly cleared browser looks like a new user.** With storage cleared while the app was open, then a reload, the garden had been saved again but the preferences had gone, so the first-run welcome appeared with a garden behind it. I didn't test what "Get started" then does to that garden.

## Cosmetic
**25.** The greyed Find button is 2.36 to 4.25:1. Disabled controls are exempt, but it's unreadable, and it's next to a box people are about to use.

**26.** `#/check` opens for anyone who types it, with the plant editor off.

**27.** An address that doesn't exist, such as `#/nonsense`, `#/SETTINGS` or `#/%00`, stays in the bar and shows a screen with no message. `#/help/no-such-topic` shows Help's start.

**28.** The dialog for adding a pot is called "Add a bed", and default names read "Planter or window box 3".

**29.** A name pasted across two lines loses the break: "a" and "b" become "ab".

## What held up
I attacked these and failed to break them.
- **Refused properly:** cut-off files, empty files, `null`, `[]`, `{}`, a newer schema, a bad latitude, bad plant data and non-numeric coordinates.
- **Script injection:** `<img onerror>` and `<script>` in garden and bed names didn't run.
- **Restore:** a backup with a byte-order mark and an original v0 file both opened, and an exact round trip came back unchanged. None of the rubbish files in flaw 4 crashed anything.
- **Full storage:** Today and Settings both said "Not saved", though the toast still read "No room added" with an Undo, which is a small mismatch.
- **Closing mid-change:** a change made just before closing was kept.
- **Undo:** Undo lasted past 25 seconds, and had gone by 32. A delete followed by Undo survived a reload.
- **Time:** 20 dates, including 29 February, year ends, both clock changes, 2030 and 2019, gave no crashes and no "NaN", "undefined" or "Invalid Date" on nine screens.
- **Privacy:** with weather off, nothing left the device. A postcode search sent the full postcode to postcodes.io, and weather sent a location rounded to two decimal places, both as disclosed. No other hosts were contacted.
- **Offline:** the app loaded, and search said it couldn't search just now.
- **Double tap:** at finger speed, Add it adds one bed. My first result, three beds, came from synthetic clicks in one go, so I've withdrawn it.
- **Setup:** every space, Skip, and going back to change your mind all worked. The garden name stuck.
- **Screens:** 412 and 1024 px at Extra large, 2560 px wide, and 320 px at standard text were clean.
- **Safety line:** Cottage light, Minimal dark and both High contrast modes pass.
- **Spreadsheet:** the download had 14 rows and a header, and the right name.
- **Tray count:** it stays between 1 and 200.
- **Back button:** it retraces your steps.

## What I didn't get to
- Real phones, Safari, Firefox and TalkBack.
- The printed page on paper.
- Backups with photos.
- Drawing, dragging and reshaping on the plan, plan editing at extremes, and 3D.
- 200 beds, and 500 plants in one bed: performance at size is untested.
- A weather or postcode service that sends rubbish.
- Notifications, and whether the reminder comes on the day chosen.
- What the rubbish in flaw 4 does to later jobs.
- A line-by-line check of plant facts: I only spot-checked.
- Deleting a garden end to end (I saw step 1 of 3), and Start again.
- Copy dates across a real switch between gardens: my tap didn't switch.
- An app left open overnight, as opposed to opened on a later date.
- How many, cleared or set to 0, −1, 1.5, 25 or 999: the dialog stayed open with no message from the app. A browser's own bubble may show, but a headless browser can't tell me.

## What I'd want fixed before anyone pays
In order: 1, 6, 7, 8, 2, 3, 13, 10.
