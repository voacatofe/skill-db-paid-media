# Paid Media Warehouse Skill

Skill global dlt-first para construir, auditar e evoluir warehouses PostgreSQL de Meta Ads e Google Ads, com dbt, modelagem dimensional e camadas semânticas para Looker Studio e Power BI.

## Instalação

Requer Node.js 18 ou mais recente:

```bash
npx skills add voacatofe/skill-db-paid-media
```

A instalação identifica a skill disponível e conduz a escolha do agente e do escopo. Reinicie o agente depois da instalação para recarregar as skills.

## Instalação automática

Use as opções abaixo somente em scripts, CI ou instalações sem perguntas.

Instalar globalmente no Codex:

```bash
npx skills add voacatofe/skill-db-paid-media \
  --skill build-paid-media-warehouse \
  --global \
  --agent codex \
  --yes
```

Instalar globalmente em todos os agentes compatíveis detectados:

```bash
npx skills add voacatofe/skill-db-paid-media \
  --skill build-paid-media-warehouse \
  --global \
  --agent '*' \
  --yes
```

Instalar apenas no projeto atual:

```bash
npx skills add voacatofe/skill-db-paid-media \
  --skill build-paid-media-warehouse \
  --agent codex \
  --yes
```

## Atualização e remoção

```bash
# Atualizar usando a origem registrada no GitHub
npx skills update build-paid-media-warehouse --global --yes

# Remover a instalação global
npx skills remove build-paid-media-warehouse --global --yes
```

## O que a skill inclui

- ingestão obrigatoriamente dlt-first;
- Meta Ads e Google Ads;
- PostgreSQL como warehouse inicial;
- raw, staging, intermediate, analytics, semantic e ops;
- dbt, Kimball e blending seguro de mídia paga;
- Looker Studio e Power BI;
- deploy enxuto em VPS/Coolify;
- validação de grain, merge, estado, lookback, concorrência, testes e segredos.

## Instalador alternativo

O repositório também contém um instalador npm independente. Ele é útil para distribuição offline ou ambientes que não usam a CLI `skills`:

```bash
npm pack
npx --yes --package=./build-paid-media-warehouse-skill-1.0.0.tgz \
  build-paid-media-warehouse-skill
```

Para desenvolvimento local:

```bash
npm test
npm run check
npx skills add . --list
```

## Licença

MIT.
