const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendFallbackEmail(to, token) {
  // Use environment variable for client URL
  const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
  const link = `${clientUrl}/fallback/${token}`;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to,
    subject: "SecuADR - Your Fallback Authentication Link",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">SecuADR Fallback Authentication</h2>
        <p>You requested a fallback authentication link for your SecuADR account.</p>
        <p>Click the link below to draw your pattern and log in:</p>
        <div style="text-align: center; margin: 20px 0;">
          <a href="${link}" 
             style="background-color: #007bff; color: white; padding: 12px 24px; 
                    text-decoration: none; border-radius: 5px; display: inline-block;">
            Access SecuADR
          </a>
        </div>
        <p><strong>Important:</strong> This link expires in 10 minutes for security.</p>
        <p>If you didn't request this, please ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">SecuADR - Secure Gesture Authentication</p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("📧 Email sent successfully:", info.messageId);
    return true;
  } catch (err) {
    console.error("❌ Email send failed:", err);
    return false;
  }
}

module.exports = sendFallbackEmail;
