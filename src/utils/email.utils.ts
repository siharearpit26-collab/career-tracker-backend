import nodemailer, { Transporter } from 'nodemailer';
import { config } from '../config';
import { logger } from './logger';

let transporter: Transporter | null = null;

const createTransporter = (): Transporter => {
  return nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: false,
    auth: {
      user: config.email.user,
      pass: config.email.password,
    },
  });
};

const getTransporter = (): Transporter => {
  if (!transporter) {
    transporter = createTransporter();
  }
  return transporter;
};

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export const sendEmail = async (options: SendEmailOptions): Promise<void> => {
  try {
    const emailTransporter = getTransporter();

    await emailTransporter.sendMail({
      from: `CareerTracker <${config.email.from}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });

    logger.info(`Email sent to ${options.to}`);
  } catch (error) {
    logger.error('Failed to send email:', error);
    throw error;
  }
};

export const sendVerificationEmail = async (
  email: string,
  verificationToken: string
): Promise<void> => {
  const verificationUrl = `${config.app.clientUrl}/verify-email?token=${verificationToken}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #333;">Verify Your Email</h1>
      <p>Thank you for registering with CareerTracker!</p>
      <p>Please click the button below to verify your email address:</p>
      <a href="${verificationUrl}" 
         style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; 
                color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">
        Verify Email
      </a>
      <p>Or copy and paste this link into your browser:</p>
      <p style="color: #666; word-break: break-all;">${verificationUrl}</p>
      <p style="color: #999; font-size: 12px; margin-top: 30px;">
        This link will expire in 24 hours. If you didn't create this account, please ignore this email.
      </p>
    </div>
  `;

  await sendEmail({
    to: email,
    subject: 'Verify Your Email - CareerTracker',
    html,
  });
};

export const sendPasswordResetEmail = async (
  email: string,
  resetToken: string
): Promise<void> => {
  const resetUrl = `${config.app.clientUrl}/reset-password?token=${resetToken}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #333;">Reset Your Password</h1>
      <p>We received a request to reset your password.</p>
      <p>Click the button below to reset your password:</p>
      <a href="${resetUrl}" 
         style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; 
                color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">
        Reset Password
      </a>
      <p>Or copy and paste this link into your browser:</p>
      <p style="color: #666; word-break: break-all;">${resetUrl}</p>
      <p style="color: #999; font-size: 12px; margin-top: 30px;">
        This link will expire in 1 hour. If you didn't request a password reset, please ignore this email.
      </p>
    </div>
  `;

  await sendEmail({
    to: email,
    subject: 'Reset Your Password - CareerTracker',
    html,
  });
};

export const sendReminderEmail = async (
  email: string,
  title: string,
  description: string,
  reminderDate: Date
): Promise<void> => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #333;">Reminder: ${title}</h1>
      <p><strong>Date:</strong> ${reminderDate.toLocaleDateString()}</p>
      ${description ? `<p><strong>Description:</strong> ${description}</p>` : ''}
      <p style="color: #999; font-size: 12px; margin-top: 30px;">
        You're receiving this email because you set up a reminder in CareerTracker.
      </p>
    </div>
  `;

  await sendEmail({
    to: email,
    subject: `Reminder: ${title}`,
    html,
  });
};

export const sendStatusUpdateEmail = async (
  email: string,
  firstName: string,
  company: string,
  jobTitle: string,
  newStatus: string,
  detectedFrom?: string
): Promise<void> => {
  const statusColors: Record<string, string> = {
    'Interview Scheduled': '#8B5CF6',
    'Interview Completed': '#6366F1',
    'Offer': '#10B981',
    'Rejected': '#EF4444',
    'Shortlisted': '#F59E0B',
    'Withdrawn': '#6B7280',
  };

  const color = statusColors[newStatus] ?? '#6366F1';
  const appUrl = config.app.clientUrl;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #6366F1, #8B5CF6); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">CareerTracker</h1>
        <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0;">Application Status Update</p>
      </div>

      <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="color: #374151; font-size: 16px;">Hi <strong>${firstName}</strong>,</p>
        <p style="color: #6B7280;">Your application status has been automatically updated:</p>

        <div style="background: #F9FAFB; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid ${color};">
          <p style="margin: 0 0 8px; color: #374151; font-size: 18px; font-weight: bold;">${company}</p>
          <p style="margin: 0 0 12px; color: #6B7280;">${jobTitle}</p>
          <span style="display: inline-block; background: ${color}; color: white; padding: 6px 16px; border-radius: 20px; font-size: 14px; font-weight: bold;">
            ${newStatus}
          </span>
        </div>

        ${detectedFrom ? `
        <p style="color: #9CA3AF; font-size: 13px; margin-top: 16px;">
          🔍 Detected from email: <em>${detectedFrom}</em>
        </p>
        ` : ''}

        <div style="text-align: center; margin-top: 24px;">
          <a href="${appUrl}/applications"
             style="display: inline-block; background: #6366F1; color: white; padding: 12px 28px;
                    border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px;">
            View Application →
          </a>
        </div>

        <p style="color: #9CA3AF; font-size: 12px; margin-top: 30px; text-align: center;">
          You're receiving this because you have email integration enabled on CareerTracker.<br>
          <a href="${appUrl}/profile" style="color: #6366F1;">Manage notification preferences</a>
        </p>
      </div>
    </div>
  `;

  await sendEmail({
    to: email,
    subject: `Status Update: ${company} → ${newStatus}`,
    html,
    text: `Hi ${firstName}, your application for ${jobTitle} at ${company} has been updated to: ${newStatus}.`,
  });
};

// ─── Welcome Email ────────────────────────────────────────────────────────────

export const sendWelcomeEmail = async (
  email: string,
  firstName: string
): Promise<void> => {
  const appUrl = config.app.clientUrl;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #6366F1, #8B5CF6); padding: 40px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to CareerTracker! 🎉</h1>
      </div>

      <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="color: #374151; font-size: 16px;">Hi <strong>${firstName}</strong>,</p>
        <p style="color: #6B7280;">Your account is ready! Here's how to get the most out of CareerTracker:</p>

        <div style="margin: 24px 0;">
          <div style="display: flex; align-items: flex-start; margin-bottom: 16px;">
            <span style="display: inline-block; background: #EEF2FF; color: #6366F1; width: 28px; height: 28px; border-radius: 50%; text-align: center; line-height: 28px; font-weight: bold; margin-right: 12px; flex-shrink: 0;">1</span>
            <div>
              <p style="margin: 0; color: #374151; font-weight: 600;">Add your applications</p>
              <p style="margin: 4px 0 0; color: #6B7280; font-size: 14px;">Track every job you apply to in one place</p>
            </div>
          </div>
          <div style="display: flex; align-items: flex-start; margin-bottom: 16px;">
            <span style="display: inline-block; background: #EEF2FF; color: #6366F1; width: 28px; height: 28px; border-radius: 50%; text-align: center; line-height: 28px; font-weight: bold; margin-right: 12px; flex-shrink: 0;">2</span>
            <div>
              <p style="margin: 0; color: #374151; font-weight: 600;">Connect your email</p>
              <p style="margin: 4px 0 0; color: #6B7280; font-size: 14px;">Auto-detect status updates from recruiters using AI</p>
            </div>
          </div>
          <div style="display: flex; align-items: flex-start; margin-bottom: 16px;">
            <span style="display: inline-block; background: #EEF2FF; color: #6366F1; width: 28px; height: 28px; border-radius: 50%; text-align: center; line-height: 28px; font-weight: bold; margin-right: 12px; flex-shrink: 0;">3</span>
            <div>
              <p style="margin: 0; color: #374151; font-weight: 600;">Discover new jobs</p>
              <p style="margin: 4px 0 0; color: #6B7280; font-size: 14px;">Browse curated openings from top companies and set up alerts</p>
            </div>
          </div>
        </div>

        <div style="text-align: center; margin-top: 24px;">
          <a href="${appUrl}/dashboard"
             style="display: inline-block; background: #6366F1; color: white; padding: 14px 32px;
                    border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
            Go to Dashboard →
          </a>
        </div>

        <p style="color: #9CA3AF; font-size: 12px; margin-top: 30px; text-align: center;">
          Need help? Reply to this email or visit our documentation.
        </p>
      </div>
    </div>
  `;

  await sendEmail({
    to: email,
    subject: `Welcome to CareerTracker, ${firstName}!`,
    html,
    text: `Hi ${firstName}, welcome to CareerTracker! Start by adding your applications, connecting your email for auto-tracking, and browsing job opportunities.`,
  });
};

// ─── New Job Match Email (Immediate Alert) ────────────────────────────────────

export const sendNewJobMatchEmail = async (
  email: string,
  firstName: string,
  alertName: string,
  job: { title: string; company: string; location: string; salary?: string; url: string }
): Promise<void> => {
  const appUrl = config.app.clientUrl;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #059669, #10B981); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 22px;">🎯 New Job Match!</h1>
        <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px;">Matching your "${alertName}" alert</p>
      </div>

      <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="color: #374151; font-size: 16px;">Hi <strong>${firstName}</strong>,</p>
        <p style="color: #6B7280;">A new job was just discovered that matches your criteria:</p>

        <div style="background: #F0FDF4; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #10B981;">
          <p style="margin: 0 0 6px; color: #374151; font-size: 18px; font-weight: bold;">${job.title}</p>
          <p style="margin: 0 0 8px; color: #059669; font-weight: 600;">${job.company}</p>
          <p style="margin: 0; color: #6B7280; font-size: 14px;">📍 ${job.location}${job.salary ? ` · 💰 ${job.salary}` : ''}</p>
        </div>

        <div style="text-align: center; margin-top: 24px;">
          <a href="${job.url}"
             style="display: inline-block; background: #059669; color: white; padding: 12px 28px;
                    border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px; margin-right: 8px;">
            View & Apply →
          </a>
          <a href="${appUrl}/jobs"
             style="display: inline-block; background: #F3F4F6; color: #374151; padding: 12px 28px;
                    border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px;">
            Browse All Jobs
          </a>
        </div>

        <p style="color: #9CA3AF; font-size: 12px; margin-top: 30px; text-align: center;">
          You're receiving this because you have the "${alertName}" job alert set to immediate notifications.<br>
          <a href="${appUrl}/job-alerts" style="color: #6366F1;">Manage alerts</a>
        </p>
      </div>
    </div>
  `;

  await sendEmail({
    to: email,
    subject: `New match: ${job.title} at ${job.company}`,
    html,
    text: `Hi ${firstName}, a new job matching your "${alertName}" alert was found: ${job.title} at ${job.company} (${job.location}). Apply: ${job.url}`,
  });
};

// ─── Application Deadline Reminder ────────────────────────────────────────────

export const sendDeadlineReminderEmail = async (
  email: string,
  firstName: string,
  applications: Array<{ company: string; jobTitle: string; deadline: Date; id: string }>
): Promise<void> => {
  const appUrl = config.app.clientUrl;

  const appItems = applications.map((app) => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #F3F4F6;">
        <p style="margin: 0; font-weight: 600; color: #374151;">${app.company}</p>
        <p style="margin: 2px 0 0; color: #6B7280; font-size: 13px;">${app.jobTitle}</p>
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #F3F4F6; text-align: right;">
        <span style="color: #EF4444; font-weight: 600; font-size: 14px;">${app.deadline.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
      </td>
    </tr>
  `).join('');

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #DC2626, #EF4444); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 22px;">⏰ Deadline Approaching!</h1>
      </div>

      <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="color: #374151; font-size: 16px;">Hi <strong>${firstName}</strong>,</p>
        <p style="color: #6B7280;">The following applications have deadlines coming up:</p>

        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <thead>
            <tr style="background: #F9FAFB;">
              <th style="padding: 10px 12px; text-align: left; color: #6B7280; font-size: 12px; text-transform: uppercase;">Application</th>
              <th style="padding: 10px 12px; text-align: right; color: #6B7280; font-size: 12px; text-transform: uppercase;">Deadline</th>
            </tr>
          </thead>
          <tbody>${appItems}</tbody>
        </table>

        <div style="text-align: center; margin-top: 24px;">
          <a href="${appUrl}/applications"
             style="display: inline-block; background: #EF4444; color: white; padding: 12px 28px;
                    border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px;">
            View Applications →
          </a>
        </div>

        <p style="color: #9CA3AF; font-size: 12px; margin-top: 30px; text-align: center;">
          <a href="${appUrl}/profile" style="color: #6366F1;">Manage notification preferences</a>
        </p>
      </div>
    </div>
  `;

  await sendEmail({
    to: email,
    subject: `⏰ ${applications.length} application deadline${applications.length > 1 ? 's' : ''} approaching`,
    html,
    text: `Hi ${firstName}, you have ${applications.length} application deadline(s) approaching: ${applications.map(a => `${a.company} (${a.deadline.toLocaleDateString()})`).join(', ')}`,
  });
};

// ─── Weekly Activity Summary ──────────────────────────────────────────────────

export const sendWeeklySummaryEmail = async (
  email: string,
  firstName: string,
  summary: {
    applicationsAdded: number;
    statusUpdates: number;
    interviewsScheduled: number;
    offersReceived: number;
    rejections: number;
    totalActive: number;
    newJobMatches: number;
  }
): Promise<void> => {
  const appUrl = config.app.clientUrl;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #6366F1, #8B5CF6); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 22px;">📊 Your Weekly Summary</h1>
        <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0; font-size: 14px;">Here's how your job search went this week</p>
      </div>

      <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="color: #374151; font-size: 16px;">Hi <strong>${firstName}</strong>,</p>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 24px 0;">
          <div style="background: #EEF2FF; padding: 16px; border-radius: 8px; text-align: center;">
            <p style="margin: 0; font-size: 28px; font-weight: bold; color: #6366F1;">${summary.applicationsAdded}</p>
            <p style="margin: 4px 0 0; color: #6B7280; font-size: 13px;">New Applications</p>
          </div>
          <div style="background: #F0FDF4; padding: 16px; border-radius: 8px; text-align: center;">
            <p style="margin: 0; font-size: 28px; font-weight: bold; color: #059669;">${summary.interviewsScheduled}</p>
            <p style="margin: 4px 0 0; color: #6B7280; font-size: 13px;">Interviews</p>
          </div>
          <div style="background: #FFFBEB; padding: 16px; border-radius: 8px; text-align: center;">
            <p style="margin: 0; font-size: 28px; font-weight: bold; color: #D97706;">${summary.offersReceived}</p>
            <p style="margin: 4px 0 0; color: #6B7280; font-size: 13px;">Offers</p>
          </div>
          <div style="background: #F9FAFB; padding: 16px; border-radius: 8px; text-align: center;">
            <p style="margin: 0; font-size: 28px; font-weight: bold; color: #374151;">${summary.totalActive}</p>
            <p style="margin: 4px 0 0; color: #6B7280; font-size: 13px;">Active Total</p>
          </div>
        </div>

        ${summary.newJobMatches > 0 ? `
        <div style="background: #F0FDF4; border-radius: 8px; padding: 14px 16px; margin: 16px 0; border-left: 4px solid #10B981;">
          <p style="margin: 0; color: #374151;">🎯 <strong>${summary.newJobMatches}</strong> new jobs matched your alerts this week</p>
        </div>
        ` : ''}

        ${summary.statusUpdates > 0 ? `
        <p style="color: #6B7280; font-size: 14px; margin-top: 12px;">
          📬 ${summary.statusUpdates} status update${summary.statusUpdates > 1 ? 's' : ''} detected from your emails
        </p>
        ` : ''}

        <div style="text-align: center; margin-top: 24px;">
          <a href="${appUrl}/dashboard"
             style="display: inline-block; background: #6366F1; color: white; padding: 12px 28px;
                    border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px;">
            View Dashboard →
          </a>
        </div>

        <p style="color: #9CA3AF; font-size: 12px; margin-top: 30px; text-align: center;">
          Sent every Monday. <a href="${appUrl}/profile" style="color: #6366F1;">Manage preferences</a>
        </p>
      </div>
    </div>
  `;

  await sendEmail({
    to: email,
    subject: `Weekly Summary: ${summary.applicationsAdded} apps, ${summary.interviewsScheduled} interviews, ${summary.offersReceived} offers`,
    html,
    text: `Hi ${firstName}, here's your weekly summary: ${summary.applicationsAdded} new applications, ${summary.interviewsScheduled} interviews scheduled, ${summary.offersReceived} offers received, ${summary.totalActive} active applications.`,
  });
};
