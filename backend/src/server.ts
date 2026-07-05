import app from './app';
import env from './config/env';
import logger from './config/logger';

const log = logger.child({ module: 'server' });

const PORT = env.PORT;

app.listen(PORT, () => {
  log.info(`server: listening on http://localhost:${PORT} (api: /api).`);
});
