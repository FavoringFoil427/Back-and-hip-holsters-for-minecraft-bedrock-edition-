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
 * VISIBLE ON THE BODY: while an item is holstered, a small non-pickable
 * "display" entity appears on the matching back/hip point and follows the
 * player, so everyone can see what's sheathed. Its look is chosen by the
 * weapon's CATEGORY (sword / axe / bow / crossbow / trident / gun / generic),
 * which is what lets add-on weapons still show something recognisable.
 *
 * "Keybind": Bedrock add-ons cannot register custom key bindings, so the
 * holster menu opens on a DOUBLE-TAP of the Sneak key (Shift on keyboard,
 * the crouch button on controller/touch). This works on every platform.
 */

import { world, system, ItemStack, EnchantmentTypes } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { MODEL, fallbackIndex } from "./models.js";

// ----------------------------- Config --------------------------------------

const CONFIG = {
  // Slots, in menu order. Each has a body anchor:
  //   forward: + = in front of the player, - = behind
  //   right:   + = player's right side,    - = left
  //   up:      height above the player's feet, in blocks
  //   yaw:     degrees added to the player's facing so the flat model faces out
  // Tweak these numbers in-game to line the models up exactly how you like.
  slots: [
    { label: "Back Left",  forward: -0.28, right: -0.22, up: 1.35, yaw: 0 },
    { label: "Back Right", forward: -0.28, right: 0.22,  up: 1.35, yaw: 0 },
    { label: "Hip Left",   forward: -0.05, right: -0.36, up: 0.72, yaw: -90 },
    { label: "Hip Right",  forward: -0.05, right: 0.36,  up: 0.72, yaw: 90 },
  ],

  // How many ticks ahead to predict the player's movement when placing the
  // body models. This is the main "make it look bone-attached" knob: it cancels
  // both the display entity's render lag AND the client-side prediction of your
  // own body, so the item lands ON you instead of trailing behind. Higher =
  // tighter while moving, but more overshoot when you stop suddenly.
  //   ~1.5 = gentle,  ~2.5 = tight (default),  3.5+ = very aggressive.
  lookaheadTicks: 2.5,

  // Safety cap (in blocks) on how far prediction may push the model from its
  // resting anchor, so knockback / elytra / high speed can't fling it away.
  maxLookaheadBlocks: 1.1,

  // The models follow the player's BODY (not head) direction, so glancing
  // around doesn't swivel them. Body only turns when the head twists past this
  // many degrees, or when the player moves — mirroring vanilla head/body split.
  bodyTurnThreshold: 45,

  // When sneaking, the player hunches: drop the models and tilt them so they
  // stay flush with the crouched body. Tune to taste.
  sneak: { drop: 0.22, forward: -0.06, pitch: 28 },

  // Max ticks (20 ticks = 1 second) allowed between the two sneak taps.
  doubleTapWindowTicks: 8,

  // Set to true to only allow storing recognised weapons (see categoryOf()).
  // Leave false so ANY item — including add-on weapons — can be holstered.
  weaponsOnly: false,

  // Show the on-body display entities. Set false for holsters with no visuals.
  showDisplays: true,
};

const SLOT_COUNT = CONFIG.slots.length;
const DP_KEY = "holster:slots";
const DISPLAY_ID = "holster:display";

// Category ids must match the render controller texture array order in the
// resource pack (Array.skins): 0 sword,1 axe,2 bow,3 crossbow,4 trident,5 gun,6 generic
const CAT = { sword: 0, axe: 1, bow: 2, crossbow: 3, trident: 4, gun: 5, generic: 6 };

// --------------------------- Item (de)serialisation ------------------------

function serializeItem(item) {
  if (!item) return null;
  const data = { typeId: item.typeId, amount: item.amount };
  if (item.nameTag) data.name = item.nameTag;

  const lore = item.getLore?.();
  if (lore && lore.length) data.lore = lore;

  try {
    const ench = item.getComponent("minecraft:enchantable");
    if (ench) {
      data.enchants = ench.getEnchantments().map((e) => ({ id: e.type.id, level: e.level }));
    }
  } catch (_) {}

  try {
    const dur = item.getComponent("minecraft:durability");
    if (dur) data.damage = dur.damage;
  } catch (_) {}

  return data;
}

function deserializeItem(data) {
  if (!data) return undefined;
  let item;
  try {
    item = new ItemStack(data.typeId, data.amount ?? 1);
  } catch (_) {
    return undefined;
  }
  if (data.name) { try { item.nameTag = data.name; } catch (_) {} }
  if (data.lore) { try { item.setLore(data.lore); } catch (_) {} }

  if (data.enchants?.length) {
    try {
      const ench = item.getComponent("minecraft:enchantable");
      if (ench) {
        for (const e of data.enchants) {
          try {
            const type = EnchantmentTypes.get(e.id);
            if (type) ench.addEnchantment({ type, level: e.level });
          } catch (_) {}
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

// ------------------------------ Weapon category ----------------------------

// Decide which display model a stored item should use, purely from its typeId,
// so add-on weapons still map to a sensible silhouette.
function categoryOf(typeId) {
  const id = (typeId || "").toLowerCase();
  const has = (...s) => s.some((x) => id.includes(x));

  if (has("crossbow")) return CAT.crossbow;
  if (has("bow")) return CAT.bow;
  if (has("trident", "spear", "lance", "javelin", "glaive", "halberd")) return CAT.trident;
  if (has("gun", "rifle", "pistol", "blaster", "smg", "shotgun", "launcher", "cannon", "revolver"))
    return CAT.gun;
  if (has("pickaxe")) return CAT.generic; // don't treat picks as axes
  if (has("axe", "hatchet", "tomahawk")) return CAT.axe;
  if (has("sword", "blade", "dagger", "katana", "machete", "saber", "scimitar", "knife", "cutlass"))
    return CAT.sword;
  return CAT.generic;
}

// Which display texture an item should use. Vanilla items map to their REAL
// in-game texture; anything else (add-on weapons, unknown tools) falls back to
// the closest category's standard look.
function modelIndexOf(typeId) {
  const exact = MODEL[typeId];
  return exact !== undefined ? exact : fallbackIndex(typeId);
}

// A stored item is a "weapon" if we can categorise it as one (used only when
// CONFIG.weaponsOnly is true). Unknown add-on items fall through as allowed.
function isAllowed(item) {
  if (!item) return false;
  if (!CONFIG.weaponsOnly) return true;
  return categoryOf(item.typeId) !== CAT.generic;
}

// ------------------------------ Slot storage -------------------------------

function loadSlots(player) {
  const raw = player.getDynamicProperty(DP_KEY);
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
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
  const idx = player.selectedSlotIndex ?? player.selectedSlot;
  return typeof idx === "number" ? idx : 0;
}

function getHandContainer(player) {
  const inv = player.getComponent("minecraft:inventory");
  return inv?.container;
}

// isValid changed from a method to a getter across API versions; support both.
function valid(entity) {
  if (!entity) return false;
  try {
    const v = entity.isValid;
    return typeof v === "function" ? entity.isValid() : !!v;
  } catch (_) {
    return false;
  }
}

// --------------------------------- Menu ------------------------------------

const busy = new Set();

function describeSlot(data) {
  if (!data) return "§8[ empty ]";
  const name = data.name ?? prettyId(data.typeId);
  const count = data.amount > 1 ? ` §7x${data.amount}` : "";
  const ench = data.enchants?.length ? " §b✦" : "";
  return `§f${name}${count}${ench}`;
}

function prettyId(typeId) {
  return typeId.replace(/^.*:/, "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
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
    form.button(`§6${CONFIG.slots[i].label}\n${describeSlot(slots[i])}`);
  }

  form
    .show(player)
    .then((res) => {
      busy.delete(player.id);
      if (res.canceled) return;
      if (typeof res.selection === "number") handleSlotTap(player, res.selection);
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
  const label = CONFIG.slots[index].label;

  if (!stored) {
    if (!held) {
      player.sendMessage("§7Your hand is empty — nothing to holster.");
      return;
    }
    if (!isAllowed(held)) {
      player.sendMessage("§cOnly weapons can be holstered.");
      return;
    }
    slots[index] = serializeItem(held);
    container.setItem(handIdx, undefined);
    player.sendMessage(`§aHolstered §f${describeSlot(slots[index])} §ain ${label}.`);
  } else {
    const drawn = deserializeItem(stored);
    if (!drawn) {
      player.sendMessage("§cThat stored item could no longer be restored.");
      slots[index] = null;
      saveSlots(player, slots);
      refreshCache(player, slots);
      return;
    }
    container.setItem(handIdx, drawn);
    slots[index] = held ? serializeItem(held) : null;
    player.sendMessage(`§aDrew §f${describeSlot(stored)} §afrom ${label}.`);
  }

  saveSlots(player, slots);
  refreshCache(player, slots);
}

// --------------------------- On-body display entities ----------------------

// Runtime only (rebuilt on join / boot):
const slotCache = new Map();  // playerId -> [modelIndex | null] * SLOT_COUNT
const displays = new Map();   // playerId -> [Entity | undefined]   * SLOT_COUNT
const bodyYawState = new Map(); // playerId -> tracked body yaw (degrees)

// Shortest signed difference a-b, wrapped to [-180,180].
function angleDiff(a, b) {
  return ((((a - b) % 360) + 540) % 360) - 180;
}

// Approximate the player's BODY yaw from their HEAD yaw the way Minecraft does:
// the body stays put while you glance around, and only turns to catch up once
// the head twists past a threshold or the player is moving. Returns degrees.
function updateBodyYaw(player) {
  const head = player.getRotation().y;
  let body = bodyYawState.get(player.id);
  if (body === undefined) { body = head; bodyYawState.set(player.id, body); return body; }

  let moving = false;
  try {
    const v = player.getVelocity();
    moving = v.x * v.x + v.z * v.z > 0.0025; // ~0.05 blocks/tick
  } catch (_) {}

  const diff = angleDiff(head, body);
  if (moving) {
    // While walking/running the torso faces where you look — ease in quickly.
    body += diff * 0.5;
  } else if (Math.abs(diff) > CONFIG.bodyTurnThreshold) {
    // Standing still: only drag the body along once the head passes the limit.
    body = head - Math.sign(diff) * CONFIG.bodyTurnThreshold;
  }
  // else: keep the body exactly where it is (no jitter from tiny head moves).

  bodyYawState.set(player.id, body);
  return body;
}

function refreshCache(player, slots) {
  const models = new Array(SLOT_COUNT).fill(null);
  for (let i = 0; i < SLOT_COUNT; i++) {
    models[i] = slots[i] ? modelIndexOf(slots[i].typeId) : null;
  }
  slotCache.set(player.id, models);
}

// Rotate a (forward,right) offset by the player's yaw into a world offset.
function anchorLocation(player, slot, bodyYawDeg, sneaking) {
  const yaw = (bodyYawDeg * Math.PI) / 180;
  const fx = -Math.sin(yaw), fz = Math.cos(yaw); // forward
  const rx = -fz, rz = fx;                        // player's right
  const loc = player.location;

  // Match the hunched sneak pose so the models stay flush with the body.
  const forward = slot.forward + (sneaking ? CONFIG.sneak.forward : 0);
  const up = slot.up - (sneaking ? CONFIG.sneak.drop : 0);

  // Predict where the player is heading so the models don't trail while moving.
  let vx = 0, vy = 0, vz = 0;
  if (CONFIG.lookaheadTicks > 0) {
    try {
      const v = player.getVelocity();
      vx = v.x * CONFIG.lookaheadTicks;
      vy = v.y * CONFIG.lookaheadTicks;
      vz = v.z * CONFIG.lookaheadTicks;
      // Clamp the prediction so extreme speeds can't fling the model away.
      const cap = CONFIG.maxLookaheadBlocks;
      const hmag = Math.hypot(vx, vz);
      if (hmag > cap) { const s = cap / hmag; vx *= s; vz *= s; }
      if (vy > cap) vy = cap; else if (vy < -cap) vy = -cap;
    } catch (_) {}
  }

  return {
    x: loc.x + forward * fx + slot.right * rx + vx,
    y: loc.y + up + vy,
    z: loc.z + forward * fz + slot.right * rz + vz,
  };
}

function maintainDisplays(player) {
  if (!CONFIG.showDisplays) return;

  let cats = slotCache.get(player.id);
  if (!cats) { refreshCache(player, loadSlots(player)); cats = slotCache.get(player.id); }

  let disp = displays.get(player.id);
  if (!disp) { disp = new Array(SLOT_COUNT).fill(undefined); displays.set(player.id, disp); }

  const dim = player.dimension;
  const bodyYaw = updateBodyYaw(player);
  const sneaking = player.isSneaking;
  const pitch = sneaking ? CONFIG.sneak.pitch : 0;

  for (let i = 0; i < SLOT_COUNT; i++) {
    const wanted = cats[i];
    let ent = disp[i];

    // Drop an entity that has become invalid or ended up in another dimension.
    if (ent && (!valid(ent) || ent.dimension?.id !== dim.id)) {
      try { if (valid(ent)) ent.remove(); } catch (_) {}
      ent = undefined;
      disp[i] = undefined;
    }

    if (wanted === null) {
      if (ent) { try { ent.remove(); } catch (_) {} disp[i] = undefined; }
      continue;
    }

    const target = anchorLocation(player, CONFIG.slots[i], bodyYaw, sneaking);

    if (!ent) {
      try {
        ent = dim.spawnEntity(DISPLAY_ID, target);
        ent.addTag("holster_disp");
        ent.addTag(`howner_${player.id}`);
        disp[i] = ent;
      } catch (_) {
        continue; // chunk not ready this tick; try again next tick
      }
    }

    try { ent.setProperty("holster:model", wanted); } catch (_) {}
    try {
      ent.teleport(target, { rotation: { x: pitch, y: bodyYaw + CONFIG.slots[i].yaw } });
    } catch (_) {}
  }
}

function removeDisplaysFor(playerId) {
  const disp = displays.get(playerId);
  if (disp) {
    for (const e of disp) { try { if (valid(e)) e.remove(); } catch (_) {} }
  }
  displays.delete(playerId);
  slotCache.delete(playerId);
  bodyYawState.delete(playerId);
}

// Kill every display entity in every loaded dimension (used on boot so a
// reload never leaves orphaned models floating around).
function purgeAllDisplays() {
  for (const dim of [world.getDimension("overworld"), world.getDimension("nether"), world.getDimension("the_end")]) {
    try {
      for (const e of dim.getEntities({ type: DISPLAY_ID })) {
        try { e.remove(); } catch (_) {}
      }
    } catch (_) {}
  }
}

// --------------------------- Main tick: input + displays -------------------

const sneakState = new Map(); // id -> { down, lastTapTick }

system.runInterval(() => {
  const now = system.currentTick;
  for (const player of world.getAllPlayers()) {
    // --- double-tap sneak detection ---
    const sneaking = player.isSneaking;
    let st = sneakState.get(player.id);
    if (!st) { st = { down: false, lastTapTick: -100 }; sneakState.set(player.id, st); }
    if (sneaking && !st.down) {
      if (now - st.lastTapTick <= CONFIG.doubleTapWindowTicks) {
        st.lastTapTick = -100;
        openHolsterMenu(player);
      } else {
        st.lastTapTick = now;
      }
    }
    st.down = sneaking;

    // --- keep the on-body models glued to the player ---
    try { maintainDisplays(player); } catch (_) {}
  }
}, 1);

// -------------------------------- Lifecycle --------------------------------

world.afterEvents.playerLeave.subscribe((ev) => {
  sneakState.delete(ev.playerId);
  busy.delete(ev.playerId);
  removeDisplaysFor(ev.playerId);
});

world.afterEvents.playerSpawn.subscribe((ev) => {
  // Rebuild the runtime cache from saved data whenever a player (re)spawns.
  refreshCache(ev.player, loadSlots(ev.player));
  if (ev.initialSpawn) {
    ev.player.sendMessage(
      "§6[Holsters] §7Double-tap §fSneak§7 to open your 2 back + 2 hip slots."
    );
  }
});

// Clean slate on script boot, then let the tick loop respawn as needed.
system.run(() => {
  purgeAllDisplays();
  for (const player of world.getAllPlayers()) {
    refreshCache(player, loadSlots(player));
  }
});
