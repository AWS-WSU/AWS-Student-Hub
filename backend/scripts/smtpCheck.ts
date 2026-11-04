/**
 * Verifies the SMTP settings in backend/.env by logging in and sending a real
 * email to the address you pass.
 *
 *   bun run smtp-check you@example.com
 *   bun run smtp-check you@example.com --builder-wars   # preview the broadcast email
 */
import nodemailer from 'nodemailer';

import env from '../src/config/env';
import { builderWarsBroadcast } from '../src/services/broadcasts/builderWarsEmail';

const [to, ...flags] = process.argv.slice(2);
const previewBuilderWars = flags.includes('--builder-wars');

if (!to || !to.includes('@')) {
  console.error('usage: bun run smtp-check <recipient@example.com> [--builder-wars]');
  process.exit(1);
}

const missing = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'].filter(
  (key) => !process.env[key]
);
if (missing.length > 0) {
  console.error(`missing in .env: ${missing.join(', ')}`);
  process.exit(1);
}

console.log(`host: ${env.SMTP_HOST}:${env.SMTP_PORT}  user: ${env.SMTP_USER}`);

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: false,
  auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 15_000,
});

const main = async (): Promise<void> => {
  try {
    console.log('connecting and authenticating...');
    await transporter.verify();
    console.log('login ok.');

    const recipient = { email: to, fullName: 'SMTP Check' };
    const message = previewBuilderWars
      ? {
          subject: `[preview] ${builderWarsBroadcast.subject}`,
          html: builderWarsBroadcast.buildHtml(recipient),
          text: builderWarsBroadcast.buildText(recipient),
        }
      : {
          subject: 'AWS Student Hub SMTP check',
          text: `SMTP is working. Sent ${new Date().toISOString()} from ${env.SMTP_USER}.`,
          html: `<p>SMTP is working.</p><p>Sent ${new Date().toISOString()} from ${env.SMTP_USER}.</p>`,
        };

    console.log(`sending to ${to}...`);
    const info = await transporter.sendMail({
      from: `"AWS Student Builder Group @ WSU" <${env.SMTP_USER}>`,
      to,
      ...message,
    });
    console.log(`accepted by server: ${info.response}`);
    console.log('check the inbox (and spam) now.');
  } catch (error) {
    const e = error as { code?: string; responseCode?: number; message?: string };
    console.error('FAILED');
    console.error(`  ${e.message ?? String(error)}`);
    if (e.responseCode === 535) {
      console.error('  535 means Gmail rejected the login. Use a Google App Password, not the');
      console.error(
        '  account password, and make sure 2-step verification is on for that account.'
      );
    } else if (e.code === 'ETIMEDOUT' || e.code === 'ECONNECTION') {
      console.error('  could not reach the host. Check SMTP_HOST/SMTP_PORT and your network.');
    }
    process.exit(1);
  } finally {
    transporter.close();
  }
};

void main();
