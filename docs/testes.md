# Estratégia de testes

- **Cobertura de 100%** (linhas, funções, branches e statements), aplicada pelos `thresholds` do Vitest e conferida no CI.
- **Core (`src/core`):** testes unitários puros. RNG (`Rng` com seed) e relógio (`ManualClock`) injetados deixam tudo determinístico. Para a raid passo a passo, `ScriptRng` (`tests/core/raid/raidFixtures.ts`) responde `chance`, `int`, `pick` e `weighted` numa ordem roteirizada.
- **UI (`src/ui`):** a lógica de interação (arrastar, célula sob o cursor, prévias, textos de tooltip e de resumo) fica em funções testáveis. Componentes PixiJS rodam com `// @vitest-environment jsdom`, e a `Application` é mockada (o jsdom não tem WebGL).
- **Simulação:** testes de Monte Carlo com seed fixa garantem as faixas de balanceamento (`tests/core/raid/balance.test.ts`, `scavBalance.test.ts`, `tests/data/flea.test.ts`).
- **Dados:** testes em `tests/data/` conferem a consistência dos dados (itens que existem, calibres que batem, vendedores, quests, mapas, inimigos).
- **Scripts (`scripts/`):** fixtures das respostas da API e SQLite em memória; nenhum teste acessa a rede.
- **Save:** cada versão tem teste da migração e do carregamento de dados inválidos.

As armadilhas conhecidas (mock do `@pixi/sound`, `beforeEach` sem retorno, `vi.hoisted`, não importar de `*.test.ts`, eventos do Pixi que não propagam) estão no [`CLAUDE.md`](../CLAUDE.md).
