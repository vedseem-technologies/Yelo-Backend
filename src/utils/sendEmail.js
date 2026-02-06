const nodemailer = require("nodemailer");

const sendEmail = async ({ email, subject, message, html }) => {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: Number(process.env.MAIL_PORT),
      secure: process.env.MAIL_SECURE === "true", // true for 465, false for other ports
      auth: {
        user: process.env.MAIL_USER || "info@yeahlo.in",
        pass: process.env.MAIL_PASS,
      },
      debug: process.env.NODE_ENV === "development", // Log connection details in dev
      logger: process.env.NODE_ENV === "development" // Log data in dev
    });

    // Verify connection configuration
    if (process.env.NODE_ENV === "development") {
      try {
        await transporter.verify();
        console.log("SMTP Connection verified successfully");
      } catch (verifyError) {
        console.error("SMTP Connection Failed:", verifyError);
        throw verifyError;
      }
    }

    const mailOptions = {
      // Hostinger requires the sender to be the same as the authenticated user
      from: `"YEAHLO Fashion" <${process.env.MAIL_USER}>`,
      to: email,
      subject: subject,
      text: message,
      html: html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Message sent: %s", info.messageId);
    return info;
  } catch (error) {
    console.error("Error sending email:", error);
    throw new Error("Email could not be sent: " + error.message);
  }
};

module.exports = sendEmail;
