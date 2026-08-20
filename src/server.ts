import app from './app';
import { config } from './config';
import { connectDatabase } from './database/connection';
import { startBackgroundWorkers } from './jobs';
import { logger } from './utils/logger';

const startServer = async (): Promise<void> => {
  try {
    // Connect to MongoDB
    await connectDatabase();

    // Start background workers (non-critical, fails gracefully if Redis unavailable)
    await startBackgroundWorkers();

    // Start server
    const server = app.listen(config.app.port, () => {
      logger.info(`Server running on port ${config.app.port}`);
      logger.info(`Environment: ${config.app.nodeEnv}`);
      logger.info(`API Docs: http://localhost:${config.app.port}/api-docs`);
      logger.info(`Gemini AI: ${config.openai.apiKey ? 'CONFIGURED (' + config.openai.apiKey.length + ' chars)' : 'NOT CONFIGURED'}`);
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received, shutting down gracefully`);

      server.close(async () => {
        logger.info('HTTP server closed');

        try {
          const { disconnectDatabase } = await import('./database/connection');
          await disconnectDatabase();

          const { closeRedisConnection } = await import('./database/redis');
          await closeRedisConnection();

          logger.info('Database connections closed');
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown:', error);
          process.exit(1);
        }
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown due to timeout');
        process.exit(1);
      }, 10000);
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error: Error) => {
      logger.error('Uncaught Exception:', error);
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason: unknown) => {
      logger.error('Unhandled Rejection:', reason);
      process.exit(1);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start server if not in test environment
if (config.app.nodeEnv !== 'test') {
  void startServer();
}

export default app;
