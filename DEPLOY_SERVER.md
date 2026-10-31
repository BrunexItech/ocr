# Deploying Oqtekal OCR to the production VPS (ocr.oqtekal.com)

Same shared-VPS + Cloudflare + host-nginx pattern as tolkyn.co.ke / erp.oqtekal.com /
sports.oqtekal.com.

## 1. Pull the code onto the server

```bash
cd /opt   # or wherever the other sites live on this VPS
git clone https://github.com/BrunexItech/ocr.git
cd ocr
cp .env.example .env
nano .env   # set JWT_SECRET to a long random string
            # set NEXT_PUBLIC_API_URL=https://ocr.oqtekal.com/api
```

## 2. Pick free ports (match the pattern used for erp/sports/tolkyn)

Edit `docker-compose.yml`'s `ports:` to bind to specific local ports instead of the
defaults, the same way tolkyn binds to `127.0.0.1:8090`. Example — pick ports not
already in use on this VPS:

```yaml
services:
  backend:
    ports:
      - "127.0.0.1:8101:8000"
  frontend:
    ports:
      - "127.0.0.1:8102:3000"
```

Check what's already taken first: `ss -tlnp | grep 127.0.0.1`

## 3. Build and start

```bash
docker compose up -d --build
docker compose logs -f   # watch startup, Ctrl-C once both report ready
```

First backend request will download EasyOCR's model weights once (~100MB) — this
happens on first document intake, not at container start.

## 4. Seed starter document types (optional but recommended)

```bash
docker compose exec backend python -m scripts.seed_templates
```

## 5. Host nginx vhost for ocr.oqtekal.com

Add a new server block alongside the existing ones for erp/sports (same pattern as
`tolkyn.co.ke`'s nginx config — proxy to the frontend container, with the API routed
separately):

```nginx
server {
    listen 80;
    server_name ocr.oqtekal.com;

    location /api/ {
        proxy_pass http://127.0.0.1:8101/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:8102;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

If this VPS terminates TLS at Cloudflare (Full/strict, like tolkyn.co.ke) and nginx
only needs to listen on plain HTTP behind that, the block above is enough — no
certbot/Let's Encrypt needed on this vhost since Cloudflare handles the public
HTTPS and talks to origin nginx over its own origin cert/Full-strict mode, same as
the existing sites.

## 6. Cloudflare DNS

In the `oqtekal.com` zone, add:

| Type | Name | Content              | Proxy status |
|------|------|-----------------------|--------------|
| A    | ocr  | `<VPS public IP>`    | Proxied (orange cloud) |

Same pattern as the existing `erp` and `sports` records — copy one of those and swap
the name.

## 7. Verify

```bash
curl -s https://ocr.oqtekal.com/api/health
# {"status":"ok"}
```

Open `https://ocr.oqtekal.com` in a browser, register the first account (becomes
admin automatically), then create `intake`/`reviewer`/`approver` users under
Admin → Users.

## Updating later

```bash
cd /opt/ocr
git pull
docker compose up -d --build
```

Database, uploaded files, and the OCR model cache persist in Docker volumes across
this — nothing is lost on redeploy.
