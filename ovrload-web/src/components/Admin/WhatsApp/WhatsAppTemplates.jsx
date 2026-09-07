"use client";

import React, { useState, useEffect } from "react";
import {
  FileText,
  RefreshCw,
  Plus,
  CheckCircle,
  Clock,
  AlertCircle,
  Tag,
  Copy,
  Sparkles,
  ExternalLink,
  X,
  Search,
} from "lucide-react";

export default function WhatsAppTemplates({ adminToken }) {
  const getEffectiveToken = () => {
    return (
      adminToken ||
      (typeof window !== "undefined" ? localStorage.getItem("admin_token") : "") ||
      ""
    );
  };
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);
  const [search, setSearch] = useState("");

  // Add template modal
  const [modalOpen, setModalOpen] = useState(false);
  const [formName, setFormName] = useState("");
  const [formLang, setFormLang] = useState("en");
  const [formCategory, setFormCategory] = useState("UTILITY");
  const [formHeader, setFormHeader] = useState("");
  const [formBody, setFormBody] = useState("");
  const [formFooter, setFormFooter] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/whatsapp/templates", {
        headers: { "x-admin-token": getEffectiveToken() },
      });
      const data = await res.json();
      if (data.ok) {
        setTemplates(data.templates || []);
      }
    } catch (err) {
      console.error("Failed fetching templates:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncWithInfobip = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch("/api/whatsapp/templates/sync", {
        method: "POST",
        headers: { "x-admin-token": getEffectiveToken() },
      });
      const data = await res.json();
      if (data.ok) {
        setSyncMessage({
          type: "success",
          text: `Successfully synchronized ${data.syncedCount} template(s) from Infobip. Total: ${data.totalTemplates}`,
        });
        setTemplates(data.templates || []);
      } else {
        setSyncMessage({
          type: "error",
          text: data.error || "Failed to synchronize templates from Infobip",
        });
      }
    } catch (err) {
      setSyncMessage({ type: "error", text: "Network error during sync" });
    } finally {
      setSyncing(false);
    }
  };

  const handleSaveTemplate = async (e) => {
    e.preventDefault();
    if (!formName.trim() || !formBody.trim()) return;

    setFormSubmitting(true);
    setFormError(null);

    // Parse variables e.g. {{1}}, {{2}}
    const matches = formBody.match(/\{\{(\d+)\}\}/g) || [];
    const variables = Array.from(new Set(matches));

    try {
      const res = await fetch("/api/whatsapp/templates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": getEffectiveToken(),
        },
        body: JSON.stringify({
          name: formName.trim().toLowerCase(),
          language: formLang.trim(),
          category: formCategory,
          header: formHeader.trim() || null,
          body: formBody.trim(),
          footer: formFooter.trim() || null,
          variables,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setModalOpen(false);
        fetchTemplates();
      } else {
        setFormError(data.error || "Failed to save template");
      }
    } catch (err) {
      setFormError("Network error while saving template");
    } finally {
      setFormSubmitting(false);
    }
  };

  const filteredTemplates = templates.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.body && t.body.toLowerCase().includes(search.toLowerCase())) ||
      (t.category && t.category.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-5">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 p-4 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-950/80 border border-blue-800/80 flex items-center justify-center text-blue-400">
            <FileText size={20} />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">WhatsApp Templates</h2>
            <p className="text-xs text-slate-400">
              Approved Meta/Infobip templates used to initiate conversations and campaigns outside the 24h window
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search templates..."
              className="pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-48 sm:w-60"
            />
          </div>

          {/* Sync Button */}
          <button
            onClick={handleSyncWithInfobip}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition active:scale-95 disabled:opacity-50"
            title="Fetch latest templates from Infobip"
          >
            <RefreshCw size={14} className={syncing ? "animate-spin text-emerald-400" : ""} />
            {syncing ? "Syncing..." : "Sync with Infobip"}
          </button>

          {/* Add Template Button */}
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-sm active:scale-95 shrink-0"
          >
            <Plus size={15} />
            Add Template
          </button>
        </div>
      </div>

      {/* Sync Status Banner */}
      {syncMessage && (
        <div
          className={"p-3 rounded-xl border flex items-center justify-between text-xs " +
            (syncMessage.type === "success"
              ? "bg-emerald-950/70 border-emerald-800 text-emerald-300"
              : "bg-red-950/70 border-red-800 text-red-300")}
        >
          <span>{syncMessage.text}</span>
          <button onClick={() => setSyncMessage(null)} className="p-1 hover:opacity-75">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Templates Grid */}
      {loading ? (
        <div className="text-center py-16 text-slate-500 text-xs">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mx-auto mb-2" />
          Loading approved templates...
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="text-center py-20 bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-slate-500">
          <FileText className="w-10 h-10 text-slate-700 mx-auto mb-3 opacity-50" />
          <h3 className="text-sm font-bold text-slate-300">No templates found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Click "Sync with Infobip" to pull approved WhatsApp templates from your Infobip account, or add a template manually.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((tpl) => {
            const hasVariables = (tpl.variables && tpl.variables.length > 0) || tpl.body.includes("{{");

            return (
              <div
                key={tpl.id}
                className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4.5 flex flex-col justify-between shadow-lg hover:border-slate-700 transition"
              >
                <div>
                  {/* Top Header */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <h3 className="font-bold text-white text-sm flex items-center gap-1.5">
                        <Sparkles size={14} className="text-emerald-400" />
                        {tpl.name}
                      </h3>
                      <span className="text-[11px] text-slate-400 font-mono">
                        Lang: {tpl.language}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <span
                        className={"px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider " +
                          (tpl.status === "APPROVED"
                            ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                            : "bg-amber-950 text-amber-300 border border-amber-800")}
                      >
                        {tpl.status || "APPROVED"}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-400 font-semibold">
                        {tpl.category || "UTILITY"}
                      </span>
                    </div>
                  </div>

                  {/* Header text if any */}
                  {tpl.header && (
                    <div className="text-xs font-bold text-slate-200 mb-1.5 pb-1 border-b border-slate-800">
                      {tpl.header}
                    </div>
                  )}

                  {/* Body Preview */}
                  <div className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-xl text-xs text-slate-300 whitespace-pre-wrap leading-relaxed font-sans min-h-[70px]">
                    {tpl.body}
                  </div>

                  {/* Footer text if any */}
                  {tpl.footer && (
                    <p className="text-[11px] text-slate-500 mt-2 italic">
                      {tpl.footer}
                    </p>
                  )}
                </div>

                {/* Card Footer */}
                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
                  <span>
                    {hasVariables ? "Dynamic placeholders included" : "Static message"}
                  </span>
                  {tpl.last_synced_at && (
                    <span>
                      Synced: {new Date(tpl.last_synced_at).toLocaleDateString([], { month: "short", day: "numeric" })}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Configure Template Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col text-slate-100">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <FileText size={16} className="text-emerald-500" />
                Add Template Configuration
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveTemplate} className="p-5 space-y-3.5 text-xs">
              {formError && (
                <div className="p-2.5 bg-red-950/80 border border-red-800 text-red-300 rounded-xl flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0 text-red-400" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  Meta Template Name *
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. order_confirmation"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Language *</label>
                  <input
                    type="text"
                    value={formLang}
                    onChange={(e) => setFormLang(e.target.value)}
                    placeholder="en or en_US"
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="UTILITY">UTILITY</option>
                    <option value="MARKETING">MARKETING</option>
                    <option value="AUTHENTICATION">AUTHENTICATION</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Header Type (Optional)</label>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {[
                    { id: "NONE", label: "None" },
                    { id: "IMAGE", label: "🖼️ Image" },
                    { id: "TEXT", label: "✍️ Text" },
                  ].map((h) => (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => {
                        if (h.id === "NONE") setFormHeader("");
                        else if (h.id === "IMAGE") setFormHeader("IMAGE");
                        else if (formHeader === "IMAGE" || !formHeader) setFormHeader("Header Title");
                      }}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition ${
                        (h.id === "NONE" && !formHeader) ||
                        (h.id === "IMAGE" && formHeader === "IMAGE") ||
                        (h.id === "TEXT" && formHeader && formHeader !== "IMAGE")
                          ? "bg-emerald-600 border-emerald-500 text-white font-bold"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      {h.label}
                    </button>
                  ))}
                </div>
                {formHeader && formHeader !== "IMAGE" && (
                  <input
                    type="text"
                    value={formHeader}
                    onChange={(e) => setFormHeader(e.target.value)}
                    placeholder="e.g. Special Announcement"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                )}
                {formHeader === "IMAGE" && (
                  <p className="text-[11px] text-emerald-400 bg-emerald-950/40 border border-emerald-800/60 rounded-lg p-2">
                    ✓ Image header enabled. You will be able to specify the image URL when launching a campaign.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  Message Body * (Use &#123;&#123;1&#125;&#125;, &#123;&#123;2&#125;&#125; for placeholders)
                </label>
                <textarea
                  value={formBody}
                  onChange={(e) => setFormBody(e.target.value)}
                  placeholder="Hello {{1}}, your order #{{2}} is ready for pickup!"
                  rows={4}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none font-sans"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Footer (Optional)</label>
                <input
                  type="text"
                  value={formFooter}
                  onChange={(e) => setFormFooter(e.target.value)}
                  placeholder="e.g. Reply STOP to unsubscribe"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition disabled:opacity-50"
                >
                  {formSubmitting ? "Saving..." : "Save Template"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
