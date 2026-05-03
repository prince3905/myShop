const nodemailer = require('nodemailer');
const logger = require('./logger');

// Create reusable transporter
const createTransporter = () => {
  // Use Gmail or other SMTP service
  return nodemailer.createTransporter({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
};

// Send email alert for high-risk fraud detection
const sendFraudAlert = async (shopName, riskScore, riskLevel, alerts, recipientEmail) => {
  try {
    // Skip if email not configured
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      logger.warn('Email not configured. Skipping fraud alert email.');
      return { success: false, message: 'Email not configured' };
    }

    const transporter = createTransporter();
    
    const highAlerts = alerts.filter(a => a.severity === 'HIGH');
    const alertSummary = highAlerts.map(a => `- ${a.title}: ${a.description}`).join('\n');

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px; color: white; text-align: center;">
          <h1 style="margin: 0; font-size: 28px;">⚠️ FRAUD ALERT</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Immediate Action Required</p>
        </div>
        
        <div style="background: #f5f7fa; padding: 20px; border-radius: 12px; margin: 20px 0;">
          <h2 style="color: #333; margin-top: 0;">Shop: ${shopName}</h2>
          <div style="display: flex; gap: 20px; margin: 20px 0;">
            <div style="flex: 1; text-align: center; padding: 15px; background: white; border-radius: 8px;">
              <div style="font-size: 32px; font-weight: bold; color: ${riskLevel === 'HIGH' ? '#f44336' : '#ff9800'};">${riskScore}</div>
              <div style="color: #666; font-size: 14px;">Risk Score</div>
            </div>
            <div style="flex: 1; text-align: center; padding: 15px; background: white; border-radius: 8px;">
              <div style="font-size: 32px; font-weight: bold; color: #333;">${alerts.length}</div>
              <div style="color: #666; font-size: 14px;">Total Alerts</div>
            </div>
          </div>
        </div>

        <div style="background: white; padding: 20px; border-radius: 12px; border-left: 4px solid #f44336;">
          <h3 style="color: #c62828; margin-top: 0;">High Priority Alerts:</h3>
          <ul style="color: #333;">
            ${highAlerts.map(a => `<li style="margin: 10px 0;"><strong>${a.title}</strong><br><span style="color: #666; font-size: 14px;">${a.description}</span></li>`).join('')}
          </ul>
        </div>

        <div style="background: #fff3e0; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ff9800;">
          <strong>Action Required:</strong> Please verify physical cash, inventory, and staff activities immediately. Log in to the Fraud Detection Dashboard for full details.
        </div>

        <div style="text-align: center; margin-top: 20px; color: #666; font-size: 12px;">
          This is an automated alert from MyShop Fraud Detection System
        </div>
      </div>
    `;

    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: recipientEmail,
      subject: `🚨 FRAUD ALERT - ${shopName} - Risk Score: ${riskScore}`,
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info(`Fraud alert email sent: ${info.messageId} to ${recipientEmail}`);
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error(`Failed to send fraud alert email: ${error.message}`);
    return { success: false, error: error.message };
  }
};

module.exports = { sendFraudAlert };
