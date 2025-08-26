# Production Deployment & Maintenance Guide

> Applies to the LXC container **partisiabot01** running the *partisia‑staking* service.

---

## 1 · Fast update workflow

```bash
# 1. As **bot** ‑ pull & build
cd ~/git/partisia-staking
git pull                      # fetch latest commit
npm ci                        # installs prod **and** dev deps
npm run build                 # compiles TS → dist/

# 2. Deploy artefacts
sudo rsync -a --delete ./dist/          /srv/partisia-staking/
sudo rsync -a --delete ./node_modules   /srv/partisia-staking/
sudo chown -R staking:staking /srv/partisia-staking

# 3. Bounce the service
sudo /usr/local/bin/partisia-restart.sh # prompts for password interactively
sudo journalctl -fu partisia.service    # watch until "active (running)"
```

A one‑liner you can bookmark (requires interactive password):

```bash
sudo rsync -a --delete ./dist/ /srv/partisia-staking/ \
     && sudo rsync -a --delete ./node_modules /srv/partisia-staking/ \
     && sudo chown -R staking:staking /srv/partisia-staking \
     && sudo /usr/local/bin/partisia-restart.sh
```

---

## 2 · Secret management – design & hardening

| Layer                       | What we do                                                                                                                                          | Why it matters                                                                   |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **At‑rest encryption**      | `/etc/partisia-staking/.env.gpg` is AES‑256 encrypted with **GPG symmetric mode**.                                                                  | Disk snapshots / backups never contain plaintext secrets.                        |
| **Interactive password**    | Password prompted interactively via SSH terminal when starting/restarting service. No persistent password storage on disk.                        | Eliminates clear-text password files; requires manual intervention for security. |
| **Just‑in‑time decryption** | Wrapper script `partisia-restart.sh` prompts for password, stores temporarily in `/dev/shm` for ~3 seconds. `partisia-start.sh` immediately wipes it. | Secrets live in RAM only for minimal time; never persist on disk.               |
| **Privilege drop**          | Wrapper calls `runuser -u staking …`; Node runs as unprivileged UID 999.                                                                            | Limits blast radius if app is compromised.                                       |
| **systemd sandbox**         | `ProtectSystem=strict`, `ProtectHome=yes`, `ProtectProc=invisible`, `PrivateTmp=yes`, `CapabilityBoundingSet=SETUID,SETGID`, `NoNewPrivileges=yes`. | File‑system read‑only, hides other /proc entries, no device access, no new caps. |

> **TL;DR** The secrets cannot be read without interactive password entry; plaintext exists for <3 seconds in RAM only.

---

## 3 · Creating the **first** secrets file

```bash
# 1. Create a strong passphrase (keep this secure - you'll need it for every restart!)
# Generate a random 32-character passphrase and store it securely offline
PASSPHRASE=$(head -c24 /dev/urandom | base64 | tr -d '=')
echo "Generated passphrase: $PASSPHRASE"
echo "IMPORTANT: Save this passphrase securely - you'll need it for every service restart!"

# 2. Create directory structure
mkdir -p /etc/partisia-staking

# 3. Write the plaintext env (temporary)
cat > /tmp/plain.env <<'EOF'
ENVIRONMENT=TESTNET
LS_CONTRACT=0x…
PARTISIA_API_URL=https://node1.testnet.partisiablockchain.com
NODE_ENV=production
EOF

# 4. Encrypt with your passphrase
echo "$PASSPHRASE" | gpg --batch --yes --symmetric --cipher-algo AES256 \
    --passphrase-fd 0 \
    --output /etc/partisia-staking/.env.gpg /tmp/plain.env

# 5. Clean up
shred -u /tmp/plain.env          # purge plaintext env
unset PASSPHRASE                 # clear from shell history

# 6. Start service (will prompt for the passphrase you just created)
sudo /usr/local/bin/partisia-restart.sh
```

---

## 4 · Viewing current secrets

To decrypt and view the current secrets:

```bash
# Prompt for password and pipe directly to GPG (no temporary files)
read -s -p "Enter GPG passphrase: " PASS
echo "$PASS" | gpg --batch --yes --decrypt \
    --passphrase-fd 0 \
    /etc/partisia-staking/.env.gpg
unset PASS
```

*(Outputs to the terminal – password never touches disk.)*

---

## 5 · Updating secrets

```bash
# 1. Prompt for password (will be used twice - for decrypt and encrypt)
read -s -p "Enter GPG passphrase: " PASS
echo

# 2. Decrypt into RAM‑based tmp file
TMP=$(mktemp --tmpdir=/dev/shm env.XXXX)
echo "$PASS" | gpg --batch --yes --decrypt \
    --passphrase-fd 0 \
    /etc/partisia-staking/.env.gpg > "$TMP"

# 3. Edit
nano "$TMP"      # or $EDITOR

# 4. Re‑encrypt
echo "$PASS" | gpg --batch --yes --symmetric --cipher-algo AES256 \
    --passphrase-fd 0 \
    --output /etc/partisia-staking/.env.gpg "$TMP"

# 5. Clean up
shred -u "$TMP"
unset PASS

# 6. Reload (will prompt for password again)
sudo /usr/local/bin/partisia-restart.sh
```

> **Note:** If you lose your GPG passphrase, you cannot decrypt the secrets. Keep it stored securely offline.

---

## 6 · Service management

### Starting/Restarting the service

**Always use the restart script** (never use `systemctl start partisia` directly):

```bash
sudo /usr/local/bin/partisia-restart.sh
```

This will:
1. Stop the current service (if running)
2. Prompt for the GPG passphrase (hidden input)
3. Start the service with the provided password
4. Clean up the password from memory

### Checking service status

```bash
sudo systemctl status partisia
sudo journalctl -u partisia -f    # follow logs
sudo journalctl -u partisia -n 20 # last 20 lines
```

### Emergency stop

```bash
sudo systemctl stop partisia
```

---

## 7 · Troubleshooting cheat‑sheet

| Symptom                                      | Quick check                                    | Common fix                                                                                |
| -------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `Cannot find module 'X'`                     | `ls node_modules/X` in `/srv/partisia-staking` | Re‑run build & rsync **without** trailing slash on `node_modules`.                        |
| `gpg: can't create '/root/.gnupg'`           | Wrapper didn't set scratch `GNUPGHOME`.        | Ensure wrapper block that creates `/dev/shm/gnupg.*`.                                     |
| `runuser: cannot set groups`                 | Capability set missing.                        | Unit must include `CapabilityBoundingSet=` & `AmbientCapabilities=` with `SETUID,SETGID`. |
| Status `217/USER`                            | UID switch failed early.                       | Confirm user & group exist or start as root and drop inside wrapper.                      |
| `No temporary password file found`           | Started with `systemctl` instead of script.    | Always use `sudo /usr/local/bin/partisia-restart.sh` to start the service.               |
| `gpg: decryption failed: Bad passphrase`     | Wrong password entered.                        | Re-run restart script with correct passphrase.                                           |
| Service starts but fails immediately         | Check logs with `journalctl -u partisia -n 20` | Usually GPG decryption or environment variable issues.                                   |

---

## 8 · Security considerations

### Password management
- **Never store the GPG passphrase in files** on the server
- Keep the passphrase in a secure password manager
- The passphrase is required for every service restart
- Consider the passphrase as critical as your private keys

### Service restart requirements
- Service **will not** auto-restart after system reboot
- Manual intervention required to provide passphrase
- This is intentional for enhanced security
- Plan for manual restart procedures in your operational runbooks

### LXC container compatibility
- Solution designed to work in LXC containers
- Uses SSH terminal for password input (no TTY issues)
- Avoids systemd password prompting mechanisms that may fail in containers

---

### File locations

```
/etc/systemd/system/partisia.service      # unit file
/usr/local/bin/partisia-start.sh          # service wrapper
/usr/local/bin/partisia-restart.sh        # interactive restart script
/srv/partisia-staking/                   # deployed code
/etc/partisia-staking/.env.gpg            # encrypted secrets
```

**Note:** No persistent password files exist on the system.

Happy shipping! 🚀
