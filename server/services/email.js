import nodemailer from 'nodemailer';

const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;

let transporter = null;

if (SMTP_USER && SMTP_PASS) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
  console.log(`Email configured with sender: ${SMTP_FROM}`);
} else {
  console.log('Email not configured (SMTP_USER/SMTP_PASS not set)');
}

export function isEmailConfigured() {
  return !!transporter;
}

export async function sendMail({ to, subject, text, html }) {
  if (!transporter) {
    console.warn('Email not configured — skipping send');
    return false;
  }

  try {
    await transporter.sendMail({
      from: SMTP_FROM,
      to,
      subject,
      text,
      html,
    });
    return true;
  } catch (err) {
    console.error('Failed to send email:', err.message);
    return false;
  }
}

export async function sendWelcomeEmail(toEmail, tempPassword) {
  const APP_URL = process.env.APP_URL || 'http://localhost:6000';

  return sendMail({
    to: toEmail,
    subject: 'Welcome to MyLists — Your Account',
    text: `You've been invited to MyLists!\n\nLogin: ${toEmail}\nTemporary Password: ${tempPassword}\n\nPlease log in at ${APP_URL} and change your password.\n`,
    html: `
      <h2>Welcome to MyLists!</h2>
      <p>You've been invited to use MyLists.</p>
      <p><strong>Login:</strong> ${toEmail}<br>
         <strong>Temporary Password:</strong> ${tempPassword}</p>
      <p>Please <a href="${APP_URL}">log in</a> and change your password on first use.</p>
    `,
  });
}
