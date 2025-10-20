const express = require('express');
const router = express.Router();
const { verifyUser } = require('../controllers/verifyController');

router.options('/', (req, res) => {
  res.header('Access-Control-Allow-Origin', 'https://www.prizeversity.com');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.status(200).end();
});

router.post('/', verifyUser);

module.exports = router;