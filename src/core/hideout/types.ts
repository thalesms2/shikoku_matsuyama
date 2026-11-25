/** Item e quantidade (custo, ingrediente ou produto) */
export interface ItemAmount {
  readonly item: string;
  readonly count: number;
}

/** Efeitos de um nível de módulo (valem enquanto o módulo está nesse nível) */
export interface ModuleEffects {
  /** Linhas a mais no estoque, além do tamanho inicial */
  readonly stashRows?: number;
  /** Pontos de vida curados por minuto (tempo real) */
  readonly healPerMinute?: number;
  readonly energyPerMinute?: number;
  readonly hydrationPerMinute?: number;
  /** Fração cortada do tempo de todas as produções (0 a 1) */
  readonly productionSpeed?: number;
  /** Rublos gerados por hora e o máximo acumulado antes de coletar */
  readonly incomePerHour?: number;
  readonly incomeCap?: number;
  /** Fração cortada do cooldown da raid Scav (0 a 1) */
  readonly scavCooldown?: number;
  /** Minutos para operar uma parte do corpo destruída (fora da raid) */
  readonly surgeryMinutes?: number;
}

export interface ModuleRequirements {
  readonly modules?: readonly {
    readonly module: string;
    readonly level: number;
  }[];
  readonly loyalty?: { readonly trader: string; readonly level: number };
  readonly pmcLevel?: number;
}

export interface ModuleLevelDef {
  readonly level: number;
  /** Itens e dinheiro tirados do estoque ao começar a obra */
  readonly cost: readonly ItemAmount[];
  readonly requires: ModuleRequirements;
  /** Duração da obra (tempo real) */
  readonly buildMs: number;
  readonly effects: ModuleEffects;
}

export interface ModuleDef {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** Do nível 1 em diante (nível 0 = não construído) */
  readonly levels: readonly ModuleLevelDef[];
}

export interface RecipeDef {
  readonly id: string;
  readonly module: string;
  /** Nível mínimo do módulo */
  readonly moduleLevel: number;
  readonly inputs: readonly ItemAmount[];
  readonly output: ItemAmount;
  /** Duração base (o gerador encurta) */
  readonly durationMs: number;
}

export interface Construction {
  module: string;
  level: number;
  endsAt: number;
}

/** Tudo do esconderijo que vai para o save */
export interface HideoutState {
  /** Nível de cada módulo (ausente = 0) */
  modules: Record<string, number>;
  /** Obra em andamento (a primeira; as outras ficam em `extraConstructions`) */
  construction: Construction | null;
  /** Outras obras ao mesmo tempo (no máximo uma por módulo) */
  extraConstructions?: Construction[];
  /** Combustível no gerador (sem o campo = vazio) */
  fuel?: number;
  /** Produção de cada módulo (uma por módulo) */
  productions: Record<string, { recipe: string; endsAt: number }>;
  /** Desde quando a renda passiva acumula */
  incomeSince: number;
  /** Último momento em que cura, comida e obras foram calculadas */
  lastTick: number;
  /** Minutos já passados na cirurgia da enfermaria (só durante uma) */
  surgeryProgress?: number;
}

/** Dados que as regras do esconderijo consultam */
export interface HideoutData {
  readonly modules: readonly ModuleDef[];
  readonly recipes: readonly RecipeDef[];
  /** Módulo que queima combustível e o item que o abastece (sem = sem combustível) */
  readonly fuel?: { readonly module: string; readonly item: string };
}
