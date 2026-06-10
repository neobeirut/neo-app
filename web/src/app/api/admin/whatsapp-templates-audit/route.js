import { getAdminWithRolesFromRequest } from "@/app/api/utils/adminAuth";
import {
  auditAllTemplates,
  getAllTemplateKeys,
  getTemplateStructure,
} from "@/app/api/utils/whatsappTemplateRegistry";

/**
 * WhatsApp Templates Audit Endpoint
 *
 * Returns comprehensive audit of all WhatsApp templates:
 * - Templates defined in registry vs database
 * - Template structure details
 * - Configuration validation
 * - Missing or misconfigured templates
 */
export async function GET(request) {
  try {
    const admin = await getAdminWithRolesFromRequest(request);
    if (!admin) {
      return Response.json(
        { ok: false, error: "Admin authentication required" },
        { status: 401 },
      );
    }

    const roles = Array.isArray(admin?.roles) ? admin.roles : [];
    const hasAccess = roles.includes("backend") || roles.includes("settings");

    if (!hasAccess) {
      return Response.json(
        { ok: false, error: "Unauthorized - settings permission required" },
        { status: 403 },
      );
    }

    // Get all templates from database
    const dbTemplates = await auditAllTemplates();

    // Get all template keys defined in registry
    const registryKeys = getAllTemplateKeys();

    // Find templates in registry but not in database
    const missingInDb = registryKeys.filter(
      (key) => !dbTemplates.find((t) => t.key === key),
    );

    // Organize by status
    const valid = dbTemplates.filter(
      (t) => t.hasStructure && t.issues.length === 0,
    );
    const hasIssues = dbTemplates.filter((t) => t.issues.length > 0);
    const noStructure = dbTemplates.filter((t) => !t.hasStructure);

    return Response.json({
      ok: true,
      summary: {
        totalInDatabase: dbTemplates.length,
        totalInRegistry: registryKeys.length,
        valid: valid.length,
        hasIssues: hasIssues.length,
        noStructure: noStructure.length,
        missingInDatabase: missingInDb.length,
      },
      templates: dbTemplates.map((t) => ({
        key: t.key,
        dbKey: t.dbKey,
        templateName: t.config?.template_name || t.config?.templateName,
        language: t.config?.language || t.config?.locale || "en (default)",
        hasStructure: t.hasStructure,
        structure: t.structure
          ? {
              category: t.structure.category,
              bodyPlaceholders: t.structure.bodyPlaceholderCount,
              hasButtons: t.structure.hasButtons,
              buttonType: t.structure.buttonStructure?.type || null,
            }
          : null,
        issues: t.issues,
        updatedAt: t.updatedAt,
      })),
      missingInDatabase: missingInDb.map((key) => ({
        key,
        structure: getTemplateStructure(key),
        recommendation: `Configure this template in Admin → Settings → WhatsApp Templates`,
      })),
      registryKeys,
    });
  } catch (error) {
    console.error("[whatsapp-templates-audit GET] error", error);
    return Response.json(
      { ok: false, error: error.message || "Failed to audit templates" },
      { status: 500 },
    );
  }
}
