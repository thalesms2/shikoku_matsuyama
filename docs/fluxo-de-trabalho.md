# Fluxo de trabalho com o agente

Combinados entre o usuário e o agente (Claude Code) para desenvolver o jogo. Ficam no repositório para valer em qualquer computador; as regras obrigatórias continuam no [`CLAUDE.md`](../CLAUDE.md).

## Fases e commits

- O trabalho segue o [`PLANO.md`](../PLANO.md), uma sub-fase por vez, um commit por sub-fase.
- Desde a Fase 11A o agente commita sozinho cada sub-fase pronta (`feat: ...`, com a linha `Co-Authored-By`), relata em poucas linhas e segue para a próxima. Push só quando o usuário pedir.
- Cada sub-fase só termina com lint, typecheck, format:check, 100% de cobertura e build passando.
- O agente para e pergunta quando a decisão é do usuário (ambiguidade de design, teste fora das autorizações abaixo).

## Agentes em paralelo

- O usuário pode pedir agentes em worktrees separadas para tarefas do plano que não dependem umas das outras.
- Os agentes não editam testes que já existiam: devolvem a edição mínima, o agente principal pergunta ao usuário e aplica no merge.
- Se duas branches mexerem em `data/items.db`, fica o banco da `main` e o item da outra branch é refeito pelo pipeline (`npm run items -- override ...`, `images`, `export`).

## Testes que já existiam

A regra 2 do `CLAUDE.md` proíbe mudá-los. Exceções:

- **Autorização geral do plano:** quando uma sub-fase substitui um sistema (carregamento progressivo, motor antigo da raid, karma nas raids do PMC, painel do PMC da 11G), os testes obsoletos dele podem ser reescritos ou removidos, e cada um entra no relatório com o motivo.
- **Edições já aprovadas**, para referência: `tests/game.save.test.ts` usar `SAVE_VERSION` (Fase 3); `tests/core/save/raid.test.ts` v2 → v3 (Fase 4); cirurgia em `tests/core/raid/simulate.test.ts` (10B); `enemies.test.ts` com `toMatchObject`, `FleaScene.test.ts` com `changePage(99)` e `TradersScene.test.ts` com paginação (11L); `equipment.test.ts` com os slots `eyewear` e `face` (12E2); `hideout.test.ts` sem "Outra obra em andamento" (14B).
- Qualquer outra edição precisa de aprovação explícita antes.
- Testes novos de save nunca fixam `SAVE_VERSION` num número: use `toBeGreaterThanOrEqual(n)` ou compare com `SAVE_VERSION`.
- Nunca rode o oxfmt na pasta `tests/` inteira sem conferir `git diff -- tests` depois.

## Plano

- O primeiro plano (Fases 0–10) está em [`historico.md`](./historico.md). O `PLANO.md` atual começa na Fase 11: 11 inventário e carregamento instantâneo, 12 motor de raid em matriz (substitui o atual), 13 karma só na raid Scav, 14 quests repetíveis e obras sem limite, 15 contas no servidor com o save no servidor, 16 arte.
- A janela de admin (só em desenvolvimento) guarda o balanceamento no banco do servidor (`data/server.db`, commitado) e manda os valores na hora para os clientes. Ela fica escondida durante as raids.
- Arte e sons próprios esperam os arquivos reais.
