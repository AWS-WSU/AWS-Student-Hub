import express from 'express';

import * as challengeController from '../controllers/challengeController';
import checkJwt, { optionalJwt } from '../middleware/auth';

const router = express.Router();

router.get('/', optionalJwt, challengeController.listChallenges);
router.get(
  '/ciphered-seal/route/:routeKey',
  checkJwt,
  challengeController.getCipheredSealState
);
router.post(
  '/ciphered-seal/route/:routeKey/resolve',
  checkJwt,
  challengeController.resolveCipheredSealSeed
);
router.get('/:slug', optionalJwt, challengeController.getChallenge);
router.get('/:slug/progress', checkJwt, challengeController.getProgress);
router.post('/:slug/start', checkJwt, challengeController.start);
router.post('/:slug/submit', checkJwt, challengeController.submit);

export default router;
