# Pipeline de itens

Os dados dos itens vêm de um pipeline que **só roda em desenvolvimento**. O jogo nunca consulta a API durante a execução: tudo fica salvo no repositório.

Os comandos estão em `npm run items -- help`, e o fluxo do dia a dia (com as regras de nunca editar o JSON à mão) está no [`CLAUDE.md`](../CLAUDE.md), seção "Base de dados de itens".

## Fluxo

```
tarkov.dev (JSON)  →  data/items.db (SQLite)  →  src/data/generated/items.json  →  jogo
     sync                 override / images             export
```

1. **`sync`:** baixa a referência de `https://json.tarkov.dev/regular/items` e as traduções de `/regular/items_en` (índice em `/endpoints`), normaliza tudo para `ApiItem` e grava no banco. Roda só manualmente, nunca no build nem no CI.
   - Campos de referência: tamanho em células, categoria, `basePrice`, pilha, calibre, capacidade de carregador, dano e penetração, classe e durabilidade de armadura, grades de mochilas e coletes táticos.
   - O id externo fica como `sourceId`, para correlacionar sincronizações futuras sem duplicar itens.
2. **`override`:** os dados próprios do jogo (nome, nome curto, descrição, categoria, slot, pilha, preço, tamanho, grades e `stats`) têm prioridade sobre a referência. `--clear` volta um campo à referência.
3. **`images`:** baixa a imagem de grade de cada item habilitado (placeholder temporário).
4. **`export`:** gera `src/data/generated/items.json`, que o jogo importa no build (o navegador não precisa de SQLite).

## Banco (`data/items.db`, commitado)

- `items`: id do jogo, `sourceId` e dados de referência da API.
- `item_overrides`: dados próprios do jogo, que sobrescrevem a referência.
- `item_assets`: item ↔ imagem (`public/assets/items/<id>.webp`), com origem, licença e `status` (`placeholder` ou `final`).
- `sync_runs`: histórico de sincronizações (data, itens novos e alterados).

## Imagens

- As imagens do tarkov.dev são **placeholder temporário**: ficam fora do git (`public/assets/items/` no `.gitignore`), cada desenvolvedor baixa localmente e elas não são redistribuídas.
- Para usar uma arte própria: coloque o arquivo em `public/assets/items/<id>.webp` e rode `npm run items -- final <id>`. O item vira `final` e o download não o sobrescreve mais. `npm run items -- placeholders` lista o que ainda falta.
- No jogo, `loadItemTextures` carrega a imagem de cada item. Sem arquivo, o item é desenhado como um retângulo colorido pela categoria.

## Conteúdo

Da API vêm só dados factuais e de balanceamento (e, em desenvolvimento, as imagens placeholder). **Nomes e descrições são próprios do jogo**; os textos do Escape from Tarkov não entram no projeto. Calibres reais (5.45x39, 9x19) podem usar a nomenclatura técnica.

Hoje todos os itens do jogo estão ligados a um `sourceId` só por causa da imagem placeholder: todos os outros campos vêm do override, então ligar um item não muda o balanceamento.

## Testes

- O JSON exportado é validado pelo `Catalog` (tamanhos, pilhas, grades), sem ids repetidos e com imagem correlacionada.
- Os testes dos scripts usam respostas gravadas da API (`tests/scripts/items/fixtures.ts`, convertidas por `tarkovFixtures.ts`) e bancos em memória ou temporários. Nenhum teste acessa a rede.
