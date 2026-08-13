# Walkthrough - Flow Product Website

We have successfully rebuilt the **Features** directory page, aligned dropdown links, corrected routing anchors, integrated your brand logo, updated homepage screenshots, optimized spacing, adjusted Why Flow cost calculations, and updated the contact email references.

---

## What's New

### 1. Updated Contact Emails (`app.js`)
- **General Inquiry**: Replaced the general inquiries email address with **`hello@flow-ops.app`**.
- **Support Center**: Updated the support contact email to **`support@flow-ops.app`** for brand domain alignment.
- **Mailto Wrapper**: Wrapped both email addresses in standard HTML `mailto:` link anchors so that clicking them directly opens the user's default email client, keeping color and styling inherited cleanly.

### 2. Extended Branches Limit to 10 (`app.js`)
- **Slider Limit Extension**: Increased the maximum range limit of the **Number of Branches** slider from `5` to `10` branches.

### 3. Updated Why Flow Cost Estimator (`app.js`)
- **Flat Setup Duration**: Fixed the setup duration to **1 Week** (removing the scaling based on branch count).
- **Flat Setup Fee**: Set a flat implementation setup fee of **$600** (independent of the number of branches).
- **Branch-Dependent Training**: Tied training cost to branch size (**2 days of training and $200 per branch**). The total implementation cost dynamically calculates as `$600 + ($200 * branches)`.
- **Monthly SaaS Subscription**: Added a dedicated Monthly Subscription cost metric calculated as **$50 per branch per month**.

### 4. Updated Homepage Mockups & Buttons (`app.js`)
- **Removed "Book a Presentation"**: Removed the secondary button from the Hero section, leaving a single primary call-to-action button: **"Request a Demo"**.
- **Hero Dashboard Mockup**: Replaced the CSS/HTML simulation cards directly beneath the "Request a Demo" button with a browser mockup frame containing the high-resolution dashboard screenshot of the real Flow application (`dashboard-screenshot.png`).

---

## Verification & Testing

### 1. Syntax Validation
- Ran syntax validation using:
  ```bash
  node -c app.js modules.js
  ```
  Result: **Passed with zero compiler or syntax errors**.

### 2. Local Server
- The local development server remains active at: **[http://localhost:8080](http://localhost:8080)**.
- Navigating the dropdowns, selecting categories, or typing in the search box correctly filters sections and modules instantly without routing issues.

---

## Review Checklist
1. Visit **[http://localhost:8080/#/contact](http://localhost:8080/#/contact)**.
2. Verify the email addresses are displayed as **`hello@flow-ops.app`** and **`support@flow-ops.app`**.
3. Click the links to test that they open your default mail client.
4. Let me know if you would like to run any further adjustments!
