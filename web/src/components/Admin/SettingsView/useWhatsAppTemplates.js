import { useState, useEffect } from "react";
import { getAdminHeaders } from "@/utils/adminAuth";

export function useWhatsAppTemplates() {
  const [waTemplates, setWaTemplates] = useState({});
  const [waTemplateLoading, setWaTemplateLoading] = useState(false);
  const [waTemplateSaving, setWaTemplateSaving] = useState(false);
  const [waTemplateUpdatedAt, setWaTemplateUpdatedAt] = useState(null);
  const [waTestLoading, setWaTestLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadTemplates = async () => {
      setWaTemplateLoading(true);
      try {
        const res = await fetch("/api/settings/whatsapp-templates", {
          headers: getAdminHeaders(),
        });
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          if (!cancelled) {
            setWaTemplates(data?.templates || {});
            setWaTemplateUpdatedAt(data?.updated_at || null);
          }
        }
      } catch (e) {
        console.error("Failed to load WhatsApp templates", e);
      } finally {
        if (!cancelled) setWaTemplateLoading(false);
      }
    };

    loadTemplates();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSaveWhatsAppTemplates = async (e) => {
    e.preventDefault();
    setWaTemplateSaving(true);

    try {
      const response = await fetch("/api/settings/whatsapp-templates", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getAdminHeaders(),
        },
        body: JSON.stringify({
          templates: waTemplates,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const msg = payload?.error
          ? String(payload.error)
          : `Failed to save WhatsApp templates (status ${response.status})`;
        throw new Error(msg);
      }

      // Refresh
      try {
        const res = await fetch("/api/settings/whatsapp-templates", {
          headers: getAdminHeaders(),
        });
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          setWaTemplates(data?.templates || {});
          setWaTemplateUpdatedAt(data?.updated_at || null);
        }
      } catch (err) {
        // ignore
      }

      alert("WhatsApp templates saved!");
    } catch (error) {
      console.error("Error saving WhatsApp templates", error);
      alert(error?.message || "Failed to save WhatsApp templates");
    } finally {
      setWaTemplateSaving(false);
    }
  };

  const handleTestBirdConfig = async () => {
    setWaTestLoading(true);
    try {
      const response = await fetch("/api/admin/test-bird-config", {
        headers: getAdminHeaders(),
      });

      const data = await response.json().catch(() => ({}));

      if (data?.configured) {
        // Build detailed message
        let message = `✅ ${data.message}\n\n`;
        message += `🔧 Bird API Configuration:\n`;
        message += `  • Workspace ID: ${data.workspaceId}\n`;
        message += `  • Channel ID: ${data.channelId}\n`;
        message += `  • Locale: ${data.locale}\n\n`;

        // Templates
        if (data.templates) {
          message += `📝 Templates: ${data.templates.count} configured\n`;
          if (data.templates.issues && data.templates.issues.length > 0) {
            message += `\n⚠️ Template Issues:\n`;
            data.templates.issues.forEach((issue) => {
              message += `  • ${issue}\n`;
            });
          } else {
            message += `  ✅ All templates validated!\n`;
          }
          message += `\n`;
        }

        // Branches
        if (data.branches) {
          message += `🏢 Branches:\n`;
          message += `  • Total: ${data.branches.total}\n`;
          message += `  • With phone: ${data.branches.withPhone}\n`;
          if (data.branches.withoutPhone > 0) {
            message += `  ⚠️ Without phone: ${data.branches.withoutPhone}\n`;
            if (
              data.branches.missingPhone &&
              data.branches.missingPhone.length > 0
            ) {
              message += `     Missing: ${data.branches.missingPhone.join(", ")}\n`;
            }
          }
        }

        alert(message);
      } else {
        const errorMsg = data?.error || `Test failed (HTTP ${response.status})`;
        const hint = data?.hint ? `\n\n💡 Hint:\n${data.hint}` : "";
        const step = data?.step ? `\n\nFailed at: ${data.step}` : "";
        alert(`❌ Bird Configuration Test Failed\n\n${errorMsg}${step}${hint}`);
      }
    } catch (error) {
      console.error("Error testing Bird config:", error);
      alert(`❌ Failed to test Bird configuration:\n\n${error.message}`);
    } finally {
      setWaTestLoading(false);
    }
  };

  return {
    waTemplates,
    setWaTemplates,
    waTemplateLoading,
    waTemplateSaving,
    waTemplateUpdatedAt,
    waTestLoading,
    handleSaveWhatsAppTemplates,
    handleTestBirdConfig,
  };
}
