# POS Hardware Printer Server Setup Checklist

Use this checklist when commissioning a new POS terminal or kitchen display hardware:

- [ ] **1. Physical Connections**:
  - Connect receipt printers via Ethernet LAN cable or USB to POS hardware.
  - Turn printer power ON and verify paper feed.
  - Print printer self-test page (hold feed button while turning on) to confirm IP address (for LAN printers) or driver name.

- [ ] **2. Software Installation**:
  - Copy `printer-server` folder to `C:\FLOW-PrintServer`.
  - Right-click `setup.bat` and select **Run as Administrator**.
  - Choose Option **1** (Install as 24/7 Background Windows Service).

- [ ] **3. Note POS IP Address**:
  - Open browser to `http://localhost:9191/manager`.
  - Note the green/blue Local IP address displayed on the dashboard.

- [ ] **4. Configure in FLOW Web Admin**:
  - Log in to Admin portal.
  - Navigate to **Admin > Settings > Printer Settings**.
  - Paste the POS IP into **Print Server IP** (Port: `9191`).
  - Click **Save**, then click **Test Connection** (verify green confirmation).

- [ ] **5. Verify Station Printers**:
  - In Admin, go to **POS > Printer Management**.
  - Check that all physical printers (Receipt, Kitchen, Bar) have their correct IP addresses or USB printer driver names entered.
  - Click **Test** next to each printer — verify paper cut on the physical hardware.

- [ ] **6. Reboot Test**:
  - Restart the Windows POS terminal.
  - Verify that `http://localhost:9191/manager` comes back online automatically without needing manual login.
