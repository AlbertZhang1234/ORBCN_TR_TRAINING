# SAP OData client

This directory contains the protocol-level SAP OData client. It is server-side
infrastructure and must not be imported by browser components.

## Design

- `client.ts` contains one reusable OData client implementation.
- `auth.ts` contains authentication providers.
- `types.ts` contains service definitions and injected dependencies.
- `errors.ts` converts SAP failures to the project's `ServiceError` model.
- `services/_server/sapODataDependencies.ts` assembles dependencies from server
  environment variables without creating a module-level singleton.

Business modules should define their own service root and entity set, then use
the same client. A business module may map SAP DTOs to application DTOs when the
business operation needs validation or multiple SAP requests.

The shared client supports OData V2 response wrappers (`d`, `results` and
`__next`) and OData V4 response wrappers (`value`, `@odata.nextLink` and
`@odata.count`). It returns the next link to the caller instead of silently
loading every page.

## Environment variables

```text
SAP_ODATA_BASE_URL=https://sap.example.com
SAP_ODATA_AUTH_MODE=none|basic|bearer
SAP_ODATA_USERNAME=...
SAP_ODATA_PASSWORD=...
SAP_ODATA_BEARER_TOKEN=...
SAP_ODATA_TIMEOUT_MS=15000
SAP_ODATA_PROXY_URL=http://proxy-host:proxy-port
```

Only the variables required by the selected auth mode are used. Do not prefix
these variables with `NEXT_PUBLIC_`.

The SAP server request uses `SAP_ODATA_PROXY_URL` when configured. When it is
absent, `HTTPS_PROXY`/`HTTP_PROXY` are checked, followed by the enabled proxy
from Windows Internet Settings. Set `SAP_ODATA_PROXY_URL=none` to force a
direct connection. VPN connections are handled by the operating system's
network routes and are not configured in application code.

For write requests, the client automatically sends a GET to the service root
with `X-CSRF-Token: Fetch`, stores the returned token and cookies, and sends
both on the subsequent POST/PATCH/DELETE request. The session is scoped to the
client instance and is not shared between users or server requests. OAuth2
token acquisition and write-specific business behavior remain outside this
client. JSON writes use `Content-Type: application/json`,
`Accept: application/json`, `Cache-Control: no-cache`, and the OData V2/V4
`DataServiceVersion` headers. Host, content length, user agent, and connection
headers are left to Node's HTTP implementation.

Server-created SAP requests are logged as JSONL under `log/sap-odata/` by
default, one file per day. Logs include request/response headers, bodies,
status and duration. Authorization, Cookie, Set-Cookie and CSRF token values
are redacted. Set `SAP_ODATA_LOG_DIR` to override the directory.

## Metadata connectivity test

Run the live metadata smoke test with:

```bash
npm run test:sap-metadata
```

The test requests the registered `super_miro` service metadata and requires the
SAP variables in `Frontend/.env.local`. If the host is only reachable through a
proxy, Node must be started with proxy support, for example in PowerShell:

```powershell
$env:HTTPS_PROXY = 'http://proxy-host:proxy-port'
$env:NODE_OPTIONS = '--use-env-proxy'
npm run test:sap-metadata
```
