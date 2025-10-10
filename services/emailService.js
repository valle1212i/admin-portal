// services/emailService.js
const nodemailer = require("nodemailer");
const { convert } = require("html-to-text");
const fs = require("fs").promises;
const path = require("path");

// Use existing Brevo SMTP configuration
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  pool: true,
  maxConnections: 5,
  maxMessages: 500,
});

const FROM_ADDRESS = process.env.SMTP_FROM || process.env.SMTP_USER;
const REPLY_TO = process.env.SMTP_REPLY_TO || undefined;

/**
 * Load and process email template
 */
async function loadTemplate(templateName, variables = {}) {
  try {
    const templatePath = path.join(__dirname, '..', 'templates', 'emails', 'onboarding', `${templateName}.html`);
    let html = await fs.readFile(templatePath, 'utf-8');
    
    // Replace variables in template
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      html = html.replace(regex, value || '');
    }
    
    return html;
  } catch (error) {
    console.error(`Error loading template ${templateName}:`, error);
    // Return basic fallback HTML
    return `<html><body><p>Email template not found</p></body></html>`;
  }
}

/**
 * Send email using template
 */
async function sendEmail({ to, subject, html, text }) {
  try {
    const textFallback = text || convert(html || "", { wordwrap: 120 });
    
    const info = await transporter.sendMail({
      from: FROM_ADDRESS,
      to,
      subject,
      html,
      text: textFallback,
      replyTo: REPLY_TO,
    });
    
    console.log(`✅ Email sent to ${to}: ${subject}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`❌ Failed to send email to ${to}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Send welcome email when onboarding is created
 */
async function sendWelcomeEmail(onboarding) {
  const html = await loadTemplate('welcome', {
    companyName: onboarding.companyName,
    contactName: onboarding.primaryContact?.name || 'där',
    onboardingId: onboarding._id,
    continueUrl: `${process.env.APP_URL || 'http://localhost:3000'}/onboarding.html?id=${onboarding._id}`
  });
  
  return sendEmail({
    to: onboarding.email,
    subject: 'Välkommen till Source - Påbörja din registrering',
    html
  });
}

/**
 * Send reminder if draft not completed after 48 hours
 */
async function sendDraftReminder(onboarding) {
  const html = await loadTemplate('draft-reminder', {
    companyName: onboarding.companyName,
    contactName: onboarding.primaryContact?.name || 'där',
    currentStep: onboarding.currentStep,
    continueUrl: `${process.env.APP_URL || 'http://localhost:3000'}/onboarding.html?id=${onboarding._id}`
  });
  
  return sendEmail({
    to: onboarding.email,
    subject: 'Påminnelse: Slutför din registrering hos Source',
    html
  });
}

/**
 * Send confirmation when onboarding is submitted
 */
async function sendSubmissionConfirmation(onboarding) {
  const html = await loadTemplate('submission-confirmation', {
    companyName: onboarding.companyName,
    contactName: onboarding.primaryContact?.name || 'där',
    packageName: onboarding.package,
    submittedDate: new Date(onboarding.onboardingSubmitted).toLocaleDateString('sv-SE'),
    estimatedReviewTime: '1-2 arbetsdagar'
  });
  
  return sendEmail({
    to: onboarding.email,
    subject: 'Ansökan mottagen - Source Onboarding',
    html
  });
}

/**
 * Send request for additional information
 */
async function sendInfoRequest(onboarding, message, requestedBy) {
  const html = await loadTemplate('info-request', {
    companyName: onboarding.companyName,
    contactName: onboarding.primaryContact?.name || 'där',
    message: message,
    requestedBy: requestedBy || 'Source Team',
    continueUrl: `${process.env.APP_URL || 'http://localhost:3000'}/onboarding.html?id=${onboarding._id}`
  });
  
  return sendEmail({
    to: onboarding.email,
    subject: 'Ytterligare information behövs - Source Onboarding',
    html
  });
}

/**
 * Send approval email with login credentials
 */
async function sendApprovalEmail(onboarding, credentials) {
  const html = await loadTemplate('approval', {
    companyName: onboarding.companyName,
    contactName: onboarding.primaryContact?.name || 'där',
    packageName: onboarding.package,
    loginUrl: process.env.CUSTOMER_PORTAL_URL || 'https://source-database.onrender.com',
    email: credentials.email,
    temporaryPassword: credentials.password,
    monthlyPrice: onboarding.monthlyPrice ? `${onboarding.monthlyPrice} SEK` : 'Se faktura',
    firstInvoiceDate: onboarding.firstInvoiceDate ? new Date(onboarding.firstInvoiceDate).toLocaleDateString('sv-SE') : 'Inom 7 dagar',
    supportEmail: process.env.SUPPORT_EMAIL || 'support@source.se'
  });
  
  return sendEmail({
    to: onboarding.email,
    subject: '🎉 Välkommen till Source - Ditt konto är aktiverat!',
    html
  });
}

/**
 * Send rejection email with reason
 */
async function sendRejectionEmail(onboarding, reason, rejectedBy) {
  const html = await loadTemplate('rejection', {
    companyName: onboarding.companyName,
    contactName: onboarding.primaryContact?.name || 'där',
    reason: reason,
    rejectedBy: rejectedBy || 'Source Team',
    contactEmail: process.env.SUPPORT_EMAIL || 'support@source.se'
  });
  
  return sendEmail({
    to: onboarding.email,
    subject: 'Angående din ansökan - Source Onboarding',
    html
  });
}

/**
 * Send notification to admin when new onboarding is submitted
 */
async function notifyAdminNewSubmission(onboarding) {
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
  if (!adminEmail) {
    console.log('No admin notification email configured');
    return { success: false, error: 'No admin email configured' };
  }
  
  const html = `
    <h2>Ny onboarding-ansökan mottagen</h2>
    <p><strong>Företag:</strong> ${onboarding.companyName}</p>
    <p><strong>Org.nr:</strong> ${onboarding.organizationNumber}</p>
    <p><strong>Paket:</strong> ${onboarding.package}</p>
    <p><strong>Kontakt:</strong> ${onboarding.primaryContact?.name} (${onboarding.primaryContact?.email})</p>
    <p><strong>Inskickat:</strong> ${new Date().toLocaleString('sv-SE')}</p>
    <p><a href="${process.env.APP_URL || 'http://localhost:3000'}/onboarding-review.html?id=${onboarding._id}">Granska ansökan</a></p>
  `;
  
  return sendEmail({
    to: adminEmail,
    subject: `Ny onboarding: ${onboarding.companyName}`,
    html
  });
}

module.exports = {
  sendWelcomeEmail,
  sendDraftReminder,
  sendSubmissionConfirmation,
  sendInfoRequest,
  sendApprovalEmail,
  sendRejectionEmail,
  notifyAdminNewSubmission,
  sendEmail // Export for custom emails
};

