const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

class EmailService {
  constructor() {
    const port = parseInt(process.env.EMAIL_PORT || process.env.SMTP_PORT || '587');
    const secure = port === 465; // Use SSL for port 465, TLS for port 587
    
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || process.env.SMTP_HOST || 'smtp.gmail.com',
      port: port,
      secure: secure, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER || process.env.SMTP_USER || 'your-email@gmail.com',
        pass: process.env.EMAIL_PASS || process.env.SMTP_PASS || 'your-app-password'
      }
    });
  }

  // Send transaction status update email
  async sendTransactionStatusUpdateEmail(transaction, user, product, previousStatus = null) {
    try {
      const statusChange = previousStatus ? ` from ${previousStatus} to ${transaction.status}` : ` to ${transaction.status}`;
      const statusColor = this.getStatusColor(transaction.status);
      
      const mailOptions = {
        from: process.env.EMAIL_FROM || process.env.SMTP_USER || 'noreply@torquehub.com',
        to: user.email,
        subject: `Order Status Updated - Order #${transaction.id}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
            <div style="background: linear-gradient(135deg, #7c4dff, #b388ff); color: white; padding: 30px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px;">TorqueHub</h1>
              <p style="margin: 10px 0 0 0; font-size: 16px;">Order Status Update</p>
            </div>
            
            <div style="padding: 30px;">
              <h2 style="color: #333; margin-bottom: 20px;">Hello ${user.full_name},</h2>
              
              <p style="color: #666; font-size: 16px; line-height: 1.6;">
                Your order status has been updated${statusChange}.
              </p>
              
              <div style="background: #f8f9fa; border-radius: 12px; padding: 25px; margin: 25px 0; border-left: 4px solid ${statusColor};">
                <h3 style="color: #333; margin-top: 0;">Order Details</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                  <div>
                    <p style="margin: 5px 0; color: #666;"><strong style="color: #333;">Order ID:</strong> #${transaction.id}</p>
                    <p style="margin: 5px 0; color: #666;"><strong style="color: #333;">Status:</strong> 
                      <span style="background: ${statusColor}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px;">
                        ${transaction.status.toUpperCase()}
                      </span>
                    </p>
                    <p style="margin: 5px 0; color: #666;"><strong style="color: #333;">Date:</strong> ${new Date(transaction.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p style="margin: 5px 0; color: #666;"><strong style="color: #333;">Product:</strong> ${product.name}</p>
                    <p style="margin: 5px 0; color: #666;"><strong style="color: #333;">Quantity:</strong> ${transaction.quantity}</p>
                    <p style="margin: 5px 0; color: #666;"><strong style="color: #333;">Total Amount:</strong> $${parseFloat(transaction.total_amount).toFixed(2)}</p>
                  </div>
                </div>
              </div>
              
              <div style="background: #e8f5e8; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <h4 style="color: #2e7d32; margin-top: 0;">What's Next?</h4>
                <p style="color: #2e7d32; margin: 0; font-size: 14px;">
                  ${this.getStatusMessage(transaction.status)}
                </p>
              </div>
              
              <div style="text-align: center; margin-top: 30px;">
                <a href="${process.env.BASE_URL || 'http://localhost:3000'}/dashboard" 
                   style="background: #7c4dff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
                  View Order Details
                </a>
              </div>
              
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #666;">
                <p>Thank you for choosing TorqueHub!</p>
                <p style="font-size: 12px;">If you have any questions, please contact our support team.</p>
              </div>
            </div>
          </div>
        `
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`✅ Transaction status update email sent to ${user.email}`);
    } catch (error) {
      console.error('❌ Error sending transaction status update email:', error);
      throw error;
    }
  }

  // Get status color for email styling
  getStatusColor(status) {
    const colors = {
      'pending': '#ff9800',
      'confirmed': '#2196f3',
      'shipped': '#9c27b0',
      'delivered': '#4caf50',
      'cancelled': '#f44336'
    };
    return colors[status.toLowerCase()] || '#666';
  }

  // Get status message for email
  getStatusMessage(status) {
    const messages = {
      'pending': 'We are currently processing your order. You will receive an update once it is confirmed.',
      'confirmed': 'Your order has been confirmed and is being prepared for shipment.',
      'shipped': 'Your order has been shipped! You can track your delivery status.',
      'delivered': 'Your order has been successfully delivered. Thank you for your purchase!',
      'cancelled': 'Your order has been cancelled. If you have any questions, please contact support.'
    };
    return messages[status.toLowerCase()] || 'Your order status has been updated.';
  }

  // Generate PDF receipt
  generateReceiptPDF(transaction, user, product) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 50
        });
        
        const fileName = `receipt_${transaction.id}_${Date.now()}.pdf`;
        const filePath = path.join(__dirname, '../public/uploads', fileName);
        const stream = fs.createWriteStream(filePath);

        doc.pipe(stream);

        // Header
        doc.fontSize(28).font('Helvetica-Bold').text('TorqueHub', { align: 'center' });
        doc.fontSize(16).font('Helvetica').text('Official Receipt', { align: 'center' });
        doc.moveDown(0.5);
        
        // Receipt number and date
        doc.fontSize(12).font('Helvetica-Bold').text(`Receipt #: ${transaction.id}`);
        doc.fontSize(10).font('Helvetica').text(`Date: ${new Date(transaction.createdAt).toLocaleDateString()}`);
        doc.fontSize(10).font('Helvetica').text(`Time: ${new Date(transaction.createdAt).toLocaleTimeString()}`);
        doc.moveDown();

        // Customer information
        doc.fontSize(14).font('Helvetica-Bold').text('Customer Information');
        doc.fontSize(10).font('Helvetica').text(`Name: ${user.full_name}`);
        doc.fontSize(10).font('Helvetica').text(`Email: ${user.email}`);
        doc.moveDown();

        // Product details table
        doc.fontSize(14).font('Helvetica-Bold').text('Order Details');
        doc.moveDown(0.5);
        
        // Table header
        const tableTop = doc.y;
        const itemX = 50;
        const qtyX = 250;
        const priceX = 320;
        const totalX = 420;
        
        doc.fontSize(10).font('Helvetica-Bold');
        doc.text('Item', itemX, tableTop);
        doc.text('Qty', qtyX, tableTop);
        doc.text('Price', priceX, tableTop);
        doc.text('Total', totalX, tableTop);
        
        // Table line
        doc.moveTo(itemX, tableTop + 15).lineTo(totalX + 80, tableTop + 15).stroke();
        
        // Product row
        doc.fontSize(10).font('Helvetica');
        doc.text(product.name, itemX, tableTop + 25);
        doc.text(transaction.quantity.toString(), qtyX, tableTop + 25);
        doc.text(`$${parseFloat(product.price).toFixed(2)}`, priceX, tableTop + 25);
        doc.text(`$${parseFloat(transaction.total_amount).toFixed(2)}`, totalX, tableTop + 25);
        
        // Bottom line
        doc.moveTo(itemX, tableTop + 45).lineTo(totalX + 80, tableTop + 45).stroke();
        doc.moveDown(2);

        // Payment information
        doc.fontSize(12).font('Helvetica-Bold').text('Payment Information');
        doc.fontSize(10).font('Helvetica');
        doc.text(`Payment Method: ${transaction.payment_method || 'Not specified'}`);
        doc.text(`Order Status: ${transaction.status.toUpperCase()}`);
        doc.moveDown();

        // Total section
        doc.fontSize(14).font('Helvetica-Bold').text(`Total Amount: $${parseFloat(transaction.total_amount).toFixed(2)}`);
        doc.moveDown();

        // Shipping information
        if (transaction.shipping_address) {
          doc.fontSize(12).font('Helvetica-Bold').text('Shipping Address');
          doc.fontSize(10).font('Helvetica').text(transaction.shipping_address);
          doc.moveDown();
        }

        // Footer
        doc.fontSize(10).font('Helvetica').text('Thank you for choosing TorqueHub!', { align: 'center' });
        doc.fontSize(8).font('Helvetica').text('For support, contact us at support@torquehub.com', { align: 'center' });

        doc.end();

        stream.on('finish', () => {
          resolve(fileName);
        });

        stream.on('error', reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  // Send transaction update email with PDF receipt
  async sendTransactionUpdateWithReceipt(transaction, user, product) {
    try {
      // Generate PDF receipt
      const pdfFileName = await this.generateReceiptPDF(transaction, user, product);
      const pdfPath = path.join(__dirname, '../public/uploads', pdfFileName);

      const mailOptions = {
        from: process.env.EMAIL_FROM || process.env.SMTP_USER || 'noreply@torquehub.com',
        to: user.email,
        subject: `Transaction Update - Order #${transaction.id}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #7c4dff;">Transaction Update</h2>
            <p>Hello ${user.full_name},</p>
            <p>Your transaction has been updated. Please find the receipt attached.</p>
            <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3>Order Details:</h3>
              <p><strong>Order ID:</strong> #${transaction.id}</p>
              <p><strong>Status:</strong> ${transaction.status}</p>
              <p><strong>Total Amount:</strong> $${transaction.total_amount}</p>
              <p><strong>Date:</strong> ${new Date(transaction.createdAt).toLocaleDateString()}</p>
            </div>
            <p>Thank you for choosing TorqueHub!</p>
          </div>
        `,
        attachments: [
          {
            filename: `receipt_${transaction.id}.pdf`,
            path: pdfPath
          }
        ]
      };

      await this.transporter.sendMail(mailOptions);
      
      // Update transaction with receipt path
      await transaction.update({ receipt_path: `/uploads/${pdfFileName}` });
      
      console.log(`Transaction update email with receipt sent to ${user.email}`);
    } catch (error) {
      console.error('Error sending transaction update email with receipt:', error);
      throw error;
    }
  }

  // Send verification email
  async sendVerificationEmail(user, verificationToken) {
    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM || process.env.SMTP_USER || 'noreply@torquehub.com',
        to: user.email,
        subject: 'Verify Your TorqueHub Account',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #7c4dff;">Welcome to TorqueHub!</h2>
            <p>Hello ${user.full_name},</p>
            <p>Please verify your email address by clicking the link below:</p>
            <a href="${process.env.BASE_URL || 'http://localhost:3000'}/api/auth/verify-email?token=${verificationToken}" 
               style="background: #7c4dff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Verify Email
            </a>
            <p>If the button doesn't work, copy and paste this link:</p>
            <p>${process.env.BASE_URL || 'http://localhost:3000'}/api/auth/verify-email?token=${verificationToken}</p>
            <p>Thank you for joining TorqueHub!</p>
          </div>
        `
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`Verification email sent to ${user.email}`);
    } catch (error) {
      console.error('Error sending verification email:', error);
      throw error;
    }
  }

  // Send comprehensive order receipt email
  async sendOrderReceiptEmail(transactions, orderItems, userInfo, totalAmount, shippingAddress) {
    try {
      const orderDate = new Date().toLocaleDateString();
      const orderTime = new Date().toLocaleTimeString();
      
      // Create order items HTML
      const orderItemsHTML = orderItems.map(item => `
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 12px; text-align: left;">${item.product.name}</td>
          <td style="padding: 12px; text-align: center;">${item.quantity}</td>
          <td style="padding: 12px; text-align: right;">$${parseFloat(item.product.price).toFixed(2)}</td>
          <td style="padding: 12px; text-align: right;">$${(parseFloat(item.product.price) * item.quantity).toFixed(2)}</td>
        </tr>
      `).join('');

      const mailOptions = {
        from: process.env.EMAIL_FROM || process.env.SMTP_USER || 'noreply@torquehub.com',
        to: userInfo.email,
        subject: `Order Confirmation - TorqueHub`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; background: #ffffff;">
            <div style="background: linear-gradient(135deg, #7c4dff, #b388ff); color: white; padding: 30px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px;">TorqueHub</h1>
              <p style="margin: 10px 0 0 0; font-size: 16px;">Order Confirmation</p>
            </div>
            
            <div style="padding: 30px;">
              <h2 style="color: #333; margin-bottom: 20px;">Thank you for your order, ${userInfo.full_name}!</h2>
              
              <p style="color: #666; font-size: 16px; line-height: 1.6;">
                Your order has been successfully placed and is being processed. You will receive updates as your order progresses.
              </p>
              
              <div style="background: #f8f9fa; border-radius: 12px; padding: 25px; margin: 25px 0; border-left: 4px solid #7c4dff;">
                <h3 style="color: #333; margin-top: 0;">Order Information</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                  <div>
                    <p style="margin: 5px 0; color: #666;"><strong style="color: #333;">Order Date:</strong> ${orderDate}</p>
                    <p style="margin: 5px 0; color: #666;"><strong style="color: #333;">Order Time:</strong> ${orderTime}</p>
                    <p style="margin: 5px 0; color: #666;"><strong style="color: #333;">Number of Items:</strong> ${orderItems.length}</p>
                    <p style="margin: 5px 0; color: #666;"><strong style="color: #333;">Total Amount:</strong> $${parseFloat(totalAmount).toFixed(2)}</p>
                  </div>
                  <div>
                    <p style="margin: 5px 0; color: #666;"><strong style="color: #333;">Status:</strong> 
                      <span style="background: #ff9800; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px;">
                        PENDING
                      </span>
                    </p>
                    <p style="margin: 5px 0; color: #666;"><strong style="color: #333;">Payment Method:</strong> Credit Card</p>
                    <p style="margin: 5px 0; color: #666;"><strong style="color: #333;">Email:</strong> ${userInfo.email}</p>
                  </div>
                </div>
              </div>

              <div style="background: #fff; border: 1px solid #e0e0e0; border-radius: 12px; padding: 25px; margin: 25px 0;">
                <h3 style="color: #333; margin-top: 0; margin-bottom: 20px;">Order Details</h3>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                  <thead>
                    <tr style="background: #f5f5f5; border-bottom: 2px solid #e0e0e0;">
                      <th style="padding: 12px; text-align: left; font-weight: 600; color: #333;">Product</th>
                      <th style="padding: 12px; text-align: center; font-weight: 600; color: #333;">Quantity</th>
                      <th style="padding: 12px; text-align: right; font-weight: 600; color: #333;">Unit Price</th>
                      <th style="padding: 12px; text-align: right; font-weight: 600; color: #333;">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${orderItemsHTML}
                  </tbody>
                </table>
                
                <div style="border-top: 2px solid #e0e0e0; padding-top: 15px;">
                  <div style="display: flex; justify-content: space-between; font-weight: 600; font-size: 18px; color: #333;">
                    <span>Total Amount:</span>
                    <span>$${parseFloat(totalAmount).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div style="background: #e8f5e8; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <h4 style="color: #2e7d32; margin-top: 0;">Shipping Information</h4>
                <p style="color: #2e7d32; margin: 0; font-size: 14px;">
                  <strong>Address:</strong> ${shippingAddress}
                </p>
              </div>
              
              <div style="background: #fff3cd; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <h4 style="color: #856404; margin-top: 0;">What's Next?</h4>
                <p style="color: #856404; margin: 0; font-size: 14px;">
                  Your order is currently being reviewed. You will receive an email notification when your order status changes. 
                  You can also track your order progress in your dashboard.
                </p>
              </div>
              
              <div style="text-align: center; margin-top: 30px;">
                <a href="${process.env.BASE_URL || 'http://localhost:3000'}/dashboard" 
                   style="background: #7c4dff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
                  View Order Details
                </a>
              </div>
              
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #666;">
                <p>Thank you for choosing TorqueHub!</p>
                <p style="font-size: 12px;">If you have any questions, please contact our support team.</p>
              </div>
            </div>
          </div>
        `
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`✅ Order receipt email sent to ${userInfo.email}`);
    } catch (error) {
      console.error('❌ Error sending order receipt email:', error);
      throw error;
    }
  }
}

module.exports = new EmailService(); 