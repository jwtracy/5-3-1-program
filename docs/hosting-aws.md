# Hosting on AWS (single small VM)

This is how the author self-hosts the app: a single small EC2 instance, the Next.js
**standalone** build run directly under **systemd**, reverse-proxied by **nginx** with a
Let's Encrypt cert and an **IP allowlist** so only your own network(s) can reach it. The
SQLite database lives on the VM outside the repo. It's cheap (one `t4g.small`/`t4g.medium`)
and there's no separate database server.

You don't have to use AWS — any Linux VM with a public IP works. The scripts assume Amazon
Linux 2023 (arm64) but are easy to adapt.

## Architecture

```
your browser ──HTTPS(443)──▶ nginx (TLS + IP allowlist) ──▶ node server.js (127.0.0.1:3000)
                                                              └─ SQLite at /var/lib/<app>/app.db
```

- **nginx** terminates TLS and only allows your listed IPs on 443; port 80 is world-open
  *only* to serve the ACME challenge + redirect to HTTPS.
- **systemd** runs the Next.js standalone server as a locked-down service user.
- **deploy** ships build artifacts over SSH and runs DB migrations on the box.

## The scripts

| File | Runs where | Does |
|---|---|---|
| `deploy/setup-vm.sh` | on the VM, once | installs Node + nginx + build tools, creates the `apptracker` service user and data dirs, brings up a minimal `:80` server, and issues the TLS cert with certbot |
| `deploy/deploy.sh` | your machine, every deploy | builds locally, rsyncs the standalone bundle to the VM, then invokes the remote script |
| `deploy/remote-deploy.sh` | on the VM, every deploy | syncs the bundle into `/opt/<app>`, installs a linux-native `better-sqlite3` for the migration tooling, runs migrations + seed, installs the systemd unit + nginx conf, restarts, health-checks |
| `deploy/program-tracker.service` | on the VM | the systemd unit (env: `PORT`, `HOSTNAME=127.0.0.1`, `DATABASE_PATH`) |
| `deploy/nginx-program-tracker.conf` | on the VM | nginx template; `__DOMAIN__` and `__ALLOW_RULES__` are substituted at deploy time |

## One-time AWS setup

1. **Launch an instance** — e.g. `t4g.small`, Amazon Linux 2023 (arm64), in a region near you.
2. **Elastic IP** — allocate one and associate it with the instance, so your domain/cert
   survive reboots. (Don't leave a spare EIP unassociated — AWS bills idle ones.)
3. **DNS** — point an `A` record (e.g. `str.example.com`) at the Elastic IP.
4. **Security group** — inbound:
   - `80` from `0.0.0.0/0` (ACME HTTP-01 challenge + HTTPS redirect only),
   - `443` from your IP(s) only (e.g. `203.0.113.7/32`),
   - `22` from your IP(s) only.
5. **Copy `.env.example` → `.env`** and fill in `DOMAIN`, `ALLOW_IPS`, `SSH_HOST`,
   `SSH_USER`, `SSH_KEY`, `EMAIL`.
6. **Prep the VM + issue the cert** (DNS must resolve first):
   ```bash
   source .env
   DOMAIN="$DOMAIN" EMAIL="$EMAIL" \
     ssh -i "$SSH_KEY" "$SSH_USER@$SSH_HOST" 'sudo bash -s' < deploy/setup-vm.sh
   ```
7. **Deploy**:
   ```bash
   source .env
   ./deploy/deploy.sh
   ```

## Updating

Re-run `./deploy/deploy.sh`. It's idempotent — the seed is a no-op once seeded, and the
service restarts cleanly. For schema changes, run `pnpm db:generate`, commit the new
migration, then deploy (it applies pending migrations on the box).

## When your allowlisted IP changes

Residential IPs rotate. Update the security group **and** re-render the nginx allowlist:

```bash
source .env
SG=sg-xxxxxxxx; NEW=203.0.113.42
aws ec2 authorize-security-group-ingress --group-id "$SG" \
  --ip-permissions "IpProtocol=tcp,FromPort=443,ToPort=443,IpRanges=[{CidrIp=$NEW/32}]"
# (optionally revoke the old rule)
ALLOW_IPS="$NEW" ./deploy/deploy.sh
```

## Verifying

- On the VM: `systemctl status program-tracker` is active; `sudo nginx -t` is OK.
- From an allowlisted network: `curl -I https://your.domain` → `200` with a valid cert.
- From elsewhere (e.g. phone on cellular): → `403`.

## Notes

- Everything is one node process + one SQLite file; to scale, add `server 127.0.0.1:<port>;`
  lines to the `upstream` block in the nginx conf and run matching service instances.
- Back up `app.db` by copying it off the VM periodically (it's the whole database).
