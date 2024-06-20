// common/test/testLogger.js
const Logger = require('../logger');

(async () => {
  const logger = new Logger();

  const infoMessage = JSON.stringify({
    event: 'system_start',
    message: 'The system has started successfully.'
  });

  const warningMessage = JSON.stringify({
    event: 'high_memory_usage',
    message: 'Memory usage has exceeded 80%.'
  });

  const errorMessage = JSON.stringify({
    event: 'service_unavailable',
    message: 'The database service is unavailable.'
  });

  logger.logInfo(infoMessage);
  logger.logWarning(warningMessage, 'WARN_CODE');
  logger.logError(errorMessage, 'ERR_CODE');
})();
