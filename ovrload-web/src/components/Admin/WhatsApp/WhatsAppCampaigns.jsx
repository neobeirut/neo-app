"use client";

import React, { useState, useEffect } from "react";
import {
  Radio,
  Plus,
  Search,
  CheckCircle,
  Clock,
  AlertCircle,
  AlertTriangle,
  Play,
  XCircle,
  Users,
  FileText,
  Calendar,
  Send,
  ExternalLink,
  RefreshCw,
  X,
  ChevronRight,
  ChevronLeft,
  Filter,
  BarChart3,
  MessageSquare,
  Sparkles,
  Upload,
} from "lucide-react";

export default function WhatsAppCampaigns({ adminToken, onOpenChat }) {
  const getEffectiveToken = () => {
    return (
      adminToken ||
      (typeof window !== "undefined" ? localStorage.getItem("admin_token") : "") ||
      ""
    );
  };
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [campaignDetails, setCampaignDetails] = useState(null);
  const [recipientFilter, setRecipientFilter] = useState("all");
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Wizard modal state
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [templates, setTemplates] = useState([]);
  const [contacts, setContacts] = useState([]);

  // Wizard Form Fields
  const [campaignName, setCampaignName] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateVariables, setTemplateVariables] = useState({});
  const [audienceType, setAudienceType] = useState("category"); // 'category', 'manual', 'opted_in', 'tag', 'tier', 'csv'
  const [categories, setCategories] = useState(["BDD", "General"]);
  const [categoryCounts, setCategoryCounts] = useState({});
  const [selectedCategory, setSelectedCategory] = useState("BDD");
  const [contactSearch, setContactSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [selectedTier, setSelectedTier] = useState("");
  const [selectedContactIds, setSelectedContactIds] = useState([]);
  const [csvPhones, setCsvPhones] = useState("");
  const [headerMediaUrl, setHeaderMediaUrl] = useState("");
  const [allowUnopted, setAllowUnopted] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [wizardError, setWizardError] = useState(null);

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/whatsapp/campaigns", {
        headers: { "x-admin-token": getEffectiveToken() },
      });
      const data = await res.json();
      if (data.ok) {
        setCampaigns(data.campaigns || []);
      }
    } catch (err) {
      console.error("Failed fetching campaigns:", err);
    } finally {
      setLoading(false);
    }
  };

  const openWizard = async () => {
    setWizardStep(1);
    setCampaignName("");
    setSelectedTemplate(null);
    setTemplateVariables({});
    setAudienceType("category");
    setSelectedCategory("BDD");
    setContactSearch("");
    setSelectedTag("");
    setSelectedTier("");
    setSelectedContactIds([]);
    setCsvPhones("");
    setHeaderMediaUrl("");
    setAllowUnopted(true);
    setWizardError(null);
    setWizardOpen(true);

    // Fetch templates and contacts for wizard
    try {
      const [tplRes, conRes] = await Promise.all([
        fetch("/api/whatsapp/templates", { headers: { "x-admin-token": getEffectiveToken() } }),
        fetch("/api/whatsapp/contacts?limit=2000", { headers: { "x-admin-token": getEffectiveToken() } }),
      ]);
      const tplData = await tplRes.json();
      const conData = await conRes.json();
      if (tplData.ok) {
        setTemplates(tplData.templates || []);
        if (tplData.templates.length > 0) {
          handleSelectTemplate(tplData.templates[0]);
        }
      }
      if (conData.ok) {
        setContacts(conData.contacts || []);
        if (conData.categoryCounts) {
          setCategoryCounts(conData.categoryCounts);
        }
        if (conData.categories && conData.categories.length > 0) {
          setCategories(conData.categories);
          if (conData.categories.includes("BDD")) {
            setSelectedCategory("BDD");
          } else {
            setSelectedCategory(conData.categories[0]);
          }
        }
      }
    } catch (e) {}
  };

  const handleSelectTemplate = (tpl) => {
    setSelectedTemplate(tpl);
    const matches = (tpl.body || "").match(/\{\{(\d+)\}\}/g) || [];
    const vars = {};
    matches.forEach((m) => {
      const num = m.replace(/[^0-9]/g, "");
      vars[num] = "";
    });
    setTemplateVariables(vars);
  };

  const getRenderedPreview = () => {
    if (!selectedTemplate) return "";
    let preview = selectedTemplate.body || "";
    Object.entries(templateVariables).forEach(([num, val]) => {
      const token = "{{" + num + "}}";
      const displayVal = val === "{{name}}" ? "[Customer Name]" : (val || token);
      preview = preview.split(token).join(displayVal);
    });
    return preview;
  };

  // CSV phone parsing stats
  const parseCsvPhonesList = () => {
    if (!csvPhones.trim()) return [];
    return csvPhones
      .split(/[\n,;]+/)
      .map((p) => p.trim())
      .filter(Boolean);
  };

  const filteredManualContacts = contacts.filter((c) => {
    if (!contactSearch.trim()) return true;
    const q = contactSearch.toLowerCase();
    return (
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.phone_e164 && c.phone_e164.toLowerCase().includes(q)) ||
      (c.category && c.category.toLowerCase().includes(q))
    );
  });

  const handleCreateAndSendCampaign = async () => {
    if (!campaignName.trim() || !selectedTemplate) return;

    setIsSubmitting(true);
    setWizardError(null);

    const placeholderKeys = Object.keys(templateVariables).sort((a, b) => Number(a) - Number(b));
    const placeholders = placeholderKeys.map((k) => templateVariables[k] || "");
    const manualPhones = audienceType === "csv" ? parseCsvPhonesList() : [];

    try {
      // 1. Create campaign
      const createRes = await fetch("/api/whatsapp/campaigns", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": getEffectiveToken(),
        },
        body: JSON.stringify({
          name: campaignName.trim(),
          template_name: selectedTemplate.name,
          template_language: selectedTemplate.language || "en",
          template_variables: placeholders,
          template_id: selectedTemplate.id,
          filter_criteria: {
            audienceType,
            selectedCategory: audienceType === "category" ? selectedCategory : null,
            selectedTag: audienceType === "tag" ? selectedTag : null,
            selectedTier: audienceType === "tier" ? selectedTier : null,
            headerMediaUrl: headerMediaUrl.trim() || null,
          },
        }),
      });

      const createData = await createRes.json();
      if (!createData.ok || !createData.campaign) {
        setWizardError(createData.error || "Failed creating campaign");
        setIsSubmitting(false);
        return;
      }

      const campaignId = createData.campaign.id;

      // 2. Launch sending
      const sendRes = await fetch("/api/whatsapp/campaigns/" + campaignId + "/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": getEffectiveToken(),
        },
        body: JSON.stringify({
          audienceType,
          selectedCategory: audienceType === "category" ? selectedCategory : null,
          selectedTag: audienceType === "tag" ? selectedTag : null,
          selectedTier: audienceType === "tier" ? selectedTier : null,
          manualContactIds: audienceType === "manual" ? selectedContactIds : [],
          manualPhones,
          allowUnopted: allowUnopted || audienceType === "category" || audienceType === "manual",
          headerMediaUrl: headerMediaUrl.trim() || null,
        }),
      });

      const sendData = await sendRes.json();
      if (sendData.ok) {
        setWizardOpen(false);
        fetchCampaigns();
        openCampaignDetails(createData.campaign);
      } else {
        setWizardError(sendData.error || "Failed launching campaign");
      }
    } catch (err) {
      setWizardError("Network error while launching campaign");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openCampaignDetails = async (campaign) => {
    setSelectedCampaign(campaign);
    setLoadingDetails(true);
    try {
      const res = await fetch("/api/whatsapp/campaigns/" + campaign.id + "?status=" + recipientFilter, {
        headers: { "x-admin-token": getEffectiveToken() },
      });
      const data = await res.json();
      if (data.ok) {
        setCampaignDetails(data);
      }
    } catch (err) {
      console.error("Failed fetching campaign details:", err);
    } finally {
      setLoadingDetails(false);
    }
  };

  useEffect(() => {
    if (selectedCampaign) {
      openCampaignDetails(selectedCampaign);
    }
  }, [recipientFilter]);

  // Aggregate Metrics across all campaigns
  const totalCampaigns = campaigns.length;
  const totalSent = campaigns.reduce((acc, c) => acc + (Number(c.sent_count) || 0), 0);
  const totalDelivered = campaigns.reduce((acc, c) => acc + (Number(c.delivered_count) || 0), 0);
  const totalRead = campaigns.reduce((acc, c) => acc + (Number(c.read_count) || 0), 0);
  const totalFailed = campaigns.reduce((acc, c) => acc + (Number(c.failed_count) || 0), 0);

  const deliveryRate = totalSent > 0 ? ((totalDelivered / totalSent) * 100).toFixed(1) : "0.0";
  const readRate = totalDelivered > 0 ? ((totalRead / totalDelivered) * 100).toFixed(1) : "0.0";

  return (
    <div className="space-y-5">
      {/* Top Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-lg">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            Total Campaigns
          </div>
          <div className="text-2xl font-black text-white">{totalCampaigns}</div>
        </div>
        <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-lg">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            Total Broadcasts Sent
          </div>
          <div className="text-2xl font-black text-emerald-400">{totalSent}</div>
        </div>
        <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-lg">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            Delivery Rate
          </div>
          <div className="text-2xl font-black text-blue-400">{deliveryRate}%</div>
        </div>
        <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-lg">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            Read Rate
          </div>
          <div className="text-2xl font-black text-purple-400">{readRate}%</div>
        </div>
      </div>

      {/* Header & Launch Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 p-4 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-950/80 border border-purple-800/80 flex items-center justify-center text-purple-400">
            <Radio size={20} />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">WhatsApp Campaigns</h2>
            <p className="text-xs text-slate-400">
              Create and dispatch targeted WhatsApp marketing broadcasts via Infobip
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchCampaigns}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
            title="Refresh campaigns"
          >
            <RefreshCw size={15} />
          </button>
          <button
            onClick={openWizard}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-sm active:scale-95"
          >
            <Plus size={16} />
            Create Campaign
          </button>
        </div>
      </div>

      {/* Campaigns Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Campaign Name</th>
                <th className="py-3 px-4">Template</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-center">Recipients</th>
                <th className="py-3 px-4 text-center">Sent</th>
                <th className="py-3 px-4 text-center">Delivered</th>
                <th className="py-3 px-4 text-center">Read</th>
                <th className="py-3 px-4 text-center">Failed</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500 mx-auto mb-2" />
                    Loading campaigns...
                  </td>
                </tr>
              ) : campaigns.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center text-slate-500">
                    <Radio className="w-8 h-8 text-slate-700 mx-auto mb-2 opacity-50" />
                    <p className="font-semibold text-slate-400">No campaigns launched yet</p>
                    <p className="mt-1 text-slate-600">Click "Create Campaign" to compose your first WhatsApp broadcast.</p>
                  </td>
                </tr>
              ) : (
                campaigns.map((camp) => {
                  const sent = Number(camp.sent_count) || 0;
                  const delivered = Number(camp.delivered_count) || 0;
                  const read = Number(camp.read_count) || 0;
                  const failed = Number(camp.failed_count) || 0;
                  const totalR = Number(camp.total_recipients) || 0;

                  return (
                    <tr key={camp.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4 font-bold text-white">
                        {camp.name}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-purple-400">
                        {camp.template_name} ({camp.template_language})
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={"px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider " +
                            (camp.status === "completed"
                              ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                              : camp.status === "running"
                              ? "bg-blue-950 text-blue-300 border border-blue-800 animate-pulse"
                              : camp.status === "cancelled"
                              ? "bg-slate-800 text-slate-400"
                              : "bg-amber-950 text-amber-300 border border-amber-800")}
                        >
                          {camp.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-semibold text-white">
                        {totalR}
                      </td>
                      <td className="py-3.5 px-4 text-center text-emerald-400 font-semibold">
                        {sent}
                      </td>
                      <td className="py-3.5 px-4 text-center text-blue-400">
                        {delivered} {sent > 0 && <span className="text-[10px] opacity-75">({((delivered / sent) * 100).toFixed(0)}%)</span>}
                      </td>
                      <td className="py-3.5 px-4 text-center text-purple-400 font-semibold">
                        {read} {delivered > 0 && <span className="text-[10px] opacity-75">({((read / delivered) * 100).toFixed(0)}%)</span>}
                      </td>
                      <td className="py-3.5 px-4 text-center text-red-400 font-semibold">
                        {failed}
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                        {new Date(camp.created_at).toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => openCampaignDetails(camp)}
                          className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition active:scale-95 flex items-center gap-1 ml-auto"
                        >
                          <BarChart3 size={13} />
                          Results
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================= */}
      {/* CAMPAIGN WIZARD MODAL */}
      {/* ========================================================= */}
      {wizardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[92vh] text-slate-100">
            {/* Header */}
            <div className="p-4 px-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div>
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  <Radio size={16} className="text-emerald-500" />
                  New WhatsApp Broadcast Campaign
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Step {wizardStep} of 4:{" "}
                  {wizardStep === 1
                    ? "Campaign & Template"
                    : wizardStep === 2
                    ? "Fill Variables"
                    : wizardStep === 3
                    ? "Audience & Consent"
                    : "Review & Launch"}
                </p>
              </div>
              <button onClick={() => setWizardOpen(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            {/* Wizard Body */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
              {wizardError && (
                <div className="p-3 bg-red-950/80 border border-red-800 text-red-300 rounded-xl flex items-start gap-2">
                  <AlertCircle size={15} className="shrink-0 text-red-400 mt-0.5" />
                  <span>{wizardError}</span>
                </div>
              )}

              {/* STEP 1: Campaign Details & Template */}
              {wizardStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      Campaign Name *
                    </label>
                    <input
                      type="text"
                      value={campaignName}
                      onChange={(e) => setCampaignName(e.target.value)}
                      placeholder="e.g. Weekend Special 20% Off"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      Select Approved Meta Template *
                    </label>
                    {templates.length === 0 ? (
                      <p className="text-slate-500 italic">No approved templates found. Sync templates first.</p>
                    ) : (
                      <select
                        value={selectedTemplate?.id || ""}
                        onChange={(e) => {
                          const tpl = templates.find((t) => String(t.id) === e.target.value);
                          if (tpl) handleSelectTemplate(tpl);
                        }}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 text-sm font-medium"
                      >
                        {templates.map((tpl) => (
                          <option key={tpl.id} value={tpl.id}>
                            {tpl.name} ({tpl.language}) — {tpl.category || "UTILITY"}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {selectedTemplate && (
                    <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl">
                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Template Body:
                      </div>
                      <p className="text-slate-300 whitespace-pre-wrap">{selectedTemplate.body}</p>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 2: Variables */}
              {wizardStep === 2 && (
                <div className="space-y-4">
                  {/* Template Header Image (if image template) */}
                  {(selectedTemplate?.header === "IMAGE" || (selectedTemplate?.header && selectedTemplate?.header.toLowerCase().includes("image"))) && (
                    <div className="p-3.5 bg-slate-950 border border-emerald-800/40 rounded-xl space-y-2">
                      <label className="block text-emerald-400 font-semibold text-xs flex items-center gap-1.5">
                        <span>🖼️ Template Header Image URL</span>
                      </label>
                      <input
                        type="url"
                        value={headerMediaUrl}
                        onChange={(e) => setHeaderMediaUrl(e.target.value)}
                        placeholder="https://your-domain.com/path/to/promo.jpg"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs"
                      />
                      <p className="text-[10px] text-slate-400">
                        Direct public HTTPS image link (JPG or PNG) to display at the top of each message.
                      </p>
                      {headerMediaUrl && (
                        <div className="mt-2 rounded-lg overflow-hidden border border-slate-800 max-w-[200px]">
                          <img src={headerMediaUrl} alt="Header Preview" className="w-full h-auto object-cover max-h-[120px]" />
                        </div>
                      )}
                    </div>
                  )}

                  {Object.keys(templateVariables).length === 0 ? (
                    <div className="p-6 text-center text-slate-400 bg-slate-950/60 rounded-xl border border-slate-800">
                      <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                      <p className="font-semibold text-white">No dynamic variables required</p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        This template does not contain placeholders. You can proceed directly to audience selection.
                      </p>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-slate-300 text-xs">Fill Template Variables</h4>
                        <span className="text-[10px] text-slate-400">Tip: Click &quot;+ Insert Contact Name&quot; to personalize per recipient</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {Object.keys(templateVariables).map((num) => (
                          <div key={num}>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-slate-400 text-xs font-medium">
                                Placeholder &#123;&#123;{num}&#125;&#125;
                              </label>
                              <button
                                type="button"
                                onClick={() =>
                                  setTemplateVariables((prev) => ({ ...prev, [num]: "{{name}}" }))
                                }
                                className="text-[10px] text-emerald-400 hover:text-emerald-300 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/40"
                              >
                                + Insert Contact Name
                              </button>
                            </div>
                            <input
                              type="text"
                              value={templateVariables[num]}
                              onChange={(e) =>
                                setTemplateVariables((prev) => ({ ...prev, [num]: e.target.value }))
                              }
                              placeholder={"Value for {{" + num + "}} or {{name}}"}
                              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs font-mono"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Live Preview Card */}
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1 text-xs">Live Message Preview</label>
                    <div className="p-4 bg-emerald-950/30 border border-emerald-800/80 rounded-xl text-emerald-100 whitespace-pre-wrap text-sm space-y-2">
                      {headerMediaUrl && (
                        <div className="rounded-lg overflow-hidden border border-emerald-800/40 max-w-[220px] mb-2">
                          <img src={headerMediaUrl} alt="Header Preview" className="w-full h-auto object-cover max-h-[140px]" />
                        </div>
                      )}
                      <div>{getRenderedPreview()}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: Audience & Marketing Opt-in */}
              {wizardStep === 3 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1.5">
                      Select Target Audience
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {[
                        { id: "category", label: "Filter by Contact Category", desc: "Select group like BDD (817) or General" },
                        { id: "manual", label: "Select Individual Contacts", desc: "Pick specific contacts with checkboxes" },
                        { id: "opted_in", label: "All Opted-In Clients", desc: "Contacts with explicit marketing consent" },
                        { id: "tag", label: "Filter by Contact Tag", desc: "Contacts matching a specific tag" },
                        { id: "tier", label: "Filter by Customer Tier", desc: "Platinum, Gold, Silver members" },
                        { id: "csv", label: "Paste Phone Numbers (CSV)", desc: "Quick list of mobile numbers" },
                      ].map((aud) => (
                        <div
                          key={aud.id}
                          onClick={() => setAudienceType(aud.id)}
                          className={"p-3 rounded-xl border cursor-pointer transition " +
                            (audienceType === aud.id
                              ? "bg-emerald-950/60 border-emerald-600 text-white"
                              : "bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700")}
                        >
                          <div className="font-bold text-xs">{aud.label}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">{aud.desc}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Dynamic Audience Inputs */}
                  {audienceType === "category" && (
                    <div className="space-y-3 p-3 bg-slate-950/80 rounded-xl border border-slate-800">
                      <div>
                        <label className="block text-slate-300 font-medium mb-1.5 text-xs">
                          Select Contact Category
                        </label>
                        <select
                          value={selectedCategory}
                          onChange={(e) => setSelectedCategory(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 text-sm font-semibold"
                        >
                          {categories.map((cat) => {
                            const count =
                              categoryCounts[cat] ??
                              contacts.filter((c) => (c.category || "General") === cat).length;
                            return (
                              <option key={cat} value={cat}>
                                {cat} ({count} contact{count === 1 ? "" : "s"})
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-400 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                        <span>Target Audience for this Category:</span>
                        <span className="font-bold text-emerald-400">
                          {categoryCounts[selectedCategory] ??
                            contacts.filter((c) => (c.category || "General") === selectedCategory).length}{" "}
                          contacts
                        </span>
                      </div>
                    </div>
                  )}

                  {audienceType === "manual" && (
                    <div className="space-y-3 p-3 bg-slate-950/80 rounded-xl border border-slate-800">
                      <div className="flex items-center justify-between">
                        <label className="text-slate-300 text-xs font-semibold">
                          Select Specific Contacts ({selectedContactIds.length} selected)
                        </label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const ids = filteredManualContacts.map((c) => c.id);
                              setSelectedContactIds((prev) => Array.from(new Set([...prev, ...ids])));
                            }}
                            className="text-[11px] text-emerald-400 hover:text-emerald-300 font-medium"
                          >
                            Select All Filtered ({filteredManualContacts.length})
                          </button>
                          <span className="text-slate-600 text-[11px]">•</span>
                          <button
                            type="button"
                            onClick={() => setSelectedContactIds([])}
                            className="text-[11px] text-slate-400 hover:text-slate-300"
                          >
                            Deselect All
                          </button>
                        </div>
                      </div>

                      <div className="relative">
                        <Search className="absolute left-3 top-2.5 text-slate-500" size={14} />
                        <input
                          type="text"
                          value={contactSearch}
                          onChange={(e) => setContactSearch(e.target.value)}
                          placeholder="Search contacts by name, phone, or category..."
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs"
                        />
                      </div>

                      <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-800 bg-slate-900 divide-y divide-slate-800/60">
                        {filteredManualContacts.length === 0 ? (
                          <div className="p-4 text-center text-slate-500 text-xs">No contacts match search</div>
                        ) : (
                          filteredManualContacts.map((c) => {
                            const isChecked = selectedContactIds.includes(c.id);
                            return (
                              <label
                                key={c.id}
                                className={
                                  "flex items-center gap-3 p-2.5 hover:bg-slate-800/50 cursor-pointer text-xs transition " +
                                  (isChecked ? "bg-emerald-950/40" : "")
                                }
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedContactIds((prev) => [...prev, c.id]);
                                    } else {
                                      setSelectedContactIds((prev) => prev.filter((id) => id !== c.id));
                                    }
                                  }}
                                  className="rounded bg-slate-950 border-slate-700 text-emerald-500 focus:ring-emerald-500"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-white truncate">
                                      {c.name || "Unknown Name"}
                                    </span>
                                    {c.category && (
                                      <span className="px-1.5 py-0.5 text-[9px] bg-slate-800 text-slate-300 rounded border border-slate-700">
                                        {c.category}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                                    {c.phone_e164 || c.phone}
                                  </div>
                                </div>
                              </label>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}

                  {audienceType === "tag" && (
                    <div>
                      <label className="block text-slate-400 mb-1">Enter Tag Name</label>
                      <input
                        type="text"
                        value={selectedTag}
                        onChange={(e) => setSelectedTag(e.target.value)}
                        placeholder="e.g. VIP or Delivery"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  )}

                  {audienceType === "tier" && (
                    <div>
                      <label className="block text-slate-400 mb-1">Select Membership Tier</label>
                      <select
                        value={selectedTier}
                        onChange={(e) => setSelectedTier(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      >
                        <option value="">Choose tier...</option>
                        <option value="Platinum">Platinum</option>
                        <option value="Gold">Gold</option>
                        <option value="Silver">Silver</option>
                        <option value="Bronze">Bronze</option>
                      </select>
                    </div>
                  )}

                  {audienceType === "csv" && (
                    <div>
                      <label className="block text-slate-400 mb-1">
                        Paste Phone Numbers (comma or newline separated)
                      </label>
                      <textarea
                        value={csvPhones}
                        onChange={(e) => setCsvPhones(e.target.value)}
                        placeholder="+96170123456&#10;+9613123456&#10;03456789"
                        rows={4}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 font-mono text-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none text-xs"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">
                        Detected: {parseCsvPhonesList().length} phone numbers
                      </p>
                    </div>
                  )}

                  {/* Strict Marketing Opt-in Warning Banner */}
                  <div className="p-3 bg-amber-950/40 border border-amber-800/80 rounded-xl text-amber-200 text-xs">
                    <div className="flex items-center gap-2 font-bold mb-1">
                      <AlertTriangle size={14} className="text-amber-400" />
                      Marketing Consent Enforcement
                    </div>
                    <p className="text-[11px] text-amber-300/80">
                      In accordance with Meta WhatsApp policies, marketing templates should only be dispatched to contacts who have consented to promotional messages.
                    </p>
                    <div className="mt-2.5 flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="unoptedOverride"
                        checked={allowUnopted}
                        onChange={(e) => setAllowUnopted(e.target.checked)}
                        className="rounded bg-slate-950 border-slate-800 text-emerald-600 focus:ring-emerald-500"
                      />
                      <label htmlFor="unoptedOverride" className="text-[11px] text-amber-200 cursor-pointer">
                        Allow sending to contacts without registered opt-in (only if legally permitted)
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 4: Review & Launch */}
              {wizardStep === 4 && (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
                    <div className="flex justify-between border-b border-slate-800 pb-2">
                      <span className="text-slate-400">Campaign Name:</span>
                      <span className="font-bold text-white">{campaignName}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-800 pb-2">
                      <span className="text-slate-400">Template:</span>
                      <span className="font-mono text-purple-400">{selectedTemplate?.name} ({selectedTemplate?.language})</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-800 pb-2">
                      <span className="text-slate-400">Audience:</span>
                      <span className="font-medium text-emerald-400">
                        {audienceType === "category"
                          ? `Category: ${selectedCategory} (${categoryCounts[selectedCategory] ?? contacts.filter(c => (c.category || "General") === selectedCategory).length} contacts)`
                          : audienceType === "manual"
                          ? `Individual Contacts (${selectedContactIds.length} selected)`
                          : audienceType === "csv"
                          ? `CSV Numbers (${parseCsvPhonesList().length} numbers)`
                          : audienceType.replace("_", " ")}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Batch Rate Limiting:</span>
                      <span className="text-slate-300">Enabled (Safe batching via backend worker)</span>
                    </div>
                  </div>

                  <div>
                    <span className="text-slate-400 font-semibold mb-1 block">Message Preview:</span>
                    <div className="p-3 bg-emerald-950/30 border border-emerald-800/80 rounded-xl text-emerald-100 whitespace-pre-wrap text-sm space-y-2">
                      {headerMediaUrl && (
                        <div className="rounded-lg overflow-hidden border border-emerald-800/40 max-w-[220px] mb-2">
                          <img src={headerMediaUrl} alt="Header Preview" className="w-full h-auto object-cover max-h-[140px]" />
                        </div>
                      )}
                      <div>{getRenderedPreview()}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Controls */}
            <div className="p-4 px-6 border-t border-slate-800 flex items-center justify-between bg-slate-950/60">
              <button
                type="button"
                onClick={() => setWizardStep((s) => Math.max(1, s - 1))}
                disabled={wizardStep === 1}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Back
              </button>

              {wizardStep < 4 ? (
                <button
                  type="button"
                  onClick={() => {
                    if (wizardStep === 1 && (!campaignName.trim() || !selectedTemplate)) {
                      setWizardError("Campaign name and template are required");
                      return;
                    }
                    if (wizardStep === 3) {
                      if (audienceType === "manual" && selectedContactIds.length === 0) {
                        setWizardError("Please select at least one contact");
                        return;
                      }
                      if (audienceType === "csv" && parseCsvPhonesList().length === 0) {
                        setWizardError("Please enter at least one valid phone number");
                        return;
                      }
                    }
                    setWizardError(null);
                    setWizardStep((s) => s + 1);
                  }}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition"
                >
                  Continue
                  <ChevronRight size={14} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCreateAndSendCampaign}
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs flex items-center gap-2 transition active:scale-95 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  ) : (
                    <Send size={14} />
                  )}
                  Launch Campaign
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* CAMPAIGN RESULTS DETAIL MODAL */}
      {/* ========================================================= */}
      {selectedCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden flex flex-col max-h-[90vh] text-slate-100">
            {/* Header */}
            <div className="p-4 px-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div>
                <h3 className="font-bold text-base text-white flex items-center gap-2">
                  <BarChart3 size={18} className="text-emerald-500" />
                  Campaign Results: {selectedCampaign.name}
                </h3>
                <p className="text-xs text-slate-400">
                  Template: {selectedCampaign.template_name} • Status: {selectedCampaign.status}
                </p>
              </div>
              <button onClick={() => setSelectedCampaign(null)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            {/* Metrics Row */}
            <div className="p-5 border-b border-slate-800 bg-slate-950/40 grid grid-cols-2 sm:grid-cols-5 gap-3 text-center text-xs">
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                <div className="text-slate-500">Recipients</div>
                <div className="text-lg font-bold text-white mt-0.5">{selectedCampaign.total_recipients || 0}</div>
              </div>
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                <div className="text-slate-500">Sent</div>
                <div className="text-lg font-bold text-emerald-400 mt-0.5">{selectedCampaign.sent_count || 0}</div>
              </div>
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                <div className="text-slate-500">Delivered</div>
                <div className="text-lg font-bold text-blue-400 mt-0.5">{selectedCampaign.delivered_count || 0}</div>
              </div>
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                <div className="text-slate-500">Read</div>
                <div className="text-lg font-bold text-purple-400 mt-0.5">{selectedCampaign.read_count || 0}</div>
              </div>
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                <div className="text-slate-500">Failed</div>
                <div className="text-lg font-bold text-red-400 mt-0.5">{selectedCampaign.failed_count || 0}</div>
              </div>
            </div>

            {/* Recipient Filter Tabs */}
            <div className="p-3 px-6 border-b border-slate-800 bg-slate-900 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs">
                {["all", "sent", "delivered", "read", "failed"].map((rf) => (
                  <button
                    key={rf}
                    onClick={() => setRecipientFilter(rf)}
                    className={"px-2.5 py-1 rounded-full font-medium transition capitalize text-xs " +
                      (recipientFilter === rf
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-800 text-slate-400 hover:text-white")}
                  >
                    {rf}
                  </button>
                ))}
              </div>
              <button
                onClick={() => openCampaignDetails(selectedCampaign)}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
              >
                <RefreshCw size={12} /> Refresh
              </button>
            </div>

            {/* Recipient Table */}
            <div className="flex-1 overflow-y-auto p-4 text-xs">
              {loadingDetails ? (
                <div className="text-center py-12 text-slate-500">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500 mx-auto mb-2" />
                  Loading recipients...
                </div>
              ) : !campaignDetails?.recipients || campaignDetails.recipients.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  No recipients found matching this filter.
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead className="text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="py-2 px-3">Client</th>
                      <th className="py-2 px-3">Phone</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3">Sent At</th>
                      <th className="py-2 px-3">Delivered</th>
                      <th className="py-2 px-3">Read</th>
                      <th className="py-2 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {campaignDetails.recipients.map((rec) => (
                      <tr key={rec.id} className="hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-medium text-white">
                          {rec.contact_name || "Unknown"}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-emerald-400">
                          {rec.phone_e164}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={"px-2 py-0.5 rounded-full text-[10px] font-bold capitalize " +
                              (rec.status === "read"
                                ? "bg-purple-950 text-purple-300"
                                : rec.status === "delivered"
                                ? "bg-blue-950 text-blue-300"
                                : rec.status === "sent"
                                ? "bg-emerald-950 text-emerald-300"
                                : rec.status === "failed"
                                ? "bg-red-950 text-red-300"
                                : "bg-slate-800 text-slate-400")}
                          >
                            {rec.status}
                          </span>
                          {rec.error_message && (
                            <p className="text-[10px] text-red-400 mt-0.5">{rec.error_message}</p>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                          {rec.sent_at ? new Date(rec.sent_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-"}
                        </td>
                        <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                          {rec.delivered_at ? new Date(rec.delivered_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-"}
                        </td>
                        <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                          {rec.read_at ? new Date(rec.read_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-"}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={() => {
                              setSelectedCampaign(null);
                              onOpenChat(rec.phone_e164);
                            }}
                            className="px-2 py-0.5 bg-emerald-600/90 hover:bg-emerald-500 text-white rounded text-[11px] font-semibold"
                          >
                            Open Chat
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
