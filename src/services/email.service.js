const nodemailer = require('nodemailer');
const axios = require('axios');

class EmailService {
  constructor() {
    this.isResendActive = !!process.env.RESEND_API_KEY;

    if (this.isResendActive) {
      console.log('EmailService: Resend HTTP API configured as the primary email provider.');
    } else {
      console.log('EmailService: Resend API key not found. Configuring Nodemailer SMTP (Gmail) as fallback.');
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,      // Gmail address
          pass: process.env.EMAIL_PASSWORD   // App-specific password
        }
      });
    }
  }

  /**
   * Sends an email via Resend HTTP API.
   * @param {String} to - Recipient email address
   * @param {String} subject - Email subject
   * @param {String} html - HTML content of the email
   * @returns {Promise<Object>} Success status
   */
  async sendEmailViaResend(to, subject, html) {
    try {
      const apiKey = process.env.RESEND_API_KEY;
      const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

      const response = await axios.post(
        'https://api.resend.com/emails',
        {
          from: `Social Network <${fromEmail}>`,
          to: [to],
          subject,
          html,
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );

      console.log('Email sent successfully via Resend API:', response.data);
      return { success: true, message: 'Email sent successfully via Resend' };
    } catch (error) {
      const errorMsg = error.response?.data?.message || JSON.stringify(error.response?.data) || error.message;
      console.error('Failed to send email via Resend API:', errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  async sendVerificationEmail(email, verificationLink) {
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Xác thực Email - Social Network</h2>
        <p style="color: #666; font-size: 16px;">
          Cảm ơn bạn đã đăng ký tài khoản! Vui lòng nhấp vào link bên dưới để xác thực email của bạn:
        </p>
        <div style="margin: 30px 0;">
          <a href="${verificationLink}" 
             style="display: inline-block; padding: 12px 30px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
            Xác thực Email
          </a>
        </div>
        <p style="color: #999; font-size: 14px;">
          Hoặc sao chép link này vào trình duyệt:<br>
          ${verificationLink}
        </p>
        <p style="color: #999; font-size: 12px;">
          ⏰ Link này sẽ hết hạn trong 24 giờ<br>
          Nếu bạn không đăng ký, vui lòng bỏ qua email này.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #999; font-size: 12px; text-align: center;">
          © 2026 Social Network. All rights reserved.
        </p>
      </div>
    `;

    if (process.env.RESEND_API_KEY) {
      return this.sendEmailViaResend(email, '[Social Network] Xác thực Email của Bạn', htmlContent);
    }

    try {
      const mailOptions = {
        from: `"Social Network" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: '[Social Network] Xác thực Email của Bạn',
        html: htmlContent
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('Email sent via SMTP:', info.response);

      return { success: true, message: 'Email sent successfully' };
    } catch (error) {
      console.error('Email sending SMTP error:', error);
      return { success: false, error: error.message };
    }
  }

  async sendResetPasswordEmail(email, resetLink) {
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Đặt lại Mật khẩu</h2>
        <p style="color: #666; font-size: 16px;">
          Bạn yêu cầu đặt lại mật khẩu. Nhấp vào link bên dưới:
        </p>
        <div style="margin: 30px 0;">
          <a href="${resetLink}" 
             style="display: inline-block; padding: 12px 30px; background: #28a745; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
            Đặt lại Mật khẩu
          </a>
        </div>
        <p style="color: #999; font-size: 12px;">
          ⏰ Link này sẽ hết hạn trong 1 giờ<br>
          Nếu bạn không yêu cầu, vui lòng bỏ qua email này.
        </p>
      </div>
    `;

    if (process.env.RESEND_API_KEY) {
      return this.sendEmailViaResend(email, '[Social Network] Đặt lại Mật khẩu', htmlContent);
    }

    try {
      const mailOptions = {
        from: `"Social Network" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: '[Social Network] Đặt lại Mật khẩu',
        html: htmlContent
      };

      await this.transporter.sendMail(mailOptions);
      return { success: true, message: 'Reset email sent successfully' };
    } catch (error) {
      console.error('Email sending SMTP error:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new EmailService();
