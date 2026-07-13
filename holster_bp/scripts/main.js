/*
 * Back & Hip Holsters — Minecraft Bedrock Add-On
 * -------------------------------------------------
 * Gives every player 4 virtual holster slots:
 *   - 2 on the back  (Back Left / Back Right)
 *   - 2 on the hips  (Hip Left  / Hip Right)
 *
 * Each slot can hold ANY item — swords, axes, bows, crossbows, tridents,
 * shields, and weapons from other add-ons — because the whole ItemStack is
 * stored (type, count, custom name, lore, enchantments and durability are
 * all preserved).
 *
 * "Keybind": Bedrock add-ons cannot register custom key bindings, so the
 * holster menu opens on a DOUBLE-TAP of the Sneak key (Shift on keyboard,
 * the crouch button on controller/touch). This works on every platform.
 *
 * In the menu, tapping a slot either:
 *   - stores the item currently in your hand (if the slot is empty), or
 *   - draws the stored item into your hand (swapping with whatever you hold).
 */

import { world, system, ItemStack, EnchantmentTypes } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";

// ----------------------------- Config --------------------------------------

const CONFIG = {
  // Slots, in menu order. Change the labels here if you like.
  slotLabels: ["Back Left", "Back Right", "Hip Left", "Hip Right"],

  // Max ticks (20 ticks = 1 second) allowed between the two sneak taps.
  doubleTapWindowTicks: 8,

  // Set to true to only allow storing recognised weapons (see WEAPON_HINTS).
  // Leave false so ANY item — including add-on weapons — can be holstered.
  weaponsOnly: false,
};

const SLOT_COUNT = CONFIG.slotLabels.length;
const DP_KEY = "holster:slots";

// Substrings used to guess whether an item is a weapon (only when
// CONFIG.weaponsOnly is true). Add-on items usually still match on
// "sword"/"bow"/"gun" etc.; anything unknown is allowed through anyway.
const WEAPON_HINTS = [
  "sword", "axe", "bow", "crossbow", "trident", "mace",
  "gun", "rifle", "pistol", "dagger", "spear", "blade", "shield",
];

// --------------------------- Item (de)serialisation ------------------------

/**
 * Convert an ItemStack into a plain object we can save in a dynamic property.
 * Captures everything that normally matters for a weapon.
 */
function serializeItem(item) {
  if (!item) return null;

  const data = {
    typeId: item.typeId,
    amount: item.amount,
  };

  if (item.nameTag) data.name = item.nameTag;

  const lore = item.getLore?.();
  if (lore && lore.length) data.lore = lore;

  try {
    const ench = item.getComponent("minecraft:enchantable");
    if (ench) {
      data.enchants = ench.getEnchantments().map((e) => ({
        id: e.type.id,
        level: e.level,
      }));
    }
  } catch (_) {
    /* item has no enchantable component — ignore */
  }

  try {
    const dur = item.getComponent("minecraft:durability");
    if (dur) data.damage = dur.damage;
  } catch (_) {
    /* item has no durability component — ignore */
  }

  return data;
}

/**
 * Rebuild an ItemStack from serialized data. Any piece that fails to restore
 * (e.g. an enchantment id that no longer exists) is skipped rather than
 * breaking the whole draw.
 */
function deserializeItem(data) {
  if (!data) return undefined;

  let item;
  try {
    item = new ItemStack(data.typeId, data.amount ?? 1);
  } catch (_) {
    // The item type is gone (add-on removed?). Nothing we can safely give back.
    return undefined;
  }

  if (data.name) {
    try { item.nameTag = data.name; } catch (_) {}
  }

  if (data.lore) {
    try { item.setLore(data.lore); } catch (_) {}
  }

  if (data.enchants?.length) {
    try {
      const ench = item.getComponent("minecraft:enchantable");
      if (ench) {
        for (const e of data.enchants) {
          try {
            const type = EnchantmentTypes.get(e.id);
            if (type) ench.addEnchantment({ type, level: e.level });
          } catch (_) {
            /* skip a single bad enchantment */
          }
        }
      }
    } catch (_) {}
  }

  if (typeof data.damage === "number") {
    try {
      const dur = item.getComponent("minecraft:durability");
      if (dur) dur.damage = Math.min(data.damage, dur.maxDurability);
    } catch (_) {}
  }

  return item;
}

// ------------------------------ Slot storage -------------------------------

function loadSlots(player) {
  const raw = player.getDynamicProperty(DP_KEY);
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Normalise length in case SLOT_COUNT changed between versions.
        const out = new Array(SLOT_COUNT).fill(null);
        for (let i = 0; i < SLOT_COUNT; i++) out[i] = parsed[i] ?? null;
        return out;
      }
    } catch (_) {}
  }
  return new Array(SLOT_COUNT).fill(null);
}

function saveSlots(player, slots) {
  player.setDynamicProperty(DP_KEY, JSON.stringify(slots));
}

// ------------------------------ Held-item helpers --------------------------

function getSelectedIndex(player) {
  // API renamed the property across versions; support both.
  const idx = player.selectedSlotIndex ?? player.selectedSlot;
  return typeof idx === "number" ? idx : 0;
}

function getHandContainer(player) {
  const inv = player.getComponent("minecraft:inventory");
  return inv?.container;
}

function isWeapon(item) {
  if (!item) return false;
  if (!CONFIG.weaponsOnly) return true;
  const id = item.typeId.toLowerCase();
  return WEAPON_HINTS.some((h) => id.includes(h));
}

// --------------------------------- Menu ------------------------------------

const busy = new Set(); // player ids that currently have the menu open

function describeSlot(data) {
  if (!data) return "§8[ empty ]";
  const name = data.name ?? prettyId(data.typeId);
  const count = data.amount > 1 ? ` §7x${data.amount}` : "";
  const ench = data.enchants?.length ? " §b✦" : "";
  return `§f${name}${count}${ench}`;
}

function prettyId(typeId) {
  return typeId
    .replace(/^.*:/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function openHolsterMenu(player) {
  if (busy.has(player.id)) return;
  busy.add(player.id);

  const slots = loadSlots(player);
  const container = getHandContainer(player);
  const held = container?.getItem(getSelectedIndex(player));
  const heldLabel = held ? describeSlot(serializeItem(held)) : "§8nothing";

  const form = new ActionFormData()
    .title("§lHolsters")
    .body(
      `In hand: ${heldLabel}\n\n` +
      "§7Tap a slot to §fstore§7 your held item,\n" +
      "§7or to §fdraw§7 the stored one.\n"
    );

  for (let i = 0; i < SLOT_COUNT; i++) {
    form.button(`§6${CONFIG.slotLabels[i]}\n${describeSlot(slots[i])}`);
  }

  form
    .show(player)
    .then((res) => {
      busy.delete(player.id);
      if (res.canceled) return;
      if (typeof res.selection === "number") {
        handleSlotTap(player, res.selection);
      }
    })
    .catch(() => busy.delete(player.id));
}

function handleSlotTap(player, index) {
  const container = getHandContainer(player);
  if (!container) return;

  const slots = loadSlots(player);
  const handIdx = getSelectedIndex(player);
  const held = container.getItem(handIdx);
  const stored = slots[index];
  const label = CONFIG.slotLabels[index];

  if (!stored) {
    // Slot empty → holster whatever is in hand.
    if (!held) {
      player.sendMessage("§7Your hand is empty — nothing to holster.");
      return;
    }
    if (!isWeapon(held)) {
      player.sendMessage("§cOnly weapons can be holstered.");
      return;
    }
    slots[index] = serializeItem(held);
    container.setItem(handIdx, undefined); // clear hand
    player.sendMessage(`§aHolstered §f${describeSlot(slots[index])} §ain ${label}.`);
  } else {
    // Slot occupied → draw it, swapping with whatever is in hand.
    const drawn = deserializeItem(stored);
    if (!drawn) {
      player.sendMessage("§cThat stored item could no longer be restored.");
      slots[index] = null;
      saveSlots(player, slots);
      return;
    }
    container.setItem(handIdx, drawn);
    slots[index] = held ? serializeItem(held) : null;
    player.sendMessage(`§aDrew §f${describeSlot(stored)} §afrom ${label}.`);
  }

  saveSlots(player, slots);
}

// --------------------------- Double-tap Sneak input ------------------------

// Per-player edge-detection state for the sneak key.
const sneakState = new Map(); // id -> { down: bool, lastTapTick: number }

system.runInterval(() => {
  const now = system.currentTick;
  for (const player of world.getAllPlayers()) {
    const sneaking = player.isSneaking;
    let st = sneakState.get(player.id);
    if (!st) {
      st = { down: false, lastTapTick: -100 };
      sneakState.set(player.id, st);
    }

    // Rising edge: key just went from up to down.
    if (sneaking && !st.down) {
      if (now - st.lastTapTick <= CONFIG.doubleTapWindowTicks) {
        st.lastTapTick = -100; // consume, so a third tap doesn't re-trigger
        openHolsterMenu(player);
      } else {
        st.lastTapTick = now;
      }
    }
    st.down = sneaking;
  }
}, 1);

// -------------------------------- Cleanup ----------------------------------

world.afterEvents.playerLeave.subscribe((ev) => {
  sneakState.delete(ev.playerId);
  busy.delete(ev.playerId);
});

// --------------------------------- Boot ------------------------------------

world.afterEvents.worldInitialize?.subscribe(() => {
  // no-op: dynamic properties are read lazily per player.
});

world.afterEvents.playerSpawn.subscribe((ev) => {
  if (ev.initialSpawn) {
    ev.player.sendMessage(
      "§6[Holsters] §7Double-tap §fSneak§7 to open your 2 back + 2 hip slots."
    );
  }
});
