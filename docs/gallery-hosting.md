# Running a Hearth gallery

This is the operator's guide: what to do, in order, to have a dashboard gallery
that people can browse and publish to. The wire contract is
[`gallery-api.md`](gallery-api.md); the server is in `server/`.

Everything below assumes you are at the repository root.

---

## 1. Try it locally, in one command

```sh
docker compose -f server/docker-compose.yml up -d --build
```

That builds the server and starts it on `http://localhost:8787`, with its whole
state in one SQLite file inside a Docker volume. Check it:

```sh
curl http://localhost:8787/v1/info
```

Then, in Obsidian: **Settings → Hearth → Import / export → Dashboard gallery**,
and replace the address there with `http://localhost:8787` (the field arrives
holding the default gallery — see §8). Hearth allows plain `http` on a loopback
address for exactly this, so no certificate is needed to try it. The gallery
buttons — beside "Add card" in arrange mode, in the add-card picker's rail, and
on the setup wizard's first step — follow whatever address is saved.

Publish a board from **Share dashboard → Publish**, and it is there.

**No Docker?** Node 24 (or 22.5+ with `--experimental-sqlite`) and nothing else:

```sh
npm ci
node server/esbuild.config.mjs
DB_PATH=./data/gallery.db node server/dist/index.js
```

The build produces one file with no dependencies. That is the whole deployment
artifact, and it is worth knowing: upgrading a gallery is copying a file.

---

## 2. Check it actually works

```sh
npm --prefix server run smoke                      # against localhost:8787
GALLERY_URL=https://gallery.example.com \
	npm --prefix server run smoke                  # against a deployed one
```

Forty-four checks: signing in with a real key, publishing real signed packages,
refusing an unsigned one and an edited one, voting, downloading, withdrawing.
It mints a fresh identity per run, so it is safe to run against a live gallery
more than once — though it does publish two boards and leave one behind.

Raise `WRITES_PER_MINUTE` for the duration of a run, or the rate limiter will
(correctly) stop it half way through.

---

## 3. Put it on the internet

Three things have to be true, and only the first is about the gallery.

### TLS, from something in front

The server speaks plain HTTP and should never be the thing facing the internet.
Hearth refuses to talk to an `https`-less host anyway (outside loopback), so
this is not optional. Caddy is the shortest path:

```caddyfile
gallery.example.com {
	reverse_proxy 127.0.0.1:8787
	request_body {
		max_size 20MB          # above MAX_PACKAGE_BYTES, or uploads fail at the proxy
	}
}
```

nginx equivalent: `proxy_pass http://127.0.0.1:8787;` with
`client_max_body_size 20m;`. The body limit is the one people forget — a
16 MiB package plus JSON overhead has to fit through the proxy as well as
through the server.

### Tell the server it is behind a proxy

```
TRUST_PROXY=1
```

**Only** once a proxy you control is actually in front of it. With it on, the
client address is read from `X-Forwarded-For`, a header anyone talking to the
socket sets for themselves. On a directly exposed server that turns every
per-address limit into a limit per string-they-typed, which is no limit at all.

With it off, per-address limits use the socket address — which behind a proxy is
the proxy, so every visitor shares one bucket. Getting this wrong in either
direction breaks rate limiting, which is the entire anti-abuse story. Get it
right.

### Don't publish the port

`docker-compose.yml` binds to `127.0.0.1:8787` on purpose. Leave it there and
let the proxy reach it; don't change it to `8787:8787` and then also run a
proxy.

---

## 4. Settings worth deciding

Copy `server/.env.example` to `server/.env` and change what you mean to. Every
value has a default and the server starts with none of them set. The ones that
are actually decisions:

| | |
| --- | --- |
| `GALLERY_NAME` | what clients call your gallery. Set it. |
| `MAX_PACKAGE_BYTES` | the outer bound on an upload, default 16 MiB. The format's own caps (4 MiB per picture) still apply inside it. |
| `MAX_ENTRIES_PER_AUTHOR` | 50. A gallery is not a backup service. |
| `UPLOADS_PER_DAY` | 10 per identity. |
| `VOTES_PER_DAY`, `VOTES_PER_IP_PER_DAY` | 200 and 400. |
| `READS_PER_MINUTE`, `WRITES_PER_MINUTE` | 300 and 30, per address. |
| `VOTE_MIN_KEY_AGE_HOURS` | **0 — the dial to reach for first if you get a vote ring.** See below. |
| `TERMS_URL` | optional; shown to people as text. |

---

## 5. What you are actually signing up for

### Votes can be manufactured, and no setting fixes that

An identity is a key somebody's copy of Hearth generated. Keys are free to mint,
so identities are free, so votes are free. Nothing in this design is
Sybil-resistant and nothing you can add to the server makes it so.

What you have is friction:

- **per-address limits**, which are the ones that cost an attacker something;
- **`VOTE_MIN_KEY_AGE_HOURS`**, which makes a key wait before its votes count.
  It ships at 0 because a new gallery telling its first ten users to come back
  tomorrow is worse than the problem. Set it to 24 the day you need it — it
  costs an attacker a day per identity.

Say this in your terms rather than implying a robustness the mechanism doesn't
have. A vote count here means "some number of people who have Hearth installed",
not "some number of distinct humans".

### You are hosting other people's files

Every entry is a JSON file somebody uploaded, served to other people's vaults.
The server refuses a package that isn't signed, one whose signature doesn't
verify, one that isn't a single dashboard, one that still names its author's
folders or private feeds, and one whose embedded pictures are the wrong type or
over the caps. What it does **not** do — because nothing automated can — is
judge what a board is *for*.

A dashboard can name public URLs on purpose: an embedded page, an RSS feed, a
wallpaper given as a URL. Those are what the board *is*, so they travel, and
`remoteRefs` on every entry says how many there are. But it does mean a
published board can point at anything on the web. If your gallery grows past
people you know, you will want to look at what is in it.

The tools for that are in the database, which is one file:

```sh
# What is live, newest first
sqlite3 /var/lib/hearth/gallery.db \
	"SELECT id, name, category, remote_refs, published_at FROM entries WHERE status='live' ORDER BY published_at DESC LIMIT 20;"

# Held for review — the strip's own backstop saw something path-shaped
sqlite3 … "SELECT id, name, hold_reason FROM entries WHERE status='held';"

# Take something down (keeps the id, so it can never be reused)
sqlite3 … "UPDATE entries SET status='removed', package='', wallpaper=NULL WHERE id='…';"

# Release a held entry after looking at it
sqlite3 … "UPDATE entries SET status='live', hold_reason=NULL WHERE id='…';"
```

There is no admin UI, deliberately: an admin UI is an authentication surface,
and `sqlite3` over ssh is one you already have.

### Withdrawing is not deletion

Someone who installed a board keeps it. Nothing about publishing is retractable
from other people's vaults, and Hearth says so before anybody publishes.

---

## 6. Backups

The gallery is one SQLite file. Back that up and you have backed up everything —
entries, packages, wallpapers, votes, profiles.

```sh
# Safe while the server is running. Don't `cp` a live SQLite file.
sqlite3 /var/lib/hearth/gallery.db ".backup '/backups/gallery-$(date +%F).db'"
```

With Docker:

```sh
docker compose -f server/docker-compose.yml exec gallery \
	node -e "const{DatabaseSync}=require('node:sqlite');new DatabaseSync('/data/gallery.db').exec(\"VACUUM INTO '/data/backup.db'\")"
docker compose -f server/docker-compose.yml cp gallery:/data/backup.db ./gallery-backup.db
```

Restoring is putting the file back and starting the server. Migrations are
numbered and applied on startup, so an older file opened by a newer build
upgrades itself.

Two things are *not* in the database and don't need to be: nobody's private key
(they never leave their vaults) and no passwords (there aren't any). What a
stolen copy of this file gives someone is a list of public keys, which are
public, and everything already published.

---

## 7. Upgrading

```sh
git pull
docker compose -f server/docker-compose.yml up -d --build
```

The container is stateless; the volume is the state. Migrations run on startup.
Take a backup first anyway.

---

## 8. The default gallery

`DEFAULT_GALLERY_URL` in `src/gallery/client.ts` is
`https://gallery.o-uhnavy.com`, so that is the gallery every install points at
until somebody changes it. Three things follow, and they are the reason this
section exists:

- **It is what you are on the hook for.** Uptime, moderation, and the bandwidth
  of every listing thumbnail every Hearth user loads when they open the gallery.
  §5 is the part worth re-reading before a release goes out.
- **Nothing is fetched until somebody opens it.** Configuring a host draws the
  buttons; it does not make a request. A vault that never opens the gallery
  never talks to it.
- **Off stays off.** Clearing the address in settings turns the gallery off
  entirely, and `migrateSettings` distinguishes a stored empty string from a key
  that was never there — so an upgrade re-seeds the default for a vault that has
  never seen the setting, and leaves a vault that switched it off alone.

Pointing a build at a different gallery — a fork, a private one for a team — is
that one line, plus the address field for anybody who wants to do it per vault.

---

## Troubleshooting

**"That isn't an address Hearth will talk to."** `https`, or `http` on
localhost. Not an `http` host on the network — including `http://192.168.…`,
which is the common one.

**"That address answered, but not like a Hearth gallery."** `GET /v1/info`
didn't come back with `api: 1`. Usually a proxy serving something else at that
path, or a trailing path prefix Hearth kept and the proxy strips.

**Uploads fail at ~1 MB.** The reverse proxy's body limit, not the server's.
See the Caddy/nginx snippets above.

**Every visitor shares one rate-limit bucket.** `TRUST_PROXY` is off behind a
proxy. Set it to 1.

**One visitor can exhaust everyone's bucket.** `TRUST_PROXY` is on without a
proxy. Set it to 0.

**`SQLite is an experimental feature`** on Node 22. Expected; `node:sqlite` is
stable from Node 24, which is what the Docker image uses.

**A publish is refused with "still names N things from its author's vault".**
The uploader published without the strip. In Hearth's own publish path that
can't happen — it is pinned on — so this means a different client, or a
hand-made file.
