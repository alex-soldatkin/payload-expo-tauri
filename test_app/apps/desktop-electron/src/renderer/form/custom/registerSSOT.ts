// Side-effect module: registers the SSOT config's custom admin components.
//
// Since issue #28 phase 3 these are CODEGEN PASSTHROUGHS — the original web
// admin component sources copied verbatim into ./gen by `pnpm codegen:dom`
// (which walks apps/server's payload config for field-level
// admin.components) and registered against the ui-dom shim. Re-run the
// codegen after changing admin.components in the server config; do not edit
// ./gen by hand.
import './gen/register.gen'
