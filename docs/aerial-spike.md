# Spike: the garden from an aerial photo

**Question:** can the app draw a garden's beds, lawn, paths and buildings from an overhead photo, so a new garden starts from what's really there?

**Answer: no-go for drawing it automatically.** Neither approach that works without a server found the beds, which is what the plan needs most. What they did find came out as rough blobs that would take longer to fix than to drop in from the dock. **A small go** for what the spike turned up on the way: straightening a photo taken at an angle, so it can be traced over (see the end).

Done 7 Oct 2026. Nothing ships from the spike itself.

## The photos
Five openly licensed photos from Wikimedia Commons, standing in for the 3–5 real photos the plan asked for. They are a mix of the photos people actually have:

| Photo | What it is | Licence |
| --- | --- | --- |
| Back garden aerial view (peganum, Small Dole, England) | A long back garden from an upstairs window: borders, a stepping-stone path on grass, a shed, a greenhouse, a patio | CC BY-SA 2.0 |
| Back garden aerial view (1) (peganum) | The same garden's patio from above: paving, trays of seedlings, a raised bed, a border | CC BY-SA 2.0 |
| Summer Hill Allotments, Knebworth Road (Alexis Markwick) | A drone photo along a strip of allotments between back gardens | CC BY 4.0 |
| Moulton allotments, aerial 2023 (Chris, geograph.org.uk) | Allotments from a light aircraft, at an angle | CC BY-SA 2.0 |
| Talin siirtolapuutarha (Harria) | A Helsinki allotment-garden site from a drone | CC BY-SA 4.0 |

The photos and the overlays made from them stay out of the repo.

**The first finding came before any code ran: none of them is straight down.** Photos from an upstairs window, a tilted drone or a plane are all at an angle, so the far end of the garden is squeezed. Each approach was tried on the photo as it is and straightened from four corners picked by eye. Satellite and map tiles would be straight down, but the terms of the big providers mostly forbid tracing or deriving data from them (to check again if this is ever revisited).

## What was tried
**A. Colour and texture, in plain code (no download).** Each 6 px cell is sorted by its colour and how busy it is into plants, lawn, paving, soil or blue (glass, trays), smoothed, split into regions, and each region's edge traced and thinned to corners. About 0.1 to 0.3 s a photo.

**B. An image model in the browser.** SegFormer, trained on ADE20K (scenes of everyday places, 150 kinds of thing), run with transformers.js, the library a browser would use. Its labels were mapped to the plan's kinds: tree and plant to plants; grass to lawn; path, floor and sidewalk to paving; earth to soil; house, building, wall and fence to buildings; water to water. Two sizes:
- b0 (15 MB download): 4 to 23 s a photo on a laptop's processor.
- b2 (110 MB): 6 to 25 s.

A vision model on a server (send the photo, get outlines back) wasn't tried: servers are off the table until beta testing.

## What came out
| Photo | A: colour | B: model, straightened | B: model, as taken |
| --- | --- | --- | --- |
| Back garden | One green region for the whole garden. Only the greenhouse roof and patio came out | Nearly all "plant" | The best result: the shed, the fence, the grass along the path and the patio found as rough blobs. The greenhouse was half found and the borders were one region |
| Its patio | The paving path well (60 corners for what is two rectangles and an arc); trays partly; the border and raised bed merged | Paving read as "wall" and "stairs" | Much the same |
| Summer Hill | Patches of green and soil that follow no plot | b0: 97% "earth". b2: 66% "fence" | Buildings and lawns round the edge found; the plots themselves not |
| Moulton | Lawn and plant patches; no plots | b0: 90% "wall" | Mostly "ceiling" and "tree" |
| Tali | Two green regions | 92% "tree" | The huts found as buildings, roughly |

Across the five photos, about a quarter of the main things (shed, greenhouse, patio, lawn, path, fence) came out recognisably, and **not one bed did**. A planted bed beside a planted border is the same colours and the same texture, and the model was never taught what a bed looks like from above. Every region found was a blob of 15 to 160 corners where the plan wants a rectangle of 4. So each needs redrawing, and it still needs scaling against a known length, as tracing does now.

Dropping a raised bed, a lawn and a shed from the dock takes about three taps each and is already to scale. Fixing a blob takes more than that.

## Why not, and what would change it
- **Beds are the point, and nothing here finds them.** Finding them would need a model trained on gardens seen from above. No such model is openly available, as far as I found, and training one is a project of its own.
- **Photos at an angle** need straightening first, which means asking the person for four corners anyway.
- **Size and speed:** the b0 model works but adds a 15 MB download and several seconds on a laptop, more on a phone, for a poor result.
- **Worth a look if revisited after beta:** a vision model on a server that returns rectangles with labels ("raised bed, about 1.2 × 2.4 m"), checked on the same five photos. Also openly licensed height data (the Environment Agency's LIDAR for England) for the height of neighbours' trees and houses, which matters more for the sun views than outlines do.

## The small go: straighten a photo before tracing
Tracing over a photo (Stage 2e) assumes it's straight down, but the photos people have are from an upstairs window. Adding a step to the trace tool would fix that: tap the four corners of something rectangular (the garden, the patio, a bed), give its width and depth, and the photo is straightened and scaled in one go. The spike's straightening code (bilinear sampling from four corners) is about 30 lines and fast enough on a phone. This goes on the wishlist (S).
