"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  MessageSquare,
  Users,
  Megaphone,
  FileText,
  Settings,
  Radio,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink
} from "lucide-react";

import WhatsAppInbox from "./WhatsAppInbox";
import WhatsAppContacts from "./WhatsAppContacts";
import WhatsAppCampaigns from "./WhatsAppCampaigns";
import WhatsAppTemplates from "./WhatsAppTemplates";
import WhatsAppSettings from "./WhatsAppSettings";

export default function WhatsAppModule({
  activeTab = "whatsapp-inbox",
  onTabChange,
  adminToken
}) {
  // Map parent activeTab to local subTab
  const getSubTabFromTab = (tab) => {
    switch (tab) {
      case "whatsapp-contacts":
        return "contacts";
      case "whatsapp-campaigns":
        return "campaigns";
      case "whatsapp-templates":
        return "templates";
      case "whatsapp-settings":
        return "settings";
      case "whatsapp-inbox":
      default:
        return "inbox";
    }
  };

  const [subTab, setSubTab] = useState(getSubTabFromTab(activeTab));
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingPhone, setPendingPhone] = useState(null);
  const [configStatus, setConfigStatus] = useState({ configured: false, loading: true });

  // Sync subTab if parent activeTab changes
  useEffect(() => {
    setSubTab(getSubTabFromTab(activeTab));
  }, [activeTab]);

  const handleSubTabSwitch = (newSubTab) => {
    setSubTab(newSubTab);
    if (onTabChange) {
      onTabChange(`whatsapp-${newSubTab}`);
    }
  };

  // Fetch unread count & config status on mount
  useEffect(() => {
    fetchUnreadCount();
    checkConfig();

    // Listen to real-time events for unread updates
    let eventSource = null;
    try {
      eventSource = new EventSource("/api/whatsapp/realtime");
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "new_message" || data.type === "status_update") {
            fetchUnreadCount();
          }
        } catch (e) {
          // ignore parse error
        }
      };
    } catch (e) {
      console.warn("SSE not available in this environment");
    }

    const interval = setInterval(fetchUnreadCount, 25000);

    return () => {
      if (eventSource) eventSource.close();
      clearInterval(interval);
    };
  }, []);

  const fetchUnreadCount = async () => {
    try {
      const res = await fetch("/api/whatsapp/conversations?limit=100", {
        headers: { "x-admin-token": adminToken || "" }
      });
      const data = await res.json();
      if (data.ok && Array.isArray(data.conversations)) {
        const totalUnread = data.conversations.reduce(
          (sum, c) => sum + (parseInt(c.unread_count, 10) || 0),
          0
        );
        setUnreadCount(totalUnread);
      }
    } catch (e) {
      console.error("Failed to fetch unread count", e);
    }
  };

  const checkConfig = async () => {
    try {
      const res = await fetch("/api/whatsapp/settings", {
        headers: { "x-admin-token": adminToken || "" }
      });
      const data = await res.json();
      if (data.ok && data.settings) {
        setConfigStatus({
          configured: !!(data.settings.hasApiKey && data.settings.senderNumber),
          senderNumber: data.settings.senderNumber || null,
          loading: false
        });
      } else {
        setConfigStatus({ configured: false, loading: false });
      }
    } catch (e) {
      setConfigStatus({ configured: false, loading: false });
    }
  };

  const handleOpenChatWithPhone = (phone) => {
    setPendingPhone(phone);
    handleSubTabSwitch("inbox");
  };

  const tabs = [
    {
      id: "inbox",
      label: "Inbox",
      icon: MessageSquare,
      badge: unreadCount > 0 ? unreadCount : null
    },
    {
      id: "contacts",
      label: "Contacts",
      icon: Users
    },
    {
      id: "campaigns",
      label: "Campaigns",
      icon: Megaphone
    },
    {
      id: "templates",
      label: "Templates",
      icon: FileText
    },
    {
      id: "settings",
      label: "Settings",
      icon: Settings
    }
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-4.25rem)] w-full bg-slate-950 text-slate-100 overflow-hidden">
      {/* Top Header & Navigation Subtab Bar */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 flex-shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold shadow-sm">
              <MessageSquare size={17} />
            </div>
            <div>
              <h1 className="text-base font-bold text-white leading-tight flex items-center gap-2">
                WhatsApp Business
                {!configStatus.loading && (
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-normal ${
                      configStatus.configured
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    }`}
                  >
                    {configStatus.configured ? (
                      <>
                        <CheckCircle2 size={10} /> Active ({configStatus.senderNumber || "Ready"})
                      </>
                    ) : (
                      <>
                        <AlertTriangle size={10} /> Setup Required
                      </>
                    )}
                  </span>
                )}
              </h1>
              <p className="text-xs text-slate-400">
                Direct Infobip WhatsApp integration &amp; Meta 24-hr service window management
              </p>
            </div>
          </div>

          {/* Sub Navigation Tabs */}
          <nav className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800/80">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = subTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleSubTabSwitch(tab.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? "bg-emerald-600 text-white shadow-sm font-semibold"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                  }`}
                >
                  <Icon size={14} />
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                      {tab.badge > 99 ? "99+" : tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Status indicator / quick actions */}
        <div className="flex items-center gap-3 text-xs">
          <div className="hidden lg:flex items-center gap-1.5 text-slate-400 bg-slate-800/50 px-2.5 py-1 rounded-lg border border-slate-700/40">
            <Radio size={12} className="text-emerald-400 animate-pulse" />
            <span>Transport: Infobip REST API</span>
          </div>
        </div>
      </div>

      {/* Main Subcomponent Content View */}
      <div className="flex-1 overflow-hidden relative">
        {subTab === "inbox" && (
          <WhatsAppInbox
            adminToken={adminToken}
            initialPhone={pendingPhone}
            onClearInitialPhone={() => setPendingPhone(null)}
          />
        )}

        {subTab === "contacts" && (
          <div className="h-full overflow-y-auto p-6 bg-slate-950">
            <WhatsAppContacts
              adminToken={adminToken}
              onOpenChat={handleOpenChatWithPhone}
            />
          </div>
        )}

        {subTab === "campaigns" && (
          <div className="h-full overflow-y-auto p-6 bg-slate-950">
            <WhatsAppCampaigns
              adminToken={adminToken}
              onOpenChat={handleOpenChatWithPhone}
            />
          </div>
        )}

        {subTab === "templates" && (
          <div className="h-full overflow-y-auto p-6 bg-slate-950">
            <WhatsAppTemplates adminToken={adminToken} />
          </div>
        )}

        {subTab === "settings" && (
          <div className="h-full overflow-y-auto p-6 bg-slate-950">
            <WhatsAppSettings
              adminToken={adminToken}
              onSettingsUpdated={checkConfig}
            />
          </div>
        )}
      </div>
    </div>
  );
}
