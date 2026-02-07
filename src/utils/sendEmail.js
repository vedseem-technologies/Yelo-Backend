const nodemailer = require("nodemailer");

const sendEmail = async ({ email, subject, message, html }) => {
  try {
    console.log(`[Mail System] Initializing transporter...`);
    console.log(`[Mail System] Config: Host=${process.env.MAIL_HOST}, Port=${process.env.MAIL_PORT}, Secure=${process.env.MAIL_SECURE}, User=${process.env.MAIL_USER}`);

    const transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: Number(process.env.MAIL_PORT),
      secure: process.env.MAIL_SECURE === "true", // true for 465, false for other ports
      auth: {
        user: process.env.MAIL_USER || "info@yeahlo.in",
        pass: process.env.MAIL_PASS, // Not logging password for security
      },
      debug: true, // Always enable debug output for now
      logger: true // Always enable logger for now
    });

    // Verify connection configuration
    try {
      console.log(`[Mail System] Verifying SMTP connection...`);
      await transporter.verify();
      console.log("[Mail System] SMTP Connection verified successfully");
    } catch (verifyError) {
      console.error("[Mail System] SMTP Connection Verification Failed:", verifyError);
      // We might want to throw here, but let's try sending anyway or just log it specificially
    }

    const mailOptions = {
      // Hostinger requires the sender to be the same as the authenticated user
      from: `"YEAHLO Fashion" <${process.env.MAIL_USER}>`,
      to: email,
      subject: subject,
      text: message,
      html: html,
    };

    console.log(`[Mail System] Attempting to find email to: ${email} with subject: "${subject}"`);

    const info = await transporter.sendMail(mailOptions);
    console.log("[Mail System] Message sent successfully!");
    console.log("[Mail System] Message ID: %s", info.messageId);
    console.log("[Mail System] Response: %s", info.response);

    return info;
  } catch (error) {
    console.error("[Mail System] CRITICAL ERROR sending email:", error);
    console.error("[Mail System] Error Stack:", error.stack);
    throw new Error("Email could not be sent: " + error.message);
  }
};

module.exports = sendEmail;
