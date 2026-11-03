# Frozen user-supplied v20 sources

These files are byte-for-byte copies received on 3 November 2026. Names in this directory are portable aliases; original names, sizes, SHA256 hashes, rule version, and execution cell indices are in `manifest.json`.

Use `npm run test:neonatal:v20:reference` to verify the sources and unchanged dosing. Use `npm run test:neonatal:v20` to run the active batch acceptance gate, which currently exposes the outstanding migration work. Do not regenerate expected results from TypeScript to make the gate pass.

Setup, coverage, remaining work, and the role of historical v18/v19 checks are documented in [the v20 reference guide](../../../../docs/neonatal-notebook-v20-reference.md).
