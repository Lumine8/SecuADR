// utils/mailer.js
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail", // or 'hotmail', etc.
  auth: {
    user: process.env.EMAIL_USER, // e.g., yourapp@gmail.com
    pass: process.env.EMAIL_PASS, // app password or real password (use env)
  },
});

async function sendFallbackEmail(to, token) {
  const link = `http://localhost:5173/fallback/${token}`;
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to,
    subject: "Your Fallback Login Link",
    html: `<p>Click the link below to draw your pattern and log in:</p>
           <a href="${link}">${link}</a><br/>
           <p>This link expires in 10 minutes.</p>`,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent:", info.response);
    return true;
  } catch (err) {
    console.error("Email send failed:", err);
    return false;
  }
}

module.exports = sendFallbackEmail;
