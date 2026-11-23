import type { DatabaseSync } from "node:sqlite";

import { Catalog } from "../../src/core/inventory/item.ts";
import type {
  EquipSlotType,
  GridFilter,
  GridSpec,
  ItemCategory,
  ItemDef,
  ItemStats,
} from "../../src/core/inventory/item.ts";
import { getAsset, getReference, listOverrides } from "./db.ts";
import type { ItemAsset, ItemOverride } from "./db.ts";
import type { ReferenceItem } from "./reference.ts";

/** Categoria do jogo a partir dos tipos/categoria da fonte, ou `null` */
export function mapCategory(ref: ReferenceItem): ItemCategory | null {
  if (ref.sourceCategory === "money") return "money";
  if (ref.sourceCategory === "magazine") return "magazine";
  const order: [string, ItemCategory][] = [
    ["gun", "weapon"],
    ["ammo", "ammo"],
    ["helmet", "helmet"],
    ["rig", "rig"],
    ["armor", "armor"],
    ["backpack", "backpack"],
    ["container", "container"],
    ["meds", "medical"],
    ["provisions", "food"],
    ["keys", "key"],
    ["barter", "barter"],
  ];
  for (const [type, category] of order) {
    if (ref.types.includes(type)) return category;
  }
  return null;
}

/** Slot de equipamento padrão de cada categoria */
export function defaultSlot(
  category: ItemCategory,
  ref: ReferenceItem | null,
): EquipSlotType | undefined {
  switch (category) {
    case "weapon":
      return ref?.sourceCategory === "handgun" ? "pistol" : "longWeapon";
    case "helmet":
    case "armor":
    case "rig":
    case "backpack":
      return category;
    default:
      return undefined;
  }
}

/** Filtro padrão das grades internas de cada categoria de contêiner */
export function defaultGridFilter(category: ItemCategory): GridFilter {
  if (category === "backpack") return { deny: ["backpack"] };
  if (category === "rig") return { deny: ["backpack", "rig", "armor"] };
  return {};
}

function required<T>(
  value: T | null | undefined,
  gameId: string,
  field: string,
): T {
  if (value === null || value === undefined) {
    throw new Error(`${gameId}: falta "${field}" (defina no override)`);
  }
  return value;
}

/** Dados técnicos da referência, sem os campos vazios; `null` se nenhum */
export function referenceStats(ref: ReferenceItem | null): ItemStats | null {
  if (!ref) return null;
  const entries = Object.entries({
    caliber: ref.caliber,
    damage: ref.damage,
    penetration: ref.penetration,
    armorClass: ref.armorClass,
    durability: ref.durability,
    capacity: ref.capacity,
  }).filter(([, v]) => v !== null);
  return entries.length > 0 ? (Object.fromEntries(entries) as ItemStats) : null;
}

/**
 * Monta a definição do item para o jogo: os campos do override têm
 * prioridade; o resto vem da referência da API.
 */
export function buildItemDef(
  override: ItemOverride,
  ref: ReferenceItem | null,
  asset: ItemAsset | null,
): ItemDef {
  const id = override.gameId;
  if (override.sourceId && !ref) {
    throw new Error(
      `${id}: item ${override.sourceId} não está na base (rode "items sync")`,
    );
  }
  const category = required(
    override.category ?? (ref && mapCategory(ref)),
    id,
    "category",
  );
  const refGrids: GridSpec[] = (ref?.grids ?? []).map((g) => ({
    ...g,
    ...defaultGridFilter(category),
  }));
  const grids = override.grids ?? refGrids;
  const maxStack = override.maxStack ?? ref?.maxStack ?? 1;
  const equipSlot = override.equipSlot ?? defaultSlot(category, ref);
  const refStats = referenceStats(ref);
  const stats =
    refStats || override.stats ? { ...refStats, ...override.stats } : null;

  return {
    id,
    name: required(override.name, id, "name"),
    shortName: required(override.shortName, id, "shortName"),
    category,
    width: required(override.width ?? ref?.width, id, "width"),
    height: required(override.height ?? ref?.height, id, "height"),
    ...(maxStack > 1 && { maxStack }),
    basePrice: override.basePrice ?? ref?.basePrice ?? 0,
    ...(equipSlot && { equipSlot }),
    ...(grids.length > 0 && { grids }),
    ...(override.description && { description: override.description }),
    ...(asset && { image: asset.path }),
    ...(stats && { stats }),
  };
}

/** Todas as definições habilitadas, validadas pelo `Catalog` do jogo */
export function buildCatalog(db: DatabaseSync): ItemDef[] {
  const defs = listOverrides(db)
    .filter((o) => o.enabled)
    .map((o) =>
      buildItemDef(
        o,
        o.sourceId ? getReference(db, o.sourceId) : null,
        getAsset(db, o.gameId),
      ),
    );
  new Catalog(defs);
  return defs;
}
