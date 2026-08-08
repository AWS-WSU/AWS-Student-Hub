import express from 'express';
import rateLimit from 'express-rate-limit';

import * as challengeController from '../controllers/challengeController';
import checkJwt, { optionalJwt } from '../middleware/auth';

const router = express.Router();

const sqlSandboxSearchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: {
    error: 'Too many sandbox queries. Wait a moment before trying again.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const pcapDownloadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: {
    error: 'Too many capture downloads. Wait a moment before trying again.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/', optionalJwt, challengeController.listChallenges);
router.get('/ciphered-seal/route/:routeKey', checkJwt, challengeController.getCipheredSealState);
router.post(
  '/ciphered-seal/route/:routeKey/resolve',
  checkJwt,
  challengeController.resolveCipheredSealSeed
);
router.get('/:slug/sql-sandbox', checkJwt, challengeController.getSqlInjectionSandbox);
router.post(
  '/:slug/sql-sandbox/search',
  checkJwt,
  sqlSandboxSearchLimiter,
  challengeController.searchSqlInjection
);
router.get('/:slug/pcap', checkJwt, pcapDownloadLimiter, challengeController.downloadPcapCapture);
router.get('/:slug', optionalJwt, challengeController.getChallenge);
router.get('/:slug/progress', checkJwt, challengeController.getProgress);
router.post('/:slug/start', checkJwt, challengeController.start);
router.post('/:slug/submit', checkJwt, challengeController.submit);

export default router;
