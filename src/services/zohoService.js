const axios = require('axios');
const logger = require('../utils/logger');

class ZohoService {
  constructor() {
    this.clientId = process.env.ZOHO_CLIENT_ID;
    this.clientSecret = process.env.ZOHO_CLIENT_SECRET;
    this.redirectUri = process.env.ZOHO_REDIRECT_URI;
    this.baseUrl = process.env.ZOHO_API_BASE_URL;
    this.accessToken = process.env.ZOHO_ACCESS_TOKEN;
    this.refreshToken = process.env.ZOHO_REFRESH_TOKEN;
  }

  /**
   * Get authorization URL for OAuth flow
   */
  getAuthUrl() {
    const authUrl = `https://accounts.zoho.com/oauth/v2/auth`;
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      scope: 'ZohoCRM.modules.ALL,ZohoCRM.settings.ALL',
      redirect_uri: this.redirectUri,
      access_type: 'offline'
    });
    
    return `${authUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code) {
    try {
      const response = await axios.post('https://accounts.zoho.com/oauth/v2/token', null, {
        params: {
          grant_type: 'authorization_code',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          redirect_uri: this.redirectUri,
          code: code
        }
      });

      const { access_token, refresh_token } = response.data;
      this.accessToken = access_token;
      this.refreshToken = refresh_token;
      
      return {
        access_token,
        refresh_token
      };
    } catch (error) {
      logger.error('Error exchanging code for tokens:', error.response?.data || error.message);
      throw new Error('Failed to exchange authorization code');
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken() {
    try {
      const response = await axios.post('https://accounts.zoho.com/oauth/v2/token', null, {
        params: {
          grant_type: 'refresh_token',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          refresh_token: this.refreshToken
        }
      });

      this.accessToken = response.data.access_token;
      logger.info('Access token refreshed successfully');
      return this.accessToken;
    } catch (error) {
      logger.error('Error refreshing access token:', error.response?.data || error.message);
      throw new Error('Failed to refresh access token');
    }
  }

  /**
   * Make authenticated API request to Zoho CRM
   */
  async makeRequest(endpoint, method = 'GET', data = null) {
    try {
      const config = {
        method,
        url: `${this.baseUrl}${endpoint}`,
        headers: {
          'Authorization': `Zoho-oauthtoken ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      };

      if (data) {
        config.data = data;
      }

      const response = await axios(config);
      return response.data;
    } catch (error) {
      // If token expired, try to refresh
      if (error.response?.status === 401) {
        logger.info('Access token expired, attempting to refresh...');
        await this.refreshAccessToken();
        
        // Retry the request with new token
        const config = {
          method,
          url: `${this.baseUrl}${endpoint}`,
          headers: {
            'Authorization': `Zoho-oauthtoken ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        };

        if (data) {
          config.data = data;
        }

        const response = await axios(config);
        return response.data;
      }
      
      logger.error('Zoho API request error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get deals that match our criteria
   */
  async getEligibleDeals() {
    try {
      // Get deals where Stage = "Project Kickoff" and Type = "New Implementation Project"
      const endpoint = '/Deals/search';
      const searchParams = {
        criteria: '((Stage:equals:Project Kickoff)and(Type:equals:New Implementation Project))'
      };

      const response = await this.makeRequest(`${endpoint}?criteria=${encodeURIComponent(searchParams.criteria)}`);
      
      if (!response.data) {
        return [];
      }

      // Filter deals where Project_Board_ID__c is empty
      const eligibleDeals = response.data.filter(deal => 
        !deal.Project_Board_ID__c || deal.Project_Board_ID__c === ''
      );

      logger.info(`Found ${eligibleDeals.length} eligible deals`);
      return eligibleDeals;
    } catch (error) {
      logger.error('Error fetching eligible deals:', error);
      throw error;
    }
  }

  /**
   * Update deal with Trello board ID
   */
  async updateDealWithBoardId(dealId, boardId) {
    try {
      const endpoint = `/Deals/${dealId}`;
      const updateData = {
        data: [{
          id: dealId,
          Project_Board_ID_c: boardId
        }]
      };

      const response = await this.makeRequest(endpoint, 'PUT', updateData);

      // --- Stricter validation of Zoho's response ---
      if (!response.data || !response.data[0] || response.data[0].status !== 'success') {
        const errorMessage = response.data ? JSON.stringify(response.data[0]) : 'empty or invalid response';
        logger.error(`Zoho update failed for deal ${dealId}. Response: ${errorMessage}`);
        throw new Error(`Failed to update deal ${dealId} in Zoho. See logs for details.`);
      }

      logger.info(`Successfully updated Zoho deal ${dealId} with board ID ${boardId}`);
      return response;
    } catch (error) {
      // Log the error but re-throw it so the calling service knows about the failure.
      logger.error(`Error in updateDealWithBoardId for deal ${dealId}:`, error.message);
      throw error;
    }
  }

  /**
   * Check connection to Zoho CRM
   */
  async checkConnection() {
    try {
      await this.makeRequest('/org');
      return { status: 'connected', message: 'Zoho CRM connection successful' };
    } catch (error) {
      return { status: 'error', message: error.message };
    }
  }

  /**
   * Create custom field (Project_Board_ID__c) if it doesn't exist
   */
  async createCustomField() {
    try {
      const fieldData = {
        fields: [{
          field_label: 'Project_Board_ID__c',
          api_name: 'Project_Board_ID_c',
          data_type: 'text',
          length: 255
        }]
      };

      const response = await this.makeRequest('/settings/fields?module=Deals', 'POST', fieldData);
      logger.info('Custom field Project_Board_ID__c created successfully');
      return response;
    } catch (error) {
      if (error.response?.data?.details?.[0]?.message?.includes('already exists')) {
        logger.info('Custom field Project_Board_ID__c already exists');
        return { message: 'Field already exists' };
      }
      logger.error('Error creating custom field:', error);
      throw error;
    }
  }
}

module.exports = ZohoService;