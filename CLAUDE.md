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
- A API do tarkov.dev pode ser usada **só em desenvolvimento** e **só para dados factuais e de balanceamento** (tamanho em células, pilha, calibre, capacidade, dano, penetração, preço de referência). Nomes e descrições dos itens são próprios (os textos do Escape from Tarkov não entram no projeto).
- As imagens dos itens do tarkov.dev podem ser usadas **só como placeholder temporário em desenvolvimento**: ficam fora do git (`public/assets/items/` no `.gitignore`), são marcadas `status = "placeholder"` no banco e serão todas substituídas por arte própria.
- O jogo **nunca acessa a API em execução**: os dados ficam no banco local (`data/items.db`, SQLite) e são exportados para `src/data/generated/items.json`. Veja a Fase 2A do `PLANO.md`.

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
- `src/core/state.ts` — `PlayerState` (inventário, PMC, skills, `ItemFactory`, `MagazineLoader`, o perfil de raid `raid` e o perfil Scav `scav`): tudo que vai para o save. `storageFor()` decide onde guardar o que sai de um item.
- `src/core/pmc/` — PMC, skills e consumíveis. `src/core/save/` — formato, serialização, migrações e armazenamento do save.
- `src/core/raid/` — raid do PMC: tipos (`types.ts`), estratégias e karma (`strategy.ts`), fórmulas de combate (`combat.ts`), loot (`loot.ts`), simulação (`simulate.ts`, classe `RaidSimulation`) e perfil/reprodução (`profile.ts`) e raid Scav (`scav.ts`). Mapas e inimigos ficam em `src/data/maps.ts`; o equipamento do Scav, em `src/data/scav.ts`.
- `src/data/newGame.ts` — `createNewPlayer()` e `loadOrCreatePlayer()`.
- `src/core/rng.ts`, `src/core/events.ts`, `src/core/clock.ts` — `Rng` com seed, `EventBus` tipado e `Clock` injetável (use `ManualClock` nos testes).
- `server/` — servidor Colyseus (sala `game`).
- `scripts/items/` — pipeline de dados de itens, que só roda em desenvolvimento (`npm run items -- <comando>`, via `tsx`): dados JSON do tarkov.dev (`https://json.tarkov.dev/regular/items` + traduções `/regular/items_en`; índice em `/endpoints`) → banco SQLite `data/items.db` (`node:sqlite`, commitado) → `src/data/generated/items.json` (commitado, importado por `src/data/items.ts`). As imagens ficam em `public/assets/items/<id>.webp`, fora do git.
- `tests/` — espelha a estrutura de `src/` e `server/`. Testes que usam PixiJS rodam com `// @vitest-environment jsdom` no topo; a `Application` deve ser mockada (o jsdom não tem WebGL).

### Armadilhas conhecidas nos testes

- Não devolva valor em `beforeEach`/`beforeAll` (ex.: `beforeEach(() => mock.mockReset())`): o Vitest trata a função retornada como teardown e a executa depois do teste. Use chaves: `beforeEach(() => { mock.mockReset(); })`.
- Variáveis usadas dentro de `vi.mock(...)` precisam vir de `vi.hoisted(...)`.
- Não importe helpers de um arquivo `*.test.ts` em outro: os testes do arquivo importado rodam de novo. Coloque fixtures compartilhadas em arquivos sem `.test` (ex.: `tests/core/inventory/magFixtures.ts`).
- Para testar a simulação da raid passo a passo, use `ScriptRng` (`tests/core/raid/raidFixtures.ts`): filas de respostas para `chance`, `int`, `pick` e `weighted`, consumidas na ordem em que a simulação chama o RNG.
- `view.emit(...)` do Pixi não propaga o evento para os pais; para testar handlers no container pai (ex.: fechar o menu de contexto), emita o evento no pai com o `target` desejado.

Veja o plano completo em [`PLANO.md`](./PLANO.md).

## Regras obrigatórias para o agente

1. **Todo o código deve estar coberto por testes.** Nenhuma funcionalidade nova ou alteração entra sem testes que a cubram. A cobertura mínima é **100%** de linhas, funções, branches e statements, aplicada via `thresholds` do Vitest — `npm run test:coverage` deve passar antes de considerar uma tarefa concluída.
2. **O agente não deve modificar testes pré-existentes.** Testes que já existiam no repositório antes da tarefa não podem ser editados, renomeados nem removidos. Novos testes podem ser adicionados. Se um teste existente parecer errado ou conflitar com uma mudança pedida, pare e pergunte ao usuário.
3. **Toda adição de mecânica deve ser registrada neste arquivo**, na seção [Mecânicas implementadas](#mecânicas-implementadas), com uma descrição curta das regras e fórmulas.
4. **Toda adição de mecânica também deve ser documentada no `README.md`**, na seção de mecânicas, em linguagem voltada ao jogador.
5. Lógica de jogo fica em `src/core/` e não importa PixiJS — isso mantém tudo testável.
6. Aleatoriedade sempre via RNG injetável com seed (nunca `Math.random()` direto no core).
7. Mudanças no formato do save exigem incremento de versão e migração testada.

## Base de dados de itens

- **Nunca edite `src/data/generated/items.json` à mão.** Altere o banco com `npm run items -- override <id> ...` (ou `import <arquivo.json>`) e rode `npm run items -- export`.
- Fluxo para trazer um item da API: `items -- sync` → `items -- search <termo>` (acha o `sourceId`) → `items -- override <id-do-jogo> --source <sourceId> --name "..." --short "..."` → `items -- images` → `items -- export`.
- Campos definidos no override têm prioridade sobre a API; `--clear width,height` volta a usar a referência.
- No `/items`, `name`/`shortName`/`description` são chaves de tradução (`"<id> Name"`), resolvidas com `/items_en`; a categoria é o primeiro id de `categories`, buscado em `itemCategories`. `fetchApiItems` normaliza tudo para `ApiItem`, que o resto do pipeline usa.
- `capacity` da fonte só vale para itens sem grade (carregadores); em contêineres ela é o total de células e é ignorada (`toReference`). Mudou a conversão? Rode `items -- sync` de novo, porque o banco guarda a referência já convertida.
- Os 24 itens do jogo estão ligados a um `sourceId` só para a imagem placeholder: todos os outros campos vêm do override (nenhum `--clear`), então ligar um item não muda o balanceamento.
- Os testes dos scripts usam respostas da API gravadas (`tests/scripts/items/fixtures.ts`, convertidas para o formato JSON por `tarkovFixtures.ts`) e bancos em memória ou temporários; nenhum teste acessa a rede.

## Comandos

- `npm run dev` — servidor de desenvolvimento (cliente + servidor Colyseus)
- `npm run build` — lint + tipos + build de produção
- `npm test` — roda os testes
- `npm run test:coverage` — testes com verificação de cobertura (deve passar)
- `npm run lint` — oxlint
- `npm run typecheck` — checagem de tipos
- `npm run format` / `npm run format:check` — oxfmt
- `npm run items -- help` — comandos da base de dados de itens (sync, search, show, override, import, images, final, placeholders, export)

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
- **UI:** arrastar com o botão esquerdo; prévia verde/vermelha; `R` gira durante o arraste; `Esc` cancela; soltar sobre uma pilha igual soma; soltar sobre um contêiner guarda dentro dele; duplo clique (≤ 350 ms) abre a janela do contêiner; o botão "Organizar" ordena o estoque. Soltar no mesmo lugar não conta como mudança (senão a view é recriada e o clique se perde).
- **Menu de contexto (botão direito):** `src/ui/inventory/actions.ts` monta as opções por item: "Abrir" (contêiner), "Descarregar"/"Cancelar carregamento" (carregador), "Remover carregador" (arma), "Separar pilha pela metade" (pilhas; a metade vai para o primeiro espaço livre de `storageFor`, ou volta para a pilha se não couber). `storageFor(item)` = grade do item, depois `carryGrids()`, depois o estoque, sem repetir. O menu do navegador é bloqueado no canvas.
- **Estoque inicial:** 10x14, com o kit de `src/data/starter.ts`.

### Descrição e ficha no hover (tooltip)

- Arquivos: `src/ui/inventory/Tooltip.ts`, `ItemDef.description`, `ItemDef.stats`.
- Mostra: imagem (se houver textura, até 96px de altura), linhas básicas (`describeItem`: nome, tamanho, categoria, quantidade, valor, células de contêiner), ficha técnica (`itemSheet`: calibre, dano, penetração, classe, durabilidade, capacidade + `ammoSheet`) e a descrição em itálico.
- A quebra de linha da descrição é calculada por `wrapText` (36 caracteres por linha), sem medir texto no canvas, para a altura ser conhecida e testável.
- **Reposicionamento:** fica 16px abaixo e à direita do ponteiro; se passar da borda direita da área visível, abre à esquerda do ponteiro; se passar da borda de baixo, sobe até caber; nunca sai pela esquerda nem por cima (`InventoryScene.visibleBounds()`).
- **Atraso:** `InventoryScene` aceita `tooltipDelayMs` (o jogo usa 300 ms; padrão 0). Sair do item ou começar a arrastar cancela o tooltip pendente.
- `formatCaliber` converte o calibre da fonte (`Caliber545x39`) para o nome legível (`5.45x39`).

### Carregadores e munição

- Arquivos: `src/core/inventory/magazine.ts`, `src/core/inventory/loading.ts`; UI em `DragController`, `ItemView`, `Tooltip`, `actions.ts` e `InventoryScene`.
- **Modelo:** categoria `magazine` com `stats.caliber` e `stats.capacity`; armas têm `stats.caliber` e o campo `magazine` (carregador encaixado, com `location = { kind: "weapon", weapon }`). O carregador guarda `rounds: { def, count }[]`: tipos diferentes ficam em sequência na ordem carregada; o **último é o topo** (próximo a disparar, primeiro a sair ao descarregar).
- **Compatibilidade:** munição ↔ carregador e carregador ↔ arma exigem o mesmo `stats.caliber`. Uma arma aceita um carregador por vez.
- **Carregar** (`loadRounds`): move `min(máx. pedido, pilha, espaço livre)` cartuchos; junta com o topo se for o mesmo tipo; pilha vazia sai de onde estava.
- **Descarregar** (`unloadRounds`): tira do topo e guarda com `autoPlace` (completa pilhas iguais primeiro); para quando não couber, e o resto fica no carregador.
- **Tempo** (`MagazineLoader`): `MS_PER_ROUND = 500` ms por cartucho (configurável, para a skill de manuseio de carregador na 2D). O progresso é calculado pelo relógio (`Clock`): cartuchos devidos = `floor((agora − início) / msPorCartucho) − feitos`, então recupera atraso de uma vez (idle/offline). Termina sozinho quando acaba a munição, enche o carregador ou não há espaço para descarregar; `start` substitui o trabalho anterior; `cancel` para.
- **Interface:** soltar munição sobre carregador inicia o carregamento (prévia vermelha se o calibre não bater ou estiver cheio); soltar carregador sobre arma (na grade ou equipada no slot) encaixa; carregadores e armas mostram `carregados/capacidade` no canto; barra de progresso na view do carregador durante o trabalho; tooltip lista a munição do topo para baixo ou o carregador da arma.
- **Valor:** `totalValue` inclui os cartuchos (`basePrice × count`) e o carregador encaixado na arma.
- Pendências: câmara da arma e carregamento da escopeta (tubo interno).

### PMC

- Arquivos: `src/core/pmc/pmc.ts`; tela em `src/ui/scenes/CharacterScene.ts` (botão "Personagem" no inventário).
- **Vida por parte do corpo** (máx.): cabeça 35, tórax 85, estômago 70, braços 60, pernas 65 (total 440). Cabeça ou tórax em 0 = morte.
- **Dano** (`damage`): tira da parte atingida, sem passar de 0 (o excesso se perde). Dano em parte já destruída (não vital) se espalha: `dano × 0,7` dividido igualmente entre as partes vivas. Morto não recebe dano.
- **Cura** (`heal`): distribui os pontos pelas partes mais feridas primeiro (menor `vida/máx.`; em empate, vitais primeiro); não cura partes destruídas (`restorePart` volta uma parte destruída para 1 PV, para a cirurgia futura).
- **Energia e hidratação:** 0 a 100, mudadas por `changeEnergy`/`changeHydration`. Só caem durante a raid (veja Raid do PMC).
- **Nível:** XP acumulado para o nível `n` = `1000 × n(n−1)/2` (nível 2 = 1000, nível 3 = 3000...), máximo 60.

### Skills

- Arquivos: `src/core/pmc/skills.ts`.
- Skills: Resistência, Força, Saúde, Vitalidade, Metabolismo, Percepção, Furtividade, Mira, Manuseio de carregador.
- XP acumulado para o nível `n` = `10 × n(n+1)/2` (nível 1 = 10, nível 2 = 30...), máximo 51. Bônus = `1% × nível`, limitado a 50%.
- Efeitos: **Saúde** (+bônus na cura de remédios), **Metabolismo** (+bônus em energia/hidratação de comida e bebida; gasto de hidratação na raid × (1 − bônus)), **Manuseio de carregador** (tempo por cartucho = `500 ms × (1 − bônus)`), **Mira**, **Percepção**, **Furtividade**, **Vitalidade** e **Resistência** na raid (fórmulas em Raid do PMC). **Força** só ganha XP por enquanto.
- XP: +5 em Saúde por remédio usado; +5 em Metabolismo por comida/bebida; +0,5 em Manuseio de carregador por cartucho carregado/descarregado (só quando a cena tem o `PlayerState`, e na raid ao completar carregadores). XP de raid em Raid do PMC.

### Consumíveis

- Arquivos: `src/core/pmc/consumables.ts`; opção "Usar" no menu de contexto (só com `PlayerState`).
- Consumível = categoria `medical` ou `food` com `stats.heal`, `stats.energy` ou `stats.hydration`. Cada uso consome 1 unidade (o item some quando a pilha acaba).
- Valores atuais: kit de primeiros socorros cura 120; atadura cura 15; lata de carne +45 energia / −5 hidratação; água +60 hidratação.

### Save

- Arquivos: `src/core/save/` (`format.ts`, `serialize.ts`, `migrations.ts`, `storage.ts`); integração em `src/game.ts` e `src/data/newGame.ts`.
- **Formato** (`SAVE_VERSION = 3`): `nextId` da fábrica, estoque (itens com posição/rotação), slots e bolsos, conteúdo aninhado (grades, cartuchos do carregador do fundo ao topo, carregador encaixado na arma), PMC, skills, o carregamento em andamento (por uid, com `startedAt`/`done`, então continua de onde parou) e, desde a v2, o perfil de raid (`raid`: karma, estatísticas, regra de loot, seed e a raid em andamento com log e resumo) e, desde a v3, o perfil Scav (`scav`: `readyAt` e estatísticas).
- **Migração 1 → 2:** adiciona `raid = createRaidProfile(savedAt)`. Ao carregar, campos do perfil que faltam voltam ao padrão e `lootRule` inválida vira `valuePerCell`.
- **Migração 2 → 3:** adiciona `scav = createScavProfile()` (liberada). Ao carregar, `readyAt` inválido vira 0 e estatísticas que faltam voltam a 0.
- **Carregar save antigo/inconsistente:** item que saiu do catálogo é descartado com aviso; item que não cabe mais na posição vai para o primeiro espaço da mesma grade; se não couber nela (ou a grade não existir mais, ou o slot não aceitar mais o item, ou o carregador ficar incompatível), vai para o estoque; sem espaço no estoque, é perdido com aviso. Campos de PMC/skills que faltam recebem o valor padrão (skills novas começam em 0).
- **Migrações:** `migrate()` aplica `MIGRATIONS[v]` de versão em versão até `SAVE_VERSION`; save sem versão, de versão mais nova ou com migração faltando lança `SaveError`.
- **Armazenamento:** chave `escape-from-idle:save` no `localStorage`; erros do navegador são ignorados. Autosave a cada 5 s de jogo e no `beforeunload`. Save ilegível é copiado para `escape-from-idle:save:backup` e o jogo começa do zero (com aviso no console).

- **Imagens dos itens:** `loadItemTextures` carrega a `image` de cada `ItemDef` no início do jogo (`src/ui/inventory/textures.ts`). Se a textura existir, a `ItemView` desenha o sprite do tamanho das células (girado 90° quando o item está rotacionado); se o arquivo faltar, o item continua sendo um retângulo colorido pela categoria.

### Raid do PMC

- Arquivos: `src/core/raid/` (`types.ts`, `strategy.ts`, `combat.ts`, `loot.ts`, `simulate.ts`, `profile.ts`), dados em `src/data/maps.ts`; telas `src/ui/scenes/RaidSetupScene.ts` (preparação, botão "Raid" no inventário) e `src/ui/scenes/RaidScene.ts` (log e resumo).
- **Resolução:** `startRaid` resolve a raid inteira na hora com `new Rng(raid.seed)`, aplica o resultado ao `PlayerState`, sorteia a próxima seed (`floor(rng.next() × 2³²)`), atualiza karma/estatísticas e guarda `raid.active = { startedAt, events, summary }`. O jogo salva logo em seguida (recarregar não refaz o sorteio). A `RaidScene` só revela o log: minuto mostrado = `(agora − startedAt) / 2000 ms` (velocidades x1/x4/x16 e "Pular"); fechar o resumo chama `finishRaid` (`active = null`). Com uma raid ativa no save, o título leva direto para a `RaidScene`.
- **Mapas** (`MapDef`): dificuldade 1–5, duração em minutos, pesos de ameaça `{scav, pmc}`, tabela de loot (`item`, `weight`, `min`/`max`, limitada à pilha máxima) e extrações (`risk` = chance de tocaia; requisitos `key`, `payment` ou `noBackpack`; ao menos uma livre). Periferia Norte (1, 30 min), Cimenteira (2, 25 min), Porto Velho (3, 40 min).
- **Inimigos** (`EnemyDef`): Scav (110 PV, precisão 0,28, dano 42, pen. 15, classe 0/0/1/2, 2 disparos) e PMC (160 PV, 0,42, 48, pen. 30, classe 2/3/4, 3 disparos).
- **Estratégias** (`STRATEGIES`): multiplicadores de encontro/loot, chance de evitar briga, iniciativa, chance de revistar o corpo, ritmo e faixa da extração. Furtivo 0,6/0,75, evita 50%, +15% iniciativa, revista 40%, ritmo 1,25, extração em 50–72% do tempo. Equilibrado 1/1, 20%, 0, 60%, 1, 45–72%. Agressivo 1,6/1,4, 0%, +5%, 85%, 0,85, 45–75%.
- **Passos:** cada passo dura `int(2, 5) × ritmo × (1 + 0,25 × pernas destruídas)` minutos. A cada minuto, a energia cai `0,15 × (1 − Resistência)` e a hidratação `0,2 × (1 − Metabolismo)`. Com energia ou hidratação em 0, o estômago perde 0,6/min. Depois: morto → `killed`; passou da duração → `mia`; passou do momento da extração → tenta extrair; senão sorteia um evento com pesos loot `4 × estratégia × (1 + Percepção)`, Scav/PMC `ameaça × encontro`, perigo 0,4 e tranquilo 2,5.
- **Combate:**
  - Evitar = `avoid + Furtividade/2` (karma +0,1, +4 XP de Furtividade).
  - Atira primeiro = `min(0,9; 0,5 + iniciativa + Percepção/2)`.
  - Até 6 trocas de tiro (0,5 min cada); depois disso o inimigo recua.
  - Disparos por troca: 1 com calibre 12, 3 com arma longa, 2 com pistola, cada um tirando um cartucho do topo do carregador.
  - Acerto do PMC = `0,5 × (1 + Mira) − 0,15 × braços destruídos`, limitado a 5–95%. Acerto do inimigo = `precisão + 0,03 × (dificuldade − 1)`.
  - Dano = `dano × armorFactor(pen, classe)`, com `armorFactor` = 1 se `pen ≥ classe × 10`, senão `max(0,2; pen / (classe × 10))`. O inimigo acerta as partes por peso (cabeça 10, tórax 30, estômago 15, braços 10, pernas 12,5); capacete protege a cabeça, colete o tórax e o estômago. Dano recebido × `(1 − Vitalidade/2)`.
  - Arma vazia: troca pelo carregador carregado do equipamento (o vazio vai para o lugar dele, se couber), gastando o turno. Sem munição: foge com 40% de chance.
  - Ao vencer: abate, karma, revista com a chance da estratégia (1 item da tabela). Depois de cada briga: cuidados e completar carregadores com a munição solta do equipamento.
- **Cuidados automáticos:** enquanto houver parte curável e (vida total < 60% ou cabeça/tórax < 60%), usa o remédio com mais cura do equipamento. Energia ou hidratação < 35: come ou bebe o item com mais do stat. Perigos tiram 8–25 de uma parte (pernas, braços ou tronco).
- **Loot** (`stashLoot`): `autoPlace` nas grades do equipamento e por último no contêiner seguro. Se não couber e a regra for `valuePerCell`, larga o loot desta raid de menor valor por célula (menor que o do item novo), do mais barato para o mais caro, até caber; o que foi tirado sem necessidade volta para o lugar; se nem assim couber, nada muda. O equipamento trazido nunca é largado. `keepFirst` não troca nada.
- **Extração:** a saída usável de menor risco; paga a passagem se for `payment`; tocaia com chance `risco × encontro`; depois mais 2 min (se passar da duração, MIA).
- **Resultado:**
  - Extraiu: XP do PMC = 300 + 5/min + 120 por Scav + 400 por PMC + valor do loot / 1000, e partes destruídas voltam para 1 PV (cirurgia de campo provisória, até existir a enfermaria).
  - Morreu/MIA: perde todos os slots menos `secure` e tudo dos bolsos; o loot salvo é o que estiver no contêiner seguro; vida, energia e hidratação voltam ao máximo; nenhum XP do PMC.
  - O XP de skills fica sempre: Resistência 0,5/min, Percepção 2 por loot, Furtividade 4 por briga evitada, Mira 1 por acerto, Vitalidade 0,05 por dano recebido, Força 0,2 por célula de loot guardada (+ Saúde/Metabolismo/Manuseio de carregador pelo uso).
- **Karma** (`KARMA`): abater Scav −0,25, abater PMC +0,1, evitar briga +0,1, extrair +0,05, limitado a −10..10. Usado pela raid Scav.
- **Avisos antes da raid** (`raidWarnings`, não impedem a entrada): sem arma com munição, sem colete, sem capacete, cabeça ou tórax abaixo da metade.
- **Balanceamento:** `tests/core/raid/balance.test.ts` roda 150 raids por cenário com seeds fixas e confere as faixas (ex.: kit bom na Periferia equilibrado extrai 85–99%; agressivo no Porto morre bem mais que furtivo, mas traz mais loot; MIA < 5%).
- Pendências: durabilidade da armadura (desgaste), armas sem carregador (escopeta), loot "encontrado na raid" para quests, inimigos com equipamento de verdade.

### Raid Scav

- Arquivos: `src/core/raid/scav.ts`, modificadores em `RaidSimulation` (`RaidSetup.modifiers`, tipo `RaidModifiers` em `types.ts`), tabelas em `src/data/scav.ts` (`SCAV_LOADOUT`); botão "Entrar como Scav" na `RaidSetupScene` e resumo próprio na `RaidScene` (`scavSummaryLines`).
- **Fluxo** (`startScavRaid`): recusa se `scavReadyIn > 0`. Usa a mesma seed do perfil de raid (`new Rng(raid.seed)`, depois sorteia a próxima). Monta o Scav (`createScav`: `PlayerState` temporário com equipamento sorteado, `createPmc("Scav")`, cópia das skills do PMC, a mesma `ItemFactory` e um `MagazineLoader` próprio, então o carregamento do PMC continua) e roda a simulação normal com `scavModifiers(karma)`. Ao extrair, `transferToStash` leva tudo ao estoque. Grava as estatísticas em `player.scav.stats` e `readyAt = agora + cooldown`. O resumo sai com `xp: 0`, `skillXp: {}`, `karma: 0` e `scav: { stored, storedValue, left }` (a presença de `scav` marca a raid Scav). Fica em `raid.active` como a raid do PMC.
- **O PMC não arrisca nada:** equipamento, vida, skills, XP e karma do PMC não mudam; o XP de skills ganho pelo Scav é descartado.
- **Equipamento** (`rollScavEquipment`): para cada slot (colete tático, mochila, colete balístico, capacete), sorteia por peso (`item: null` = vazio). Uma arma por peso, com carregador de `ceil(capacidade/2)` até a capacidade (pistola vai no coldre, arma longa no primário); `spareMags` carregadores cheios e `looseAmmo` cartuchos soltos; `extraRolls` itens de `extras`. O que não couber nas grades fica de fora.
- **Modificadores** (`RaidModifiers`; `NO_MODIFIERS` = a raid do PMC, sem nenhuma chamada extra ao RNG):
  - `friendlyScav`: chance de um Scav não ser hostil (log `avoid`, sem karma nem XP), sorteada antes da briga, também na tocaia;
  - `extractRisk`: multiplica a chance de tocaia;
  - `lootWeight`: multiplica o peso dos eventos de loot;
  - `lootQuality`: com chance `|q|`, sorteia o loot de novo e fica com o mais valioso (q > 0) ou o menos valioso (q < 0), por `totalValue`. Vale para busca e corpo revistado.
- **Karma** (`SCAV_KARMA`, k de −10 a 10):
  - Scav amigável = `clamp(0,6 + 0,04k, 0, 1)`;
  - tocaia × `(1 − 0,05k)`;
  - loot × `(1 + 0,03k)`;
  - qualidade = `0,05k`;
  - cooldown × `(1 − 0,025k)`.
- **Cooldown** (`scavCooldownMs(karma, reduction)`): `SCAV_COOLDOWN_MS = 20 min × fator do karma × (1 − reduction)`. `reduction` (0 a 1, limitado) fica para o módulo do esconderijo (Fase 7). É contado pelo relógio real (`readyAt`), então anda com o jogo fechado.
- **Transferência** (`transferToStash`): tira os itens soltos das grades do Scav e depois as peças vestidas (já vazias; a arma mantém o carregador), ordena por valor por célula (maior primeiro) e usa `autoPlace` no estoque. Uma pilha pode entrar só em parte. O que não coube vai para `left` (perdido).
- **Balanceamento** (`tests/core/raid/scavBalance.test.ts`): Periferia equilibrado com karma 0 extrai 75–97%; Porto equilibrado com karma +10 extrai pelo menos 8 pontos a mais e traz pelo menos 1,8× o loot de karma −10; Porto agressivo extrai menos de 60%.
- Pendências: karma mudar com o comportamento na raid Scav (matar Scavs como Scav), Scav com equipamento melhor ou pior pelo karma, redução do cooldown pelo esconderijo (Fase 7).
