# Plano de desenvolvimento — Escape from Idle

O primeiro plano (Fases 0 a 10) terminou e virou documentação em [`docs/historico.md`](./docs/historico.md). Este é o plano atual. A numeração continua a partir da Fase 11, porque o `CLAUDE.md` cita as fases antigas.

Como trabalhamos:

- Uma sub-fase por commit. O usuário faz os commits; cada sub-fase termina com `npm run lint && npm run typecheck && npm run format:check && npm run test:coverage` e o build passando.
- Valem as regras do `CLAUDE.md`: 100% de cobertura, toda mecânica registrada no `CLAUDE.md` e no `README.md`, save com versão e migração testada, itens novos só pelo pipeline e com nomes próprios.
- **Testes de sistemas substituídos** (autorizado pelo usuário para este plano): quando uma sub-fase substitui um sistema (carregamento progressivo, motor de raid atual, karma na raid do PMC), os testes antigos desse sistema podem ser removidos ou reescritos. O relatório da sub-fase lista cada teste antigo que mudou e por quê. Fora desses casos, testes existentes continuam intocáveis sem autorização.
- Mudanças que alteram o balanceamento são medidas com Monte Carlo (seed fixa) e os números vão no relatório.
- Ordem: 11 → 12 → 13 → 14 → 15. O balanceamento e a janela de admin (11I a 11K) vêm antes da raid nova, para os valores da Fase 12 já nascerem ajustáveis. O karma (13) depende dos encontros da raid nova (12).

---

## Fase 11 — Inventário e carregadores

- ✅ **11A — Carregamento instantâneo:** soltar munição sobre um carregador carrega na hora (até encher ou acabar a pilha). Descarregar também é instantâneo. O carregamento progressivo (`MagazineLoader`, barra de progresso, tempo por cartucho) sai.
  - Fora da raid, a skill Manuseio de carregador deixa de ter efeito. Ela passa a valer dentro da raid (12F): quando a munição acaba em combate, ela define quão rápido o PMC recarrega e volta a atirar.
- ✅ **11B — Munição sobre a arma:** soltar munição sobre uma arma (no estoque ou equipada): com a câmara vazia, 1 cartucho vai para a câmara; o resto (ou tudo, com a câmara cheia) vai para o carregador encaixado ou para o tubo. Arma sem carregador e com a câmara vazia recebe só o cartucho da câmara. Calibre errado fica vermelho.
- ✅ **11C — Vender arrastando:** soltar um item do inventário sobre o vendedor abre a venda já com o item escolhido.
- ✅ **11D — Atalhos de movimento:** Ctrl+clique move o item para o estoque (ou para o equipamento, vindo do estoque).
- ✅ **11E — Janela de contêiner arrastável** e mais de uma janela aberta.
- ✅ **11F — Loadouts melhores:** renomear loadouts e carregar os carregadores ao montar (agora instantâneo).
- ✅ **11G — Painel do PMC no inventário:** a tela de equipamento ganha um painel com o estado do PMC, no estilo de HUD dos extraction shooters (com arte e layout próprios): silhueta do corpo com a vida de cada parte (cores por gravidade, partes destruídas marcadas), vida total, nível com a barra de XP, energia e hidratação. Atualiza na hora (uso de remédio, comida, esconderijo).
  - O botão "Personagem" vira "Skills", e a tela dele passa a mostrar só as skills (a vida, o nível, a energia e a hidratação ficam no painel).
  - Autorizado: a 11G conta como sistema substituído, então os testes antigos do botão "Personagem" (`InventoryScene.player.test.ts`) e da tela de personagem (`CharacterScene.test.ts`) são atualizados.
  - O botão "Organizar" do estoque vira um botão de ícone azul (com dica "Organizar" ao passar o mouse).
- ✅ **11H — Skills por categoria:** as skills passam a ter quatro categorias, com a lista completa. Por enquanto as skills novas só acumulam XP onde já fizer sentido e aparecem na tela; o que cada uma influencia (na raid ou fora dela) será descrito depois. As skills atuais mantêm os efeitos de hoje.
  - **Físicas:** Resistência, Força, Saúde, Metabolismo, Resistência ao estresse, Vitalidade.
  - **Combate:** Mira, Fuzis de assalto, Fuzis de ferrolho, Fuzis de precisão (DMR), Metralhadoras pesadas, Metralhadoras leves, Corpo a corpo, Pistolas, Revólveres, Lança-granadas, Escopetas, Submetralhadoras, Arremessáveis, Solução de panes.
  - **Práticas:** Furtividade, Fabricação, Coletes pesados, Coletes leves, Gestão do esconderijo, Manuseio de carregador, Busca, Cirurgia, Manutenção de armas, Manutenção de coletes.
  - **Mentais:** Atenção, Carisma, Intelecto, Percepção.
  - A tela de Skills (11G) mostra as skills agrupadas pela categoria, com nível e barra de XP.
  - Save: as skills novas começam em 0 (versão nova do save com migração).
- **11I — Valores de balanceamento centralizados:** todos os números de balanceamento (chances de drop, dano das armas, chances de spawn, fórmulas de combate, karma, preços, tempos do esconderijo...) saem das constantes espalhadas e vão para um objeto `Balance` com os padrões. O core recebe o `Balance` injetado e continua puro e testável.
- **11J — Balanceamento no servidor:** os valores ficam num banco no servidor Colyseus (`server/`, SQLite com `node:sqlite`).
  - O cliente conecta ao abrir o jogo, recebe os valores e passa a usá-los. Sem servidor, usa o último valor recebido (guardado no navegador) ou os padrões.
  - Quando um valor muda no banco, o servidor avisa todos os clientes conectados, e eles atualizam na hora.
  - Uma raid já resolvida não muda: ela usa os valores do momento em que começou.
- **11K — Janela de admin (só em desenvolvimento):** uma janela no jogo, que só existe com `import.meta.env.DEV`, para editar em tempo de execução todos os valores do `Balance`, agrupados (loot, armas, inimigos, combate, economia...).
  - Salvar grava no banco do servidor, que avisa os clientes (11J). Tem um botão para restaurar os padrões.
  - A janela não aparece durante uma raid.
  - O servidor só aceita alterações em modo de desenvolvimento; em produção os valores são só lidos.
- **11L — Catálogo ampliado:** muitos itens novos, de todas as categorias (armas e calibres, munições de várias qualidades, carregadores, coletes e capacetes de várias classes, coletes táticos, mochilas, óculos e balaclavas, remédios, comida e bebida, permutas, chaves, itens de inteligência e itens raros), para alimentar as tabelas de loot dos contêineres (12A e 12D) e dos inimigos.
  - Todos pelo pipeline, com nomes e descrições próprios e imagem placeholder; dados de dano, dado de dano, penetração e classe já no formato da raid nova.
  - Os vendedores ganham parte deles. As ofertas passam de uma página (10 linhas), e o teste antigo que espera todas as ofertas do primeiro vendedor numa página (`TradersScene.test.ts`) passa a aceitar a paginação (autorizado).

## Fase 12 — Raid em matriz (novo motor de raid)

O motor atual (passos sorteados) é substituído. A raid passa a ser um mapa em matriz que o personagem atravessa célula por célula, da esquerda para a direita. O motor novo é construído ao lado do atual (12A a 12G) e assume no 12H, quando o antigo sai.

- **12A — Mapa em matriz:** cada mapa tem uma matriz fixa (`MapDef`), maior conforme a dificuldade.
  - Spawn dos personagens na coluna da esquerda; extrações na ponta direita, e as que têm requisito (chave, pagamento, sem mochila) ficam mais perto do spawn que a extração livre.
  - Pontos fixos de spawn de Scavs e de PMCs inimigos (os de PMC mais raros).
  - **Spawn de inimigos:** a cada turno rola-se um d10, e aparece um inimigo num ponto de spawn com `d10 ≥ 11 − ⌈1,5 × dificuldade⌉`. Os inimigos voltam a aparecer durante a raid, e um ponto pode juntar mais de um.

    | Dificuldade | Aparece com | Chance |
    | ----------- | ----------- | ------ |
    | 1           | 9–10        | 20%    |
    | 2           | 8–10        | 30%    |
    | 3           | 6–10        | 50%    |
    | 4           | 5–10        | 60%    |
    | 5           | 3–10        | 80%    |

  - Contêineres de loot em células fixas, de 17 tipos: cofre (safe), barril enterrado (buried barrel cache), caixa registradora (cash register), corpo (dead body), gaveta (drawer), esconderijo no chão (ground cache), caixa de granadas (grenade box), jaqueta (jacket), bolsa médica (medbag), caixa de suprimentos (supply crate), gabinete de PC (pc block), mala (suitcase), bolsa esportiva (sports bag), caixa de ferramentas (toolbox), caixa de armas (weapon box), caixa de munição (ammo box) e caixote (crate). Os nomes no jogo serão próprios, em português.
  - Cada tipo tem a sua tabela de loot (ex.: gabinete de PC nunca tem munição) e a sua chance de item raro.
- **12B — Movimento e estratégia:** o personagem anda só para células vizinhas (de 0,0 para 0,1 e depois 1,1; nunca na diagonal).
  - **Turnos e ações:** em cada célula, o personagem escolhe uma ação pela estratégia e pelo objetivo (andar, revistar um contêiner, se cuidar, operar...). Cada ação gasta turnos:
    - andar gasta 1 turno ou mais, conforme a parte do mapa (cada célula tem um custo de movimento: rua livre, escombros, mato...);
    - revistar um contêiner gasta de 2 a 5 turnos, conforme o tipo de contêiner e o quanto ele conhece aquele contêiner (conhecer deixa mais rápido);
    - a cada turno acontecem as rolagens de spawn e de movimento dos inimigos (12A e 12E). Por isso, ações longas são mais arriscadas.
  - **Sem tempo de raid e sem MIA:** a raid é contada em turnos. O que hoje depende de minutos passa a depender de turnos: gasto de energia e hidratação, XP de Resistência, o ritmo do log na tela (um movimento por vez, com x1/x4/x16) e a sequência das raids automáticas.
  - **Turnos viram tempo real:** cada turno tem uma duração no ritmo do log, então gastar mais turnos faz a raid demorar mais para terminar, e o rendimento por tempo (loot e dinheiro por hora) cai.
  - **Cinco estratégias** (substituem furtivo, equilibrado e agressivo): Rato, Seguro, Neutro, Agressivo e Psicopata. Cada uma define o caminho (reto para a extração ou por pontos de interesse), quando revistar, quando brigar ou fugir e os seus modificadores.
    - **Rato:** a prioridade é sair vivo, com qualquer loot, mesmo pouco.
      - Revista só o que está no caminho.
      - Prefere as rotas pelas bordas do mapa, longe dos pontos de spawn.
      - Anda devagar (mais turnos por célula), sem fazer barulho, o que deixa a raid mais demorada e rende menos por tempo.
      - Bônus enorme de furtividade: os inimigos só o percebem se estiverem na mesma célula.
      - Desesperado: tem desvantagem na rolagem de fuga e nas rolagens de acerto dos tiros.
    - **Seguro, Neutro, Agressivo e Psicopata:** a definir.
  - As opções escolhidas (estratégia, regra de loot) ficam guardadas **por mapa**.
- **12C — Conhecimento do mapa:** uma habilidade por mapa, que sobe com a exploração.
  - XP por raid = células percorridas + um fixo se sobreviveu + um fixo na primeira vez que acha cada contêiner do mapa.
  - No começo o personagem não sabe onde é a extração: anda até a ponta direita e precisa procurar.
  - Conforme a habilidade sobe, ele "lembra" de pontos (extrações, contêineres, spawns), e o caminho passa a usar o que ele conhece.
- **12D — Loot nos contêineres:** numa célula com contêiner, há uma chance de achar o loot (Percepção ajuda). Achando, sorteia o item pela tabela daquele tipo de contêiner, com a chance de raro do tipo. O item precisa caber no equipamento (regras de loot atuais).
- **12E — Inimigos andando e percepção:**
  - **Movimento:** a cada turno, cada inimigo rola um d6 para andar uma célula numa direção aleatória (nunca na diagonal). Quanto maior a dificuldade, maior a chance de andar.
  - **Perto (2 células ou menos):** os dois rolam d20 de percepção, com os modificadores:
    - bônus de Percepção e Furtividade, de itens como óculos e balaclava, e da dificuldade para o inimigo;
    - desvantagem por mochila colorida ou muito grande.
  - **O personagem percebe o inimigo:** decide se briga pela estratégia e pela condição (machucado ou sangrando, ele não briga).
    - Brigando, pula a disputa de quem vê primeiro: tenta o headshot e começa a briga.
  - **O inimigo percebe o personagem:** vem na direção dele, e a cada célula o personagem rola a percepção de novo.
    - Se o inimigo chega sem ser notado, ele tem a chance de headshot.
    - Se o personagem nota antes, pode lutar ou fugir, pela estratégia.
    - Para fugir, os dois rolam d20, e o do personagem precisa ser pelo menos o dobro do do inimigo. Conseguindo, o inimigo perde o rastro, e o personagem escolhe seguir fugindo ou atacar com a chance de headshot e a vantagem de começar a briga.
  - Itens novos pelo pipeline (óculos, balaclava, mochilas com penalidade) e slots novos de equipamento para óculos e cobertura do rosto.
- **12F — Combate d20:**
  - Quem ataca primeiro (12E) pode tentar um **headshot** (chance pelas skills), que mata na hora. Errando, a briga continua.
  - A cada turno, começando por quem atacou primeiro, cada lado rola **d20 + bônus**:
    - 1 a 5 (limiar de falha): errou o tiro;
    - acima disso, a classe da armadura do alvo decide se o tiro passou. Se a armadura segurou o tiro, ela perde durabilidade;
    - se o tiro passou, a armadura ainda reduz o dano e perde durabilidade.
  - Bônus de acerto vêm das skills: Mira e a skill do tipo da arma (Pistolas, Fuzis de assalto, Escopetas, Submetralhadoras...; categoria Combate, 11H).
  - Dano = dado da arma + dano fixo da munição (ex.: pistola d6; fuzil d20; fuzil com munição boa d20 + 5). Dado e fixo ficam nos `stats` dos itens, pelo pipeline.
  - Cada disparo gasta munição de verdade (câmara, carregador, tubo).
  - **Recarga em combate:** quando a munição da arma acaba, o PMC recarrega (troca de carregador ou enche o tubo). A skill Manuseio de carregador define quantos turnos ele leva para voltar a atirar.
  - **Skills de armadura:** Coletes leves e Coletes pesados ganham XP quando o PMC toma dano vestindo a armadura e quando ela segura um tiro.
  - **Conserto da armadura:** o Mercador Tito continua consertando por dinheiro, e a Oficina do esconderijo passa a consertar também.
  - A briga vai até um dos dois morrer. Vencendo, o PMC revista o corpo, que deixa o equipamento do inimigo (como na 10D).
- **12G — Sangramento:** todo dano rola uma chance de sangramento, nos dois lados. Sangrando, perde vida a cada célula até tratar (atadura e kits). Os cuidados automáticos tratam sangramento.
- **12H — Troca do motor:** a raid nova assume `startRaid` e o motor antigo sai.
  - Passam a usar a raid nova: raid Scav, raids automáticas, quests (abates, extração, itens achados), cirurgia (com o encontro surpresa), durabilidade da armadura, avisos antes da raid e resumo.
  - Os testes de balanceamento são reescritos para a raid nova.
- **12I — Matriz na tela:** a `RaidScene` desenha a matriz ao lado do log, com o personagem andando célula por célula no ritmo do log.
  - O que há em cada célula não aparece: só os pontos que o personagem conhece (12C) e os que ele descobriu nesta raid.

- **12J — Editor de mapas (admin, só em desenvolvimento):** uma tela que desenha a matriz de um mapa por inteiro, sem neblina, e permite alterar:
  - o tamanho da matriz e o custo de movimento de cada célula;
  - os contêineres: colocar, tirar ou trocar o tipo de cada célula;
  - o loot: a tabela de cada tipo de contêiner (itens, pesos, quantidades, chance de raro) e, opcionalmente, uma tabela própria para uma célula;
  - a chance de achar o loot;
  - os pontos de spawn (Scav e PMC);
  - as extrações (lugar e requisito), mantendo a regra de pelo menos uma extração livre na ponta direita.
  - Os mapas ficam no banco do servidor, como o balanceamento (11J): salvar avisa os clientes, que atualizam na hora. Há um botão para restaurar o mapa padrão e outro para exportá-lo para os dados do jogo.
  - O editor valida antes de salvar: spawn alcançável até alguma extração, sem células fora da matriz, itens que existem no catálogo.
  - Não aparece durante uma raid, e o servidor só aceita alterações em modo de desenvolvimento.
  - **Versão do mapa:** cada mapa salvo ganha uma versão nova. Ao salvar, o servidor compara com a versão anterior e lista as células que mudaram (custo, contêiner, loot, spawn, extração, ou células que entraram e saíram com o tamanho).
  - **Esquecer o que mudou:** as células que mudaram voltam a "não descoberta" para todos os jogadores. O conhecimento do mapa (12C) guarda a versão que o jogador conhece, e ao receber a versão nova o jogo apaga o que ele sabia dessas células. Jogadores fora do jogo apagam ao abrir, comparando as versões.
  - **Aviso:** o jogo mostra uma notificação "O mapa X foi atualizado; suas rotas nele podem ter ficado inválidas" (na hora, para quem está conectado; ao abrir, para os outros). Durante uma raid, o aviso espera ela terminar.
- **12K — Centro de inteligência e rotas:** um módulo novo no esconderijo, o Centro de inteligência (diferente da Central de informantes, que dá renda). Construído, ele libera um editor de rotas sobre a matriz de cada mapa.
  - Custo baixo, exige PMC nível 5 e itens de inteligência (ex.: pen drive, pasta de documentos; itens novos pelo pipeline, achados em contêineres como gabinete de PC e gaveta).
  - O jogador desenha um caminho célula por célula, só entre vizinhas, do spawn até uma extração.
  - **Rota inválida:** depois de uma atualização do mapa, uma rota que passa por célula que mudou ou que ficou "não descoberta" aparece marcada como inválida na preparação da raid e não pode ser usada até ser redesenhada.
  - As rotas são salvas por mapa com um nome, como os loadouts, e escolhidas na preparação da raid (e nas raids automáticas) no lugar do caminho da estratégia.
  - **Raid Scav sem rotas:** na raid Scav só se escolhe a estratégia; as rotas do Centro de inteligência valem só para o PMC.

## Fase 13 — Karma só na raid Scav

- **13A — Karma muda só na raid Scav:** a raid do PMC não mexe mais no karma. Na raid Scav: abater Scavs tira karma; evitar brigas e extrair dão.
- **13B — Equipamento do Scav pelo karma:** karma alto melhora as tabelas de equipamento do Scav; karma baixo piora.
- **13C — Quests da raid Scav:** objetivos que só contam em raids Scav.

## Fase 14 — Progressão

- **14A — Quests repetíveis:** quests geradas com objetivos aleatórios: abater um número de Scavs ou achar itens sorteados. Ao concluir, outra é gerada.
- **14B — Obras sem limite:** vários módulos em obra ao mesmo tempo, sem limite.
- **14C — Combustível do gerador:** o gerador consome combustível; sem ele, produções e renda param.

## Fase 15 — Contas e save no servidor

- **15A — Contas:** cadastro e login com usuário e senha no servidor (senha com hash `scrypt` do `node:crypto`, sessão por token). Tela de login antes do título.
- **15B — Save no servidor:** o save da conta fica no banco do servidor, com as mesmas versões e migrações. O save local de antes pode ser levado para a conta no primeiro login.
- **15C — Jogo sem conexão:** o que acontece quando o servidor cai no meio do jogo (continuar com o save local e sincronizar depois, ou bloquear).
- O tempo com o jogo fechado (esconderijo, mercado, raids automáticas) continua calculado pelo relógio, agora a partir do save da conta.

## Fase 16 — Arte e som próprios (aguardando arquivos)

- Substituir as imagens placeholder dos itens (`npm run items -- final <id>`), músicas e efeitos sonoros, animações nas telas de raid e inventário.

## Pendências do plano (decidir antes da sub-fase)

- **Estratégias Seguro, Neutro, Agressivo e Psicopata (12B):** caminho, revista, briga e fuga, e modificadores de cada uma.

## Regras já decididas

- **Rotas do Centro de inteligência (12K):**
  - a rota só passa por células que o personagem conhece (pela habilidade do mapa ou por já ter passado por elas);
  - brigas, sangramento e cuidados não interrompem: depois deles, ele segue a rota de onde parou;
  - a rota só é abandonada quando a extração do fim não pode ser usada (falta chave ou dinheiro, ou tem "sem mochila"). Aí ele volta ao caminho da estratégia até a extração conhecida mais próxima, ou procura uma.
- **Inimigos andando (12E):** o inimigo anda com `d6 ≥ 7 − dificuldade` (dificuldade 1 = 1 em 6; 3 = metade; 5 = 5 em 6).
- **Empate na percepção (12E):** quem tirar mais percebe o outro; empate = ninguém percebe, e os dois rolam de novo no próximo turno.
- **Headshot do inimigo (12E):** a classe do capacete dá uma chance de segurar o tiro, e o capacete perde durabilidade.
- **Fuga que falha (12E):** o personagem continua o que estava fazendo e o plano que já seguia, e pode tentar fugir de novo a cada turno, até o inimigo chegar.
  - O inimigo que o persegue sempre anda: uma célula por turno na direção do personagem.
  - Enquanto tenta fugir, o personagem gasta 1 turno a mais por célula andada.
  - Quando o inimigo chega, a briga começa sem headshot, porque o personagem o notou, e quem ataca primeiro sai de um d20 dos dois.
- **Cirurgia na matriz (12H):** cada parte do corpo leva 2 turnos parado (com o spawn e o movimento dos inimigos). Durante a cirurgia, as rolagens de percepção têm uma desvantagem fixa, que diminui com uma skill nova, Cirurgia.

## Ideias para depois

- Mercado avançado (vagas por nível, anúncios de outros jogadores, preço sugerido).
- Automação das raids automáticas (retomar depois de curar, alternar mapas, dinheiro mínimo) e quests no resumo do tempo fora.
- Durabilidade das armas, kit cirúrgico com vários usos, novos mapas e vendedores.
- Multiplayer sobre o servidor Colyseus (já usado pelo balanceamento e pelas contas).
