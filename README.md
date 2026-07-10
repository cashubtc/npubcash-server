<br />
<div align="center">
  <a href="https://github.com/github_username/repo_name">
    <img src="https://image.nostr.build/c6720e6ad2ac5726792254a0097e2cc3b75c18036f88de914a5a2684a7d6c170.jpg" alt="Logo" width="80" height="80">
  </a>

<h3 align="center">npub.cash server</h3>

  <p align="center">
    The webserver powering npub.cash
    <br />
    <a href="https://docs.cashu-address.com"><strong>Explore the docs »</strong></a>
    <br />
    <br />
    <a href="https://npub.cash">View Demo</a>
  </p>
</div>

## About The Project

Cashu Mints can offer a better and more sovereign custodial Lightning experience. However because eCash tokens are stored by the users themselves, offline receiving can be challenging. npub.cash introduces a LNURL service that generates tokens on received payments and holds on to them for a user, until they come back online. This is a reference implemenation of the npub.cash service written in Typescript.

## Getting Started

npubcash-server is a NodeJs application written in TypeScript. Below is a step-by-step on how to get it started.

### Prerequisites

- Node and npm. Install NodeJs and it's package manager npm.

### Installation

1. Clone the repo

```sh
git clone https://github.com/github_username/repo_name.git
```

2. Install NPM packages

```sh
npm install
```

3. Setup your environment varaibles according to `example.env`. Variables from `.env` will be automatically read by the development server, but not the production build.

4. Start the development server

```sh
npm run dev
```

## Usage

By default the dev server will include the projects landing page on the root domain.
For more details check out the [documentation](https://docs.cashu-address.com)

### Migrating a v2 PostgreSQL database

The v3 server uses a clean database initialized by its dialect-aware migrations. To
move an existing v2 PostgreSQL installation, create a separate empty PostgreSQL
database, stop every v2 server instance, and run:

```sh
cd packages/server
bun run migrate:v2-postgres -- \
  --source "$V2_DATABASE_URL" \
  --target "$V3_DATABASE_URL" \
  --confirm-v2-stopped \
  --report migration-report.json
```

Run the same command with `--dry-run` first to validate the source schema and
produce row counts and checksums without modifying the target. The source database
is never modified. The target must be empty on the first run; later runs recognize
a matching completed migration receipt.

Automatic migration only supports the standard v2 `public` schema. If the source
connection selects another schema, the command exits before modifying the target
and reports that the database requires a manual migration.

The migration report records `status`, `targetCommit`, `retrySafe`, and
`operatorGuidance`. A successful migration also stores a receipt in the target
database as part of the same transaction as the copied data. If the connection is
lost while waiting for `COMMIT`, the command uses a separate connection to check
that receipt. Running the command again against a target with a matching completed
receipt reports the previous success without copying data again.

Use the reported state to decide whether to retry:

| Status | Target commit | Retry safe | Retry behavior |
| --- | --- | --- | --- |
| `dry_run_completed` | `not_attempted` | `true` | The target was not changed; the migration may be run. |
| `failed_before_target_commit` | `not_attempted` | `true` | The target transaction was not committed; correct the error and retry. |
| `failed_before_target_commit` | `not_attempted` | `false` | Do not retry automatically. Follow `operatorGuidance`; a non-standard source schema requires manual migration. |
| `migration_completed` | `confirmed` | `false` | Do not retry. Continue with target verification and cutover. |
| `target_commit_unknown` | `unknown` | `false` | Do not retry until the target is reachable and the command can inspect its receipt. |

If writing `--report` fails after a confirmed commit, the command prints a warning
but still reports the migration as completed. Save the JSON printed to standard
output and do not rerun the migration to recreate the file.

The script copies `l_users`, `mint_quotes`, `mints`, and `proofs`. Populated v1-only
tables stop the migration by default because v3 cannot use their data. After
reviewing and backing up those tables, pass `--allow-unmigrated-legacy-data` to
leave them in the source and continue. Keep the v2 database until the v3 deployment
has been verified so switching the application connection string back remains a
rollback option.

Before deploying, set the target URL as the v3 app's `DATABASE_URL` secret and
confirm the secret exists on that exact app. Fly secrets are app-specific, so a
new or renamed app does not inherit the v2 app's secrets. The checked-in
`fly.toml` is for the nightly SQLite deployment, not an existing-app upgrade.
See [the deployment guide](docs/deploy.md#flyio-and-v2-to-v3-cutover) for the
cutover commands and rollback precautions.

## Roadmap

- [x] Implement basic API
- [x] Implement NIP-05 endpoint for all users
- [x] Add notifications
- [ ] Improved error handling and logging
- [ ] Remove Blink API (depends on cashu webhooks)
- [ ] Implement NUT-10 (depends on ecosystem)

## Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement".

## License

Distributed under the MIT License. See `LICENSE.txt` for more information.

## Contact

Lead Maintainer: Egge - [@egge21m on Twitter](https://twitter.com/egge21m) - [or on nostr](nostr:npub1mhcr4j594hsrnen594d7700n2t03n8gdx83zhxzculk6sh9nhwlq7uc226)
