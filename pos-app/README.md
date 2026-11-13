# FLOW POS App (Standalone Independent Project)

Fully standalone, independent Point of Sale (POS) application built for **FLOW Restaurant Suite**.

## Architecture & Complete Independence
This project is **100% decoupled and independent** from:
- **Ovrload POS** and Ovrload backend Railway infrastructure (no calls to ovrload-backend-production.up.railway.app).
- **flowonline.com / flowonline.com/admin** (neo-web-admin). Any changes, commits, or deployments in this repository do NOT touch or trigger deployments on flowonline.com.
- **Old databases**: Completely separated from old Ovrload databases (`nigtjaiwnmjdnmjtdlof`, `ibtbcgkkixkglnhhrrpu`).

### Database
- Hosted on Supabase under **Ops flow POS** project (`ilrlychrraagugntqdfr`).
- Direct HTTPS REST / Realtime connections via `@supabase/supabase-js`.
- All operational data (orders, order items, shift cash sessions, floor plans, tables, screen builders, categories, products, discounts) are strictly isolated in this database.

## Features
- **Touch PIN Screen**: Fast cashier sign-in with 4-digit PIN (Default Cashier PIN: `1234`).
- **Shift Drawer Control**: Open/close shift float, track USD/LBP cash, and print audit reports.
- **POS Register & Cart**: Fast item selection, sub-screen navigation, modifiers, discounts, and real-time dual-currency totals ($ / LBP).
- **Dual-Currency Payment Checkout**: Settle in Cash USD, Cash LBP, Card, or Whish Money with automatic change calculations.
- **Floor Plans & Table Management**: Visual table layout, active table sessions, multi-order merge and split.
- **Orders Hub**: Live incoming orders, order history, reprint receipts, and manager voids.
- **POS Screen Builder (`#/pos-screens`)**: Custom touch screen layout builder for categories and product tiles.
- **POS System Settings (`#/pos-settings`)**: Hardware printer LAN IP configuration, store open/close switch, and discount rules.
- **Kitchen Display System (`#/kds`)**: Live order preparation and expo bump station.

## Getting Started

### Development
```bash
npm run dev
```

### Production Build & Preview
```bash
npm run build
npx vite preview --port 4173
```
