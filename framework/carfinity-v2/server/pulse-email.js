// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
// Lifted from the real dashboard (the Daily Pulse email) for the Claude for Dealers toolkit. Credentials
// removed: keys and hosts come from the environment. Read recipes/email-reports.md.
import nodemailer from 'nodemailer';
import * as db from './db.js';
import { generatePulseInsights } from './pulse-engine.js';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587');
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.log('[PulseEmail] SMTP not configured — email disabled');
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  return transporter;
}

function severityColor(severity) {
  switch (severity) {
    case 'critical': return '#EF4444';
    case 'warning': return '#F59E0B';
    case 'positive': return '#10B981';
    default: return '#3B82F6';
  }
}

function severityLabel(severity) {
  switch (severity) {
    case 'critical': return 'CRITICAL';
    case 'warning': return 'WARNING';
    case 'positive': return 'POSITIVE';
    default: return 'INFO';
  }
}

function buildEmailHTML(insights, dealerGroupName) {
  const appUrl = process.env.APP_URL || 'https://v2.carfinity.io';
  const critCount = insights.filter(i => i.severity === 'critical').length;
  const warnCount = insights.filter(i => i.severity === 'warning').length;
  const posCount = insights.filter(i => i.severity === 'positive').length;

  const summaryParts = [];
  if (critCount > 0) summaryParts.push(`${critCount} critical`);
  if (warnCount > 0) summaryParts.push(`${warnCount} warning`);
  if (posCount > 0) summaryParts.push(`${posCount} positive`);
  const summaryText = summaryParts.join(', ') || 'No significant changes';

  const insightRows = insights.slice(0, 5).map(insight => `
    <tr>
      <td style="padding: 16px 20px; border-bottom: 1px solid #1a1a2e;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td width="4" style="background-color: ${severityColor(insight.severity)}; border-radius: 2px;"></td>
            <td style="padding-left: 16px;">
              <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; background-color: ${severityColor(insight.severity)}22; color: ${severityColor(insight.severity)}; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                ${severityLabel(insight.severity)}
              </span>
              <p style="margin: 8px 0 4px 0; font-size: 16px; font-weight: 600; color: #ffffff;">
                ${insight.title}
              </p>
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #a0a0b8; line-height: 1.5;">
                ${insight.detail}
              </p>
              ${insight.recommended_action ? `
              <div style="margin-top: 8px; padding: 10px 14px; background-color: #7000FF11; border-left: 3px solid #7000FF; border-radius: 0 6px 6px 0;">
                <p style="margin: 0; font-size: 13px; color: #c0c0d8; line-height: 1.4;">
                  <strong style="color: #a78bfa;">Recommended:</strong> ${insight.recommended_action}
                </p>
              </div>` : ''}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #0a0a1a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #0a0a1a;">
    <tr><td align="center" style="padding: 40px 20px;">
      <table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px;">
        <!-- Header -->
        <tr><td style="padding: 30px; text-align: center;">
          <h1 style="margin: 0 0 8px 0; font-size: 28px; font-weight: 700; background: linear-gradient(135deg, #7000FF, #00C2FF); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
            Daily Pulse
          </h1>
          <p style="margin: 0; color: #6b6b80; font-size: 14px;">
            ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            ${dealerGroupName ? ` &bull; ${dealerGroupName}` : ''}
          </p>
        </td></tr>

        <!-- Summary -->
        <tr><td style="padding: 0 0 16px 0;">
          <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #12122a; border-radius: 12px; border: 1px solid #ffffff15;">
            <tr><td style="padding: 20px; text-align: center;">
              <p style="margin: 0; color: #a0a0b8; font-size: 14px;">${summaryText}</p>
            </td></tr>
          </table>
        </td></tr>

        <!-- Insights -->
        <tr><td>
          <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #12122a; border-radius: 12px; border: 1px solid #ffffff15;">
            ${insightRows}
          </table>
        </td></tr>

        <!-- CTA Button -->
        <tr><td style="padding: 24px 0; text-align: center;">
          <a href="${appUrl}/need-attention" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #7000FF, #00C2FF); color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600;">
            Open Daily Pulse
          </a>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding: 20px; text-align: center; border-top: 1px solid #ffffff10;">
          <p style="margin: 0; color: #4a4a60; font-size: 12px;">
            You're receiving this because you subscribed to Daily Pulse alerts.
            <br><a href="${appUrl}/need-attention" style="color: #7000FF; text-decoration: none;">Manage preferences</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * Send a pulse email digest to a specific user.
 */
export async function sendPulseEmail(userId, dealerGroupId, email, dealerGroupName) {
  const t = getTransporter();
  if (!t) return false;

  const today = new Date().toISOString().split('T')[0];
  const insights = db.getPulseInsights(dealerGroupId, today);

  if (insights.length === 0) return false;

  const critCount = insights.filter(i => i.severity === 'critical').length;
  const warnCount = insights.filter(i => i.severity === 'warning').length;
  const actionCount = critCount + warnCount;

  const subject = actionCount > 0
    ? `${actionCount} item${actionCount > 1 ? 's' : ''} need attention${dealerGroupName ? ` at ${dealerGroupName}` : ''}`
    : `All clear${dealerGroupName ? ` at ${dealerGroupName}` : ''} — Daily Pulse`;

  try {
    await t.sendMail({
      from: process.env.SMTP_FROM || '"Carfinity AI" <pulse@carfinity.io>',
      to: email,
      subject,
      html: buildEmailHTML(insights, dealerGroupName),
    });
    db.updatePulseLastSent(userId, dealerGroupId);
    console.log(`[PulseEmail] Sent to ${email} for dealer group ${dealerGroupId}`);
    return true;
  } catch (e) {
    console.error(`[PulseEmail] Failed to send to ${email}:`, e.message);
    return false;
  }
}

/**
 * Run daily pulse generation + email for all subscribed users.
 */
export async function runDailyPulseForAllGroups() {
  console.log('[PulseEmail] Starting daily pulse run...');
  const prefs = db.getAllPulseEmailPrefsEnabled();

  // Collect unique dealer group IDs
  const groupIds = [...new Set(prefs.map(p => p.dealer_group_id))];

  // Generate insights for all groups
  for (const groupId of groupIds) {
    try {
      await generatePulseInsights(groupId);
    } catch (e) {
      console.error(`[PulseEmail] Insight generation failed for group ${groupId}:`, e.message);
    }
  }

  // Send emails
  for (const pref of prefs) {
    try {
      await sendPulseEmail(pref.user_id, pref.dealer_group_id, pref.email);
    } catch (e) {
      console.error(`[PulseEmail] Email failed for ${pref.email}:`, e.message);
    }
  }

  console.log(`[PulseEmail] Daily pulse complete — ${groupIds.length} groups, ${prefs.length} emails`);
}
