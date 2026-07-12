import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * Minimal transactional email via Resend's REST API — zero dependencies (just
 * fetch). Best-effort: if RESEND_API_KEY / EMAIL_FROM aren't configured, or the
 * send fails, we log and move on. Approval must never hinge on email delivery.
 */
async function send(to: string, subject: string, html: string): Promise<void> {
  if (!env.resendApiKey || !env.emailFrom) {
    logger.info("email_skipped", { reason: "not_configured", to, subject });
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.resendApiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ from: env.emailFrom, to, subject, html }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.warn("email_send_failed", { to, status: res.status, body: body.slice(0, 200) });
    } else {
      logger.info("email_sent", { to, subject });
    }
  } catch (err) {
    logger.warn("email_send_error", { to, error: err instanceof Error ? err.message : String(err) });
  }
}

/** "You're in" — sent when an admin approves a user's alpha-access request. */
export async function sendAccessApprovedEmail(
  to: string,
  name: string,
  appUrl: string,
): Promise<void> {
  const first = name?.split(" ")[0] || "there";
  const html = `
    <div style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:520px;margin:0 auto;color:#111">
      <h1 style="font-size:22px;margin:0 0 12px">🎉 You're in — welcome to the Syntra alpha</h1>
      <p style="font-size:15px;line-height:1.6;color:#444">
        Hi ${first}, your access to the Syntra private alpha has been approved. You can now
        run real, AI-driven SEO audits on your site.
      </p>
      <p style="margin:22px 0">
        <a href="${appUrl}" style="background:#0d9488;color:#fff;text-decoration:none;padding:11px 20px;border-radius:10px;font-weight:600;font-size:15px">Run your first audit →</a>
      </p>
      <p style="font-size:13px;color:#888">You're one of a small group shaping Syntra — we'd love your feedback.</p>
    </div>`;
  await send(to, "You've been accepted into the Syntra alpha 🎉", html);
}
