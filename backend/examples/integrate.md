# Integrating Oqtekal OCR into another product

Oqtekal OCR is a standalone REST API — any existing product (web app, mobile app,
another backend) can use it without this repo's frontend.

## 1. Authenticate

```bash
curl -X POST http://your-oqtekal-host/api/auth/login \
  -d "username=service-account@yourapp.com&password=..." \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])"
```

Create a dedicated service account with the `intake` role for your integration, rather
than reusing a human user's login.

## 2. Submit a scan from your app

```bash
curl -X POST "http://your-oqtekal-host/api/documents/intake?type_id=<your-doc-type-id>" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@scan.pdf"
```

Returns the document record immediately, already OCR'd and routed to review or approval.

## 3. Receive approved data back into your own database

Configure a webhook integration once (as an admin):

```bash
curl -X POST http://your-oqtekal-host/api/integrations/ \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"name": "My App Ingest", "kind": "webhook", "config": {"url": "https://yourapp.com/api/ocr-ingest"}}'
```

Whenever a reviewer/approver pushes an approved record's selected fields, your app's
`ocr-ingest` endpoint receives:

```json
{"tracking_no": "OQ-ABC123", "fields": {"invoice_number": "INV-1001", "total_amount": "5000.00"}}
```

No polling needed — your app just needs one endpoint to accept this payload and write it
into your own database however you see fit.

## 4. Or build your own UI

Since this is a plain JSON API, you can build the intake/review screens directly inside
your existing product's UI instead of using this repo's Next.js frontend — see
`frontend/src/lib/api.ts` for a complete reference client covering every endpoint.
