/**
 * ContactFormHandler
 *
 * Cloudflare Pages Function — handles POST /contact
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
        { error: "Could not send message. Please try again." },
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
    if (!name) return "Name is required.";
    if (!email || !email.includes("@"))
      return "A valid email address is required.";
    if (!message) return "Message is required.";
    return null;
  }

  async _sendEmail({ name, email, message }) {
    const from = this.env.FROM_EMAIL;
    const to = this.env.TO_EMAIL;

    const rawEmail = [
      `MIME-Version: 1.0`,
      `From: Contact Form <${from}>`,
      `To: <${to}>`,
      `Reply-To: ${name} <${email}>`,
      `Subject: New message from ${name}`,
      `Content-Type: text/plain; charset=utf-8`,
      ``,
      `Name:    ${name}`,
      `Email:   ${email}`,
      ``,
      message,
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
