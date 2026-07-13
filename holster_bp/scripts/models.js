// AUTO-GENERATED — maps item typeIds to the display texture index.
// Regenerate alongside the resource-pack texture array; indices must match.

export const DEFAULT_MODEL = 34;

export const MODEL = {
  "minecraft:bow": 30,
  "minecraft:crossbow": 31,
  "minecraft:diamond_axe": 16,
  "minecraft:diamond_hoe": 28,
  "minecraft:diamond_pickaxe": 10,
  "minecraft:diamond_shovel": 22,
  "minecraft:diamond_sword": 4,
  "minecraft:golden_axe": 15,
  "minecraft:golden_hoe": 27,
  "minecraft:golden_pickaxe": 9,
  "minecraft:golden_shovel": 21,
  "minecraft:golden_sword": 3,
  "minecraft:iron_axe": 14,
  "minecraft:iron_hoe": 26,
  "minecraft:iron_pickaxe": 8,
  "minecraft:iron_shovel": 20,
  "minecraft:iron_sword": 2,
  "minecraft:mace": 33,
  "minecraft:netherite_axe": 17,
  "minecraft:netherite_hoe": 29,
  "minecraft:netherite_pickaxe": 11,
  "minecraft:netherite_shovel": 23,
  "minecraft:netherite_sword": 5,
  "minecraft:stone_axe": 13,
  "minecraft:stone_hoe": 25,
  "minecraft:stone_pickaxe": 7,
  "minecraft:stone_shovel": 19,
  "minecraft:stone_sword": 1,
  "minecraft:trident": 32,
  "minecraft:wooden_axe": 12,
  "minecraft:wooden_hoe": 24,
  "minecraft:wooden_pickaxe": 6,
  "minecraft:wooden_shovel": 18,
  "minecraft:wooden_sword": 0
};

// For items with no exact vanilla texture (add-on weapons, unknown tools),
// pick the closest category's standard look.
export function fallbackIndex(typeId) {
  const id = (typeId || "").toLowerCase();
  const has = (...s) => s.some((x) => id.includes(x));
  if (has("crossbow")) return 31;
  if (has("bow")) return 30;
  if (has("trident", "spear", "lance", "javelin", "glaive", "halberd")) return 32;
  if (has("mace", "warhammer")) return 33;
  if (has("gun", "rifle", "pistol", "blaster", "smg", "shotgun", "launcher", "cannon", "revolver")) return 35;
  if (has("pickaxe")) return 8;
  if (has("shovel", "spade")) return 20;
  if (has("hoe")) return 26;
  if (has("axe", "hatchet", "tomahawk")) return 14;
  if (has("sword", "blade", "dagger", "katana", "machete", "saber", "scimitar", "knife", "cutlass")) return 2;
  return 34;
}
