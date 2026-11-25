import { coreBalance } from "../balance.ts";
import type { Cell } from "./path.ts";
import type { MatrixKnowledge } from "./plan.ts";
import type { MatrixMap } from "./types.ts";

/** Conhecimento guardado de um mapa (vai para o save) */
export interface MapKnowledgeRecord {
  /** XP da habilidade do mapa */
  xp: number;
  /** Pontos que o personagem já achou ("container:x,y", "extract:id"...) */
  found: string[];
}

/** Conhecimento de todos os mapas, por id */
export type MapKnowledgeState = Record<string, MapKnowledgeRecord>;

export function createMapKnowledge(): MapKnowledgeRecord {
  return { xp: 0, found: [] };
}

/** Nível da habilidade do mapa: `floor(xp / xpPerLevel)` */
export function knowledgeLevel(record: MapKnowledgeRecord): number {
  return Math.floor(record.xp / coreBalance().knowledge.xpPerLevel);
}

/** Número que muda pouco com o texto (para embaralhar sempre igual) */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

/**
 * Pontos do mapa na ordem em que a habilidade os revela (sempre a mesma
 * para o mapa): extrações, pontos de interesse que não são óbvios, spawns e
 * contêineres, embaralhados pelo id do mapa.
 */
export function revealOrder(map: MatrixMap): string[] {
  const points: string[] = [
    ...map.extracts.map((e) => `extract:${e.id}`),
    ...map.pois.filter((p) => !p.obvious).map((p) => `poi:${p.id}`),
  ];
  map.cells.forEach((row, y) =>
    row.forEach((cell, x) => {
      if (cell.scavSpawn || cell.pmcSpawn) points.push(`spawn:${x},${y}`);
      if (cell.container) points.push(`container:${x},${y}`);
    }),
  );
  return (
    points
      .map((p) => ({ p, h: hash(`${map.id}|${p}`) }))
      // empate (raríssimo) mantém a ordem original: o sort é estável
      .sort((a, b) => a.h - b.h)
      .map(({ p }) => p)
  );
}

/**
 * O que o personagem sabe do mapa: os pontos de interesse óbvios, os pontos
 * que já achou e os primeiros `nível × revealPerLevel` da ordem de revelação.
 */
export function knowledgeFor(
  map: MatrixMap,
  record: MapKnowledgeRecord = createMapKnowledge(),
): MatrixKnowledge {
  const revealed = revealOrder(map).slice(
    0,
    knowledgeLevel(record) * coreBalance().knowledge.revealPerLevel,
  );
  const known = new Set([...revealed, ...record.found]);
  const extracts = new Set<string>();
  const pois = new Set(map.pois.filter((p) => p.obvious).map((p) => p.id));
  const containers = new Set<string>();
  const spawns = new Set<string>();
  for (const point of known) {
    const [kind, id] = point.split(":");
    if (kind === "extract") extracts.add(id);
    else if (kind === "poi") pois.add(id);
    else if (kind === "spawn") spawns.add(id);
    else containers.add(id);
  }
  return { extracts, pois, containers, spawns };
}

/**
 * Depois da raid: XP = células percorridas × `cellXp` + `surviveXp` se
 * sobreviveu + `containerXp` na primeira vez que acha cada contêiner. Os
 * contêineres das células por onde passou e a extração usada ficam
 * lembrados para sempre. Devolve o XP ganho.
 */
export function learnFromRaid(
  record: MapKnowledgeRecord,
  map: MatrixMap,
  path: readonly Cell[],
  survived: boolean,
  extractId: string | null,
): number {
  const b = coreBalance().knowledge;
  const found = new Set(record.found);
  let xp = path.length * b.cellXp + (survived ? b.surviveXp : 0);
  for (const [x, y] of path) {
    const point = `container:${x},${y}`;
    if (map.cells[y][x].container && !found.has(point)) {
      found.add(point);
      xp += b.containerXp;
    }
  }
  if (extractId) found.add(`extract:${extractId}`);
  record.xp += xp;
  record.found = [...found];
  return xp;
}
