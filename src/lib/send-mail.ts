import nodemailer from 'nodemailer';
import { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM } from '../utils/envConfig.js';

// Create transporter for email sending
const createTransporter = () => {
  return nodemailer.createTransport({
    host: SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(SMTP_PORT || '587'),
    secure: SMTP_SECURE === 'true',
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
};

export interface EmailOptions {
  sendTo: string;
  subject: string;
  text: string;
  html?: string;
}

export const sendEmail = async (options: EmailOptions): Promise<void> => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: SMTP_FROM || SMTP_USER,
      to: options.sendTo,
      subject: options.subject,
      text: options.text,
      html: options.html || options.text,
    };

    await transporter.sendMail(mailOptions);
    console.log(`Email sent successfully to ${options.sendTo}`);
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error('Failed to send email');
  }
};
