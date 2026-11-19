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
- **Informações:** passe o mouse sobre um item para ver o nome, o tamanho, a quantidade e o valor (incluindo o que está dentro dele).
