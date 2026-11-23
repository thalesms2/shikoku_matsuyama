# Escape from Idle

RPG idle 2D de extração feito com PixiJS. Gerencie seu PMC, equipe-o, mande-o para raids, organize o loot no esconderijo e complete as quests para escapar da cidade.

> Projeto em desenvolvimento. Veja o [plano de desenvolvimento](./PLANO.md).

## Como rodar

```bash
npm install
npm run dev            # servidor de desenvolvimento
npm test               # testes
npm run test:coverage  # testes + cobertura (100% obrigatório)
npm run lint           # oxlint
npm run typecheck      # checagem de tipos
npm run format         # oxfmt
npm run build          # build de produção (cliente em dist/client, servidor em dist/server)
npm run preview        # roda o build de produção
```

## Base de dados de itens (desenvolvimento)

Os itens vêm de um banco SQLite local (`data/items.db`), alimentado em desenvolvimento pela API do [tarkov.dev](https://tarkov.dev). O jogo nunca acessa a API: ele usa o arquivo `src/data/generated/items.json`, gerado a partir do banco.

```bash
npm run items -- help                      # lista os comandos
npm run items -- sync                      # baixa/atualiza os dados da API
npm run items -- search "5.45"             # procura o sourceId de um item
npm run items -- override ammo_545 --source <sourceId> --name "Cartucho 5.45 FMJ" --short "5.45"
npm run items -- images                    # baixa as imagens placeholder dos itens do jogo
npm run items -- export                    # gera src/data/generated/items.json
npm run items -- placeholders              # itens que ainda usam imagem placeholder
npm run items -- final ammo_545            # marca a arte própria em public/assets/items/ammo_545.webp
```

As imagens placeholder ficam em `public/assets/items/`, fora do git: cada máquina baixa as suas com `npm run items -- images`. Sem elas, o jogo funciona normalmente e desenha os itens como blocos coloridos.

## Como jogar

1. Monte o equipamento do seu PMC no esconderijo.
2. Escolha um mapa e uma estratégia e entre na raid.
3. Se extrair, fica com tudo que levou e encontrou. Se morrer, perde tudo — só o XP das skills fica.
4. Use a raid Scav (com cooldown) para conseguir itens sem arriscar seu equipamento.
5. Venda, compre, faça quests, melhore o esconderijo e organize tudo na grade do estoque.

## Mecânicas

### Inventário em grade

Todo item ocupa um retângulo de células (por exemplo, 1x1 para uma atadura, 5x2 para um fuzil), e tudo precisa caber: no estoque do esconderijo, na mochila, no colete tático, nos bolsos e nos contêineres.

- **Arrastar e soltar:** clique e arraste um item. A área fica **verde** onde ele cabe e **vermelha** onde não cabe.
- **Girar:** aperte **R** enquanto arrasta para girar o item. **Esc** cancela o arraste.
- **Pilhas:** munição, dinheiro e outros itens empilháveis se juntam quando você solta um sobre o outro, até o limite da pilha.
- **Contêineres:** mochilas, coletes táticos e caixas têm espaço interno. Solte um item sobre o contêiner para guardá-lo dentro, ou dê **duplo clique** para abrir e organizar o conteúdo. Alguns só aceitam certos itens (a caixa de munição só aceita munição) e mochilas não entram em outras mochilas.
- **Equipamento:** arraste itens para os slots: arma primária e secundária, coldre, capacete, colete balístico, colete tático, mochila e contêiner seguro. Cada slot só aceita o tipo certo de item.
- **Bolsos:** 4 espaços 1x1 que vão com você para a raid.
- **Contêiner seguro:** o que estiver nele não será perdido quando o PMC morrer (vale a partir das raids, na Fase 3).
- **Organizar:** o botão organiza o estoque automaticamente, com os itens maiores primeiro. Se a nova organização não couber, nada muda.
- **Informações:** pare o mouse sobre um item para ver a imagem, o nome, o tamanho, a quantidade, o valor (incluindo o que está dentro dele), os dados técnicos (calibre, dano, penetração, proteção, capacidade) e a descrição. O quadro muda de lado perto das bordas da tela.
- **Menu do item:** clique com o botão direito em um item para ver as ações dele: abrir contêiner, descarregar carregador, remover o carregador da arma ou separar uma pilha pela metade.
- **Imagens:** cada item mostra sua imagem ocupando as células dele, e ela gira junto quando você gira o item.

### Carregadores e munição

- **Carregar:** arraste uma pilha de munição e solte sobre um carregador do mesmo calibre. Os cartuchos entram um por vez (meio segundo cada), com uma barra de progresso, e o carregamento continua mesmo enquanto você faz outras coisas. Calibre errado ou carregador cheio aparece em vermelho.
- **Ordem dos cartuchos:** se você misturar tipos de munição, eles ficam na ordem em que foram carregados, e o último colocado é o primeiro a ser disparado. O quadro de informações do carregador mostra a sequência, de cima para baixo.
- **Descarregar:** botão direito → "Descarregar". Os cartuchos voltam como pilhas para perto do carregador; se faltar espaço, o resto fica nele.
- **Arma:** solte o carregador sobre a arma (no estoque ou equipada) para encaixá-lo. Carregadores e armas mostram no canto quantos cartuchos têm (ex.: 12/30). Para tirar: botão direito na arma → "Remover carregador".
