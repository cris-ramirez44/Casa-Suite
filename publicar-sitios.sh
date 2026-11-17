#!/usr/bin/env bash
# Publica los sitios estáticos (Test de Dones y ¡Sumate!) en la VPS de Hostinger, donde los sirve el servicio `sitios`
# de Casa Suite (deploy/vps/docker-compose.yml del repositorio CasaSuite):
#   test-dones → https://dones.somoscasasuite.app
#   sumate     → https://sumate.somoscasasuite.app
# Uso desde la PC: bash publicar-sitios.sh            (los dos)
#                  bash publicar-sitios.sh sumate     (uno)
# Sube solo lo versionado en Git (nada local ni secreto).
set -euo pipefail
VPS="${CASASUITE_VPS:-root@179.236.64.149}"
KEY="${CASASUITE_VPS_KEY:-$HOME/.ssh/casasuite_vps}"
SSH=(ssh -i "$KEY" -o IdentitiesOnly=yes -o BatchMode=yes "$VPS")
cd "$(git rev-parse --show-toplevel)"
[ $# -eq 0 ] && set -- test-dones sumate
for sitio in "$@"; do
  case "$sitio" in test-dones|sumate) ;; *) echo "Sitio desconocido: $sitio" >&2; exit 2 ;; esac
  echo "Publicando $sitio ($(git rev-parse --short HEAD))"
  git archive --format=tar HEAD "$sitio" | "${SSH[@]}" "set -e; mkdir -p /opt/casasuite/sitios/.nuevo; cd /opt/casasuite/sitios/.nuevo; tar -x; chmod -R a+rX $sitio; cd ..; [ -d $sitio ] && mv $sitio .anterior-$sitio; mv .nuevo/$sitio $sitio; rmdir .nuevo; rm -rf -- .anterior-$sitio"
done
"${SSH[@]}" "cd /opt/casasuite && docker compose up -d sitios >/dev/null 2>&1"
for h in dones sumate; do echo "https://$h.somoscasasuite.app → $(curl -s -o /dev/null -w '%{http_code}' "https://$h.somoscasasuite.app/" || true)"; done
