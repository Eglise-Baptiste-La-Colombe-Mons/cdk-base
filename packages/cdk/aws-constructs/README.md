# @lacolombemons/aws-constructs

Constructs AWS CDK partagés par les projets La Colombe Mons. Chaque construct étend la ressource `aws-cdk-lib`
correspondante avec les réglages par défaut repris d'ecodim. Les props passées par le projet restent prioritaires.

## Organisation

Un dossier par service AWS, un fichier par construct :

```
src/
├── index.ts            # export * as <service> from "./<service>"
└── <service>/
    ├── index.ts        # export * from "./<construct>"
    └── <construct>.ts
```

## Constructs

### `cloudwatch.LogGroup`

Log group pour les logs applicatifs (Lambda, logs d'accès API Gateway, déploiements S3).

| Prop            | Défaut         | Pourquoi                                                                   |
|-----------------|----------------|----------------------------------------------------------------------------|
| `retention`     | `THREE_MONTHS` | assez pour diagnostiquer un incident, sans conserver des logs indéfiniment |
| `removalPolicy` | `DESTROY`      | les logs ne sont pas des données métier : supprimés avec la stack          |

Toutes les props de `aws_logs.LogGroup` restent disponibles et priment sur ces défauts.

```ts
import {cloudwatch} from "@lacolombemons/aws-constructs";

new cloudwatch.LogGroup(this, "GuardianFunctionLogGroup");
new cloudwatch.LogGroup(this, "SiteDeploymentLogs", {retention: RetentionDays.ONE_MONTH});
```

## Ajouter un construct

1. Une branche par construct : `feat/add-<service>-<construct>-construct`.
2. Reprendre le code existant dans ecodim et en extraire les réglages par défaut.
3. Exporter le construct dans `src/<service>/index.ts` et le service dans `src/index.ts`.
4. Après la release, remplacer le code d'ecodim par le construct (bump de version dans ecodim).
