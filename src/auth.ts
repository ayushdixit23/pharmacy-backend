import { betterAuth } from "better-auth";
import { Pool } from "pg";
import { DB_HOST, DB_NAME, DB_USER, DB_PASSWORD, DB_PORT, DB_SSL } from "./utils/envConfig.js";
import { sendEmail } from "./lib/send-mail.js";

// Create PostgreSQL connection pool
const pool = new Pool({
  host: DB_HOST,
  database: DB_NAME,
  user: DB_USER,
  password: DB_PASSWORD,
  port: parseInt(DB_PORT || '5432'),
  ssl: DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

export const auth = betterAuth({
  database: pool,
  secret: process.env.BETTER_AUTH_SECRET as string,
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:8080",
  trustedOrigins: ["http://localhost:3000", "http://localhost:8080"],
  user: {
    additionalFields: {
      role: { type: 'string', required: true, defaultValue: 'PHARMACIST', returned: true },
      phoneNumber: { type: 'string', required: true, returned: false },
      pharmacyName: { type: 'string', required: true, returned: false },
      drugLicenseNumber: { type: 'string', required: true, returned: false },
    }
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
    updateAge: 24 * 60 * 60,
    expiresIn: 60 * 60 * 24 * 7,
  },
  rateLimit: {
    window: 10,
    max: 100,
  },
  emailVerification: {
    autoSignInAfterVerification: true,
    enabled: true,
    sendVerificationEmail: async ({ user, url }) => {
      const verificationUrl = new URL(url);
      verificationUrl.searchParams.set("callbackURL", "http://localhost:3000/email-verification");
      await sendEmail({
        sendTo: user.email,
        subject: "Verify your email",
        text: `Click here to verify your email: ${verificationUrl.toString()}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Verify Your Email</h2>
            <p>Hello ${user.name || 'User'},</p>
            <p>Please click the link below to verify your email address:</p>
            <a href="${verificationUrl.toString()}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Verify Email</a>
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #666;">${verificationUrl.toString()}</p>
            <p>This link will expire in 24 hours.</p>
          </div>
        `,
      });
    },
    sendOnSignUp: true
  },
  emailAndPassword: {
    enabled: true,
    disableSignUp: false,
    requireEmailVerification: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: true,
    sendResetPassword: async ({ user, url, token }, request) => {
      await sendEmail({
        sendTo: user.email,
        subject: "Reset your password",
        text: `Click the link to reset your password: ${url}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Reset Your Password</h2>
            <p>Hello ${user.name || 'User'},</p>
            <p>You requested to reset your password. Click the link below to reset it:</p>
            <a href="${url}" style="background-color: #dc3545; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #666;">${url}</p>
            <p>This link will expire in 1 hour.</p>
            <p>If you didn't request this password reset, please ignore this email.</p>
          </div>
        `,
      });
    },
  },
  socialProviders: {
    microsoft: {
      clientId: process.env.MICROSOFT_CLIENT_ID as string,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET as string,
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    }
  },
});

export type User = typeof auth.$Infer.Session.user;
