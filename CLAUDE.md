# Escape from Idle

## Descrição do jogo

**Escape from Idle** é um RPG idle 2D de extração, feito com **PixiJS**, inspirado no gênero de _extraction shooters_ (como Escape from Tarkov).

O jogador gerencia seu **PMC** (o personagem principal), preso em uma cidade isolada e em guerra. O objetivo final é completar a cadeia de quests que libera a fuga da cidade.

### Ciclo principal

1. **Preparação** — no esconderijo, o jogador escolhe o equipamento do PMC (arma, munição, armadura, capacete, colete tático, mochila, consumíveis) e uma estratégia de raid (ex.: furtivo, equilibrado, agressivo).
2. **Raid** — a raid é resolvida de forma idle/simulada: a chance de sobreviver, o loot encontrado e os eventos dependem do equipamento, das skills do PMC, do mapa e das escolhas feitas.
3. **Resultado**
   - **Extraiu:** mantém o equipamento, o loot coletado, ganha XP de personagem e de skills e avança quests.
   - **Morreu:** perde **tudo** que levou e tudo que coletou na raid. Só mantém o XP ganho nas skills (resistência, força, saúde, etc.).

### Raid Scav

- Raid com um personagem descartável (Scav) que entra com equipamento aleatório e não arrisca nada do PMC.
- Tem **cooldown** — só pode ser feita de tempos em tempos.
- O **karma** (comportamento padrão do jogador nas raids do PMC) altera a chance de extração e a quantidade/qualidade do loot da raid scav.

### Sistemas de meta-jogo

- **Esconderijo (hideout):** base do jogador. Módulos podem ser construídos/melhorados (estoque maior, geração passiva de recursos, crafting, cura, redução de cooldown do scav).
- **Vendedores:** compram e vendem itens e dão quests. Cada vendedor tem **níveis de lealdade** que liberam itens melhores e preços menores.
- **Quests:** missões dos vendedores que dão recompensas e lealdade; a cadeia principal leva à fuga.
- **Flea market (mercado):** mercado entre jogadores simulado, com preços dinâmicos e nível mínimo para acesso.
- **Inventário em grade ("tetris"):** todos os itens ocupam um retângulo de células (ex.: 1x1, 2x1, 3x2), podem ser girados e precisam caber nos contêineres (estoque do esconderijo, mochila, colete, bolsos, contêineres internos). Organizar o espaço é parte central do jogo.

### Direção criativa

- O jogo é **original**: nomes de vendedores, mapas, cidade, facções e itens devem ser próprios — não usar nomes, personagens, arte ou marcas de Escape from Tarkov. Apenas as mecânicas do gênero servem de inspiração.

## Stack técnica

- **Linguagem:** TypeScript (strict)
- **Renderização:** PixiJS v8 (+ `@pixi/ui`, `@pixi/sound`, `pixi-filters`, GSAP)
- **Build/dev server:** Vite (o plugin `colyseus/vite` sobe o servidor junto, na porta 8080)
- **Servidor:** Colyseus em `server/` (vindo do template; mantido para uso futuro)
- **Testes:** Vitest (+ cobertura via `@vitest/coverage-v8`), config em `vitest.config.ts`
- **Lint/formatação:** oxlint + oxfmt
- **Persistência:** `localStorage` (save versionado com migrações)

## Arquitetura

- `src/core/` — **lógica pura do jogo**, sem dependência de PixiJS ou DOM (inventário, raid, skills, economia, quests, save). Determinística: toda aleatoriedade passa por um RNG com seed injetável.
- `src/data/` — definições estáticas (itens, mapas, vendedores, quests, módulos do esconderijo).
- `src/ui/` — telas e componentes PixiJS; apenas leem estado e disparam ações do core.
- `src/game.ts` — `startGame()`: inicia o PixiJS, carrega assets e mostra a primeira cena. `src/main.ts` só chama `startGame`.
- `src/ui/SceneManager.ts` — troca de cenas; toda tela implementa a interface `Scene` (`view`, `resize?`, `update?`, `destroy?`).
- `src/core/rng.ts`, `src/core/events.ts`, `src/core/clock.ts` — `Rng` com seed, `EventBus` tipado e `Clock` injetável (use `ManualClock` nos testes).
- `server/` — servidor Colyseus (sala `game`).
- `tests/` — espelha a estrutura de `src/` e `server/`. Testes que usam PixiJS rodam com `// @vitest-environment jsdom` no topo; a `Application` deve ser mockada (o jsdom não tem WebGL).

### Armadilhas conhecidas nos testes

- Não devolva valor em `beforeEach`/`beforeAll` (ex.: `beforeEach(() => mock.mockReset())`): o Vitest trata a função retornada como teardown e a executa depois do teste. Use chaves: `beforeEach(() => { mock.mockReset(); })`.
- Variáveis usadas dentro de `vi.mock(...)` precisam vir de `vi.hoisted(...)`.

Veja o plano completo em [`PLANO.md`](./PLANO.md).

## Regras obrigatórias para o agente

1. **Todo o código deve estar coberto por testes.** Nenhuma funcionalidade nova ou alteração entra sem testes que a cubram. A cobertura mínima é **100%** de linhas, funções, branches e statements, aplicada via `thresholds` do Vitest — `npm run test:coverage` deve passar antes de considerar uma tarefa concluída.
2. **O agente não deve modificar testes pré-existentes.** Testes que já existiam no repositório antes da tarefa não podem ser editados, renomeados nem removidos. Novos testes podem ser adicionados. Se um teste existente parecer errado ou conflitar com uma mudança pedida, pare e pergunte ao usuário.
3. **Toda adição de mecânica deve ser registrada neste arquivo**, na seção [Mecânicas implementadas](#mecânicas-implementadas), com uma descrição curta das regras e fórmulas.
4. **Toda adição de mecânica também deve ser documentada no `README.md`**, na seção de mecânicas, em linguagem voltada ao jogador.
5. Lógica de jogo fica em `src/core/` e não importa PixiJS — isso mantém tudo testável.
6. Aleatoriedade sempre via RNG injetável com seed (nunca `Math.random()` direto no core).
7. Mudanças no formato do save exigem incremento de versão e migração testada.

## Comandos

- `npm run dev` — servidor de desenvolvimento (cliente + servidor Colyseus)
- `npm run build` — lint + tipos + build de produção
- `npm test` — roda os testes
- `npm run test:coverage` — testes com verificação de cobertura (deve passar)
- `npm run lint` — oxlint
- `npm run typecheck` — checagem de tipos
- `npm run format` / `npm run format:check` — oxfmt

Antes de concluir qualquer tarefa: `npm run lint && npm run typecheck && npm run format:check && npm run test:coverage`.

## Mecânicas implementadas

Modelo de entrada para novas mecânicas:

```
### Nome da mecânica
- Arquivos: src/core/...
- Regras: ...
- Fórmulas/valores: ...
```

### Inventário em grade ("tetris")

- Arquivos: `src/core/inventory/` (`item.ts`, `size.ts`, `grid.ts`, `equipment.ts`, `operations.ts`), `src/data/items.ts`, `src/data/starter.ts`, UI em `src/ui/inventory/` e `src/ui/scenes/InventoryScene.ts`.
- **Itens:** `ItemDef` (estático, no `Catalog`) + `Item` (instância com `uid`, `count`, `grids`, `location`). `ItemFactory` gera uids sequenciais `i1, i2, ...` (`nextId` deve ir para o save). Tamanho `width×height` em células; `maxStack` padrão 1.
- **Grade (`Grid`):** retângulo de células; cada item ocupa `w×h` (trocados quando `rotated`). Um item só pode ser colocado se estiver solto (`location === null`), dentro dos limites, sem sobrepor outro item e aceito pelo filtro da grade (`allow`/`deny` por categoria). `findFreeSpot` varre linha a linha, de cima para baixo e da esquerda para a direita, tentando sem rotação e depois rotacionado.
- **Contêineres:** itens com `grids` (mochila, colete tático, caixa, contêiner seguro). Um contêiner nunca entra nele mesmo nem em uma grade que está dentro dele (checagem subindo pela cadeia `grid.owner → owner.location.grid`).
- **Equipamento:** slots `primary`/`secondary` (`longWeapon`), `holster` (`pistol`), `helmet`, `armor`, `rig`, `backpack`, `secure`. Um slot aceita só itens com o `equipSlot` correspondente e só um item por vez. 4 bolsos 1x1. `carryGrids()` = bolsos + colete tático + mochila (o contêiner seguro fica de fora, porque é o que sobrevive à morte).
- **Operações:** `moveToGrid`/`moveToSlot` não mudam nada se o destino for inválido. `mergeStack` move `min(origem, maxStack − destino)`; se a origem esvaziar, ela é removida. `splitStack(item, n)` exige `1 ≤ n < count`. `autoPlace` completa pilhas iguais primeiro e depois usa o primeiro espaço livre nas grades, na ordem dada. `dropOnItem`: se for pilha igual, soma; se o alvo for um contêiner, guarda dentro dele.
- **Organizar (`sortGrid`):** recoloca os itens por área (maior primeiro), depois por categoria, nome e quantidade (maior primeiro). Se não couber tudo, a grade volta exatamente como estava e a função devolve `false`.
- **Valor:** `totalValue` = `basePrice × count` + valor de tudo que está dentro do item, recursivamente.
- **UI:** arrastar com o botão esquerdo; prévia verde/vermelha; `R` gira durante o arraste; `Esc` cancela; soltar sobre uma pilha igual soma; soltar sobre um contêiner guarda dentro dele; duplo clique (≤ 350 ms) abre a janela do contêiner; o tooltip mostra nome, tamanho, categoria, quantidade e valor; o botão "Organizar" ordena o estoque. Soltar no mesmo lugar não conta como mudança (senão a view é recriada e o clique se perde).
- **Estoque inicial:** 10x14, com o kit de `src/data/starter.ts`.
