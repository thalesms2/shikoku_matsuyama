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

## Fase 1 — Inventário em grade ("tetris") ✅

O coração do jogo; vem primeiro porque quase tudo depende dele.

- [x] **Modelo de item:** `ItemDef` (catálogo) + `Item` (instância com uid, quantidade, grades internas e localização). Tamanho `w×h`, `maxStack`, preço base, categoria, slot de equipamento.
- [x] **Grade (`Grid`):** ocupação por célula, `canPlace`, `place`, `remove`, `findFreeSpot` (com rotação), filtros por categoria.
- [x] **Operações:** mover entre grades e slots, girar, somar e separar pilhas, auto-encaixe (`autoPlace`), soltar sobre item (`dropOnItem`), organizar (`sortGrid`, que desfaz se não couber).
- [x] **Contêineres aninhados:** grades internas (mochila, colete com várias grades, caixa de munição, contêiner seguro); um contêiner nunca entra nele mesmo.
- [x] **Slots de equipamento:** arma primária/secundária, coldre, capacete, colete balístico, colete tático, mochila, contêiner seguro, 4 bolsos.
- [x] **UI PixiJS:** grade, drag & drop, prévia verde/vermelha, `R` para girar, `Esc` para cancelar, tooltip, botão "Organizar", janela de contêiner por duplo clique.
- [x] Catálogo inicial de itens originais (`src/data/items.ts`) e kit inicial (`src/data/starter.ts`).
- [ ] Pendências para fases futuras: durabilidade dos itens (Fase 2/3), mover item com Ctrl+clique (separar pilha já existe no menu de contexto), rolagem do estoque quando ele crescer (o Depósito da Fase 7 já aumenta o estoque; por enquanto a tela só reduz a escala), janela de contêiner arrastável.

**Pronto quando:** dá para mover, girar, empilhar e guardar itens entre estoque, mochila e equipamento.

## Fase 2 — Dados do jogo e PMC

### 2A — Base de dados local de itens (sincronizada da API tarkov.dev) ✅

**Estado:** pipeline completo e testado (`scripts/items/`, comando `npm run items`). O `sync` usa os dados JSON do tarkov.dev (a API GraphQL respondia 422) e já sincronizou a referência completa (5.498 itens). Os 24 itens do jogo estão ligados ao seu `sourceId` (só para a imagem placeholder; os outros campos continuam no override) e as imagens são baixadas com `items -- images`. Itens novos entram com o mesmo fluxo.

Decisões de implementação: SQLite nativo do Node (`node:sqlite`) no lugar de `better-sqlite3`, que dispensa compilação nativa; `tsx` para rodar os scripts; uma CLI única (`npm run items -- <comando>`) no lugar de vários scripts npm.

O jogo **nunca consulta a API durante a execução**. A API ([tarkov.dev](https://tarkov.dev), dados JSON em `https://json.tarkov.dev`: lista em `/endpoints`; o `sync` usa `GET /regular/items` e as traduções `GET /regular/items_en`) só é usada em desenvolvimento, por um script, para puxar itens novos ou atualizar dados. Tudo fica salvo no repositório.

- **Sincronização** `npm run items -- sync`: consulta a API, normaliza os dados e grava na base local. Roda só manualmente, nunca no build nem no CI.
  - Campos de referência: `width`/`height` em células, categoria/tipos, `basePrice`, limite de pilha, calibre, capacidade de carregador, dano/penetração da munição, classe/durabilidade de armadura, slots e grades de contêineres (`grids` de mochilas e coletes táticos).
  - O id externo (tarkov.dev) é guardado como `sourceId`, para correlacionar em sincronizações futuras sem duplicar itens.
- **Banco de dados:** SQLite (`data/items.db`, via `node:sqlite`, só em desenvolvimento, commitado) como fonte da verdade da curadoria:
  - `items`: id do jogo, `sourceId`, dados de referência vindos da API.
  - `item_overrides`: nome, nome curto, descrição e ajustes de balanceamento próprios do jogo (sobrescrevem a referência).
  - `item_assets`: correlação item ↔ imagem (`public/assets/items/<id>.webp`), com origem, licença e `status` (`placeholder` ou `final`).
  - `sync_runs`: histórico de sincronizações (data, itens novos, itens alterados).
- **Exportação para o jogo** `npm run items -- export`: gera `src/data/generated/items.json` (dados) a partir do banco. O jogo importa esse JSON no build; o navegador não precisa de SQLite.
- **Validação:** testes garantem que o JSON exportado é válido para o `Catalog` (tamanhos, pilhas, grades), que todo item tem imagem correlacionada (ou placeholder) e que nenhum id se repete. Testes do sync usam respostas da API gravadas como fixtures (sem rede nos testes).
- **Imagens:** o carregamento é por id (`assets/items/<id>.webp`, com um placeholder por categoria quando a imagem faltar); a `ItemView` desenha o sprite escalado para as células do item.
- **Imagens placeholder do tarkov.dev (temporárias):** `npm run items -- images` baixa a imagem de grade de cada item (`gridImageLink`, que já vem no tamanho certo em células) para `public/assets/items/`, registrada em `item_assets` com `source = "tarkov.dev"` e `status = "placeholder"`.
  - Ficam **fora do git** (`public/assets/items/` no `.gitignore`): cada desenvolvedor baixa localmente e elas não são redistribuídas pelo repositório.
  - Ao colocar uma arte própria em `public/assets/items/<id>.webp` e rodar `npm run items -- final <id>`, o item é marcado `status = "final"` e o download não a sobrescreve mais.
  - `npm run items -- placeholders` lista os itens que ainda usam placeholder.
- **Restrição de conteúdo** (ver "Direção criativa" no `CLAUDE.md`): da API vêm dados factuais e de balanceamento e, só durante o desenvolvimento, as imagens placeholder. **Nomes e descrições são próprios do jogo**, cadastrados em `item_overrides`; os textos do Escape from Tarkov não são copiados. Armas e calibres reais (ex.: 5.45x39, 9x19) podem usar a nomenclatura técnica real.

### 2B — Descrição dos itens no hover ✅

**Estado:** feito. Os 24 itens têm descrição própria (no banco, `item_overrides.description`). O atraso de 300 ms é uma opção da cena (`tooltipDelayMs`), com padrão 0 para manter o comportamento testado na Fase 1. Ficha de contêiner (células internas) já existia na linha de dados básicos.

- Campo `description` no `ItemDef`.
- Tooltip com atraso curto (~300 ms), mostrando: imagem, nome, descrição (com quebra de linha) e uma ficha conforme a categoria (munição: calibre, dano, penetração; arma: calibre, carregador; armadura: classe, durabilidade; contêiner: células internas; carregador: munição carregada/capacidade).
- O tooltip se reposiciona para não sair da tela.

### 2C — Carregadores e munição ✅

**Estado:** feito, com duas pendências: (1) a **câmara** da arma (um cartucho a mais fora do carregador) ainda não existe; (2) a escopeta M-12 usa tubo interno e ainda não tem como ser carregada; fica para quando a raid (Fase 3) consumir munição. Dados técnicos próprios (calibre, capacidade, dano, penetração) ficam em `item_overrides.stats` e são mesclados por cima dos da API. Itens novos: `mag_vk74` (30 × 5.45) e `mag_pk9` (12 × 9mm); a pistola inicial já vem com um carregador cheio.

- Nova categoria `magazine`: `capacity` e `caliber`; armas têm `caliber` e aceitam carregadores compatíveis.
- O carregador guarda a munição como uma **pilha ordenada de cartuchos** (`{ ammoDefId, count }[]`): munição de tipos diferentes fica na ordem em que foi carregada, e o último cartucho carregado é o primeiro a ser disparado.
- **Carregar:** soltar uma pilha de munição compatível sobre o carregador carrega até `capacity` (o resto continua na pilha). Calibre incompatível fica com a prévia vermelha.
- **Descarregar:** ação no carregador (menu de contexto ou atalho) que devolve a munição como pilhas para o inventário, usando `autoPlace`; se não couber, o que sobrar fica no carregador.
- **Tempo de carga:** carregar/descarregar leva tempo por cartucho (ex.: 0,5 s, reduzido pela skill "Manuseio de carregador"), feito de forma idle com barra de progresso; pode ser cancelado.
- **Arma ↔ carregador:** a arma tem um slot de carregador (a câmara fica para depois); arrastar o carregador para a arma (na grade ou equipada) o encaixa; "Remover carregador" no menu de contexto tira. Na raid (Fase 3), a munição disponível = carregadores na arma, no colete tático e nos bolsos; o tipo de cartucho usado afeta o combate.
- Valor do carregador = valor dele + valor da munição dentro dele.

### 2D — PMC, skills e save ✅

**Estado:** feito. PMC (`src/core/pmc/pmc.ts`), skills (`skills.ts`), consumíveis com "Usar" no menu (`consumables.ts`), tela de personagem (`CharacterScene`) e save versionado no `localStorage` com autosave (`src/core/save/`). Energia e hidratação ainda não caem com o tempo: o gasto vai acontecer nas raids (Fase 3), e a recuperação de vida no esconderijo fica para a enfermaria (Fase 7). XP do PMC também vem das raids.

- **PMC:** nível/XP, vida por parte do corpo (cabeça, tórax, estômago, braços, pernas), energia e hidratação.
- **Skills:** resistência, força, saúde, vitalidade, percepção, furtividade, mira, manuseio de carregador etc. Cada skill tem XP próprio e dá bônus pequenos e cumulativos.
- Kit inicial básico, montado a partir do catálogo gerado.
- **Save/load:** serialização versionada no `localStorage` com migrações (inclui `ItemFactory.nextId`, munição dentro dos carregadores e o estado de carregamentos em andamento).

## Fase 3 — Raid do PMC (simulação idle) ✅

**Estado:** feito. Núcleo em `src/core/raid/` (mapas e inimigos em `src/data/maps.ts`), telas `RaidSetupScene` e `RaidScene`, perfil de raid no save v2 (com migração). A raid é resolvida inteira ao entrar (seed salva no perfil) e o log é revelado em tempo real. Ficaram para depois: desgaste da armadura, armas sem carregador (escopeta), itens "encontrados na raid" (Fase 6) e equipamento real dos inimigos.

- **Mapas:** cada mapa com dificuldade, duração, tabela de loot, extrações (algumas com requisito: chave, pagamento, sem mochila) e tipos de ameaça.
- **Estratégias:** furtivo / equilibrado / agressivo — afetam encontros, loot e risco.
- **Simulação por eventos:** a raid é uma sequência de eventos sorteados (encontrar loot, encontro com IA, encontro com PMC inimigo, ferimento, extração). Cada combate é resolvido por fórmula com equipamento (penetração da munição × classe da armadura, durabilidade), skills e estratégia.
- **Loot durante a raid:** o loot só é guardado se couber na grade do equipamento (reutiliza o inventário da Fase 1). Regra automática configurável: priorizar valor por célula.
- **Resultado:** extraiu (mantém tudo + XP) / morreu (perde equipamento e loot, exceto o contêiner seguro; mantém XP de skills) / MIA (tempo esgotado = morte).
- **Tela de raid:** log de eventos em tempo real (com acelerar/pular) e tela de resumo pós-raid.
- **Karma:** comportamento acumulado do PMC (ex.: matar Scavs, ajudar, agressividade) registrado para a Fase 4.

## Fase 4 — Raid Scav ✅

**Estado:** feito. `src/core/raid/scav.ts` (equipamento sorteado por `src/data/scav.ts`, modificadores de karma na `RaidSimulation`, transferência para o estoque, cooldown em `player.scav`) e save v3 com migração. A entrada é o botão "Entrar como Scav" na tela de preparação. A redução do cooldown pelo esconderijo já tem o parâmetro (`cooldownReduction`) e espera a Fase 7.

- Cooldown baseado em tempo real (relógio injetável), reduzível pelo esconderijo e pelo karma.
- Equipamento Scav aleatório gerado por tabelas.
- Chance de extração e qualidade/quantidade do loot modificadas pelo karma.
- Ao extrair, o loot é transferido para o estoque do esconderijo (precisa caber!).

## Fase 5 — Vendedores e economia ✅

**Estado:** feito. `src/core/trade/` (compra com dinheiro ou troca, venda, lealdade em 3 níveis, reposição em tempo real), 4 vendedores em `src/data/traders.ts`, dólar e euro no pipeline de itens, `TradersScene` e save v4. A reputação por quest fica para a Fase 6.

- 4–6 vendedores originais, cada um com especialidade (armas, meds, roupas/equipamentos, peças, barter).
- **Lealdade:** níveis baseados em nível do PMC, reputação e dinheiro gasto; liberam itens e melhores preços.
- Compra, venda (preço por vendedor/categoria) e trocas por barter.
- Estoque dos vendedores com restock periódico.
- Moedas: moeda principal + 1–2 moedas estrangeiras.

## Fase 6 — Quests ✅

**Estado:** feito. `src/core/quests/` (requisitos, aceitar, entregar, concluir, progresso depois da raid do PMC), 10 quests em `src/data/quests.ts` (6 na cadeia da fuga), itens "encontrados na raid" (`item.fir`), oferta liberada por quest no Coronel, `QuestsScene`, `EndingScene` e save v5.

- Tipos de objetivo: entregar item, extrair de mapa X, eliminar N alvos, sobreviver com estratégia Y, encontrar item na raid ("found in raid").
- Pré-requisitos (nível, quest anterior, lealdade) e recompensas (dinheiro, itens, reputação, desbloqueios).
- **Cadeia principal de fuga** com o final do jogo.
- Tela de quests com acompanhamento de progresso.

## Fase 7 — Esconderijo ✅

**Estado:** feito. `src/core/hideout/` com 7 módulos (gerador, depósito, enfermaria, cozinha, oficina, central de informantes, posto de vigia), obras e produções em tempo real (inclusive offline, pelo `hideoutTick` ao carregar), renda passiva, corte do cooldown Scav, `HideoutScene` e save v6. Combustível do gerador e rolagem do estoque ficaram para depois.

- Módulos com níveis e requisitos (itens, dinheiro, lealdade, outros módulos): estoque (aumenta a grade), enfermaria (cura entre raids), cozinha/água, gerador, oficina (crafting), estação de renda passiva, módulo que reduz o cooldown do scav.
- Produção/crafting com tempo real (continua com o jogo fechado — cálculo de progresso offline ao carregar o save).

## Fase 8 — Flea market ✅

- Desbloqueado por nível do PMC.
- Preços dinâmicos (oferta/demanda simuladas, variação com o tempo, influência das vendas do jogador).
- Taxa de anúncio, listagem de itens do jogador com venda probabilística ao longo do tempo.
- Itens "found in raid" exigidos para vender certos itens.

## Fase 9 — Progressão idle e polimento ✅ (menos arte e sons próprios)

Dividida em sub-fases (uma por commit): 9A resumo do tempo fora ✅, 9B loadouts salvos e reequipar com um clique ✅, 9C raids automáticas em sequência ✅, 9D configurações, tutorial e animações ✅. Arte e sons próprios ficam para quando houver os arquivos.

- Progresso offline (produção, cooldowns, vendas no flea).
- Raids automáticas em sequência com regras do jogador (ex.: "parar se vida < X", "usar loadout salvo").
- Loadouts salvos e "reequipar com um clique" comprando faltantes.
- Balanceamento (planilhas/simulações via testes de Monte Carlo com seed).
- Arte 2D (sprites de itens em escala de células), sons, animações, configurações, tutorial.

## Fase 10 — Pendências de jogo ✅

Uma sub-fase por commit:

- ✅ **10A — Durabilidade da armadura:** colete e capacete se desgastam com os acertos, protegem menos quando gastos, valem menos e podem ser reparados por um vendedor.
- ✅ **10B — Cirurgia na raid:** parte do corpo destruída só volta com um item de kit cirúrgico (nome próprio), usado **durante a raid**. A cirurgia leva tempo e dá uma chance de encontro surpresa enquanto o PMC está vulnerável; as skills do PMC aumentam a chance de sobreviver ao encontro e de abater o inimigo. Substitui a "cirurgia de campo provisória" ao extrair. A Enfermaria nível 2 também opera, devagar.
- ✅ **10C — Câmara da arma e escopeta:** cartucho na câmara e armas sem carregador (tubo interno).
- ✅ **10D — Inimigos com equipamento de verdade:** arma, munição e armadura dos inimigos vêm de itens do catálogo, e o corpo revistado pode deixar esses itens.
- ✅ **10E — Quests no resumo da raid:** mostrar as quests que avançaram.
- ✅ **10F — Rolagem do estoque grande:** o inventário rola em vez de só diminuir a escala.

---

## Estratégia de testes

- **Scripts de dados (`scripts/`)**: testados com fixtures das respostas da API e um banco SQLite em memória; nenhum teste acessa a rede.

- **Core (`src/core`)**: testes unitários puros com Vitest; RNG e relógio injetados tornam tudo determinístico. Testes de propriedade para a grade (nenhuma célula ocupada duas vezes, itens sempre dentro dos limites).
- **UI (`src/ui`)**: lógica de interação (drag & drop, cálculo de célula sob o cursor, prévias) separada em funções puras testáveis; componentes PixiJS testados com o ambiente `jsdom` e PixiJS mockado onde necessário.
- **Simulação**: testes estatísticos com seed fixa para garantir que taxas de sobrevivência ficam dentro das faixas de balanceamento.
- Cobertura de 100% obrigatória no CI.

## Ordem sugerida das primeiras tarefas

1. Fase 0 completa.
2. `Grid` + testes (sem UI).
3. Itens e contêineres aninhados + testes.
4. UI da grade com drag & drop.
5. ✅ Base de dados local de itens (2A) e tooltip com descrição (2B).
6. ✅ Carregadores e munição (2C).
7. ✅ PMC + skills + save (2D).
8. ✅ Primeira raid simulada ponta a ponta (Fase 3).
9. ✅ Raid Scav (Fase 4).
10. ✅ Vendedores e economia (Fase 5).
11. ✅ Quests e final do jogo (Fase 6).
12. ✅ Esconderijo (Fase 7).
13. ✅ Flea market (Fase 8).
14. ✅ Resumo do tempo fora (Fase 9A).
15. ✅ Loadouts (Fase 9B).
16. ✅ Raids automáticas (Fase 9C).
17. ✅ Configurações, tutorial e animações (Fase 9D).
18. ✅ Durabilidade da armadura (Fase 10A).
19. ✅ Cirurgia na raid e na enfermaria (Fase 10B).
20. ✅ Câmara da arma e escopeta com tubo interno (Fase 10C).
21. ✅ Inimigos com equipamento de verdade (Fase 10D).
22. ✅ Quests que avançaram no resumo da raid (Fase 10E).
23. ✅ Rolagem do estoque grande (Fase 10F).
