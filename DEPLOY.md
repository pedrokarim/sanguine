# Déploiement

Le jeu est **entièrement statique** : pas de backend, pas de base de données, aucune variable
d'environnement à l'exécution. Le conteneur ne contient que nginx et ~170 ko de fichiers.

## Architecture en production

```
Navigateur
    │  HTTPS
    ▼
Cloudflare  ......................  certificat TLS, cache, protection
    │  HTTP (port 80)
    ▼
nginx système (hôte)  ............  vhost sanguine.ascencia.re → reverse proxy
    │  HTTP (127.0.0.1:4020)
    ▼
Conteneur Docker « sanguine »  ...  nginx:alpine + dist/
```

### Pourquoi pas de certbot

Le TLS est assuré **par Cloudflare**, comme pour tous les autres sous-domaines de la machine :
aucun d'eux n'écoute en 443, et le serveur ne publie que le port 80. Ajouter un certificat
Let's Encrypt ici demanderait d'ouvrir 443, de basculer la zone Cloudflare en *Full (strict)*
et de gérer un renouvellement — pour un bénéfice nul, puisque le lien Cloudflare → origine ne
sort pas du datacenter d'OVH.

Si la zone passait un jour en *Full (strict)*, la bonne réponse serait un **certificat d'origine
Cloudflare** (valable 15 ans, aucun renouvellement) plutôt que certbot.

### Pourquoi le port est publié sur `127.0.0.1`

`ports: "127.0.0.1:4020:80"` et non `"4020:80"`. Sans l'adresse explicite, Docker publie sur
`0.0.0.0`, **insère sa propre règle iptables en amont d'UFW**, et le conteneur devient joignable
en clair depuis Internet — en contournant à la fois le reverse proxy et Cloudflare. C'est un
piège classique et silencieux.

---

## Première installation

```bash
ssh ascencia-prod
git clone https://github.com/pedrokarim/sanguine.git ~/sanguine
cd ~/sanguine
docker compose up -d --build
curl -sf http://127.0.0.1:4020/healthz   # doit répondre « ok »
```

### Vhost nginx

`/etc/nginx/sites-available/sanguine.ascencia.re` :

```nginx
server {
    listen 80;
    server_name sanguine.ascencia.re;

    location / {
        access_log /var/log/nginx/sanguine.ascencia.re.access.log;
        error_log  /var/log/nginx/sanguine.ascencia.re.error.log;

        proxy_pass http://127.0.0.1:4020;
        proxy_http_version 1.1;

        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location ~ /.well-known { allow all; }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/sanguine.ascencia.re /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

`nginx -t` avant tout rechargement : une erreur de syntaxe dans un seul vhost fait échouer le
rechargement de **tous** les sites de la machine.

---

## Mettre à jour

```bash
cd ~/sanguine
git pull
docker compose up -d --build
```

Le build tourne dans le conteneur : rien à installer sur l'hôte, et la version déployée est
exactement celle du dépôt.

Les anciennes images s'accumulent au fil des redéploiements :

```bash
docker image prune -f
```

## Diagnostic

```bash
docker compose ps                    # état et santé du conteneur
docker compose logs -f --tail=50     # journaux nginx du conteneur
curl -sf http://127.0.0.1:4020/healthz
sudo tail -f /var/log/nginx/sanguine.ascencia.re.error.log
```

| Symptôme | Cause probable |
|---|---|
| 502 Bad Gateway | Conteneur arrêté, ou port ≠ 4020 |
| Ancienne version affichée | Cache Cloudflare — purger, ou vérifier le `no-cache` sur `index.html` |
| Boucle de redirection | Mode SSL Cloudflare en *Full* alors que l'origine est en HTTP simple |
| Le build échoue | Lockfile désynchronisé : `pnpm install` en local puis commiter `pnpm-lock.yaml` |

## Revenir en arrière

```bash
cd ~/sanguine
git log --oneline -10
git checkout <commit>
docker compose up -d --build
```

## Retirer complètement

```bash
cd ~/sanguine && docker compose down
sudo rm /etc/nginx/sites-enabled/sanguine.ascencia.re
sudo nginx -t && sudo systemctl reload nginx
```
