const express = require('express');
const router = express.Router();
const { Transaction, User, Product } = require('../models');
const { ensureAuthenticated, ensureAdmin } = require('../middleware/auth');
const EmailService = require('../services/emailService');
const NotificationService = require('../services/notificationService');

// Debug middleware for all transaction routes
router.use((req, res, next) => {
  console.log('🔍 Transaction route accessed:', req.method, req.path);
  console.log('📋 Request body:', req.body);
  console.log('👤 User:', req.user);
  console.log('🔐 User role_id:', req.user?.role_id);
  next();
});

// GET all transactions (authenticated users can view all transactions)
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    const transactions = await Transaction.findAll({
      include: [
        {
          model: User,
          attributes: ['id', 'full_name', 'email']
        },
        {
          model: Product,
          attributes: ['id', 'name', 'price', 'image']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json(transactions);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// GET user's transactions
router.get('/my-transactions', ensureAuthenticated, async (req, res) => {
  try {
    const transactions = await Transaction.findAll({
      where: { user_id: req.user.id },
      include: [
        {
          model: Product,
          attributes: ['id', 'name', 'price', 'image']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json(transactions);
  } catch (error) {
    console.error('Error fetching user transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// GET single transaction
router.get('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const transactionId = parseInt(req.params.id);
    if (isNaN(transactionId)) {
      return res.status(400).json({ error: 'Invalid transaction ID' });
    }

    const transaction = await Transaction.findOne({
      where: { id: transactionId },
      include: [
        {
          model: User,
          attributes: ['id', 'full_name', 'email']
        },
        {
          model: Product,
          attributes: ['id', 'name', 'price', 'image', 'description']
        }
      ]
    });

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Check if user is admin or owns the transaction
    const isAdmin = req.user && (
      req.user.role_id === 2 || 
      (req.user.role && req.user.role.toLowerCase() === 'admin')
    );
    
    if (!isAdmin && transaction.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(transaction);
  } catch (error) {
    console.error('Error fetching transaction:', error);
    res.status(500).json({ error: 'Failed to fetch transaction' });
  }
});

// POST create transaction
router.post('/', ensureAuthenticated, async (req, res) => {
  try {
    const { product_id, quantity, payment_method, shipping_address, notes } = req.body;

    if (!product_id || !quantity) {
      return res.status(400).json({ error: 'Product ID and quantity are required' });
    }

    const product = await Product.findByPk(product_id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const total_amount = parseFloat(product.price) * parseInt(quantity);

    const transaction = await Transaction.create({
      user_id: req.user.id,
      product_id,
      quantity,
      total_amount,
      payment_method,
      shipping_address,
      notes,
      status: 'pending'
    });

    // Create notification for new transaction
    try {
      await NotificationService.createNotification(
        req.user.id,
        `Order #${transaction.id} Created`,
        `Your order for ${product.name} has been created and is being reviewed.`,
        'transaction',
        {
          transaction_id: transaction.id,
          product_name: product.name,
          total_amount: transaction.total_amount
        }
      );
    } catch (notificationError) {
      console.error('Notification creation failed:', notificationError);
    }

    // Send email notification with receipt
    try {
      await EmailService.sendTransactionStatusUpdateEmail(transaction, req.user, product);
      console.log('✅ Email notification sent for new transaction');
    } catch (emailError) {
      console.error('❌ Email sending failed:', emailError);
    }

    res.status(201).json({ 
      message: 'Transaction created successfully',
      transaction: {
        id: transaction.id,
        total_amount: transaction.total_amount,
        status: transaction.status
      }
    });
  } catch (error) {
    console.error('Error creating transaction:', error);
    res.status(500).json({ error: 'Failed to create transaction' });
  }
});

// PUT update transaction (authenticated users can update their own transactions)
router.put('/:id', ensureAuthenticated, async (req, res) => {
  try {
    console.log('🔄 Transaction update request received');
    console.log('📋 Request body:', req.body);
    console.log('🆔 Transaction ID:', req.params.id);
    console.log('👤 Current user:', req.user);
    
    const transactionId = parseInt(req.params.id);
    if (isNaN(transactionId)) {
      return res.status(400).json({ error: 'Invalid transaction ID' });
    }

    const transaction = await Transaction.findByPk(transactionId, {
      include: [
        {
          model: User,
          attributes: ['id', 'full_name', 'email']
        },
        {
          model: Product,
          attributes: ['id', 'name', 'price', 'image']
        }
      ]
    });

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const { status, payment_method, shipping_address, notes } = req.body;
    const updateData = {};
    const previousStatus = transaction.status;

    if (status) updateData.status = status;
    if (payment_method !== undefined) updateData.payment_method = payment_method;
    if (shipping_address !== undefined) updateData.shipping_address = shipping_address;
    if (notes !== undefined) updateData.notes = notes;

    await transaction.update(updateData);

    // Create notification if status changed
    if (status && status !== previousStatus) {
      console.log('🔄 Status changed from', previousStatus, 'to', status);
      console.log('📝 Creating notification for transaction:', transaction.id);
      try {
        await NotificationService.createTransactionStatusNotification(
          transaction, 
          transaction.User, 
          transaction.Product, 
          previousStatus
        );
        console.log('✅ Notification created successfully');
      } catch (notificationError) {
        console.error('❌ Notification creation failed:', notificationError);
      }
    } else {
      console.log('ℹ️ No status change detected or no status provided');
    }

    // Send email notification with receipt for status changes
    if (status && status !== previousStatus) {
      try {
        await EmailService.sendTransactionStatusUpdateEmail(transaction, transaction.User, transaction.Product, previousStatus);
        console.log('✅ Email notification sent for status change');
        
        // Generate and send PDF receipt for delivered orders
        if (status === 'delivered') {
          try {
            await EmailService.sendTransactionUpdateWithReceipt(transaction, transaction.User, transaction.Product);
            console.log('✅ PDF receipt sent for delivered order');
          } catch (receiptError) {
            console.error('❌ PDF receipt generation failed:', receiptError);
          }
        }
      } catch (emailError) {
        console.error('❌ Email sending failed:', emailError);
      }
    }

    res.json({ 
      message: 'Transaction updated successfully',
      transaction
    });
  } catch (error) {
    console.error('Error updating transaction:', error);
    res.status(500).json({ error: 'Failed to update transaction' });
  }
});

// GET download PDF receipt
router.get('/:id/receipt', ensureAuthenticated, async (req, res) => {
  try {
    const transactionId = parseInt(req.params.id);
    if (isNaN(transactionId)) {
      return res.status(400).json({ error: 'Invalid transaction ID' });
    }

    const transaction = await Transaction.findByPk(transactionId, {
      include: [
        {
          model: User,
          attributes: ['id', 'full_name', 'email']
        },
        {
          model: Product,
          attributes: ['id', 'name', 'price', 'image']
        }
      ]
    });

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Check if user owns this transaction or is admin
    if (transaction.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Generate PDF receipt
    const pdfFileName = await EmailService.generateReceiptPDF(transaction, transaction.User, transaction.Product);
    const pdfPath = path.join(__dirname, '../public/uploads', pdfFileName);

    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="receipt_${transaction.id}.pdf"`);

    // Send the PDF file
    res.sendFile(pdfPath, (err) => {
      if (err) {
        console.error('Error sending PDF file:', err);
        res.status(500).json({ error: 'Failed to download receipt' });
      }
    });

  } catch (error) {
    console.error('Error generating receipt:', error);
    res.status(500).json({ error: 'Failed to generate receipt' });
  }
});

// DELETE transaction (admin only)
router.delete('/:id', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    const transactionId = parseInt(req.params.id);
    if (isNaN(transactionId)) {
      return res.status(400).json({ error: 'Invalid transaction ID' });
    }

    const transaction = await Transaction.findByPk(transactionId);
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    await transaction.destroy();

    res.json({ message: 'Transaction deleted successfully' });
  } catch (error) {
    console.error('Error deleting transaction:', error);
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
});

// GET transaction statistics (admin only)
router.get('/stats/overview', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    const totalTransactions = await Transaction.count();
    const pendingTransactions = await Transaction.count({ where: { status: 'pending' } });
    const completedTransactions = await Transaction.count({ 
      where: { status: ['confirmed', 'shipped', 'delivered'] } 
    });

    const totalRevenue = await Transaction.sum('total_amount', {
      where: { status: ['confirmed', 'shipped', 'delivered'] }
    });

    res.json({
      total: totalTransactions,
      pending: pendingTransactions,
      completed: completedTransactions,
      revenue: totalRevenue || 0
    });
  } catch (error) {
    console.error('Error fetching transaction stats:', error);
    res.status(500).json({ error: 'Failed to fetch transaction statistics' });
  }
});

// POST send order receipt email
router.post('/send-order-receipt', ensureAuthenticated, async (req, res) => {
  try {
    const { transactions, orderItems, userInfo, totalAmount, shippingAddress } = req.body;

    if (!transactions || !orderItems || !userInfo || !totalAmount) {
      return res.status(400).json({ error: 'Missing required order information' });
    }

    // Send comprehensive order receipt email
    try {
      await EmailService.sendOrderReceiptEmail(transactions, orderItems, userInfo, totalAmount, shippingAddress);
      console.log('✅ Order receipt email sent successfully');
      res.json({ message: 'Order receipt email sent successfully' });
    } catch (emailError) {
      console.error('❌ Error sending order receipt email:', emailError);
      res.status(500).json({ error: 'Failed to send order receipt email' });
    }
  } catch (error) {
    console.error('Error processing order receipt request:', error);
    res.status(500).json({ error: 'Failed to process order receipt request' });
  }
});

module.exports = router; 