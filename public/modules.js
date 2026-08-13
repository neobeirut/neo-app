const modulesData = {
  dashboardBi: {
    title: "Dashboard & Business Intelligence",
    subtitle: "Make Better Decisions with Real-Time Visibility",
    description: "Gain an instant overview of your entire operation from a centralized dashboard. Monitor operational performance, identify issues, and make informed decisions before problems impact your business.",
    icon: "trending-up",
    keyCapabilities: [
      "Real-time KPI dashboard",
      "Multi-branch overview",
      "Department filtering",
      "Daily operational alerts",
      "Cash status monitoring",
      "Checklist completion tracking",
      "Reservation summary",
      "Purchasing status",
      "Inventory availability",
      "Customer complaints",
      "User activity monitoring"
    ],
    businessBenefits: [
      "Faster decision making",
      "Complete operational visibility",
      "Early identification of issues",
      "Improved management efficiency"
    ],
    modules: [
      {
        id: "dashboard",
        name: "Dashboard",
        subtitle: "Real-Time Operational Visibility",
        description: "The Dashboard provides owners and managers with an instant overview of every branch. Monitor operations, identify issues, and make informed decisions from one centralized screen.",
        keyFeatures: [
          "Real-time KPI dashboard",
          "Multi-branch overview",
          "Department filtering",
          "Daily operational alerts",
          "Cash status monitoring",
          "Checklist completion tracking",
          "Reservation summary",
          "Purchasing status",
          "Inventory availability",
          "Customer complaints",
          "User activity monitoring"
        ],
        benefits: [
          "Faster decision making",
          "Complete operational visibility",
          "Early identification of issues",
          "Improved management efficiency"
        ],
        related: ["financial-analytics", "reports", "daily-checklists"],
        mockupType: "dashboard"
      },
      {
        id: "financial-analytics",
        name: "Financial Analytics",
        subtitle: "Understand Your Business Performance",
        description: "Monitor daily operational performance with financial insights that help you make smarter business decisions.",
        keyFeatures: [
          "Daily cash reconciliation",
          "Operational financial reports",
          "Void monitoring",
          "Branch performance comparison",
          "Business analytics"
        ],
        benefits: [
          "Better financial control",
          "Improved transparency",
          "Faster reporting",
          "Better operational planning"
        ],
        related: ["dashboard", "reports", "shift-reports"],
        mockupType: "financial"
      },
      {
        id: "reports",
        name: "Reports",
        subtitle: "Automated Operational Reports",
        description: "Generate and schedule comprehensive operational reports for branch managers, partners, or investors.",
        keyFeatures: [
          "Scheduled automated report generation",
          "Custom report builder",
          "Direct email dispatch",
          "Branch comparison cross-tabs",
          "Consolidated multi-unit summaries"
        ],
        benefits: [
          "Saves days of compiling spreadsheets each month",
          "Ensures investors receive timely updates",
          "Consistent operational benchmarks",
          "Accurate store history logs"
        ],
        related: ["dashboard", "financial-analytics", "void-receipts"],
        mockupType: "reports"
      }
    ]
  },
  operations: {
    title: "Operations Management",
    subtitle: "Standardize Daily Operations Across Every Branch",
    description: "Ensure every location follows the same operational standards. Digital workflows eliminate paper forms while improving accountability, communication, and consistency.",
    icon: "layers",
    keyCapabilities: [
      "Digital opening and closing procedures",
      "Daily operational reporting",
      "Task assignment and follow-up",
      "Standard operating procedures",
      "Internal communication",
      "Progress monitoring"
    ],
    businessBenefits: [
      "Consistent operations",
      "Improved accountability",
      "Reduced human error",
      "Better communication",
      "Faster onboarding"
    ],
    modules: [
      {
        id: "daily-checklists",
        name: "Daily Checklists",
        subtitle: "Digital Standard Operating Procedures",
        description: "Replace paper forms with smart, digital checklists. Flow ensures opening, closing, and hygiene checks are completed on time, with photo proof and digital sign-offs, maintaining consistent quality across all shifts.",
        keyFeatures: [
          "Scheduled opening & closing checklists",
          "Hygiene, food safety, and HACCP forms",
          "Photo uploads for proof of completion",
          "Real-time completion progress tracking",
          "Automatic notification for missed tasks",
          "Manager review and digital signatures"
        ],
        benefits: [
          "Consistent operations",
          "Improved accountability",
          "Reduced human error",
          "Better communication",
          "Faster onboarding"
        ],
        related: ["dashboard", "task-manager", "sops-training", "shift-reports"],
        mockupType: "checklists"
      },
      {
        id: "shift-reports",
        name: "Daily Shift Reports",
        subtitle: "End-of-Shift Logs and Handovers",
        description: "Keep communication flowing between shifts. Staff can document key events, cash reconciliations, maintenance issues, and general shift logs, ensuring managers stay informed without endless text messages.",
        keyFeatures: [
          "Digital end-of-shift reports",
          "Cash reconciliation & drop logs",
          "Maintenance & incident reporting",
          "Customer feedback highlights",
          "Inter-shift communication logs",
          "Shift handover checklist confirmations"
        ],
        benefits: [
          "Zero lost information between shifts",
          "Transparent cash handling and reconciliation",
          "Faster resolution of maintenance issues",
          "Centralized store log history"
        ],
        related: ["daily-checklists", "dashboard", "void-receipts", "client-complaints"],
        mockupType: "shiftReports"
      },
      {
        id: "task-manager",
        name: "Task Manager",
        subtitle: "Assign and Track Operational Tasks",
        description: "Create, assign, and track one-off or recurring tasks across your branches. From monthly deep cleans to equipment servicing, Flow ensures tasks don't slip through the cracks.",
        keyFeatures: [
          "Recurring task scheduling",
          "Role-based task assignment",
          "Priority levels and due dates",
          "Task comment threads and attachments",
          "Push notifications for assigned tasks",
          "Task completion analytics"
        ],
        benefits: [
          "Clear ownership and accountability",
          "Reduced operational neglect on minor tasks",
          "Streamlined manager follow-ups",
          "Comprehensive task history logs"
        ],
        related: ["daily-checklists", "sops-training", "waste-management"],
        mockupType: "tasks"
      },
      {
        id: "sops-training",
        name: "SOPs & Training",
        subtitle: "Centralized Knowledge Base",
        description: "Store your recipes, training manuals, service guides, and standard operating procedures (SOPs) in a central digital hub, accessible to employees directly on their mobile devices.",
        keyFeatures: [
          "Document and video training guides",
          "Step-by-step recipe catalog with photos",
          "Allergen listings and preparation details",
          "SOP quizzes and staff verification",
          "Searchable handbook directory",
          "Offline access for mobile users"
        ],
        benefits: [
          "Consistent food quality and service standards",
          "Drastically reduced training time for new staff",
          "Instant access to recipe guidelines",
          "Reduced kitchen mistakes and waste"
        ],
        related: ["internal-news", "daily-checklists", "employees"],
        mockupType: "sops"
      },
      {
        id: "internal-news",
        name: "Internal News",
        subtitle: "Centralized Staff Announcements",
        description: "Broadcast company news, policy updates, menu changes, and success stories. Flow makes sure every team member receives and reads critical updates without relying on chaotic WhatsApp groups.",
        keyFeatures: [
          "Rich text news posts with images",
          "Targeted broadcasting by branch or department",
          "Read receipts and compliance tracking",
          "Comments and team engagement reactions",
          "Urgent bulletin alerts (pinned posts)",
          "Mobile push notifications"
        ],
        benefits: [
          "Aligned team on company goals and policies",
          "Elimination of communication fragmentation",
          "Verifiable read receipts for compliance",
          "Improved staff engagement and culture"
        ],
        related: ["sops-training", "employees", "departments"],
        mockupType: "news"
      }
    ]
  },
  inventory: {
    title: "Purchasing & Inventory Management",
    subtitle: "Complete Control from Request to Delivery",
    description: "Digitize your purchasing process and maintain complete visibility over inventory movement across every branch.",
    icon: "shopping-cart",
    keyCapabilities: [
      "Internal branch transfers",
      "Purchase requests",
      "Supplier management",
      "Purchase approvals",
      "Waste tracking",
      "Inventory availability",
      "Product catalog management"
    ],
    businessBenefits: [
      "Lower food costs",
      "Better supplier control",
      "Reduced shortages",
      "Minimized waste",
      "Improved purchasing efficiency"
    ],
    modules: [
      {
        id: "branch-orders",
        name: "Branch Orders",
        subtitle: "Internal Store Requisitions",
        description: "Streamline orders between your branches and your central kitchen or warehouse. Manage requisitions, approvals, and dispatch notes through a simple, paperless workflow.",
        keyFeatures: [
          "Internal branch requisition forms",
          "Automatic replenishment recommendations",
          "Approval workflows for central kitchen/warehouse",
          "Dispatch notes and transit tracking",
          "Discrepancy logs for received goods",
          "Historical internal order logs"
        ],
        benefits: [
          "Eliminated ordering errors between locations",
          "Reduced central kitchen waste",
          "Clear audit trail of internal stock transfers",
          "Automated supply requests based on consumption"
        ],
        related: ["purchasing", "supplier-management", "waste-management"],
        mockupType: "branchOrders"
      },
      {
        id: "purchasing",
        name: "Purchasing & Procurement",
        subtitle: "Supplier Purchase Order Management",
        description: "Create and send purchase orders directly to suppliers. Track order status from placement to delivery, log invoices, and monitor cost fluctuations over time.",
        keyFeatures: [
          "Digital Purchase Order (PO) builder",
          "Direct email/WhatsApp ordering to suppliers",
          "Order status tracking (Draft, Sent, Received, Paid)",
          "Partial delivery logging & discrepancy tracking",
          "Invoice scanning & attachment upload",
          "Cost fluctuation alerts"
        ],
        benefits: [
          "No more forgotten or double-placed orders",
          "Full control over purchasing budgets",
          "Accurate cost tracking per supplier",
          "Streamlined supplier disputes"
        ],
        related: ["supplier-management", "branch-orders", "financial-analytics", "inventory-availability"],
        mockupType: "purchasing"
      },
      {
        id: "supplier-management",
        name: "Supplier Management",
        subtitle: "Centralized Supplier Directory",
        description: "Manage all your supplier contacts, catalogs, minimum order values, and delivery schedules in one centralized system. Keep key contact info accessible to shift managers.",
        keyFeatures: [
          "Central supplier database",
          "Item catalogs & supplier pricing grids",
          "Delivery schedule calendars & cutoff alerts",
          "Minimum Order Quantities (MOQs) enforcement",
          "Supplier performance rating & lead times",
          "Multiple contacts per supplier"
        ],
        benefits: [
          "Saves hours spent looking for ordering info",
          "Ensures ordering complies with supplier terms",
          "Provides historical pricing transparency",
          "Enables easy supplier audits"
        ],
        related: ["purchasing", "item-catalog", "branch-orders"],
        mockupType: "suppliers"
      },
      {
        id: "waste-management",
        name: "Waste Management",
        subtitle: "Track Food Waste and Losses",
        description: "Record all food waste, spoilage, and preparation errors. Flow categorizes waste reasons and costs them out, giving you complete visibility into profit leaks.",
        keyFeatures: [
          "Mobile waste-logging screen",
          "Waste categorization (Spoilage, Prep, Spill, etc.)",
          "Direct financial cost-out based on item catalog",
          "Waste patterns & trends charts",
          "Manager approval workflows for high-value waste",
          "Integration with inventory updates"
        ],
        benefits: [
          "Pinpoints exact sources of food waste",
          "Creates operational awareness among staff",
          "Reduces food cost percentage",
          "Optimizes order quantities and prep levels"
        ],
        related: ["inventory-availability", "purchasing", "financial-analytics"],
        mockupType: "waste"
      },
      {
        id: "inventory-availability",
        name: "Inventory Availability (86 Missing Items)",
        subtitle: "Live Stock Level Monitoring",
        description: "Track your stock availability in real time. Know when critical ingredients are running low, manage stock counts, and keep a close eye on the 86 items list.",
        keyFeatures: [
          "Real-time inventory levels estimate",
          "Periodic stock count audits (daily/weekly/monthly)",
          "Low-stock alert thresholds",
          "86ed items automatic notifications",
          "Stock discrepancy reporting",
          "Historical stock valuation"
        ],
        benefits: [
          "Prevents running out of popular menu items",
          "Eliminates manual clipboard stock counts",
          "Identifies stock shrinkage and theft early",
          "Optimized working capital in stock"
        ],
        related: ["waste-management", "purchasing", "item-catalog", "client-orders"],
        mockupType: "inventory"
      },
      {
        id: "item-catalog",
        name: "Item Catalog",
        subtitle: "Central Ingredient & Recipe Ledger",
        description: "Standardize your items, units of measure, and prices. The Item Catalog serves as the single source of truth for ingredients, recipes, and operations.",
        keyFeatures: [
          "Unified inventory item catalog",
          "Custom conversion factors (e.g. box to kg)",
          "Centralized cost history records",
          "Supplier item code mapping",
          "Cross-branch availability rules"
        ],
        benefits: [
          "Ensures consistent unit sizes across branches",
          "Simplifies recipe cost calculations",
          "Speeds up purchasing and waste logging",
          "Facilitates bulk discount purchasing"
        ],
        related: ["inventory-availability", "sops-training", "supplier-management"],
        mockupType: "catalog"
      }
    ]
  },
  people: {
    title: "Employee & Organization Management",
    subtitle: "Empower Your Team with Clear Responsibilities",
    description: "Manage employees, departments, permissions, and operational accountability from one centralized platform.",
    icon: "users",
    keyCapabilities: [
      "Employee database",
      "Department assignment",
      "Role-based permissions",
      "Login tracking",
      "Tip distribution",
      "User management"
    ],
    businessBenefits: [
      "Better workforce organization",
      "Increased accountability",
      "Enhanced security",
      "Simplified administration"
    ],
    modules: [
      {
        id: "employees",
        name: "Employees",
        subtitle: "Centralized Staff Directory",
        description: "Keep all employee profiles, contracts, documents, and emergency contacts in one secure database. Zero-knowledge encryption keeps personal information safe.",
        keyFeatures: [
          "Secure digital employee profiles",
          "Emergency contacts & medical notes",
          "Contract, ID, and certificate file vaults",
          "Hire date, roles, and branch history",
          "Staff contact directory with search",
          "Zero-Knowledge encrypted personal fields"
        ],
        benefits: [
          "Completely paperless employee onboarding",
          "Secure storage of confidential files",
          "Quick access to staff details in emergencies",
          "Simplified compliance audits for labor laws"
        ],
        related: ["departments", "user-permissions", "login-activity"],
        mockupType: "employees"
      },
      {
        id: "user-permissions",
        name: "Security & Matrix",
        subtitle: "Granular Access Controls",
        description: "Control exactly who can view, edit, or approve operational data. Set role-based access for owners, branch managers, chefs, and line employees.",
        keyFeatures: [
          "Role-based access control (RBAC)",
          "Branch-level data segregation",
          "Custom permission levels per action",
          "Admin overrides and approval requests",
          "Quick profile-switching controls",
          "Real-time permission updates"
        ],
        benefits: [
          "Protects sensitive financial and staff data",
          "Prevents unauthorized purchase or waste logs",
          "Ensures branch managers only see their branch",
          "Clear security protocols for operational actions"
        ],
        related: ["employees", "login-activity", "security-page"],
        mockupType: "permissions"
      },
      {
        id: "login-activity",
        name: "Sign-In Logs",
        subtitle: "Audit Trails & Device Monitoring",
        description: "Monitor device logins, session states, and active sessions. Ensure that only authorized tablets and mobile phones are accessing your operational platform.",
        keyFeatures: [
          "Real-time login activity stream",
          "IP, location, and device identification",
          "Remote session termination capabilities",
          "Failed login alert logs",
          "Authorized device whitelist controls",
          "Multi-factor authentication (MFA) status"
        ],
        benefits: [
          "Immediate detection of credentials misuse",
          "Ensures store tablets remain in-store",
          "Stronger compliance with data regulations",
          "Enhanced security awareness"
        ],
        related: ["user-permissions", "security-page"],
        mockupType: "loginActivity"
      },
      {
        id: "tip-management",
        name: "Tips Configuration",
        subtitle: "Transparent Tip Distribution",
        description: "Calculate, split, and record tips based on employee shifts, hours worked, and department weightings.",
        keyFeatures: [
          "Tip pooling rule engine",
          "Shift and hour integration from timecards",
          "FOH/BOH tip splits with custom weightings",
          "Tip payout tracking and logs",
          "Employee visibility into tip calculations",
          "Tips export for payroll integration"
        ],
        benefits: [
          "Eliminates hours of manual calculations",
          "Builds staff trust through transparency",
          "Reduces payroll processing time",
          "Maintains clean compliance records"
        ],
        related: ["employees", "shift-reports", "financial-analytics"],
        mockupType: "tips"
      }
    ]
  },
  customerExperience: {
    title: "Customer Experience",
    subtitle: "Deliver Exceptional Service Every Day",
    description: "Provide a consistent customer experience by managing reservations, complaints, promotions, and client orders from a single platform.",
    icon: "smile",
    keyCapabilities: [
      "Reservation management",
      "Complaint resolution",
      "Corporate & B2B orders",
      "Promotional campaigns",
      "Upselling opportunities"
    ],
    businessBenefits: [
      "Improved customer satisfaction",
      "Better service consistency",
      "Increased revenue opportunities",
      "Stronger customer relationships"
    ],
    modules: [
      {
        id: "table-reservations",
        name: "Table Reservations",
        subtitle: "Operational Floor & Booking Manager",
        description: "Keep track of guest reservations and walk-ins. Flow's table manager synchronizes table states across all devices, ensuring your host stand runs smoothly.",
        keyFeatures: [
          "Interactive digital floor plan layout",
          "Real-time table status tracking",
          "Waitlist management with SMS updates",
          "Guest profile and allergy logs",
          "Seating capacity optimization recommendations",
          "Reservation analytics (noshows, turn-times)"
        ],
        benefits: [
          "Maximized seating capacity and revenue",
          "Reduced double-bookings and wait times",
          "Personalized service for return guests",
          "Accurate forecasting of busy hours"
        ],
        related: ["dashboard", "client-orders", "client-complaints"],
        mockupType: "reservations"
      },
      {
        id: "client-complaints",
        name: "Client Complaints",
        subtitle: "Structured Service Recovery",
        description: "Log and resolve customer complaints instantly. Track complaint reasons, refund expenditures, and follow-up activities to ensure unhappy guests are won back.",
        keyFeatures: [
          "Incident logging (Food, Service, Ambiance, Delivery)",
          "Financial resolution logging (Refund, Voucher, Comp)",
          "Assigned owner for follow-up notifications",
          "Root-cause categorizations",
          "Complaint analysis dashboards",
          "Service recovery status flags"
        ],
        benefits: [
          "Ensures systematic follow-up on every negative experience",
          "Identifies recurring service or food quality issues",
          "Protects brand reputation through service recovery",
          "Lowers customer acquisition costs"
        ],
        related: ["shift-reports", "dashboard", "financial-analytics"],
        mockupType: "complaints"
      },
      {
        id: "client-orders",
        name: "Client Orders",
        subtitle: "Operations-Focused Order Dispatch",
        description: "Bridge the gap between POS and kitchen. Track order prep status, dispatch delay tracking, and operational order flows to optimize kitchen execution speed.",
        keyFeatures: [
          "Order preparation status board (KDS interface)",
          "Ticket delay alert thresholds",
          "Courier dispatch logs for delivery orders",
          "Prep-time and ticket accuracy analytics",
          "POS synchronization bridge",
          "Item 86-list sync for online channels"
        ],
        benefits: [
          "Faster table turn times and hot food delivery",
          "Fewer kitchen mistakes",
          "Reduced delivery courier waiting times",
          "Accurate kitchen performance metrics"
        ],
        related: ["table-reservations", "inventory-availability", "dashboard"],
        mockupType: "clientOrders"
      },
      {
        id: "promotions-upselling",
        name: "Specials & Upsell",
        subtitle: "Operationalize Menu Upselling",
        description: "Create structured prompts for your FOH staff to upsell specific high-margin items or promotional offers, monitoring staff success directly through shift inputs.",
        keyFeatures: [
          "Active promotion guides for staff",
          "Upselling target checklists per shift",
          "Interactive staff guides with selling points",
          "Leaderboards for successful upselling campaigns",
          "POS link-up matching upsell rates",
          "Configurable reward incentives for servers"
        ],
        benefits: [
          "Drives increased average ticket sizes",
          "Motivates staff through fun competitions",
          "Ensures new menu items get active push",
          "Maximizes profits on high-margin ingredients"
        ],
        related: ["table-reservations", "tip-management", "dashboard"],
        mockupType: "promotions"
      }
    ]
  },
  financialVisibility: {
    title: "Financial Visibility",
    subtitle: "Understand Your Business Performance",
    description: "Monitor daily operational performance with financial insights that help you make smarter business decisions.",
    icon: "activity",
    keyCapabilities: [
      "Daily cash reconciliation",
      "Operational financial reports",
      "Void monitoring",
      "Branch performance comparison",
      "Business analytics"
    ],
    businessBenefits: [
      "Better financial control",
      "Improved transparency",
      "Faster reporting",
      "Better operational planning"
    ],
    modules: [
      {
        id: "financial-analytics-re",
        name: "Financial Analytics",
        subtitle: "Understand Your Business Performance",
        description: "Monitor daily operational performance with financial insights that help you make smarter business decisions.",
        keyFeatures: [
          "Daily cash reconciliation",
          "Operational financial reports",
          "Void monitoring",
          "Branch performance comparison",
          "Business analytics"
        ],
        benefits: [
          "Better financial control",
          "Improved transparency",
          "Faster reporting",
          "Better operational planning"
        ],
        related: ["dashboard", "reports", "shift-reports"],
        mockupType: "financial"
      },
      {
        id: "shift-reports-re",
        name: "Daily Shift Reports",
        subtitle: "End-of-Shift Logs and Handovers",
        description: "Keep communication flowing between shifts. Staff can document key events, cash reconciliations, maintenance issues, and general shift logs.",
        keyFeatures: [
          "Digital end-of-shift reports",
          "Cash reconciliation & drop logs",
          "Maintenance & incident reporting",
          "Customer feedback highlights",
          "Inter-shift communication logs"
        ],
        benefits: [
          "Zero lost information between shifts",
          "Transparent cash handling and reconciliation",
          "Faster resolution of maintenance issues",
          "Centralized store log history"
        ],
        related: ["daily-checklists", "dashboard", "void-receipts"],
        mockupType: "shiftReports"
      },
      {
        id: "void-receipts",
        name: "Void Receipts",
        subtitle: "Receipt and Refund Audit Manager",
        description: "Monitor and audit voids, refunds, and receipt modifications across all POS units, preventing internal fraud and leakage.",
        keyFeatures: [
          "POS Void audit logs synchronization",
          "Manager approval override tracking",
          "Reason codes categorization (error, waste, comp)",
          "Void ratio alert thresholds",
          "Employee void leaderboards logs",
          "Void patterns & trend charts"
        ],
        benefits: [
          "Reduced employee shrinkage and POS fraud",
          "Immediate alerts on irregular voids activity",
          "Accurate record of comps and customer resolutions",
          "Clear overview of refund cost allocations"
        ],
        related: ["financial-analytics", "reports", "shift-reports"],
        mockupType: "voids"
      }
    ]
  },
  securityData: {
    title: "Security & Data Protection",
    subtitle: "Enterprise-Level Security for Your Business",
    description: "Flow protects your operational data using modern security practices designed for hospitality businesses.",
    icon: "shield",
    isStatic: true,
    keyCapabilities: [
      "Zero-Knowledge client-side encryption",
      "AES-256 protection for sensitive data",
      "Role-based permissions",
      "Multi-tenant architecture",
      "Audit trails",
      "Secure cloud infrastructure"
    ],
    businessBenefits: [
      "Protect employee information",
      "Secure financial records",
      "Controlled access",
      "Regulatory confidence"
    ],
    mockupType: "encryption",
    link: "#/security"
  },
  mobileApp: {
    title: "Mobile App",
    subtitle: "Manage Operations from Anywhere",
    description: "The Flow Mobile App keeps your teams connected and productive whether they are on the restaurant floor, in the kitchen, or managing multiple locations.",
    icon: "smile",
    isStatic: true,
    keyCapabilities: [
      "Complete daily checklists",
      "Submit shift reports",
      "Manage operational tasks",
      "Create branch orders",
      "Receive notifications",
      "Record operational data",
      "Access procedures and training"
    ],
    businessBenefits: [
      "Increased mobility",
      "Faster communication",
      "Real-time updates",
      "Improved operational efficiency"
    ],
    mockupType: "mobile",
    link: "#/features"
  }
};
