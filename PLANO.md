# Plano de desenvolvimento — Escape from Idle

Cada fase entrega algo jogável/testável. Em todas as fases valem as regras do `CLAUDE.md`: 100% de cobertura, não alterar testes existentes, registrar cada mecânica no `CLAUDE.md` e no `README.md`.

---

## Fase 0 — Fundação do projeto ✅

- [x] Projeto Vite + TypeScript strict + PixiJS v8 (a partir do template `create-pixi`, com servidor Colyseus mantido).
- [x] Vitest com `@vitest/coverage-v8` e `thresholds` de 100% (lines, functions, branches, statements).
- [x] oxlint + oxfmt (do template), scripts `dev`, `build`, `test`, `test:coverage`, `lint`, `typecheck`, `format`.
- [x] `git init`, `.gitignore`, CI (GitHub Actions) rodando lint, typecheck, formatação, cobertura e build.
- [x] Utilitários base do core: `Rng` (mulberry32 com seed), `EventBus` tipado, `Clock` injetável (`systemClock` / `ManualClock`).
- [x] Tela PixiJS mínima: `SceneManager` + `TitleScene`.
- [x] Removida a demo do template (`src/scene.ts`, `src/cube.ts`, `@pixi/3d`).

**Pronto quando:** `npm run test:coverage` passa e a aplicação abre uma tela com o título.

## Fase 1 — Inventário em grade ("tetris")

O coração do jogo; vem primeiro porque quase tudo depende dele.

- **Modelo de item:** `id`, `defId`, tamanho `w×h`, empilhável (`stack`/`maxStack`), rotação, durabilidade, valor base, categoria.
- **Grade (`Grid`):** largura × altura, ocupação por célula, `canPlace`, `place`, `remove`, `move`, `rotate`, `findFreeSpot` (auto-encaixe), merge de pilhas, split de pilhas.
- **Contêineres aninhados:** itens que têm grades internas (mochila, colete, caixas de munição/itens). Proibir colocar um contêiner dentro dele mesmo; colete pode ter grades múltiplas de tamanhos diferentes.
- **Slots de equipamento:** arma primária/secundária, coldre, capacete, armadura, colete tático, mochila, contêiner seguro, bolsos.
- **UI PixiJS:** renderização da grade, drag & drop, prévia verde/vermelha de encaixe, tecla `R` para girar durante o arraste, tooltip com informações, ordenação automática do estoque.

**Pronto quando:** dá para mover, girar, empilhar e guardar itens entre estoque, mochila e equipamento.

## Fase 2 — Dados do jogo e PMC

- Catálogo inicial de itens (original): armas, munições (penetração/dano), armaduras (classe, durabilidade), meds, comida/bebida, loot de valor (barter), chaves.
- **PMC:** nível/XP, vida por parte do corpo (cabeça, tórax, estômago, braços, pernas), energia e hidratação.
- **Skills:** resistência, força, saúde, vitalidade, percepção, furtividade, mira, etc. Cada skill tem XP próprio e dá bônus pequenos e cumulativos.
- Kit inicial básico.
- **Save/load:** serialização versionada no `localStorage` com migrações.

## Fase 3 — Raid do PMC (simulação idle)

- **Mapas:** cada mapa com dificuldade, duração, tabela de loot, extrações (algumas com requisito: chave, pagamento, sem mochila) e tipos de ameaça.
- **Estratégias:** furtivo / equilibrado / agressivo — afetam encontros, loot e risco.
- **Simulação por eventos:** a raid é uma sequência de eventos sorteados (encontrar loot, encontro com IA, encontro com PMC inimigo, ferimento, extração). Cada combate é resolvido por fórmula com equipamento (penetração da munição × classe da armadura, durabilidade), skills e estratégia.
- **Loot durante a raid:** o loot só é guardado se couber na grade do equipamento (reutiliza o inventário da Fase 1). Regra automática configurável: priorizar valor por célula.
- **Resultado:** extraiu (mantém tudo + XP) / morreu (perde equipamento e loot, exceto o contêiner seguro; mantém XP de skills) / MIA (tempo esgotado = morte).
- **Tela de raid:** log de eventos em tempo real (com acelerar/pular) e tela de resumo pós-raid.
- **Karma:** comportamento acumulado do PMC (ex.: matar Scavs, ajudar, agressividade) registrado para a Fase 4.

## Fase 4 — Raid Scav

- Cooldown baseado em tempo real (relógio injetável), reduzível pelo esconderijo e pelo karma.
- Equipamento Scav aleatório gerado por tabelas.
- Chance de extração e qualidade/quantidade do loot modificadas pelo karma.
- Ao extrair, o loot é transferido para o estoque do esconderijo (precisa caber!).

## Fase 5 — Vendedores e economia

- 4–6 vendedores originais, cada um com especialidade (armas, meds, roupas/equipamentos, peças, barter).
- **Lealdade:** níveis baseados em nível do PMC, reputação e dinheiro gasto; liberam itens e melhores preços.
- Compra, venda (preço por vendedor/categoria) e trocas por barter.
- Estoque dos vendedores com restock periódico.
- Moedas: moeda principal + 1–2 moedas estrangeiras.

## Fase 6 — Quests

- Tipos de objetivo: entregar item, extrair de mapa X, eliminar N alvos, sobreviver com estratégia Y, encontrar item na raid ("found in raid").
- Pré-requisitos (nível, quest anterior, lealdade) e recompensas (dinheiro, itens, reputação, desbloqueios).
- **Cadeia principal de fuga** com o final do jogo.
- Tela de quests com acompanhamento de progresso.

## Fase 7 — Esconderijo

- Módulos com níveis e requisitos (itens, dinheiro, lealdade, outros módulos): estoque (aumenta a grade), enfermaria (cura entre raids), cozinha/água, gerador, oficina (crafting), estação de renda passiva, módulo que reduz o cooldown do scav.
- Produção/crafting com tempo real (continua com o jogo fechado — cálculo de progresso offline ao carregar o save).

## Fase 8 — Flea market

- Desbloqueado por nível do PMC.
- Preços dinâmicos (oferta/demanda simuladas, variação com o tempo, influência das vendas do jogador).
- Taxa de anúncio, listagem de itens do jogador com venda probabilística ao longo do tempo.
- Itens "found in raid" exigidos para vender certos itens.

## Fase 9 — Progressão idle e polimento

- Progresso offline (produção, cooldowns, vendas no flea).
- Raids automáticas em sequência com regras do jogador (ex.: "parar se vida < X", "usar loadout salvo").
- Loadouts salvos e "reequipar com um clique" comprando faltantes.
- Balanceamento (planilhas/simulações via testes de Monte Carlo com seed).
- Arte 2D (sprites de itens em escala de células), sons, animações, configurações, tutorial.

---

## Estratégia de testes

- **Core (`src/core`)**: testes unitários puros com Vitest; RNG e relógio injetados tornam tudo determinístico. Testes de propriedade para a grade (nenhuma célula ocupada duas vezes, itens sempre dentro dos limites).
- **UI (`src/ui`)**: lógica de interação (drag & drop, cálculo de célula sob o cursor, prévias) separada em funções puras testáveis; componentes PixiJS testados com o ambiente `jsdom` e PixiJS mockado onde necessário.
- **Simulação**: testes estatísticos com seed fixa para garantir que taxas de sobrevivência ficam dentro das faixas de balanceamento.
- Cobertura de 100% obrigatória no CI.

## Ordem sugerida das primeiras tarefas

1. Fase 0 completa.
2. `Grid` + testes (sem UI).
3. Itens e contêineres aninhados + testes.
4. UI da grade com drag & drop.
5. PMC + skills + save.
6. Primeira raid simulada ponta a ponta.
