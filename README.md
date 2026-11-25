# cdk-base

Constructs CDK partagés par les projets de La Colombe Mons, publiés sur npm sous `@lacolombemons`.
Monorepo yarn workspaces, turbo, biome, release-please.

- `packages/cdk/aws-constructs` (`@lacolombemons/aws-constructs`) : constructs AWS avec les réglages par défaut des
  projets.
- `packages/tools/tsconfig` : tsconfig commun (privé).

```bash
yarn install && yarn build && yarn test && yarn lint
```

## Utiliser `@lacolombemons/aws-constructs`

```ts
import {apigatewayv2, cloudfront, cloudwatch, dynamodb, iam, lambda, s3} from "@lacolombemons/aws-constructs";
```

Chaque construct étend la ressource `aws-cdk-lib` correspondante. Les défauts sont dans
`src/<service>/<construct>.ts`. Une prop passée remplace entièrement le défaut, sans fusion
(`bundling: {sourceMap: true}` perd `minify: true`).

- **Logical IDs** : les log groups créés par `lambda.NodejsFunction` et `apigatewayv2.HttpApi` sont frères de la
  ressource (`<id>LogGroup`, `<id>AccessLogs`), pas enfants. `cloudfront.SecurityHeadersPolicy` est la ressource
  elle-même. Remplacer une ressource existante par le construct, avec le même id, ne la recrée donc pas.
- **`dynamodb.Table` / `EphemeralTable`** : pas de `tableName` (nom généré, passé au code par variable
  d'environnement). Migrer depuis `aws_dynamodb.Table` ou retirer un `tableName` remplace la table : migrer les
  données.
- **`iam.GithubOidcProvider`** : un seul par compte AWS. Les projets suivants l'importent par ARN et créent seulement
  leur `iam.GithubDeployRole`.
- **`iam.GithubDeployRole`** exige les *immutable subject claims* GitHub (`use_immutable_subject: true` sur l'org ou
  le repo) : `repository` prend `ownerId` et `id`, obtenus avec `gh api repos/<owner>/<repo> --jq '.owner.id, .id'`.
  Le rôle n'assume que les rôles `cdk-<qualifier>-*` du bootstrap.
- **`apigatewayv2.HttpApi`** : le throttling et les logs d'accès sont posés sur le `CfnStage` du stage `$default`.
  Avec `createDefaultStage: false`, ces props lèvent une erreur.
- **`s3.Bucket`** : accès public bloqué, SSL et TLS 1.2 imposés, non configurables.

## Règles

- **Repo public** : aucune valeur réelle (ID de compte AWS, ARN, domaine, email, nom de ressource ou de paramètre
  SSM) dans le code, les tests, la doc ou les descriptions de PR. Uniquement des valeurs fictives (`example.com`,
  `123456789012`, `example-*`).
- **Un construct par branche** (`feat/add-<service>-<construct>-construct`), avec ses tests dans
  `test/<service>/<construct>.test.ts`. Son intégration dans un projet doit donner un `cdk diff` vide ou expliqué.
- **Conventional Commits** pour les titres de PR. `pre-push` lance `yarn ci`.
- **Breaking changes** : supprimer ou renommer un construct, un export ou une prop, ou changer un défaut d'une façon
  qui modifie les templates des projets, passe en `feat!:` (ou `fix!:`) avec un footer
  `BREAKING CHANGE: <ce qui change et comment migrer>`. Jamais en simple `fix:`.

## Release

release-please ouvre une PR de release sur `main`. Une fois mergée, le workflow `Release` publie sur npm via trusted
publishing (aucun token npm). Prérequis : secret `RELEASE_PLEASE_TOKEN` (PAT) et trusted publishing configuré sur
chaque package. Un nouveau package se publie une première fois à la main (`npm publish --access public`).
