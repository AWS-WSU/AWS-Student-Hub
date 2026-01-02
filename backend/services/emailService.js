const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

const sendResetCode = async (email, code, fullName) => {
  const mailOptions = {
    from: `"AWS Student Hub" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Password Reset Code - AWS Student Hub',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .code-box { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0; }
          .code { font-size: 32px; font-weight: bold; color: #FF9900; letter-spacing: 5px; }
          .footer { margin-top: 30px; font-size: 14px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Password Reset Request</h2>
          </div>
          <p>Hello ${fullName},</p>
          <p>You requested to reset your password for your AWS Student Hub account. Use the code below to complete your password reset:</p>
          <div class="code-box">
            <div class="code">${code}</div>
          </div>
          <p>This code will expire in 10 minutes for security reasons.</p>
          <p>If you didn't request this password reset, please ignore this email or contact support if you have concerns.</p>
          <div class="footer">
            <p>Best regards,<br>AWS Student Hub Team</p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  await transporter.sendMail(mailOptions);
};

const sendEventNotification = async (email, fullName, event) => {
  const eventDate = new Date(event.startTime);
  const formattedDate = eventDate.toLocaleDateString('en-US', { 
    timeZone: 'America/Detroit',
    weekday: 'long',
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  const formattedTime = eventDate.toLocaleTimeString('en-US', { 
    timeZone: 'America/Detroit',
    hour: 'numeric', 
    minute: '2-digit',
    timeZoneName: 'short'
  });

  const isRemote = event.isRemote === true || event.isRemote === 'true';
  
  let locationHtml = '';
  if (isRemote) {
    locationHtml = `
      <div class="location-badge remote">
        <span class="badge-icon">🌐</span>
        <span>Remote Event</span>
      </div>
      ${event.zoomLink ? `
        <a href="${event.zoomLink}" class="join-button" target="_blank" rel="noopener">
          🔗 Join Webinar
        </a>
      ` : '<p style="color: #666; font-style: italic;">Zoom link will be shared before the event</p>'}
    `;
  } else {
    locationHtml = `
      <div class="location-badge inperson">
        <span class="badge-icon">📍</span>
        <span>In-Person Event</span>
      </div>
      ${event.locationName ? `<p style="font-weight: 600; margin: 8px 0;">${event.locationName}</p>` : ''}
      ${event.address ? `<p style="color: #555; margin: 4px 0;">${event.address}</p>` : ''}
      ${event.directions ? `<p style="color: #777; font-size: 14px; margin-top: 8px; padding: 10px; background: #f8f9fa; border-radius: 6px;"><strong>Directions:</strong> ${event.directions}</p>` : ''}
    `;
  }

  const mailOptions = {
    from: `"AWS Cloud Club @ WSU" <${process.env.SMTP_USER}>`,
    to: email,
    subject: `🚀 New Event: ${event.title} - AWS Cloud Club`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            line-height: 1.6; 
            color: #232f3e; 
            margin: 0;
            padding: 0;
            background-color: #f4f4f4;
          }
          .email-wrapper {
            max-width: 600px;
            margin: 0 auto;
            background: #ffffff;
          }
          .header {
            background: linear-gradient(135deg, #232f3e 0%, #37475a 100%);
            padding: 40px 30px;
            text-align: center;
          }
          .header h1 {
            color: #FF9900;
            margin: 0;
            font-size: 28px;
            font-weight: 700;
          }
          .header p {
            color: #ffffff;
            margin: 10px 0 0;
            font-size: 14px;
            opacity: 0.9;
          }
          .content {
            padding: 40px 30px;
          }
          .greeting {
            font-size: 18px;
            color: #232f3e;
            margin-bottom: 25px;
          }
          .event-card {
            background: linear-gradient(145deg, #fff9f0 0%, #ffffff 100%);
            border: 2px solid #FF9900;
            border-radius: 16px;
            padding: 30px;
            margin: 25px 0;
          }
          .event-title {
            font-size: 24px;
            font-weight: 700;
            color: #232f3e;
            margin: 0 0 20px;
            text-align: center;
          }
          .event-detail {
            display: flex;
            align-items: flex-start;
            margin: 15px 0;
            padding: 12px;
            background: #ffffff;
            border-radius: 10px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
          }
          .detail-icon {
            font-size: 24px;
            margin-right: 15px;
            min-width: 30px;
          }
          .detail-content {
            flex: 1;
          }
          .detail-label {
            font-size: 12px;
            color: #888;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 4px;
          }
          .detail-value {
            font-size: 16px;
            color: #232f3e;
            font-weight: 500;
          }
          .location-badge {
            display: inline-flex;
            align-items: center;
            padding: 8px 16px;
            border-radius: 20px;
            font-weight: 600;
            font-size: 14px;
            margin-bottom: 12px;
          }
          .location-badge.remote {
            background: #e3f2fd;
            color: #1565c0;
          }
          .location-badge.inperson {
            background: #e8f5e9;
            color: #2e7d32;
          }
          .badge-icon {
            margin-right: 8px;
          }
          .description-box {
            background: #f8f9fa;
            border-left: 4px solid #FF9900;
            padding: 20px;
            margin: 20px 0;
            border-radius: 0 10px 10px 0;
          }
          .description-box h4 {
            margin: 0 0 10px;
            color: #232f3e;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .description-box p {
            margin: 0;
            color: #555;
            font-size: 15px;
          }
          .cta-section {
            text-align: center;
            margin: 30px 0;
          }
          .join-button {
            display: inline-block;
            background: linear-gradient(135deg, #FF9900 0%, #ffb84d 100%);
            color: #232f3e !important;
            text-decoration: none;
            padding: 14px 32px;
            border-radius: 30px;
            font-weight: 700;
            font-size: 16px;
            box-shadow: 0 4px 15px rgba(255, 153, 0, 0.4);
            transition: transform 0.2s;
          }
          .meetup-button {
            display: inline-block;
            background: #ED1C40;
            color: #ffffff !important;
            text-decoration: none;
            padding: 14px 32px;
            border-radius: 30px;
            font-weight: 700;
            font-size: 16px;
            margin-top: 15px;
          }
          ${event.thumbnailUrl ? `
          .event-image {
            width: 100%;
            height: auto;
            border-radius: 12px;
            margin-bottom: 25px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
          }
          ` : ''}
          .footer {
            background: #232f3e;
            padding: 30px;
            text-align: center;
          }
          .footer p {
            color: #ffffff;
            margin: 0 0 10px;
            font-size: 14px;
          }
          .footer a {
            color: #FF9900;
            text-decoration: none;
          }
          .social-links {
            margin: 20px 0;
          }
          .social-links a {
            display: inline-block;
            margin: 0 10px;
            color: #FF9900;
            text-decoration: none;
          }
          .unsubscribe {
            font-size: 12px;
            color: #888;
            margin-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="header">
            <h1>☁️ AWS Cloud Club</h1>
            <p>Wayne State University</p>
          </div>
          
          <div class="content">
            <p class="greeting">Hey ${fullName}! 👋</p>
            
            <p>Great news! We have a new event coming up that you won't want to miss:</p>
            
            <div class="event-card">
              ${event.thumbnailUrl ? `<img src="${event.thumbnailUrl}" alt="${event.title}" class="event-image" />` : ''}
              
              <h2 class="event-title">${event.title}</h2>
              
              <div class="event-detail">
                <span class="detail-icon">📅</span>
                <div class="detail-content">
                  <div class="detail-label">Date</div>
                  <div class="detail-value">${formattedDate}</div>
                </div>
              </div>
              
              <div class="event-detail">
                <span class="detail-icon">⏰</span>
                <div class="detail-content">
                  <div class="detail-label">Time</div>
                  <div class="detail-value">${formattedTime}</div>
                </div>
              </div>
              
              <div class="event-detail">
                <span class="detail-icon">📍</span>
                <div class="detail-content">
                  <div class="detail-label">Location</div>
                  <div class="detail-value">
                    ${locationHtml}
                  </div>
                </div>
              </div>
            </div>
            
            ${event.description ? `
            <div class="description-box">
              <h4>📝 About This Event</h4>
              <p>${event.description}</p>
            </div>
            ` : ''}
            
            <div class="cta-section">
              ${event.meetupUrl ? `
                <a href="${event.meetupUrl}" class="meetup-button" target="_blank" rel="noopener">
                  📋 RSVP on Meetup
                </a>
              ` : ''}
            </div>
            
            <p style="color: #666; text-align: center; margin-top: 30px;">
              We can't wait to see you there! 🎉
            </p>
          </div>
          
          <div class="footer">
            <p>AWS Cloud Club @ Wayne State University</p>
            <div class="social-links">
              <a href="https://discord.gg/KaQdmjGp">Discord</a> •
              <a href="https://www.instagram.com/awscloudclub.wsu">Instagram</a> •
              <a href="https://github.com/awsccwsu">GitHub</a>
            </div>
            <p class="unsubscribe">
              You're receiving this because you're a registered member of AWS Cloud Club.<br>
              Questions? Reply to this email or reach out on Discord.
            </p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  await transporter.sendMail(mailOptions);
};

const sendBulkEventNotification = async (users, event) => {
  const results = {
    sent: 0,
    failed: 0,
    errors: []
  };

  for (const user of users) {
    try {
      await sendEventNotification(user.email, user.fullName, event);
      results.sent++;
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      results.failed++;
      results.errors.push({ email: user.email, error: error.message });
    }
  }

  return results;
};

module.exports = {
  sendResetCode,
  sendEventNotification,
  sendBulkEventNotification
};
