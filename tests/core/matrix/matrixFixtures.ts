import type {
  MatrixCell,
  MatrixExtract,
  MatrixMap,
  PointOfInterest,
} from "../../../src/core/matrix/types.ts";

/**
 * Mapa pequeno montado à mão. `rows` usa um caractere por célula:
 * `.` rua, `r` escombros, `c` caixote (contêiner), `s` cofre, `S` spawn de
 * Scav, `P` spawn de PMC.
 */
export function smallMap(
  rows: string[],
  extracts: MatrixExtract[],
  pois: PointOfInterest[] = [],
): MatrixMap {
  const cells: MatrixCell[][] = rows.map((row) =>
    [...row].map((ch): MatrixCell => {
      if (ch === "r") return { terrain: "rubble" };
      if (ch === "c") return { terrain: "road", container: "crate" };
      if (ch === "s") return { terrain: "building", container: "safe" };
      if (ch === "S") return { terrain: "road", scavSpawn: true };
      if (ch === "P") return { terrain: "road", pmcSpawn: true };
      return { terrain: "road" };
    }),
  );
  return {
    id: "small",
    name: "Pequeno",
    difficulty: 1,
    width: rows[0].length,
    height: rows.length,
    cells,
    extracts,
    pois,
  };
}
