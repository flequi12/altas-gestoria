# Despliegue — gestoria.safetycapital.es

App de altas/contratos publicada **bajo `safetycapital.es`** (dominio de Carlos; DNS en
Comvive). Subdominio: **`gestoria.safetycapital.es`**. Patrón = el de Patrimonio/B3.

> Eventualmente migrará a un subdominio de `auditoriapublica.es` (cuando haya acceso).

## Arquitectura

```
Internet ──HTTPS──► nginx público (CT 100)                 CT nuevo (altas-gestoria)
                    · TLS (Let's Encrypt)        ──LAN──►   · Docker: node :3010
                    · Basic Auth (htpasswd)                 · sin login propio (interino)
                    · reverse-proxy por Host
                    · fail2ban (auth fallida)
```
- **Auth interina**: HTTP Basic Auth en el nginx público + fail2ban. El **2FA propio**
  (login + TOTP, patrón Patrimonio) se añadirá después y sustituirá al Basic Auth.
- El `:3010` del CT **solo es accesible por LAN** (lo consume el nginx de CT 100); no se
  publica a internet directamente.

## Prerrequisitos (Carlos)
1. **DNS** (Comvive): registro **A `gestoria` → misma IP pública que `gestion.safetycapital.es`**.
2. **Credenciales Basic Auth**: usuario + contraseña (para el `htpasswd`).
3. **`.env`** en el CT con `ANTHROPIC_API_KEY` (y `PORT=3010`).

## Pasos (Claude, por SSH a Proxmox 192.168.5.50)

1. **Crear CT** (LXC Debian, nesting=1 para Docker) y **aplicar el gotcha de red** (reglas
   `FORWARD ACCEPT` + MASQUERADE + exención DNAT :80, ver CLAUDE.md / NETWORK_NOTES).
2. **Instalar Docker** en el CT; copiar el repo (`tar` → `pct push` → extraer) + crear `.env`.
3. `cd /opt/altas-gestoria && docker compose up -d --build` → app en `:3010`.
4. **nginx (CT 100)** — añadir vhost para `gestoria.safetycapital.es`:
   ```nginx
   server {
     listen 443 ssl;
     server_name gestoria.safetycapital.es;
     ssl_certificate     /etc/letsencrypt/live/gestoria.safetycapital.es/fullchain.pem;
     ssl_certificate_key /etc/letsencrypt/live/gestoria.safetycapital.es/privkey.pem;
     # cabeceras de seguridad (HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy)
     auth_basic           "Altas Gestoria";
     auth_basic_user_file /etc/nginx/.htpasswd-gestoria;
     location / {
       proxy_pass http://<IP-CT-altas>:3010;
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $scheme;
     }
   }
   # (server :80 → return 301 https; OJO: el ISP bloquea :80 entrante desde fuera)
   ```
5. **Basic Auth**: `htpasswd -c /etc/nginx/.htpasswd-gestoria <usuario>` (pide la contraseña).
6. **Let's Encrypt** — **DNS-01 manual** (el ISP bloquea el :80, igual que `gestion`):
   `certbot certonly --manual --preferred-challenges dns -d gestoria.safetycapital.es`
   (añadir el TXT `_acme-challenge.gestoria` en Comvive). Renovación manual (anotar caducidad).
7. **fail2ban**: jail para `nginx-http-auth` sobre el log de este vhost (banea Basic Auth
   fallida); `ignoreip` con la IP fija de Carlos.
8. `nginx -t && systemctl reload nginx`. Verificar: `https://gestoria.safetycapital.es` pide
   Basic Auth y, tras autenticar, sirve la app.

## Pendiente / futuro
- Sustituir Basic Auth por **login + 2FA propios** (patrón Patrimonio).
- Backup del CT en los jobs vzdump diarios.
- Migración futura a subdominio de `auditoriapublica.es`.
