// The two emails that carry a code.
//
// Deliberately plain. A verification code is read in five seconds on a phone,
// usually while the person is staring at a form waiting for it — so the code
// is the largest thing in the message and everything else gets out of the way.
//
// Both say what to do if it wasn't you, because a password-reset email nobody
// asked for is the first sign of an account under attack and the reader
// deserves to know it needs no action.

import { sendMail } from "~/server/utils/mail";
import { ttlMinutes } from "~/server/utils/auth-codes";

const shell = (heading: string, lead: string, code: string, footer: string) => `
<div style="margin:0;padding:32px 16px;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:440px;margin:0 auto;background:#ffffff;border-radius:14px;padding:32px 28px;">
    <p style="margin:0 0 4px;font-size:13px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#d3222a;">TCGo</p>
    <h1 style="margin:0 0 12px;font-size:21px;line-height:1.3;color:#131722;">${heading}</h1>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#49505f;">${lead}</p>
    <div style="background:#f4f5f7;border-radius:10px;padding:18px;text-align:center;margin-bottom:22px;">
      <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:34px;font-weight:600;letter-spacing:.28em;color:#131722;">${code}</span>
    </div>
    <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#7c8494;">
      This code expires in ${ttlMinutes()} minutes and can be used once.
    </p>
    <p style="margin:0;font-size:13px;line-height:1.6;color:#7c8494;">${footer}</p>
  </div>
</div>`;

export const sendVerificationCode = (email: string, code: string) =>
  sendMail({
    to: [{ email }],
    subject: `${code} is your TCGo verification code`,
    category: "auth-verify",
    html: shell(
      "Confirm your email",
      "Enter this code in TCGo to finish setting up your account.",
      code,
      "If you didn't create a TCGo account, you can ignore this email — nothing has been set up.",
    ),
    text:
      `Your TCGo verification code is ${code}.\n\n` +
      `It expires in ${ttlMinutes()} minutes and can be used once.\n\n` +
      `If you didn't create a TCGo account, ignore this email — nothing has been set up.`,
  });

export const sendPasswordResetCode = (email: string, code: string) =>
  sendMail({
    to: [{ email }],
    subject: `${code} is your TCGo password reset code`,
    category: "auth-reset",
    html: shell(
      "Reset your password",
      "Enter this code in TCGo to choose a new password.",
      code,
      "If you didn't ask to reset your password, ignore this email. Your current password still works and nothing has changed.",
    ),
    text:
      `Your TCGo password reset code is ${code}.\n\n` +
      `It expires in ${ttlMinutes()} minutes and can be used once.\n\n` +
      `If you didn't ask for this, ignore this email — your current password still works.`,
  });
