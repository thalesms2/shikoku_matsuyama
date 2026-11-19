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

_Nenhuma mecânica implementada ainda. Cada mecânica adicionada ao jogo será documentada aqui._
