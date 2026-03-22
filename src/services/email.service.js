const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    // Setup email transporter
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,      // Gmail address
        pass: process.env.EMAIL_PASSWORD   // App-specific password
      }
    });
  }

  async sendVerificationEmail(email, verificationLink) {
    try {
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

      const mailOptions = {
        from: `"Social Network" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: '[Social Network] Xác thực Email của Bạn',
        html: htmlContent
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('Email sent:', info.response);

      return { success: true, message: 'Email sent successfully' };
    } catch (error) {
      console.error('Email sending error:', error);
      return { success: false, error: error.message };
    }
  }

  async sendResetPasswordEmail(email, resetLink) {
    try {
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

      const mailOptions = {
        from: `"Social Network" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: '[Social Network] Đặt lại Mật khẩu',
        html: htmlContent
      };

      await this.transporter.sendMail(mailOptions);
      return { success: true, message: 'Reset email sent successfully' };
    } catch (error) {
      console.error('Email sending error:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new EmailService();
