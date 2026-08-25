// Mailtrap client.
//
// Two products share one API token and differ only by host:
//   sandbox     POST https://sandbox.api.mailtrap.io/api/send/{inboxId}
//               captures the message; nothing is delivered to a real inbox
//   production  POST https://send.api.mailtrap.io/api/send
//               delivers for real; needs a verified sending domain
//
// mailtrapInboxId being set is what selects sandbox. Clear it once a sending
// domain is verified and the same code delivers for real — no other change.

export interface MailAddress {
  email: string;
  name?: string;
}

export interface SendMailInput {
  to: MailAddress[];
  subject: string;
  html: string;
  text: string;
  /** Mailtrap groups messages by category in its UI. */
  category?: string;
}

export const mailConfigured = (): boolean => {
  const config = useRuntimeConfig();
  return !!(config.mailtrapApiToken as string);
};

/** True when messages are captured rather than delivered. */
export const mailIsSandbox = (): boolean => {
  const config = useRuntimeConfig();
  return !!(config.mailtrapInboxId as string);
};

export const sendMail = async (
  input: SendMailInput,
): Promise<{ sent: boolean; sandbox: boolean; messageIds?: string[]; reason?: string }> => {
  const config = useRuntimeConfig();
  const token = config.mailtrapApiToken as string;
  if (!token) return { sent: false, sandbox: false, reason: "Mail not configured" };

  const inboxId = config.mailtrapInboxId as string;
  const sandbox = !!inboxId;
  const url = sandbox
    ? `https://sandbox.api.mailtrap.io/api/send/${inboxId}`
    : "https://send.api.mailtrap.io/api/send";

  const recipients = input.to.filter((r) => !!r.email);
  if (!recipients.length) return { sent: false, sandbox, reason: "No recipient address" };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Api-Token": token, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: {
        email: (config.mailFrom as string) || "invoices@tcgo.shop",
        name: (config.mailFromName as string) || "TCGo",
      },
      to: recipients,
      subject: input.subject,
      html: input.html,
      text: input.text,
      category: input.category || "transactional",
    }),
  });

  const body = await res.text();
  if (!res.ok) {
    console.error("[mail] send failed", res.status, body.slice(0, 300));
    let reason = `Mail provider error (${res.status})`;
    try {
      const j = JSON.parse(body);
      reason = (j?.errors && j.errors.join?.(", ")) || j?.message || reason;
    } catch {}
    return { sent: false, sandbox, reason };
  }

  let messageIds: string[] | undefined;
  try {
    messageIds = JSON.parse(body)?.message_ids;
  } catch {}
  return { sent: true, sandbox, messageIds };
};
