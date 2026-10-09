# Root and branch: an honest review of Garden Planner

9 Oct 2026, after release 22b and before release 23. The plan in section 5 is the build plan's fifth round.

## Context
You asked for a full run-through before the help topics are written: who it's for, whether it's marketable, how well it works, what's missing from building a garden, what's overkill, and whether to charge by subscription or once. The aim is a plan split into **Enhance, Add, Remove, Change**.

How I reviewed it:
- read the MVP plan, the build plan, the UX plan, the plan refresh, the wishlist and the mismatch log;
- walked through it as a new user at 390 px: onboarding (Leeds, a garden, four favourites, and the default "Just the space"), Today, the second launch, Garden, the plant drawer, Plants, a plant card and Seedlings;
- checked the code for the gaps below;
- checked competitors' prices on the web.

Nothing here is built yet. Each step of the fifth round waits for your go.

---

## 1. The honest verdict

**What's genuinely good:**
- **It's broad and it holds together.** One garden model drives the plan, the timeline, the jobs, Seedlings, the weather, 3D and the kitchen.
- **The plant card is excellent.** Tomato has light, soil, spacing, family, the months, varieties, feeding, storing, recipes, pests and neighbours, in a warm, plain voice. A paid app would be proud of it.
- **The life cycle sets it apart:** sow → up → harden off → plant out → pick → kitchen, with running-behind alerts and frost watch. GrowVeg plans *where*; this follows *what happens next*.
- **It's UK through and through.** Postcode search, UK frost dates, the RHS used as a source, and UK words.
- **It's private,** with no account, and works offline.

**What worries me:**
1. **It's grown fast.** There have been 23 releases in four days (6 to 9 Oct 2026), and about 32,000 lines of code.
   - **Corrected after the review (9 Oct 2026):** you've tested it as it was built, and two other people are using it, with good feedback. So the five-person test is dropped: their feedback and yours do that job.
   - Gate 3 (31 Mar 2027, "did it change a real decision?") is still to come, and the mismatch log is still the place for what goes wrong in real use.
2. **None of the 602 plant entries is checked.** Every one is `verified: false`, drafted from memory, but shown to users as fact. To sell it, that's the biggest trust and liability risk, more than any missing feature.
3. **Your garden lives only in one browser.**
   - On an iPhone, Safari can clear a site's data after about seven days without a visit unless it's on the home screen. Gardeners leave apps alone for weeks in winter.
   - Backups are a manual download.
   - One lost garden is one lost customer, and a one-star review.
4. **Breadth over depth.** Some features (3D walking, UV and sun cream, the quotes, Wrapped) are delightful but sit at the edges. Meanwhile core grow-your-own needs are thin: rotation and next year, climbers on fences, soil, a shopping list.
5. **The first session in October is thin.** After onboarding, This month had one job (sow sweet peas). The plant drawer opened on "Sow or plant now: 161", starting Abelia, Apple mint, Aquilegia. That's a long alphabetical list, with top-down drawings that all look alike to a beginner.

**My bottom line:** it's marketable, but not yet. The next round should be **depth and trust**: checked plants, safe gardens, a better first ten minutes, and the gaps in building a garden.

---

## 2. Who it's for: the pitch

**Recommended pitch:** *"The grow-your-own planner for UK gardens: plan it to scale, and it tells you what to do next, from seed to plate."*

**Primary audience:**
- UK home veg and fruit growers, and allotment holders, beginner to keen intermediate, roughly 25 to 55.
- Phone-first, but they plan on a laptop in winter.
- It suits people on allotment waiting lists growing in pots meanwhile; APSE's 2025 survey says 63% of councils report waits of over 18 months.

**Secondary audience:** people with flower borders and wildlife gardens. They get value from the plan, Inspire me and the pollinator work, but they aren't the reason to buy.

**Not the pitch:** a landscape or garden-design tool (patio layouts, furniture, lighting, planning permission). The build area is a growing layout, and should stay one, with the everyday objects real gardens have (see Add).

**Against the competition** (prices from the web, Oct 2026; check before relying on them):

| | GrowVeg | Planter | RHS Grow | This app |
| --- | --- | --- | --- | --- |
| To-scale plan | Yes, desktop-first | Square-foot grid | Questionnaire, no drawing | Yes, phone and desktop |
| Follows each plant's life | Reminders | Little | Care reminders | Yes, the strongest point |
| UK-specific | Yes | US-led | Yes, RHS | Yes |
| Account needed | Yes | Yes | Yes | No |
| Price | £25/yr recurring, £35 for a year | Free, $24.99/yr premium | Free, premium tier | — |

---

## 3. Subscription or one-off?

**Recommendation:** free to start, then an annual "Grower" subscription of about **£19.99 a year**, launched in late winter. Optionally, a one-off **founder's lifetime price (about £49)** for the first few hundred users, to fund the server work.

**Why not one-off alone:**
- The features that keep people are sync across devices, iPhone notifications, the weather and Ask the garden.
- All of them need a server and paid services:
  - Open-Meteo's free tier is non-commercial;
  - GitHub Pages isn't for selling software.
- Those are ongoing costs, so a one-off price becomes a liability as users pile up.

**Why annual, not monthly:**
- Gardening is seasonal. Monthly plans get cancelled in October.
- People buy in January to March, when they plan.

**Why under GrowVeg:**
- You're new, with no reviews.
- Undercutting £25 to £35 a year with a better phone experience is a clear story.

**Free** (enough to love it): one garden, the plan, the plant library, this month's jobs, Seedlings, the plant cards and backups.

**Grower** (what costs to run, or what keen growers want):
- sync and gardens on every device, with automatic backup;
- more than one garden;
- weather and frost alerts, with real push notifications on any phone;
- next year drafted, with rotation;
- 3D and walking;
- Wrapped and the timelapse;
- later, Ask the garden.

**Before charging anything:**
- data checked;
- sync built;
- moved off GitHub Pages;
- a commercial weather plan;
- terms, privacy and refunds;
- and gate 3 passed.

Until then, keep it free and gather users.

---

## 4. The plan

### A. Enhance: make what's there better
1. **Check the plant data:**
   - Start with the 150 most-grown plants (the onboarding favourites, the kits, the common veg and herbs), against the RHS and seed packets, in batches of 15, as the ways of working say.
   - Label the rest "draft" in the app.
   - This matters more than anything new.
2. **The first ten minutes, in any month:**
   - plants offered in the order a beginner wants: what's popular, easy, sowable now and suits this space first, not A to Z;
   - an "Easy to start" chip;
   - kits for each season, such as garlic, broad beans, onion sets and spring bulbs in the autumn, so October isn't empty.
3. **Recognisable plants in the pickers:** the side-on drawing, or a photo, beside the top-down mark. Top-down blobs work on the plan, not in a list.
4. **More plan, less chrome on a phone.** At 390 px the plan gets under half the screen, under the header, the toolbar, the year slider, the dock and the tab bar.
   - Fold the year slider into a chip while you're arranging.
   - Let the dock tuck away, as it already does for the sun views.
5. **Keeping your garden safe:**
   - ask the browser to keep the storage (`navigator.storage.persist`);
   - nudge iPhone users to put it on the home screen;
   - remind about backups monthly;
   - "Save to Files" where the device allows.
   This is cheap, and it should come before sync.
6. **Running behind and the jobs:** finish the open items (no harvest job for a sowing that never came up; check jobs by warmth), so the to-do list is never wrong.

### B. Add: what's genuinely missing
**Building the garden** (your question):
1. **A house, and the everyday things gardens have.**
   - Starter layouts have no house, so nothing casts its biggest shadow.
   - Add a House sticker, and put one in the Garden, Patio and Allotment-shed layouts.
   - Add a water butt, a gate, a bench or table, bins, a washing line and steps: things you plan round and that cast shade.
2. **Shapes, not just width × depth:** in onboarding and in Simple, pick a shape:
   - rectangle;
   - **L-shape with a side return** (your garden);
   - wide and shallow;
   - long and thin;
   - corner plot.
   Each comes with handles to adjust it. Today, anything but a rectangle needs Advanced.
3. **Climbers on fences and walls.** The library has clematis, honeysuckle, wisteria, a climbing rose, star jasmine and other climbers, and trained fruit, but a fence or wall can't hold a plant; they only go in a bed. Add "plant along this fence", with trellis, arch and obelisk stickers.
4. **Soil:** a type for the garden (clay, loam, sandy, chalky), with a change per bed, plus pH if known. Plants that hate it get flagged, as light already is.
5. **Shade from over the fence:** a clear way to add a neighbour's tree or house outside the boundary.
6. **Measuring:**
   - tap a length to type it (on the wishlist);
   - a tape-measure tool between two points;
   - straighten a photo before tracing (on the wishlist).

**Growing:**

7. **Next year, drafted, with crop rotation:**
   - Moved up from release 18. It's the core of veg and allotment planning, and GrowVeg's best feature.
   - It's what makes a second year worth paying for.
8. **A shopping list:** seeds, sets, compost and feed for what's planned, ticked off as you buy. It's the natural place for affiliate links later, if you want them.
9. **Watering:** a simple watering job for pots and new plantings in dry spells (the forecast already arrives), before the full water-butt forecast.

**The product:**

10. **Feedback in the app:** a short form or email, not a GitHub issue page most people can't use.
11. **Privacy-respecting counts** (Plausible-style, no cookies) of opens, first plant placed and day-7 return, so gates are measured, not guessed.
12. **Sync and accounts.** This is the big one, a business decision with a cost. It unlocks a household or allotment partner sharing a garden, iPhone push, and the paid tier.

### C. Remove or park: overkill for now
Nothing is deleted without your say. Most of these are **parked**: frozen, with no more work on them.

1. **The welcome screen's pause on every launch.**
   - A forced 1 to 5 second wait every time is wrong for a tool people open to check one thing.
   - Keep the screen at most once a day, with no forced wait, or only on the first launch of a new month.
2. **UV and sun cream reminders.** They're kind, but they're not about the garden, and they dilute the pitch. Remove them, or bury them in Settings.
3. **3D walking and the timelapse.** Freeze both. They're demo features, and walking alone is a 630 KB chunk. They're good for marketing videos and a paid perk, but no more work.
4. **Prices in pounds in Feeding and the kitchen.** They go stale and invite "that's wrong". Keep "worth about £4 a kilo" in Wrapped as fun, or drop pounds altogether.
5. **The 450 plants beyond the core 150 in the default lists:**
   - show them under "More plants (still being checked)" until they're verified;
   - stop adding plants or varieties until the checking catches up.
6. **Release 18's extras** (voice logging, the same-spot timelapse): park them. Keep pollinators and rotation; rotation moves to Add.

### D. Change: how it's built and how it's tested
1. **No focus-group test** (changed after the review, 9 Oct 2026). You test as it's built, and your two testers' feedback goes in the mismatch log alongside your own.
2. **Gates stay in view.**
   - New ideas from outside this review answer a problem someone hit, logged in the mismatch log.
   - Gate 3 stays 31 Mar 2027, with you using it for real this spring.
3. **Help after this round, not before.** Release 23's help topics describe the screens after the changes above, or they'd be rewritten.
4. **"Report a mistake"** changes to the in-app feedback form (B10). Only the plant editor keeps the GitHub link.
5. **Onboarding:**
   - a shape picker (B2);
   - a kit chosen by default rather than "Just the space";
   - after "Start growing", land on the plan with the first job highlighted, not on a long Today.
6. **Today for a new garden:** Getting started is long. Fold it to one line ("2 of 6 done ›") after the first day.
7. **Moving off GitHub Pages and onto commercial weather terms** only when charging is decided. It's noted here so it isn't a surprise.

---

## 5. The order (the fifth round), before release 23
Decided after the review (9 Oct 2026): build everything in **A and B** first, then **C and D**, then help.

| Release | What | Sections | Size |
| --- | --- | --- | --- |
| 24. Off to a good start | Plants in a beginner's order with an Easy chip; kits for every season; recognisable plants in the pickers; more plan on a phone; keeping the garden safe (storage kept, backup and home-screen nudges) | A2, A3, A4, A5 | ~1.5 wk |
| 25. Build the garden | A house and everyday things (water butt, gate, bench, table, bins, washing line, steps); garden shapes, including an L with a side return; tap a length to type it; a tape measure; straighten a photo before tracing | B1, B2, B6 | ~1.5 wk |
| 26. Along the fence | Climbers along fences and walls, with trellis, arch and obelisk; soil for the garden and each bed; shade from over the fence | B3, B4, B5 | ~1.5 wk |
| 27. Next year | Next year drafted, with crop rotation; a shopping list; watering in dry spells; the open job fixes | B7, B8, B9, A6 | ~2 wk |
| 28. Listening | A feedback form in the app; private counts of opens, first plant and return visits (a choice of service first) | B10, B11 | ~3 evenings |
| Data track | Check the core 150 plants against the RHS and seed packets, in batches of 15 that you confirm, alongside 24 to 28 | A1 | ~2 wk of evenings |
| 29. Trim and tidy | The welcome at most once a day with no forced pause; UV out of the way; prices that go stale; unchecked plants under "More plants"; onboarding's default kit and landing; a shorter Getting started; Report a mistake to the form | C1, C2, C4, C5, D4, D5, D6 | ~1 wk |
| 23. Help for the rest | Help for the screens as they now are | D3 | ~1 wk |
| Later | A business decision: sync and accounts, the paid tier, hosting and weather terms | B12, D7, section 3 | L |

Parked, with no work: 3D walking, the timelapse, voice logging, the same-spot timelapse, adding more plants (C3, C6).

---

## 6. Verification
- **The round, once built:**
  - your testing and your two testers' feedback, in the mismatch log;
  - private counts of first plant placed and return visits, once release 28 is in;
  - gate 3 on 31 Mar 2027.
- **Each step:** tests by risk, as `CLAUDE.md` says, and screenshots at 390 px of the changed screens, as usual.

Sources for the market figures:
- [GrowVeg subscription information](https://www.growveg.co.uk/subscribeinfo.aspx)
- [Leaftide: 10 garden planning apps tested, 2026](https://leaftide.com/learn/best-garden-planning-apps/)
- [EdenVatika: best garden planning apps 2026](https://edenvatika.com/blog/best-garden-planning-apps-2026/)
- [RHS Grow](https://www.rhs.org.uk/rhsgrow)
- [Gardenize subscriptions](https://gardenize.com/subscriptions/)
- [APSE State of the Market on Allotments 2025](https://democracy.reading.gov.uk/documents/s38731/8b%20Appendix%202%20-%20APSE%20State%20of%20the%20Market%20on%20Allotments%202025.pdf)
- [The Conversation: allotments are vanishing](https://theconversation.com/allotments-are-vanishing-when-the-uk-urgently-needs-more-of-them-262844)
