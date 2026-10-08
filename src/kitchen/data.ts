// The kitchen's data: how to store and use each crop, and the recipes. Loaded
// only when something needs it, as its own small file.

import fruit from '../../data/kitchen/fruit.json';
import herbs from '../../data/kitchen/herbs.json';
import recipes from '../../data/kitchen/recipes.json';
import vegetables from '../../data/kitchen/vegetables.json';
import type { CropKitchen, Kitchen, Recipe } from './recipes';

export const KITCHEN: Kitchen = {
  crops: { ...vegetables, ...herbs, ...fruit } as Record<string, CropKitchen>,
  recipes: recipes as Recipe[],
};
