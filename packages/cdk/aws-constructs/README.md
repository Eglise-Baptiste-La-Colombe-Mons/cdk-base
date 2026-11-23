# @lacolombemons/aws-constructs

Constructs AWS CDK partagés par les projets La Colombe Mons. Chaque construct étend la ressource `aws-cdk-lib`
correspondante avec les réglages par défaut repris d'ecodim.

Règle commune à tous les constructs : une prop passée par le projet remplace entièrement la valeur par défaut, sans
fusion. Par exemple, passer `bundling: { sourceMap: true }` à `lambda.NodejsFunction` remplace `{ minify: true }` :
il faut repasser `minify: true` pour le garder.

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

### `dynamodb.Table` et `dynamodb.EphemeralTable`

Tables DynamoDB basées sur `TableV2` (ressource CloudFormation `AWS::DynamoDB::GlobalTable`).

| Prop                               | `Table` (données métier) | `EphemeralTable` (sessions, liens, compteurs) |
|------------------------------------|--------------------------|-----------------------------------------------|
| `billing`                          | à la demande             | à la demande                                  |
| `pointInTimeRecoverySpecification` | activée                  | —                                             |
| `deletionProtection`               | `true`                   | —                                             |
| `removalPolicy`                    | `RETAIN`                 | `DESTROY`                                     |
| `timeToLiveAttribute`              | —                        | `expiresAt`                                   |

Conventions imposées par les deux constructs :

- **Pas de `tableName`.** La prop n'existe pas : CloudFormation génère un nom unique. Une évolution qui remplace la
  table (changement de clé) crée simplement une nouvelle table, sans suffixe de version à gérer. Le code applicatif
  reçoit le nom par variable d'environnement (`table.tableName`).
- **Références faibles entre stacks.** Une table passée à une autre stack est lue avec `Fn::GetStackOutput`, sans
  export CloudFormation : la table peut être remplacée sans être bloquée par la stack consommatrice. Partager une
  table se fait donc par référence (`props.tables.child`), jamais en la réimportant par son nom.

Passer de `aws_dynamodb.Table` à ce construct, ou retirer un `tableName`, remplace la table : il faut migrer les
données.

```ts
import {dynamodb} from "@lacolombemons/aws-constructs";

const children = new dynamodb.Table(this, "Children", {
    partitionKey: {name: "childId", type: AttributeType.STRING},
    globalSecondaryIndexes: [
        {indexName: "bySurname", partitionKey: {name: "surnameKey", type: AttributeType.STRING}},
    ],
});

const sessions = new dynamodb.EphemeralTable(this, "Sessions", {
    partitionKey: {name: "sessionId", type: AttributeType.STRING},
});
```

### `lambda.NodejsFunction`

Fonction Lambda TypeScript bundlée avec esbuild, avec les réglages communs des projets.

| Prop           | Défaut                                                                     |
|----------------|----------------------------------------------------------------------------|
| `runtime`      | `NODEJS_24_X`                                                              |
| `architecture` | `ARM_64`                                                                   |
| `memorySize`   | `1024`                                                                     |
| `timeout`      | 10 secondes                                                                |
| `bundling`     | `{ minify: true }`                                                         |
| `logGroup`     | `cloudwatch.LogGroup` créé à côté de la fonction, avec l'id `<id>LogGroup` |

Le log group est créé dans le même scope que la fonction et non comme enfant : les logical IDs restent ceux d'une
fonction et d'un log group créés directement dans la stack.

`grantReadSecureParameters(...names)` autorise la lecture de paramètres SSM `SecureString` (`ssm:GetParameter` sur
ces paramètres, `kms:Decrypt` limité à l'usage via SSM dans la région de la stack).

```ts
import {lambda} from "@lacolombemons/aws-constructs";

const fn = new lambda.NodejsFunction(this, "EventFunction", {
    entry: path.join(routersDir, "events.ts"),
    environment: {EVENTBRITE_TOKEN_PARAM: tokenParamName},
});
fn.grantReadSecureParameters(tokenParamName);
```

### `route53.AliasRecordPair`

Enregistrements `A` (IPv4) et `AAAA` (IPv6) vers la même cible alias, pour une distribution CloudFront ou un domaine
API Gateway en dual-stack.

Le construct est l'enregistrement `A`. L'enregistrement `AAAA` est créé à côté, dans le même scope, avec l'id
`<id>V6`, et exposé dans `ipv6Record`. Il n'y a pas de construct parent : les logical IDs restent ceux de deux
enregistrements créés directement dans la stack, ce qui permet de remplacer du code existant sans recréer les
enregistrements DNS.

```ts
import {route53} from "@lacolombemons/aws-constructs";

new route53.AliasRecordPair(this, "EcodimSiteAliasRecord", {
    zone: props.hostedZone,
    recordName: props.domainName,
    target: RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
});
```

### `s3.Bucket`

Bucket S3 privé.

| Prop             | Défaut                                                     |
|------------------|------------------------------------------------------------|
| `encryption`     | `S3_MANAGED`                                               |
| `versioned`      | `true`                                                     |
| `lifecycleRules` | suppression des versions non courantes après 30 jours      |
| `removalPolicy`  | `RETAIN`                                                   |

Réglages imposés, absents des props :

- `blockPublicAccess` : `BLOCK_ALL`. Un site statique est servi par CloudFront, jamais directement par S3.
- `enforceSSL` : les requêtes non chiffrées sont refusées.
- `minimumTLSVersion` : `1.2`.

Le versioning permet de récupérer un fichier écrasé ou supprimé pendant 30 jours. Passer `lifecycleRules` remplace la
règle par défaut : la reprendre si on veut la garder.

```ts
import { s3 } from "@lacolombemons/aws-constructs";

new s3.Bucket(this, "EcodimSiteBucket");
new s3.Bucket(this, "Uploads", {versioned: false, lifecycleRules: []});
```

## Ajouter un construct

1. Une branche par construct : `feat/add-<service>-<construct>-construct`.
2. Reprendre le code existant dans ecodim et en extraire les réglages par défaut.
3. Exporter le construct dans `src/<service>/index.ts` et le service dans `src/index.ts`.
4. Après la release, remplacer le code d'ecodim par le construct (bump de version dans ecodim).
