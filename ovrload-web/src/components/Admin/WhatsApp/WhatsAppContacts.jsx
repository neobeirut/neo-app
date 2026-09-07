"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Users,
  Search,
  Plus,
  Filter,
  Phone,
  Mail,
  Tag,
  MessageSquare,
  Edit2,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  X,
  Upload,
  Download,
  FileSpreadsheet,
  Check,
} from "lucide-react";

const DEFAULT_CATEGORIES = [
  "General",
  "VIP",
  "Regular",
  "Lead",
  "Gym Member",
  "Supplier",
  "Staff",
];

const CATEGORY_STYLES = {
  VIP: "bg-purple-950/80 text-purple-300 border-purple-800/80",
  Lead: "bg-amber-950/80 text-amber-300 border-amber-800/80",
  "Gym Member": "bg-emerald-950/80 text-emerald-300 border-emerald-800/80",
  Regular: "bg-blue-950/80 text-blue-300 border-blue-800/80",
  Staff: "bg-cyan-950/80 text-cyan-300 border-cyan-800/80",
  Supplier: "bg-orange-950/80 text-orange-300 border-orange-800/80",
  General: "bg-slate-800/80 text-slate-300 border-slate-700",
};

function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCSVClient(text) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) return [];

  const rawHeaders = parseCSVLine(lines[0]);
  const headers = rawHeaders.map((h) =>
    h.toLowerCase().replace(/[^a-z0-9]/g, "")
  );

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] !== undefined ? values[idx] : "";
    });
    rows.push(row);
  }
  return rows;
}

function getField(row, keys) {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== "") {
      return String(row[k]).trim();
    }
  }
  return "";
}

export default function WhatsAppContacts({ adminToken, onOpenChat }) {
  const [contacts, setContacts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [optInFilter, setOptInFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [availableCategories, setAvailableCategories] = useState(DEFAULT_CATEGORIES);
  const [page, setPage] = useState(1);
  const limit = 25;

  // Add / Edit Contact Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formCategory, setFormCategory] = useState("General");
  const [customCategory, setCustomCategory] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formTags, setFormTags] = useState("");
  const [formOptIn, setFormOptIn] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  // Import Modal State
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importPreviewRows, setImportPreviewRows] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importError, setImportError] = useState(null);
  const fileInputRef = useRef(null);

  const getEffectiveToken = () => {
    return (
      adminToken ||
      (typeof window !== "undefined" ? localStorage.getItem("admin_token") : "") ||
      ""
    );
  };

  useEffect(() => {
    fetchContacts();
  }, [page, optInFilter, categoryFilter]);

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const offset = (page - 1) * limit;
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(offset),
      });
      if (search.trim()) params.set("search", search.trim());
      if (optInFilter === "opted_in") params.set("opt_in", "true");
      if (optInFilter === "not_opted_in") params.set("opt_in", "false");
      if (categoryFilter && categoryFilter !== "all") params.set("category", categoryFilter);

      const res = await fetch("/api/whatsapp/contacts?" + params.toString(), {
        headers: { "x-admin-token": getEffectiveToken() },
      });
      const data = await res.json();
      if (data.ok) {
        setContacts(data.contacts || []);
        setTotal(data.total || 0);
        if (data.categories && Array.isArray(data.categories)) {
          const merged = Array.from(new Set([...DEFAULT_CATEGORIES, ...data.categories])).filter(Boolean);
          setAvailableCategories(merged);
        }
      }
    } catch (err) {
      console.error("Failed fetching contacts:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchContacts();
  };

  const openAddModal = () => {
    setEditingContact(null);
    setFormName("");
    setFormPhone("");
    setFormEmail("");
    setFormCategory("General");
    setCustomCategory("");
    setFormNotes("");
    setFormTags("");
    setFormOptIn(false);
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (contact) => {
    setEditingContact(contact);
    setFormName(contact.name || "");
    setFormPhone(contact.phone_e164 || "");
    setFormEmail(contact.email || "");
    const cat = contact.category || "General";
    if (DEFAULT_CATEGORIES.includes(cat)) {
      setFormCategory(cat);
      setCustomCategory("");
    } else {
      setFormCategory("Custom");
      setCustomCategory(cat);
    }
    setFormNotes(contact.notes || "");
    setFormTags((contact.tags || []).join(", "));
    setFormOptIn(Boolean(contact.whatsapp_opt_in));
    setFormError(null);
    setModalOpen(true);
  };

  const handleSaveContact = async (e) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError(null);

    const tagsArray = formTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const resolvedCategory =
      formCategory === "Custom" ? customCategory.trim() || "General" : formCategory;

    try {
      const url = editingContact
        ? "/api/whatsapp/contacts/" + editingContact.id
        : "/api/whatsapp/contacts";
      const method = editingContact ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": getEffectiveToken(),
        },
        body: JSON.stringify({
          name: formName,
          phone: formPhone,
          email: formEmail,
          category: resolvedCategory,
          notes: formNotes,
          tags: tagsArray,
          whatsapp_opt_in: formOptIn,
          opt_in_source: "manual",
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setModalOpen(false);
        fetchContacts();
      } else {
        setFormError(data.error || "Failed to save contact");
      }
    } catch (err) {
      setFormError("Network error");
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleQuickToggleOptIn = async (contact) => {
    try {
      await fetch("/api/whatsapp/contacts/" + contact.id, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": getEffectiveToken(),
        },
        body: JSON.stringify({
          whatsapp_opt_in: !contact.whatsapp_opt_in,
          whatsapp_opt_in_source: "staff_quick_toggle",
        }),
      });
      fetchContacts();
    } catch (e) {}
  };

  // Import handlers
  const openImportModal = () => {
    setImportFile(null);
    setImportPreviewRows([]);
    setImportResult(null);
    setImportError(null);
    setImporting(false);
    setImportModalOpen(true);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    setImportError(null);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result || "";
        const parsed = parseCSVClient(content);
        if (parsed.length === 0) {
          setImportError("The selected CSV file appears to be empty or has no data rows.");
          setImportPreviewRows([]);
          return;
        }
        setImportPreviewRows(parsed);
      } catch (err) {
        setImportError("Failed to parse CSV file: " + err.message);
      }
    };
    reader.onerror = () => {
      setImportError("Failed to read file.");
    };
    reader.readAsText(file);
  };

  const handleDownloadSampleCsv = () => {
    const sample =
      "Name,Phone,Category,Email,OptIn,Tags,Notes\r\n" +
      'John Doe,+96170123456,VIP,john@example.com,yes,"VIP,Morning",Gold member\r\n' +
      'Sara Smith,03123456,Regular,sara@example.com,yes,"Crossfit",\r\n' +
      'Karim Nassar,81202607,Lead,karim@example.com,no,"Instagram",Inquired about membership\r\n' +
      'Nour Haddad,+9613987654,Gym Member,nour@example.com,yes,"Evening",Workout enthusiast';

    const blob = new Blob([sample], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "whatsapp_contacts_sample.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExecuteImport = async () => {
    if (!importPreviewRows.length) return;
    setImporting(true);
    setImportError(null);

    try {
      const res = await fetch("/api/whatsapp/contacts/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": getEffectiveToken(),
        },
        body: JSON.stringify({ contacts: importPreviewRows }),
      });

      const data = await res.json();
      if (data.ok) {
        setImportResult(data);
        fetchContacts();
      } else {
        setImportError(data.error || "Bulk import failed");
      }
    } catch (err) {
      setImportError("Network error during import");
    } finally {
      setImporting(false);
    }
  };

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="space-y-4">
      {/* Top Action Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 p-4 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-950/80 border border-emerald-800/80 flex items-center justify-center text-emerald-400">
            <Users size={20} />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">WhatsApp Contacts</h2>
            <p className="text-xs text-slate-400">
              {total} verified client{total !== 1 ? "s" : ""} in local database
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search Form */}
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, phone, tags..."
              className="pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-44 sm:w-56"
            />
          </form>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
            className="bg-slate-950 border border-slate-800 text-slate-300 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="all">All Categories</option>
            {availableCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          {/* Opt-in Filter */}
          <select
            value={optInFilter}
            onChange={(e) => {
              setOptInFilter(e.target.value);
              setPage(1);
            }}
            className="bg-slate-950 border border-slate-800 text-slate-300 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="all">All Opt-in</option>
            <option value="opted_in">✓ Opted In</option>
            <option value="not_opted_in">✗ Not Opted In</option>
          </select>

          {/* Refresh Button */}
          <button
            onClick={fetchContacts}
            className="p-1.5 bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl text-xs transition active:scale-95 shrink-0"
            title="Refresh Contacts"
          >
            <RefreshCw size={14} className={loading ? "animate-spin text-emerald-400" : ""} />
          </button>

          {/* Import Contacts Button */}
          <button
            onClick={openImportModal}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition active:scale-95 shrink-0"
            title="Import Contacts from CSV"
          >
            <Upload size={14} className="text-emerald-400" />
            <span>Import</span>
          </button>

          {/* Add Contact Button */}
          <button
            onClick={openAddModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-sm active:scale-95 shrink-0"
          >
            <Plus size={15} />
            Add Contact
          </button>
        </div>
      </div>

      {/* Contacts Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Client Name</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Phone (E.164)</th>
                <th className="py-3 px-4">Marketing Opt-In</th>
                <th className="py-3 px-4">CRM Account</th>
                <th className="py-3 px-4">Tags</th>
                <th className="py-3 px-4">Last Activity</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500 mx-auto mb-2" />
                    Loading contacts...
                  </td>
                </tr>
              ) : contacts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-500">
                    <Users className="w-8 h-8 text-slate-700 mx-auto mb-2 opacity-50" />
                    <p className="font-semibold text-slate-400">No contacts found</p>
                    <p className="mt-1 text-slate-600">
                      Contacts are created automatically when customers message or can be imported via CSV.
                    </p>
                  </td>
                </tr>
              ) : (
                contacts.map((contact) => (
                  <tr key={contact.id} className="hover:bg-slate-800/40 transition">
                    {/* Name */}
                    <td className="py-3.5 px-4 font-semibold text-white">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-emerald-400 font-bold text-[10px] shrink-0 border border-slate-700">
                          {((contact.name || contact.phone_e164).slice(0, 2) || "WA").toUpperCase()}
                        </div>
                        <div className="truncate max-w-[150px]">
                          <span className="truncate">{contact.name || "Unnamed"}</span>
                          {contact.notes && (
                            <p className="text-[10px] text-slate-500 truncate font-normal">{contact.notes}</p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="py-3.5 px-4">
                      <span
                        className={
                          "inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold border " +
                          (CATEGORY_STYLES[contact.category] ||
                            "bg-slate-800/80 text-slate-300 border-slate-700")
                        }
                      >
                        {contact.category || "General"}
                      </span>
                    </td>

                    {/* Phone */}
                    <td className="py-3.5 px-4 font-mono text-emerald-400">
                      {contact.phone_e164}
                    </td>

                    {/* Opt-In */}
                    <td className="py-3.5 px-4">
                      <button
                        onClick={() => handleQuickToggleOptIn(contact)}
                        className={
                          "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border transition " +
                          (contact.whatsapp_opt_in
                            ? "bg-emerald-950 text-emerald-300 border-emerald-800 hover:bg-emerald-900"
                            : "bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800")
                        }
                      >
                        {contact.whatsapp_opt_in ? (
                          <>
                            <CheckCircle size={11} className="text-emerald-400" />
                            Opted In
                          </>
                        ) : (
                          <>
                            <XCircle size={11} className="text-slate-500" />
                            No Consent
                          </>
                        )}
                      </button>
                    </td>

                    {/* CRM Account */}
                    <td className="py-3.5 px-4">
                      {contact.customer_id ? (
                        <div className="text-[11px]">
                          <span className="text-white font-medium">{contact.customer_name}</span>
                          <div className="text-[10px] text-slate-500">
                            {contact.customer_tier || "Standard"} •{" "}
                            {contact.customer_total_spent
                              ? "$" + parseFloat(contact.customer_total_spent).toFixed(0)
                              : "$0"}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-600 text-[11px] italic">Not linked</span>
                      )}
                    </td>

                    {/* Tags */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1 max-w-[160px]">
                        {(contact.tags || []).map((t, idx) => (
                          <span
                            key={idx}
                            className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px]"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* Last Activity */}
                    <td className="py-3.5 px-4 text-[11px] text-slate-400">
                      {contact.last_message_at
                        ? new Date(contact.last_message_at).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                          })
                        : "Never"}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onOpenChat && onOpenChat(contact.phone_e164)}
                          className="px-2.5 py-1 bg-emerald-600/90 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition active:scale-95"
                          title="Open WhatsApp Chat"
                        >
                          <MessageSquare size={13} />
                          Chat
                        </button>
                        <button
                          onClick={() => openEditModal(contact)}
                          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                          title="Edit Contact"
                        >
                          <Edit2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-3.5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400">
          <span>
            Showing {contacts.length > 0 ? (page - 1) * limit + 1 : 0} to{" "}
            {Math.min(page * limit, total)} of {total} contacts
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-lg border border-slate-800 text-slate-300 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="font-bold text-slate-300">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg border border-slate-800 text-slate-300 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Add / Edit Contact Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col text-slate-100">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Users size={16} className="text-emerald-500" />
                {editingContact ? "Edit Contact" : "Add New Contact"}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveContact} className="p-5 space-y-3.5 text-xs">
              {formError && (
                <div className="p-2.5 bg-red-950/80 border border-red-800 text-red-300 rounded-xl flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0 text-red-400" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Full Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  Phone Number (E.164) *
                </label>
                <input
                  type="text"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="e.g. +961 70 123 456 or 03123456"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 font-mono text-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Lebanese local numbers (03..., 70...) will be converted automatically to +961 format.
                </p>
              </div>

              {/* Category Field */}
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Category</label>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    {DEFAULT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                    <option value="Custom">+ Custom Category</option>
                  </select>

                  {formCategory === "Custom" && (
                    <input
                      type="text"
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      placeholder="Type category..."
                      required
                      className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Email Address</label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="client@example.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  Tags (comma separated)
                </label>
                <input
                  type="text"
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                  placeholder="VIP, Delivery, Morning"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Internal Notes</label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Special instructions, dietary preferences, delivery directions..."
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
                />
              </div>

              {/* Marketing Opt-In Checkbox */}
              <div className="pt-1 flex items-start gap-2.5">
                <input
                  type="checkbox"
                  id="optInCheck"
                  checked={formOptIn}
                  onChange={(e) => setFormOptIn(e.target.checked)}
                  className="mt-0.5 rounded bg-slate-950 border-slate-800 text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="optInCheck" className="text-slate-300 font-medium cursor-pointer">
                  Client has opted in to receive WhatsApp marketing messages & campaigns
                </label>
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
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl active:scale-95 transition disabled:opacity-50"
                >
                  {formSubmitting
                    ? "Saving..."
                    : editingContact
                    ? "Save Changes"
                    : "Create Contact"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col text-slate-100 max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-950/80 border border-emerald-800/80 flex items-center justify-center text-emerald-400">
                  <FileSpreadsheet size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Import Contacts from CSV</h3>
                  <p className="text-[11px] text-slate-400">
                    Bulk upload client phone numbers, categories, tags, and consent
                  </p>
                </div>
              </div>
              <button
                onClick={() => setImportModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 overflow-y-auto text-xs">
              {/* Sample Template & Format Guide */}
              <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-200">Need a CSV template?</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Download our sample format with columns: <span className="font-mono text-emerald-400">Name, Phone, Category, Email, OptIn, Tags, Notes</span>
                  </p>
                </div>
                <button
                  onClick={handleDownloadSampleCsv}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 rounded-xl font-semibold transition shrink-0 active:scale-95"
                >
                  <Download size={13} />
                  Sample CSV
                </button>
              </div>

              {/* Upload Dropzone */}
              {!importResult && (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-700 hover:border-emerald-500/60 bg-slate-950/40 hover:bg-slate-950/80 rounded-2xl p-6 text-center cursor-pointer transition group"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  <div className="w-12 h-12 rounded-2xl bg-slate-800/80 group-hover:bg-emerald-950/60 text-slate-400 group-hover:text-emerald-400 flex items-center justify-center mx-auto mb-3 transition border border-slate-700">
                    <Upload size={22} />
                  </div>
                  <p className="font-semibold text-white">
                    {importFile ? importFile.name : "Click to select a CSV file"}
                  </p>
                  <p className="text-slate-500 text-[11px] mt-1">
                    {importFile
                      ? (importFile.size / 1024).toFixed(1) + " KB • Ready to import"
                      : "Supports standard CSV with Lebanese or international numbers"}
                  </p>
                </div>
              )}

              {/* Error Message */}
              {importError && (
                <div className="p-3 bg-red-950/80 border border-red-800 text-red-300 rounded-xl flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0 text-red-400" />
                  <span>{importError}</span>
                </div>
              )}

              {/* Success Result */}
              {importResult && (
                <div className="p-4 bg-emerald-950/70 border border-emerald-800 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
                    <CheckCircle size={18} className="text-emerald-400" />
                    <span>Import Completed Successfully!</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                    <div className="p-2.5 bg-slate-900/80 rounded-xl border border-emerald-900/60">
                      <div className="text-lg font-bold text-white">
                        {importResult.totalProcessed || 0}
                      </div>
                      <div className="text-[10px] text-slate-400">Total Processed</div>
                    </div>
                    <div className="p-2.5 bg-slate-900/80 rounded-xl border border-emerald-900/60">
                      <div className="text-lg font-bold text-emerald-400">
                        {importResult.imported || 0}
                      </div>
                      <div className="text-[10px] text-slate-400">New Inserted</div>
                    </div>
                    <div className="p-2.5 bg-slate-900/80 rounded-xl border border-emerald-900/60">
                      <div className="text-lg font-bold text-cyan-400">
                        {importResult.updated || 0}
                      </div>
                      <div className="text-[10px] text-slate-400">Existing Updated</div>
                    </div>
                  </div>

                  {importResult.errors && importResult.errors.length > 0 && (
                    <div className="mt-3 p-3 bg-amber-950/60 border border-amber-800/80 rounded-xl text-[11px] text-amber-200">
                      <p className="font-semibold mb-1">
                        ⚠ {importResult.errors.length} rows were skipped due to invalid phone formatting:
                      </p>
                      <ul className="list-disc list-inside space-y-0.5 text-amber-300/80 max-h-24 overflow-y-auto">
                        {importResult.errors.slice(0, 10).map((e, idx) => (
                          <li key={idx}>
                            Row {e.row}: {e.phone || "Unknown"} — {e.error}
                          </li>
                        ))}
                        {importResult.errors.length > 10 && (
                          <li>...and {importResult.errors.length - 10} more rows.</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Preview Table */}
              {importPreviewRows.length > 0 && !importResult && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="font-semibold text-slate-300">
                      Preview: Found {importPreviewRows.length} contact{importPreviewRows.length !== 1 ? "s" : ""}
                    </span>
                    <span className="text-[11px]">Showing first 5 rows</span>
                  </div>
                  <div className="border border-slate-800 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-[11px] text-slate-300">
                      <thead className="bg-slate-950 text-slate-400 uppercase text-[9px] border-b border-slate-800">
                        <tr>
                          <th className="p-2">Name</th>
                          <th className="p-2">Phone</th>
                          <th className="p-2">Category</th>
                          <th className="p-2">Opt-In</th>
                          <th className="p-2">Tags</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                        {importPreviewRows.slice(0, 5).map((row, idx) => {
                          const phone = getField(row, ["phone", "phonenumber", "mobile", "number"]);
                          const name = getField(row, ["name", "fullname", "clientname"]) || "Unnamed";
                          const category = getField(row, ["category", "group", "type"]) || "General";
                          const optInRaw = getField(row, ["optin", "optinconsent", "consent", "whatsappoptin"]);
                          const tags = getField(row, ["tags", "tag"]);

                          return (
                            <tr key={idx}>
                              <td className="p-2 font-medium text-white">{name}</td>
                              <td className="p-2 font-mono text-emerald-400">{phone || "—"}</td>
                              <td className="p-2">
                                <span
                                  className={
                                    "px-2 py-0.5 rounded-full text-[9px] font-semibold border " +
                                    (CATEGORY_STYLES[category] || "bg-slate-800 text-slate-300 border-slate-700")
                                  }
                                >
                                  {category}
                                </span>
                              </td>
                              <td className="p-2 text-slate-400">{optInRaw || "no"}</td>
                              <td className="p-2 text-slate-500 truncate max-w-[120px]">{tags || "—"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                className="px-4 py-2 text-slate-400 hover:text-white text-xs font-semibold"
              >
                {importResult ? "Close" : "Cancel"}
              </button>

              {!importResult ? (
                <button
                  type="button"
                  onClick={handleExecuteImport}
                  disabled={importing || importPreviewRows.length === 0}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl active:scale-95 transition disabled:opacity-50 text-xs flex items-center gap-1.5"
                >
                  {importing ? (
                    <>
                      <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload size={14} />
                      Import {importPreviewRows.length} Contacts
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setImportResult(null);
                    setImportFile(null);
                    setImportPreviewRows([]);
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl text-xs transition"
                >
                  Import Another File
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
