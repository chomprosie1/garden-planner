// From plot to plate, on screen: "In the kitchen this week" on Today, how to
// store and use a crop (and its recipes) on its plant card, a hint after you
// log a pick, and what the year's harvest would have cost in the shops.

import { useEffect, useMemo, useState } from 'preact/hooks';
import { croppingNow, harvestWorth, KEEP_LABEL, minutesText, poundsText, recipesFor, recipesWith, type Kitchen, type Recipe } from '../kitchen/recipes';
import { todayIso } from '../model/ids';
import type { Garden, Plant } from '../model/types';
import { PlantIcon } from './PlantIcon';
import { useWeatherNow } from './useWeather';

let loaded: Kitchen | null = null;

/** The kitchen's data, loaded the first time it's needed. Null until then. */
export function useKitchen(): Kitchen | null {
  const [k, setK] = useState<Kitchen | null>(loaded);
  useEffect(() => {
    if (loaded) return;
    let live = true;
    import('../kitchen/data')
      .then((m) => {
        loaded = m.KITCHEN;
        if (live) setK(m.KITCHEN);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  return k;
}

/** A recipe, folded: its name, time and how many it serves; open it for what goes in and what to do. */
export function RecipeItem({ recipe, plantOf }: { recipe: Recipe; plantOf: (id: string) => Plant }) {
  const main = plantOf(recipe.crops[0]!);
  return (
    <details class="recipe">
      <summary>
        <PlantIcon plant={main} size={30} class="recipe-art" />
        <span class="recipe-name">
          <strong>{recipe.title}</strong>
          <span class="muted small">
            {minutesText(recipe.minutes)} · serves {recipe.serves}
          </span>
        </span>
      </summary>
      <div class="recipe-body">
        <ul class="recipe-ingredients">
          {recipe.ingredients.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
        <ol class="recipe-method">
          {recipe.method.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ol>
      </div>
    </details>
  );
}

/** Today: what's cropping this week, a few recipes for it, and what the year's picks are worth. */
export function KitchenCard({ garden, plantOf }: { garden: Garden; plantOf: (id: string) => Plant }) {
  const kitchen = useKitchen();
  const { weather } = useWeatherNow();
  const today = todayIso();
  const month = Number(today.slice(5, 7));
  const crops = useMemo(() => (kitchen ? croppingNow(garden, plantOf, kitchen, today, weather) : []), [kitchen, garden, plantOf, today, weather]);
  const recipes = useMemo(() => (kitchen ? recipesFor(crops, month, kitchen.recipes) : []), [kitchen, crops, month]);
  const worth = useMemo(() => (kitchen ? harvestWorth(garden, kitchen, Number(today.slice(0, 4))) : null), [kitchen, garden, today]);
  if (!kitchen || (!crops.length && !worth?.pounds)) return null;
  return (
    <section class="card kitchen-card" aria-labelledby="kitchen-title">
      <div class="section-head">
        <h2 id="kitchen-title">In the kitchen this week</h2>
      </div>
      {crops.length > 0 && (
        <>
          <ul class="kitchen-crops" aria-label="Ready to pick">
            {crops.map((id) => (
              <li key={id}>
                <PlantIcon plant={plantOf(id)} size={28} stage="harvesting" />
                <span>{plantOf(id).commonName}</span>
              </li>
            ))}
          </ul>
          {recipes.length > 0 && (
            <div class="recipes">
              {recipes.map((r) => (
                <RecipeItem key={r.id} recipe={r} plantOf={plantOf} />
              ))}
            </div>
          )}
        </>
      )}
      {worth && worth.pounds > 0 && (
        <p class="kitchen-worth">
          <span class="kitchen-worth-big">{poundsText(worth.pounds)}</span> of food from your garden this year, at shop prices
          {worth.crops[0] ? `. Most of it ${plantOf(worth.crops[0].plantId).commonName.toLowerCase()}.` : '.'}
        </p>
      )}
    </section>
  );
}

/** On a plant's card: how to store it, keep it and use it, and its recipes. Nothing for plants that don't crop. */
export function PlantKitchen({ plant, plantOf }: { plant: Plant; plantOf: (id: string) => Plant }) {
  const kitchen = useKitchen();
  const k = kitchen?.crops[plant.id];
  if (!kitchen || !k) return null;
  const month = new Date().getMonth() + 1;
  const recipes = recipesWith(plant.id, kitchen.recipes, month).slice(0, 4);
  return (
    <section class="plant-section plant-kitchen" aria-labelledby="plant-kitchen-title">
      <h2 id="plant-kitchen-title">Storing and recipes</h2>
      <dl class="kitchen-facts">
        <dt>Keeping it</dt>
        <dd>{k.store}</dd>
        <dt>For later</dt>
        <dd>{k.preserve}</dd>
        <dt>In the kitchen</dt>
        <dd>{k.use}</dd>
      </dl>
      <ul class="kitchen-keeps" aria-label="How it keeps">
        {k.keeps.map((x) => (
          <li key={x} class="chip chip-static">
            {KEEP_LABEL[x]}
          </li>
        ))}
      </ul>
      {recipes.length > 0 && (
        <div class="recipes">
          {recipes.map((r) => (
            <RecipeItem key={r.id} recipe={r} plantOf={plantOf} />
          ))}
        </div>
      )}
      <p class="muted small">Worth about £{k.kg % 1 ? k.kg.toFixed(2) : k.kg} a kilo in the shops (autumn 2026, roughly).</p>
    </section>
  );
}

/** After logging a pick: what to do with it. How it keeps, and a recipe or two. */
export function KitchenHint({ plantId, plantOf }: { plantId: string; plantOf: (id: string) => Plant }) {
  const kitchen = useKitchen();
  const k = kitchen?.crops[plantId];
  if (!kitchen || !k) return null;
  const month = new Date().getMonth() + 1;
  const recipes = recipesWith(plantId, kitchen.recipes, month).slice(0, 2);
  return (
    <div class="kitchen-hint" role="status">
      <p>
        <strong>What to do with it.</strong> {k.store}
      </p>
      {recipes.map((r) => (
        <RecipeItem key={r.id} recipe={r} plantOf={plantOf} />
      ))}
    </div>
  );
}
