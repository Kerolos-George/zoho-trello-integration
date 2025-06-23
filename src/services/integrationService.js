const logger = require('../utils/logger');

class IntegrationService {
  constructor(zohoService, trelloService) {
    this.zohoService = zohoService;
    this.trelloService = trelloService;
  }

  /**
   * Main sync function - processes eligible deals and creates Trello boards
   */
  async syncDealsToTrello() {
    try {
      logger.info('Starting Zoho CRM to Trello sync...');

      // Get eligible deals from Zoho CRM
      const eligibleDeals = await this.zohoService.getEligibleDeals();

      if (eligibleDeals.length === 0) {
        logger.info('No eligible deals found for Trello board creation');
        return {
          processed: 0,
          created: 0,
          errors: 0,
          details: []
        };
      }

      const results = {
        processed: eligibleDeals.length,
        created: 0,
        errors: 0,
        details: []
      };

      // Process each eligible deal
      for (const deal of eligibleDeals) {
        // If a deal already has a board ID, skip it gracefully instead of erroring.
        if (deal.Project_Board_ID_c && deal.Project_Board_ID_c.trim() !== '') {
          logger.info(`Skipping deal ${deal.id} (${deal.Deal_Name}) because a Project Board ID already exists.`);
          continue;
        }
        
        try {
          await this.processDeal(deal);
          results.created++;
          results.details.push({
            dealId: deal.id,
            dealName: deal.Deal_Name,
            status: 'success',
            message: 'Trello board created successfully'
          });
        } catch (error) {
          results.errors++;
          results.details.push({
            dealId: deal.id,
            dealName: deal.Deal_Name,
            status: 'error',
            message: error.message
          });
          logger.error(`Error processing deal ${deal.id}:`, error);
        }
      }

      logger.info(`Sync completed. Created: ${results.created}, Errors: ${results.errors}`);
      return results;
    } catch (error) {
      logger.error('Error during sync process:', error);
      throw error;
    }
  }

  /**
   * Process a single deal - create Trello board and update CRM
   */
  async processDeal(deal) {
    try {
      logger.info(`Processing deal: ${deal.Deal_Name} (ID: ${deal.id})`);

      // Validate deal meets all criteria
      if (!this.validateDeal(deal)) {
        throw new Error('Deal does not meet all criteria');
      }

      // Create Trello project board
      const projectBoard = await this.trelloService.createProjectBoard(
        deal.Deal_Name,
        deal.id
      );

      // Update the deal in Zoho CRM with the board ID
      await this.zohoService.updateDealWithBoardId(deal.id, projectBoard.board.id);

      logger.info(`Successfully processed deal ${deal.id} - Board ID: ${projectBoard.board.id}`);
      
      return {
        dealId: deal.id,
        dealName: deal.Deal_Name,
        boardId: projectBoard.board.id,
        boardUrl: projectBoard.board.url
      };
    } catch (error) {
      logger.error(`Error processing deal ${deal.id}:`, error);
      throw error;
    }
  }

  /**
   * Validate that a deal meets all the required criteria
   */
  validateDeal(deal) {
    const validations = [
      {
        condition: deal.Stage === 'Project Kickoff',
        message: 'Deal stage must be "Project Kickoff"'
      },
      {
        condition: deal.Type === 'New Implementation Project',
        message: 'Deal type must be "New Implementation Project"'
      },
      {
        condition: deal.Deal_Name && deal.Deal_Name.trim() !== '',
        message: 'Deal must have a valid name'
      }
    ];

    for (const validation of validations) {
      if (!validation.condition) {
        logger.warn(`Deal ${deal.id} validation failed: ${validation.message}`);
        return false;
      }
    }

    return true;
  }

  /**
   * Get sync statistics
   */
  async getSyncStats() {
    try {
      const eligibleDeals = await this.zohoService.getEligibleDeals();
      const processedDeals = await this.getProcessedDeals();

      return {
        eligible: eligibleDeals.length,
        processed: processedDeals.length,
        pending: eligibleDeals.length,
        lastSync: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error getting sync stats:', error);
      throw error;
    }
  }

  /**
   * Get deals that have already been processed (have board IDs)
   */
  async getProcessedDeals() {
    try {
      // This would require a custom search in Zoho CRM
      // For now, we'll return an empty array
      return [];
    } catch (error) {
      logger.error('Error getting processed deals:', error);
      throw error;
    }
  }

  /**
   * Validate services are properly configured
   */
  async validateServices() {
    try {
      const zohoCheck = await this.zohoService.checkConnection();
      const trelloCheck = await this.trelloService.checkConnection();

      return {
        zoho: zohoCheck,
        trello: trelloCheck,
        overall: zohoCheck.status === 'connected' && trelloCheck.status === 'connected'
      };
    } catch (error) {
      logger.error('Error validating services:', error);
      throw error;
    }
  }

  /**
   * Initialize required fields in Zoho CRM
   */
  async initializeZohoFields() {
    try {
      logger.info('Initializing Zoho CRM custom fields...');
      await this.zohoService.createCustomField();
      logger.info('Zoho CRM initialization completed');
    } catch (error) {
      logger.error('Error initializing Zoho fields:', error);
      throw error;
    }
  }
}

module.exports = IntegrationService;