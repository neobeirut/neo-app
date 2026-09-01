import React from 'react';
import { Shield, Check, Lock, Building, Users, Server, Smartphone, Bell, ChevronRight, Mail, Globe, ArrowLeft } from 'lucide-react';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-4xl mx-auto">
        
        {/* Top Breadcrumb / Back */}
        <div className="mb-6">
          <a
            href="/"
            className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Flow
          </a>
        </div>

        {/* Header Hero */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-8 sm:p-10 mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold uppercase tracking-wider mb-4">
            <Shield className="w-3.5 h-3.5" />
            Legal & Compliance
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-3">
            Privacy Policy
          </h1>
          <div className="inline-flex items-center gap-2 text-sm text-slate-500 font-medium bg-slate-100 px-3 py-1.5 rounded-lg mb-6">
            <span>Effective Date: <strong>01/08/2026</strong></span>
          </div>
          <div className="space-y-3 text-slate-600 text-base leading-relaxed border-t border-slate-100 pt-6">
            <p>
              Flow (&quot;Flow&quot;, &quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) provides a digital operations management platform designed for restaurants, cafés, hospitality businesses, and multi-location organizations.
            </p>
            <p>
              This Privacy Policy explains how information is collected, used, stored, and protected when users access the Flow mobile application, web application, website, and related services.
            </p>
            <p className="font-semibold text-slate-800">
              By using Flow, you acknowledge the practices described in this Privacy Policy.
            </p>
          </div>
        </div>

        {/* Policy Content Sections */}
        <div className="space-y-6">

          {/* Section 1 */}
          <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-8">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100 mb-6">
              <span className="w-8 h-8 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center text-sm shadow-sm">
                1
              </span>
              <h2 className="text-xl font-bold text-slate-900">Information We Collect</h2>
            </div>
            <p className="text-slate-600 mb-6">
              The information collected through Flow depends on the features used by your organization.
            </p>

            <div className="space-y-6">
              <div>
                <h3 className="text-base font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-600" />
                  Account and User Information
                </h3>
                <p className="text-sm text-slate-500 mb-3">We may collect information such as:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {['Name', 'Email address', 'Phone number', 'Employee identification information', 'Job title or position', 'Department', 'Branch or location', 'User role and permissions', 'Login and authentication information'].map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm bg-slate-50 border border-slate-100 px-3 py-2 rounded-lg text-slate-700 font-medium">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-600 flex-shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-base font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <Building className="w-4 h-4 text-blue-600" />
                  Employee and Workforce Information
                </h3>
                <p className="text-sm text-slate-500 mb-3">Organizations using Flow may enter or generate employee-related information, including:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                  {['Work schedules', 'Shift assignments', 'Punch-in and punch-out records', 'Attendance records', 'Hours worked', 'Payroll-related information', 'Salary or wage information', 'Approved payable amounts', 'Leave or absence information', 'Tasks and responsibilities'].map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm text-slate-700">
                      <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
                <div className="bg-slate-50 border-l-4 border-blue-500 p-3 rounded-r-lg text-xs text-slate-600 italic">
                  This information is generally provided or managed by the organization employing or managing the user.
                </div>
              </div>

              <div>
                <h3 className="text-base font-semibold text-slate-900 mb-3">Operational Information</h3>
                <p className="text-sm text-slate-500 mb-3">Flow may process business information entered by users, including:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {['Purchase requests', 'Supplier information', 'Inventory information', 'Stock counts', 'Inter-branch orders', 'Production information', 'Waste records', 'Daily cash information', 'Checklists', 'Tasks', 'Internal announcements', 'Missing or unavailable items', 'Recipes and menu information', 'Customer complaints', 'Reservations', 'Operational reports', 'Performance indicators'].map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm bg-slate-50 border border-slate-100 px-3 py-2 rounded-lg text-slate-700">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 flex-shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-base font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-blue-600" />
                  Device and Technical Information
                </h3>
                <p className="text-sm text-slate-500 mb-3">When Flow is used, we may automatically collect certain technical information, such as:</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                  {['Device type', 'Operating system', 'App version', 'IP address', 'Device identifiers', 'Login activity', 'Error & diagnostic', 'App usage info'].map((item, idx) => (
                    <div key={idx} className="text-xs bg-slate-50 border border-slate-100 px-2.5 py-2 rounded-md text-slate-600 font-medium text-center">
                      {item}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-500">This information helps us maintain, secure, and improve the service.</p>
              </div>

              <div>
                <h3 className="text-base font-semibold text-slate-900 mb-2 flex items-center gap-2">
                  <Bell className="w-4 h-4 text-blue-600" />
                  Push Notifications
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed mb-2">
                  If push notifications are enabled, Flow may process a device notification token in order to send operational alerts, updates, tasks, announcements, or other relevant notifications.
                </p>
                <p className="text-xs text-slate-500">Users may disable push notifications through their device settings.</p>
              </div>
            </div>
          </section>

          {/* Section 2 */}
          <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-8">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100 mb-6">
              <span className="w-8 h-8 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center text-sm shadow-sm">
                2
              </span>
              <h2 className="text-xl font-bold text-slate-900">How We Use Information</h2>
            </div>
            <p className="text-slate-600 mb-4">We use information collected through Flow to:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-6">
              {[
                'Provide and operate the Flow platform',
                'Authenticate users',
                'Manage organizations, branches, employees, and permissions',
                'Process operational workflows',
                'Track attendance and working hours',
                'Support scheduling and payroll-related workflows',
                'Manage purchasing, inventory, suppliers, production, and waste',
                'Deliver tasks, notifications, and internal communications',
                'Generate dashboards and reports',
                'Maintain security and prevent unauthorized access',
                'Diagnose technical problems',
                'Improve the performance and functionality of Flow',
                'Provide customer and technical support',
                'Comply with applicable legal obligations'
              ].map((item, idx) => (
                <div key={idx} className="flex items-start gap-2.5 text-sm text-slate-700">
                  <Check className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm font-semibold flex items-center gap-2">
              <Shield className="w-5 h-5 flex-shrink-0 text-emerald-600" />
              <span>We do not sell personal information to advertisers.</span>
            </div>
          </section>

          {/* Section 3 */}
          <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-8">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100 mb-6">
              <span className="w-8 h-8 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center text-sm shadow-sm">
                3
              </span>
              <h2 className="text-xl font-bold text-slate-900">Information Provided by Your Organization</h2>
            </div>
            <div className="space-y-3 text-slate-600 text-sm leading-relaxed">
              <p>Flow is primarily a business operations platform.</p>
              <p>In many cases, the restaurant, company, employer, or organization using Flow determines which employees are registered, what information is entered into the system, which modules are activated, and which users may access that information.</p>
              <p>Where applicable, your organization may be responsible for determining how employee or business information is processed through Flow.</p>
              <p>Questions regarding information entered by your employer or organization may therefore need to be directed to that organization.</p>
            </div>
          </section>

          {/* Section 4 */}
          <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-8">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100 mb-6">
              <span className="w-8 h-8 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center text-sm shadow-sm">
                4
              </span>
              <h2 className="text-xl font-bold text-slate-900">How We Share Information</h2>
            </div>
            <p className="text-slate-600 mb-4 font-medium">We do not sell personal information.</p>
            <p className="text-slate-600 mb-4 text-sm">Information may be shared only when reasonably necessary to operate and provide Flow, including with:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
              {[
                'Authorized users within your organization',
                'System administrators designated by your organization',
                'Hosting and cloud infrastructure providers',
                'Database and storage providers',
                'Notification service providers',
                'Analytics, monitoring, and technical service providers',
                'Professional advisers where required',
                'Government or regulatory authorities where disclosure is legally required'
              ].map((item, idx) => (
                <div key={idx} className="flex items-start gap-2 text-sm text-slate-700">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500 italic">
              Service providers are permitted to process information only as necessary to provide their services to us.
            </p>
          </section>

          {/* Section 5 */}
          <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-8">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100 mb-6">
              <span className="w-8 h-8 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center text-sm shadow-sm">
                5
              </span>
              <h2 className="text-xl font-bold text-slate-900">Access Within an Organization</h2>
            </div>
            <div className="space-y-3 text-slate-600 text-sm leading-relaxed">
              <p>Access to information within Flow may depend on the user&apos;s role, department, branch, and permissions.</p>
              <p>For example, an employee may only see information relevant to their work, while managers or administrators may have access to employee attendance, schedules, payroll information, purchasing information, reports, or other administrative data.</p>
              <p className="font-medium text-slate-800">The organization is responsible for assigning appropriate user permissions.</p>
            </div>
          </section>

          {/* Section 6 */}
          <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-8">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100 mb-6">
              <span className="w-8 h-8 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center text-sm shadow-sm">
                6
              </span>
              <h2 className="text-xl font-bold text-slate-900">Data Security</h2>
            </div>
            <p className="text-slate-600 text-sm mb-4">We use reasonable technical and organizational safeguards designed to protect information against:</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
              {['Unauthorized access', 'Loss', 'Misuse', 'Disclosure', 'Alteration', 'Destruction'].map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-slate-50 border border-slate-100 px-3 py-2 rounded-lg text-xs font-semibold text-slate-700">
                  <Lock className="w-3.5 h-3.5 text-blue-600" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <div className="space-y-3 text-slate-600 text-sm leading-relaxed">
              <p>These measures may include access controls, authentication mechanisms, encrypted communications, secure infrastructure, monitoring, and restricted administrative access.</p>
              <p>However, no electronic storage or transmission system can be guaranteed to be completely secure.</p>
              <p className="font-semibold text-slate-800 bg-slate-50 p-3 rounded-lg border border-slate-100">
                Users are responsible for keeping their authentication credentials and PINs confidential.
              </p>
            </div>
          </section>

          {/* Section 7 */}
          <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-8">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100 mb-6">
              <span className="w-8 h-8 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center text-sm shadow-sm">
                7
              </span>
              <h2 className="text-xl font-bold text-slate-900">Data Retention</h2>
            </div>
            <p className="text-slate-600 text-sm mb-3">We retain information for as long as reasonably necessary to:</p>
            <div className="space-y-2 mb-4">
              {[
                'Provide the Flow service',
                'Maintain an organization\'s account',
                'Fulfill the purposes described in this Privacy Policy',
                'Meet contractual requirements',
                'Resolve disputes',
                'Maintain legitimate business records',
                'Comply with legal obligations'
              ].map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm text-slate-700">
                  <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              When an organization terminates its use of Flow, information may be deleted or anonymized after an appropriate retention period, subject to applicable legal and contractual requirements.
            </p>
          </section>

          {/* Section 8 */}
          <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-8">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100 mb-6">
              <span className="w-8 h-8 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center text-sm shadow-sm">
                8
              </span>
              <h2 className="text-xl font-bold text-slate-900">User Rights</h2>
            </div>
            <p className="text-slate-600 text-sm mb-3">
              Depending on your country and applicable privacy laws, you may have certain rights regarding your personal information, including the right to:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
              {[
                'Request access to your personal information',
                'Request correction of inaccurate information',
                'Request deletion of certain personal information',
                'Request restriction of certain processing',
                'Object to certain processing',
                'Request a copy of certain information'
              ].map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm text-slate-700">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <div className="space-y-2 text-xs text-slate-500">
              <p>Where information is controlled by your employer or organization, we may direct your request to the appropriate organization.</p>
              <p>To submit a privacy request directly to Flow, contact us using the information provided below.</p>
            </div>
          </section>

          {/* Section 9 */}
          <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-8">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100 mb-6">
              <span className="w-8 h-8 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center text-sm shadow-sm">
                9
              </span>
              <h2 className="text-xl font-bold text-slate-900">Account Deletion</h2>
            </div>
            <div className="space-y-3 text-slate-600 text-sm leading-relaxed">
              <p>Organizations or authorized administrators may request deletion of an account or associated information by contacting Flow support.</p>
              <p>Individual users may also contact us regarding deletion requests.</p>
              <p className="text-xs text-slate-500">
                Certain information may need to be retained where required by law, for legitimate business purposes, security, fraud prevention, accounting, contractual obligations, or dispute resolution.
              </p>
            </div>
          </section>

          {/* Section 10 */}
          <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-8">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100 mb-6">
              <span className="w-8 h-8 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center text-sm shadow-sm">
                10
              </span>
              <h2 className="text-xl font-bold text-slate-900">Children&apos;s Privacy</h2>
            </div>
            <div className="space-y-3 text-slate-600 text-sm leading-relaxed">
              <p>Flow is a professional business operations platform and is not designed or intended for children.</p>
              <p>We do not knowingly collect personal information directly from children under the minimum age permitted by applicable law for use of the service.</p>
              <p>If we become aware that personal information from a child has been collected improperly, we will take reasonable steps to remove it.</p>
            </div>
          </section>

          {/* Section 11 */}
          <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-8">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100 mb-6">
              <span className="w-8 h-8 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center text-sm shadow-sm">
                11
              </span>
              <h2 className="text-xl font-bold text-slate-900">International Data Processing</h2>
            </div>
            <div className="space-y-3 text-slate-600 text-sm leading-relaxed">
              <p>Flow and its service providers may process or store information in countries other than the country where the user or organization is located.</p>
              <p>Where required, appropriate measures are used to protect personal information when it is transferred internationally.</p>
            </div>
          </section>

          {/* Section 12 */}
          <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-8">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100 mb-6">
              <span className="w-8 h-8 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center text-sm shadow-sm">
                12
              </span>
              <h2 className="text-xl font-bold text-slate-900">Third-Party Services</h2>
            </div>
            <p className="text-slate-600 text-sm mb-4">Flow may rely on third-party infrastructure or technology providers to provide services such as:</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
              {['Cloud hosting', 'Database services', 'Authentication', 'Push notifications', 'Application monitoring', 'Email communications'].map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-slate-50 border border-slate-100 px-3 py-2 rounded-lg text-xs font-semibold text-slate-700">
                  <Server className="w-3.5 h-3.5 text-blue-600" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <div className="space-y-2 text-xs text-slate-500">
              <p>Those providers may process limited information necessary to perform their services.</p>
              <p>Their handling of information may also be subject to their own privacy policies.</p>
            </div>
          </section>

          {/* Section 13 */}
          <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-8">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100 mb-6">
              <span className="w-8 h-8 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center text-sm shadow-sm">
                13
              </span>
              <h2 className="text-xl font-bold text-slate-900">Changes to This Privacy Policy</h2>
            </div>
            <div className="space-y-3 text-slate-600 text-sm leading-relaxed">
              <p>We may update this Privacy Policy periodically to reflect changes to Flow, applicable laws, technology, or our business practices.</p>
              <p>When significant changes are made, we may notify users through the application, website, email, or another appropriate method.</p>
              <p className="font-semibold text-slate-800">The latest version will always display its effective date.</p>
            </div>
          </section>

          {/* Section 14 */}
          <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-8">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100 mb-6">
              <span className="w-8 h-8 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center text-sm shadow-sm">
                14
              </span>
              <h2 className="text-xl font-bold text-slate-900">Contact Us</h2>
            </div>
            <p className="text-slate-600 text-sm mb-4">
              For questions, privacy requests, or concerns regarding this Privacy Policy, please contact:
            </p>
            <div className="bg-slate-50 border border-blue-200 rounded-xl p-5 mb-4 space-y-2">
              <h4 className="font-bold text-slate-900 text-base">Flow</h4>
              <p className="text-sm text-slate-600 font-medium">Flow Operations SARL</p>
              <p className="text-sm text-slate-600">Beirut, Lebanon</p>
              <div className="pt-2 border-t border-slate-200/60 flex flex-col sm:flex-row gap-3 sm:gap-6 text-sm">
                <a
                  href="mailto:info@flowonline.me"
                  className="inline-flex items-center text-blue-600 hover:text-blue-700 font-semibold underline"
                >
                  <Mail className="w-4 h-4 mr-1.5" />
                  info@flowonline.me
                </a>
                <a
                  href="https://flowonline.me"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-blue-600 hover:text-blue-700 font-semibold underline"
                >
                  <Globe className="w-4 h-4 mr-1.5" />
                  https://flowonline.me
                </a>
              </div>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              If your information was provided to Flow by your employer or organization, you may also contact your organization&apos;s administrator regarding access, correction, or deletion of your information.
            </p>
          </section>

        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-xs text-slate-400">
          <p>&copy; 2026 Flow Operations SARL. All rights reserved.</p>
        </div>

      </div>
    </div>
  );
}
