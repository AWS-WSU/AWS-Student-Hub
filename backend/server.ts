import app from './app';
import logger from './config/logger';

const log = logger.child({ module: 'server' });

const PORT = Number(process.env.PORT || 5001);

app.listen(PORT, () => {
  log.info(`server: listening on http://localhost:${PORT}.`);
  log.info(`server: api available at http://localhost:${PORT}/api.`);
});
