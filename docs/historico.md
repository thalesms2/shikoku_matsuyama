# Histórico de desenvolvimento — Escape from Idle

O primeiro plano do jogo (Fases 0 a 10) terminou. Este documento resume o que cada fase entregou e as decisões tomadas. As regras e fórmulas de cada mecânica ficam no [`CLAUDE.md`](../CLAUDE.md) ("Mecânicas implementadas"), e a explicação para o jogador fica no [`README.md`](../README.md). O plano atual está em [`PLANO.md`](../PLANO.md).

Regras que valeram em todas as fases (e continuam valendo): 100% de cobertura, testes existentes não são alterados sem autorização, toda mecânica é registrada no `CLAUDE.md` e no `README.md`, lógica de jogo em `src/core/` sem PixiJS, aleatoriedade por RNG com seed, e save com versão e migração testada.

## Visão geral

| Fase | Entrega                                                        | Save |
| ---- | -------------------------------------------------------------- | ---- |
| 0    | Fundação: Vite, TypeScript, PixiJS, Vitest, CI                 | —    |
| 1    | Inventário em grade ("tetris")                                 | —    |
| 2    | Base de itens, tooltip, carregadores, PMC, skills e save       | v1   |
| 3    | Raid do PMC simulada                                           | v2   |
| 4    | Raid Scav e karma                                              | v3   |
| 5    | Vendedores, lealdade e moedas                                  | v4   |
| 6    | Quests, "encontrado na raid" e o final                         | v5   |
| 7    | Esconderijo                                                    | v6   |
| 8    | Mercado (flea market)                                          | v7   |
| 9    | Tempo fora, loadouts, raids automáticas, configurações         | v8–9 |
| 10   | Durabilidade, cirurgia, câmara, inimigos equipados, rolagem... | v10+ |

## Fase 0 — Fundação

- Projeto Vite + TypeScript strict + PixiJS v8, a partir do template `create-pixi`. O servidor Colyseus do template foi mantido para uso futuro, e a demo 3D foi removida.
- Vitest com `@vitest/coverage-v8` e `thresholds` de 100%; oxlint e oxfmt; CI no GitHub Actions (lint, tipos, formatação, cobertura e build).
- Utilitários do core: `Rng` (mulberry32 com seed), `EventBus` tipado e `Clock` injetável (`systemClock`/`ManualClock`).
- `SceneManager` e `TitleScene`.

## Fase 1 — Inventário em grade

- `ItemDef` (catálogo) e `Item` (instância com uid, quantidade, grades internas e localização).
- `Grid` com encaixe, rotação e filtros por categoria; operações de mover, somar e separar pilhas, `autoPlace`, `dropOnItem` e `sortGrid` (que desfaz se não couber).
- Contêineres aninhados (um contêiner nunca entra nele mesmo) e slots de equipamento com 4 bolsos.
- UI: arrastar e soltar com prévia verde/vermelha, `R` para girar, `Esc` para cancelar, tooltip, "Organizar" e janela de contêiner com duplo clique.

## Fase 2 — Dados do jogo e PMC

- **2A, base de itens:** pipeline de desenvolvimento que traz dados de referência do tarkov.dev para um SQLite local e exporta `src/data/generated/items.json`. Detalhes em [`pipeline-de-itens.md`](./pipeline-de-itens.md).
  - Decisões: os dados JSON do tarkov.dev (a API GraphQL respondia 422); `node:sqlite` no lugar de `better-sqlite3` (sem compilação nativa); `tsx` e uma CLI única (`npm run items -- <comando>`).
- **2B, tooltip:** descrição própria de cada item, ficha por categoria e reposicionamento na borda da tela. O atraso de 300 ms é uma opção da cena (padrão 0, para não mudar os testes da Fase 1).
- **2C, carregadores:** munição como pilha ordenada de cartuchos (o último carregado dispara primeiro), carregar/descarregar com tempo por cartucho calculado pelo relógio (continua com o jogo fechado) e encaixe na arma.
- **2D, PMC, skills e save:** vida por parte do corpo, energia, hidratação, nível; 9 skills; consumíveis com "Usar"; tela de personagem; save versionado no `localStorage` com autosave e backup de save ilegível.

## Fase 3 — Raid do PMC

- A raid é resolvida inteira ao entrar (seed salva no perfil) e o log é só revelado no ritmo do relógio, com x1/x4/x16 e "Pular". Recarregar o jogo não refaz o sorteio.
- Três mapas, três estratégias, combate por fórmula (penetração × classe de proteção, skills), cuidados automáticos, loot que precisa caber no equipamento (regra de valor por célula), extrações com requisitos, morte/MIA e karma.
- `tests/core/raid/balance.test.ts` fixa as faixas de balanceamento com Monte Carlo de seed fixa.

## Fase 4 — Raid Scav

- Personagem descartável com equipamento sorteado por tabelas, cooldown em tempo real e modificadores de karma (Scavs amigáveis, tocaia, quantidade e qualidade do loot, cooldown).
- Ao extrair, tudo vai para o estoque, se couber. O PMC não arrisca nada.

## Fase 5 — Vendedores e economia

- Quatro vendedores originais (armas, remédios, equipamento, sucata), com três níveis de lealdade (nível do PMC, reputação e volume negociado).
- Compra com dinheiro ou troca, venda por categoria, reposição periódica que acompanha o tempo fora; rublo, dólar e euro.

## Fase 6 — Quests

- Objetivos de entregar, extrair, abater e encontrar; requisitos de nível, quest e lealdade; recompensas de XP, itens, reputação e ofertas liberadas.
- Marca "encontrado na raid" (`fir`) no loot com que o PMC extrai.
- Cadeia principal de seis quests até a fuga (`EndingScene`), mais quatro secundárias.

## Fase 7 — Esconderijo

- Sete módulos (gerador, depósito, enfermaria, cozinha, oficina, central de informantes, posto de vigia), obras e produções em tempo real, renda passiva, corte do cooldown Scav e estoque maior.
- `hideoutTick` passa o tempo desde o último cálculo (também com o jogo fechado).

## Fase 8 — Mercado

- Liberado no nível 5 do PMC. Preço com tendência por hora (determinística pela seed) e pressão de compras e vendas do jogador, que se dissipa com o tempo.
- Anúncios com taxa que cresce com o preço pedido e venda sorteada a cada minuto; permutas e chaves só se encontradas na raid.

## Fase 9 — Progressão idle e polimento

Uma sub-fase por commit.

- **9A:** resumo do que aconteceu com o jogo fechado.
- **9B:** loadouts salvos, montar com o estoque e "comprar e equipar" pelo menor preço entre vendedores e mercado.
- **9C:** raids automáticas em sequência com regras de parada; as raids que caberiam no tempo fora acontecem ao abrir o jogo.
- **9D:** configurações do aparelho (fora do save), tutorial, fade entre cenas, hover dos botões e som de clique.
- Arte e sons próprios ficaram para quando houver os arquivos.

## Fase 10 — Pendências de jogo

Uma sub-fase por commit.

- **10A, durabilidade da armadura:** colete e capacete se gastam com os acertos, protegem e valem menos, e o Mercador Tito conserta.
- **10B, cirurgia:** parte destruída não volta mais sozinha ao extrair. Ela é operada na raid com o Kit cirúrgico de campo, com chance de encontro surpresa (sem poder evitar e com metade da chance de atirar primeiro), ou devagar pela Enfermaria nível 2.
  - Um teste existente teve a asserção da perna alterada com autorização do usuário.
- **10C, câmara e escopeta:** um cartucho na câmara de toda arma e o tubo interno da Escopeta M-12, que passou a funcionar.
  - Para não alterar um teste existente, a câmara não é carregada ao completar os carregadores depois da briga; ela puxa do carregador no disparo seguinte.
- **10D, inimigos equipados:** arma, munição, colete e capacete dos inimigos vêm do catálogo, e o corpo revistado deixa tudo.
  - Itens novos: Colete de placas Muralha (classe 4), Capacete fechado K-3 (classe 3) e Cartucho 5.45 perfurante (só no corpo de PMCs inimigos).
  - Com tiros de verdade, acertos na cabeça matam mais fácil, então a precisão do Scav caiu de 0,28 para 0,13. A extração ficou perto da anterior e o loot médio quase dobrou.
- **10E, quests no resumo da raid:** o fim de cada raid do PMC lista as quests que avançaram.
- **10F, rolagem do estoque:** o estoque mostra 14 linhas e rola (roda do mouse ou arrastando até a borda).

## Versões do save

| Versão | O que entrou                                                  |
| ------ | ------------------------------------------------------------- |
| v1     | Inventário, PMC, skills, carregamento em andamento            |
| v2     | Perfil de raid (karma, estatísticas, seed, raid em andamento) |
| v3     | Perfil Scav (cooldown e estatísticas)                         |
| v4     | Vendedores (reputação, volume, compras, reposição)            |
| v5     | Quests e a marca `fir` nos itens                              |
| v6     | Esconderijo                                                   |
| v7     | Mercado                                                       |
| v8     | Loadouts                                                      |
| v9     | Raids automáticas                                             |
| v10    | Durabilidade atual dos itens (`dur`)                          |
| v11    | Progresso da cirurgia da enfermaria                           |
| v12    | Cartucho na câmara (`chamber`)                                |
| v13    | Quests que avançaram na raid em andamento                     |

As regras de cada migração estão no `CLAUDE.md` (seção Save).
