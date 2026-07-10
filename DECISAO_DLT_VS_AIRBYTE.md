# Decisão arquitetural — dlt versus Airbyte no `datawarehouse-RFM`

**Data:** 10 de julho de 2026

**Projeto analisado:** `C:\Users\darla\Documents\datawarehouse-RFM`
**Destino:** VPS pequena, deploy via Coolify, PostgreSQL externo ou gerenciado no mesmo servidor.

## Decisão

**Manter dlt. Não migrar para Airbyte neste estágio.**

Airbyte oferece uma UI melhor e um catálogo maior de conectores, mas esses benefícios não compensam, neste projeto, a infraestrutura adicional, o retrabalho e a substituição de contratos já validados. A escolha deve ser revisitada somente quando surgirem necessidades operacionais que dlt + Coolify não atendam de forma econômica.

## Evidência encontrada no projeto

O projeto já implementa sobre dlt:

- um pipeline por conta (`meta_ads_<id>` e `google_ads_<id>`), isolando estado;
- `merge` com chaves específicas de cada grain;
- janela móvel de 28 dias para reapuração de atribuição;
- backfill Meta e Google;
- source Meta vendorizada e customizada;
- source Google GAQL própria usando o SDK oficial;
- auditoria em `control.sync_runs`;
- bloqueio do diário para contas sem backfill;
- reconciliação de contas acessíveis, desejadas e carregadas;
- retries e falhas isoladas por conta;
- alertas por webhook;
- dashboard operacional e views `ops`;
- materialized views e contratos de consumo em `marts`;
- cron de produção em container;
- volume persistente para `.dlt-state`.

Migrar para Airbyte exigiria reconstruir ou adaptar todos esses pontos.

## Comparação específica

| Critério | dlt atual | Airbyte Core | Vencedor neste projeto |
|---|---|---|---|
| VPS pequena | container Python ocioso fora do job | Kubernetes; 4 CPU/8 GB recomendados | dlt |
| Reaproveitamento | arquitetura já implementada | migração de sources, estado e raw contracts | dlt |
| Meta Ads | source verificada customizada no repo | conector robusto com custom insights | empate técnico |
| Google Ads | GAQL própria já validada | conector + custom GAQL | dlt, pelo código existente |
| JSON aninhado | normalização relacional nativa | Direct Load e contratos Airbyte | dlt |
| Operação visual | dashboard interno + Coolify | UI Airbyte superior | Airbyte |
| Agendamento | cron atual ou Scheduled Task Coolify | scheduler próprio | empate funcional |
| Manutenção por IA | Python/SQL legível e editável | plataforma + conectores + infraestrutura | dlt |
| Novas fontes em grande quantidade | exige código/configuração | catálogo amplo | Airbyte |
| Risco de mudança agora | baixo | alto | dlt |

## Correções à comparação inicial

### “dlt custa zero”

Não literalmente. Continua existindo custo de VPS, PostgreSQL, rede, logs e execução. A vantagem é que dlt não mantém uma plataforma de integração inteira residente: o processo de extração só consome recursos relevantes durante o job.

No ambiente local, o container de desenvolvimento ocioso consumia aproximadamente 3,3 MiB, embora o job real consuma mais enquanto Python, normalização e load estão ativos.

### “Airbyte cobre quase tudo sem GAQL”

É exagerado. O conector Google aceita custom GAQL justamente porque recursos, segmentos e métricas variam por necessidade. Meta também exige escolher fields, breakdowns e action breakdowns. Airbyte reduz código, mas não elimina o desenho de grain e contrato.

### “As sources dlt são igualmente mantidas”

Não. A source Meta verificada está documentada e oferece incremental/atribuição. A documentação da source Google avisa que não há teste regular por dificuldade de credenciais. O projeto fez a escolha correta ao usar o SDK oficial e uma source GAQL própria.

### “A UI do Airbyte resolve observabilidade”

Ela melhora a experiência, mas o projeto já tem `control.sync_runs`, reconciliação, webhook e dashboard operacional. O que falta pode ser coberto no Coolify sem trocar a ingestão.

## Por que Airbyte não corrigiria os problemas atuais

### Rate limit Meta

O erro observado foi `User request limit reached`, inclusive em janela pequena. Ele depende da conta, app, token, tier, volume e combinação de Insights. Trocar dlt por Airbyte não aumenta a quota da Meta.

### Stream cancelado no Google

O erro `499 Stream removed` foi corrigido envolvendo a iteração do stream com retry. Airbyte teria outra implementação de retry, mas exigiria revalidar os mesmos relatórios e grains.

### Tabelas raw ausentes no primeiro run

As views dependem de tabelas criadas na primeira extração. Isso é um problema de bootstrap/contrato e também existiria com tabelas gerenciadas por outro conector.

## Arquitetura recomendada no Coolify

```text
Coolify
├── aplicação pipeline-dlt
│   ├── imagem Python
│   ├── secrets por environment variables
│   ├── volume persistente /app/.dlt-state
│   └── logs/heartbeat
├── scheduled task OU cron interno
└── PostgreSQL
    ├── control
    ├── raw_meta / raw_google
    ├── staging
    ├── marts
    └── ops
```

Regras de deploy:

1. Usar somente um scheduler. Se Coolify executar `run_daily.py`, remover/desativar o cron interno para evitar duplicidade.
2. Preservar o volume `/app/.dlt-state` entre deploys.
3. Manter o mesmo `pipeline_name`, destino e dataset para restauração de estado a partir de `_dlt_pipeline_state`.
4. Injetar secrets pelo Coolify; não versionar `.env`.
5. Validar como o `env_file: .env` será criado no deploy. Em Compose do Coolify, o arquivo Compose é a fonte de verdade; não presumir que o `.env` local ignorado pelo Git estará presente.
6. Não expor o container do pipeline publicamente.
7. Fazer backup do PostgreSQL e, adicionalmente, do volume de estado/traces.

## Endurecimentos prioritários antes da produção

### P0 — obrigatório

- Adicionar lock por pipeline/conta com PostgreSQL advisory lock ou mecanismo equivalente.
- Garantir que cron, execução manual e backfill não rodem o mesmo `pipeline_name` simultaneamente.
- Criar heartbeat operacional e alerta quando o diário não rodar no horário.
- Testar backup e restauração do PostgreSQL.
- Confirmar persistência do volume no ciclo deploy/redeploy do Coolify.
- Pin de dependências com versões compatíveis testadas, não apenas limites inferiores abertos.

### P1 — confiabilidade

- Testes automatizados de grain, idempotência, janela móvel e reconciliação.
- Fixtures sanitizadas Meta/Google para testar normalização sem chamar APIs.
- Schema/data contracts dlt para impedir evolução automática incompatível com staging.
- Teste de duas execuções consecutivas: totais não podem duplicar.
- Política clara de atualização da source Meta vendorizada e SDK Google.

### P2 — operação

- Avaliar mover o cron para Scheduled Tasks do Coolify para ganhar histórico e notificações.
- Reduzir a imagem de 1,14 GB e configurar limpeza de imagens antigas.
- Definir limites de CPU/memória e observar pico real durante backfill.
- Centralizar logs ou usar integração de drain do Coolify.
- Adicionar um comando de preflight antes do diário: banco, credenciais, espaço e lock.

## Decisão global da skill

A comparação está encerrada para esta skill. dlt é o motor obrigatório de ingestão, tanto no `datawarehouse-RFM` quanto em qualquer projeto novo atendido por ela.

A skill deve:

1. detectar a stack existente e inspecioná-la antes de alterar arquivos;
2. projetar novas ingestões, extensões e migrações com dlt;
3. escolher entre verified source, REST API source ou source/resource customizado dlt;
4. não sugerir, instalar ou estruturar Airbyte/PyAirbyte como alternativa;
5. exigir grain, idempotência, lookback, estado, schema contract, reconciliação, lock de concorrência e observabilidade;
6. manter a orquestração substituível, usando Coolify cron ou outra camada apenas para acionar os jobs dlt.

Se a skill estiver apenas diagnosticando um sistema Airbyte existente, ela pode lê-lo sem promover uma reescrita não autorizada. Quando houver pedido explícito de migração ou nova implementação, o destino deve ser dlt.

## Fontes oficiais

- [dlt: visão geral](https://dlthub.com/docs/intro)
- [dlt: schema evolution](https://dlthub.com/docs/general-usage/schema-evolution)
- [dlt: state](https://dlthub.com/docs/general-usage/state)
- [dlt: performance e concorrência](https://dlthub.com/docs/reference/performance)
- [dlt: Facebook Ads](https://dlthub.com/docs/dlt-ecosystem/verified-sources/facebook_ads)
- [dlt: Google Ads](https://dlthub.com/docs/dlt-ecosystem/verified-sources/google_ads)
- [Airbyte Core: recursos sugeridos](https://docs.airbyte.com/platform/using-airbyte/getting-started/oss-quickstart)
- [Airbyte: deploy Kubernetes/Helm](https://docs.airbyte.com/platform/deploying-airbyte)
- [Coolify: Docker Compose](https://coolify.io/docs/knowledge-base/docker/compose)
- [Coolify: persistent storage](https://coolify.io/docs/knowledge-base/persistent-storage)
- [Coolify: cron](https://coolify.io/docs/knowledge-base/cron-syntax)
- [Coolify: notificações](https://coolify.io/docs/knowledge-base/notifications/)
