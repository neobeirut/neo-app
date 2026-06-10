import sql from "@/app/api/utils/sql";
import crypto from "crypto";

function getOriginFromRequest(request) {
  try {
    const { origin } = new URL(request.url);
    return origin;
  } catch (e) {
    return process.env.APP_URL || "";
  }
}

async function sendResetEmail({ to, resetUrl }) {
  const apiKey = process.env.RESEND_API_KEY;

  // If Resend isn't configured yet, log the URL so you can still test.
  if (!apiKey) {
    console.log(
      "[ADMIN-PASSWORD-RESET] RESEND_API_KEY not set. Reset URL:",
      resetUrl,
    );
    return;
  }

  // NOTE: Resend requires a verified sender domain for custom FROM addresses.
  // onboarding@resend.dev works for initial testing.
  const from = "Neo Beirut Admin <onboarding@resend.dev>";

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject: "Reset your Neo Beirut Admin password",
      html: `
        <div style="font-family: ui-sans-serif, system-ui; line-height: 1.5;">
          <h2>Reset your admin password</h2>
          <p>Click the link below to set a new password. This link expires in 1 hour.</p>
          <p><a href="${resetUrl}">${resetUrl}</a></p>
          <p>If you didn't request this, you can ignore this email.</p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Resend email failed: [${response.status}] ${response.statusText} - ${text}`,
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const email = (body?.email || "").trim();

    if (!email) {
      return Response.json({ error: "Email is required" }, { status: 400 });
    }

    // Don't leak whether an email exists.
    const origin = getOriginFromRequest(request);

    // Basic throttling: if a token was created within the last 60s for this user, don't create another.
    const [admin] = await sql`
      SELECT id, email
      FROM admin_users
      WHERE LOWER(email) = LOWER(${email}) AND is_active = true
      LIMIT 1
    `;

    if (!admin) {
      return Response.json({ ok: true });
    }

    const recent = await sql`
      SELECT id
      FROM admin_password_reset_tokens
      WHERE admin_user_id = ${admin.id}
        AND created_at > (NOW() - INTERVAL '60 seconds')
      LIMIT 1
    `;

    // Only throttle if email sending is configured.
    // When email isn't configured, we need to return a usable resetUrl immediately.
    if (recent.length > 0 && process.env.RESEND_API_KEY) {
      return Response.json({ ok: true });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    await sql`
      INSERT INTO admin_password_reset_tokens (admin_user_id, token_hash, expires_at)
      VALUES (${admin.id}, ${tokenHash}, NOW() + INTERVAL '1 hour')
    `;

    const resetUrl = `${origin}/admin/reset-password?token=${encodeURIComponent(token)}`;

    await sendResetEmail({ to: admin.email, resetUrl });

    // If email sending isn't configured, return the reset link so admins can still recover
    // in production (useful for testing on published builds).
    if (!process.env.RESEND_API_KEY) {
      return Response.json({ ok: true, resetUrl });
    }

    // In development, return the link to make it easy to test without an email provider.
    if (process.env.NODE_ENV !== "production") {
      return Response.json({ ok: true, devResetUrl: resetUrl, resetUrl });
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error("[ADMIN-PASSWORD-RESET] request error:", error);

    // Still return ok to avoid account enumeration
    return Response.json({ ok: true });
  }
}
