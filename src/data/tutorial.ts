/** Um passo do tutorial mostrado no inventário */
export interface TutorialStep {
  readonly title: string;
  readonly text: string;
}

export const TUTORIAL: readonly TutorialStep[] = [
  {
    title: "Bem-vindo à cidade",
    text: "Você é um PMC preso numa cidade em guerra. Para fugir, complete a cadeia principal de quests. Este é o seu esconderijo: à esquerda o equipamento, à direita o estoque.",
  },
  {
    title: "Inventário",
    text: "Arraste os itens com o botão esquerdo; R gira durante o arraste. O botão direito abre o menu do item, e um duplo clique abre contêineres. Organizar o espaço faz parte do jogo.",
  },
  {
    title: "Armas e munição",
    text: "Solte munição sobre um carregador para carregar (leva tempo) e o carregador sobre a arma para encaixar. Sem munição na arma, o PMC não tem como brigar.",
  },
  {
    title: "Raid",
    text: "Em Raid, escolha o mapa e a estratégia. Se extrair, fica com tudo; se morrer, perde o que levou e o que achou, menos o contêiner seguro. O XP das skills sempre fica.",
  },
  {
    title: "Raid Scav",
    text: "Sem equipamento para arriscar? Entre como Scav: equipamento aleatório, nenhum risco para o PMC e uma espera entre uma raid e outra.",
  },
  {
    title: "Vendedores e quests",
    text: "Venda o loot e compre equipamento com os vendedores. As quests dão dinheiro, itens e reputação, e a cadeia principal leva à fuga.",
  },
  {
    title: "Esconderijo e mercado",
    text: "Melhore o esconderijo para curar, produzir e ganhar renda (tudo anda com o jogo fechado). No nível 5, o mercado libera preços que mudam com o tempo.",
  },
  {
    title: "Jogo idle",
    text: "Na preparação da raid, salve loadouts e use as raids automáticas para jogar sozinho. As configurações ficam na tela de título. Boa sorte!",
  },
];
