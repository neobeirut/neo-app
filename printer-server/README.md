# FLOW POS Hardware Print Server – Installation & Deployment Guide

This standalone package runs on the POS terminal hardware (or a designated Windows PC in the branch) to route print jobs directly to thermal ESC/POS network and USB receipt printers.

> **Key Feature:** All printer IP addresses, ports, USB drivers, section routing, and receipt financial settings are **managed and updated directly from the FLOW Admin UI**. The print server automatically synchronizes changes in real-time without requiring server restarts or manual file editing on the POS hardware.

---

## 🚀 Quick Setup on New POS Hardware (3 Steps)

### Step 1: Copy Folder to POS Hardware
Copy the entire `printer-server` folder to the new POS machine (recommended location: `C:\FLOW-PrintServer`).

### Step 2: Run Setup
Double-click **`setup.bat`**:
1. Checks for Node.js (automatically installs Node LTS if missing).
2. Installs required dependencies (`npm install`).
3. Asks whether to install as a **24/7 Background Windows Service** (recommended) or run in console.

### Step 3: Enter POS IP in Admin
1. Open the local dashboard on the POS machine: **`http://localhost:9191/manager`**.
2. Note the **POS Terminal Local IP** shown in the dashboard (e.g. `192.168.1.50`).
3. In the FLOW Web Admin:
   - Go to **Admin > Settings > Printer Settings**.
   - Set **Print Server IP** to `192.168.1.50` and **Port** to `9191`.
   - Click **Save Printer Settings**, then click **Test Connection** (turns green with confirmation).

---

## ⚙️ How Admin Settings Control Hardware Printing

All hardware settings can be updated at any time from the Web Admin:

### 1. Adding / Updating Physical Printers (`/pos/printers`)
From the FLOW Admin portal under **POS > Printer Management**:
- **Network Raw Printers (Ethernet / Wi-Fi)**:
  - Select connection type: `network_raw`
  - Set IP address (e.g. `192.168.10.110`) and Port (`9100`).
  - Set Paper Width: `80mm` (standard) or `58mm`.
- **USB Thermal Printers (Connected via USB cable)**:
  - Check the exact Windows printer name in `http://localhost:9191/manager` under **Local Windows Printers** (e.g. `POS-80` or `EPSON TM-T20III`).
  - Select connection type: `windows_driver`.
  - Enter the Windows Printer Name.
- **Roles & Flags**:
  - `is_receipt_printer`: Sets this printer as the default customer bill / tax invoice printer.
  - `is_fallback`: Sets this printer as the automatic failover destination if any station printer runs out of paper or goes offline.

> The print server listens to Supabase Realtime and polls every 15 seconds. Any printer changes in Admin take effect **immediately**.

### 2. Live Exchange Rate & Currency Conversion
- Customer bills print in **USD** and **LBP**.
- The exchange rate used for printing is pulled dynamically from the Admin settings (default 90,000 LBP/USD).
- When the rate is updated in Admin, subsequent receipts automatically calculate with the new rate.

### 3. Kitchen / Bar Section Routing
- Admin maps categories and preparation sections (`Kitchen`, `Bar`, `Pastry`, `Bakery`) to specific printers.
- Combo bundles are automatically exploded into parent combos with indented components on prep tickets.
- Store / packaged retail items marked as `No-Print` are excluded from kitchen chits.

---

## 🛠️ Management & Maintenance Files

| File | Description |
| :--- | :--- |
| **`setup.bat`** | Complete one-click installer for new POS hardware. |
| **`start-server.bat`** | Runs print server in foreground with live colored console logging. |
| **`stop-server.bat`** | Stops any instances running on port 9191. |
| **`install-service.bat`** | Registers the print server as an automated Windows background service (starts on boot). |
| **`uninstall-service.bat`** | Cleanly removes the background Windows service. |
| **`test-printer.bat`** | Diagnostic script that probes server health and prints a test chit. |
| **`config.json`** | Local overrides (branch ID, machine ID, port). |

---

## 🌐 Local Web Dashboard (`/manager`)

Open **`http://localhost:9191/manager`** on the POS machine or from any device on the same local network:
- 🟢 Live status badge and service uptime.
- 📍 Local IP address detector.
- 📋 Live table of all printers synced from the Admin.
- 🖥️ Table of detected local Windows spooler / USB printers.
- ⚡ One-click **"Print Test Chit"** button for immediate hardware verification.
- 📜 Deduplication journal showing the last executed print jobs.

---

## 🔍 Troubleshooting & Verification

1. **Test Connection in Admin Fails**:
   - Verify the POS terminal and Admin device are on the same local network or Wi-Fi.
   - Run Windows Defender Firewall check: Allow inbound TCP port `9191`.
     ```powershell
     New-NetFirewallRule -DisplayName "FLOW Print Server" -Direction Inbound -LocalPort 9191 -Protocol TCP -Action Allow
     ```
2. **Cloud Queue Dispatch**:
   - The print server polls outbound to Supabase, meaning it receives online orders and mobile waiter orders without needing public port forwarding on the restaurant router.
3. **Double Printing Prevention**:
   - The server maintains a persistent idempotency journal in `./data/print_jobs_journal.json`. If a network glitch causes the POS app to retry, duplicate tickets are safely ignored.
