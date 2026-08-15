# Project Architecture & Railway Services Mapping

This repository (`neobeirut/neo-app`) contains three distinct deployed Railway services:

1. **Ovrload Admin / POS Backend** (`ovrload-backend`):
   - Railway service: `ovrload-backend`
   - Root directory: `/ovrload-web`
   - Live URL: `https://ovrload-backend-production.up.railway.app`
   - Target codebase: `ovrload-web/**`

2. **Neo Admin / POS Backend** (`gregarious-curiosity`):
   - Railway service: `gregarious-curiosity`
   - Root directory: `/web`
   - Target codebase: `web/**`

3. **Neo Customer Website** (`neo_website`):
   - Railway service: `neo_website`
   - Root directory: `/` (repository root)
   - Target codebase: `./src` & root level frontend files

## Strict Mapping Directives:
- **Ovrload Requests**: Modify `ovrload-web/` (and `scratch/ovrload` for customer/driver web app on Vercel).
- **Neo Admin/POS Requests**: Modify `web/`.
- **Neo Customer Website Requests**: Modify root files (`./src`, `index.html`, `package.json`).
