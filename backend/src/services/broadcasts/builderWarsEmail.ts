import type { BroadcastDefinition, BroadcastRecipient } from './types';

export const BUILDER_WARS_KEY = 'builder-wars-2026';

const REGISTER_URL = 'https://builderwars.dev';
const HUB_PAGE_URL = 'https://wayneaws.dev/builder-wars';
const INSTAGRAM_BW_URL = 'https://www.instagram.com/builderwars.hack/';
const INSTAGRAM_SBG_URL = 'https://www.instagram.com/aws_sbg_wsu/';
const CONTACT_EMAIL = 'awssbg@wayne.edu';

const KICKOFF_UTC = Date.UTC(2026, 10, 14, 15, 0, 0); // Sat Nov 14, 10:00 AM Detroit

const COLORS = {
  ink: '#0b0a12',
  panel: '#15131f',
  panelEdge: '#2a2540',
  purple: '#7b68c9',
  purpleDeep: '#4c3f8f',
  gold: '#f0a33a',
  text: '#f3f1fa',
  muted: '#aaa4c2',
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const firstName = (fullName: string): string => {
  const first = fullName.trim().split(/\s+/)[0];
  return first && first.length <= 40 ? first : 'builder';
};

const urgencyLine = (now: number): string => {
  const dayMs = 24 * 60 * 60 * 1000;
  const remaining = KICKOFF_UTC - now;
  if (remaining <= 0) return 'Doors are open.';

  const days = Math.round(remaining / dayMs);
  if (days > 1) return `Kickoff is ${days} days out.`;
  if (days === 1) return 'Kickoff is tomorrow.';
  return 'Kickoff is today.';
};

// A pixel flag built from table cells, so it renders everywhere without images.
// g = pole (gold), p = flag (purple), w = highlight, . = empty
const FLAG_ROWS = [
  '..gg........',
  '.gggg.......',
  '..ggpppppppp',
  '..ggpwwppppp',
  '..ggpwwpppp.',
  '..ggpppppp..',
  '..ggppppp...',
  '..ggpppppp..',
  '..ggpppppppp',
  '..gg........',
  '..gg........',
  '.gggg.......',
  'gggggg......',
];

const flagCellColor: Record<string, string> = {
  g: COLORS.gold,
  p: COLORS.purple,
  w: '#ffffff',
};

const renderPixelFlag = (cell = 6): string => {
  const rows = FLAG_ROWS.map((row) => {
    const cells = Array.from(row)
      .map((ch) => {
        const color = flagCellColor[ch];
        const style = `width:${cell}px;height:${cell}px;line-height:${cell}px;font-size:1px;${
          color ? `background:${color};` : ''
        }`;
        return `<td style="${style}">&nbsp;</td>`;
      })
      .join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">${rows}</table>`;
};

const detailRow = (label: string, value: string): string => `
  <tr>
    <td style="padding:10px 0;border-bottom:1px solid ${COLORS.panelEdge};font-family:'Courier New',Courier,monospace;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${COLORS.purple};width:110px;vertical-align:top;">${label}</td>
    <td style="padding:10px 0;border-bottom:1px solid ${COLORS.panelEdge};font-family:Arial,Helvetica,sans-serif;font-size:15px;color:${COLORS.text};font-weight:bold;">${value}</td>
  </tr>`;

const buildHtml = (recipient: BroadcastRecipient, now = Date.now()): string => {
  const name = escapeHtml(firstName(recipient.fullName));
  const urgency = urgencyLine(now);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>Builder Wars Hackathon</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.ink};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    ${urgency} 24 hours, $2,000+ in prizes, Newlab Detroit, free to enter.
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.ink};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

          <!-- masthead -->
          <tr>
            <td style="padding:0 0 18px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-family:'Courier New',Courier,monospace;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:${COLORS.muted};">
                    AWS Student Builder Group &nbsp;<span style="color:${COLORS.gold};">&#9608;</span>&nbsp; Wayne State
                  </td>
                  <td align="right" style="font-family:'Courier New',Courier,monospace;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:${COLORS.purple};">
                    First annual
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- hero panel -->
          <tr>
            <td style="background:${COLORS.panel};border:1px solid ${COLORS.panelEdge};border-top:3px solid ${COLORS.purple};padding:34px 32px 30px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align:top;">
                    <div style="font-family:'Courier New',Courier,monospace;font-size:34px;line-height:1.05;font-weight:bold;letter-spacing:2px;color:#ffffff;">BUILDER</div>
                    <div style="font-family:'Courier New',Courier,monospace;font-size:34px;line-height:1.05;font-weight:bold;letter-spacing:2px;color:${COLORS.purple};">WARS</div>
                    <div style="font-family:'Courier New',Courier,monospace;font-size:14px;line-height:1.2;font-weight:bold;letter-spacing:5px;color:${COLORS.text};margin-top:10px;">HACKATHON</div>
                  </td>
                  <td align="right" style="vertical-align:top;width:90px;">
                    ${renderPixelFlag(6)}
                  </td>
                </tr>
              </table>

              <div style="height:1px;background:${COLORS.panelEdge};margin:24px 0 22px;"></div>

              <p style="margin:0 0 14px;font-family:Arial,Helvetica,sans-serif;font-size:17px;line-height:1.5;color:${COLORS.text};">
                Hey ${name},
              </p>
              <p style="margin:0 0 14px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:${COLORS.text};">
                We're throwing our first hackathon, and we want you in the room. <strong>${urgency}</strong>
              </p>
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:${COLORS.muted};">
                Twenty-four hours at Newlab Detroit. Teams of one to four. You bring the idea, we cover the meals, the energy drinks, and the prize pool. Every major and every experience level is welcome, including students from outside Wayne State.
              </p>
            </td>
          </tr>

          <!-- details -->
          <tr>
            <td style="background:${COLORS.panel};border:1px solid ${COLORS.panelEdge};border-top:0;padding:8px 32px 26px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                ${detailRow('Date', 'Saturday Nov 14 &ndash; Sunday Nov 15, 2026')}
                ${detailRow('Time', 'Sat 10:00 AM &rarr; Sun 3:00 PM')}
                ${detailRow('Where', 'Newlab Detroit')}
                ${detailRow('Teams', '1 to 4 members')}
                ${detailRow('Cost', 'Free admission')}
                ${detailRow('Prizes', '$2,000+ prize pool')}
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="background:${COLORS.purpleDeep};border:1px solid ${COLORS.purple};padding:26px 32px;" align="center">
              <div style="font-family:'Courier New',Courier,monospace;font-size:12px;letter-spacing:4px;text-transform:uppercase;color:#d9d3f5;margin-bottom:14px;">
                Register now
              </div>
              <a href="${REGISTER_URL}" target="_blank" rel="noopener" style="display:inline-block;background:${COLORS.gold};color:${COLORS.ink};text-decoration:none;font-family:'Courier New',Courier,monospace;font-weight:bold;font-size:16px;letter-spacing:2px;text-transform:uppercase;padding:14px 28px;border:2px solid #ffffff;">
                builderwars.dev &rarr;
              </a>
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:#d9d3f5;margin-top:14px;">
                Spots are limited by the venue. Registering early is the only way to guarantee a seat.
              </div>
            </td>
          </tr>

          <!-- sponsors -->
          <tr>
            <td style="padding:26px 8px 8px;">
              <div style="font-family:'Courier New',Courier,monospace;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:${COLORS.muted};margin-bottom:10px;">
                Backed by
              </div>
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.8;color:${COLORS.text};">
                AWS &nbsp;&middot;&nbsp; FreeWili &nbsp;&middot;&nbsp; Red Bull &nbsp;&middot;&nbsp; Ford &nbsp;&middot;&nbsp; Rezzy &nbsp;&middot;&nbsp; Newlab &nbsp;&middot;&nbsp; WSU Engineering Student Senate
              </div>
            </td>
          </tr>

          <!-- footer -->
          <tr>
            <td style="padding:18px 8px 0;border-top:1px solid ${COLORS.panelEdge};">
              <p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:${COLORS.muted};">
                Event details also live on the hub at <a href="${HUB_PAGE_URL}" style="color:${COLORS.purple};">wayneaws.dev/builder-wars</a>.
                Follow <a href="${INSTAGRAM_BW_URL}" style="color:${COLORS.purple};">@builderwars.hack</a> and <a href="${INSTAGRAM_SBG_URL}" style="color:${COLORS.purple};">@aws_sbg_wsu</a> for updates.
              </p>
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#6f6a86;">
                You're getting this because you have an account on the AWS Student Builder Group hub.
                Questions? Reply to this email or write to <a href="mailto:${CONTACT_EMAIL}" style="color:#6f6a86;">${CONTACT_EMAIL}</a>.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

const buildText = (recipient: BroadcastRecipient, now = Date.now()): string => {
  const name = firstName(recipient.fullName);
  return [
    `Hey ${name},`,
    '',
    `We're throwing our first hackathon, and we want you in the room. ${urgencyLine(now)}`,
    '',
    'BUILDER WARS HACKATHON',
    'Date:    Saturday Nov 14 - Sunday Nov 15, 2026',
    'Time:    Sat 10:00 AM -> Sun 3:00 PM',
    'Where:   Newlab Detroit',
    'Teams:   1 to 4 members',
    'Cost:    Free admission (meals and energy drinks included)',
    'Prizes:  $2,000+ prize pool',
    '',
    `Register: ${REGISTER_URL}`,
    `Details:  ${HUB_PAGE_URL}`,
    '',
    'Backed by AWS, FreeWili, Red Bull, Ford, Rezzy, Newlab, and the WSU Engineering Student Senate.',
    '',
    `Questions? Reply to this email or write to ${CONTACT_EMAIL}.`,
    'You are receiving this because you have an account on the AWS Student Builder Group hub.',
  ].join('\n');
};

export const builderWarsBroadcast: BroadcastDefinition = {
  key: BUILDER_WARS_KEY,
  title: 'Builder Wars Hackathon announcement',
  fromName: 'AWS Student Builder Group @ WSU',
  subject: 'Builder Wars Hackathon: Nov 14-15 at Newlab Detroit',
  buildHtml,
  buildText,
};
