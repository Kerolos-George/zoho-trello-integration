const express = require('express');
const cron = require('node-cron');
const dotenv = require('dotenv');
const ZohoService = require('./services/zohoService');
const TrelloService = require('./services/trelloService');
const IntegrationService = require('./services/integrationService');
const logger = require('./utils/logger');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize services
const zohoService = new ZohoService();
const trelloService = new TrelloService();
const integrationService = new IntegrationService(zohoService, trelloService);

// Middleware
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.json({
    message: 'Zoho CRM + Trello Integration Service',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// OAuth callback route for Zoho
app.get('/callback', async (req, res) => {
  const { code } = req.query;
  
  if (!code) {
    return res.status(400).json({ error: 'Authorization code not provided' });
  }

  try {
    const tokens = await zohoService.exchangeCodeForTokens(code);
    logger.info('OAuth tokens received successfully');
    res.json({
      message: 'Authorization successful! Update your .env file with the refresh token.',
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token
    });
  } catch (error) {
    logger.error('OAuth callback error:', error);
    res.status(500).json({ error: 'Failed to exchange authorization code' });
  }
});

// Manual sync endpoint
app.post('/sync', async (req, res) => {
  try {
    logger.info('Manual sync triggered');
    const result = await integrationService.syncDealsToTrello();
    res.json({
      message: 'Sync completed',
      result
    });
  } catch (error) {
    logger.error('Manual sync error:', error);
    res.status(500).json({ error: 'Sync failed' });
  }
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const zohoHealth = await zohoService.checkConnection();
    const trelloHealth = await trelloService.checkConnection();
    
    res.json({
      status: 'ok',
      services: {
        zoho: zohoHealth,
        trello: trelloHealth
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

// Start server
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Visit http://localhost:${PORT} to check status`);
});

// Schedule the integration to run every 10 seconds
const pollingInterval = process.env.POLLING_INTERVAL || 10000; // 10 seconds default
cron.schedule('*/10 * * * * *', async () => {
  try {
    logger.info('Scheduled sync started');
    await integrationService.syncDealsToTrello();
    logger.info('Scheduled sync completed');
  } catch (error) {
    logger.error('Scheduled sync error:', error);
  }
});

logger.info('Zoho CRM + Trello Integration Service started');
logger.info(`Polling interval: ${pollingInterval}ms`);

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Shutting down gracefully...');
  process.exit(0);
});