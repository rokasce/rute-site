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

class ContactFormHandler {

  /** @param {Env} env */
  constructor(env) {
    this.env = env;
  }

  /** Entry point — validates, then sends. */
  async handle(request) {
    const fields  = await this.#parseForm(request);
    const problem = this.#validate(fields);

    if (problem) {
      return this.#json({ error: problem }, 400);
    }

    try {
      await this.#sendEmail(fields);
      return this.#json({ success: true }, 200);
    } catch (err) {
      console.error('Email send failed:', err);
      return this.#json({ error: 'Could not send message. Please try again.' }, 500);
    }
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  async #parseForm(request) {
    const fd = await request.formData();
    return {
      name:    (fd.get('name')    ?? '').trim(),
      email:   (fd.get('email')   ?? '').trim(),
      message: (fd.get('message') ?? '').trim(),
    };
  }

  #validate({ name, email, message }) {
    if (!name)                    return 'Name is required.';
    if (!email || !email.includes('@')) return 'A valid email address is required.';
    if (!message)                 return 'Message is required.';
    return null;
  }

  async #sendEmail({ name, email, message }) {
    const from = this.env.FROM_EMAIL;  // e.g. noreply@yourdomain.lt
    const to   = this.env.TO_EMAIL;    // therapist's personal inbox

    // Build a minimal MIME email
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
    ].join('\r\n');

    // Stream required by the Workers Email API
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(rawEmail));
        controller.close();
      },
    });

    const emailMessage = new EmailMessage(from, to, stream);
    await this.env.SEND_EMAIL.send(emailMessage);
  }

  #json(body, status) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// ─── Pages Function export ───────────────────────────────────────────────────

export async function onRequestPost({ request, env }) {
  const handler = new ContactFormHandler(env);
  return handler.handle(request);
}

// Return 405 for any other method
export async function onRequest() {
  return new Response('Method Not Allowed', { status: 405 });
}
