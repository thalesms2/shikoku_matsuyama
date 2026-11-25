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
- O jogo **nunca acessa a API em execução**: os dados ficam no banco local (`data/items.db`, SQLite) e são exportados para `src/data/generated/items.json`. Veja [`docs/pipeline-de-itens.md`](./docs/pipeline-de-itens.md).

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
- `src/ui/SceneManager.ts` — troca de cenas; toda tela implementa a interface `Scene` (`view`, `resize?`, `update?`, `destroy?`). `fadeMs` (padrão 0) faz a cena nova entrar com fade.
- `src/core/state.ts` — `PlayerState` (inventário, PMC, skills, `ItemFactory`, o perfil de raid `raid`, o perfil Scav `scav`, os vendedores `traders`, as quests `quests`, o esconderijo `hideout`, o mercado `flea`, os loadouts `loadouts` e as raids automáticas `auto`): tudo que vai para o save. `storageFor()` decide onde guardar o que sai de um item.
- `src/core/pmc/` — PMC, skills e consumíveis. `src/core/save/` — formato, serialização, migrações e armazenamento do save.
- `src/core/raid/` — raid do PMC: tipos (`types.ts`), estratégias e karma (`strategy.ts`), fórmulas de combate (`combat.ts`), loot (`loot.ts`), simulação (`simulate.ts`, classe `RaidSimulation`) e perfil/reprodução (`profile.ts`) e raid Scav (`scav.ts`). Mapas e inimigos ficam em `src/data/maps.ts`; o equipamento do Scav, em `src/data/scav.ts`.
- `src/core/trade/` — vendedores: tipos (`types.ts`) e compra, venda, lealdade e reposição (`trade.ts`). Os vendedores ficam em `src/data/traders.ts`; a tela é `src/ui/scenes/TradersScene.ts`.
- `src/core/quests/` — quests: tipos (`types.ts`) e regras (`quests.ts`: requisitos, status, aceitar, entregar, concluir, progresso depois da raid). As quests ficam em `src/data/quests.ts`; as telas são `src/ui/scenes/QuestsScene.ts` e `src/ui/scenes/EndingScene.ts`.
- `src/core/hideout/` — esconderijo: tipos (`types.ts`) e regras (`hideout.ts`: obras, efeitos, cura/comida por minuto, produção, renda, `hideoutTick`). Módulos e receitas ficam em `src/data/hideout.ts`; a tela é `src/ui/scenes/HideoutScene.ts`.
- `src/core/flea/` — mercado: tipos (`types.ts`) e regras (`flea.ts`: preço com tendência e pressão, compra, anúncio, taxa, sorteio das vendas, `fleaTick`). A configuração fica em `src/data/flea.ts`; a tela é `src/ui/scenes/FleaScene.ts`.
- `src/core/loadout/` — loadouts: tipos (`types.ts`) e regras (`loadout.ts`: foto do equipamento, o que falta, montar do estoque, onde comprar, comprar o que falta). A tela é `src/ui/scenes/LoadoutScene.ts` (aberta pela preparação da raid).
- `src/core/auto/` — raids automáticas: tipos (`types.ts`) e regras (`auto.ts`: começar/parar, `autoTick`, regras de parada). A tela é `src/ui/scenes/AutoRaidScene.ts` (aberta pela preparação da raid).
- `src/core/settings.ts` — configurações do aparelho (fora do save). Tutorial em `src/data/tutorial.ts` e `src/ui/components/TutorialPanel.ts`; tela `src/ui/scenes/SettingsScene.ts`; som em `src/ui/audio.ts`.
- `src/core/offline.ts` — tempo com o jogo fechado: `catchUp` passa o tempo (esconderijo e mercado) e devolve o resumo (`OfflineReport`); a tela é `src/ui/scenes/OfflineScene.ts`.
- `src/data/newGame.ts` — `createNewPlayer()` e `loadOrCreatePlayer()`.
- `src/core/rng.ts`, `src/core/events.ts`, `src/core/clock.ts` — `Rng` com seed, `EventBus` tipado e `Clock` injetável (use `ManualClock` nos testes).
- `server/` — servidor Colyseus: sala `game` (do template) e sala `balance` (balanceamento, Fase 11J).
- `scripts/items/` — pipeline de dados de itens, que só roda em desenvolvimento (`npm run items -- <comando>`, via `tsx`): dados JSON do tarkov.dev (`https://json.tarkov.dev/regular/items` + traduções `/regular/items_en`; índice em `/endpoints`) → banco SQLite `data/items.db` (`node:sqlite`, commitado) → `src/data/generated/items.json` (commitado, importado por `src/data/items.ts`). As imagens ficam em `public/assets/items/<id>.webp`, fora do git.
- `tests/` — espelha a estrutura de `src/` e `server/`. Testes que usam PixiJS rodam com `// @vitest-environment jsdom` no topo; a `Application` deve ser mockada (o jsdom não tem WebGL).

### Armadilhas conhecidas nos testes

- Os testes de jogo existentes simulam `@pixi/sound` como `{}`; acessar um export que falta nesse mock lança erro. Por isso `src/ui/audio.ts` lê `sound` dentro de `try`.
- Não devolva valor em `beforeEach`/`beforeAll` (ex.: `beforeEach(() => mock.mockReset())`): o Vitest trata a função retornada como teardown e a executa depois do teste. Use chaves: `beforeEach(() => { mock.mockReset(); })`.
- Variáveis usadas dentro de `vi.mock(...)` precisam vir de `vi.hoisted(...)`.
- Não importe helpers de um arquivo `*.test.ts` em outro: os testes do arquivo importado rodam de novo. Coloque fixtures compartilhadas em arquivos sem `.test` (ex.: `tests/core/inventory/magFixtures.ts`).
- Para testar a simulação da raid passo a passo, use `ScriptRng` (`tests/core/raid/raidFixtures.ts`): filas de respostas para `chance`, `int`, `pick` e `weighted`, consumidas na ordem em que a simulação chama o RNG.
- `view.emit(...)` do Pixi não propaga o evento para os pais; para testar handlers no container pai (ex.: fechar o menu de contexto), emita o evento no pai com o `target` desejado.

Veja o plano atual em [`PLANO.md`](./PLANO.md). O histórico das Fases 0 a 10, o pipeline de itens e a estratégia de testes estão em [`docs/`](./docs/) (`historico.md`, `pipeline-de-itens.md`, `testes.md`).

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
- Todos os itens do jogo estão ligados a um `sourceId` só para a imagem placeholder: todos os outros campos vêm do override (nenhum `--clear`), então ligar um item não muda o balanceamento. Itens novos (ex.: `med_surgery`) seguem o mesmo fluxo: `override` com `--source` e todos os campos próprios, `images`, `export`.
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
- **Equipamento:** slots `primary`/`secondary` (`longWeapon`), `holster` (`pistol`), `helmet`, `armor`, `rig`, `backpack`, `secure`, `eyewear` (óculos) e `face` (cobertura do rosto; Fase 12E2). Um slot aceita só itens com o `equipSlot` correspondente e só um item por vez. 4 bolsos 1x1. `carryGrids()` = bolsos + colete tático + mochila (o contêiner seguro fica de fora, porque é o que sobrevive à morte).
- **Operações:** `moveToGrid`/`moveToSlot` não mudam nada se o destino for inválido. `mergeStack` move `min(origem, maxStack − destino)`; se a origem esvaziar, ela é removida. `splitStack(item, n)` exige `1 ≤ n < count`. `autoPlace` completa pilhas iguais primeiro e depois usa o primeiro espaço livre nas grades, na ordem dada. `dropOnItem`: se for pilha igual, soma; se o alvo for um contêiner, guarda dentro dele.
- **Organizar (`sortGrid`):** recoloca os itens por área (maior primeiro), depois por categoria, nome e quantidade (maior primeiro). Se não couber tudo, a grade volta exatamente como estava e a função devolve `false`.
- **Valor:** `totalValue` = `basePrice × count` + valor de tudo que está dentro do item, recursivamente.
- **UI:** arrastar com o botão esquerdo; prévia verde/vermelha; `R` gira durante o arraste; `Esc` cancela; soltar sobre uma pilha igual soma; soltar sobre um contêiner guarda dentro dele; duplo clique (≤ 350 ms) abre a janela do contêiner; o botão azul de ícone (`IconButton` com `sortIcon`, dica "Organizar" com o ponteiro em cima) ordena o estoque. Soltar no mesmo lugar não conta como mudança (senão a view é recriada e o clique se perde).
- **Janelas de contêiner** (Fase 11E): várias podem ficar abertas (`InventoryScene.windows`; `window` é a da frente). Abrir a de um item já aberto só a traz para frente; cada janela nova abre `WINDOW_CASCADE = 24` px deslocada da anterior. Clicar numa janela a traz para frente (`focusWindow`), e ela é arrastada pela barra de título (`WINDOW_HEADER = 30` px, menos o botão X). As janelas ficam acima do inventário e abaixo do tooltip e do menu; a da frente vem primeiro nos alvos do arraste. Cada uma fecha pelo X, e as dos contêineres que sumiram fecham no `refresh`.
- **Slots de óculos e rosto** (Fase 12E2): caixas 2x1 empilhadas numa coluna ao lado do coldre (em `SLOT_ROWS`, uma lista dentro da linha vira coluna); os bolsos vêm depois da coluna. Como o save guarda os slots pelo nome, não mudou de versão: save antigo carrega com os dois vazios. Loadouts, Ctrl+clique e perda na morte já percorrem `SLOT_NAMES`.
- **Ctrl+clique** (Fase 11D; ⌘+clique no Mac; `quickMove` em `src/core/inventory/quickMove.ts`): um item do estoque (direto ou dentro de um contêiner dele, `inStash`) vai para o primeiro slot vazio que o aceita (na ordem de `SLOT_NAMES`) ou, sem slot, para as grades de carga com `autoPlace`; de qualquer outro lugar, vai para o estoque com `autoPlace`. Pilhas podem entrar só em parte (conta como mudança). Sem espaço, nada muda. Não começa arraste.
- **Menu de contexto (botão direito):** `src/ui/inventory/actions.ts` monta as opções por item: "Abrir" (contêiner), "Descarregar" (carregador ou tubo, instantâneo), "Remover carregador" (arma), "Separar pilha pela metade" (pilhas; a metade vai para o primeiro espaço livre de `storageFor`, ou volta para a pilha se não couber). `storageFor(item)` = grade do item, depois `carryGrids()`, depois o estoque, sem repetir. O menu do navegador é bloqueado no canvas.
- **Estoque inicial:** 10x14, com o kit de `src/data/starter.ts`.
- **Rolagem do estoque** (`InventoryScene`): mostra no máximo `STASH_VISIBLE_ROWS = 14` linhas (a escala da tela usa só elas). Com mais linhas (Depósito), `stashScroll` (primeira linha visível, de 0 a `altura − 14`) desloca a `stashView`, uma máscara (`stashMask`) esconde o resto e uma barra (`scrollBar`, à direita) mostra a posição. A roda do mouse sobre o estoque rola `WHEEL_ROWS = 2` linhas por passo; arrastando um item a meia célula da borda de cima ou de baixo da janela, rola 1 linha a cada `AUTOSCROLL_MS = 150` ms, e a prévia do arraste acompanha. `GridView.clip` (faixa visível em y local) faz `containsLocal` ignorar as linhas escondidas, e a `hitArea` da view também se limita a elas, então não dá para soltar nem clicar fora da janela. `refresh` mantém a rolagem dentro do limite.

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
- **Instantâneo** (Fase 11A, substituiu o `MagazineLoader` progressivo): soltar munição sobre um carregador ou tubo carrega na hora (`loadRounds`, até encher ou acabar a pilha) e "Descarregar" tira tudo na hora (`unloadRounds`; o que não couber fica). Com o `PlayerState`, cada cartucho carregado ou descarregado dá `MAG_DRILLS_XP_PER_ROUND = 0,5` XP de Manuseio de carregador.
- **Interface:** soltar munição sobre carregador carrega (prévia vermelha se o calibre não bater ou estiver cheio); soltar carregador sobre arma (na grade ou equipada no slot) encaixa; carregadores e armas mostram `carregados/capacidade` no canto; tooltip lista a munição do topo para baixo ou o carregador da arma.
- **Valor:** `totalValue` inclui os cartuchos (`basePrice × count`), o carregador encaixado na arma e o cartucho da câmara.
- **Tubo interno** (`hasInternalMagazine`: arma com `stats.capacity`, ex.: Escopeta M-12, 6 cartuchos, definida pelo pipeline): a arma guarda os cartuchos em `rounds` (como um carregador) e não tem o campo `magazine`, então não aceita carregador. `isFeed` (carregador ou tubo) vale para carregar, descarregar e o arraste (munição sobre a escopeta na grade ou equipada no slot). `feedOf(arma)` = o tubo ou o carregador encaixado.
- **Câmara** (`Item.chamber`, a `ItemDef` do cartucho; sem o campo = vazia): `chamberRound` leva o topo do carregador/tubo para a câmara vazia; `fireRound` dispara a câmara (carregando antes, se vazia) e sobe o próximo; `unloadChamber` guarda o cartucho (sem espaço, fica). `weaponRounds` = câmara + carregador/tubo. Encaixar um carregador não carrega a câmara.
- **Interface da câmara:** o canto mostra `carregados+1/capacidade` com a câmara cheia (só `1` sem carregador); o tooltip mostra "Tubo: n/cap" com a sequência e "Câmara: Nome"; menu "Carregar a câmara" (com munição no carregador/tubo) e "Descarregar a câmara".
- **Munição solta sobre a arma** (Fase 11B; `canLoadWeapon`/`loadWeapon`, e `canLoadInto`/`loadInto` escolhem entre arma e carregador): soltar munição do calibre da arma sobre ela, na grade ou equipada no slot, põe 1 cartucho na câmara se estiver vazia e o resto no carregador encaixado ou no tubo (com a câmara cheia, tudo vai para eles). Arma sem carregador recebe só o da câmara. Calibre errado, ou câmara e carregador cheios, ficam vermelhos. Dá o XP de Manuseio de carregador por cartucho.

### PMC

- Arquivos: `src/core/pmc/pmc.ts`; painel no inventário `src/ui/inventory/PmcPanel.ts` (Fase 11G).
- **Painel do PMC** (`PmcPanel`, só quando a `InventoryScene` tem o `PlayerState`): fica entre o equipamento e o estoque, ao lado das armas. Mostra o nível com a barra de XP, uma silhueta com a vida de cada parte (verde acima de 60%, amarelo acima de 35%, vermelho abaixo, e destruída escura com contorno e um X; `partColor`), a vida de cada parte em texto (nomes curtos), vida total, energia e hidratação com barras. Atualiza a cada `refresh` do inventário e a cada `PANEL_REFRESH_MS = 500` ms no `update` (a cura e a comida do esconderijo aparecem com a tela aberta).
- **Vida por parte do corpo** (máx.): cabeça 35, tórax 85, estômago 70, braços 60, pernas 65 (total 440). Cabeça ou tórax em 0 = morte.
- **Dano** (`damage`): tira da parte atingida, sem passar de 0 (o excesso se perde). Dano em parte já destruída (não vital) se espalha: `dano × 0,7` dividido igualmente entre as partes vivas. Morto não recebe dano.
- **Cura** (`heal`): distribui os pontos pelas partes mais feridas primeiro (menor `vida/máx.`; em empate, vitais primeiro); não cura partes destruídas (`restorePart` volta uma parte destruída para 1 PV, usado pela cirurgia).
- **Energia e hidratação:** 0 a 100, mudadas por `changeEnergy`/`changeHydration`. Só caem durante a raid (veja Raid do PMC).
- **Nível:** XP acumulado para o nível `n` = `1000 × n(n−1)/2` (nível 2 = 1000, nível 3 = 3000...), máximo 60.

### Skills

- Arquivos: `src/core/pmc/skills.ts`; tela `src/ui/scenes/SkillsScene.ts` (botão "Skills" no inventário; até a Fase 11G era a tela "Personagem", com vida e nível, que foram para o painel do inventário).
- Skills (Fase 11H: 34, em quatro categorias, `SKILL_CATEGORIES`/`skillsIn`; a tela mostra Físicas e Práticas numa coluna e Combate e Mentais na outra):
  - **Físicas:** Resistência, Força, Saúde, Metabolismo, Resistência ao estresse, Vitalidade.
  - **Combate:** Mira, Fuzis de assalto, Fuzis de ferrolho, Fuzis de precisão (DMR), Metralhadoras pesadas, Metralhadoras leves, Corpo a corpo, Pistolas, Revólveres, Lança-granadas, Escopetas, Submetralhadoras, Arremessáveis, Solução de panes.
  - **Práticas:** Furtividade, Fabricação, Coletes pesados, Coletes leves, Gestão do esconderijo, Manuseio de carregador, Busca, Cirurgia, Manutenção de armas, Manutenção de coletes.
  - **Mentais:** Atenção, Carisma, Intelecto, Percepção.
  - As 25 skills novas ainda não ganham XP nem têm efeito (o usuário vai descrever); as 9 antigas mantêm tudo.
- XP acumulado para o nível `n` = `10 × n(n+1)/2` (nível 1 = 10, nível 2 = 30...), máximo 51. Bônus = `1% × nível`, limitado a 50%.
- Efeitos: **Saúde** (+bônus na cura de remédios), **Metabolismo** (+bônus em energia/hidratação de comida e bebida; gasto de hidratação na raid × (1 − bônus)), **Manuseio de carregador** (sem efeito fora da raid desde o carregamento instantâneo; vai definir a recarga em combate na raid nova), **Mira**, **Percepção**, **Furtividade**, **Vitalidade** e **Resistência** na raid (fórmulas em Raid do PMC). **Força** só ganha XP por enquanto.
- XP: +5 em Saúde por remédio usado; +5 em Metabolismo por comida/bebida; +0,5 em Manuseio de carregador por cartucho carregado/descarregado (só quando a cena tem o `PlayerState`, e na raid ao completar carregadores). XP de raid em Raid do PMC.

### Consumíveis

- Arquivos: `src/core/pmc/consumables.ts`; opção "Usar" no menu de contexto (só com `PlayerState`).
- Consumível = categoria `medical` ou `food` com `stats.heal`, `stats.energy` ou `stats.hydration`. Cada uso consome 1 unidade (o item some quando a pilha acaba).
- Valores atuais: kit de primeiros socorros cura 120; atadura cura 15; lata de carne +45 energia / −5 hidratação; água +60 hidratação.

### Save

- Arquivos: `src/core/save/` (`format.ts`, `serialize.ts`, `migrations.ts`, `storage.ts`); integração em `src/game.ts` e `src/data/newGame.ts`.
- **Formato** (`SAVE_VERSION = 19`): `nextId` da fábrica, estoque (itens com posição/rotação), slots e bolsos, conteúdo aninhado (grades, cartuchos do carregador do fundo ao topo, carregador encaixado na arma), PMC, skills (até a v13, também o carregamento em andamento) e, desde a v2, o perfil de raid (`raid`: karma, estatísticas, regra de loot, seed e a raid em andamento com log e resumo) desde a v3, o perfil Scav (`scav`: `readyAt` e estatísticas) desde a v4, os vendedores (`traders`: reputação, volume, compras desde a reposição e `restockAt` de cada um) e, desde a v5, as quests (`quests`: status e progresso) e a marca `fir: true` nos itens encontrados na raid e, desde a v6, o esconderijo (`hideout`: níveis, obra, produções, `incomeSince`, `lastTick`) e, desde a v7, o mercado (`flea`: seed, anúncios com o item salvo como os do estoque, resultados, pressão, `lastCheck` e estatísticas) e, desde a v8, os loadouts (`loadouts`: nome, item de cada slot, carregador de cada arma e itens carregados) e, desde a v9, as raids automáticas (`auto`: regras, se está rodando, raids feitas, `nextAt`, `current` e histórico) e, desde a v10, a durabilidade atual dos itens (`dur`, só quando não estão inteiros) e, desde a v11, o progresso da cirurgia da enfermaria (`hideout.surgeryProgress`, só durante uma) e, desde a v12, o cartucho na câmara das armas (`chamber`, id da munição; os cartuchos do tubo usam o mesmo `rounds` dos carregadores) e, desde a v13, as quests que avançaram na raid em andamento (`raid.active.quests`) e, na v14, o carregamento em andamento saiu (carregar ficou instantâneo) e, desde a v15, as skills novas das categorias e, desde a v18, as outras obras ao mesmo tempo (`hideout.extraConstructions`) e o combustível do gerador (`hideout.fuel`) e, desde a v19, as quests repetíveis (`repeatable`: seed, próximo número e a oferta de cada vendedor). O tamanho do estoque salvo já inclui as linhas do Depósito.
- **Migração 1 → 2:** adiciona `raid = createRaidProfile(savedAt)`. Ao carregar, campos do perfil que faltam voltam ao padrão e `lootRule` inválida vira `valuePerCell`.
- **Migração 2 → 3:** adiciona `scav = createScavProfile()` (liberada). Ao carregar, `readyAt` inválido vira 0 e estatísticas que faltam voltam a 0.
- **Migração 3 → 4:** adiciona `traders = {}`. Ao carregar, números inválidos voltam a 0 (`restockAt` 0 repõe no próximo acesso) e compras que não são inteiros positivos são descartadas. Vendedores e ofertas que não existem mais ficam guardados sem efeito.
- **Migração 4 → 5:** adiciona `quests = {}` (itens antigos não são "encontrados na raid"). Ao carregar, quest com status inválido é descartada e progresso inválido ou negativo vira 0.
- **Migração 5 → 6:** adiciona `hideout = createHideoutState(savedAt)`. Ao carregar, níveis que não são inteiros positivos somem, obra ou produção inválida é descartada e `incomeSince`/`lastTick` inválidos viram o momento do carregamento (sem tempo offline).
- **Migração 6 → 7:** adiciona `flea = createFleaState(savedAt)`. Ao carregar, anúncios e resultados inválidos (ou com item que saiu do catálogo, com aviso) são descartados, pressão inválida some, estatísticas inválidas voltam a 0, seed inválida vira a do carregamento, `nextListing` fica acima de todos os ids e `lastCheck` inválido vira o momento do carregamento.
- **Migração 7 → 8:** adiciona `loadouts = []`. Ao carregar, loadout sem nome em texto é descartado; slots desconhecidos ou sem texto somem; itens carregados sem id em texto ou com quantidade que não é inteiro positivo somem. Itens que saíram do jogo ficam e aparecem como faltando.
- **Migração 8 → 9:** adiciona `auto = createAutoState()` (parada, regras padrão). Ao carregar, regras inválidas voltam ao padrão (raids de 1 a `MAX_AUTO_RAIDS`, vida mínima limitada a 0–1, estratégia e ação de vida baixa conhecidas), resultados inválidos somem, `running` só vale `true` se for exatamente `true`, `done` inválido vira 0 e `nextAt` inválido vira o momento do carregamento.
- **Migração 9 → 10:** nada muda (item sem `dur` = inteiro). Ao carregar, `dur` só vale em itens com durabilidade, abaixo do máximo e finito; negativo vira 0.
- **Migração 10 → 11:** nada muda (sem `surgeryProgress` = 0). Ao carregar, só um número positivo vale.
- **Migração 11 → 12:** nada muda (sem `chamber` = câmara vazia). Ao carregar, `chamber` só vale em armas, com munição do catálogo e do calibre da arma; munição que saiu do jogo ou incompatível é descartada com aviso.
- **Migração 12 → 13:** nada muda (raid sem `quests` = nenhuma quest avançou). Ao carregar, `quests` só vale como lista, e entradas sem `quest`/`name` em texto, `ready` booleano ou objetivos com números finitos são descartadas.
- **Migração 17 → 18:** nada muda nas obras (a obra antiga continua em `construction`; as outras ficam em `extraConstructions`). Gerador já construído começa com o tanque cheio (`fuel = coreBalance().fuel.max`), para as produções e a renda não pararem de repente; sem gerador, sem combustível. Ao carregar, `extraConstructions` só vale como lista de obras válidas e `fuel` só como número positivo.
- **Migração 18 → 19:** adiciona `repeatable = createRepeatableState(savedAt)` (sem ofertas; cada vendedor ganha a sua no primeiro acesso). Ao carregar, seed inválida vira o momento do carregamento, `next` inválido vira 1 e fica sempre acima do número das ofertas salvas, e ofertas inválidas (objetivo que não é `kill` de Scav nem `find` de item do catálogo, contagem que não é inteiro positivo, recompensa negativa ou não finita) somem. A migração 17 → 18 é do esconderijo (outro agente); nesta branch é um passo vazio.
- **Migração 16 → 17:** adiciona `mapKnowledge = {}`. Ao carregar, XP inválido ou negativo vira 0, pontos achados só textos, entradas que não são objetos somem.
- **Migração 15 → 16:** nada muda (sem `raid.mapStrategies` = Neutro em todo mapa). Ao carregar, só estratégias conhecidas ficam.
- **Migração 14 → 15:** nada muda; as skills que faltam no save começam em 0 (como sempre, ao carregar).
- **Migração 13 → 14:** tira o campo `loader` (carregamento em andamento). Os cartuchos ficam onde estavam: num carregamento pela metade, o resto continua na pilha.
- **Carregar save antigo/inconsistente:** item que saiu do catálogo é descartado com aviso; item que não cabe mais na posição vai para o primeiro espaço da mesma grade; se não couber nela (ou a grade não existir mais, ou o slot não aceitar mais o item, ou o carregador ficar incompatível), vai para o estoque; sem espaço no estoque, é perdido com aviso. Campos de PMC/skills que faltam recebem o valor padrão (skills novas começam em 0).
- **Migrações:** `migrate()` aplica `MIGRATIONS[v]` de versão em versão até `SAVE_VERSION`; save sem versão, de versão mais nova ou com migração faltando lança `SaveError`.
- **Armazenamento:** chave `escape-from-idle:save` no `localStorage`; erros do navegador são ignorados. Autosave a cada 5 s de jogo e no `beforeunload`. Save ilegível é copiado para `escape-from-idle:save:backup` e o jogo começa do zero (com aviso no console).

- **Imagens dos itens:** `loadItemTextures` carrega a `image` de cada `ItemDef` no início do jogo (`src/ui/inventory/textures.ts`). Se a textura existir, a `ItemView` desenha o sprite do tamanho das células (girado 90° quando o item está rotacionado); se o arquivo faltar, o item continua sendo um retângulo colorido pela categoria.

### Raid do PMC

- Arquivos: `src/core/raid/` (`types.ts`, `strategy.ts`, `combat.ts`, `loot.ts`, `simulate.ts`, `profile.ts`), dados em `src/data/maps.ts`; telas `src/ui/scenes/RaidSetupScene.ts` (preparação, botão "Raid" no inventário) e `src/ui/scenes/RaidScene.ts` (log e resumo).
- **Resolução:** `startRaid` resolve a raid inteira na hora com `new Rng(raid.seed)`, aplica o resultado ao `PlayerState`, sorteia a próxima seed (`floor(rng.next() × 2³²)`), atualiza karma/estatísticas e guarda `raid.active = { startedAt, events, summary }`. O jogo salva logo em seguida (recarregar não refaz o sorteio). A `RaidScene` só revela o log: minuto mostrado = `(agora − startedAt) / 2000 ms` (velocidades x1/x4/x16 e "Pular"); fechar o resumo chama `finishRaid(player, raid)` (`active = null`, mas só se `raid` ainda for a raid em andamento: uma raid automática mais nova não é apagada por uma tela antiga). Com uma raid ativa no save, o título leva direto para a `RaidScene`.
- **Mapas** (`MapDef`): dificuldade 1–5, duração em minutos, pesos de ameaça `{scav, pmc}`, tabela de loot (`item`, `weight`, `min`/`max`, limitada à pilha máxima) e extrações (`risk` = chance de tocaia; requisitos `key`, `payment` ou `noBackpack`; ao menos uma livre). Periferia Norte (1, 30 min), Cimenteira (2, 25 min), Porto Velho (3, 40 min).
- **Inimigos** (`EnemyDef`): Scav (110 PV, precisão 0,13) e PMC (160 PV, precisão 0,42), com equipamento de verdade (`gear`; veja Inimigos com equipamento). Sem `gear` (ex.: os inimigos de teste), valem `damage`, `penetration`, `burst` e uma classe sorteada de `armorClasses`.
- **Estratégias** (`STRATEGIES`): multiplicadores de encontro/loot, chance de evitar briga, iniciativa, chance de revistar o corpo, ritmo e faixa da extração. Furtivo 0,6/0,75, evita 50%, +15% iniciativa, revista 40%, ritmo 1,25, extração em 50–72% do tempo. Equilibrado 1/1, 20%, 0, 60%, 1, 45–72%. Agressivo 1,6/1,4, 0%, +5%, 85%, 0,85, 45–75%.
- **Passos:** cada passo dura `int(2, 5) × ritmo × (1 + 0,25 × pernas destruídas)` minutos. A cada minuto, a energia cai `0,15 × (1 − Resistência)` e a hidratação `0,2 × (1 − Metabolismo)`. Com energia ou hidratação em 0, o estômago perde 0,6/min. Depois: morto → `killed`; passou da duração → `mia`; passou do momento da extração → tenta extrair; senão sorteia um evento com pesos loot `4 × estratégia × (1 + Percepção)`, Scav/PMC `ameaça × encontro`, perigo 0,4 e tranquilo 2,5.
- **Combate:**
  - Evitar = `avoid + Furtividade/2` (karma +0,1, +4 XP de Furtividade).
  - Atira primeiro = `min(0,9; 0,5 + iniciativa + Percepção/2)`.
  - Até 6 trocas de tiro (0,5 min cada); depois disso o inimigo recua.
  - Disparos por troca: 1 com calibre 12, 3 com arma longa, 2 com pistola, cada um pelo `fireRound` (câmara primeiro, e o próximo sobe do carregador/tubo). Ao entrar na raid, cada arma equipada carrega a câmara (`chamberRound`).
  - Acerto do PMC = `0,5 × (1 + Mira) − 0,15 × braços destruídos`, limitado a 5–95%. Acerto do inimigo = `precisão + 0,03 × (dificuldade − 1)`.
  - Dano = `dano × armorFactor(pen, classe)`, com `armorFactor` = 1 se `pen ≥ classe × 10`, senão `max(0,2; pen / (classe × 10))`. Armadura do PMC gasta protege menos: `wornArmorFactor = 1 − (1 − armorFactor) × durabilidade/máx.` (veja Durabilidade da armadura). O inimigo acerta as partes por peso (cabeça 10, tórax 30, estômago 15, braços 10, pernas 12,5); capacete protege a cabeça, colete o tórax e o estômago. Dano recebido × `(1 − Vitalidade/2)`.
  - Arma vazia: troca pelo carregador carregado do equipamento (o vazio vai para o lugar dele, se couber), gastando o turno; escopeta vazia enche o tubo com os cartuchos soltos do equipamento e carrega a câmara (`reloadTube`, "Recarregou N cartuchos em M-12"), gastando o turno. Sem munição: foge com 40% de chance.
  - Ao vencer: abate, karma, revista com a chance da estratégia (1 item da tabela e, com `gear`, todo o equipamento do inimigo). Depois de cada briga: cuidados e completar carregadores e tubos com a munição solta do equipamento (a câmara não é carregada aqui; ela puxa do carregador no próximo disparo).
- **Cuidados automáticos:** primeiro a cirurgia das partes destruídas, se houver kit (veja Cirurgia); depois, enquanto houver parte curável e (vida total < 60% ou cabeça/tórax < 60%), usa o remédio com mais cura do equipamento. Energia ou hidratação < 35: come ou bebe o item com mais do stat. Perigos tiram 8–25 de uma parte (pernas, braços ou tronco).
- **Loot** (`stashLoot`): `autoPlace` nas grades do equipamento e por último no contêiner seguro. Se não couber e a regra for `valuePerCell`, larga o loot desta raid de menor valor por célula (menor que o do item novo), do mais barato para o mais caro, até caber; o que foi tirado sem necessidade volta para o lugar; se nem assim couber, nada muda. O equipamento trazido nunca é largado. `keepFirst` não troca nada.
- **Extração:** a saída usável de menor risco; paga a passagem se for `payment`; tocaia com chance `risco × encontro`; depois mais 2 min (se passar da duração, MIA).
- **Resultado:**
  - Extraiu: XP do PMC = 300 + 5/min + 120 por Scav + 400 por PMC + valor do loot / 1000. Partes destruídas continuam destruídas (só voltam com cirurgia: kit na raid ou enfermaria).
  - Morreu/MIA: perde todos os slots menos `secure` e tudo dos bolsos; o loot salvo é o que estiver no contêiner seguro; vida, energia e hidratação voltam ao máximo; nenhum XP do PMC.
  - O XP de skills fica sempre: Resistência 0,5/min, Percepção 2 por loot, Furtividade 4 por briga evitada, Mira 1 por acerto, Vitalidade 0,05 por dano recebido, Força 0,2 por célula de loot guardada (+ Saúde/Metabolismo/Manuseio de carregador pelo uso).
- **Karma** (`KARMA`): abater Scav −0,25, abater PMC +0,1, evitar briga +0,1, extrair +0,05, limitado a −10..10. Usado pela raid Scav.
- **Avisos antes da raid** (`raidWarnings`, não impedem a entrada): sem arma com munição, sem colete, sem capacete, cabeça ou tórax abaixo da metade.
- **Balanceamento:** `tests/core/raid/balance.test.ts` roda 150 raids por cenário com seeds fixas e confere as faixas (ex.: kit bom na Periferia equilibrado extrai 85–99%; agressivo no Porto morre bem mais que furtivo, mas traz mais loot; MIA < 5%).
- Pendências: veja Inimigos com equipamento.

### Raid Scav

- Arquivos: `src/core/raid/scav.ts`, modificadores em `RaidSimulation` (`RaidSetup.modifiers`, tipo `RaidModifiers` em `types.ts`), tabelas em `src/data/scav.ts` (`SCAV_LOADOUT`); botão "Entrar como Scav" na `RaidSetupScene` e resumo próprio na `RaidScene` (`scavSummaryLines`).
- **Fluxo** (`startScavRaid`): recusa se `scavReadyIn > 0`. Usa a mesma seed do perfil de raid (`new Rng(raid.seed)`, depois sorteia a próxima). Monta o Scav (`createScav`: `PlayerState` temporário com equipamento sorteado, `createPmc("Scav")`, cópia das skills do PMC, a mesma `ItemFactory`) e roda a simulação normal com `scavModifiers(karma)`. Ao extrair, `transferToStash` leva tudo ao estoque. Grava as estatísticas em `player.scav.stats` e `readyAt = agora + cooldown`. O resumo sai com `xp: 0`, `skillXp: {}`, `karma: 0` e `scav: { stored, storedValue, left }` (a presença de `scav` marca a raid Scav). Fica em `raid.active` como a raid do PMC.
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
- Pendências: karma mudar com o comportamento na raid Scav (matar Scavs como Scav), Scav com equipamento melhor ou pior pelo karma. (O Posto de vigia do esconderijo já corta o cooldown: `RaidSetupScene` passa `effect(hideout, "scavCooldown")` como `cooldownReduction`.)

### Vendedores e economia

- Arquivos: `src/core/trade/` (`types.ts`, `trade.ts`), dados em `src/data/traders.ts`, tela `src/ui/scenes/TradersScene.ts` (botão "Vendedores" no inventário). Moedas: `money_rub` (principal, `basePrice` 1), `money_usd` (122) e `money_eur` (132), criadas pelo pipeline de itens.
- **Vendedores** (`TraderDef`): moeda própria, níveis de lealdade, categorias que compra (com multiplicador), ofertas e intervalo de reposição.
  - Coronel Brás: armas e munição, ₽.
  - Doutora Iara: remédios e comida, ₽.
  - Mercador Tito: equipamento, em $; também vende $ e € por ₽ (câmbio).
  - Sucateiro Nico: compra quase tudo por 0,7 (permutas 1, chaves 0,8), ₽; vende permutas e chaves e faz trocas.
- **Estado** (`TraderState`, em `player.traders[id]`, criado no primeiro acesso por `traderState`): `reputation`, `volume` (rublos negociados, compras + vendas), `bought` (compras de cada oferta desde a reposição) e `restockAt`.
- **Lealdade** (`loyaltyLevel`): o maior nível cujos requisitos (nível do PMC, reputação e volume) o jogador cumpre. `LOYALTY_LEVELS`:
  - nível 1: sem requisitos, compra × 1,25, venda × 0,5;
  - nível 2: PMC nível 5, reputação 0,1, 400.000 ₽ negociados, × 1,15 / × 0,55;
  - nível 3: PMC nível 12, reputação 0,4, 1.500.000 ₽, × 1,05 / × 0,6.
  - Reputação: +0,02 a cada 100.000 ₽ negociados (`REPUTATION_PER_100K`); as quests (Fase 6) vão dar mais.
- **Preço de compra** (`offerPrice`): preço fixo da oferta (na moeda da oferta ou do vendedor) ou `ceil(basePrice × quantidade × markup / basePrice da moeda)`, mínimo 1. Troca (`barter`): itens no lugar de dinheiro.
- **Compra** (`buy`): repõe o estoque se passou da hora; confere a oferta, o nível (`Exige lealdade nível N`), o estoque (`Esgotado`) e se há o pagamento no estoque (dinheiro ou itens). Só pagam itens do estoque, incluindo os de dentro de contêineres, sem conteúdo. Guarda o item com `storeAll` (tudo ou nada: desfaz pilhas completadas) e só então paga; sem espaço, nada muda. Soma o valor em rublos (preço, ou `basePrice` dos itens da troca) ao volume e à reputação.
- **Preço de venda** (`sellPrice`): `floor(totalValue × sellRate × multiplicador da categoria / basePrice da moeda)`. Não compra dinheiro nem categorias fora de `buys`, pede para esvaziar contêineres e recusa itens que valem menos de 1.
- **Venda** (`sell`): o item precisa estar no estoque (pode estar dentro de contêiner). Ele sai, e o dinheiro entra no estoque (em pilhas de até `maxStack`), podendo usar o espaço liberado. Se o dinheiro não couber, o item volta para o mesmo lugar. Soma ao volume e à reputação.
- **Reposição** (`restock`): quando `agora ≥ restockAt`, zera `bought` e avança `restockAt` em quantos intervalos tiverem passado (mantém o ritmo com o jogo fechado). Brás, Iara e Tito: 1 h; Nico: 1,5 h. A tela repõe sozinha no `update`.
- **Tela:** lista de vendedores; ficha com descrição, lealdade, próximo nível e contagem da reposição; dinheiro do jogador em todas as moedas; abas Comprar/Vender com 10 linhas por página. Na venda aparecem os itens do topo do estoque das categorias que o vendedor compra. Ofertas bloqueadas, esgotadas ou recusadas ficam apagadas, e o resultado aparece em verde ou vermelho. Voltar ao inventário salva o jogo.
- **Ofertas liberadas por quest** (`TraderOffer.quest`): só podem ser compradas com a quest concluída (`questUnlocked`; recusa "Exige uma quest"). Na tela, aparecem como `exige a quest "Nome"`. Ex.: o Fuzil VK-74 do Coronel no nível 1, liberado por "Limpeza".
- **Conserto** (`TraderDef.repairRate`; só o Mercador Tito, 0,4): aba "Consertar" com os itens gastos do estoque, do equipamento e dos bolsos (veja Durabilidade da armadura).
- **Vender arrastando** (Fase 11C): soltar um item do estoque (pode estar dentro de contêiner) sobre o botão "Vendedores" do inventário abre a `TradersScene` com `sellItem`. `focusSale` escolhe o vendedor que paga mais por ele (preço × `basePrice` da moeda, em rublos), abre a aba Vender na página em que o item está e destaca a linha dele (cor de destaque). Se ninguém compra, fica no vendedor atual com "Nenhum vendedor compra X". A venda em si continua no botão "Vender". No `DragController`, a área de venda é `DropTargets.sell` (drop `sell`), com os hooks `onSell`/`canSell`: só itens do estoque; fora dele, o botão fica apagado durante o arraste.
- Pendências: vender arrastando para o mercado. (Preços dinâmicos ficam no mercado, Fase 8.)

### Quests e "encontrado na raid"

- Arquivos: `src/core/quests/` (`types.ts`, `quests.ts`), dados em `src/data/quests.ts`, telas `src/ui/scenes/QuestsScene.ts` (botão "Quests" no inventário) e `src/ui/scenes/EndingScene.ts`. A marca `fir` fica em `Item` (`src/core/inventory/item.ts`).
- **Encontrado na raid (`item.fir`):** ao extrair (`RaidSimulation.finish`), todo item de `found` que ainda está com o PMC recebe `fir = true`. Morrer ou ficar MIA não marca nada, nem o que estiver no contêiner seguro. Na raid Scav, o loot também é marcado (o equipamento sorteado não). Pilhas só se juntam se as duas tiverem a mesma marca (`canStack`). `splitStack` copia a marca. O tooltip mostra "Encontrado na raid ✓".
- **Quest** (`QuestDef`): vendedor, descrição, `main` (cadeia da fuga), `final` (termina o jogo), requisitos (`pmcLevel`, `quests` concluídas, `loyalty` com um vendedor), até 3 objetivos e recompensas (`xp`, `items` com dinheiro e itens, `reputation`). As ofertas com `quest` também contam como recompensa ("libera ...").
- **Objetivos** (o progresso fica limitado a `count`):
  - `deliver`: entregar itens do estoque com o botão "Entregar", em partes. Mesmas regras de pagamento dos vendedores; com `fir`, só itens encontrados na raid.
  - `extract`: extrair (opcional: mapa, saída `extract` por id e `strategy`). Cobre "sobreviver com a estratégia Y".
  - `kill`: `kills[target]` da raid (opcional: mapa). Conta mesmo se o PMC morrer.
  - `find`: unidades do item no loot de uma raid em que extraiu (opcional: mapa).
- **Status** (`questStatus`): `locked` (requisitos faltando, listados por `missingRequirements`) → `available` → `active` (depois de "Aceitar") → `ready` (objetivos cumpridos) → `completed` (depois de "Concluir").
- **Concluir** (`completeQuest`): guarda os itens da recompensa no estoque com `storeAll` (tudo ou nada; sem espaço, não conclui), soma o XP do PMC e a reputação com os vendedores.
- **Progresso das raids** (`progressAfterRaid`): chamado logo depois de a raid do PMC ser resolvida, antes de salvar, por `recordRaidQuests` (em `game.ts` e nas raids automáticas). Raids Scav não contam, e só quests ativas avançam. Progresso salvo com menos objetivos que a quest atual começa em 0.
- **Quests no resumo da raid** (`recordRaidQuests`, `QuestUpdate` em `src/core/raid/types.ts`): guarda em `raid.active.quests` cada quest que avançou, com o nome, os objetivos que mudaram (`index`, `from`, `to`, `count`) e `ready` (todos cumpridos). A `RaidScene` acrescenta ao resumo `questLines`: `Quest "Nome": <objetivo>: 1 → 3/5` por objetivo (descrito por `describeObjective` com as quests do jogo, opção `quests`; sem elas ou com a quest fora do jogo, "Objetivo N"), ou `Quest "Nome": pronta para concluir ✓`. No máximo `MAX_QUEST_LINES = 4` linhas (`clampLines`: 3 + "... e mais N avanço(s) em Quests").
- **Cadeia principal:**
  1. Reconhecimento: extrair da Periferia.
  2. Limpeza: abater 5 Scavs; libera o VK-74 com o Coronel.
  3. Peças para o rádio: entregar uma placa de vídeo encontrada na raid; exige PMC nível 3.
  4. Rota do porto: extrair do Porto com a estratégia Furtivo.
  5. O preço da passagem: entregar 3 correntes de ouro encontradas na raid; exige lealdade 2 com Tito.
  6. A última travessia (final): extrair pelo Barco do Contrabandista no Porto; exige PMC nível 8.
  - Secundárias: Estoque de emergência, Água limpa, Caça na cimenteira, Garagem trancada.
- **Final:** concluir a quest `final` abre a `EndingScene` ("VOCÊ ESCAPOU", com o nível e as estatísticas). "Continuar jogando" volta ao inventário; o jogo continua normalmente.
- **Tela:** lista ordenada por status (prontas, ativas, disponíveis, bloqueadas, concluídas). A ficha mostra vendedor, se é da cadeia principal, descrição, objetivos com progresso (`2/3` ou "Feito", com "Entregar" nos de entrega), requisitos que faltam e recompensas. O botão de ação é "Aceitar" ou "Concluir", e a mensagem aparece em verde ou vermelho.
- **Quests repetíveis** (Fase 14A; `src/core/quests/repeatable.ts`, estado em `player.repeatable`, números em `coreBalance().repeatable`, seção "Quests repetíveis" na janela de admin): cada vendedor oferece uma por vez (`ensureRepeatables`, gera as que faltam na ordem dos vendedores e descarta as de vendedores que saíram). O sorteio usa `new Rng(repeatable.seed)` e guarda o estado do RNG de volta na seed, então recarregar não sorteia de novo. Objetivo: `find` com chance `findWeight / (findWeight + killWeight)` (1 e 1), se houver item possível, senão `kill` de Scav. Caçada: `killMin`–`killMax` (3–8) Scavs, `moneyPerKill` (5.000 ₽) cada. Encomenda: um item das tabelas de loot dos mapas que está no catálogo, sorteado pelo peso da categoria (`barterWeight`, `foodWeight`, `medicalWeight`, 1 cada; outras categorias nunca), `findMin`–`findMax` (1–3) unidades, `basePrice × unidades × findValueFactor` (1,5) ₽. As duas dão `xpPerUnit` (150) XP e `reputationPerUnit` (0,005) de reputação por unidade. Faixas inválidas viram inteiros ≥ 1 (máximo nunca abaixo do mínimo). `repeatableDef` transforma a oferta numa `QuestDef` normal (`repeatable: true`, id `repeat-N`, sem requisitos; a mesma oferta devolve sempre o mesmo objeto) e `withRepeatables(player, base)` monta o contexto das quests com elas junto das fixas (o `game.ts` usa esse contexto em todo lugar), então aceitar, progresso da raid, resumo e concluir seguem as regras normais. Concluir uma repetível apaga o estado dela e a oferta e gera a próxima do mesmo vendedor (`replaceRepeatable`, chamado por `completeQuest`). Na tela, a ficha mostra "Repetível" e, ao concluir, a nova do mesmo vendedor fica selecionada.
- Pendências: quests no histórico das raids automáticas e no resumo do tempo fora, quests que dependem de raids Scav, quests diárias.

### Esconderijo

- Arquivos: `src/core/hideout/` (`types.ts`, `hideout.ts`), dados em `src/data/hideout.ts` (`HIDEOUT_MODULES`, `RECIPES`, `HIDEOUT`), tela `src/ui/scenes/HideoutScene.ts` (botão "Esconderijo" no inventário). `Grid.addRows` faz o estoque crescer embaixo, sem mover os itens.
- **Módulos** (`ModuleDef`): níveis a partir de 1 (0 = não construído). Cada nível tem custo (itens e dinheiro do estoque), requisitos (outros módulos, lealdade, nível do PMC), duração da obra e efeitos. Os efeitos valem para o nível atual, não se acumulam entre níveis, e `effect()` soma o efeito entre todos os módulos.
  - Gerador: produções 10%/20% mais rápidas; é requisito da oficina, da central e de níveis de outros módulos.
  - Depósito: +3/+6/+10 linhas no estoque (10x14 → 10x24).
  - Enfermaria: cura 1/3 PV por minuto; no nível 2, opera uma parte destruída a cada 30 min (`surgeryMinutes`).
  - Cozinha: +0,5/+1,5 de energia e de hidratação por minuto; receita "ferver água".
  - Oficina: receitas de munição, carregadores e kit médico.
  - Central de informantes: 1.500 ₽/h até 18.000 ₽, depois 4.000 ₽/h até 48.000 ₽.
  - Posto de vigia: cooldown da raid Scav −15%/−30%.
- **Obra** (`startUpgrade`; Fase 14B): várias ao mesmo tempo, sem limite, mas uma por módulo. A primeira fica em `construction` e as outras em `extraConstructions` (`constructions(state)` junta as duas, `constructionOf(state, módulo)` acha a do módulo). `upgradeBlockers` lista o que falta ("Nível máximo", "Obra em andamento" no próprio módulo, módulos, lealdade, PMC e "Faltam: Item (tem/precisa)"). O custo é tirado do estoque como nos vendedores, e a obra termina em `endsAt`.
- **Tempo** (`hideoutTick(player, data, now)`): conclui as obras vencidas na ordem de `endsAt`, aplicando o nível e as linhas do Depósito (só a diferença). Também cura (`heal`), alimenta e hidrata o PMC pelos minutos desde `lastTick`; até o fim de cada obra conta a taxa antiga e depois a nova. O resumo do tempo fora lista todas as obras concluídas. Morto não regenera, e o relógio voltando não tira tempo. O jogo chama ao carregar (tempo com o jogo fechado) e a cada `HIDEOUT_TICK_MS = 1000` ms no ticker.
- **Produção** (`startProduction`/`collectProduction`): uma por módulo. Exige o nível do módulo e os ingredientes (tirados ao começar). A duração é `base × (1 − min(0,9; productionSpeed))`. "Retirar" guarda o produto com `storeAll`, em pilhas; sem espaço, continua pronto. Receita que saiu do jogo é descartada.
- **Renda** (`incomeAvailable`/`collectIncome`): `floor(incomePerHour × horas desde incomeSince)`, limitado a `incomeCap`. Coletar guarda os rublos e recomeça a contar. A primeira estação começa a contar quando fica pronta; melhorar não zera o acumulado.
- **Tela:** módulos com nível (`Nome n/máx`), vida/energia/hidratação do PMC, efeitos atuais, próximo nível (efeitos, custo, duração, o que falta), contagem da obra e linhas de receitas ("ingredientes → produto · duração", com Produzir/Produzindo/Retirar) ou da renda (Coletar). Os textos se atualizam a cada `REFRESH_MS = 500` ms.
- **Combustível do gerador** (Fase 14C; `HideoutData.fuel = { module: "generator", item: "barter_fuel" }`, números em `coreBalance().fuel`): o Galão de combustível (`barter_fuel`, 2x2, 18.000 ₽, criado pelo pipeline; vendido pelo Sucateiro Nico, estoque 3) põe `perCan` (10) no gerador, até `max` (30); "Abastecer" (`addFuel`, `fuelBlocker`: gerador construído, "Tanque cheio" se passar do máximo, galão no estoque). Com o gerador construído, `hideoutTick` queima `perHour` (1) por hora (`hideout.fuel`; sem o campo = vazio), também com o PMC morto. Quando acaba no meio do intervalo, a partir desse momento as produções que não terminaram têm o `endsAt` empurrado (contagem parada) e o `incomeSince` anda junto (a renda não acumula). Sem gerador construído (ou sem `fuel` nos dados, como nos testes antigos), tudo funciona como antes (`hasPower`). A tela mostra "Combustível: n/máx · dura X" no gerador e avisa "Gerador sem combustível: produções e renda paradas".
- Pendências: nenhuma.

### Mercado (flea market)

- Arquivos: `src/core/flea/` (`types.ts`, `flea.ts`), configuração em `src/data/flea.ts` (`FLEA`), tela `src/ui/scenes/FleaScene.ts` (botão "Mercado" no inventário). Estado em `player.flea` (`FleaState`).
- **Acesso:** `fleaUnlocked` = PMC nível ≥ `minPmcLevel` (5). Tudo em `money_rub`. Ficam fora do mercado: dinheiro, itens com `basePrice` 0 e `banned` (`secure_pouch`).
- **Preço de mercado** (`marketPrice`): `max(1, round(basePrice × tendência × (1 − pressão)))`, com a pressão limitada a ±`pressureLimit` (0,4).
  - **Tendência** (`trendFactor`): um valor por período de `trendMs` (1 h), sorteado com `Rng(mix(seed, hashText(item), período))` em `1 ± trendAmplitude` (±0,2), em linha reta entre um período e o próximo. Não depende de estado salvo além da seed. `priceTrend` (seta da tela) compara só a tendência com a de 1 h antes.
  - **Pressão** (`pressureAt`): cada pilha cheia vendida soma `pressurePerStack` (0,08) e cada pilha cheia comprada tira o mesmo, proporcional à quantidade (`unidades / maxStack`). Cai pela metade a cada `pressureHalfLifeMs` (2 h). Um momento anterior ao último registro usa o valor inteiro, e um sorteio antigo não volta o relógio da pressão.
- **Comprar** (`fleaBuy`): sempre uma pilha cheia (`lotSize` = `maxStack`) por `ceil(preço × lote × buyMarkup (1,1) / basePrice da moeda)`. Sem limite de estoque. Guarda com `storeAll` antes de pagar; o item vem **sem** `fir`. Soma a pressão de demanda e as estatísticas.
- **Anunciar** (`listItem`): preço inteiro ≥ 1; `listingValue` exige mercado liberado, item no estoque (pode estar em contêiner), negociável, vazio (grades, cartuchos e carregador encaixado) e, para `firCategories` (`barter`, `key`), `fir`. Valor = preço de mercado × quantidade. Até `slots` (3) anúncios. Taxa (`listingFee`) = `max(1, ceil(valor × feeRate (0,04) × (preço/valor)²))`, paga do estoque. O item sai do estoque (`location = null`) e fica no anúncio por `listingMs` (12 h).
- **Vendas** (`fleaTick(player, config, now)`): um sorteio a cada `checkMs` (1 min), alinhado ao relógio (`k × checkMs`), desde `lastCheck` (ou do anúncio mais antigo, se for mais novo) até agora. Em cada sorteio `k`, cada anúncio com `listedAt < t ≤ expiresAt` vende com chance `saleChance(razão)` usando `Rng(mix(seed, id, k))`, onde razão = preço / (preço de mercado no momento × quantidade) e `saleChance` = `min(1, 0,05 × ((2 − razão)/(2 − 1))²)`, 0 com razão ≥ `maxRatio` (2). Pelo preço de mercado, média de 20 min (`expectedSaleMs = checkMs / chance`). A venda vira resultado `sold` (dinheiro a retirar), soma pressão de oferta e estatísticas; anúncio vencido vira `expired` (item a retirar). O jogo chama ao carregar e a cada `HIDEOUT_TICK_MS`, junto com o esconderijo.
- **Cancelar** (`cancelListing`): o item volta com `storeAll` (sem espaço, continua anunciado); a taxa não volta. **Retirar** (`collectResult`): dinheiro em pilhas ou o item vencido; sem espaço, o resultado espera.
- **Balanceamento** (`tests/data/flea.test.ts`): tendência sempre em ±20%; comprar e anunciar na hora pelo preço de mercado sempre dá prejuízo (markup + taxa > alta da pressão); vender no mercado no pior caso (−20%, menos a taxa) paga mais que o melhor vendedor; pelo preço de mercado vende em 14–28 min em média, e 50% acima demora pelo menos 2,5× mais.
- **Tela:** abas Comprar (pilha, preço, seta ▲/▼/=), Vender (itens do topo do estoque; preço pedido de 50% a 200% em passos de 5%, com valor, preço, taxa e tempo médio) e Anúncios (resultados com "Retirar", anúncios com o tempo restante e "Cancelar"). Bloqueado pelo nível, tudo fica apagado e o topo diz o nível que falta. Atualiza a cada `FLEA_REFRESH_MS = 500` ms.
- Pendências: anúncios de outros jogadores com quantidade limitada, mais vagas por nível, preço sugerido por histórico, vender arrastando do inventário.

### Resumo do tempo fora

- Arquivos: `src/core/offline.ts` (`catchUp`, `hasNews`, `OFFLINE_MIN_MS`), tela `src/ui/scenes/OfflineScene.ts` (`offlineLines`), integração em `src/game.ts`.
- **Desde quando:** `hideout.lastTick`, que vai para o save e anda a cada tick do jogo; por isso não precisou de campo novo no save.
- **`catchUp(player, {hideout, flea, traders}, now)`:** anota o estado antes, roda `hideoutTick` e `fleaTick` e devolve: tempo fora; obra concluída (`endsAt ≤ now`); receitas com `endsAt` em `(desde, agora]`; renda a mais da central (`incomeAvailable(agora) − incomeAvailable(desde)`, mínimo 0, então renda que já estava no limite não conta); vida, energia e hidratação recuperadas; vendas (quantidade e rublos) e anúncios vencidos do mercado; raid Scav liberada (`readyAt` em `(desde, agora]`); vendedores já visitados cujo `restockAt` caiu em `(desde, agora]`.
- **Quando aparece** (`hasNews`): tempo fora ≥ `OFFLINE_MIN_MS` (1 min) e pelo menos uma novidade. O jogo calcula ao carregar; o resumo aparece uma vez, depois do título e antes do inventário ou da raid em andamento.
- **Tela:** "Enquanto você estava fora (duração)" com uma linha por novidade e o botão "Continuar".

### Loadouts

- Arquivos: `src/core/loadout/` (`types.ts`, `loadout.ts`), tela `src/ui/scenes/LoadoutScene.ts` (botão "Loadouts" na `RaidSetupScene`, à esquerda de "Voltar"). Estado em `player.loadouts` (até `MAX_LOADOUTS = 5`).
- **Loadout** (`Loadout`): nome, item de cada slot (`slots`), carregador encaixado em cada arma (`magazines`) e itens carregados (`carried`, somados por tipo, de bolsos, colete tático e mochila, incluindo o conteúdo de contêineres; o contêiner seguro fica de fora). `snapshotLoadout` tira a foto do equipamento atual; "Salvar o atual" usa o primeiro nome livre `Loadout N`; "Trocar pelo atual" mantém o nome.
- **O que falta** (`missingItems`): `requiredItems` (slots + carregadores + carga, somados por tipo) menos o que o jogador tem vestido, encaixado nas armas vestidas, carregado e no estoque.
- **Montar** (`applyLoadout`), só com o que há no estoque, sem comprar:
  - **slots:** igual fica; diferente pega do estoque e guarda o antigo no estoque (sem espaço, desfaz e conta como "sem espaço"); slots fora do loadout não mudam;
  - **carregadores:** encaixa o carregador do tipo pedido com mais cartuchos do estoque; o antigo vai para o estoque (sem espaço, fica). A munição é carregada depois, por `loadMagazines` (veja Carregar ao montar);
  - **carga:** completa até a quantidade pedida com `autoPlace` nas grades de carga, separando a última pilha; o que não couber volta para o lugar. Itens a mais nas grades ficam.
  - Devolve `missing` (não havia no estoque) e `noSpace` (não coube).
- **Comprar** (`purchaseOptions`): ofertas em dinheiro dos vendedores (nível, quest e estoque ok, preço convertido para rublos pelo `basePrice` da moeda) e o mercado (se liberado e negociável), da mais barata por unidade para a mais cara. `estimateMissing` soma `ceil(falta / lote) × preço` da melhor opção e lista o que não está à venda. `buyMissing` compra cada item na opção mais barata que der certo, repetindo até cobrir a falta. `quickEquip` ("Comprar e equipar") = `buyMissing` + `applyLoadout`.
- **Tela:** lista de loadouts e "Salvar o atual"; o loadout escolhido mostra cada item com "tem" ou "falta N", o custo estimado do que falta e o que não está à venda; ações "Equipar", "Comprar e equipar", "Trocar pelo atual" e "Excluir"; mensagem em verde ou vermelho. Voltar salva o jogo e volta à preparação da raid.
- **Renomear** (Fase 11F; `renameLoadout`, botão "Renomear" ao lado do nome, que pede o nome com `window.prompt` ou a opção `ask` da cena): nome sem espaços nas pontas, não vazio, até `MAX_LOADOUT_NAME = 24` letras e diferente dos outros loadouts. As raids automáticas que usavam o nome antigo passam a usar o novo.
- **Carregar ao montar** (Fase 11F; `loadMagazines`): depois de "Equipar" e "Comprar e equipar" (e quando as raids automáticas montam o loadout), as armas vestidas recebem a câmara e o carregador ou tubo cheios, e os carregadores levados no equipamento são enchidos, com a munição do calibre que está no estoque: primeiro os tipos que estão na carga do loadout, depois as pilhas maiores. A mensagem diz "carregou N cartucho(s)".
- Pendências: escolher o tipo de munição de cada carregador no loadout.

### Raids automáticas

- Arquivos: `src/core/auto/` (`types.ts`, `auto.ts`), tela `src/ui/scenes/AutoRaidScene.ts` (botão "Automático" na `RaidSetupScene`, à esquerda de "Loadouts"), integração em `src/game.ts`. Estado em `player.auto` (`AutoState`).
- **Regras** (`AutoRules`, padrão em `createAutoRules`): mapa (id inválido = o primeiro), estratégia, loadout pelo nome (`null` = equipamento como está), comprar o que faltar, raids na sequência (1, 3, 5, 10, 20 ou `MAX_AUTO_RAIDS = 50`; padrão 5), vida mínima (fração da vida total; padrão 60%), vida baixa = esperar curar (padrão) ou parar, parar se morrer (padrão sim).
- **Sequência** (`startAuto` zera `done`, histórico e motivo e marca `nextAt = agora`; `stopAuto` guarda o motivo). `autoTick(player, ctx, now)`, repetido até não haver mais o que fazer:
  1. Se a raid em andamento é a da sequência (`current === startedAt`) e o log terminou (`raidEndsAt = startedAt + minutos × MS_PER_RAID_MINUTE`), fecha com `finishRaid`, mesmo com a sequência já parada. Uma raid começada pelo jogador fica até ele fechar, e a sequência espera.
  2. Rodando e `now ≥ nextAt`: calcula o esconderijo até `nextAt` e confere as regras (vida → loadout → arma com munição). Com vida baixa e "esperar", `nextAt = now` e tenta de novo no próximo tick. O loadout é montado (`applyLoadout`, ou `quickEquip` com compra) e para se faltar algo ("Faltou equipamento do loadout: ...").
  3. Começa a raid com `startRaid` no momento `nextAt` (relógio fixo), soma o progresso das quests, guarda o resultado no histórico (até `AUTO_LOG_SIZE = 20`, mais novo primeiro) e marca `nextAt = fim do log + AUTO_GAP_MS (5 s)`. Morreu/MIA com "parar se morrer": para ("O PMC morreu"/"O PMC ficou MIA"); chegou ao número de raids: para ("Concluiu N raid(s)").
- **Tempo com o jogo fechado:** como cada raid começa no `nextAt` anterior, as raids que caberiam no tempo fora acontecem em sequência ao abrir o jogo. O jogo chama `autoTick` ao carregar (antes do resumo do tempo fora, para cada raid ver o esconderijo no seu momento) e a cada `HIDEOUT_TICK_MS`. O resumo ganha a linha "Raids automáticas: N feita(s), extraiu X". Com vida baixa e "esperar", a espera só é conferida no momento do tick (com o jogo fechado, a raid seguinte começa ao abrir).
- **Navegação:** com a sequência rodando, o título leva às raids automáticas (depois do resumo). "Ver raid atual" abre a `RaidScene`, e fechá-la volta para as raids automáticas.
- **Tela:** um botão por regra (clique troca o valor), "Começar"/"Parar" (começar já faz a primeira raid na hora), "Ver raid atual", a situação (rodando, próxima em, esperando a vida, esperando o jogador fechar a raid, parado e o motivo), os totais e as últimas 10 raids. Atualiza a cada `AUTO_REFRESH_MS = 500` ms.
- Pendências: retomar sozinha depois de curar quando a regra é "parar", alternar mapas, regra de dinheiro mínimo.

### Configurações, tutorial, animações e som

- Arquivos: `src/core/settings.ts`, `src/ui/scenes/SettingsScene.ts` (botão "Configurações" na `TitleScene`), `src/data/tutorial.ts` (`TUTORIAL`), `src/ui/components/TutorialPanel.ts`, `src/ui/audio.ts`, `Button.feedback`/hover em `src/ui/components/Button.ts`, `SceneManager.fadeMs`.
- **Configurações** (`Settings`, chave `escape-from-idle:settings`, separada do save porque é do aparelho; o save não mudou de versão): volume dos efeitos (0/25/50/75/100%, padrão 50%), atraso do tooltip (0/300/600 ms, padrão 300), velocidade inicial do log da raid (x1/x4/x16, padrão x1), animações (padrão ligadas) e o passo do tutorial. `loadSettings` devolve o padrão para JSON ilegível e para cada valor fora das opções. Cada mudança na tela é aplicada e guardada na hora (`applySettings` em `game.ts`). O botão de configurações no título interrompe a propagação do clique, para não começar o jogo.
- **Tutorial:** 8 passos (`TUTORIAL`) num painel no canto de baixo à direita do inventário (`InventoryScene` aceita `tutorial` e chama `layout` no resize). "Próximo" avança (no último, "Concluir") e "Pular" termina; o passo vai para as configurações. Com o passo no fim, o painel não aparece. "Rever o tutorial" volta ao passo 0.
- **Animações:** com elas ligadas, `SceneManager.fadeMs = FADE_MS (200)`, e a cena nova vai de alpha 0 a 1 linearmente no `update`. Os botões clareiam o fundo com o ponteiro em cima (`HOVER_TINT`, pelo `tint`, sem mexer no alpha usado para "desativado").
- **Som:** `Button.feedback` toca `sfx-press` (do template) a cada clique, pelo `playSound`, com o volume das configurações. Volume 0, som não carregado, módulo ausente ou erro do navegador não tocam nada.
- Pendências: arte própria dos itens (substituir os placeholders), músicas e mais efeitos sonoros, animações nas telas de raid e inventário.

### Durabilidade da armadura

- Arquivos: `src/core/inventory/durability.ts`, `Item.durability`, `wornArmorFactor`/`armorWear` em `src/core/raid/combat.ts`, `repairCost`/`repair`/`damagedItems` em `src/core/trade/trade.ts`, aba "Consertar" na `TradersScene`.
- **Durabilidade:** itens com `stats.durability` (colete civil 40, capacete 30). `Item.durability` guarda o valor atual; sem o campo = inteira (`durabilityOf`, `durabilityRatio`, `isDamaged`, `wear` sem passar de 0, `restoreDurability` apaga o campo).
- **Na raid:** cada acerto do inimigo na parte protegida (cabeça → capacete, tronco → colete) passa `dano × wornArmorFactor(pen, classe, durabilidade/máx.)` e depois gasta `armorWear = dano × ARMOR_WEAR (0,05) × (0,5 + 0,5 × min(1, pen / (classe × 10)))`. Ao chegar a 0, o log avisa "X quebrou" (uma vez); quebrada não protege nem gasta mais. A raid Scav usa as mesmas regras (o equipamento sorteado começa inteiro).
- **Valor:** `totalValue` multiplica o preço por `durabilityValueFactor` = `BROKEN_VALUE (0,3) + 0,7 × durabilidade/máx.` (1 exato quando inteira), então vendedores e mercado pagam menos por armadura gasta.
- **Conserto** (`repair`): só vendedores com `repairRate`. Preço = `max(1, ceil(basePrice × (1 − durabilidade/máx.) × repairRate / basePrice da moeda))`, pago do estoque; o item (no estoque, vestido, dentro do equipamento ou nos bolsos) volta inteiro. Soma ao volume e à reputação.
- **Outros:** o tooltip mostra `Durabilidade: atual/máx.` quando gasta (arredondado para cima); os loadouts preferem a armadura mais inteira do estoque.
- Pendências: perda de durabilidade máxima a cada conserto, durabilidade de armas.

### Cirurgia

- Arquivos: `RaidSimulation.surgery` e `fight(kind, surprise)` em `src/core/raid/simulate.ts`, `ItemStats.surgery`, item `med_surgery` (Kit cirúrgico de campo, criado pelo pipeline: 2x1, 12.000 ₽, `surgery: 6`; vendido pela Doutora Iara no nível 1, estoque 2), `operate` em `src/core/hideout/hideout.ts`, aviso em `raidWarnings`.
- **Parte destruída** (0 PV, não vital) não é curada por remédios e não volta sozinha ao extrair. Morrer ou ficar MIA continua restaurando tudo.
- **Na raid** (início dos cuidados automáticos, `selfCare`): para cada parte destruída, se houver um item com `stats.surgery` no equipamento (bolsos, colete tático, mochila, contêiner seguro), usa um (some da pilha) e opera:
  1. passam `stats.surgery` minutos (`advance`, com gasto de energia/hidratação; os cuidados de dentro desse tempo não começam outra cirurgia);
  2. se o mapa tem ameaças, há encontro surpresa com chance `SURGERY_AMBUSH (0,35) × encontro da estratégia` (furtivo 0,21, equilibrado 0,35, agressivo 0,56). O inimigo é sorteado pelos pesos de ameaça do mapa;
  3. na surpresa, o PMC **não pode evitar** a briga e a chance de atirar primeiro cai para `SURPRISE_FIRST_SHOT (0,5) ×` a normal. O resto é a briga normal, então Percepção (atirar primeiro), Mira (acertar) e Vitalidade (dano recebido) decidem se ele sobrevive e se abate o inimigo (com abate, karma e revista como sempre);
  4. sobrevivendo, a parte volta com 1 PV (`restorePart`). Morrendo na emboscada, não volta.
  - Log (`surgery`, em verde): "Começou a cirurgia: Parte (N min)" e "Cirurgia concluída: Parte recuperado"; a surpresa aparece como "X apareceu no meio da cirurgia!".
- **Na enfermaria** (nível 2, `surgeryMinutes = 30`): a cada 30 min de esconderijo, uma parte destruída volta com 1 PV (na ordem de `BODY_PARTS`), antes da cura por minuto. O progresso fica em `hideout.surgeryProgress` entre os cálculos (também com o jogo fechado) e some quando não há mais parte destruída.
- **Aviso antes da raid:** "Parte do corpo destruída e nenhum kit cirúrgico".
- Pendências: kit com vários usos, perda de vida máxima da parte operada, kit no loot dos mapas.

### Inimigos com equipamento

- Arquivos: `EnemyDef.gear` (`EnemyGear`, `EnemyWeapon`, `EnemyGearOption` em `src/core/raid/types.ts`), `armEnemy`, `bodyGear` e o colete gasto em `playerTurn` (`src/core/raid/simulate.ts`), dados em `ENEMIES` (`src/data/maps.ts`). Itens novos pelo pipeline: Colete de placas Muralha (`armor_heavy`, classe 4, durabilidade 60, 48.000 ₽, Mercador Tito nível 3), Capacete fechado K-3 (`helmet_k3`, classe 3, 40, 24.000 ₽, Tito nível 2) e Cartucho 5.45 perfurante (`ammo_545ap`, dano 40, pen. 38, 260 ₽; não é vendido, só vem do corpo de PMCs inimigos).
- **Sorteio** (`armEnemy`, a cada encontro, por peso): arma (com carregador e munição), colete e capacete (`item: null` = sem). Dano e penetração vêm da munição, os disparos de `burstFor(arma)` e a classe do colete sorteado (sem colete = 0). O log mostra "Avistou X com Arma (colete classe N)".
  - Scav: PK-9 com 9mm (peso 3) ou VK-74 com 5.45 FMJ (1,5); colete civil 2/7; capacete TK-1 2/8.
  - PMC: VK-74 com 5.45 FMJ ou perfurante (meio a meio); colete civil ou Muralha (meio a meio); capacete nenhum 1, TK-1 2, K-3 2.
- **Colete do inimigo:** começa inteiro. Cada acerto do PMC passa `dano × wornArmorFactor(pen, classe, durabilidade/máx.)` e gasta `armorWear(dano, pen, classe)` (as mesmas fórmulas do colete do PMC); quebrado, deixa passar tudo.
- **Corpo revistado** (com a chance de revista da estratégia): além do item da tabela do mapa, todo o equipamento (`bodyGear`), cada peça guardada pelas regras de loot (pode faltar espaço): a arma com o carregador encaixado (ou o tubo) com `int(0, capacidade)` cartuchos, o colete com a durabilidade que sobrou da briga, o capacete com 50% a 100% da durabilidade (`ENEMY_HELMET_DURABILITY`) e `ammoCount` cartuchos soltos (Scav 0–12 de 9mm ou 0–20 de 5.45; PMC 10–40).
- **Balanceamento:** com munição de verdade, um acerto na cabeça mata mais fácil (9mm e 5.45 passam o capacete TK-1 com mais de 35 de dano), então a precisão do Scav caiu de 0,28 para 0,13. As taxas de extração ficaram perto das de antes (Periferia equilibrado ~91%, Porto furtivo ~91%, agressivo 3 a 4 pontos abaixo), e o loot médio quase dobrou (Periferia equilibrado de ~4.800 para ~9.000 ₽).
- Pendências: inimigos com consumíveis e mochila, escopeta nas mãos dos inimigos (calibre 12 mata com um acerto), PMC inimigo com nível/skills.

### Balanceamento centralizado

- Arquivos: `src/core/balance.ts` (`CoreBalance`, `CORE_DEFAULTS`, `coreBalance`, `setCoreBalance`, `resetCoreBalance`, `readCoreBalance`), `src/data/balance.ts` (`BalanceDocument`, `DEFAULT_BALANCE`, `applyBalance`, `currentBalance`, `resetBalance`, `readBalance`), `Catalog.applyOverrides` e `ItemOverride` em `src/core/inventory/item.ts` (Fase 11I).
- **Core:** a lógica lê o valor atual com `coreBalance()` na hora do cálculo. Seções: `durability` (`armorWear`, `brokenValue`), `xp` (`consumableSkill`, `magDrillsPerRound`), `trade` (`reputationPer100k`), `scav` (`cooldownMs` e os efeitos do karma) e `hideout` (multiplicadores `buildTime`, `productionTime` e `income`; `buildDuration` e `recipeDuration` já aplicam) e `fuel` (`perHour`, `perCan`, `max` do combustível do gerador). As constantes antigas (`ARMOR_WEAR`, `BROKEN_VALUE`, `SCAV_COOLDOWN_MS`, `SCAV_KARMA`, `CONSUMABLE_SKILL_XP`, `MAG_DRILLS_XP_PER_ROUND`, `REPUTATION_PER_100K`) continuam exportadas como os valores padrão.
- **Documento** (`BalanceDocument`): `core`, `items` (ajustes por id: `basePrice` e os números de `BALANCE_STAT_KEYS`: dano, penetração, classe, durabilidade, capacidade, cura, energia, hidratação, cirurgia) e `flea` (os números do `FLEA`, `FLEA_BALANCE_KEYS`). `applyBalance` troca o core, aplica os ajustes no catálogo (as definições são as mesmas, então os itens já criados mudam na hora; sem ajuste, voltam ao original) e copia os números para o próprio `FLEA`.
- **Leitura de fora** (`readBalance`, para o servidor): números finitos e ≥ 0; os tempos do mercado (`trendMs`, `pressureHalfLifeMs`, `checkMs`, `listingMs`) precisam ser > 0 e `maxRatio` > 1; ajustes de itens fora do catálogo somem. O que faltar ou for inválido fica com o padrão.
- O motor de raid atual não entrou (sai na Fase 12); a raid nova vai ler os valores daqui desde o começo.
- **No servidor** (Fase 11J): sala `balance` do Colyseus (`server/BalanceRoom.ts`), com os valores num SQLite (`server/balanceStore.ts`, `BalanceStore`: uma linha com o JSON e a versão; arquivo `BALANCE_DB` ou `data/server.db`, fora do git). Quem entra recebe `{version, doc}` ("balance"; `doc` nulo = padrões). "set" grava o documento depois de `readBalance` e "reset" volta aos padrões; os dois sobem a versão e avisam todos os conectados. Fora do desenvolvimento (`NODE_ENV=production`), o servidor recusa mudar ("error").
- **No cliente** (`src/balanceSync.ts`, `BalanceSync`): ao abrir, aplica a cópia local (`escape-from-idle:balance`); `main.ts` passa `joinBalance: joinBalanceRoom` para o `startGame`, que conecta sem esperar. Cada "balance" recebido passa por `readBalance`, é aplicado na hora (`applyBalance`), vira a cópia local e avisa os ouvintes (`onChange`). Sem servidor, fica com a cópia local ou os padrões. `save(doc)` e `reset()` pedem ao servidor (a janela de admin usa). Uma raid já resolvida não muda, porque o resultado foi sorteado no começo.
- **Janela de admin** (Fase 11K; `src/ui/admin/AdminPanel.ts`): painel HTML por cima do canvas (o Pixi não tem campo de texto), criado pelo `startGame` só em desenvolvimento (`admin` ou `import.meta.env.DEV`). F10 abre e fecha. Mostra a conexão e a versão, os números do core por seção, os do mercado e, para o item escolhido na lista, o preço base e os dados técnicos que ele tem. Editar muda o rascunho (`draft`); vazio, negativo ou não número volta ao valor anterior. "Salvar" manda o rascunho ao servidor (`BalanceSync.save`) e "Restaurar padrões" pede o reset; sem servidor, avisa que não deu. Valores novos que chegam do servidor atualizam o rascunho e a janela. Não abre com uma raid em andamento (`player.raid.active`), e o tick do jogo fecha a janela quando uma raid começa (inclusive automática).

### Catálogo ampliado

- Fase 11L: 51 itens novos pelo pipeline (87 no total, com os acessórios e o galão), com nomes, descrições e dados próprios e imagem placeholder. Armas (Submetralhadora VR-9, Fuzil KR-47, Fuzil de precisão SD-7, Fuzil de ferrolho M-91 e Revólver R-50 com tubo interno, Metralhadora leve RK-16), carregadores (VR-9, KR-47, SD-7, Tambor RK de 95), munições (9mm perfurante, 7.62x39 comum e perfurante, 7.62x54R comum e perfurante, balote calibre 12, .357), coletes (Patrulha classe 3, Bastião classe 5), capacetes (antimotim 1, aço 2, Rochedo 5), colete tático de peito, mochilas (escolar colorida, expedição, assalto), remédios (torniquete, analgésicos, IFAK, tala), comida (bolachas, suco, ração), permutas, chaves, itens de inteligência (pen drive criptografado, pasta de documentos, pen drive militar) e raros (moeda de ouro, leão de bronze, transiluminador).
- **Dados da raid nova** em `ItemStats` (também nas armas, munições e coletes antigos): `damageDie` (lados do dado de dano da arma: pistola 6, revólver e submetralhadora 8, escopeta 12, fuzis e metralhadora 20), `damageBonus` (dano fixo da munição: 0 a +8), `weaponClass` (id da skill de combate que a arma treina), `vestType` (`light`/`heavy`) e `visibility` (mochilas coloridas ou enormes: +2). O tooltip mostra tipo, dado, bônus, colete leve/pesado e "Chama atenção". `damageDie`, `damageBonus` e `visibility` também são editáveis na janela de admin. A raid atual ainda usa `damage`/`penetration`.
- **Vendedores:** o Coronel vende a VR-9, o carregador e a munição 7.62x39 (nível 2) e o KR-47 com carregador (nível 3); a Doutora, torniquete, tala, bolachas, suco (nível 1) e IFAK (nível 2); o Tito, capacete antimotim e mochila escolar (nível 1), colete de patrulha e colete de peito (nível 2) e mochila de assalto (nível 3); o Nico, fita isolante e pregos. As listas passam de uma página (10 linhas). Os outros itens ainda não aparecem no loot do motor atual: entram nas tabelas dos contêineres da raid nova (Fase 12).
- **Óculos e cobertura do rosto** (Fase 12E2; categoria `accessory`, "Acessório"): Óculos escuros (`eyewear_sun`, Percepção +1, 3.500 ₽), Óculos de tiro (`eyewear_shooting`, +2, 9.000 ₽), Óculos táticos (`eyewear_tactical`, Percepção +3 e Furtividade +1, 24.000 ₽), Balaclava (`face_balaclava`, Furtividade +2, 4.500 ₽) e Lenço de rosto (`face_scarf`, Furtividade +1, 2.500 ₽). Os bônus são pontos de d20 em `ItemStats.perceptionBonus`/`stealthBonus` (editáveis na janela de admin; o tooltip mostra "Percepção: +N" e "Furtividade: +N"). O Tito vende óculos escuros e lenço (nível 1), balaclava e óculos de tiro (nível 2) e compra acessórios; o Nico compra por 0,7. Os óculos táticos só vão aparecer no loot.
- **`gearBonuses(equipment)`** (`src/core/inventory/gear.ts`): `{ perception, stealth, visibility }` somados dos itens vestidos (`perceptionBonus`, `stealthBonus` e `visibility` da mochila).

### Raid em matriz (Fase 12, em construção)

O motor novo é construído ao lado do atual e só assume na 12H.

- **12A, mapa em matriz** (`src/core/matrix/`: `types.ts`, `matrix.ts`; dados em `src/data/matrixMaps.ts` e `src/data/containers.ts`):
  - **Matriz** (`MatrixMap`): `cells[y][x]` com terreno (`road`, `grass`, `metal`, `rubble`, `building`), contêiner opcional e marcas de spawn de Scav/PMC; extrações com posição e requisito; pontos de interesse (`PointOfInterest`: células, nome, `obvious`). `inBounds`, `cellAt`, `neighbors` (sem diagonal), `freeExtracts`, `validateMatrix` (linhas do tamanho certo, extrações e pontos dentro do mapa, contêineres conhecidos e pelo menos uma extração livre na coluna da direita).
  - **Geração** (`generateMatrix(def, rng)`, sempre igual para a mesma receita, `MatrixMapDef` com `seed`): tamanho `10 + 4d` × `6 + 2d` (d = dificuldade: Periferia 14×8, Cimenteira 18×10, Porto 22×12); terreno sorteado pelos pesos da receita; extrações livres na coluna da direita e as com requisito entre 55% e 80% da largura; pontos de interesse em blocos 2x2 (terreno `building`) com os contêineres da receita; `2 + 2d` spawns de Scav e `d` de PMC a partir da 3ª coluna; contêineres soltos em `CONTAINER_DENSITY = 12%` das células, a partir da 2ª coluna. A entrada é a coluna da esquerda.
  - **Contêineres** (`CONTAINERS`, `ContainerDef`): os 17 tipos (jaqueta, gaveta, caixote, caixa registradora, caixa de ferramentas, bolsa esportiva, mala, bolsa médica, gabinete de PC, caixa de munição, corpo, esconderijo no chão, caixa de granadas, caixa de suprimentos, barril enterrado, caixa de armas, cofre), cada um com raridade (1 a 5), turnos para revistar (2 a 5), chance de achar, chance de item raro e tabelas comum e rara próprias. `rollContainer(def, rng, factory, rareBonus)` sorteia da rara com `rareChance + rareBonus`, senão da comum. A caixa de granadas ainda dá munição pesada (não há granadas no jogo).
  - **Mapas** (`MATRIX_MAPS`, `matrixMapById`): Periferia (Farmácia óbvia, Apartamentos), Cimenteira (Oficina óbvia, Escritório da fábrica, Enfermaria) e Porto (Posto militar e Alfândega óbvios, Navio-hospital, Depósito dos contrabandistas), com as extrações da raid atual.
- **12B, movimento e estratégia** (`src/core/matrix/strategy.ts`, `path.ts`, `plan.ts`, `raid.ts`; números em `coreBalance().matrix`, editáveis na janela de admin):
  - **Estratégias** (`MATRIX_STRATEGY_IDS`): Rato, Seguro, Neutro, Agressivo, Psicopata. `moveFactor` = multiplicador dos turnos por célula (padrão 2, 1,25, 1, 0,75, 0,5). A estratégia escolhida fica guardada por mapa em `raid.mapStrategies` (`mapStrategy`/`setMapStrategy`; padrão Neutro; save v16).
  - **Turnos por célula** (`stepTurns`): turnos do terreno (rua, mato, metal e prédio 1; escombros 2) × estratégia, arredondado para cima, no mínimo 1. A raid é contada em turnos, sem MIA.
  - **Caminho** (`findPath`): Dijkstra só entre vizinhas, com o custo da célula + um custo extra da estratégia (`cellPenalty`): Rato e Seguro somam `spawnAvoidCost` (6) nas células de spawn conhecidas e nas vizinhas; o Rato soma `ratInteriorCost` (2) fora das bordas de cima e de baixo.
  - **Conhecimento** (`MatrixKnowledge`: extrações, pontos de interesse, contêineres e spawns conhecidos; `fullKnowledge` = tudo, até a 12C).
  - **Rota** (`planRoute`): extração conhecida e utilizável de caminho mais curto; Rato e Seguro vão direto; Neutro visita os pontos de interesse conhecidos com desvio de até `neutralDetour` (30%), do mais perto para o mais longe; Agressivo visita os pontos de interesse e os contêineres conhecidos de raridade ≥ 3; Psicopata, todos os pontos e contêineres conhecidos; os dois vão sempre ao alvo mais perto de onde estão.
  - **Raid** (`runMatrixRaid`, só movimento por enquanto): entra numa linha sorteada da coluna da esquerda, segue a rota gastando por turno energia (`energyPerTurn` 0,4), hidratação (0,5) e dando XP de Resistência (0,25), com os descontos das skills; sem extração conhecida, vai até a borda direita e procura a mais perto; paga a passagem ao extrair (`canUseExtract`: chave, pagamento, sem mochila). Log com `start`, `target`, `search` e `extract`.
- **12C, conhecimento do mapa** (`src/core/matrix/knowledge.ts`; estado em `player.mapKnowledge[mapa] = { xp, found }`, save v17; números em `coreBalance().knowledge`):
  - **Nível** = `floor(xp / xpPerLevel)` (60). Cada nível revela `revealPerLevel` (2) pontos na ordem de `revealOrder`: extrações, pontos de interesse que não são óbvios, spawns e contêineres, embaralhados pelo id do mapa (sempre a mesma ordem para o mesmo mapa).
  - **O que ele sabe** (`knowledgeFor`): os pontos de interesse óbvios, os pontos que já achou (`found`) e os revelados pelo nível. No começo não conhece nenhuma extração, então a raid vai até a borda direita e procura.
  - **Aprender** (`learnFromRaid`): XP = células percorridas × `cellXp` (1) + `surviveXp` (20) se sobreviveu + `containerXp` (5) na primeira vez que passa por cada contêiner. Os contêineres por onde passou e a extração usada ficam em `found` para sempre.
- **12D, loot nos contêineres** (`src/core/matrix/loot.ts`; números em `coreBalance().matrix`):
  - Ao entrar numa célula com contêiner ainda não revistado nesta raid, a estratégia decide (`wantsSearch`: o Seguro pula revistas de mais de `safeMaxSearchTurns`, 4).
  - **Turnos** (`searchTurns`): os do contêiner, −`knownSearchDiscount` (1) se ele já é conhecido, −`fastSearchDiscount` (1) no Agressivo e no Psicopata, mínimo 1.
  - **Achar** (`findChance`): chance do contêiner × (1 + Percepção), × `safeFindFactor` (0,8) no Seguro, até 1. Achando, sorteia com `rollContainer` e dá `perceptionXpPerLoot` (2) de XP de Percepção.
  - **Guardar** (`stashFound`): nos bolsos, colete tático, mochila e contêiner seguro. O personagem não sabe o valor dos itens: Agressivo e Psicopata, sem espaço, largam itens desta raid vindos de contêineres menos raros (do menos raro para o mais raro) até caber; se nem assim couber, nada muda. Os outros só guardam se couber.
  - **Inventário cheio** (`fullThreshold`, `fillRatio` das células de carga): o Rato vai para a extração com `ratFullAt` (80%), o Neutro com `neutralFullAt` (90%); Rato, Neutro e Agressivo também vão quando um item achado não cabe (`leavesWhenFull`). O resto da rota é abandonado.
  - Log: `loot` ("Achou X em Contêiner"), `search` ("Revistou X e não achou nada"), `lootSwap`, `lootLeft` e "Inventário cheio: indo para a extração". O resultado traz `found` (itens achados que ficaram).
- **12E, inimigos e percepção** (`src/core/matrix/enemies.ts`; `MatrixRaid` em `raid.ts`; números em `coreBalance().encounter`):
  - **Turno a turno:** cada turno gasto (andar, revistar) passa pelos inimigos (`enemyTurn`): spawn, movimento e percepção, um inimigo por vez.
  - **Spawn** (`rollSpawn`): d10 ≥ `spawnBase − ⌈spawnPerDifficulty × dificuldade⌉` (11 e 1,5: 20%, 30%, 50%, 60%, 80% nas dificuldades 1 a 5) faz surgir um inimigo num ponto de spawn sorteado (PMC com peso `pmcSpawnWeight` 0,3 frente a 1 do Scav). Eles se acumulam.
  - **Movimento** (`moveEnemy`): perseguindo, 1 célula por turno na direção do personagem (horizontal primeiro); senão, com d6 ≥ `moveBase − dificuldade` (7), anda para uma vizinha sorteada.
  - **Alcance** (`hearingRange`): `hearingRange` (2) células; o Rato só na mesma célula; o Agressivo +1; o Psicopata +2, e +1 em mato ou metal.
  - **Percepção** (`perceptionContest`): no alcance, os dois rolam d20; o personagem soma a Percepção × `skillToD20` (10 por 100% de bônus) e o inimigo soma dificuldade × `enemyPerDifficulty`, a visibilidade da mochila, menos a Furtividade × 10 e menos `safeStealth` (3) no Seguro. Maior percebe; empate, ninguém.
  - **O personagem vê primeiro:** briga se quiser (`wantsToFight`: o Rato nunca; o Seguro com mais de 60% de vida e remédio e munição; os outros sempre), com headshot e atacando primeiro; senão ignora o inimigo até ele sair do alcance.
  - **O inimigo vê primeiro:** vem atrás; a cada turno o personagem tenta notar de novo. Se chega sem ser notado, a briga começa com o headshot do inimigo. Notado, o personagem foge ou enfrenta (`wantsToFlee`: Rato e Seguro fogem; o Neutro foge abaixo de 40% de vida; Agressivo e Psicopata enfrentam, com a iniciativa disputada no d20). Fugir: `fleeRoll`, o d20 do personagem (+ Resistência e Percepção × 10 + nível do mapa × 0,5; o Rato com −`ratFleePenalty`, 4) precisa ser ≥ `fleeFactor` (2) × o do inimigo; dando certo, despista (o Agressivo e o Psicopata então atacam com headshot); não dando, continua fugindo (cada célula custa `fleeExtraTurns`, 1, a mais) e tenta de novo no próximo turno. Quando ele chega, a briga começa com a iniciativa disputada.
  - O Rato, ao perceber, ser percebido ou entrar numa briga, vai direto para a extração.
  - **Briga:** `MatrixRaidSetup.fight(start, raid)` resolve (`won`, `died`, `fled`); a 12F traz o combate d20. Morrer encerra a raid (`killed`, sem extração).
  - 12E2: `gearBonuses(equipment)` entra na disputa: a percepção do personagem soma o `perception` dos óculos, e a do inimigo soma a `visibility` da mochila e tira o `stealth` dos óculos e da cobertura do rosto.
- **12F, combate d20** (`src/core/matrix/combat.ts`, `createD20Fight(ENEMIES)` é o `fight` da raid; números em `coreBalance().combat`):
  - **Inimigo** (`armFoe`): arma, carregador, munição, colete e capacete sorteados pelos pesos de `EnemyDef.gear`; vida `scavHealth` (60) ou `pmcHealth` (90). Inimigos perseguindo na mesma célula entram na mesma briga.
  - **Headshots:** o inimigo que chega sem ser notado acerta com `enemyHeadshot + dificuldade × enemyHeadshotPerDifficulty` (0,2 + 0,05/nível); o capacete segura com `classe × helmetSavePerClass × durabilidade/máx.` (0,15 por classe) e perde metade da durabilidade máxima; sem segurar, a cabeça vai a 0 (morte). Quem ataca primeiro com headshot (nunca o Rato) acerta com `headshotBase + Mira × aimHeadshot + skill da arma × weaponHeadshot` (0,15 + 0,3 + 0,3 por 100% de bônus) e mata na hora.
  - **Turnos:** alternados, começando por quem ataca primeiro, até alguém morrer ou `maxRounds` (50, então o inimigo recua). Cada troca conta 1 turno da raid. O Psicopata com mais de um inimigo rola d20 depois de cada inimigo (menos o último) e com ≥ `psychoExtraTurn` (11) ganha um turno extra.
  - **Ataque:** d20; até `failThreshold` (5) erra. A parte atingida sai dos pesos de `HIT_ZONES` (capacete na cabeça, colete no tronco). d20 + bônus < `baseDefense + classe` (10 + classe da peça que protege, se não quebrada): a peça segura o tiro e se gasta (`armorWear`). Passando: dano = dado da arma (`damageDie`) + `damageBonus` da munição, × `wornArmorFactor`, e a peça se gasta. Bônus do personagem = (Mira + skill do tipo da arma) × 10 (o Rato −`ratAimPenalty`, 4); do inimigo = dificuldade × `enemyAttackPerDifficulty` + `pmcAttackBonus` (2) se for PMC. O dano no personagem passa pela Vitalidade.
  - **Munição:** cada ataque gasta 1 cartucho (`burstRounds`, 3, em fuzis de assalto, submetralhadoras e metralhadoras leves) pelo `fireRound`. Sem munição, troca o carregador por um do equipamento ou enche o tubo com cartuchos soltos (`reload`) e espera `reloadTurns × (1 − 2 × Manuseio de carregador)` (2) turnos; sem como recarregar, tenta fugir.
  - **Fuga na briga:** o Rato tenta fugir em todo turno dele, e as outras estratégias quando `wantsToFlee` manda (`fleeRoll`).
  - **XP:** Mira e a skill da arma por acerto (`aimXpPerHit`, 1); Coletes leves/pesados (pelo `vestType` do colete) por tiro segurado (`vestXpPerBlock`, 1) e por dano tomado vestindo (`vestXpPerDamage`, 0,1); Vitalidade 0,05 por dano.
  - **Corpo** (`bodyItems`, menos para o Rato): arma com o carregador (ou o tubo) e de 0 à capacidade em cartuchos, as proteções com a durabilidade que sobrou e `ammoCount` cartuchos soltos, guardados por `MatrixRaid.store` como loot de raridade 3.
- **12G, sangramento e cuidados** (`MatrixRaid.bleed`, `tickBleeding`, `selfCare`; números em `coreBalance().bleed`):
  - Todo dano rola sangramento com `chance` (0,3): no personagem, na parte atingida (`bleeding`, uma vez por parte); no inimigo, uma marca `bleeding`.
  - A cada turno da raid (e a cada troca de tiros), cada parte sangrando perde `damagePerTurn` (1); cabeça ou tórax a 0 mata ("Morreu sangrando"). O inimigo sangrando perde `foeDamagePerRound` (2) por troca.
  - **Cuidados automáticos** (a cada turno, sem gastar turnos): estanca cada sangramento com um remédio do equipamento (torniquete primeiro, depois o de menor cura); cura com o remédio de maior cura enquanto a vida total ou de cabeça/tórax estiver abaixo de `healBelow` (60%) e o remédio curar algo; come ou bebe o item que mais rende abaixo de `eatBelow` (35).
  - O Seguro sangrando ou abaixo de `safeRetreatBelow` (50%) da vida vai para a extração.
