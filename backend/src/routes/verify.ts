import express from 'express';

import { verifyUser } from '../controllers/verifyController';

const router = express.Router();

router.post('/', verifyUser);

export default router;
