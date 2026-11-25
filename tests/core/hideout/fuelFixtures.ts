import type { HideoutData } from "../../../src/core/hideout/types.ts";
import { TEST_HIDEOUT } from "./hideoutFixtures.ts";

/** Esconderijo de teste com o módulo "power" queimando galões */
export const FUEL_HIDEOUT: HideoutData = {
  ...TEST_HIDEOUT,
  fuel: { module: "power", item: "barter_fuel" },
};
