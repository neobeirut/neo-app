# Workspace Rule: Dual-Folder Admin Synchronization

This repository (`neobeirut/neo-app`) has two Railway services configured:
1. **`gregarious-curiosity`** — Root directory: `/web`
2. **`ovrload-backend`** (`https://ovrload-backend-production.up.railway.app`) — Root directory: `/ovrload-web`

## Directive:
Whenever creating, updating, or debugging any Admin, POS, or API features:
- **ALWAYS** apply the changes to both `web/` AND `ovrload-web/`.
- Ensure all component files (`BranchForm.jsx`, `BranchesTable.jsx`, `OrdersView.jsx`, etc.) and API routes (`/api/branches`, `/api/orders`, etc.) in `web/` and `ovrload-web/` remain **100% identical**.
- Never update `web/` without immediately mirroring the exact same changes to `ovrload-web/` before committing.
