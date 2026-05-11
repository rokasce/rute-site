/**
 * ContactFormHandler
 *
 * Cloudflare Pages Function - handles POST /contact
 *
 * Required environment variables (set in Pages → Settings → Environment variables):
 *   FROM_EMAIL   Verified sender address, e.g. noreply@yourdomain.lt
 *   TO_EMAIL     Therapist's inbox, e.g. hello@yourdomain.lt
 *
 * Required binding (Pages → Settings → Functions → Email bindings):
 *   SEND_EMAIL   Send Email binding pointing to the destination address above
 */

import { EmailMessage } from "cloudflare:email";

class ContactFormHandler {
  constructor(env) {
    this.env = env;
    console.log(env);
  }

  async handle(request) {
    const fields = await this._parseForm(request);
    const problem = this._validate(fields);

    if (problem) {
      return this._json({ error: problem }, 400);
    }

    try {
      await this._sendEmail(fields);
      return this._json({ success: true }, 200);
    } catch (err) {
      console.error("Email send failed:", err);
      return this._json(
        { error: "Nepavyko išsiųsti žinutės. Bandykite dar kartą." },
        500
      );
    }
  }

  async _parseForm(request) {
    const fd = await request.formData();
    return {
      name: (fd.get("name") ?? "").trim(),
      email: (fd.get("email") ?? "").trim(),
      message: (fd.get("message") ?? "").trim(),
    };
  }

  _validate({ name, email, message }) {
    if (!name) return "Vardas yra privalomas.";
    if (!email || !email.includes("@"))
      return "Reikalingas teisingas el. pašto adresas.";
    if (!message) return "Žinutė yra privaloma.";
    return null;
  }

  async _sendEmail({ name, email, message }) {
    const from = this.env.FROM_EMAIL;
    const to = this.env.TO_EMAIL;

    const sentAt = new Date().toLocaleString("lt-LT", {
      timeZone: "Europe/Vilnius",
      dateStyle: "medium",
      timeStyle: "short",
    });

    const textBody = [
      `Nauja žinutė iš svetainės kontaktų formos`,
      `─────────────────────────────────────────`,
      ``,
      `Nuo:    ${name} <${email}>`,
      `Gauta:  ${sentAt}`,
      ``,
      `Žinutė:`,
      ``,
      message,
      ``,
      `─────────────────────────────────────────`,
      `Atsakyti galite tiesiai į šį laišką.`,
    ].join("\r\n");

    const htmlMessage = this._htmlEscape(message).replace(/\r?\n/g, "<br>");
    const safeName = this._htmlEscape(name);
    const safeEmail = this._htmlEscape(email);

    const htmlBody = `<!doctype html>
<html><body style="margin:0;padding:0;background:#F5F0E8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#2C2C2C;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F0E8;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#FDFAF6;border:1px solid #D8D0C4;border-radius:14px;overflow:hidden;">
        <tr><td style="background:#6B8F6E;color:#fff;padding:20px 28px;font-size:16px;font-weight:500;letter-spacing:0.04em;">
          Nauja žinutė iš svetainės
        </td></tr>
        <tr><td style="padding:28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:1.6;">
            <tr>
              <td style="padding:6px 0;color:#6B6460;width:90px;">Nuo</td>
              <td style="padding:6px 0;"><strong>${safeName}</strong> &lt;<a href="mailto:${safeEmail}" style="color:#C4845A;text-decoration:none;">${safeEmail}</a>&gt;</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#6B6460;">Gauta</td>
              <td style="padding:6px 0;color:#2C2C2C;">${sentAt}</td>
            </tr>
          </table>
          <hr style="border:none;border-top:1px solid #D8D0C4;margin:22px 0;">
          <div style="font-size:12px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;color:#6B6460;margin-bottom:10px;">Žinutė</div>
          <div style="font-size:15px;line-height:1.7;color:#2C2C2C;white-space:pre-wrap;">${htmlMessage}</div>
        </td></tr>
        <tr><td style="background:#EDE8DF;padding:16px 28px;font-size:12px;color:#6B6460;border-top:1px solid #D8D0C4;">
          Atsakyti ${safeName} galite tiesiai į šį laišką.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

    const boundary = `bnd_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
    const subject = this._encodeHeader(`Nauja žinutė nuo ${name}`);
    const fromHeader = this._formatAddress("Kontaktų forma", from);
    const replyTo = this._formatAddress(name, email);

    const rawEmail = [
      `MIME-Version: 1.0`,
      `From: ${fromHeader}`,
      `To: <${to}>`,
      `Reply-To: ${replyTo}`,
      `Subject: ${subject}`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/plain; charset=utf-8`,
      `Content-Transfer-Encoding: 8bit`,
      ``,
      textBody,
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset=utf-8`,
      `Content-Transfer-Encoding: 8bit`,
      ``,
      htmlBody,
      ``,
      `--${boundary}--`,
      ``,
    ].join("\r\n");

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(rawEmail));
        controller.close();
      },
    });

    const emailMessage = new EmailMessage(from, to, stream);
    await this.env.SEND_EMAIL.send(emailMessage);
  }

  _htmlEscape(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  _encodeHeader(s) {
    if (/^[\x20-\x7E]*$/.test(s)) return s;
    const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(s)));
    return `=?UTF-8?B?${b64}?=`;
  }

  _formatAddress(displayName, email) {
    const safeName = String(displayName).replace(/[<>"]/g, "").trim();
    if (!safeName) return `<${email}>`;
    return `${this._encodeHeader(safeName)} <${email}>`;
  }

  _json(body, status) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function onRequestPost({ request, env }) {
  const handler = new ContactFormHandler(env);
  return handler.handle(request);
}

export async function onRequest() {
  return new Response("Method Not Allowed", { status: 405 });
}
