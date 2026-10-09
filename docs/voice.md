# The app's voice

How the garden planner talks: on Today, in jobs, in the stage advice, and in every message and button. It was written for release 12, and the screens are rewritten in this voice release by release.

## In a sentence

A friend who's been gardening for years, standing beside you with a mug of tea: warm, unhurried, specific, and never in a rush to fill the silence.

## What it sounds like

- **Gardening is a pleasure, not a chore.** "A few minutes with the tomatoes is one of summer's quiet jobs", not "Remember to pinch out side shoots".
- **Specific, not generic.** "Lettuce in the salad bed", "about 9 hours of sun in April", "the first frost is due on Thursday". The garden is theirs, so name it.
- **Short.** One idea per sentence, and a sentence where a paragraph was going to be. If a heading says it, the text under it doesn't say it again.
- **Calm about problems.** "The lettuce is taking its time: it may be the cold" rather than "Warning: lettuce is overdue".
- **British and seasonal.** Months, frosts, allotments, sheds, "pick", "sow", "plant out", "earth up".
- **Plain words.** No code words on screen (`tests/words.test.ts` keeps the list).

## Words to leave out

These read as filler, or as a machine trying to sound friendly. `tests/words.test.ts` checks for them:

- simply, just (as filler), easily, effortlessly, seamless, seamlessly;
- unlock, elevate, empower, supercharge, game-changer, delve, embark, journey, curated;
- "Let's", "Don't worry", "Great job", "Awesome", exclamation marks in running text;
- "Please note", "In order to", "utilise".

## Never

- Name, quote or imitate any real person: no famous gardeners, presenters or writers, in words or in manner.
- Scold. A missed job is "still to do", never "overdue!".
- Promise. Nature is in charge: "likely", "about", "usually".

## Shapes that work

| Where | Shape | Example |
| --- | --- | --- |
| A job | Verb first, then where | "Plant out the lettuce, in the salad bed" |
| A job's advice | One short line, the why | "Harden them off for a week first, so the wind doesn't shock them." |
| A heading | Two to four words | "This week", "In flower", "From the garden" |
| A moment | One warm line | "Your first tomatoes of the year. Enjoy them." |
| An empty state | What it is, then what to do | "Nothing planned for this week. A good time to weed and water." |
| A button | What happens | "Plant out", "Show on the plan", "Pick some" |
| A warning | What, when, what to do | "Frost likely early on Thursday. Fleece the dahlias tonight." |

## The loading screen's lines (`src/content/quotes.ts`)

Short, hopeful lines to read while the app loads: our own, never anyone's, and never attributed. They should sound like something a gardener said over the fence, not a poster.

- **Things, not ideas.** Frost on a cabbage, a ball of string, a robin on the fork handle, a barrow of compost. "Most of gardening is noticing" earns its place by being short; most lines need a thing in them.
- **A little dry humour is welcome.** "Pick courgettes small and often, or turn your back and find a marrow."
- **True.** The advice in a line is real advice, said plainly.
- **Not these shapes:** "It isn't X. It's Y." or "Not X, but Y"; three adjectives in a row; a question; an exclamation mark; paired dashes.
- **Not these words:** journey, magic, soul, nurture, embrace, tapestry, testament, whisper, dream, promise, miracle, cherish.
- **No names,** real or made up.

`tests/welcome.test.ts` checks the length, the shapes and the words. Whether a line sounds like a person wrote it is for a person to judge: read them aloud.
