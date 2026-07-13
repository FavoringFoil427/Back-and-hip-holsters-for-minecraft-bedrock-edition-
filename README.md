# Back & Hip Holsters — Minecraft Bedrock Add-On

Give every player **4 weapon holsters**: **2 on the back** and **2 on the hips**.
Each slot holds **any item** — swords, axes, bows, crossbows, tridents, shields,
and **weapons from other add-ons** — with enchantments, durability, custom names
and lore all preserved. Holstered weapons are **visible on your body** so other
players can see what you're carrying.

> ⚠️ **Bedrock vs. Java:** Bedrock Add-Ons can't register real custom keybinds,
> add extra inventory GUI slots, or render an arbitrary item's exact 3D model on
> a body bone the way a Java (Forge/Fabric) mod can. This add-on works within
> those limits using the official **Script API**. It runs on keyboard,
> controller **and** touch.

---

## How to use it

- **Open your holsters:** **double-tap the Sneak key** (Shift on keyboard, the
  crouch button on controller/touch).
- A menu shows your four slots — **Back Left, Back Right, Hip Left, Hip Right** —
  and what each one holds.
- **Tap a slot** to:
  - **Store** the item currently in your hand (if the slot is empty), or
  - **Draw** the stored item into your hand (swapping with whatever you're holding).

Your holstered items are saved with your player, so they persist across sessions.

---

## Visible on the body

While an item is holstered, a small **non-pickable display model** appears at the
matching back/hip point and follows you, visible to everyone.

Weapons are being upgraded from flat placeholders to real **3D models**:

- **Swords** render as a full 3D model, with the blade **textured by material
  tier** (wood, stone, iron, gold, diamond, netherite) detected from the item id —
  so a diamond sword looks diamond, a netherite sword looks netherite, etc.
- **Other categories** (axe, bow, crossbow, trident, gun, generic) still use the
  flat category silhouette for now, and are next in line for 3D models.

Because Bedrock can't draw an arbitrary item's exact model on the body (and a real
floating item would just get picked back up), the display picks its model by
**weapon category** (and, for swords, material tier):

| Category | Matches item ids containing… |
| --- | --- |
| Sword | sword, blade, dagger, katana, machete, saber, scimitar, knife, cutlass |
| Axe | axe, hatchet, tomahawk (pickaxes excluded) |
| Bow | bow |
| Crossbow | crossbow |
| Trident | trident, spear, lance, javelin, glaive, halberd |
| Gun | gun, rifle, pistol, blaster, smg, shotgun, launcher, cannon, revolver |
| Generic | anything else (default fallback) |

This is what lets **add-on weapons** still show a sensible shape — a modded
`cool_addon:plasma_rifle` matches "rifle" → gun silhouette. Anything unrecognised
shows the generic blade emblem.

**Want an exact 3D model for a specific weapon?** That can be layered on later by
adding a real model + a category id for it — the system is built to extend. Ask
and I'll wire up whichever weapons you care about.

---

## Install

### Quick (recommended)

1. Download **`dist/BackAndHipHolsters.mcaddon`**.
2. Open it — Minecraft imports **both** packs (behavior + resources) automatically.
3. Create/edit a world:
   - **Behavior Packs** → activate **"Back & Hip Holsters"** (it will pull in its
     resource pack automatically).
   - If prompted, also activate **"Back & Hip Holsters (Resources)"** under
     **Resource Packs**.
4. Play. No experimental toggles are required — this uses stable Script API modules.

### Manual

1. Copy `holster_bp` into the world's `behavior_packs` folder and `holster_rp`
   into `resource_packs` (or the matching `development_*` folders in `com.mojang`).
2. Activate **both** packs on the world.

**Requires Minecraft Bedrock 1.21.0 or newer.** Both packs must be active — the
behavior pack holds the logic, the resource pack holds the body models.

---

## Configuration

Open `holster_bp/scripts/main.js` and edit the `CONFIG` block at the top:

| Option | Default | What it does |
| --- | --- | --- |
| `slots` | Back L/R, Hip L/R with anchors | Slot names **and** where each model sits on the body (`forward`/`right`/`up`/`yaw`). Tune these in-game to line the models up. |
| `lookaheadTicks` | `1.5` | Predicts your movement so the body models track tighter while running (less trailing). Higher = tighter but may overshoot on sudden stops; `0` disables it. |
| `bodyTurnThreshold` | `45` | Models follow your **body**, not your head. Standing still, they only turn once your head twists past this many degrees (like the vanilla head/body split). Lower = they turn with you sooner. |
| `sneak` | drop/forward/pitch | How far the models drop and tilt when you crouch, to stay flush with the hunched body. |
| `doubleTapWindowTicks` | `8` | Max ticks (20 = 1s) between the two sneak taps. |
| `weaponsOnly` | `false` | If `true`, only recognised weapons can be holstered. Leave `false` to allow any item (including add-on weapons). |
| `showDisplays` | `true` | Set `false` for invisible holsters (menu only, no body models). |

**Positioning tip:** the `forward`/`right`/`up` numbers are in blocks relative to
the player, and `yaw` rotates the flat model to face outward. If a model sits a
little high, low, or faces the wrong way, nudge those values — no code changes
needed.

---

## Notes & limitations

- **Any add-on weapon works in the slots** — items are stored by their full
  `typeId`, so modded/add-on weapons come out exactly as they went in.
- Enchantments, durability, custom names and lore are preserved on store/draw.
  Truly exotic custom NBT from other add-ons may not survive a round trip; the
  add-on fails safe (it skips what it can't restore rather than deleting the item).
- The on-body model is a **category silhouette**, not the item's exact model — an
  intentional trade-off, because exact floating items get auto-picked-up and
  category models can't. See "Visible on the body" above.
- To read as "attached," the models follow your **body** direction (not head),
  match your **sneak crouch** (drop + tilt), and **predict your movement** so
  they don't trail while running. All of this is tunable in `CONFIG`
  (`bodyTurnThreshold`, `sneak`, `lookaheadTicks`) plus the per-slot anchors in
  `CONFIG.slots`. There can still be a hair of motion on very fast direction
  changes — that's the once-per-tick update limit of the Script API.
- The trigger is a **double-tap of Sneak** because Bedrock has no custom-keybind API.

## Project layout

```
holster_bp/                         Behavior pack (logic)
  manifest.json
  scripts/main.js                   Holsters, menu, sneak input, display control
  entities/holster_display.json     Inert, non-pickable display entity
holster_rp/                         Resource pack (visuals)
  manifest.json
  entity/holster_display.entity.json
  render_controllers/…              Picks the texture by weapon category
  models/entity/holster_display.geo.json   Flat plate (non-sword categories)
  models/entity/holster_sword.geo.json      3D sword model
  textures/entity/holster/sword_*.png       Sword material tiers (wood..netherite)
  textures/entity/holster/*.png             Flat silhouettes (other categories)
dist/
  BackAndHipHolsters.mcaddon        One-click install (both packs)
```
