"use client";

import React, { useState, useEffect } from "react";
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
} from "lucide-react";

export default function WhatsAppContacts({ adminToken, onOpenChat }) {
  const [contacts, setContacts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [optInFilter, setOptInFilter] = useState("all");
  const [page, setPage] = useState(1);
  const limit = 25;

  // Add / Edit Contact Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formTags, setFormTags] = useState("");
  const [formOptIn, setFormOptIn] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  useEffect(() => {
    fetchContacts();
  }, [page, optInFilter]);

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

      const res = await fetch("/api/whatsapp/contacts?" + params.toString(), {
        headers: { "x-admin-token": adminToken },
      });
      const data = await res.json();
      if (data.ok) {
        setContacts(data.contacts || []);
        setTotal(data.total || 0);
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

    try {
      const url = editingContact
        ? "/api/whatsapp/contacts/" + editingContact.id
        : "/api/whatsapp/contacts";
      const method = editingContact ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": adminToken,
        },
        body: JSON.stringify({
          name: formName,
          phone: formPhone,
          email: formEmail,
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
          "x-admin-token": adminToken,
        },
        body: JSON.stringify({
          whatsapp_opt_in: !contact.whatsapp_opt_in,
          whatsapp_opt_in_source: "staff_quick_toggle",
        }),
      });
      fetchContacts();
    } catch (e) {}
  };

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="space-y-4">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 p-4 rounded-2xl">
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

        <div className="flex items-center gap-2">
          {/* Search Form */}
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, phone, tags..."
              className="pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-48 sm:w-64"
            />
          </form>

          {/* Opt-in Filter */}
          <select
            value={optInFilter}
            onChange={(e) => {
              setOptInFilter(e.target.value);
              setPage(1);
            }}
            className="bg-slate-950 border border-slate-800 text-slate-300 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="all">All Opt-in Status</option>
            <option value="opted_in">✓ Opted In Only</option>
            <option value="not_opted_in">✗ Not Opted In</option>
          </select>

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
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500 mx-auto mb-2" />
                    Loading contacts...
                  </td>
                </tr>
              ) : contacts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-500">
                    <Users className="w-8 h-8 text-slate-700 mx-auto mb-2 opacity-50" />
                    <p className="font-semibold text-slate-400">No contacts found</p>
                    <p className="mt-1 text-slate-600">Contacts are created automatically when customers message or can be added manually.</p>
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
                        <div className="truncate max-w-[160px]">
                          <span className="truncate">{contact.name || "Unnamed"}</span>
                          {contact.notes && (
                            <p className="text-[10px] text-slate-500 truncate font-normal">{contact.notes}</p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Phone */}
                    <td className="py-3.5 px-4 font-mono text-emerald-400">
                      {contact.phone_e164}
                    </td>

                    {/* Opt-In */}
                    <td className="py-3.5 px-4">
                      <button
                        onClick={() => handleQuickToggleOptIn(contact)}
                        className={"inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border transition " +
                          (contact.whatsapp_opt_in
                            ? "bg-emerald-950 text-emerald-300 border-emerald-800 hover:bg-emerald-900"
                            : "bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800")}
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
                            {contact.customer_tier || "Standard"} • {contact.customer_total_spent ? "$" + parseFloat(contact.customer_total_spent).toFixed(0) : "$0"}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-600 text-[11px] italic">Not linked</span>
                      )}
                    </td>

                    {/* Tags */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1 max-w-[180px]">
                        {(contact.tags || []).map((t, idx) => (
                          <span key={idx} className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px]">
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
            Showing {contacts.length > 0 ? (page - 1) * limit + 1 : 0} to {Math.min(page * limit, total)} of {total} contacts
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
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-white">
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
                <label className="block text-slate-400 font-semibold mb-1">Phone Number (E.164) *</label>
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
                <label className="block text-slate-400 font-semibold mb-1">Tags (comma separated)</label>
                <input
                  type="text"
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                  placeholder="VIP, Delivery, Catering"
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
                  {formSubmitting ? "Saving..." : editingContact ? "Save Changes" : "Create Contact"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
