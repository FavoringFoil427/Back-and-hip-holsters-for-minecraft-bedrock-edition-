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

Holstered items use the **real in-game item art**. Every vanilla tool and weapon
maps to its actual texture, so a diamond sword shows the diamond sword, a
netherite pickaxe shows the netherite pickaxe, and so on.

**Covered vanilla items** (all material tiers where applicable — wood, stone,
iron, gold, diamond, netherite):

| | |
| --- | --- |
| Swords | ✅ |
| Pickaxes | ✅ |
| Axes | ✅ |
| Shovels | ✅ |
| Hoes | ✅ |
| Bow / Crossbow / Trident / Mace | ✅ |

**Add-on & unknown items** can't be referenced by a pack (their texture paths
aren't knowable), so they fall back to the closest category's standard look — e.g.
a modded `cool_addon:ruby_sword` shows the iron sword, `plasma_rifle` shows a
generic gun, and anything unrecognised shows a generic emblem.

**How it works:** Bedrock can't attach an arbitrary item's exact mesh to the
player, and a real floating item would get picked back up. So the display is a
thin card showing the item's genuine texture (with a slight thickness for depth).
The `typeId → texture` table lives in `holster_bp/scripts/models.js` and the
matching resource-pack texture array is generated alongside it — adding more items
is just extending that list.

> If any vanilla item shows a missing-texture (pink/black) card, its texture path
> needs a tweak in the generated files — the vanilla texture filenames are the one
> thing that can't be verified without the game. Report which item and it's a
> one-line fix.

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
| `lookaheadTicks` | `2.5` | **Main "make it look attached" knob.** Predicts your movement to cancel the display's render lag and your body's client-side prediction, so the item lands on you instead of trailing. Higher = tighter while moving, more overshoot on sudden stops (~1.5 gentle, ~2.5 tight, 3.5+ aggressive); `0` disables it. |
| `maxLookaheadBlocks` | `1.1` | Safety cap so knockback / elytra / high speed can't fling the model off your body. |
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
  scripts/models.js                 Generated typeId → texture-index lookup
  entities/holster_display.json     Inert, non-pickable display entity
holster_rp/                         Resource pack (visuals)
  manifest.json
  entity/holster_display.entity.json    Item textures (vanilla paths + fallbacks)
  render_controllers/…                  Picks the texture by holster:model index
  models/entity/holster_display.geo.json   Thin display card
  textures/entity/holster/generic.png, gun.png   Fallback art for non-vanilla items
dist/
  BackAndHipHolsters.mcaddon        One-click install (both packs)
```
