// Send one test email and report exactly what happened.
//
// Sign-up codes always answer "a code is on its way" (see send-code), so when
// mail isn't arriving there is no way to tell from the outside whether it is
// going to the Mailtrap test inbox, being refused, or never configured. This
// shows the live settings (never the token itself) and Mailtrap's own reply.

import { requireStaff } from "~/server/utils/staff-auth";
import { sendMail, mailConfigured, mailIsSandbox } from "~/server/utils/mail";
import { noteAction } from "~/server/utils/oplog";

export default defineEventHandler(async (event) => {
  const actor = await requireStaff(event, "logs.view");
  const to = String(((await readBody(event)) as any)?.to || "").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    throw createError({ statusCode: 400, message: "Enter a valid email address." });
  }

  const config = useRuntimeConfig();
  const settings = {
    tokenSet: mailConfigured(),
    testInbox: mailIsSandbox(),
    from: (config.mailFrom as string) || "no-reply@tcgo.shop",
  };

  const result = await sendMail({
    to: [{ email: to }],
    subject: "TCGo test email",
    category: "test",
    html: "<p>This is a test email from TCGo's Mint Condition. If you can read it, email sending works.</p>",
    text: "This is a test email from TCGo's Mint Condition. If you can read it, email sending works.",
  });

  noteAction({
    area: "email",
    action: "email.test",
    summary: `Test email to ${to}: ${result.sent ? (result.sandbox ? "captured in test inbox" : "sent") : `failed (${result.reason})`}`,
    actor,
    event,
  });

  return { ...settings, sent: result.sent, sandbox: result.sandbox, reason: result.reason ?? null };
});
