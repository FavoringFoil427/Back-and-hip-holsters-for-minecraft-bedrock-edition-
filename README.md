# Back & Hip Holsters — Minecraft Bedrock Add-On

Give every player **4 weapon holsters**: **2 on the back** and **2 on the hips**.
Each slot holds **any item** — swords, axes, bows, crossbows, tridents, shields,
and **weapons from other add-ons** — with enchantments, durability, custom names
and lore all preserved.

> ⚠️ **Bedrock vs. Java:** Bedrock Add-Ons can't register real custom keybinds or
> add extra inventory GUI slots the way a Java (Forge/Fabric) mod can. This
> add-on uses the official **Script API** to give you a virtual holster and a
> cross-platform trigger that behaves like a keybind. It works on keyboard,
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

## Install

### Quick (recommended)

1. Download **`dist/BackAndHipHolsters.mcpack`** from this repo.
2. Open it — Minecoft imports it automatically.
3. Create/edit a world → **Behavior Packs** → **Activate** "Back & Hip Holsters".
4. Play. (No experimental toggles are required — this uses stable Script API modules.)

### Manual

1. Copy the `holster_bp` folder into your world's `behavior_packs` folder, **or**
   into `development_behavior_packs` in your `com.mojang` directory.
2. Activate the pack on the world as above.

**Requires Minecraft Bedrock 1.21.0 or newer.**

---

## Configuration

Open `holster_bp/scripts/main.js` and edit the `CONFIG` block at the top:

| Option | Default | What it does |
| --- | --- | --- |
| `slotLabels` | Back Left / Back Right / Hip Left / Hip Right | Names & count of the slots. |
| `doubleTapWindowTicks` | `8` | Max ticks (20 = 1s) between the two sneak taps. |
| `weaponsOnly` | `false` | If `true`, only recognised weapons can be holstered. Leave `false` to allow any item (including add-on weapons). |

---

## Notes & limitations

- **Any add-on weapon works** — items are stored by their full `typeId`, so
  modded/add-on weapons come back exactly as they went in.
- Enchantments, durability, custom names and lore are preserved. Truly exotic
  custom NBT written by other add-ons may not survive a store/draw cycle; the
  add-on fails safe (it simply skips whatever it can't restore rather than
  deleting your item).
- The trigger is a **double-tap of Sneak** because Bedrock has no custom-keybind
  API. You can widen/narrow the timing with `doubleTapWindowTicks`.

## Project layout

```
holster_bp/
  manifest.json        Behavior pack manifest (declares the script + API deps)
  pack_icon.png        Pack icon
  scripts/
    main.js            All the holster logic
dist/
  BackAndHipHolsters.mcpack   One-click installable package
```
