import nodemailer from 'nodemailer';

// Initialize Brevo (Sendinblue) transporter
const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  auth: {
    user: process.env.BREVO_EMAIL,
    pass: process.env.BREVO_API_KEY,
  },
});

export async function sendOTPEmail(
  email: string,
  otp: string,
  userName: string
): Promise<boolean> {
  try {
    const mailOptions = {
      from: 'wisdommeremeze@gmail.com',
      to: email,
      subject: 'FoodBase Password Reset Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #8B7500;">Password Reset Request</h2>
          <p>Hi ${userName},</p>
          <p>You requested a password reset. Use the code below to reset your password. This code expires in 10 minutes.</p>
          <div style="background-color: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0; border-radius: 5px;">
            <h1 style="color: #8B7500; letter-spacing: 5px; margin: 0;">${otp}</h1>
          </div>
          <p style="color: #666;">If you didn't request this, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
          <p style="color: #999; font-size: 12px; text-align: center;">
            © ${new Date().getFullYear()} FoodBase. All rights reserved, in conjunction with Wisdom Technologies.
          </p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('[v0] Email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('[v0] Email send error:', error);
    return false;
  }
}

export async function sendPaymentNotification(
  email: string,
  businessName: string,
  amount: number,
  orderNumber: string
): Promise<boolean> {
  try {
    const formattedAmount = new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
    }).format(amount);

    const mailOptions = {
      from: 'wisdommeremeze@gmail.com',
      to: email,
      subject: `New Order Received - ${businessName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #8B7500;">New Order Received</h2>
          <p>You have received a new order!</p>
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Order Number:</strong> ${orderNumber}</p>
            <p><strong>Amount:</strong> ${formattedAmount}</p>
            <p><strong>Status:</strong> Payment Confirmed</p>
          </div>
          <p style="color: #666;">Log in to your FoodBase dashboard to view order details and manage preparation.</p>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
          <p style="color: #999; font-size: 12px; text-align: center;">
            © ${new Date().getFullYear()} FoodBase. All rights reserved, in conjunction with Wisdom Technologies.
          </p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('[v0] Notification sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('[v0] Notification send error:', error);
    return false;
  }
}

export async function sendCustomEmail(
  email: string,
  subject: string,
  html: string
): Promise<boolean> {
  try {
    const mailOptions = {
      from: 'wisdommeremeze@gmail.com',
      to: email,
      subject,
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('[v0] Custom email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('[v0] Custom email error:', error);
    return false;
  }
}
