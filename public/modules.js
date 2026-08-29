const modulesData = {
  dashboardBi: {
    title: "Dashboard & Business Intelligence",
    subtitle: "Make Better Decisions with Real-Time Visibility",
    description: "Gain an instant overview of your entire operation from a centralized dashboard. Monitor multi-unit sales, live labor cost percentages, inventory alerts, and cross-branch operational health in real time.",
    icon: "trending-up",
    keyCapabilities: [
      "Real-time cross-branch KPI command center",
      "Live labor cost vs. revenue overlay",
      "Multi-branch comparative analytics",
      "Instant 86'd out-of-stock item alerts",
      "Cash reconciliation & variance status",
      "Digital checklist completion tracking",
      "Live reservation & table turnover stats",
      "Procurement & pending PO approvals",
      "Waste cost leaks & loss prevention",
      "Customer complaint resolution tracker",
      "Security audit & active user sessions"
    ],
    businessBenefits: [
      "Faster, data-backed operational decisions",
      "Complete multi-unit operational transparency",
      "Immediate detection of labor & food cost leaks",
      "Reduced management overhead across branches"
    ],
    modules: [
      {
        id: "dashboard",
        name: "Dashboard",
        subtitle: "Real-Time Multi-Unit Command Center",
        description: "The Flow Dashboard gives owners, area managers, and store supervisors a unified live view across all locations. Track labor cost ratios, open shifts, pending purchase approvals, and store alerts from one centralized screen.",
        keyFeatures: [
          "Real-time multi-branch KPI command bar",
          "Live labor cost % calculated against gross revenue",
          "Active shifts & on-duty workforce counters",
          "Instant alerts for missed checklists or late clock-ins",
          "Daily cash drawer reconciliation summaries",
          "Real-time out-of-stock (86) item counter",
          "Pending supplier order approval queue",
          "Cross-branch performance comparison tables"
        ],
        benefits: [
          "Instant visibility without calling store managers",
          "Proactive intervention before profit leaks grow",
          "Clear benchmarking across branch locations",
          "Single login for multi-brand and multi-branch groups"
        ],
        related: ["financial-analytics", "reports", "daily-checklists", "attendance-timeclock"],
        mockupType: "dashboard"
      },
      {
        id: "financial-analytics",
        name: "Financial Analytics",
        subtitle: "Daily Operational P&L and Cost Control",
        description: "Monitor daily financial health beyond the POS. Reconcile cash drawers, track supplier spending against budgets, monitor voids and comps, and compare branch gross profitability.",
        keyFeatures: [
          "Daily cash drawer & safe drop reconciliation",
          "Petty cash and staff wallet expense logs",
          "POS void & refund audit trails",
          "Branch-by-by-branch financial performance comparison",
          "COGS and labor cost trend analytics",
          "Historical revenue vs operational expense tracking"
        ],
        benefits: [
          "Eliminates end-of-month cash reconciliation surprises",
          "Zeroes out unaccounted cash shrinkage",
          "Provides granular financial clarity per shift",
          "Enables data-driven budget allocations"
        ],
        related: ["dashboard", "reports", "shift-reports", "void-receipts"],
        mockupType: "financial"
      },
      {
        id: "reports",
        name: "Reports",
        subtitle: "Automated Operational & Investor Reports",
        description: "Generate and schedule comprehensive operational summaries for store managers, partners, and investors. Export data to PDF, Excel, or schedule automated morning email digests.",
        keyFeatures: [
          "Automated scheduled morning & EOD email briefs",
          "Custom multi-metric report builder",
          "Multi-branch comparative matrix exports",
          "Payroll hours & tip distribution exports",
          "Inventory consumption & waste audit logs",
          "Direct PDF and spreadsheet data downloads"
        ],
        benefits: [
          "Saves days of compiling spreadsheets each month",
          "Ensures stakeholders receive consistent updates",
          "Standardizes KPIs across restaurant portfolios",
          "Audit-ready digital logs for accounting"
        ],
        related: ["dashboard", "financial-analytics", "void-receipts"],
        mockupType: "reports"
      }
    ]
  },
  operations: {
    title: "Operations Management",
    subtitle: "Standardize Kitchen & Floor Execution Across Every Branch",
    description: "Ensure every location follows identical operational standards. Digital SOPs, photo-verified checklists, recipe costing, and real-time 86 boards eliminate paper clutter and enforce brand consistency.",
    icon: "layers",
    keyCapabilities: [
      "Photo-verified opening & closing checklists",
      "Digital recipe costing & kitchen manuals",
      "Real-time kitchen 86'd out-of-stock board",
      "Daily shift logs & manager handover notes",
      "Task assignment & recurring equipment maintenance",
      "Standard Operating Procedures (SOPs) & training hub",
      "Internal news broadcasts & policy acknowledgment"
    ],
    businessBenefits: [
      "Identical food & service quality across all units",
      "100% staff accountability with photo proof",
      "Reduced kitchen prep mistakes and waste",
      "Faster, seamless line-cook onboarding",
      "Zero lost communication between shift handovers"
    ],
    modules: [
      {
        id: "daily-checklists",
        name: "Daily Checklists",
        subtitle: "Digital Opening, Closing & HACCP Audits",
        description: "Replace paper clipboards with digital checklists. Enforce temperature logs, prep line setups, hygiene audits, and closing procedures with mandatory photo verification and supervisor sign-offs.",
        keyFeatures: [
          "Scheduled opening, mid-day, and closing checklists",
          "Hygiene, food safety, and HACCP compliance forms",
          "Mandatory photo uploads for proof of task completion",
          "Real-time completion progress meters per branch",
          "Automated supervisor push alerts for missed items",
          "Digital manager review and sign-off locks"
        ],
        benefits: [
          "Enforces rigorous hygiene and brand standards",
          "Eliminates fabricated paper checklist sign-offs",
          "Protects against equipment failure with temp logs",
          "Simplifies health inspector audits"
        ],
        related: ["dashboard", "task-manager", "sops-training", "shift-reports"],
        mockupType: "checklists"
      },
      {
        id: "recipe-costing-manual",
        name: "Recipe Costing & Kitchen Manual",
        subtitle: "Standardized Kitchen SOPs & Margin Control",
        description: "Digitize recipe cards, sub-recipes, ingredient yields, portion costs, and plating photo guides. Empower line cooks to prepare consistent dishes while protecting profit margins against ingredient inflation.",
        keyFeatures: [
          "Portion-level ingredient costing & gross margin calculation",
          "Sub-recipe batch nesting with prep yields",
          "Plating photo guides & step-by-step assembly instructions",
          "Dynamic allergen tagging & allergen matrix generator",
          "Prep time estimations and chef special notes",
          "Live recipe cost recalculation when ingredient prices change"
        ],
        benefits: [
          "Locks in exact food cost consistency across all branches",
          "Cuts line-cook training time in half",
          "Eliminates allergen miscommunication risks",
          "Ensures dishes match culinary brand presentation"
        ],
        related: ["sops-training", "item-catalog", "supplier-price-intelligence", "kitchen-86-board"],
        mockupType: "recipeManual"
      },
      {
        id: "kitchen-86-board",
        name: "Kitchen 86'd Board",
        subtitle: "Instant Out-of-Stock Synchronization",
        description: "1-tap marking of unavailable menu items directly from the kitchen line tablet. Instantly notifies floor servers and managers with reason logging, preventing embarrassing service void incidents.",
        keyFeatures: [
          "1-tap 86 item toggling from kitchen tablets",
          "Root-cause logging (shortage, prep error, supplier delay)",
          "Instant broadcast alerts to waitstaff and host stand",
          "Estimated back-in-stock time tracking",
          "Historical 86 frequency analytics per dish",
          "POS and digital menu integration readiness"
        ],
        benefits: [
          "Prevents taking customer orders for unavailable dishes",
          "Eliminates hostile kitchen-to-floor shouting and confusion",
          "Identifies recurring ingredient supply bottlenecks",
          "Protects customer satisfaction scores"
        ],
        related: ["recipe-costing-manual", "inventory-availability", "client-orders", "dashboard"],
        mockupType: "menu86"
      },
      {
        id: "shift-reports",
        name: "Daily Shift Reports",
        subtitle: "End-of-Shift Logs and Manager Handover",
        description: "Maintain clear communication between morning and night shifts. Document customer footfall highlights, maintenance issues, cash reconciliations, and staff notes without chaotic chat groups.",
        keyFeatures: [
          "Structured digital end-of-shift handover forms",
          "Cash drawer counts, safe drops, and petty cash logs",
          "Equipment maintenance & incident reporting tickets",
          "Guest feedback & VIP table visit highlights",
          "Next-shift priority notes and checklist confirmations",
          "Historical search of past store shift logs"
        ],
        benefits: [
          "Zero lost operational information between shifts",
          "Transparent cash handling and reconciliation",
          "Faster maintenance repairs before peak rushes",
          "Centralized store history accessible to owners"
        ],
        related: ["daily-checklists", "dashboard", "void-receipts", "client-complaints"],
        mockupType: "shiftReports"
      },
      {
        id: "task-manager",
        name: "Task Manager",
        subtitle: "Assign and Track Operational Tasks",
        description: "Create, assign, and track one-off or recurring maintenance tasks across all branches. From deep cleans to grease trap servicing, Flow ensures critical upkeep never gets forgotten.",
        keyFeatures: [
          "Recurring preventive maintenance schedules",
          "Role-based task assignment with priority tags",
          "Due date alerts and push notifications",
          "Task comments, photo attachments, and sign-offs",
          "Overdue task escalation to branch managers",
          "Completion rate benchmarking across teams"
        ],
        benefits: [
          "Clear ownership and operational accountability",
          "Extended equipment lifespan with regular maintenance",
          "Streamlined manager task follow-ups",
          "Comprehensive maintenance history logs"
        ],
        related: ["daily-checklists", "sops-training", "waste-management"],
        mockupType: "tasks"
      },
      {
        id: "sops-training",
        name: "SOPs & Training",
        subtitle: "Centralized Digital Knowledge Base",
        description: "House service guides, hygiene protocols, employee handbooks, and operational manuals in a searchable digital hub, accessible to staff directly on mobile devices.",
        keyFeatures: [
          "Categorized document and video training guides",
          "Service etiquette, bar SOPs, and barista manuals",
          "Searchable digital employee handbook",
          "Staff reading verification & comprehension checks",
          "Offline mobile access for kitchen tablets",
          "Version control for updated operational policies"
        ],
        benefits: [
          "Consistent guest service across every shift",
          "Drastically reduced onboarding time for new hires",
          "Instant access to standard operating protocols",
          "Reduced mistakes and compliance violations"
        ],
        related: ["recipe-costing-manual", "internal-news", "employees"],
        mockupType: "sops"
      },
      {
        id: "internal-news",
        name: "Internal News",
        subtitle: "Staff Broadcasts & Policy Updates",
        description: "Broadcast company announcements, seasonal menu launches, and policy updates. Flow ensures every team member reads critical updates without relying on messy WhatsApp groups.",
        keyFeatures: [
          "Rich text announcements with photo attachments",
          "Targeted broadcasting by branch or department",
          "Mandatory read receipts & acknowledgment tracking",
          "Staff reactions, comments, and shoutouts",
          "Urgent bulletin banners pinned to staff home screens",
          "Mobile push notification broadcasts"
        ],
        benefits: [
          "Unifies team culture across distant locations",
          "Guarantees delivery of safety and menu updates",
          "Verifiable read receipts for compliance and safety",
          "Replaces unorganized WhatsApp chat groups"
        ],
        related: ["sops-training", "employees", "daily-checklists"],
        mockupType: "news"
      }
    ]
  },
  inventory: {
    title: "Purchasing & Inventory Management",
    subtitle: "Complete Cost Control from Supplier to Prep Line",
    description: "Digitize your purchasing, track vendor price inflation, manage central kitchen requisitions, and eliminate food waste leaks across every location.",
    icon: "shopping-cart",
    keyCapabilities: [
      "Supplier Price Intelligence & Inflation Alerts",
      "Purchase Order builder with WhatsApp/Email dispatch",
      "Central kitchen & inter-branch transfer requisitions",
      "Receiving verification with delivery variance logs",
      "Food waste costing by root cause",
      "Live inventory levels & stock count audits",
      "Item catalog with custom units of measure (UOM)"
    ],
    businessBenefits: [
      "5% to 15% reduction in food & beverage costs",
      "Instant detection of supplier price creep",
      "Zero stock transfer discrepancies between branches",
      "Minimized kitchen food spoilage and waste",
      "Faster, error-free purchasing cycles"
    ],
    modules: [
      {
        id: "supplier-price-intelligence",
        name: "Supplier Price Intelligence",
        subtitle: "Inflation Tracking & Vendor Benchmarking",
        description: "Track unit cost fluctuations across all food and beverage suppliers over time. Detect price inflation, compare quotes across multiple vendors, and uncover volume savings automatically.",
        keyFeatures: [
          "Historical ingredient unit price fluctuation charts",
          "Cross-supplier item cost benchmarking & quote comparisons",
          "Purchase Order vs. Supplier Invoice price variance alerts",
          "Supplier inflation index tracking across meat, dairy, produce",
          "Automated cost-saving vendor recommendation flags",
          "Contract price compliance auditing"
        ],
        benefits: [
          "Immediately flags hidden supplier price increases",
          "Unlocks 5-15% food cost savings through benchmarking",
          "Eliminates manual spreadsheet price checks",
          "Gives management massive leverage in supplier negotiations"
        ],
        related: ["purchasing", "supplier-management", "item-catalog", "recipe-costing-manual"],
        mockupType: "priceIntelligence"
      },
      {
        id: "purchasing",
        name: "Purchasing & Procurement",
        subtitle: "Digital Purchase Order Management",
        description: "Create and dispatch purchase orders directly to suppliers. Track order status from placement to delivery, log invoices, and catch price discrepancies automatically.",
        keyFeatures: [
          "Digital Purchase Order (PO) builder with supplier item codes",
          "1-click dispatch via PDF, Email, and WhatsApp",
          "Order status lifecycle (Draft, Approved, Sent, Received, Paid)",
          "Partial delivery logging & receiving variance notes",
          "Invoice attachment upload & delivery slip photo vault",
          "Automated reorder suggestions based on par levels"
        ],
        benefits: [
          "Eliminates lost, double-placed, or verbal orders",
          "Enforces budget authorization before orders are placed",
          "Accurate cost tracking per vendor and branch",
          "Swift resolution of supplier delivery shortages"
        ],
        related: ["supplier-price-intelligence", "supplier-management", "branch-orders", "item-catalog"],
        mockupType: "purchasing"
      },
      {
        id: "branch-orders",
        name: "Branch Orders & Commissary",
        subtitle: "Central Kitchen & Inter-Branch Transfers",
        description: "Streamline stock transfers between retail branches and your central commissary kitchen or warehouse. Manage requisitions, fulfillment dispatch, and receiving checks seamlessly.",
        keyFeatures: [
          "Internal branch requisition templates",
          "Central kitchen production queue & batch fulfillment",
          "Dispatch notes with temperature and transit logging",
          "Receiving verification with automated variance logs",
          "Inter-branch stock transfer request & approval workflows",
          "Historical internal supply chain audit trails"
        ],
        benefits: [
          "Zero ordering errors between stores and central kitchen",
          "Accurate production batching for central kitchens",
          "Eliminates missing stock during branch-to-branch transfers",
          "Clear cost allocation between business entities"
        ],
        related: ["purchasing", "inventory-availability", "waste-management"],
        mockupType: "branchOrders"
      },
      {
        id: "supplier-management",
        name: "Supplier Management",
        subtitle: "Centralized Vendor Directory & Catalogs",
        description: "Manage all vendor contacts, price lists, order minimums, and delivery schedules in one place. Keep ordering guidelines clear and accessible for all branch managers.",
        keyFeatures: [
          "Central vendor directory with key contacts & reps",
          "Supplier catalog pricing grids & payment terms",
          "Delivery schedule calendars & daily cutoff reminders",
          "Minimum Order Quantities (MOQs) automated enforcement",
          "Supplier reliability ratings & on-time delivery metrics",
          "Multi-location supplier assignment rules"
        ],
        benefits: [
          "Saves hours spent looking for ordering contacts and terms",
          "Guarantees orders meet minimum delivery thresholds",
          "Provides historical pricing transparency across all locations",
          "Enables swift supplier audits and reviews"
        ],
        related: ["supplier-price-intelligence", "purchasing", "item-catalog"],
        mockupType: "suppliers"
      },
      {
        id: "waste-management",
        name: "Waste Management",
        subtitle: "Track Food Spoilage & Financial Loss",
        description: "Record food waste, expired ingredients, prep errors, and line drops. Flow categorizes waste reasons and costs them out against your live catalog to stop profit leaks.",
        keyFeatures: [
          "Quick-log mobile waste screen for kitchen staff",
          "Categorization by root cause (Spoilage, Over-prep, Burnt, Drop)",
          "Automatic financial loss costing based on item catalog",
          "Waste trends by station, shift, and branch",
          "Manager approval locks for high-value waste entries",
          "Actionable recommendations to adjust prep batch sizes"
        ],
        benefits: [
          "Pinpoints exact operational sources of kitchen profit loss",
          "Fosters waste reduction consciousness across culinary staff",
          "Drives down overall food cost percentage",
          "Calibrates kitchen prep par levels accurately"
        ],
        related: ["inventory-availability", "recipe-costing-manual", "financial-analytics"],
        mockupType: "waste"
      },
      {
        id: "inventory-availability",
        name: "Inventory Availability & Audits",
        subtitle: "Live Stock Level Monitoring & Variance",
        description: "Maintain accurate stock levels across all branch store rooms. Perform fast cycle counts on mobile, track stock variances, and receive low-stock alerts before items run dry.",
        keyFeatures: [
          "Real-time estimated inventory balances",
          "Mobile-guided cycle counts (Daily, Weekly, Monthly)",
          "Automated theoretical vs actual stock variance reports",
          "Low-stock alert triggers & reorder thresholds",
          "Shrinkage, theft, and unexplained loss detection",
          "Consolidated multi-unit inventory valuation"
        ],
        benefits: [
          "Prevents stock-outs on high-revenue menu items",
          "Replaces cumbersome manual clipboard stock counts",
          "Catches internal stock shrinkage and theft early",
          "Optimizes working capital tied up in excess inventory"
        ],
        related: ["waste-management", "kitchen-86-board", "purchasing", "item-catalog"],
        mockupType: "inventory"
      },
      {
        id: "item-catalog",
        name: "Item Catalog",
        subtitle: "Unified Master Item & Ingredient Ledger",
        description: "Standardize ingredients, packaging materials, and resale goods across all units. Define custom unit of measurement (UOM) conversions for seamless recipe and order costing.",
        keyFeatures: [
          "Master ingredient, packaging, and beverage catalog",
          "Custom UOM conversion engine (e.g., cases to kg to grams)",
          "Historical cost trend tracking per ingredient",
          "Supplier SKU mapping & tax rate settings",
          "Branch-specific item availability rules"
        ],
        benefits: [
          "Ensures consistent unit sizes across all operations",
          "Powers accurate recipe cost calculations",
          "Speeds up purchasing and stock count logging",
          "Facilitates group-wide bulk purchasing discounts"
        ],
        related: ["recipe-costing-manual", "supplier-price-intelligence", "supplier-management"],
        mockupType: "catalog"
      }
    ]
  },
  people: {
    title: "Employee & Workforce Intelligence",
    subtitle: "Empower Your Team with Transparent Operations",
    description: "Manage staff profiles, track real-time attendance with geofencing, automate complex tip pooling formulas, and enforce granular role-based permissions.",
    icon: "users",
    keyCapabilities: [
      "Real-time Attendance & Geofenced Time Clock",
      "Automated Tip Pooling & Distribution Engine",
      "Centralized staff profiles & digital document vaults",
      "Granular 7-tier Role-Based Access Control (RBAC)",
      "Digital staff wallets & cash advance tracking",
      "Security audit logs & active device monitoring"
    ],
    businessBenefits: [
      "Eliminates hours of manual tip and payroll calculations",
      "Zeroes out time theft and buddy punching with geofencing",
      "Builds staff trust through transparent tip breakdowns",
      "Protects confidential company and payroll data",
      "Streamlines staff onboarding across multiple units"
    ],
    modules: [
      {
        id: "attendance-timeclock",
        name: "Attendance & Time Clock",
        subtitle: "Real-Time Shift Punches & Geofencing",
        description: "Track employee clock-ins and clock-outs in real time with branch geofencing and device verification. Monitor tardiness, unexcused absences, and overtime thresholds automatically.",
        keyFeatures: [
          "Real-time clock in/out punch logs with GPS geofencing",
          "Biometric / authorized store tablet verification",
          "Automated tracking of late arrivals, early leaves, and absences",
          "Scheduled vs. actual worked hours variance logs",
          "Overtime threshold warning alerts for managers",
          "Manager punch adjustment workflow with full audit trail"
        ],
        benefits: [
          "Eliminates buddy punching and unverified time records",
          "Provides live visibility into on-duty floor and kitchen staff",
          "Prevents costly accidental overtime accumulation",
          "Generates verified hours worked for payroll export"
        ],
        related: ["tip-distribution-engine", "employees", "dashboard", "shift-reports"],
        mockupType: "attendance"
      },
      {
        id: "tip-distribution-engine",
        name: "Automated Tip Distribution",
        subtitle: "Multi-Formula Automated Tip Splits",
        description: "Automate end-of-shift and end-of-month tip pooling with custom mathematical formulas: hours-worked weighting, role/department percentages (FOH vs BOH), or point-based systems.",
        keyFeatures: [
          "Automated tip split calculation engine",
          "Hours-weighted & role-weighted mathematical formulas",
          "Custom Front-of-House vs Back-of-House percentage splits",
          "Staff digital payout ledger & cash advance deductions (Wallets)",
          "1-click export for payroll & bank payouts",
          "Full staff transparency into individual tip calculations"
        ],
        benefits: [
          "Saves hours of complex spreadsheet calculations",
          "Completely eliminates tip distribution disputes",
          "Boosts staff morale with transparent breakdowns",
          "Enforces fair compensation across kitchen and floor"
        ],
        related: ["attendance-timeclock", "employees", "financial-analytics", "dashboard"],
        mockupType: "tips"
      },
      {
        id: "employees",
        name: "Staff Directory & Vault",
        subtitle: "Centralized Employee Profiles & Contracts",
        description: "Keep all employee profiles, contracts, certifications, and emergency contacts in one secure database. Zero-knowledge encryption keeps personal information protected.",
        keyFeatures: [
          "Secure digital employee profiles & contact cards",
          "Emergency contacts & medical allergen notes",
          "Contract, food handler certification & ID file vaults",
          "Employment history, wage structure & branch assignments",
          "Staff contact directory with fast search and filtering",
          "Zero-Knowledge encrypted personal fields"
        ],
        benefits: [
          "Completely paperless employee onboarding",
          "Secure cloud storage of confidential employee files",
          "Immediate access to staff emergency details",
          "Simplified compliance audits for labor regulations"
        ],
        related: ["attendance-timeclock", "user-permissions", "login-activity"],
        mockupType: "employees"
      },
      {
        id: "user-permissions",
        name: "Security & Role Matrix",
        subtitle: "Granular 7-Tier Access Controls",
        description: "Control exactly who can view, edit, or approve operational data. Set role-based access for owners, area managers, branch supervisors, chefs, and line employees.",
        keyFeatures: [
          "7-tier Role-Based Access Control (RBAC)",
          "Strict branch-level data segregation",
          "Granular permission toggles per module action",
          "Manager overrides & purchase approval thresholds",
          "Fast PIN-based user switching for shared store tablets",
          "Real-time instant permission revocation"
        ],
        benefits: [
          "Protects sensitive financial, wage, and recipe data",
          "Prevents unauthorized purchase or waste approvals",
          "Ensures branch managers only view their location",
          "Maintains ironclad operational security protocols"
        ],
        related: ["employees", "login-activity", "security-page"],
        mockupType: "permissions"
      },
      {
        id: "login-activity",
        name: "Sign-In Logs & Audits",
        subtitle: "Device Monitoring & Security Audit Trails",
        description: "Monitor device logins, IP locations, and active sessions. Ensure that only authorized tablets and mobile phones access your operational systems.",
        keyFeatures: [
          "Real-time sign-in activity stream across all branches",
          "IP address, geolocation, and device hardware identification",
          "1-click remote session termination for lost devices",
          "Failed login attempt alerts & brute-force lockouts",
          "Authorized store tablet whitelisting",
          "Full compliance security audit log export"
        ],
        benefits: [
          "Immediate detection of compromised employee credentials",
          "Ensures store tablets remain physically inside branches",
          "Stronger compliance with enterprise data privacy standards",
          "Peace of mind for multi-location operators"
        ],
        related: ["user-permissions", "employees", "security-page"],
        mockupType: "loginActivity"
      }
    ]
  },
  customerExperience: {
    title: "Customer Experience & B2B Orders",
    subtitle: "Deliver Flawless Service & Expand Commercial Accounts",
    description: "Provide consistent hospitality service, resolve guest complaints systematically, and manage lucrative B2B corporate and wholesale catering accounts.",
    icon: "smile",
    keyCapabilities: [
      "B2B Wholesale & Corporate Accounts Management",
      "Table reservations & interactive digital floor plans",
      "Structured customer complaint logging & recovery workflows",
      "Root-cause complaint analytics across food & service",
      "Staff upselling guides & seasonal specials promotion",
      "Delivery dispatch & wholesale invoice statements"
    ],
    businessBenefits: [
      "Unlocks new B2B corporate catering revenue",
      "Higher guest retention through proactive service recovery",
      "Optimized table turnover and seat utilization",
      "Higher average check sizes with staff upselling guides"
    ],
    modules: [
      {
        id: "b2b-wholesale-orders",
        name: "B2B & Wholesale Orders",
        subtitle: "Corporate Accounts & Catering Orders",
        description: "End-to-end B2B client order management for bakeries, central kitchens, and food groups supplying corporate clients, cafés, and retail supermarkets.",
        keyFeatures: [
          "Corporate client accounts & delivery address directory",
          "Custom wholesale client price lists & discount tiers",
          "Recurring order scheduling & production templates",
          "Delivery dispatch notes & driver route sheets",
          "Accounts Receivable (AR) logs & monthly statement generation",
          "Minimum order values & cutoff time enforcement"
        ],
        benefits: [
          "Unlocks scalable B2B revenue streams for central kitchens",
          "Eliminates manual invoicing errors and forgotten orders",
          "Streamlines bakery & commissary daily production batching",
          "Clear visibility into corporate receivables and aging balances"
        ],
        related: ["client-complaints", "dashboard", "financial-analytics"],
        mockupType: "b2bOrders"
      },
      {
        id: "table-reservations",
        name: "Table Reservations",
        subtitle: "Interactive Floor Plan & Booking Manager",
        description: "Track guest bookings, walk-ins, and VIP table assignments. Flow's table manager synchronizes table states in real time across all host and manager tablets.",
        keyFeatures: [
          "Interactive digital floor plan layout",
          "Real-time table status tracking (Seated, Appetizer, Billed, Clean)",
          "Waitlist management with turn-time estimates",
          "Guest profile, allergy, and VIP preferences notes",
          "Seating capacity optimization recommendations",
          "Reservation analytics (no-shows, turn times, average spend)"
        ],
        benefits: [
          "Maximized seating capacity and table turns",
          "Eliminated double-bookings and host stand chaos",
          "Personalized, VIP service for returning guests",
          "Accurate forecasting of kitchen rush hours"
        ],
        related: ["dashboard", "b2b-wholesale-orders", "client-complaints"],
        mockupType: "reservations"
      },
      {
        id: "client-complaints",
        name: "Guest Complaints & Analytics",
        subtitle: "Structured Service Recovery & Root-Cause Logs",
        description: "Log and resolve customer complaints instantly. Track complaint root causes, resolution costs (refunds, vouchers, comps), and follow-up activities to win back unhappy guests.",
        keyFeatures: [
          "Incident logging across Food Quality, Service, Cleanliness, Delivery",
          "Financial resolution tracking (Refund, Voucher, Comped Dish)",
          "Assigned manager owner with resolution deadline alerts",
          "Root-cause categorizations and trend analytics",
          "Service recovery status flags & follow-up notes",
          "Staff member involved logging for constructive training"
        ],
        benefits: [
          "Systematic follow-up ensures no negative experience is ignored",
          "Identifies recurring culinary or service bottlenecks",
          "Protects brand reputation through rapid service recovery",
          "Turns unhappy guests into loyal brand champions"
        ],
        related: ["shift-reports", "dashboard", "financial-analytics"],
        mockupType: "complaints"
      },
      {
        id: "promotions-upselling",
        name: "Specials & Staff Upselling",
        subtitle: "Operationalize Menu Upselling & Specials",
        description: "Create structured prompts for front-of-house staff to recommend high-margin specials, wine pairings, and desserts, monitoring staff performance directly through shift logs.",
        keyFeatures: [
          "Active daily promotion & chef special guides for staff",
          "Upselling targets & shift focus checklists",
          "Interactive tasting notes & pairing selling points",
          "Staff upselling leaderboards and recognition",
          "POS link-up matching upsell conversion rates",
          "Configurable reward incentives for top servers"
        ],
        benefits: [
          "Drives noticeable increases in average ticket size",
          "Motivates waitstaff through transparent recognition",
          "Ensures new culinary creations get active push",
          "Maximizes profitability on high-margin ingredients"
        ],
        related: ["table-reservations", "tip-distribution-engine", "dashboard"],
        mockupType: "promotions"
      }
    ]
  },
  financialVisibility: {
    title: "Financial Visibility & Loss Prevention",
    subtitle: "Protect Margins with Daily Financial Controls",
    description: "Reconcile daily store cash drawers, track supplier spending against budgets, monitor POS voids and refunds, and eliminate unaccounted cash shrinkage.",
    icon: "activity",
    keyCapabilities: [
      "Daily cash drawer & safe drop reconciliation",
      "POS Void and refund audit logs with manager override tracking",
      "Petty cash and digital staff wallet expense logs",
      "Branch-by-branch financial performance comparison",
      "Loss prevention analytics and shrinkage alerts",
      "Comprehensive financial reporting exports"
    ],
    businessBenefits: [
      "Eliminates unaccounted cash drawer shrinkage",
      "Prevents internal POS void fraud and unauthorized comps",
      "Provides day-by-day gross margin clarity",
      "Streamlines end-of-month accounting audits"
    ],
    modules: [
      {
        id: "financial-analytics-re",
        name: "Financial Analytics",
        subtitle: "Daily Operational P&L and Cost Control",
        description: "Monitor daily financial health beyond the POS. Reconcile cash drawers, track supplier spending against budgets, monitor voids and comps, and compare branch gross profitability.",
        keyFeatures: [
          "Daily cash reconciliation & safe drop logs",
          "Petty cash and staff wallet expense records",
          "Branch-by-branch operational margin comparisons",
          "COGS and labor cost trend analytics",
          "Historical revenue vs operational expense tracking"
        ],
        benefits: [
          "Better financial control across all branches",
          "Improved transparency for owners and partners",
          "Faster end-of-month reporting",
          "Better operational budget planning"
        ],
        related: ["dashboard", "reports", "shift-reports-re", "void-receipts"],
        mockupType: "financial"
      },
      {
        id: "void-receipts",
        name: "Void & Refund Audits",
        subtitle: "Loss Prevention & POS Fraud Protection",
        description: "Monitor and audit voids, cancellations, and receipt modifications across all POS terminals, preventing internal fraud and unauthorized discounts.",
        keyFeatures: [
          "POS Void audit log synchronization",
          "Manager approval override tracking and authorization logs",
          "Reason code categorization (Order Error, Spoilage, Customer Comp)",
          "Void ratio alert thresholds by cashier and server",
          "Employee void leaderboards to flag anomalies",
          "Void pattern trend charts across shifts"
        ],
        benefits: [
          "Drastically reduces employee POS theft and unauthorized voids",
          "Immediate alerts on irregular cancellation activity",
          "Accurate accounting of comps and service recovery costs",
          "Clear audit trail for internal compliance"
        ],
        related: ["financial-analytics-re", "reports", "shift-reports-re"],
        mockupType: "voids"
      },
      {
        id: "shift-reports-re",
        name: "Daily Shift Reports",
        subtitle: "End-of-Shift Cash & Operations Handover",
        description: "Keep communication flowing between shifts. Staff document key events, cash reconciliations, safe drops, maintenance issues, and general shift logs.",
        keyFeatures: [
          "Digital end-of-shift cash drawer balance forms",
          "Petty cash expense logs and receipt photos",
          "Maintenance & incident reporting tickets",
          "Customer feedback highlights",
          "Inter-shift handover checklist confirmations"
        ],
        benefits: [
          "Zero lost financial information between shifts",
          "Transparent cash handling and reconciliation",
          "Faster resolution of store maintenance issues",
          "Centralized store log history"
        ],
        related: ["daily-checklists", "dashboard", "void-receipts"],
        mockupType: "shiftReports"
      }
    ]
  },
  securityData: {
    title: "Security & Data Protection",
    subtitle: "Enterprise-Level Security for Modern Hospitality",
    description: "Flow protects your operational data using zero-knowledge client-side encryption, role-based authorization, and continuous audit monitoring.",
    icon: "shield",
    isStatic: true,
    keyCapabilities: [
      "Zero-Knowledge client-side AES-256 encryption",
      "Granular 7-tier Role-Based Access Control (RBAC)",
      "Real-time IP & authorized device monitoring",
      "Full audit trail logging for all sensitive transactions",
      "Automated encrypted daily database backups",
      "Strict data isolation between multi-unit tenant organizations"
    ],
    businessBenefits: [
      "Total confidentiality for payroll, staff, and recipe formulas",
      "Protection against unauthorized device or rogue employee access",
      "Full compliance with international data privacy standards",
      "Guaranteed business continuity with automated cloud backups"
    ]
  },
  mobileApp: {
    title: "Flow Mobile & Tablet App",
    subtitle: "Operations in the Palm of Your Hand",
    description: "Designed specifically for fast-paced restaurant environments. Flow's iOS, Android, and web apps keep managers, chefs, and staff connected on the go.",
    icon: "smartphone",
    isStatic: true,
    keyCapabilities: [
      "Native iOS & Android app experience",
      "Offline-first caching with automatic cloud sync",
      "Fast PIN-based employee switching on shared store tablets",
      "Push notifications for urgent 86 items and shift tasks",
      "Built-in camera barcode scanning & photo proof uploads",
      "Responsive layout optimized for iPads, kitchen tablets & smartphones"
    ],
    businessBenefits: [
      "Zero downtime during brief internet dropouts",
      "Immediate staff adoption with zero learning curve",
      "Real-time operational alerts in the manager's pocket",
      "Eliminates expensive proprietary hardware requirements"
    ]
  }
};
