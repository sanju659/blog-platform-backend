const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

// Escape user-provided text before putting it in HTML
const escapeHtml = (str = "") =>
  String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const sendEmail = ({ to, subject, html, text }) =>
  transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.MAIL_USER,
    to,
    subject,
    html,
    text,
  });

const sendPasswordResetEmail = ({ to, name, resetUrl, expiresInMinutes }) =>
  sendEmail({
    to,
    subject: "Reset your BlogSpace password",
    text:
      `Hi ${name},\n\n` +
      `We received a request to reset your password. Open this link to choose a new one (valid for ${expiresInMinutes} minutes):\n\n` +
      `${resetUrl}\n\n` +
      `If you didn't request this, you can safely ignore this email.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;">
        <h2 style="color:#4f46e5;">Reset your password</h2>
        <p>Hi ${escapeHtml(name)},</p>
        <p>We received a request to reset your password. Click the button below to choose a new one. This link is valid for <b>${expiresInMinutes} minutes</b>.</p>
        <p style="text-align:center;margin:32px 0;">
          <a href="${resetUrl}" style="background:#4f46e5;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Reset Password</a>
        </p>
        <p style="font-size:13px;color:#666;">Or paste this link into your browser:<br>${resetUrl}</p>
        <p style="font-size:13px;color:#666;">If you didn't request this, you can safely ignore this email. Your password won't change.</p>
      </div>
    `,
  });

module.exports = { sendEmail, sendPasswordResetEmail };
