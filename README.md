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
5. Venda, compre (nos vendedores e no mercado), faça quests, melhore o esconderijo e organize tudo na grade do estoque.

## Mecânicas

### Inventário em grade

Todo item ocupa um retângulo de células (por exemplo, 1x1 para uma atadura, 5x2 para um fuzil), e tudo precisa caber: no estoque do esconderijo, na mochila, no colete tático, nos bolsos e nos contêineres.

- **Arrastar e soltar:** clique e arraste um item. A área fica **verde** onde ele cabe e **vermelha** onde não cabe.
- **Girar:** aperte **R** enquanto arrasta para girar o item. **Esc** cancela o arraste.
- **Pilhas:** munição, dinheiro e outros itens empilháveis se juntam quando você solta um sobre o outro, até o limite da pilha.
- **Contêineres:** mochilas, coletes táticos e caixas têm espaço interno. Solte um item sobre o contêiner para guardá-lo dentro, ou dê **duplo clique** para abrir e organizar o conteúdo. Alguns só aceitam certos itens (a caixa de munição só aceita munição) e mochilas não entram em outras mochilas.
- **Equipamento:** arraste itens para os slots: arma primária e secundária, coldre, capacete, colete balístico, colete tático, mochila e contêiner seguro. Cada slot só aceita o tipo certo de item.
- **Bolsos:** 4 espaços 1x1 que vão com você para a raid.
- **Contêiner seguro:** o que estiver nele não é perdido quando o PMC morre na raid.
- **Organizar:** o botão organiza o estoque automaticamente, com os itens maiores primeiro. Se a nova organização não couber, nada muda.
- **Informações:** pare o mouse sobre um item para ver a imagem, o nome, o tamanho, a quantidade, o valor (incluindo o que está dentro dele), os dados técnicos (calibre, dano, penetração, proteção, capacidade) e a descrição. O quadro muda de lado perto das bordas da tela.
- **Menu do item:** clique com o botão direito em um item para ver as ações dele: abrir contêiner, descarregar carregador, remover o carregador da arma ou separar uma pilha pela metade.
- **Imagens:** cada item mostra sua imagem ocupando as células dele, e ela gira junto quando você gira o item.

### Personagem (PMC)

- Botão **Personagem** no inventário: mostra nível e XP, a vida de cada parte do corpo (cabeça, tórax, estômago, braços e pernas), energia, hidratação e skills.
- Se a cabeça ou o tórax chegarem a zero, o PMC morre. Dano em um braço ou perna já destruídos se espalha pelo resto do corpo.
- **Usar itens:** botão direito em um remédio, comida ou bebida → "Usar". Remédios curam primeiro as partes mais feridas; comida e água recuperam energia e hidratação. O quadro de informações mostra o efeito de cada um.
- **Skills:** cada skill sobe com o uso e dá 1% de bônus por nível (até 50%). Saúde melhora os remédios, Metabolismo melhora comida e bebida, e Manuseio de carregador carrega mais rápido. As outras contam nas raids (veja abaixo).

### Save

- O jogo salva sozinho a cada 5 segundos e ao fechar a página, e continua de onde parou na próxima vez, inclusive carregamentos de carregador em andamento e a raid que estava acontecendo.
- O resultado da raid é sorteado e salvo no momento em que você entra nela: fechar ou recarregar o jogo não muda o que vai acontecer.
- Se um save antigo tiver itens que não existem mais, eles são descartados; o que não couber mais no lugar vai para o estoque.

### Carregadores e munição

- **Carregar:** arraste uma pilha de munição e solte sobre um carregador do mesmo calibre. Os cartuchos entram um por vez (meio segundo cada), com uma barra de progresso, e o carregamento continua mesmo enquanto você faz outras coisas. Calibre errado ou carregador cheio aparece em vermelho.
- **Ordem dos cartuchos:** se você misturar tipos de munição, eles ficam na ordem em que foram carregados, e o último colocado é o primeiro a ser disparado. O quadro de informações do carregador mostra a sequência, de cima para baixo.
- **Descarregar:** botão direito → "Descarregar". Os cartuchos voltam como pilhas para perto do carregador; se faltar espaço, o resto fica nele.
- **Arma:** solte o carregador sobre a arma (no estoque ou equipada) para encaixá-lo. Carregadores e armas mostram no canto quantos cartuchos têm (ex.: 12/30). Para tirar: botão direito na arma → "Remover carregador".

### Raid

Botão **Raid** no inventário. Escolha o mapa, a estratégia e a regra de loot e clique em **Entrar na raid**. O PMC vai com o que estiver equipado: armas, colete, capacete, colete tático, mochila, bolsos e contêiner seguro.

- **Mapas:**
  - **Periferia Norte** (fácil, 30 min): muitos Scavs, poucos PMCs.
  - **Cimenteira** (médio, 25 min): brigas curtas, quase sempre contra PMCs.
  - **Porto Velho** (difícil, 40 min): o loot mais valioso e os atiradores mais perigosos.
- **Estratégias:**
  - **Furtivo:** evita metade das brigas, atira primeiro com mais frequência, anda devagar e acha menos loot.
  - **Equilibrado:** o meio-termo.
  - **Agressivo:** encontra muito mais inimigos e revista quase todos os corpos. Traz mais loot, mas morre bem mais.
- **Durante a raid:** o log mostra o que acontece em tempo real (2 segundos por minuto de raid). Use **x4** ou **x16** para acelerar ou **Pular** para ver o fim. Fechar o jogo não pausa a raid.
- **Combate:** cada briga é uma troca de tiros.
  - A chance de acertar depende da skill Mira e cai se um braço estiver destruído.
  - O dano depende da munição: se a penetração for menor que a proteção do colete ou do capacete do alvo (classe × 10), o dano cai. Isso vale para os dois lados.
  - Seu colete protege tórax e estômago, e o capacete protege a cabeça.
  - Quando o carregador esvazia, o PMC troca por outro carregado que esteja no equipamento. Depois da briga, ele completa os carregadores com a munição solta que estiver carregando.
  - Sem munição nenhuma, ele tenta fugir.
- **Cuidados automáticos:** o PMC usa sozinho os remédios do equipamento quando a vida cai (começando pelo melhor), e come ou bebe quando a energia ou a hidratação ficam baixas. Energia e hidratação caem durante a raid; se zerarem, o PMC começa a perder vida.
- **Loot:** o que o PMC encontra só é guardado se couber nos bolsos, no colete tático, na mochila ou, por último, no contêiner seguro. Duas regras:
  - **Priorizar valor por célula:** larga o loot mais barato desta raid para levar um mais valioso. Nunca larga o equipamento que você levou.
  - **Guardar o primeiro:** fica com o que achou primeiro.
- **Extração:** perto do fim, o PMC vai para a saída mais segura que puder usar. Algumas saídas pedem uma chave, pagamento em dinheiro ou que você esteja sem mochila. Pode haver alguém de tocaia na saída.
- **Resultado:**
  - **Extraiu:** fica com tudo e ganha XP do PMC (pela sobrevivência, pelo tempo, pelos abates e pelo valor do loot). Partes do corpo destruídas voltam com 1 de vida.
  - **Morreu ou ficou sem tempo (MIA):** perde tudo que estava vestido e nos bolsos, menos o contêiner seguro e o que estiver dentro dele. O PMC volta com a vida cheia.
  - Nos dois casos, o XP das skills ganho na raid fica.
- **Skills na raid:**
  - **Mira:** acerta mais.
  - **Percepção:** acha mais loot, às vezes um item extra, e atira primeiro com mais frequência.
  - **Furtividade:** evita mais brigas.
  - **Vitalidade:** recebe menos dano.
  - **Resistência e Metabolismo:** gastam menos energia e hidratação.
  - **Força:** sobe com o loot carregado.
- **Karma:** abater Scavs diminui o karma; evitar brigas, abater PMCs inimigos e extrair aumentam. Ele muda a raid Scav (veja abaixo). A tela de preparação mostra o karma e as suas estatísticas.

### Vendedores

Botão **Vendedores** no inventário. Cada vendedor tem uma especialidade, uma moeda e um estoque que se repõe de tempos em tempos (inclusive com o jogo fechado):

- **Coronel Brás** — armas e munição, em rublos.
- **Doutora Iara** — remédios e comida, em rublos.
- **Mercador Tito** — coletes, capacetes, mochilas e coletes táticos, em dólares. Ele também troca rublos por dólares e euros.
- **Sucateiro Nico** — compra quase tudo (pagando menos) e faz trocas de itens.

- **Comprar:** o item vai para o estoque e o pagamento sai do estoque (dinheiro ou, nas trocas, os itens pedidos). Precisa haver espaço no estoque.
- **Vender:** escolha um item do estoque; o vendedor paga em sua moeda. Contêineres precisam estar vazios.
- **Lealdade:** negociar com um vendedor (comprar e vender) aumenta a reputação com ele. Com nível de PMC, reputação e volume negociado suficientes, o vendedor sobe de nível, libera ofertas novas, cobra menos e paga mais. A tela mostra o que falta para o próximo nível.

### Quests

Botão **Quests** no inventário. Os vendedores dão quests com recompensas em dinheiro, itens, XP e reputação; algumas liberam ofertas novas nos vendedores.

- **Aceitar:** quests disponíveis precisam ser aceitas antes de contar. As bloqueadas mostram o que falta (nível, outra quest ou lealdade com um vendedor).
- **Objetivos:** entregar itens (botão **Entregar**, pode ser em partes), extrair de um mapa (às vezes por uma saída ou com uma estratégia), abater Scavs ou PMCs e sair de uma raid com um item. Só as raids do PMC contam; os abates contam mesmo se você morrer.
- **Encontrado na raid:** o loot com que o PMC extrai fica marcado ("Encontrado na raid ✓" no tooltip). Algumas entregas só aceitam itens marcados. Morrer não marca nada, nem o que estava no contêiner seguro. Itens marcados e não marcados não se misturam na mesma pilha.
- **Concluir:** com os objetivos cumpridos, conclua a quest para receber as recompensas (precisa haver espaço no estoque).
- **A fuga:** a cadeia principal começa com o Coronel Brás e termina com o barco do contrabandista no Porto Velho. Concluir a última quest é o final do jogo, mas você pode continuar jogando depois.

### Esconderijo

Botão **Esconderijo** no inventário. Construa e melhore módulos pagando com dinheiro e itens do estoque; cada obra leva um tempo real (e continua com o jogo fechado), uma de cada vez.

- **Gerador** — deixa as produções mais rápidas e é necessário para vários módulos.
- **Depósito** — aumenta o estoque.
- **Enfermaria** — cura o PMC aos poucos entre as raids.
- **Cozinha** — recupera energia e hidratação entre as raids e ferve água.
- **Oficina** — produz munição, carregadores e kits médicos a partir de sucata e remédios.
- **Central de informantes** — gera rublos com o tempo, até um limite; colete de vez em quando.
- **Posto de vigia** — diminui a espera da raid Scav.

Cada módulo mostra o que faz agora, o que o próximo nível dá, quanto custa e o que falta. As produções usam os ingredientes ao começar; quando terminam, clique em **Retirar** (precisa haver espaço no estoque).

### Mercado

Botão **Mercado** no inventário. É o mercado entre jogadores da cidade (simulado). Ele abre no **nível 5 do PMC**, e tudo é pago em rublos.

- **Preços que mudam:** cada item tem um preço de mercado que sobe e desce com o tempo, até 20% acima ou abaixo do preço normal. A seta ▲/▼ mostra para onde o preço foi na última hora. Comprar um item faz o preço dele subir um pouco, e vender faz cair. O efeito some aos poucos (cai pela metade a cada 2 horas).
- **Comprar:** cada compra traz uma pilha cheia (ex.: 60 cartuchos), por 10% acima do preço de mercado. O que você compra aqui **não** conta como encontrado na raid.
- **Vender (anunciar):** escolha um item do estoque e o preço pedido, de 50% a 200% do valor de mercado (botões − e +). Você paga uma **taxa** ao anunciar: 4% do valor quando o preço é o de mercado, e ela cresce rápido se você pedir mais. O item sai do estoque enquanto está anunciado.
- **Quando vende:** os compradores aparecem com o tempo, inclusive com o jogo fechado. Pelo preço de mercado, a venda leva uns 20 minutos em média. Mais barato vende mais rápido, mais caro demora mais, e com o dobro do valor ninguém compra. O anúncio dura 12 horas; depois disso o item volta.
- **Anúncios:** até 3 ao mesmo tempo. Na aba **Anúncios**, retire o dinheiro das vendas e os itens que voltaram (precisa haver espaço no estoque) ou cancele um anúncio (a taxa não volta).
- **Encontrado na raid:** permutas e chaves só podem ser anunciadas se forem encontradas na raid. Contêineres, carregadores e armas precisam estar vazios.

### Loadouts

Na tela de preparação da raid, o botão **Loadouts** guarda até 5 modelos de equipamento.

- **Salvar o atual:** guarda o que o PMC está usando: arma e carregador, coletes, capacete, mochila e tudo que está nos bolsos, no colete tático e na mochila.
- **Ver o que falta:** cada item aparece com "tem" ou "falta", com o custo estimado para comprar o que falta.
- **Equipar:** monta o equipamento com o que está no estoque. O que estava no lugar volta para o estoque, e itens a mais nos bolsos e na mochila ficam onde estão. Os carregadores mais cheios vão primeiro, mas a munição não é carregada sozinha.
- **Comprar e equipar:** compra o que falta pelo menor preço (vendedores ou mercado) e monta tudo com um clique.

### Raids automáticas

Na tela de preparação da raid, o botão **Automático** faz raids uma depois da outra, mesmo com o jogo fechado.

- **Regras:** escolha o mapa, a estratégia, um loadout (montado antes de cada raid, com ou sem comprar o que faltar), quantas raids fazer, a vida mínima para entrar (e se, com a vida baixa, a sequência espera curar ou para) e se ela para quando o PMC morre.
- **Como anda:** cada raid começa 5 segundos depois de o log da anterior terminar. Sem arma com munição, ou faltando algo do loadout, a sequência para e mostra o motivo.
- **Acompanhar:** a tela mostra a situação, os totais e as últimas raids, e **Ver raid atual** abre o log da raid em andamento. Ao voltar ao jogo, o resumo diz quantas raids aconteceram enquanto você estava fora.

### Configurações e tutorial

- **Tutorial:** num jogo novo, um painel no inventário explica o básico em 8 passos. Dá para pular, e ele pode ser revisto nas configurações.
- **Configurações** (botão na tela de título): volume dos efeitos, atraso do tooltip, velocidade inicial do log da raid e animações (transição entre telas). As configurações ficam neste navegador, separadas do save.

### Enquanto você estava fora

O tempo continua passando com o jogo fechado: obras e produções do esconderijo terminam, a central junta renda, o PMC se recupera, os anúncios do mercado vendem ou vencem, a raid Scav libera e os vendedores repõem o estoque. Ao voltar (depois de pelo menos 1 minuto), uma tela mostra um resumo do que aconteceu antes de seguir para o jogo.

### Raid Scav

Na tela de preparação, escolha o mapa e a estratégia e clique em **Entrar como Scav**. Você entra com um Scav descartável e seu PMC não arrisca nada.

- **Equipamento aleatório:** o Scav recebe uma pistola ou um fuzil com o carregador pelo menos meio cheio e, às vezes, colete tático, mochila, colete balístico, capacete, carregador extra, munição e alguns itens (remédios, comida, dinheiro).
- **Habilidade:** o Scav usa as skills do seu PMC, mas o XP ganho na raid Scav não fica, e o PMC também não ganha XP.
- **Extraiu:** tudo que o Scav carrega (equipamento e loot) vai para o estoque, do mais valioso por célula para o menos valioso. **Precisa caber:** o que não couber fica para trás e aparece no resumo.
- **Morreu ou MIA:** perde só o que o Scav tinha.
- **Espera:** depois de cada raid Scav, a próxima fica liberada em 20 minutos de tempo real (continua contando com o jogo fechado).
- **Karma:** quanto maior o karma do PMC, melhor a raid Scav:
  - os outros Scavs reconhecem você e não atacam (60% das vezes com karma 0; de 20% a 100% conforme o karma);
  - menos tocaias na extração;
  - mais loot e loot mais valioso;
  - espera menor (até 25% a menos com karma alto, até 25% a mais com karma baixo).
- A raid Scav não muda o karma. A tela de preparação mostra quanto falta para liberar, o efeito do karma atual e as estatísticas das raids Scav.
