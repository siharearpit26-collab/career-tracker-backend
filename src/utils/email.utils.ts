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
