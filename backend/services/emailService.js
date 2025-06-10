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

module.exports = {
  sendResetCode
};
