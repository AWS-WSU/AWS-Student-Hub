const express = require('express');
const router = express.Router();
const { verifyUser } = require('../controllers/verifyController');

router.post('/', verifyUser);

module.exports = router;
