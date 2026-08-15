# Project Architecture & Routing Rules

This repository (`neobeirut/neo-app`) contains two distinct projects:

1. **Ovrload Admin / POS** (`ovrload-backend`):
   - Railway service: `ovrload-backend`
   - Root directory: `/ovrload-web`
   - Live URL: `https://ovrload-backend-production.up.railway.app`
   - Target files: `ovrload-web/**`

2. **Neo Admin / Web** (`gregarious-curiosity`):
   - Railway service: `gregarious-curiosity`
   - Root directory: `/web`
   - Target files: `web/**`

## Directive:
- For all Ovrload requests, modify and deploy code directly in `ovrload-web/`.
- For all Neo requests, modify and deploy code in `web/`.
- Do not confuse the two project directories.
