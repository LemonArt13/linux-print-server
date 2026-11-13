#!/usr/bin/env bash
# Initial host setup. Review, then run: sudo bash bootstrap-ubuntu.sh artem
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo 'Run this initial setup with sudo.' >&2; exit 1; }
DEPLOY_USER=${1:?Specify the existing deployment user}
id "$DEPLOY_USER" >/dev/null
DEPLOY_HOME=$(getent passwd "$DEPLOY_USER" | cut -d: -f6)
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y git nodejs npm curl python3 cups
node -e 'if (Number(process.versions.node.split(".")[0]) < 22) process.exit(1)'
id printflow >/dev/null 2>&1 || useradd --system --home-dir /var/lib/printflow --shell /usr/sbin/nologin printflow
install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" -m 0755 /opt/printflow /opt/printflow/releases
install -d -o printflow -g printflow -m 0700 /var/lib/printflow /var/lib/printflow/data /var/lib/printflow/uploads
if [[ ! -e /etc/printflow.env ]]; then
  install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" -m 0700 "$DEPLOY_HOME/.config/printflow"
  python3 - "$DEPLOY_HOME/.config/printflow/initial-password" <<'PY'
import hashlib,os,secrets,sys
password=secrets.token_urlsafe(24)
salt=secrets.token_hex(16)
digest=hashlib.scrypt(password.encode(),salt=salt.encode(),n=16384,r=8,p=1,dklen=64).hex()
for target,text in [(sys.argv[1],password+'\n'),('/etc/printflow.env','ADMIN_PASSWORD_HASH=scrypt:'+salt+':'+digest+'\nSESSION_TTL_SECONDS=3600\n')]:
    fd=os.open(target,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(fd,'w') as out: out.write(text)
PY
  chown "$DEPLOY_USER:$DEPLOY_USER" "$DEPLOY_HOME/.config/printflow/initial-password"
fi
install -m 0644 "$(dirname "$0")/printflow.service" /etc/systemd/system/printflow.service
printf '%s ALL=(root) NOPASSWD: /usr/bin/systemctl restart printflow.service, /usr/bin/systemctl stop printflow.service\n' "$DEPLOY_USER" > /etc/sudoers.d/printflow-deploy
chmod 0440 /etc/sudoers.d/printflow-deploy
visudo -cf /etc/sudoers.d/printflow-deploy
if command -v ufw >/dev/null && ufw status | head -1 | grep -q 'Status: active'; then
  ufw allow from 10.211.55.0/24 to any port 4000 proto tcp comment 'PrintFlow Parallels LAN'
fi
systemctl daemon-reload
systemctl enable printflow.service
systemctl enable --now cups.service
echo 'Bootstrap complete. Deploy via GitHub next. Secrets were not printed.'
