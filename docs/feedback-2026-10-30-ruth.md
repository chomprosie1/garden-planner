# Feedback: Ruth (30 Oct 2026, release 57a, interim round)
**Before I started:** The brief was clear. I tested 0.57.1 at 412 × 915 in a browser, with Extra large text and High contrast chosen on the first screen. This wasn't a real Android phone, and my system text size couldn't be tested. **TalkBack wasn't used.** Everything I say about it comes from what the page gives a screen reader (names, headings, announcements), so that score is an estimate, and the team's real check is still needed. Sizes below are measured. I used real tap events for ticking. Pinching, swipes and voice typing weren't tested.

I'm Ruth, 67, a retired teacher in Norwich (NR4 7AA), with rheumatoid arthritis in my hands and dry macular degeneration in my left eye. I set up three 1.8 × 0.9 m raised beds, marked as worked sitting down, and four pots by the back door, in a list. I put in garlic, 12 established strawberries, thyme, chives, rosemary, parsley and tulips. Screenshots are in `scratchpad/testers/ruth/`.

## Scores
| Measure | 29 Oct | Now | Why, in a line |
| --- | --- | --- | --- |
| Usability (1–10) | 6 | 6 | Everything's better, until the page goes blank each time I add something. |
| Would I keep using it? (1–10, plus Yes / Probably / Probably not / No) | 6, Probably | 6, Probably | It now has jobs for my strawberries. I can't live with the blank page. |
| Trust in the advice (1–10) | 6 | 7 | It knows I work sitting down, and my strawberries have a tidy job. |
| Could I see and read it? (1–10) | 6 | 6 | High contrast is excellent. A blank screen isn't. Without that bug I'd give it 9. |
| Could I use it with my hands? (1–10) | 5 | 8 | Tap a job's name and it's ticked. |
| Would it work with TalkBack? (1–10) | 5 | 6, estimated | Good names; the plan has a list now. Not tested with TalkBack. |

I'd recommend it to a friend: 5/10, because of the blank page. Fix that and it's an 8.

## Would I pay for it?
**Maybe.** £10 to £15 once, or about £10 a year, as before. Not until the blank page is fixed: I'd think the app had broken, and I'd ask my daughter, which is what I'm trying not to do.

## The worst thing: the page goes blank after I add anything
**Every time I add a plant or a bed in my list, the screen goes white, except the message at the bottom, for up to 30 seconds.** At Extra large the page shrinks to nothing. It's not my eyes: the page really has no width while the Undo message shows. It comes back if I press the ✕ on the message, or when the message goes.
- Steps: Extra large text, a list, Garden → Add a plant → Add. Go to Today while the message is showing.
- At Standard text the page isn't blank but squeezed into a strip 86 px wide, with the words one above another (`21-412-cottage-standard-toast.png`).
- At iPad width it's fine. On a phone-sized screen it happens in every look.

I'd have closed the app and thought I'd lost my garden. For someone with my sight, this is a blocker. I spent my evening thinking my eyes had got worse: please fix it first.

## What I most wanted to know
**Targets.** Much better. Ticks are 42 × 42 px, and the row around them takes a tap as well. Menu items are 61 px tall. A few smaller things are left: "Switch to a plan" 147 × 28, "All October jobs" 162 × 31, "Change" in the Shed 71 × 28, and the dotted words at about 28 px tall. Radio buttons and tick boxes in Settings are 34 × 34, but their labels take a tap too.

**Ticking a job.** A real tap on the job's name ticks it, and it folds into "Done (1)", where I can get it back. That's what I asked for. One catch: a job's words have dotted words in them, and my tap on the middle of the Weed the beds job landed on "mulch" and opened its meaning, rather than ticking it. That's a small target inside a big one. It didn't do any harm, but a stiff finger will find these.

**Extra large text.** 24 px for job text, 21 px for smaller text, and no sideways scrolling on Today, Garden, Shed, Plants or Settings. The tab labels are nearly 19 px. It's on the first screen.

**High contrast.** I measured every piece of text on Today, Garden, Shed, Plants and Settings against 4.5:1: 508 pieces, none under. It's the clearest thing I've seen in a garden app.

**The plan's list.** "List of beds and plants" is the next button after the plan, and the plan's own label says so. It lists each bed and its plants ("Garlic × 15, planned"). That answers my complaint that there was no list.

**Backing up and restoring.** Download a backup is a big button, 161 × 96 px. "I have a backup" on the first screen is 151 × 44. It restored straight away, and opened on Today. But choosing a file on a phone is the part I can't judge here, and it's what would worry me.

## What I like (keep it)
- **Text size and High contrast on the very first screen.**
- **"I work this bed sitting down, or at waist height: hand tools, not a hoe".** Exactly what I asked for.
- **Tidy: Strawberry in Raised bed 2.** "Keep the strongest runners to fill gaps or replace tired plants". My established strawberries have an autumn job.
- **"Over a year ago", "Two years ago", "Three years ago"** when saying when a plant went in.
- **"Another like this"** and **"How many?"** still save me work: Back door pot 1 to 4 in one go.
- **"Tap anything"** tips are short. The help no longer talks about swiping, on what I read.
- **Undo** stays for up to 30 seconds, which my hands need. It needs to stop blanking the page.

## What I don't like
1. **The blank page**, above.
2. **Adding a herb filled the bed.** I chose Thyme for an empty raised bed and pressed Add, and it made 21 thyme plants, because "Fill the bed" is what it starts on. Then chives and rosemary got "There's no room left". I wanted one. I'd want it to start on "One" for anything perennial, or ask.
3. **When it says there's no room, it's easy to get lost.** The message offers other beds, and I didn't notice the first time that nothing had been added.
4. **Dotted words inside a job row**, as above.
5. **No sound or message when I tick a job.** The job just vanishes into "Done". With TalkBack, I'd want to hear that it happened. I can't say whether it does.
6. **The tick at 42 px** is just under the 44 px we've been told is the target. I'm not complaining, but Sam or Priya would find it fine and I'd prefer more.

## Accessibility problems
| # | Where | Problem | What happened | Who else it would stop | Severity |
| --- | --- | --- | --- | --- | --- |
| 1 | Every list screen, on a phone | Sight | The page has no width while the Undo message is up (0 px at Extra large, 86 px at Standard, for up to 30 seconds). | Every phone user; worst for low vision and Extra large | Blocks me |
| 2 | Today, inside a job | Hands | Dotted words (28 px tall) sit inside a tappable row, and take the tap. | Tremor, arthritis | Annoying |
| 3 | Today, foot of jobs | Hands | "All October jobs" is 162 × 31 px. | Tremor, arthritis | Annoying |
| 4 | Garden | Hands | "Switch to a plan" is 147 × 28 px. | Tremor, arthritis | Annoying |
| 5 | Shed | Hands | "Change" is 71 × 28 px, "50:50 by" 78 × 30 px. | Tremor, arthritis | Annoying |
| 6 | Setup step 4 | Hands | "Make it bigger" tick box is 20 × 20 px, though its label can be tapped. | Tremor, arthritis | Annoying |
| 7 | Every page but the plan | Screen reader | There's no main landmark, so "jump to main" won't work. Headings are sound: October, Now, Plant, Tidy, Weeding, Planning ahead. | Screen-reader users | Annoying |
| 8 | Today | Screen reader | Not known whether ticking a job is announced: nothing visible says so. | Screen-reader users | Needs the real check |

Checked and fine: ticks are named ("Done: plant, Garlic in Raised bed 1"), no unnamed buttons turned up on Today, and the Undo message is a status announcement.

## Contradictions
- "There's no room left in Raised bed 3" after the app itself filled it with 21 thyme.
- 42 px ticks against a stated 44 px target.

## What's superfluous
- **Recipes and "In the kitchen"** on plant pages, still a long scroll at this text size.
- **"Inspire me"** on empty beds.
- **Show** beside every job in a list.

## What's missing
- **Read aloud** for a How to.
- **Saying what happened** when a job's ticked.
- **A larger size again** beyond Extra large would still be welcome for tired evenings.

## Bugs and rough edges
| # | What happened | Steps | Severity | Screenshot file |
| --- | --- | --- | --- | --- |
| 1 | Page collapses while the Undo message shows, on phone widths, in a list. Measured in 2 looks and 2 text sizes at 412 px, and at 390 px; fine at 820 px. | Any list garden → Add a plant → Add → look at the page, or go to Today. Pressing ✕ brings it back. | blocks a task | 05-today.png, 10-today-hc.png, 21-412-cottage-standard-toast.png |
| 2 | Add a plant starts on "Fill the bed" for a perennial herb in an empty bed: 21 thyme. | Empty 1.8 × 0.9 m bed → Add a plant → Thyme → Add. | annoying (wrong count) | none |
| 3 | A tap on a dotted word in a job row opens its meaning, not a tick. | Today → tap "mulch" in Weed the beds. | annoying | none |

No JavaScript errors were logged.

## Last time's complaints: fixed?
| What I said on 29 Oct | Fixed / partly / not fixed | Note |
| --- | --- | --- |
| Plan moved my plants | Not checked | I stayed in the list. |
| No jobs for established plants | Fixed | Strawberries have Tidy. |
| Tiny tick boxes; tap opened How to | Fixed | 42 px, and the row ticks. |
| "Done" ticks a job | Fixed | "I've done this". |
| Doesn't know I sit down | Fixed | A setting on each bed. |
| Text size hard to find | Fixed | First screen. |
| Feeds contradict each other | Not checked | |
| Tulips not "plant now" | Fixed | On Today in October. |
| Pale, thin details | Fixed in High contrast | |
| Undo vanishes | Fixed | Now up to 30 seconds, but see the blank page. |
| Plan is a dead end for TalkBack | Mostly fixed | There's a list. Not tested with TalkBack. |
| Help tells you to swipe | Fixed, as far as I read | |
| Frost fields both called "Day" | Fixed | "Last frost in spring: day". |
| Bottom menu read before the page | Fixed | The menu comes after the page in the code. |
| No high-contrast look | Fixed | |
| Strawberry, herbs "Ready to pick" in October | Fixed | |
| Planted over three years ago | Fixed | |
| Menu hides Delete | Not checked | |

## My top five changes
1. **Stop the page collapsing under the Undo message.** Nothing else matters as much.
2. **Start Add a plant on "One"** for shrubs and perennial herbs, or ask.
3. **Keep tick targets clear of dotted words.**
4. **Add a main landmark,** and announce a tick.
5. **Bring the last small links up to 44 px.**
