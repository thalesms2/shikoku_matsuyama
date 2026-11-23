import type { Grid } from "../../core/inventory/grid.ts";
import type { Item, ItemFactory } from "../../core/inventory/item.ts";
import type { MagazineLoader } from "../../core/inventory/loading.ts";
import {
  isMagazine,
  loadedRounds,
  removeMagazine,
} from "../../core/inventory/magazine.ts";
import { splitStack } from "../../core/inventory/operations.ts";
import type { MenuOption } from "../components/ContextMenu.ts";

export interface ActionContext {
  loader: MagazineLoader;
  factory: ItemFactory;
  /** Onde guardar o que sai do item (munição, carregador, metade da pilha) */
  storageFor: (item: Item) => readonly Grid[];
  openWindow: (item: Item) => void;
  /** Chamado depois de qualquer ação que muda o inventário */
  changed: () => void;
}

/** Opções do menu de contexto de um item */
export function itemActions(item: Item, ctx: ActionContext): MenuOption[] {
  const options: MenuOption[] = [];
  const act = (label: string, run: () => void) =>
    options.push({
      label,
      run: () => {
        run();
        ctx.changed();
      },
    });

  if (item.grids.length > 0) {
    options.push({ label: "Abrir", run: () => ctx.openWindow(item) });
  }

  if (isMagazine(item)) {
    if (ctx.loader.isBusy(item)) {
      act("Cancelar carregamento", () => ctx.loader.cancel());
    } else if (loadedRounds(item) > 0) {
      act("Descarregar", () =>
        ctx.loader.start({
          kind: "unload",
          magazine: item,
          factory: ctx.factory,
          grids: () => ctx.storageFor(item),
        }),
      );
    }
  }

  if (item.magazine) {
    act("Remover carregador", () => {
      removeMagazine(item, ctx.storageFor(item));
    });
  }

  if (item.count > 1) {
    act("Separar pilha pela metade", () => {
      const part = splitStack(item, Math.floor(item.count / 2), ctx.factory);
      // Não junta de volta na própria pilha: procura um espaço livre
      const grids = ctx.storageFor(item);
      for (const grid of grids) {
        const spot = grid.findFreeSpot(part);
        if (spot) {
          grid.place(part, spot.x, spot.y, spot.rotated);
          return;
        }
      }
      item.count += part.count;
    });
  }

  return options;
}
