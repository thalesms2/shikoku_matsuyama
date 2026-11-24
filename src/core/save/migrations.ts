import { createAutoState } from "../auto/auto.ts";
import { createFleaState } from "../flea/flea.ts";
import { createHideoutState } from "../hideout/hideout.ts";
import { createRaidProfile, createScavProfile } from "../raid/profile.ts";
import { SAVE_VERSION } from "./format.ts";
import type { SaveData } from "./format.ts";

/** Converte um save da versão `n` para a versão `n + 1` */
export type Migration = (
  data: Record<string, unknown>,
) => Record<string, unknown>;

/**
 * Migrações por versão de origem. Ao mudar o formato do save: incremente
 * `SAVE_VERSION` e adicione aqui a função que converte a versão anterior.
 */
export const MIGRATIONS: Record<number, Migration> = {
  // v1 → v2: perfil de raid (karma, estatísticas, seed); seed vem do savedAt
  1: (data) => ({
    ...data,
    raid: createRaidProfile(Number(data.savedAt) || 0),
  }),
  // v2 → v3: raid Scav (começa liberada)
  2: (data) => ({ ...data, scav: createScavProfile() }),
  // v3 → v4: vendedores (sem histórico; cada um nasce no primeiro acesso)
  3: (data) => ({ ...data, traders: {} }),
  // v4 → v5: quests (nenhuma aceita) e itens "encontrados na raid" (`fir`)
  4: (data) => ({ ...data, quests: {} }),
  // v5 → v6: esconderijo vazio, contando a partir do savedAt
  5: (data) => ({
    ...data,
    hideout: createHideoutState(Number(data.savedAt) || 0),
  }),
  // v6 → v7: mercado sem anúncios (o formato salvo é igual ao do estado)
  6: (data) => ({
    ...data,
    flea: createFleaState(Number(data.savedAt) || 0),
  }),
  // v7 → v8: nenhum loadout salvo
  7: (data) => ({ ...data, loadouts: [] }),
  // v8 → v9: raids automáticas paradas, com as regras padrão
  8: (data) => ({ ...data, auto: createAutoState() }),
  // v9 → v10: durabilidade nos itens (sem o campo = inteira); nada muda
  9: (data) => data,
  // v10 → v11: progresso da cirurgia da enfermaria (sem o campo = 0)
  10: (data) => data,
  // v11 → v12: cartucho na câmara das armas (sem o campo = vazia); nada muda
  11: (data) => data,
  // v12 → v13: quests que avançaram na raid em andamento (sem = nenhuma)
  12: (data) => data,
  // v13 → v14: carregar e descarregar ficaram instantâneos; o carregamento
  // em andamento sai do save (os cartuchos ficam onde estavam)
  13: ({ loader: _loader, ...data }) => data,
  // v14 → v15: skills novas (categorias); as que faltam começam em 0
  14: (data) => data,
};

export class SaveError extends Error {}

/** Leva o save até a versão atual, aplicando as migrações em ordem */
export function migrate(
  raw: unknown,
  migrations: Record<number, Migration> = MIGRATIONS,
  current: number = SAVE_VERSION,
): SaveData {
  if (typeof raw !== "object" || raw === null) {
    throw new SaveError("Save inválido");
  }
  let data = raw as Record<string, unknown>;
  let version = data.version;
  if (
    typeof version !== "number" ||
    !Number.isInteger(version) ||
    version < 1
  ) {
    throw new SaveError("Save sem versão");
  }
  if (version > current) {
    throw new SaveError(
      `Save da versão ${version}, mais nova que a do jogo (${current})`,
    );
  }
  while (version < current) {
    const step = migrations[version];
    if (!step) throw new SaveError(`Falta a migração da versão ${version}`);
    data = { ...step(data), version: version + 1 };
    version += 1;
  }
  return data as unknown as SaveData;
}
