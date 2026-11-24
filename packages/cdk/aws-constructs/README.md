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

### `cloudfront.SecurityHeadersPolicy`

Response headers policy CloudFront avec les en-têtes de sécurité d'un site. Tous les en-têtes sont en
`override: true` : ils remplacent ceux que renverrait l'origine.

La CSP par défaut vise une SPA servie depuis son propre domaine : scripts, polices et requêtes limités au domaine
du site, images aussi en `data:`, styles inline autorisés (`'unsafe-inline'`, nécessaire aux styles injectés par les
frameworks), aucun objet embarqué, et le site ne peut pas être affiché dans une iframe.

```
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self';
connect-src 'self' <connectSrc>; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
```

| En-tête                      | Défaut                                                         | Pourquoi                                                 |
|------------------------------|----------------------------------------------------------------|----------------------------------------------------------|
| `Content-Security-Policy`    | CSP ci-dessus                                                  | limite ce que la page peut charger et exécuter           |
| `X-Content-Type-Options`     | `nosniff`                                                      | le navigateur respecte le `Content-Type` déclaré         |
| `X-Frame-Options`            | `DENY`                                                         | pas d'affichage dans une iframe (clickjacking)           |
| `Referrer-Policy`            | `strict-origin-when-cross-origin`                              | seule l'origine est envoyée aux autres sites             |
| `Strict-Transport-Security`  | 365 jours, sans `includeSubdomains` ni `preload`               | HTTPS obligatoire, sans engager les autres sous-domaines |
| `X-XSS-Protection`           | désactivé (`0`)                                                | filtre obsolète des navigateurs, remplacé par la CSP     |
| `Permissions-Policy`         | `camera=(), microphone=(), geolocation=(), payment=(), usb=()` | API du navigateur inutiles à un site désactivées         |
| `Cross-Origin-Opener-Policy` | `same-origin`                                                  | isole la fenêtre des pages ouvertes depuis un autre site |
| `X-Robots-Tag`               | absent, `noindex` avec `noIndex: true`                         | pas d'indexation des environnements de staging           |

Props propres au construct :

- `connectSrc` : origines ajoutées après `'self'` dans `connect-src`, typiquement l'API du site.
- `noIndex` (défaut `false`) : ajoute `X-Robots-Tag: noindex`, en dernier.
- `contentSecurityPolicy` : remplace entièrement la CSP par défaut. `connectSrc` est alors ignoré : inclure les
  origines de l'API dans la CSP passée.
- `permissionsPolicy` : remplace la valeur par défaut de `Permissions-Policy`.

`securityHeadersBehavior` et `customHeadersBehavior` sont gérés par le construct et absents des props. Les autres
props de `aws_cloudfront.ResponseHeadersPolicy` (`responseHeadersPolicyName`, `comment`, `corsBehavior`,
`removeHeaders`, `serverTimingSamplingRate`) restent disponibles.

Le construct est la ressource `AWS::CloudFront::ResponseHeadersPolicy` elle-même : avec le même id, il remplace une
`ResponseHeadersPolicy` existante sans changer son logical ID ni son nom.

```ts
import {cloudfront} from "@lacolombemons/aws-constructs";

const responseHeadersPolicy = new cloudfront.SecurityHeadersPolicy(this, "EcodimResponseHeaders", {
    connectSrc: [`https://${props.apiDomainName}`],
    noIndex: props.noIndex,
});
```

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

### `iam.GithubOidcProvider` et `iam.GithubDeployRole`

Déploiement CDK depuis GitHub Actions sans clé AWS stockée : le workflow obtient un jeton OIDC de GitHub et assume
le rôle de déploiement.

Il y a deux constructs parce qu'un compte AWS ne peut avoir qu'un seul provider OIDC pour
`token.actions.githubusercontent.com`. Le premier projet du compte crée le provider. Les suivants l'importent par son
ARN et créent seulement leur rôle.

`iam.GithubOidcProvider` est le provider OIDC de GitHub Actions : URL `https://token.actions.githubusercontent.com`
et client ID `sts.amazonaws.com`, imposés. Seul `oidcProviderName` reste disponible.

`iam.GithubDeployRole` est le rôle assumé par le workflow.

| Prop                 | Défaut      | Pourquoi                                                                     |
|----------------------|-------------|------------------------------------------------------------------------------|
| `provider`           | (requis)    | provider créé par `GithubOidcProvider`, ou importé par ARN                   |
| `repository`         | (requis)    | `owner`, `ownerId`, `name`, `id` du repo autorisé                            |
| `branch`             | `main`      | seuls les workflows de cette branche peuvent déployer                        |
| `cdkQualifier`       | `hnb659fds` | qualifier par défaut du bootstrap CDK                                        |
| `roleName`           | généré      |                                                                              |
| `maxSessionDuration` | 1 heure     | un déploiement tient dans l'heure, le jeton n'est pas valable plus longtemps |

Le rôle ne fait qu'une chose : `sts:AssumeRole` sur `arn:aws:iam::<account>:role/cdk-<qualifier>-*`, les rôles
créés par `cdk bootstrap`. Les permissions de déploiement sont celles de ces rôles, pas du rôle GitHub.

La trust policy exige `token.actions.githubusercontent.com:aud` = `sts.amazonaws.com` et :

```
token.actions.githubusercontent.com:sub = repo:<owner>@<ownerId>/<name>@<id>:ref:refs/heads/<branch>
```

Les identifiants numériques protègent contre un repo supprimé puis recréé sous le même nom par quelqu'un d'autre :
le nouveau repo a un autre `id`, et son jeton est refusé. Ce format est celui des *immutable subject claims* de GitHub
Actions. Il doit être activé sur l'organisation ou le repo (API `PUT /orgs/{org}/actions/oidc/customization/sub` ou
`PUT /repos/{owner}/{repo}/actions/oidc/customization/sub` avec `use_immutable_subject: true`). Les repos créés depuis
le 15 juillet 2026 l'ont par défaut. Sans lui, le `sub` reçu est `repo:<owner>/<name>:…` et le rôle refuse le jeton.

Pour trouver `ownerId` et `id` :

```bash
gh api repos/<owner>/<repo> --jq '.owner.id, .id'
```

```ts
import {iam} from "@lacolombemons/aws-constructs";

const provider = new iam.GithubOidcProvider(this, "GithubOidcProvider");
const role = new iam.GithubDeployRole(this, "GithubDeployRole", {
    provider,
    repository: {owner: "Eglise-Baptiste-La-Colombe-Mons", ownerId: "…", name: "ecodim-app", id: "…"},
    roleName: "ecodim-github-deploy",
});
```

Second projet dans le même compte, avec le provider existant :

```ts
const provider = aws_iam.OidcProviderNative.fromOidcProviderArn(
    this,
    "GithubOidcProvider",
    `arn:aws:iam::${this.account}:oidc-provider/token.actions.githubusercontent.com`,
);
new iam.GithubDeployRole(this, "GithubDeployRole", {provider, repository});
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

| Prop             | Défaut                                                |
|------------------|-------------------------------------------------------|
| `encryption`     | `S3_MANAGED`                                          |
| `versioned`      | `true`                                                |
| `lifecycleRules` | suppression des versions non courantes après 30 jours |
| `removalPolicy`  | `RETAIN`                                              |

Réglages imposés, absents des props :

- `blockPublicAccess` : `BLOCK_ALL`. Un site statique est servi par CloudFront, jamais directement par S3.
- `enforceSSL` : les requêtes non chiffrées sont refusées.
- `minimumTLSVersion` : `1.2`.

Le versioning permet de récupérer un fichier écrasé ou supprimé pendant 30 jours. Passer `lifecycleRules` remplace la
règle par défaut : la reprendre si on veut la garder.

```ts
import {s3} from "@lacolombemons/aws-constructs";

new s3.Bucket(this, "EcodimSiteBucket");
new s3.Bucket(this, "Uploads", {versioned: false, lifecycleRules: []});
```

## Ajouter un construct

1. Une branche par construct : `feat/add-<service>-<construct>-construct`.
2. Reprendre le code existant dans ecodim et en extraire les réglages par défaut.
3. Exporter le construct dans `src/<service>/index.ts` et le service dans `src/index.ts`.
4. Après la release, remplacer le code d'ecodim par le construct (bump de version dans ecodim).
