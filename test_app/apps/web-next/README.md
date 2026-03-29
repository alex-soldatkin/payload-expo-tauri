# Next Admin Schema Preview

This Next app proxies `/api/admin-schema` to the Payload server and renders a schema preview.

## Setup
- Set `PAYLOAD_BASE_URL` to the running Payload server URL (default: http://localhost:3000).
- Run `pnpm dev` in this folder.

## Auth
- If you are signed into the Payload admin in the same browser, cookies are forwarded via the proxy.
- You can also paste a JWT token into the UI to send an Authorization header.
