"use client";

import React, { useState, useEffect } from "react";
import { X, Send, AlertCircle, FileText, CheckCircle } from "lucide-react";

export default function SendTemplateModal({
  isOpen,
  onClose,
  conversationId,
  recipientName,
  recipientPhone,
  adminToken,
  onSuccess,
}) {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [variables, setVariables] = useState({});
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
      setError(null);
    }
  }, [isOpen]);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/whatsapp/templates", {
        headers: { "x-admin-token": adminToken },
      });
      const data = await res.json();
      if (data.ok && data.templates) {
        setTemplates(data.templates);
        if (data.templates.length > 0) {
          selectTemplate(data.templates[0]);
        }
      }
    } catch (err) {
      console.error("Failed to fetch templates:", err);
      setError("Failed to load approved templates");
    } finally {
      setLoading(false);
    }
  };

  const selectTemplate = (tpl) => {
    setSelectedTemplate(tpl);
    const matches = (tpl.body || "").match(/\{\{(\d+)\}\}/g) || [];
    const initialVars = {};
    matches.forEach((m) => {
      const num = m.replace(/[^0-9]/g, "");
      initialVars[num] = "";
    });
    setVariables(initialVars);
  };

  const handleVariableChange = (num, value) => {
    setVariables((prev) => ({ ...prev, [num]: value }));
  };

  const getRenderedPreview = () => {
    if (!selectedTemplate) return "";
    let preview = selectedTemplate.body || "";
    Object.entries(variables).forEach(([num, val]) => {
      const token = "{{" + num + "}}";
      preview = preview.split(token).join(val || token);
    });
    return preview;
  };

  const handleSend = async () => {
    if (!selectedTemplate || !conversationId) return;

    setSending(true);
    setError(null);

    const placeholderKeys = Object.keys(variables).sort((a, b) => Number(a) - Number(b));
    const placeholders = placeholderKeys.map((k) => variables[k] || "");

    try {
      const res = await fetch("/api/whatsapp/conversations/" + conversationId + "/templates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": adminToken,
        },
        body: JSON.stringify({
          templateName: selectedTemplate.name,
          language: selectedTemplate.language || "en",
          placeholders,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        if (onSuccess) onSuccess(data.message);
        onClose();
      } else {
        setError(data.error || "Failed to send template");
      }
    } catch (err) {
      console.error("Template send failed:", err);
      setError("Failed to send template message");
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden border border-gray-100 flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
          <div>
            <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-600" />
              Send Approved WhatsApp Template
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              To: <span className="font-medium text-gray-700">{recipientName}</span> ({recipientPhone})
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200/60 transition"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="text-center py-8 text-gray-500">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto mb-2"></div>
              Loading approved templates...
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <AlertCircle className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="font-medium">No approved templates found</p>
              <p className="text-xs text-gray-400 mt-1">
                Please sync or add templates in WhatsApp &gt; Templates
              </p>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                  Select Template
                </label>
                <select
                  value={selectedTemplate?.id || ""}
                  onChange={(e) => {
                    const tpl = templates.find((t) => String(t.id) === e.target.value);
                    if (tpl) selectTemplate(tpl);
                  }}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                >
                  {templates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.name} ({tpl.language}) — {tpl.category || "UTILITY"}
                    </option>
                  ))}
                </select>
              </div>

              {Object.keys(variables).length > 0 && (
                <div className="space-y-3 pt-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600">
                    Template Variables
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {Object.keys(variables).map((num) => (
                      <div key={num}>
                        <label className="block text-xs text-gray-500 mb-1">
                          Variable &#123;&#123;{num}&#125;&#125;
                        </label>
                        <input
                          type="text"
                          value={variables[num]}
                          onChange={(e) => handleVariableChange(num, e.target.value)}
                          placeholder={"Value for {{" + num + "}}"}
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                  Live Message Preview
                </label>
                <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-xl text-sm text-gray-800 whitespace-pre-wrap font-sans relative">
                  {selectedTemplate?.header && (
                    <div className="font-bold text-gray-900 mb-2">{selectedTemplate.header}</div>
                  )}
                  <div>{getRenderedPreview()}</div>
                  {selectedTemplate?.footer && (
                    <div className="text-xs text-gray-500 mt-2 italic">{selectedTemplate.footer}</div>
                  )}
                  <span className="absolute bottom-2 right-3 text-[10px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-medium">
                    Meta Template
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium rounded-lg hover:bg-gray-200/50 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={!selectedTemplate || sending || loading}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-xl shadow-sm transition"
          >
            {sending ? (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            ) : (
              <Send size={15} />
            )}
            Send Template Message
          </button>
        </div>
      </div>
    </div>
  );
}
