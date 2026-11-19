const bcrypt = require('bcryptjs');
const User = require('../models/user');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

exports.register = async (req, res) => {
  try {
    const { fullName, email, dealership, password } = req.body;
    const profilePic = req.file ? req.file.filename : null;
    if (!fullName || !email || !dealership || !password) {
      return res.status(400).json({ error: 'All fields are required.' });
    }
    const existing = await User.findOne({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: 'Email already registered.' });
    }
    const password_hash = await bcrypt.hash(password, 10);
    const verification_token = crypto.randomBytes(32).toString('hex');
    const user = await User.create({
      full_name: fullName,
      email,
      dealership_name: dealership,
      password_hash,
      profile_picture: profilePic,
      verification_token,
      verified: false
    });
    // Send verification email
    const verifyUrl = `${process.env.BASE_URL}/auth/verify-email?token=${verification_token}&email=${encodeURIComponent(email)}`;
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: email,
      subject: 'Verify your TorqueHub account',
      html: `<p>Hi ${fullName},</p><p>Click the link below to verify your email address:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`
    });
    res.status(201).json({ message: 'Registration successful. Please check your email to verify your account.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.verifyEmail = async (req, res) => {
  const { token, email } = req.query;
  if (!token || !email) return res.status(400).send('Invalid verification link.');
  const user = await User.findOne({ where: { email, verification_token: token } });
  if (!user) return res.status(400).send('Invalid or expired verification link.');
  user.verified = true;
  user.verification_token = null;
  await user.save();
  res.send('Email verified! You can now log in.');
};
