"use client";

import React, { useState, useEffect } from "react";
import {
  Settings,
  CheckCircle,
  AlertCircle,
  Copy,
  ExternalLink,
  Shield,
  Clock,
  Radio,
  RefreshCw,
  Save,
  Check,
} from "lucide-react";

export default function WhatsAppSettings({ adminToken }) {
  const getEffectiveToken = () => {
    return (
      adminToken ||
      (typeof window !== "undefined" ? localStorage.getItem("admin_token") : "") ||
      ""
    );
  };
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // Form settings
  const [serviceWindowHours, setServiceWindowHours] = useState(24);
  const [defaultCountry, setDefaultCountry] = useState("961");
  const [campaignBatchSize, setCampaignBatchSize] = useState(25);
  const [campaignDelayMs, setCampaignDelayMs] = useState(500);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/whatsapp/settings", {
        headers: { "x-admin-token": getEffectiveToken() },
      });
      const json = await res.json();
      if (json.ok) {
        setData(json);
        if (json.settings) {
          setServiceWindowHours(json.settings.serviceWindowHours || 24);
          setDefaultCountry(json.settings.defaultCountry || "961");
          setCampaignBatchSize(json.settings.campaignBatchSize || 25);
          setCampaignDelayMs(json.settings.campaignDelayMs || 500);
        }
      }
    } catch (err) {
      console.error("Failed fetching settings:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/whatsapp/settings", {
        method: "POST",
        headers: { "x-admin-token": getEffectiveToken() },
      });
      const json = await res.json();
      if (json.ok && json.test) {
        setTestResult(json.test);
      } else {
        setTestResult({ connected: false, error: json.error || "Connection test failed" });
      }
    } catch (err) {
      setTestResult({ connected: false, error: "Network error during test" });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);

    try {
      const res = await fetch("/api/whatsapp/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": getEffectiveToken(),
        },
        body: JSON.stringify({
          serviceWindowHours: Number(serviceWindowHours),
          defaultCountry: defaultCountry.trim(),
          campaignBatchSize: Number(campaignBatchSize),
          campaignDelayMs: Number(campaignDelayMs),
        }),
      });

      const json = await res.json();
      if (json.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error("Failed saving settings:", err);
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  if (loading) {
    return (
      <div className="text-center py-16 text-slate-500 text-xs">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mx-auto mb-2" />
        Loading WhatsApp configuration...
      </div>
    );
  }

  const config = data?.config || {};
  const webhooks = data?.webhooks || {};

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 bg-slate-900/90 border border-slate-800 p-4 rounded-2xl">
        <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300">
          <Settings size={20} />
        </div>
        <div>
          <h2 className="text-base font-bold text-white">WhatsApp & Infobip Settings</h2>
          <p className="text-xs text-slate-400">
            Configure Infobip WhatsApp messaging provider, webhook callbacks, and customer care window
          </p>
        </div>
      </div>

      {/* 1. Infobip Credentials & Connectivity Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2 font-bold text-white text-sm">
            <Shield size={16} className="text-emerald-500" />
            Infobip WhatsApp Transport Provider
          </div>
          <button
            onClick={handleTestConnection}
            disabled={testingConnection}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition active:scale-95 disabled:opacity-50"
          >
            <RefreshCw size={13} className={testingConnection ? "animate-spin text-emerald-400" : ""} />
            {testingConnection ? "Testing Connection..." : "Test Infobip Connection"}
          </button>
        </div>

        {/* Test Result Alert */}
        {testResult && (
          <div
            className={"p-3 rounded-xl border text-xs flex items-start gap-2.5 " +
              (testResult.connected
                ? "bg-emerald-950/70 border-emerald-800 text-emerald-300"
                : "bg-red-950/70 border-red-800 text-red-300")}
          >
            {testResult.connected ? (
              <CheckCircle size={16} className="text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
            )}
            <div>
              <div className="font-bold">
                {testResult.connected ? "Connection Successful" : "Connection Failed"}
              </div>
              <p className="mt-0.5 opacity-90">
                {testResult.connected
                  ? `Authenticated successfully with Infobip API (${testResult.baseUrl}). ${testResult.templatesCount || 0} templates available on sender ${testResult.sender}.`
                  : testResult.error}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl">
            <span className="text-slate-500 font-medium">WhatsApp Sender Number</span>
            <div className="font-mono text-emerald-400 font-bold text-sm mt-1">
              +{config.sender || "Not configured"}
            </div>
          </div>
          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl truncate">
            <span className="text-slate-500 font-medium">Infobip Base URL</span>
            <div className="font-mono text-slate-300 font-medium text-xs mt-1 truncate">
              {config.baseUrl || "Not configured"}
            </div>
          </div>
          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl">
            <span className="text-slate-500 font-medium">API Key Status</span>
            <div className="flex items-center gap-1.5 mt-1">
              {config.hasApiKey ? (
                <>
                  <CheckCircle size={14} className="text-emerald-400" />
                  <span className="text-white font-mono text-xs">Configured ({config.maskedApiKey})</span>
                </>
              ) : (
                <>
                  <AlertCircle size={14} className="text-red-400" />
                  <span className="text-red-400 font-semibold text-xs">Missing API Key</span>
                </>
              )}
            </div>
          </div>
        </div>

        <p className="text-[11px] text-slate-500">
          Environment variables can be updated in Railway under <code>INFOBIP_API_KEY</code>, <code>INFOBIP_BASE_URL</code>, and <code>INFOBIP_WHATSAPP_SENDER</code>.
        </p>
      </div>

      {/* 2. Webhook URLs Configuration Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="border-b border-slate-800 pb-3">
          <div className="font-bold text-white text-sm">
            Infobip Webhook Endpoints
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Register these callback URLs in your Infobip WhatsApp sender configuration to receive inbound messages and delivery reports.
          </p>
        </div>

        <div className="space-y-3 text-xs">
          {/* Inbound Webhook */}
          <div>
            <label className="block text-slate-400 font-semibold mb-1">
              1. Inbound Messages Webhook (POST)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={webhooks.inboundUrl || ""}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 font-mono text-xs text-slate-200"
              />
              <button
                onClick={() => copyToClipboard(webhooks.inboundUrl, "inbound")}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-semibold flex items-center gap-1.5 transition active:scale-95"
              >
                {copiedKey === "inbound" ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                {copiedKey === "inbound" ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Triggered by Infobip when customers send text, media, voice, or location to your WhatsApp number.
            </p>
          </div>

          {/* Status Webhook */}
          <div>
            <label className="block text-slate-400 font-semibold mb-1">
              2. Delivery & Read Reports Webhook (POST)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={webhooks.statusUrl || ""}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 font-mono text-xs text-slate-200"
              />
              <button
                onClick={() => copyToClipboard(webhooks.statusUrl, "status")}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-semibold flex items-center gap-1.5 transition active:scale-95"
              >
                {copiedKey === "status" ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                {copiedKey === "status" ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Triggered when outgoing messages are delivered, read, or encounter delivery errors.
            </p>
          </div>
        </div>
      </div>

      {/* 3. Business Logic & Window Configuration Form */}
      <form onSubmit={handleSaveSettings} className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4 text-xs">
        <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-white text-sm">
              Business Logic & Window Policies
            </h3>
            <p className="text-slate-400 text-xs mt-0.5">
              Fine-tune customer service window rules and campaign execution limits
            </p>
          </div>
          {saveSuccess && (
            <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
              <CheckCircle size={14} /> Settings Saved
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-slate-300 font-semibold mb-1 flex items-center gap-1.5">
              <Clock size={14} className="text-emerald-500" />
              Customer Service Window Duration (Hours)
            </label>
            <input
              type="number"
              min="1"
              max="72"
              value={serviceWindowHours}
              onChange={(e) => setServiceWindowHours(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Standard Meta policy is 24 hours from customer's latest inbound message.
            </p>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Default Country Calling Code
            </label>
            <input
              type="text"
              value={defaultCountry}
              onChange={(e) => setDefaultCountry(e.target.value)}
              placeholder="961"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Default international dial code for domestic numbers (e.g. 961 for Lebanon).
            </p>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Campaign Batch Size (Messages per batch)
            </label>
            <input
              type="number"
              min="5"
              max="100"
              value={campaignBatchSize}
              onChange={(e) => setCampaignBatchSize(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Number of recipients to process in parallel before pausing.
            </p>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Campaign Batch Delay (Milliseconds)
            </label>
            <input
              type="number"
              min="100"
              max="5000"
              step="50"
              value={campaignDelayMs}
              onChange={(e) => setCampaignDelayMs(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Pause between batches to prevent Infobip rate limiting.
            </p>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl active:scale-95 transition disabled:opacity-50 text-xs"
          >
            <Save size={15} />
            {saving ? "Saving..." : "Save Configuration"}
          </button>
        </div>
      </form>
    </div>
  );
}
