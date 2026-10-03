# Self-hosting

Run your own copy of MTG Fannable Cards with Docker: the web app, optionally behind HTTPS, and the command-line generator. This is the same setup as the public instance.

## What you need

- A Linux x86-64 machine with [Docker](https://docs.docker.com/engine/install/) and Docker Compose 2.24 or later.
- 2 GB of RAM. The app holds Scryfall's card data in memory (about 0.75 GB), and briefly twice that while it swaps in a daily update.
- About 15 GB of disk: the card data (about 115 MB, plus working space) and the art cache, which is capped at 10 GB by default.
- For HTTPS, a domain name whose DNS record points at the machine, and ports 80 and 443 open.

## A new server in one step

For a fresh Ubuntu server, such as a DigitalOcean droplet, `npm run provision` (in [`scripts/provision-vps.js`](../scripts/provision-vps.js)) does everything below over SSH, from a clone of this repository:

- Installs updates (and automatic security updates), adds a swap file, and installs Docker.
- Sets up the firewall: SSH, plus 80 and 443 with a domain, or 3000 without one.
- Creates the `deploy` user, which can log in with your SSH keys and, optionally, the GitHub Actions deploy key.
- Writes the app folder with `docker-compose.yml`, `Caddyfile` and `.env`, and with `--start` starts the app.

Settings come from arguments or a JSON file (see [`scripts/provision.example.json`](../scripts/provision.example.json)); the README's "On a DigitalOcean droplet" section walks through it. Otherwise, set the server up by hand as follows.

## Start the app

Make a folder and put three files from this repository in it: [`docker-compose.yml`](../docker-compose.yml), [`Caddyfile`](../Caddyfile) and [`.env.example`](../.env.example), renamed `.env`. Then:

```
mkdir out
docker compose up -d
```

Open http://your-server:3000. The first start downloads the Scryfall card data, which takes a minute or so; until it's loaded, previews say so and jobs wait. `docker compose logs -f app` shows progress as JSON lines.

The image is `ghcr.io/verbatiama/mtgfanablecards`. `FANNABLE_TAG` in `.env` picks the version: `latest` (the newest release, the default), a release such as `v1.0.0`, or `main` (every change, as the public instance runs).

## HTTPS with Caddy

The `caddy` profile adds a [Caddy](https://caddyserver.com) reverse proxy that gets and renews a Let's Encrypt certificate for your domain. In `.env`:

```
COMPOSE_PROFILES=caddy
DOMAIN=cards.example.com
APP_PORT=127.0.0.1:3000
```

`APP_PORT` keeps port 3000 off the network, so visitors only reach the app through Caddy. Then `docker compose up -d`, and open https://cards.example.com.

The app trusts Caddy's forwarded headers for client IPs (for the rate limits) because Caddy sits on the same Docker network. If you use your own proxy elsewhere, set `TRUST_PROXY` to its address.

## Settings

Everything is optional, set in `.env`. Limits set to `0` are turned off.

| Variable                        | Default | Purpose                                                                                                                              |
| ------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `FANNABLE_TAG`                  | latest  | Image version                                                                                                                        |
| `APP_PORT`                      | 3000    | Host port (or `address:port`) for the app                                                                                            |
| `COMPOSE_PROFILES`, `DOMAIN`    |         | `caddy` and your domain for HTTPS                                                                                                    |
| `ART_CACHE_MAX_GB`              | 10      | Art cache cap; the least-used quarter is dropped when reached                                                                        |
| `MAX_BODY_KB`                   | 64      | Largest decklist accepted                                                                                                            |
| `MAX_CARDS_PER_JOB`             | 250     | Cards per batch, counting copies                                                                                                     |
| `MAX_RUNNING_JOBS`              | 2       | Batches rendering at once; others queue                                                                                              |
| `JOB_TTL_MINUTES`               | 60      | How long finished downloads are kept                                                                                                 |
| `SCRYFALL_REFRESH_HOURS`        | 24      | How often to check Scryfall for new card data                                                                                        |
| `RATE_LIMIT_JOBS_PER_HOUR`      | 10      | New batches per visitor IP per hour                                                                                                  |
| `RATE_LIMIT_PREVIEW_PER_MINUTE` | 120     | Preview requests per visitor IP per minute                                                                                           |
| `TRUST_PROXY`                   | private | Proxies whose forwarded headers are trusted: `true`, `false`, or addresses and CIDR ranges; by default loopback and private networks |

Change `.env`, then `docker compose up -d` to apply it.

## The command line

The same image runs the CLI, sharing the app's card data and art cache. It reads the decklist from stdin and writes into `./out`:

```
docker compose run --rm -T app cli - < deck.txt           # out/cards.zip
docker compose run --rm -T app cli - --pdf < deck.txt     # out/cards.pdf
docker compose run --rm -T app cli --help
```

The CLI loads its own copy of the card data, about another 1 GB of memory, so on a 2 GB machine stop the app first (`docker compose stop app`) or run it elsewhere. Without Compose:

```
docker run -i --rm -v fannable-data:/data -v "$PWD/out:/app/out" ghcr.io/verbatiama/mtgfanablecards cli - < deck.txt
```

If `out/` is created by Docker it belongs to root and the CLI can't write to it; create it yourself first (`mkdir out`). The container runs as user 1000.

## Updating

```
docker compose pull
docker compose up -d
```

Running batches finish before the old container stops (up to 5 minutes); queued batches that hadn't started are lost, and their visitors need to generate again. The card data and art cache are in the `data` volume, so they survive updates.

## Data and backups

Nothing needs backing up: the `data` volume holds only downloaded card data and art, which come back by themselves. Finished downloads live inside the container and go when it's replaced. To start afresh, `docker compose down -v` deletes the volumes.

Logs are rotated by Docker (5 files of 10 MB each per service). `GET /api/health` answers `200` once the app is up, for an uptime monitor.

## Continuous deployment

Maintainers only: how the public instance is deployed (D30). Every push to `main` runs the CI checks, publishes the image as `:main` and, when deployment is set up, copies `docker-compose.yml` and `Caddyfile` to the server and runs `docker compose pull && docker compose up -d` there over SSH. Tags such as `v1.2.3` publish `:v1.2.3` and `:latest`.

To set it up:

1. On the server, create a user in the `docker` group (e.g. `deploy`) and a folder for the app (e.g. `~/fannable`) with a `.env` that sets `FANNABLE_TAG=main`, the Caddy profile and the domain, and an `out/` folder. `npm run provision` does this; pass it the deploy key's public half with `--deploy-key` and it skips step 2's `authorized_keys` edit too.
2. Make an SSH key pair for GitHub Actions and add the public key to that user's `~/.ssh/authorized_keys`.
3. In the GitHub repository settings, under Secrets and variables → Actions:
   - Secrets: `DEPLOY_SSH_KEY` (the private key) and `DEPLOY_KNOWN_HOSTS` (the output of `ssh-keyscan <server>`).
   - Variables: `DEPLOY_HOST` (the server's address), and optionally `DEPLOY_USER` (default `deploy`) and `DEPLOY_PATH` (default `~/fannable`).
4. Make the package public once, under the repository's Packages → mtgfanablecards → Package settings, so servers can pull it without logging in.

Deployment stays off until `DEPLOY_HOST` is set.
