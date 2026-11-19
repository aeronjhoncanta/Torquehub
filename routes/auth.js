const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const authController = require('../controllers/authController');
const loginController = require('../controllers/loginController');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../public/uploads'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Use the same case-sensitive root path
const rootPath = path.resolve(__dirname, '..');

router.get('/login', (req, res) => {
  res.sendFile(path.join(rootPath, '../views/auth/login.html'));
});

router.get('/register', (req, res) => {
  res.sendFile(path.join(rootPath, '../views/auth/register.html'));
});

router.post('/register', upload.single('profilePic'), authController.register);
router.get('/verify-email', authController.verifyEmail);
router.post('/login', loginController.login);

module.exports = router;