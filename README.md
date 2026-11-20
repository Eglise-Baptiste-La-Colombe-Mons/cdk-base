# cdk-base

Constructs et stacks CDK partagés par les projets de La Colombe Mons (ecodim-app, jeunesse-app, et les suivants).
Monorepo structuré comme `constructs` (Necko) : yarn workspaces, turbo, biome, release-please.
Repo public. Les packages sont publiés sur le registre npm public, sous le scope `@lacolombemons`.

| Package | Contenu |
| --- | --- |
| [`@lacolombemons/cdk-base`](packages/cdk/base) | `BaseStack` : tags communs, protection contre la suppression, partage entre stacks via SSM |
| [`@lacolombemons/aws-constructs`](packages/cdk/aws-constructs) | Constructs AWS avec les réglages par défaut issus d'ecodim (un dossier par service) |
| `packages/tools/tsconfig` | tsconfig commun aux packages (privé) |

## Commandes

```bash
yarn install
yarn build      # compile tous les packages (turbo)
yarn lint       # biome check
yarn lint:fix
```

## Workflow

Une branche par construct (`feat/add-<service>-<construct>-construct`), une PR, une release.
Chaque construct est ensuite intégré dans ecodim par un bump de version, un par un.

Le hook husky `pre-push` lance `yarn ci` (biome). Les titres de PR doivent suivre Conventional Commits.

## Publier une version

Les commits suivent [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, …).
Sur `main`, release-please ouvre une PR de release. Une fois mergée, le workflow `Release` publie les packages
non privés sur npm, avec provenance. Toutes les versions sont liées (`linked-versions`).

Prérequis :

- secret `RELEASE_PLEASE_TOKEN` (un PAT, pour que la PR de release déclenche les checks) ;
- organisation npm `lacolombemons` ;
- trusted publishing configuré sur chaque package npm (Settings → Trusted publishing → GitHub Actions,
  dépôt `Eglise-Baptiste-La-Colombe-Mons/cdk-base`, workflow `release-please.yml`). Aucun token npm n'est stocké.
  npm ne permet de le configurer que sur un package existant : la toute première version se publie à la main
  (`npm publish --access public` depuis le dossier du package, après `yarn build`).

## Consommer un package depuis un projet

Aucune authentification n'est nécessaire :

```bash
yarn workspace @ecodim/infra add @lacolombemons/cdk-base @lacolombemons/aws-constructs
```
