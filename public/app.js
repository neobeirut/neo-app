// SVG Icons utility to avoid external dependencies
const Icons = {
  layers: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`,
  shoppingCart: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>`,
  users: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  smile: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>`,
  trendingUp: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`,
  check: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  checkCircle: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
  bullet: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="5"/></svg>`,
  shield: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  lock: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  unlock: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>`,
  key: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>`,
  arrowRight: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`,
  arrowDown: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>`,
  alertTriangle: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  search: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
  server: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>`,
  activity: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
  phone: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`
};

// Application Router & Controllers
class FlowApp {
  constructor() {
    this.appElement = document.getElementById("app");
    this.mobileNav = document.getElementById("mobileNav");
    this.backdrop = document.getElementById("mobileBackdrop");
    
    this.initEvents();
    this.handleRoute();
  }

  initEvents() {
    // Hash routing
    window.addEventListener("hashchange", () => this.handleRoute());
    
    // Header scroll background change
    const header = document.querySelector("header");
    window.addEventListener("scroll", () => {
      if (window.scrollY > 50) {
        header.classList.add("scrolled");
      } else {
        header.classList.remove("scrolled");
      }
    });

    // Mobile nav toggling
    document.getElementById("menuToggle").addEventListener("click", () => this.toggleMobileNav(true));
    document.getElementById("closeMobileMenu").addEventListener("click", () => this.toggleMobileNav(false));
    this.backdrop.addEventListener("click", () => this.toggleMobileNav(false));
  }

  toggleMobileNav(show) {
    if (show) {
      this.mobileNav.classList.add("open");
      this.backdrop.classList.add("open");
    } else {
      this.mobileNav.classList.remove("open");
      this.backdrop.classList.remove("open");
    }
  }

  // Routing handler
  handleRoute() {
    // Close mobile nav on route change
    this.toggleMobileNav(false);
    
    const hash = window.location.hash || "#/";
    
    // Split by sub-anchor (e.g. #/features#cat-dashboardBi)
    const hashParts = hash.split("#");
    let routePath = "#/";
    let anchorId = "";
    
    if (hashParts.length > 2) {
      routePath = "#" + hashParts[1];
      anchorId = hashParts[2];
    } else {
      routePath = hash;
    }
    
    // Scroll handling: only auto-scroll to top if there is no anchor
    if (!anchorId) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    // Update active nav links
    this.updateActiveNavLinks(routePath);

    // Route matches
    if (routePath === "#/") {
      this.renderHome();
    } else if (routePath === "#/features") {
      this.renderFeatures();
      if (anchorId) {
        setTimeout(() => {
          const el = document.getElementById(anchorId);
          if (el) {
            el.scrollIntoView({ behavior: "smooth" });
          }
        }, 150);
      }
    } else if (routePath.startsWith("#/features/")) {
      const parts = routePath.split("/");
      if (parts.length === 4) {
        const categoryId = parts[2];
        const moduleId = parts[3];
        this.renderModulePage(categoryId, moduleId);
      } else {
        window.location.hash = "#/features";
      }
    } else if (routePath === "#/security") {
      this.renderSecurity();
    } else if (routePath === "#/why-flow") {
      this.renderWhyFlow();
    } else if (routePath === "#/about") {
      this.renderAbout();
    } else if (routePath === "#/faq") {
      this.renderFAQ();
    } else if (routePath === "#/contact") {
      this.renderContact();
    } else if (routePath === "#/industries") {
      this.renderIndustries();
    } else if (routePath === "#/integrations") {
      this.renderIntegrations();
    } else {
      this.appElement.innerHTML = `
        <div class="container page-container" style="padding: 6rem 0; text-align: center;">
          <h2>Page Not Found</h2>
          <p style="color: var(--text-muted); margin-bottom: 2rem;">The page you are looking for does not exist or has been moved.</p>
          <a href="#/" class="btn btn-primary">Go to Home</a>
        </div>
      `;
    }
  }

  updateActiveNavLinks(hash) {
    document.querySelectorAll(".nav-link, .mobile-nav-link").forEach(link => {
      const href = link.getAttribute("href");
      if (href) {
        if (hash === href || (href !== "#/" && hash.startsWith(href))) {
          link.classList.add("active");
        } else {
          link.classList.remove("active");
        }
      }
    });
  }

  // Helper to create module dropdown HTML dynamically
  static getModuleDropdownHtml(categoryId) {
    if (!modulesData[categoryId]) return '';
    return modulesData[categoryId].modules.map(mod => `
      <a href="#/features/${categoryId}/${mod.id}" class="dropdown-item">
        <div>
          <span class="dropdown-item-title">${mod.name}</span>
          <span class="dropdown-item-desc">${mod.subtitle}</span>
        </div>
      </a>
    `).join('');
  }

  // --- PAGE RENDERING ---

  // 1. Home Page
  renderHome() {
    this.appElement.innerHTML = `
      <div class="page-container">
        <!-- Hero Section -->
        <section class="hero">
          <div class="container">
            <div class="hero-badge">OPERATIONS HUB</div>
            <h1>Restaurant Operations.<br><span>Simplified.</span></h1>
            <p class="hero-subtitle">Manage every aspect of your restaurant operations from one powerful platform. Flow helps restaurants, cafés, and hospitality businesses streamline daily activities, improve communication, and gain visibility across every branch.</p>
            <div class="btn-group">
              <a href="#/contact" class="btn btn-primary">Request a Demo</a>
            </div>
            
            <div class="hero-mockup-wrapper">
              <div class="hero-mockup-main glass-card" style="padding:0; overflow:hidden; border:1px solid var(--border-light); background:#ffffff; box-shadow:0 15px 40px rgba(0,0,0,0.06);">
                <div class="mockup-header" style="background:#f8fafc; border-bottom:1px solid var(--border-light);">
                  <div class="mockup-dots"><span></span><span></span><span></span></div>
                  <div class="mockup-title-bar" style="color:var(--text-main);">flow_operations_dashboard.app</div>
                  <div class="mockup-status-badge" style="background:rgba(59, 130, 246, 0.08); color:var(--primary); font-weight:700;">ACTIVE STATUS</div>
                </div>
                <img src="dashboard-screenshot.png" alt="Flow Operations & KPI Analytics Dashboard" style="width:100%; height:auto; display:block;">
              </div>
              <div class="hero-mockup-glow"></div>
            </div>
          </div>
        </section>

        <!-- Trusted Solution Section -->
        <section class="trust-solution-bar">
          <div class="container">
            <p class="trust-solution-text">"Designed specifically for independent restaurants and growing hospitality businesses operating between 1 and 5 branches."</p>
          </div>
        </section>

        <!-- What is Flow Section -->
        <section class="container info-split">
          <div class="info-content">
            <div class="hero-badge">THE PLATFORM</div>
            <h2>What is Flow?</h2>
            <p>Flow is a cloud-based **Restaurant Operations Management Platform** that centralizes the daily activities required to operate a successful hospitality business.</p>
            <p>Rather than replacing your accounting software or POS, Flow focuses entirely on the <strong>operational side</strong> of your business.</p>
            <p>Everything from purchasing and inventory to employees, reservations, complaints, checklists, and analytics is managed through one integrated platform.</p>
            <div class="btn-group">
              <a href="#/features" class="btn btn-primary">Explore All Modules</a>
            </div>
          </div>
          <div class="info-image">
            <div class="hero-mockup-main glass-card" style="padding:0; overflow:hidden; border:1px solid var(--border-light); background:#ffffff; box-shadow:0 10px 35px rgba(0,0,0,0.04);">
              <div class="mockup-header" style="background:#f8fafc; border-bottom:1px solid var(--border-light);">
                <div class="mockup-dots"><span></span><span></span><span></span></div>
                <div class="mockup-title-bar" style="color:var(--text-main);">flow_kpi_analytics.app</div>
              </div>
              <img src="dashboard-screenshot.png" alt="Flow KPI Dashboard Analytics" style="width:100%; height:auto; display:block;">
            </div>
          </div>
        </section>

        <!-- Why Choose Flow Section -->
        <section class="container" style="margin-bottom: 6rem;">
          <h2 style="text-align: center; margin-bottom: 1rem;">Why Choose Flow?</h2>
          <p style="text-align: center; color: var(--text-muted); max-width: 600px; margin: 0 auto 3rem auto;">Built to eliminate spreadsheets, paper logs, and chaotic communication tools.</p>
          
          <div class="features-grid">
            <div class="feature-card glass-card">
              <div class="feature-icon-wrapper">${Icons.layers}</div>
              <h3>One Platform</h3>
              <p>No more spreadsheets, paper forms, or WhatsApp groups. Centralize everything in one operational database.</p>
            </div>
            <div class="feature-card glass-card">
              <div class="feature-icon-wrapper">${Icons.trendingUp}</div>
              <h3>Real-Time Visibility</h3>
              <p>Monitor checklist completion, inventory alerts, and shift reports from one dashboard, wherever you are.</p>
            </div>
            <div class="feature-card glass-card">
              <div class="feature-icon-wrapper">${Icons.smile}</div>
              <h3>Mobile + Web</h3>
              <p>A native responsive mobile web experience for floor staff and a powerful web admin portal for management.</p>
            </div>
            <div class="feature-card glass-card">
              <div class="feature-icon-wrapper">${Icons.shield}</div>
              <h3>Secure</h3>
              <p>Zero-Knowledge client-side encryption protects sensitive employee files and financial ledger entries.</p>
            </div>
            <div class="feature-card glass-card">
              <div class="feature-icon-wrapper">${Icons.shoppingCart}</div>
              <h3>Modular Architecture</h3>
              <p>Only pay for and enable the modules your business needs. Toggle operations, inventory, or booking modules easily.</p>
            </div>
            <div class="feature-card glass-card">
              <div class="feature-icon-wrapper">${Icons.users}</div>
              <h3>Built for Hospitality</h3>
              <p>Designed specifically for independent restaurants, cafés, bakeries, and growing multi-unit brands.</p>
            </div>
          </div>
        </section>
      </div>
    `;
  }

  // 2. Features Overview Page
  renderFeatures() {
    this.appElement.innerHTML = `
      <div class="page-container container">
        <div class="features-hero">
          <div class="hero-badge">PLATFORM CAPABILITIES</div>
          <h1>Run Your Entire Restaurant from One Platform</h1>
          <p style="color: var(--text-muted); max-width: 800px; margin: 0.75rem auto 0 auto; font-size:1.1rem; line-height: 1.7;">Flow brings together every operational aspect of your business into one connected platform. From opening the restaurant to closing the last shift, every process is managed through a unified Web Admin and Mobile App.</p>
          
          <div class="search-box-container">
            <span class="search-icon">${Icons.search}</span>
            <input type="text" class="search-box" id="featureSearch" placeholder="Search modules (e.g. checklists, waste, tips, permissions)...">
          </div>
        </div>

        <div class="features-categories-container" id="categoriesContainer">
          ${Object.entries(modulesData).map(([key, cat]) => `
            <section class="category-section" id="cat-${key}" style="scroll-margin-top: 100px; border-bottom: 1px solid var(--border-light); padding-bottom: 2rem;">
              <div class="category-header" style="border-bottom:none; margin-bottom:1rem;">
                <div class="category-info">
                  <span class="module-card-subtitle" style="font-size:0.8rem; font-weight:700; color:var(--primary); text-transform:uppercase; letter-spacing:0.05em;">${cat.subtitle}</span>
                  <h2 class="category-title" style="font-size: 1.8rem; margin-top:0.25rem;">
                    <span class="feature-icon-wrapper" style="width:36px; height:36px; border-radius:8px;">
                      ${Icons[cat.icon === 'shopping-cart' ? 'shoppingCart' : cat.icon === 'trending-up' ? 'trendingUp' : cat.icon]}
                    </span>
                    ${cat.title}
                  </h2>
                  <p class="category-desc" style="font-size:1.05rem; margin-top:0.5rem; color:var(--text-muted); max-width:850px;">${cat.description}</p>
                </div>
              </div>

              <!-- Capabilities & Benefits Split -->
              <div class="glass-card" style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 3rem; margin: 1.5rem 0; padding: 1.75rem;">
                <div>
                  <h4 style="font-size: 0.95rem; margin-bottom: 0.75rem; border-bottom: 1px solid var(--border-light); padding-bottom: 0.5rem; color: var(--primary); font-weight:700; text-transform:uppercase; letter-spacing:0.03em;">Key Capabilities</h4>
                  <ul class="feature-items" style="gap: 0.5rem;">
                    ${cat.keyCapabilities.map(cap => `
                      <li style="font-size: 0.9rem;">${Icons.bullet} <span>${cap}</span></li>
                    `).join('')}
                  </ul>
                </div>
                <div>
                  <h4 style="font-size: 0.95rem; margin-bottom: 0.75rem; border-bottom: 1px solid var(--border-light); padding-bottom: 0.5rem; color: var(--success); font-weight:700; text-transform:uppercase; letter-spacing:0.03em;">Business Benefits</h4>
                  <ul class="benefit-items" style="gap: 0.5rem;">
                    ${cat.businessBenefits.map(ben => `
                      <li style="font-size: 0.9rem;">${Icons.checkCircle} <span>${ben}</span></li>
                    `).join('')}
                  </ul>
                </div>
              </div>

              ${cat.isStatic ? `
                <div style="margin-top: 2rem;">
                  <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1.5rem;">
                    <a href="${cat.link}" class="btn btn-secondary btn-sm" style="border-radius:50px;">Go to ${cat.title} details &rarr;</a>
                    
                    ${key === 'mobileApp' ? `
                      <!-- Mobile app mockup frame preview -->
                      <div class="mockup-window" style="max-width: 300px; width:100%; border-radius: 36px; border: 8px solid #0f172a; box-shadow: 0 10px 25px rgba(0,0,0,0.06); overflow: hidden; margin: 1rem auto 0 auto;">
                        <div style="background: #0f172a; height: 22px; display: flex; justify-content: center; align-items: center; color: #fff; font-size: 0.65rem; font-weight: 700; font-family: sans-serif;">
                          <div style="width: 50px; height: 10px; background: #000; border-radius: 5px; margin: 0 auto;"></div>
                        </div>
                        <div style="padding: 0.75rem; background: #f8fafc; min-height: 280px; display: flex; flex-direction: column; gap: 0.75rem; color:#0f172a;">
                          <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.7rem; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.4rem;">
                            <strong style="color:var(--primary); font-weight:800;">Flow App</strong>
                            <span style="background:rgba(16, 185, 129, 0.1); padding:0.1rem 0.3rem; border-radius:4px; font-size:0.55rem; color:#10b981; font-weight:700;">Shift Logged In</span>
                          </div>
                          
                          <div style="background:#ffffff; border:1px solid rgba(0,0,0,0.06); border-radius:6px; padding:0.5rem;">
                            <div style="font-size:0.65rem; font-weight:700; display:flex; justify-content:space-between;">
                              <span>checklists progress</span>
                              <span style="color:#10b981;">80%</span>
                            </div>
                            <div style="display:flex; flex-direction:column; gap:0.25rem; margin-top:0.4rem;">
                              <div style="background:rgba(16, 185, 129, 0.05); font-size:0.6rem; padding:0.25rem; border-radius:4px; color:#4b5563; text-decoration:line-through;">[x] Verify walk-in fridge temp</div>
                              <div style="background:#f8fafc; font-size:0.6rem; padding:0.25rem; border-radius:4px; color:#4b5563;">[ ] Count register cash ($200 float)</div>
                            </div>
                          </div>
                          
                          <div style="background:#ffffff; border:1px solid rgba(0,0,0,0.06); border-radius:6px; padding:0.5rem; font-size:0.6rem;">
                            <strong>Latest Bulletin News:</strong>
                            <p style="color:#4b5563; margin-top:0.2rem;">Chef Marco: 'Smash Cheeseburger recipe updated. Allergen tags added.'</p>
                          </div>
                        </div>
                      </div>
                    ` : ''}
                  </div>
                </div>
              ` : `
                <!-- Sub-Modules Grid -->
                <div style="margin-top: 2rem;">
                  <h4 style="font-size: 0.85rem; margin-bottom: 1rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); font-weight:700;">Included Modules</h4>
                  <div class="modules-grid">
                    ${cat.modules.map(mod => `
                      <div class="module-card" onclick="window.location.hash='#/features/${key}/${mod.id}'" style="box-shadow: 0 4px 15px rgba(0,0,0,0.02);">
                        <div class="module-card-header">
                          <span class="module-card-subtitle" style="font-size:0.75rem;">${mod.subtitle}</span>
                          <h3 class="module-card-name" style="font-size:1.15rem; margin-top:0.25rem;">${mod.name}</h3>
                          <p class="module-card-desc" style="font-size:0.85rem; color: var(--text-muted); margin-top:0.5rem; line-height: 1.5;">${mod.description.substring(0, 100)}...</p>
                        </div>
                        <div class="module-card-footer" style="font-size:0.8rem; margin-top:1rem;">
                          Explore Module &rarr;
                        </div>
                      </div>
                    `).join('')}
                  </div>
                </div>
              `}
            </section>
          `).join('')}
        </div>
      </div>
    `;

    // Hook up search filter
    const searchInput = document.getElementById("featureSearch");
    searchInput.focus();
    searchInput.addEventListener("input", (e) => {
      const query = e.target.value.toLowerCase();
      const sections = document.querySelectorAll(".category-section");
      
      sections.forEach(section => {
        const title = section.querySelector(".category-title").innerText.toLowerCase();
        const desc = section.querySelector(".category-desc").innerText.toLowerCase();
        const cards = section.querySelectorAll(".module-card");
        
        let hasCardMatch = false;
        cards.forEach(card => {
          const cardName = card.querySelector(".module-card-name").innerText.toLowerCase();
          const cardDesc = card.querySelector(".module-card-desc").innerText.toLowerCase();
          
          if (cardName.includes(query) || cardDesc.includes(query)) {
            card.style.display = "flex";
            hasCardMatch = true;
          } else {
            card.style.display = "none";
          }
        });
        
        const hasCategoryMatch = title.includes(query) || desc.includes(query);
        
        // Show section if category matches or any card matches
        if (hasCategoryMatch || hasCardMatch) {
          section.style.display = "block";
          if (hasCategoryMatch) {
            // Show all cards in that category
            cards.forEach(card => card.style.display = "flex");
          }
        } else {
          section.style.display = "none";
        }
      });
    });
  }

  // 3. Module Details Page
  renderModulePage(categoryId, moduleId) {
    const category = modulesData[categoryId];
    if (!category) {
      window.location.hash = "#/features";
      return;
    }
    
    const moduleItem = category.modules.find(m => m.id === moduleId);
    if (!moduleItem) {
      window.location.hash = "#/features";
      return;
    }

    this.appElement.innerHTML = `
      <div class="page-container container module-page">
        <div class="breadcrumb">
          <a onclick="window.location.hash='#/features'">Features</a>
          <span>/</span>
          <a onclick="window.location.hash='#/features#cat-${categoryId}'">${category.title}</a>
          <span>/</span>
          <span style="color: var(--text-main); font-weight:600;">${moduleItem.name}</span>
        </div>

        <div class="module-layout">
          <!-- Left Panel: Content -->
          <div class="module-info-panel">
            <h1>${moduleItem.name}</h1>
            <div class="subtitle">${moduleItem.subtitle}</div>
            <p class="description">${moduleItem.description}</p>
            
            <div class="features-list">
              <h3 class="section-subheading">Key Capabilities</h3>
              <ul class="feature-items">
                ${moduleItem.keyFeatures.map(feat => `
                  <li>${Icons.check} <span>${feat}</span></li>
                `).join('')}
              </ul>
            </div>

            <div class="benefits-list">
              <h3 class="section-subheading">Business Benefits</h3>
              <ul class="benefit-items">
                ${moduleItem.benefits.map(ben => `
                  <li>${Icons.checkCircle} <span>${ben}</span></li>
                `).join('')}
              </ul>
            </div>

            <div class="related-modules-section">
              <h3 class="section-subheading" style="font-size: 1.05rem; margin-bottom: 0.75rem;">Related Modules</h3>
              <div class="related-modules-list">
                ${moduleItem.related.map(relId => {
                  // Find related module details
                  let relModule = null;
                  let relCatId = '';
                  for (const [catKey, catVal] of Object.entries(modulesData)) {
                    if (!catVal.modules) continue;
                    const found = catVal.modules.find(m => m.id === relId);
                    if (found) {
                      relModule = found;
                      relCatId = catKey;
                      break;
                    }
                  }
                  
                  if (relModule) {
                    return `<span class="related-module-chip" onclick="window.location.hash='#/features/${relCatId}/${relModule.id}'">${relModule.name}</span>`;
                  }
                  
                  // Special route cross-links
                  if (relId === 'security-page') {
                    return `<span class="related-module-chip" onclick="window.location.hash='#/security'">Security Vault</span>`;
                  }
                  if (relId === 'financial-analytics') {
                    return `<span class="related-module-chip" onclick="window.location.hash='#/features/dashboardBi/financial-analytics'">Financial Analytics</span>`;
                  }
                  return '';
                }).join('')}
              </div>
            </div>
          </div>

          <!-- Right Panel: Interactive Mockup -->
          <div class="mockup-container">
            <div class="mockup-window">
              <div class="mockup-header">
                <div class="mockup-dots"><span></span><span></span><span></span></div>
                <div class="mockup-title-bar" id="mockupTitleBar">${moduleItem.name} Simulator</div>
                <div class="mockup-status-badge">DEMO WIDGET</div>
              </div>
              <div class="mockup-body" id="mockupSimulatorBody">
                <!-- Dynamic simulator HTML injected here -->
              </div>
            </div>
            <p style="text-align: center; font-size: 0.75rem; color: var(--text-muted); margin-top: 1rem;">
              Interactive Demo: Click elements inside the screen above to test operations.
            </p>
          </div>
        </div>
      </div>
    `;

    this.initModuleSimulator(moduleItem.mockupType);
  }

  // Simulator Initializers
  initModuleSimulator(type) {
    const container = document.getElementById("mockupSimulatorBody");
    if (!container) return;

    if (type === "checklists") {
      container.innerHTML = `
        <div class="sim-checklist">
          <div class="sim-checklist-progress">
            <span style="font-size: 0.8rem; font-weight:700;">Opening Checklist</span>
            <div style="display:flex; align-items:center; gap: 0.5rem;">
              <span id="chkProgressPct" style="font-size:0.8rem; font-weight:700; color:var(--success);">0%</span>
              <div class="sim-progress-bar-bg">
                <div class="sim-progress-bar-fill" id="chkProgressFill"></div>
              </div>
            </div>
          </div>
          <div class="sim-checklist-items">
            <div class="sim-checklist-item" data-id="1">
              <div class="sim-checklist-checkbox"></div>
              <span class="sim-checklist-label">Verify walk-in fridge temp is below 4°C</span>
            </div>
            <div class="sim-checklist-item" data-id="2">
              <div class="sim-checklist-checkbox"></div>
              <span class="sim-checklist-label">Check lines, prep station setup, sanitize surfaces</span>
            </div>
            <div class="sim-checklist-item" data-id="3">
              <div class="sim-checklist-checkbox"></div>
              <span class="sim-checklist-label">Verify staff health log is fully signed off</span>
            </div>
            <div class="sim-checklist-item" data-id="4">
              <div class="sim-checklist-checkbox"></div>
              <span class="sim-checklist-label">Count start-of-day register cash ($200 float)</span>
            </div>
          </div>
        </div>
      `;

      const items = container.querySelectorAll(".sim-checklist-item");
      const progressFill = document.getElementById("chkProgressFill");
      const progressPct = document.getElementById("chkProgressPct");

      const updateProgress = () => {
        const checkedCount = container.querySelectorAll(".sim-checklist-item.checked").length;
        const pct = Math.round((checkedCount / items.length) * 100);
        progressFill.style.width = `${pct}%`;
        progressPct.innerText = `${pct}%`;
      };

      items.forEach(item => {
        item.addEventListener("click", () => {
          item.classList.toggle("checked");
          updateProgress();
        });
      });

    } else if (type === "reservations") {
      container.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:1rem;">
          <div style="display:flex; justify-content:space-between; font-size:0.8rem; background:rgba(255,255,255,0.02); padding:0.5rem; border-radius:6px;">
            <span>Reservations Dashboard:</span>
            <strong style="color:var(--accent);"><span id="resCount">3</span> Table(s) Reserved</strong>
          </div>
          <div class="sim-floorplan">
            <div class="sim-table-card occupied" data-number="1">
              <span class="sim-table-number">1</span>
              <span class="sim-table-seats">4 Seats</span>
            </div>
            <div class="sim-table-card reserved" data-number="2">
              <span class="sim-table-number">2</span>
              <span class="sim-table-seats">2 Seats</span>
            </div>
            <div class="sim-table-card" data-number="3">
              <span class="sim-table-number">3</span>
              <span class="sim-table-seats">6 Seats</span>
            </div>
            <div class="sim-table-card reserved" data-number="4">
              <span class="sim-table-number">4</span>
              <span class="sim-table-seats">4 Seats</span>
            </div>
            <div class="sim-table-card occupied" data-number="5">
              <span class="sim-table-number">5</span>
              <span class="sim-table-seats">2 Seats</span>
            </div>
            <div class="sim-table-card" data-number="6">
              <span class="sim-table-number">6</span>
              <span class="sim-table-seats">4 Seats</span>
            </div>
            <div class="sim-table-card reserved" data-number="7">
              <span class="sim-table-number">7</span>
              <span class="sim-table-seats">8 Seats</span>
            </div>
            <div class="sim-table-card" data-number="8">
              <span class="sim-table-number">8</span>
              <span class="sim-table-seats">2 Seats</span>
            </div>
          </div>
          <div class="sim-floorplan-legend">
            <div class="sim-legend-item"><span class="sim-legend-dot" style="background:var(--success)"></span><span>Available</span></div>
            <div class="sim-legend-item"><span class="sim-legend-dot" style="background:var(--warning)"></span><span>Reserved</span></div>
            <div class="sim-legend-item"><span class="sim-legend-dot" style="background:var(--danger)"></span><span>Occupied</span></div>
          </div>
        </div>
      `;

      const tables = container.querySelectorAll(".sim-table-card");
      const resCountSpan = document.getElementById("resCount");

      const updateCount = () => {
        const reservedCount = container.querySelectorAll(".sim-table-card.reserved").length;
        resCountSpan.innerText = reservedCount;
      };

      tables.forEach(table => {
        table.addEventListener("click", () => {
          if (table.classList.contains("occupied")) {
            table.classList.remove("occupied");
            table.classList.add("reserved");
          } else if (table.classList.contains("reserved")) {
            table.classList.remove("reserved");
          } else {
            table.classList.add("occupied");
          }
          updateCount();
        });
      });

    } else if (type === "dashboard" || type === "financial" || type === "reports" || type === "kpis") {
      container.innerHTML = `
        <div class="sim-kpis">
          <div class="sim-kpi-card">
            <div class="sim-table-seats">Daily Food Cost %</div>
            <div class="sim-kpi-val text-green" id="kpiFoodCost">27.4%</div>
            <span style="font-size:0.7rem; color:var(--success);">Target: &lt;28%</span>
          </div>
          <div class="sim-kpi-card">
            <div class="sim-table-seats">Labor Cost Ratio</div>
            <div class="sim-kpi-val text-blue">21.8%</div>
            <span style="font-size:0.7rem; color:var(--accent);">Target: 22%</span>
          </div>
          <div class="sim-kpi-card">
            <div class="sim-table-seats">Avg Ticket Time</div>
            <div class="sim-kpi-val text-green">14m 20s</div>
            <span style="font-size:0.7rem; color:var(--success);">Speed optimized</span>
          </div>
          <div class="sim-kpi-card">
            <div class="sim-table-seats">Checked-In Staff</div>
            <div class="sim-kpi-val text-blue" id="kpiStaffCount">12 / 12</div>
            <span style="font-size:0.7rem; color:var(--accent);">All shifts active</span>
          </div>
        </div>
        <div class="sim-alerts">
          <div class="sim-alerts-title">Live Branch Selector:</div>
          <select class="sim-input" id="branchSelector" style="width:100%;">
            <option value="all">All Branches (Consolidated)</option>
            <option value="downtown">Flow Downtown Café</option>
            <option value="westside">Flow Westside Bakery</option>
          </select>
        </div>
      `;

      const branch = document.getElementById("branchSelector");
      const foodCost = document.getElementById("kpiFoodCost");
      const staff = document.getElementById("kpiStaffCount");

      branch.addEventListener("change", (e) => {
        const val = e.target.value;
        if (val === "all") {
          foodCost.innerText = "27.4%";
          foodCost.className = "sim-kpi-val text-green";
          staff.innerText = "12 / 12";
        } else if (val === "downtown") {
          foodCost.innerText = "26.1%";
          foodCost.className = "sim-kpi-val text-green";
          staff.innerText = "7 / 7";
        } else if (val === "westside") {
          foodCost.innerText = "29.8%";
          foodCost.className = "sim-kpi-val text-red"; // Out of range
          foodCost.style.color = "var(--danger)";
          staff.innerText = "5 / 5";
        }
      });

    } else if (type === "inventory" || type === "catalog" || type === "waste" || type === "purchasing" || type === "branchOrders" || type === "suppliers") {
      container.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:0.75rem;">
          <input type="text" class="sim-input" id="inventorySearch" placeholder="Filter stock catalog..." style="padding:0.4rem;">
          <table class="sim-inventory-table">
            <thead>
              <tr>
                <th>Item Name</th>
                <th>Available</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody id="inventoryTableBody">
              <tr data-name="beef patties">
                <td>Beef Patties (150g)</td>
                <td>420 units</td>
                <td><span class="sim-badge sim-badge-ok">In Stock</span></td>
              </tr>
              <tr data-name="brioche buns">
                <td>Brioche Buns</td>
                <td>12 units</td>
                <td><span class="sim-badge sim-badge-danger">86 Low</span></td>
              </tr>
              <tr data-name="fresh salmon">
                <td>Fresh Salmon (Side)</td>
                <td>8 kg</td>
                <td><span class="sim-badge sim-badge-ok">In Stock</span></td>
              </tr>
              <tr data-name="avocados">
                <td>Avocados (Box)</td>
                <td>1 box</td>
                <td><span class="sim-badge sim-badge-danger">Reorder</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      `;

      const search = document.getElementById("inventorySearch");
      const rows = container.querySelectorAll("#inventoryTableBody tr");

      search.addEventListener("input", (e) => {
        const query = e.target.value.toLowerCase();
        rows.forEach(row => {
          const name = row.getAttribute("data-name");
          if (name.includes(query)) {
            row.style.display = "";
          } else {
            row.style.display = "none";
          }
        });
      });

    } else if (type === "tips") {
      container.innerHTML = `
        <div class="sim-tip-form">
          <div class="sim-form-group">
            <label>Tip Pool Amount ($)</label>
            <input type="number" class="sim-input" id="tipPoolAmt" value="650">
          </div>
          <div class="sim-form-group">
            <label>Total Staff Hours</label>
            <input type="number" class="sim-input" id="tipHours" value="32.5">
          </div>
          <div class="sim-tip-payouts">
            <div style="font-weight:700; font-size:0.75rem; margin-bottom:0.25rem;">Split Result ($20.00 / hr):</div>
            <div class="sim-payout-row"><span>Sarah Jenkins (FOH - 12 hrs)</span><strong>$240.00</strong></div>
            <div class="sim-payout-row"><span>Marco Russo (BOH - 10 hrs)</span><strong>$200.00</strong></div>
            <div class="sim-payout-row"><span>Liam Patel (Bar - 10.5 hrs)</span><strong>$210.00</strong></div>
          </div>
        </div>
      `;

      const pool = document.getElementById("tipPoolAmt");
      const hours = document.getElementById("tipHours");
      const payoutContainer = container.querySelector(".sim-tip-payouts");

      const recalc = () => {
        const p = parseFloat(pool.value) || 0;
        const h = parseFloat(hours.value) || 0;
        const rate = h > 0 ? (p / h).toFixed(2) : 0;
        
        payoutContainer.innerHTML = `
          <div style="font-weight:700; font-size:0.75rem; margin-bottom:0.25rem;">Split Result ($${rate} / hr):</div>
          <div class="sim-payout-row"><span>Sarah Jenkins (FOH - 12 hrs)</span><strong>$${(12 * rate).toFixed(2)}</strong></div>
          <div class="sim-payout-row"><span>Marco Russo (BOH - 10 hrs)</span><strong>$${(10 * rate).toFixed(2)}</strong></div>
          <div class="sim-payout-row"><span>Liam Patel (Bar - 10.5 hrs)</span><strong>$${(10.5 * rate).toFixed(2)}</strong></div>
        `;
      };

      pool.addEventListener("input", recalc);
      hours.addEventListener("input", recalc);

    } else if (type === "sops") {
      container.innerHTML = `
        <div class="sim-sop-viewer">
          <div class="sim-sop-recipe-card">
            <div class="sim-sop-recipe-img">Classic Smash Cheeseburger</div>
            <div class="sim-sop-recipe-title">Smash Cheeseburger recipe</div>
            <div class="sim-sop-step"><strong>1. Portion</strong>: Scoop 120g of seasoned beef blend into a ball.</div>
            <div class="sim-sop-step"><strong>2. Sear</strong>: Place on 230°C hot griddle. Smash flat instantly.</div>
            <div class="sim-sop-step"><strong>3. Flip & Cheese</strong>: Cook for 90s, flip, add Cheddar slice immediately.</div>
            <div class="sim-sop-step"><strong>4. Assemble</strong>: Brioche bun, garlic aioli, pickles, patty. Serve.</div>
          </div>
        </div>
      `;
    } else if (type === "permissions" || type === "employees" || type === "departments" || type === "loginActivity") {
      container.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:0.75rem;">
          <div style="font-size:0.8rem; color:var(--text-muted);">Configure role access permissions:</div>
          <div class="sim-permission-switches">
            <div class="sim-switch-row">
              <div class="sim-switch-info">
                <span class="sim-switch-name">Edit Purchase Orders</span>
                <span class="sim-switch-desc">Allows sending vendor POs</span>
              </div>
              <div class="sim-toggle active" data-id="po"></div>
            </div>
            <div class="sim-switch-row">
              <div class="sim-switch-info">
                <span class="sim-switch-name">Approve Food Waste logs</span>
                <span class="sim-switch-desc">Manager sign-off for waste logs</span>
              </div>
              <div class="sim-toggle active" data-id="waste"></div>
            </div>
            <div class="sim-switch-row">
              <div class="sim-switch-info">
                <span class="sim-switch-name">View Financial Analytics</span>
                <span class="sim-switch-desc">Access high-level dashboards</span>
              </div>
              <div class="sim-toggle" data-id="finance"></div>
            </div>
          </div>
        </div>
      `;

      const toggles = container.querySelectorAll(".sim-toggle");
      toggles.forEach(toggle => {
        toggle.addEventListener("click", () => {
          toggle.classList.toggle("active");
        });
      });
    } else if (type === "shiftReports") {
      container.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:0.75rem;">
          <div style="font-size:0.8rem; font-weight:700; color:var(--text-main);">Daily Handover & Shift Log</div>
          <div style="background:#ffffff; border:1px solid var(--border-light); border-radius:8px; padding:0.75rem; display:flex; flex-direction:column; gap:0.5rem; font-size:0.8rem;">
            <div><strong>Shift Cash Status:</strong> <span style="color:var(--success); font-weight:700;">Balanced</span></div>
            <div><strong>Drawer Cash Out:</strong> $1,450.00 (Float: $200.00, Net Drop: $1,250.00)</div>
            <hr style="border:0; border-top:1px solid var(--border-light); margin:0.25rem 0;">
            <div><strong>Shift Notes (Shift Manager):</strong></div>
            <p style="color:var(--text-muted); font-style:italic; margin:0;">"Busy lunch rush. Grill ventilation filter needs deep cleaning tomorrow. Safe drop completed."</p>
          </div>
        </div>
      `;
    } else if (type === "tasks") {
      container.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:0.75rem;">
          <div style="font-size:0.8rem; font-weight:700; color:var(--text-main); display:flex; justify-content:space-between;">
            <span>Operational Tasks</span>
            <span style="color:var(--primary);" id="tasksRemaining">2 Remaining</span>
          </div>
          <div style="display:flex; flex-direction:column; gap:0.5rem;">
            <div class="sim-checklist-item" style="padding:0.6rem; background:#ffffff; border:1px solid var(--border-light); border-radius:6px; font-size:0.8rem; cursor:pointer;">
              <div class="sim-checklist-checkbox" style="margin-right:0.5rem;"></div>
              <span>Clean condenser coils under display fridge</span>
            </div>
            <div class="sim-checklist-item" style="padding:0.6rem; background:#ffffff; border:1px solid var(--border-light); border-radius:6px; font-size:0.8rem; cursor:pointer;">
              <div class="sim-checklist-checkbox" style="margin-right:0.5rem;"></div>
              <span>Print updated allergen tags for pastries</span>
            </div>
            <div class="sim-checklist-item checked" style="padding:0.6rem; background:#ffffff; border:1px solid var(--border-light); border-radius:6px; font-size:0.8rem; cursor:pointer;">
              <div class="sim-checklist-checkbox" style="margin-right:0.5rem;"></div>
              <span style="text-decoration:line-through; color:var(--text-muted);">Calibrate espresso machine group heads</span>
            </div>
          </div>
        </div>
      `;
      const items = container.querySelectorAll(".sim-checklist-item");
      const remaining = document.getElementById("tasksRemaining");
      const updateTasksCount = () => {
        const unchecked = container.querySelectorAll(".sim-checklist-item:not(.checked)").length;
        remaining.innerText = `${unchecked} Remaining`;
      };
      items.forEach(item => {
        item.addEventListener("click", () => {
          item.classList.toggle("checked");
          updateTasksCount();
        });
      });
    } else if (type === "news") {
      container.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:0.75rem;">
          <div style="background:#ffffff; border:1px solid var(--border-light); border-radius:8px; padding:0.75rem; display:flex; flex-direction:column; gap:0.5rem; font-size:0.8rem;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="font-weight:700; color:var(--text-main);">Menu Update: Truffle Fries</span>
              <span style="background:rgba(59, 130, 246, 0.1); color:var(--primary); font-size:0.65rem; padding:0.1rem 0.3rem; border-radius:4px; font-weight:700;">URGENT</span>
            </div>
            <p style="color:var(--text-muted); margin:0;">"Truffle aioli supplier has changed. Please ensure the new allergen logs are reviewed prior to the weekend dinner service."</p>
            <button class="btn btn-primary btn-sm" id="confirmReadBtn" style="margin-top:0.5rem; align-self:flex-start; font-size:0.7rem; border-radius:50px;">Acknowledge & Confirm Read</button>
          </div>
        </div>
      `;
      const btn = document.getElementById("confirmReadBtn");
      btn.addEventListener("click", () => {
        btn.innerText = "✓ Acknowledged";
        btn.style.background = "var(--success)";
        btn.style.borderColor = "var(--success)";
        btn.disabled = true;
      });
    } else if (type === "complaints") {
      container.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:0.75rem;">
          <div style="font-size:0.8rem; font-weight:700; color:var(--text-main);">Active Complaints Recovery Log</div>
          <div style="background:#ffffff; border:1px solid var(--border-light); border-radius:8px; padding:0.75rem; font-size:0.8rem; display:flex; flex-direction:column; gap:0.4rem; cursor:pointer;" id="complaintRecoveryCard">
            <div style="display:flex; justify-content:space-between;">
              <strong>Table 12 - Dinner Shift</strong>
              <span class="sim-badge sim-badge-danger" id="complaintStatus">Pending Resolution</span>
            </div>
            <p style="color:var(--text-muted); margin:0;">"Customer noted Salmon fillet was overcooked. Salad served cold."</p>
            <div style="font-size:0.7rem; margin-top:0.25rem;"><strong>Action:</strong> Logged refund, offered $20 voucher code.</div>
          </div>
        </div>
      `;
      const card = document.getElementById("complaintRecoveryCard");
      const status = document.getElementById("complaintStatus");
      card.addEventListener("click", () => {
        status.innerText = "✓ Resolved & Closed";
        status.className = "sim-badge sim-badge-ok";
      });
    } else if (type === "clientOrders") {
      container.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:0.75rem;">
          <div style="font-size:0.8rem; font-weight:700; color:var(--text-main); display:flex; justify-content:space-between;">
            <span>Kitchen Display System (KDS)</span>
            <span style="color:var(--accent);">Active Tickets: 2</span>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem;">
            <div style="background:#ffffff; border:1px solid var(--border-light); border-radius:6px; padding:0.5rem; font-size:0.7rem; cursor:pointer;" class="kds-ticket">
              <div style="display:flex; justify-content:space-between; font-weight:700; margin-bottom:0.25rem;">
                <span>T#4 - Ticket #1042</span>
                <span style="color:var(--danger);">12m</span>
              </div>
              <ul style="padding-left:0.75rem; margin:0; color:#4b5563;">
                <li>1x Smash Cheeseburger</li>
                <li>1x Onion Rings</li>
              </ul>
            </div>
            <div style="background:#ffffff; border:1px solid var(--border-light); border-radius:6px; padding:0.5rem; font-size:0.7rem; cursor:pointer;" class="kds-ticket">
              <div style="display:flex; justify-content:space-between; font-weight:700; margin-bottom:0.25rem;">
                <span>T#2 - Ticket #1043</span>
                <span style="color:var(--accent);">4m</span>
              </div>
              <ul style="padding-left:0.75rem; margin:0; color:#4b5563;">
                <li>1x Truffle Fries</li>
                <li>1x Diet Cola</li>
              </ul>
            </div>
          </div>
        </div>
      `;
      const tickets = container.querySelectorAll(".kds-ticket");
      tickets.forEach(ticket => {
        ticket.addEventListener("click", () => {
          ticket.style.opacity = "0.3";
          ticket.style.textDecoration = "line-through";
        });
      });
    } else if (type === "promotions") {
      container.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:0.75rem;">
          <div style="font-size:0.8rem; font-weight:700; color:var(--text-main);">Shift Upselling Guide</div>
          <div style="background:#ffffff; border:1px solid var(--border-light); border-radius:8px; padding:0.75rem; font-size:0.8rem; display:flex; flex-direction:column; gap:0.5rem;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <strong>Current Upsell Target:</strong>
              <span style="color:var(--accent); font-weight:700;">Tiramisu Dessert</span>
            </div>
            <p style="color:var(--text-muted); margin:0; font-size:0.75rem;">Prompt: "Would you like to try our signature house-made Tiramisu?"</p>
            <div style="display:flex; align-items:center; gap:0.5rem; margin-top:0.25rem;">
              <button class="btn btn-secondary btn-sm" id="upsellCountBtn" style="font-size:0.65rem; padding:0.2rem 0.6rem; border-radius:50px;">Log Successful Upsell</button>
              <strong id="upsellTotal">Success Count: 3</strong>
            </div>
          </div>
        </div>
      `;
      const btn = document.getElementById("upsellCountBtn");
      const total = document.getElementById("upsellTotal");
      let count = 3;
      btn.addEventListener("click", () => {
        count++;
        total.innerText = `Success Count: ${count}`;
      });
    } else if (type === "voids") {
      container.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:0.75rem;">
          <div style="font-size:0.8rem; font-weight:700; color:var(--text-main);">Void Receipts Auditor</div>
          <div style="display:flex; flex-direction:column; gap:0.4rem;">
            <div style="background:#ffffff; border:1px solid var(--border-light); border-radius:6px; padding:0.5rem; font-size:0.75rem; display:flex; justify-content:space-between; align-items:center;">
              <div>
                <strong>T#6 - $45.00 Voided</strong>
                <div style="color:var(--text-muted); font-size:0.65rem;">Item: Grilled Ribeye (Error)</div>
              </div>
              <span class="sim-badge sim-badge-ok">Auth: Mgr Sarah</span>
            </div>
            <div style="background:#ffffff; border:1px solid var(--border-light); border-radius:6px; padding:0.5rem; font-size:0.75rem; display:flex; justify-content:space-between; align-items:center;">
              <div>
                <strong>T#2 - $18.50 Refunded</strong>
                <div style="color:var(--text-muted); font-size:0.65rem;">Item: Cold pasta (Complaint)</div>
              </div>
              <span class="sim-badge sim-badge-ok">Auth: Mgr Sarah</span>
            </div>
            <div style="background:#ffffff; border:1px solid rgba(239,68,68,0.2); border-radius:6px; padding:0.5rem; font-size:0.75rem; display:flex; justify-content:space-between; align-items:center;">
              <div>
                <strong style="color:var(--danger);">T#9 - $85.00 Voided</strong>
                <div style="color:var(--text-muted); font-size:0.65rem;">Item: Split bill check (Unauth)</div>
              </div>
              <span class="sim-badge sim-badge-danger" style="animation:pulse 2s infinite;">No Auth Override!</span>
            </div>
          </div>
        </div>
      `;
    } else {
      container.innerHTML = `<div style="text-align:center; padding: 2rem 0; color:var(--text-muted);">Select module details to begin simulation.</div>`;
    }
  }

  // 4. Security Page
  renderSecurity() {
    this.appElement.innerHTML = `
      <div class="page-container container">
        <section class="security-intro">
          <div class="hero-badge">Zero-Knowledge Architecture</div>
          <h1>Security by Design</h1>
          <p>Flow protects your business data at every level. Sensitive employee records, salaries, and financial ledger data are encrypted on your local device before transmission.</p>
        </section>

        <section class="security-grid">
          <!-- Text Details -->
          <div>
            <div class="security-item">
              <h3>${Icons.shield} Zero-Knowledge Encryption</h3>
              <p>Sensitive data fields (such as employee ID numbers, salaries, bank codes, and contract documents) are encrypted directly in the browser or mobile application using AES-256 before being uploaded to our cloud. Flow staff cannot access or decrypt this data.</p>
            </div>
            <div class="security-item">
              <h3>${Icons.lock} Protected Ledger Entries</h3>
              <p>Daily store balances, tip details, and bank drop logs are sealed on-device, creating secure financial records that remain strictly private to authorized business stakeholders.</p>
            </div>
            <div class="security-item">
              <h3>${Icons.key} Multi-Tenant Isolation</h3>
              <p>Your business operates inside its own secure, sandboxed multi-tenant cloud environment with cryptographic boundaries, ensuring zero leaks between client organizations.</p>
            </div>
          </div>

          <!-- Interactive Encryption Visualizer -->
          <div class="zk-visualizer-container glass-card">
            <div class="zk-title">
              ${Icons.shield} Client-Side Encryption Visualizer
            </div>
            
            <div class="zk-flow-stage">
              <div class="zk-stage-title">
                <span>1. Raw Device Input (Plain Text)</span>
                <span style="color:var(--success); font-weight:700;">Secure Input</span>
              </div>
              <input type="text" class="zk-input" id="zkPlainTextInput" value="Employee Salary: $5,200.00 / mo">
            </div>

            <div class="zk-divider-arrow">
              <span>Client AES-256 Key Encryption</span>
              ${Icons.arrowDown}
            </div>

            <div class="zk-flow-stage">
              <div class="zk-stage-title">
                <span>2. Encrypted Output (Sent to Cloud)</span>
                <span style="color:var(--accent); font-weight:700;">Ciphertext</span>
              </div>
              <div class="zk-crypto-output" id="zkCiphertextOutput">U2FsdGVkX1+vGkU0eDFkM1kyV...</div>
            </div>

            <div class="zk-divider-arrow">
              <span>Cloud Storage Server DB</span>
              ${Icons.arrowDown}
            </div>

            <div class="zk-flow-stage">
              <div class="zk-stage-title">
                <span>3. Server Database Records (Stored Content)</span>
                <span style="color:var(--danger); font-weight:700;">Plain Text Invisible</span>
              </div>
              <div class="zk-db-output" id="zkServerDbOutput">{"id": 412, "data": "U2FsdGVkX1+vGkU0eDFkM1kyV..."}</div>
            </div>
          </div>
        </section>

        <!-- Additional Security Grid -->
        <section style="margin: 4rem 0 6rem 0;">
          <h2 style="text-align:center;">Enterprise Security Protocols</h2>
          <div class="sec-features-grid">
            <div class="glass-card sec-feature-card">
              <h3 style="font-size:1.15rem; margin-bottom:0.5rem; display:flex; align-items:center; gap:0.5rem;">
                ${Icons.users} Role-Based Permissions
              </h3>
              <p style="color:var(--text-muted); font-size:0.9rem;">Restrict access to specific branch managers, chefs, or floor servers, preventing data breaches or edits from the bottom up.</p>
            </div>
            <div class="glass-card sec-feature-card">
              <h3 style="font-size:1.15rem; margin-bottom:0.5rem; display:flex; align-items:center; gap:0.5rem;">
                ${Icons.activity} Detailed Audit Logs
              </h3>
              <p style="color:var(--text-muted); font-size:0.9rem;">Track every account login, checklist completion, supplier order, and waste log edit with permanent, tamper-proof logs.</p>
            </div>
            <div class="glass-card sec-feature-card">
              <h3 style="font-size:1.15rem; margin-bottom:0.5rem; display:flex; align-items:center; gap:0.5rem;">
                ${Icons.lock} Secure Authentication
              </h3>
              <p style="color:var(--text-muted); font-size:0.9rem;">Mandatory Multi-Factor Authentication (MFA) and single-session device tokens prevent unauthorized access from rogue tablets.</p>
            </div>
          </div>
        </section>
      </div>
    `;

    // Hook up ZK Visualizer logic
    const input = document.getElementById("zkPlainTextInput");
    const cipher = document.getElementById("zkCiphertextOutput");
    const db = document.getElementById("zkServerDbOutput");

    const encryptText = (str) => {
      // Simulate AES-256 base64 generation
      if (!str) return "EMPTY_INPUT";
      let b64 = btoa(unescape(encodeURIComponent(str)));
      return "U2FsdGVkX1_" + b64.substring(0, 16) + "x9F" + b64.substring(16);
    };

    const updateVisualizer = () => {
      const encrypted = encryptText(input.value);
      cipher.innerText = encrypted;
      db.innerText = `{"tenant_id": "T-894", "confidential_payload": "${encrypted}"}`;
    };

    input.addEventListener("input", updateVisualizer);
    updateVisualizer(); // initial run
  }

  // 5. Industries Page
  renderIndustries() {
    this.appElement.innerHTML = `
      <div class="page-container container">
        <section class="ind-intro">
          <div class="hero-badge">VERSATILE FIT</div>
          <h1>Built for Hospitality</h1>
          <p>Flow is customized for various types of food, beverage, and dining organizations operating one or multiple branches.</p>
        </section>

        <div class="ind-grid">
          <div class="glass-card ind-card">
            <div class="ind-icon-wrapper">${Icons.layers}</div>
            <h3>Restaurants</h3>
            <p>Full-service operations, table layouts, kitchen routing, customer complaints, and FOH/BOH communication.</p>
          </div>
          <div class="glass-card ind-card">
            <div class="ind-icon-wrapper">${Icons.smile}</div>
            <h3>Coffee Shops</h3>
            <p>Fast checklists, tip splitting tools, shift reports, and simple supplier catalog ordering.</p>
          </div>
          <div class="glass-card ind-card">
            <div class="ind-icon-wrapper">${Icons.shoppingCart}</div>
            <h3>Bakeries</h3>
            <p>Ingredient cataloging, waste management metrics, production checklist tracking, and recipes.</p>
          </div>
          <div class="glass-card ind-card">
            <div class="ind-icon-wrapper">${Icons.users}</div>
            <h3>Central Kitchens</h3>
            <p>Branch requisitions management, internal orders, dispatch notes, bulk purchasing, and production specs.</p>
          </div>
          <div class="glass-card ind-card">
            <div class="ind-icon-wrapper">${Icons.trendingUp}</div>
            <h3>Sushi & Pizza Concepts</h3>
            <p>Fast ticket-time metrics, hygiene checklists, supplier orders, and detailed cost-out tracking.</p>
          </div>
          <div class="glass-card ind-card">
            <div class="ind-icon-wrapper">${Icons.activity}</div>
            <h3>Catering Companies</h3>
            <p>SOP recipes checklist, event staff permissions, inventory reorders, and custom BI reports.</p>
          </div>
        </div>
      </div>
    `;
  }

  // 6. Why Not ERP Page
  renderWhyFlow() {
    this.appElement.innerHTML = `
      <div class="page-container container">
        <section class="erp-intro">
          <div class="hero-badge">FLOW VS ERP</div>
          <h1>Why Not an ERP?</h1>
          <p style="color:var(--text-muted); max-width:600px; margin: 0.5rem auto 0 auto;">Enterprise Resource Planning (ERP) systems are heavy, complex, and expensive. Flow is built specifically for growing restaurant groups.</p>
        </section>

        <section class="erp-comparison">
          <table class="erp-table">
            <thead>
              <tr>
                <th>Factor</th>
                <th>Traditional ERP</th>
                <th style="color:var(--primary); border-left:1px solid var(--border-glow); border-right:1px solid var(--border-glow);">Flow Operations Platform</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Implementation</strong></td>
                <td>6 to 12 months. Requires consulting.</td>
                <td style="color:var(--text-main); border-left:1px solid var(--border-glow); border-right:1px solid var(--border-glow);"><strong>Under 2 weeks. Self-serve onboarding.</strong></td>
              </tr>
              <tr>
                <td><strong>Capital Costs</strong></td>
                <td>$50,000+ setup plus high yearly maintenance.</td>
                <td style="color:var(--text-main); border-left:1px solid var(--border-glow); border-right:1px solid var(--border-glow);"><strong>Simple, affordable monthly SaaS subscriptions.</strong></td>
              </tr>
              <tr>
                <td><strong>Complexity</strong></td>
                <td>High. Staff requires weeks of training.</td>
                <td style="color:var(--text-main); border-left:1px solid var(--border-glow); border-right:1px solid var(--border-glow);"><strong>Extremely simple mobile UX, setup in minutes.</strong></td>
              </tr>
              <tr>
                <td><strong>Focus</strong></td>
                <td>General manufacturing, finance, HR, logistics.</td>
                <td style="color:var(--text-main); border-left:1px solid var(--border-glow); border-right:1px solid var(--border-glow);"><strong>100% focused on restaurant operations.</strong></td>
              </tr>
              <tr>
                <td><strong>Flexibility</strong></td>
                <td>Rigid workflow. Changes require developers.</td>
                <td style="color:var(--text-main); border-left:1px solid var(--border-glow); border-right:1px solid var(--border-glow);"><strong>Modular setup. Toggle only the features you need.</strong></td>
              </tr>
            </tbody>
          </table>
        </s        <!-- Interactive Cost / Time Estimator -->
        <section class="erp-estimator glass-card">
          <div class="erp-est-controls">
            <h2>Implementation Cost Estimator</h2>
            <p style="color:var(--text-muted); font-size:0.95rem;">Drag the slider below to calculate setup, training, and monthly costs based on your brand size.</p>
            
            <div class="slider-group">
              <label>
                <span>Number of Branches</span>
                <span id="slideBranchVal">3 Branches</span>
              </label>
              <input type="range" min="1" max="10" value="3" class="est-slider" id="sliderBranches">
            </div>
          </div>

          <div class="erp-est-results">
            <div class="est-result-item">
              <span class="est-result-label">Estimated Setup Duration</span>
              <div class="est-result-val" id="estDuration">1 Week</div>
              <span style="font-size:0.75rem; color:var(--text-muted);">ERP equivalent: 8 Months</span>
            </div>
            <div class="est-result-item">
              <span class="est-result-label">Implementation Costs (Setup + Training)</span>
              <div class="est-result-val" id="estCost">$1,200</div>
              <span style="font-size:0.75rem; color:var(--text-muted);" id="trainingSubtext">Flat $600 setup + $200 per branch training</span>
            </div>
            <div class="est-result-item">
              <span class="est-result-label">Monthly SaaS Subscription</span>
              <div class="est-result-val" id="estMonthly">$150 / mo</div>
              <span style="font-size:0.75rem; color:var(--text-muted);">$50 per branch per month</span>
            </div>
            <div class="est-result-item">
              <span class="est-result-label">Time to Value</span>
              <div class="est-result-val" style="background:var(--gradient-brand); -webkit-background-clip:text; -webkit-text-fill-color:transparent;">Immediate</div>
            </div>
          </div>
        </section>
      </div>
    `;

    // Hook up estimator sliders
    const slideBranches = document.getElementById("sliderBranches");
    const labelBranches = document.getElementById("slideBranchVal");
    
    const estDuration = document.getElementById("estDuration");
    const estCost = document.getElementById("estCost");
    const estMonthly = document.getElementById("estMonthly");
    const trainingSubtext = document.getElementById("trainingSubtext");

    const updateEstimates = () => {
      const branches = parseInt(slideBranches.value);

      labelBranches.innerText = `${branches} ${branches === 1 ? 'Branch' : 'Branches'}`;

      const setupCost = 600;
      const trainingCost = 200 * branches;
      const totalCost = setupCost + trainingCost;
      const monthlyCost = 50 * branches;
      const trainingDays = 2 * branches;

      estCost.innerText = `$${totalCost.toLocaleString()}`;
      estMonthly.innerText = `$${monthlyCost.toLocaleString()} / mo`;
      
      // Update help text underneath to show exact training days
      trainingSubtext.innerText = `Flat $600 setup + $200 per branch (${trainingDays} Days of training)`;
    };

    slideBranches.addEventListener("input", updateEstimates);
    updateEstimates(); // initial run
  }

  // 7. About Page
  renderAbout() {
    this.appElement.innerHTML = `
      <div class="page-container container">
        <section class="about-intro">
          <div class="hero-badge">OUR STORY</div>
          <h1>About Flow</h1>
          <p style="color:var(--text-muted); max-width:600px; margin: 0.5rem auto 0 auto;">Simplifying operational management to build resilient, profitable restaurant brands.</p>
        </section>

        <section class="about-story">
          <h2>The Flow Story</h2>
          <p>Founded by restaurant managers and software engineers, Flow was born out of operational frustration. We spent years copy-pasting spreadsheet templates, logging waste notes on cardboard slips, and maintaining chaotic WhatsApp threads to manage restaurant shifts.</p>
          <p>We realized that while point-of-sale systems track sales numbers, and accounting tools handle taxes, there was no centralized platform to coordinate the daily operational tasks that actually generate customer satisfaction and maintain consistency.</p>
        </section>

        <div class="about-vision-mission">
          <div class="glass-card">
            <h3 style="font-size:1.4rem; margin-bottom:1rem; color:var(--primary);">Our Mission</h3>
            <p style="color:var(--text-muted); font-size:0.95rem;">To empower independent restaurant operators with enterprise-grade management utilities, making daily restaurant operations organized, clear, and paperless.</p>
          </div>
          <div class="glass-card">
            <h3 style="font-size:1.4rem; margin-bottom:1rem; color:var(--accent);">Our Vision</h3>
            <p style="color:var(--text-muted); font-size:0.95rem;">To be the default operational operating system for hospitality businesses globally, connecting inventory, teams, and analytics in a secure, zero-knowledge ecosystem.</p>
          </div>
        </div>

        <section class="about-values-section">
          <h2>Our Core Values</h2>
          <div class="about-values-grid">
            <div class="value-card">
              <h3>Modular Simplicity</h3>
              <p>Keep interfaces simple. Enable only what you need. Prevent system fatigue.</p>
            </div>
            <div class="value-card">
              <h3>Data Sovereignty</h3>
              <p>Zero-Knowledge design ensures business information belongs only to owners.</p>
            </div>
            <div class="value-card">
              <h3>Hospitality First</h3>
              <p>Design tools that adapt to the fast speed of kitchen and floor teams.</p>
            </div>
            <div class="value-card">
              <h3>Continuous Evolution</h3>
              <p>Deploy weekly improvements and integrations to support restaurant growth.</p>
            </div>
          </div>
        </section>
      </div>
    `;
  }

  // 8. FAQ Page
  renderFAQ() {
    this.appElement.innerHTML = `
      <div class="page-container container">
        <section class="faq-intro">
          <div class="hero-badge">COMMON INQUIRIES</div>
          <h1>Frequently Asked Questions</h1>
          <p>Have questions about Flow? Find answers to commonly asked questions below.</p>
        </section>

        <div class="faq-container">
          <div class="faq-card">
            <div class="faq-header">
              <h3>Does Flow replace my POS?</h3>
              <span class="faq-toggle-icon">${Icons.arrowDown}</span>
            </div>
            <div class="faq-body">
              <div class="faq-content">
                No. Flow complements your existing POS by managing the operational side of your business. Your POS handles cash registers and sales invoicing, while Flow manages checklists, supplier orders, employee files, food waste, and internal logs.
              </div>
            </div>
          </div>

          <div class="faq-card">
            <div class="faq-header">
              <h3>Can Flow manage multiple branches?</h3>
              <span class="faq-toggle-icon">${Icons.arrowDown}</span>
            </div>
            <div class="faq-body">
              <div class="faq-content">
                Yes. Flow is specifically optimized for hospitality businesses operating between one and five branches. You can toggle branch filters on the dashboard to view individual analytics or consolidated performance metrics.
              </div>
            </div>
          </div>

          <div class="faq-card">
            <div class="faq-header">
              <h3>Is my data secure?</h3>
              <span class="faq-toggle-icon">${Icons.arrowDown}</span>
            </div>
            <div class="faq-body">
              <div class="faq-content">
                Yes. Sensitive employee profiles, contract details, and financial logs are protected using client-side Zero-Knowledge encryption with AES-256. This means fields are encrypted on your local phone or tablet before reaching the cloud, ensuring even Flow administrators cannot read your sensitive information.
              </div>
            </div>
          </div>

          <div class="faq-card">
            <div class="faq-header">
              <h3>Can I disable modules I don't need?</h3>
              <span class="faq-toggle-icon">${Icons.arrowDown}</span>
            </div>
            <div class="faq-body">
              <div class="faq-content">
                Yes. Flow is modular by design. You can toggle features on/off under settings (e.g. if you only need checklists and supplier logs, you can hide the reservation and tip split modules to keep the UI clean).
              </div>
            </div>
          </div>

          <div class="faq-card">
            <div class="faq-header">
              <h3>Is Flow cloud-based?</h3>
              <span class="faq-toggle-icon">${Icons.arrowDown}</span>
            </div>
            <div class="faq-body">
              <div class="faq-content">
                Yes. Flow is hosted on secure cloud infrastructure and is accessible via any web browser on desktop, laptop, tablet, or mobile phone.
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Hook up Accordion behaviors
    document.querySelectorAll(".faq-header").forEach(header => {
      header.addEventListener("click", () => {
        const card = header.parentElement;
        const body = card.querySelector(".faq-body");
        const isOpen = card.classList.contains("open");
        
        // Close all other open accordions
        document.querySelectorAll(".faq-card").forEach(c => {
          c.classList.remove("open");
          c.querySelector(".faq-body").style.maxHeight = null;
        });

        if (!isOpen) {
          card.classList.add("open");
          body.style.maxHeight = body.scrollHeight + "px";
        }
      });
    });
  }

  // 9. Contact Page
  renderContact() {
    this.appElement.innerHTML = `
      <div class="page-container container contact-container">
        <!-- Left Panel: Info -->
        <div class="contact-info-panel">
          <div class="hero-badge">GET IN TOUCH</div>
          <h1>Let's Connect</h1>
          <p>Book a demo or online presentation with our solutions engineers to see how Flow can optimize your restaurant operations.</p>
          
          <div class="contact-methods">
            <div class="contact-method">
              <div class="contact-method-icon">${Icons.smile}</div>
              <div class="contact-method-details">
                <h4>General Inquiries</h4>
                <p><a href="mailto:hello@flow-ops.app" style="color:inherit; text-decoration:none;">hello@flow-ops.app</a></p>
              </div>
            </div>
            <div class="contact-method">
              <div class="contact-method-icon">${Icons.activity}</div>
              <div class="contact-method-details">
                <h4>Support Center</h4>
                <p><a href="mailto:support@flow-ops.app" style="color:inherit; text-decoration:none;">support@flow-ops.app</a></p>
              </div>
            </div>
            <div class="contact-method">
              <div class="contact-method-icon">${Icons.phone}</div>
              <div class="contact-method-details">
                <h4>Phone Support</h4>
                <p><a href="tel:+96103361515" style="color:inherit; text-decoration:none;">+961-03361515</a></p>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Panel: Form -->
        <div class="contact-form-panel">
          <div class="form-success-message" id="formSuccess">
            <div class="form-success-icon">${Icons.check}</div>
            <h3>Thank You!</h3>
            <p style="color:var(--text-muted); margin-top: 0.5rem;">Your demo request has been received. One of our restaurant solutions engineers will contact you within 24 hours.</p>
            <a href="#/" class="btn btn-secondary btn-sm" style="margin-top: 1.5rem;">Return Home</a>
          </div>

          <form class="contact-form" id="contactForm" onsubmit="return false;">
            <div class="form-row">
              <div class="form-group">
                <label for="fullName">Full Name</label>
                <input type="text" class="form-input" id="fullName" required placeholder="John Doe">
              </div>
              <div class="form-group">
                <label for="email">Work Email</label>
                <input type="email" class="form-input" id="email" required placeholder="john@restaurant.com">
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label for="restaurantName">Restaurant Brand</label>
                <input type="text" class="form-input" id="restaurantName" required placeholder="Flow Coffee Co.">
              </div>
              <div class="form-group">
                <label for="branchesCount">Number of Branches</label>
                <select class="form-select" id="branchesCount">
                  <option value="1">1 Branch</option>
                  <option value="2-3">2 - 3 Branches</option>
                  <option value="4-5">4 - 5 Branches</option>
                  <option value="5+">More than 5 branches</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label for="interest">Primary Module Interest</label>
              <select class="form-select" id="interest">
                <option value="all">All-in-One Platform</option>
                <option value="checklists">Daily Checklists & SOPs</option>
                <option value="inventory">Inventory & Ordering</option>
                <option value="people">Staff Management & Tips</option>
                <option value="reservations">Table Reservations</option>
              </select>
            </div>

            <div class="form-group">
              <label for="message">Message (Optional)</label>
              <textarea class="form-input" id="message" placeholder="Tell us about your operations..."></textarea>
            </div>

            <button type="submit" class="btn btn-primary" id="btnSubmitDemo">Request Demo & Presentation</button>
          </form>
        </div>
      </div>
    `;

    // Hook up form submission
    const form = document.getElementById("contactForm");
    const successDiv = document.getElementById("formSuccess");
    
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      // Animate transition to success
      form.style.display = "none";
      successDiv.style.display = "block";
    });
  }

  // 10. Future Integrations Page
  renderIntegrations() {
    this.appElement.innerHTML = `
      <div class="page-container container">
        <section class="int-intro">
          <div class="hero-badge">DEVELOPER ROADMAP</div>
          <h1>Integrations Ecosystem</h1>
          <p>Flow is built as a central database. We are continually building hooks to connect Flow to your existing restaurant technology stack.</p>
        </section>

        <div class="int-grid">
          <div class="int-card">
            <div class="int-icon">${Icons.shoppingCart}</div>
            <h3>Accounting Software</h3>
            <p>Push cost of goods sold (COGS), waste values, and tip split adjustments directly into Xero, Sage, or QuickBooks.</p>
          </div>
          <div class="int-card">
            <div class="int-icon">${Icons.layers}</div>
            <h3>POS System Bridges</h3>
            <p>Synchronize live sales figures against labor costs, and automatically block out items on menu boards when catalog stocks are marked 86ed.</p>
          </div>
          <div class="int-card">
            <div class="int-icon">${Icons.smile}</div>
            <h3>WhatsApp Notifications</h3>
            <p>Broadcast shift reminders, roster updates, or emergency news feeds directly through staff WhatsApp groups.</p>
          </div>
          <div class="int-card">
            <div class="int-icon">${Icons.users}</div>
            <h3>Email Notifications</h3>
            <p>Schedule automatic PDF reports to be emailed weekly to investors, store managers, and accounting departments.</p>
          </div>
          <div class="int-card">
            <div class="int-icon">${Icons.activity}</div>
            <h3>AI Operational Insights</h3>
            <p>Leverage machine learning to predict stock order sizes based on upcoming weather patterns and historic booking trends.</p>
          </div>
          <div class="int-card">
            <div class="int-icon">${Icons.trendingUp}</div>
            <h3>BI Enhancements</h3>
            <p>Advanced custom metrics, multi-unit benchmarks, and customizable executive summaries templates.</p>
          </div>
        </div>
      </div>
    `;
  }
}

// Instantiate the application
document.addEventListener("DOMContentLoaded", () => {
  window.app = new FlowApp();
});
