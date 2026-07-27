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
