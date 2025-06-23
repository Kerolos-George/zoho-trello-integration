const axios = require('axios');
const logger = require('../utils/logger');

class TrelloService {
  constructor() {
    this.apiKey = process.env.TRELLO_API_KEY;
    this.token = process.env.TRELLO_TOKEN;
    this.baseUrl = process.env.TRELLO_API_BASE_URL;
  }

  /**
   * Make authenticated API request to Trello
   */
  async makeRequest(endpoint, method = 'GET', data = null) {
    try {
      const config = {
        method,
        url: `${this.baseUrl}${endpoint}`,
        params: {
          key: this.apiKey,
          token: this.token
        }
      };

      if (data) {
        if (method === 'GET') {
          config.params = { ...config.params, ...data };
        } else {
          config.data = data;
        }
      }

      const response = await axios(config);
      return response.data;
    } catch (error) {
      logger.error('Trello API request error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Create a new Trello board
   */
  async createBoard(name, description = '') {
    try {
      const boardData = {
        name: name,
        desc: description,
        defaultLists: false, // We'll create our own lists
        prefs_permissionLevel: 'private'
      };

      const board = await this.makeRequest('/boards', 'POST', boardData);
      logger.info(`Created Trello board: ${name} (ID: ${board.id})`);
      return board;
    } catch (error) {
      logger.error(`Error creating board ${name}:`, error);
      throw error;
    }
  }

  /**
   * Create a list on a board
   */
  async createList(boardId, listName, position = 'bottom') {
    try {
      const listData = {
        name: listName,
        idBoard: boardId,
        pos: position
      };

      const list = await this.makeRequest('/lists', 'POST', listData);
      logger.info(`Created list: ${listName} on board ${boardId}`);
      return list;
    } catch (error) {
      logger.error(`Error creating list ${listName}:`, error);
      throw error;
    }
  }

  /**
   * Create a card in a list
   */
  async createCard(listId, cardName, description = '') {
    try {
      const cardData = {
        name: cardName,
        desc: description,
        idList: listId,
        pos: 'bottom'
      };

      const card = await this.makeRequest('/cards', 'POST', cardData);
      logger.info(`Created card: ${cardName} in list ${listId}`);
      return card;
    } catch (error) {
      logger.error(`Error creating card ${cardName}:`, error);
      throw error;
    }
  }

  /**
   * Create a complete project board with lists and initial cards
   */
  async createProjectBoard(dealName, dealId) {
    try {
      const boardName = `Project: ${dealName}`;
      const boardDescription = `Project board for deal: ${dealName} (Zoho Deal ID: ${dealId})`;

      // Create the board
      const board = await this.createBoard(boardName, boardDescription);

      // Create the three required lists
      const todoList = await this.createList(board.id, 'To Do', 1);
      const inProgressList = await this.createList(board.id, 'In Progress', 2);
      const doneList = await this.createList(board.id, 'Done', 3);

      // Create initial cards in the To Do list
      const initialCards = [
        'Kickoff Meeting Scheduled',
        'Requirements Gathering',
        'System Setup'
      ];

      const createdCards = [];
      for (const cardName of initialCards) {
        const card = await this.createCard(todoList.id, cardName);
        createdCards.push(card);
      }

      logger.info(`Successfully created project board for deal: ${dealName}`);
      
      return {
        board,
        lists: {
          todo: todoList,
          inProgress: inProgressList,
          done: doneList
        },
        cards: createdCards
      };
    } catch (error) {
      logger.error(`Error creating project board for deal ${dealName}:`, error);
      throw error;
    }
  }

  /**
   * Get board information
   */
  async getBoard(boardId) {
    try {
      return await this.makeRequest(`/boards/${boardId}`);
    } catch (error) {
      logger.error(`Error fetching board ${boardId}:`, error);
      throw error;
    }
  }

  /**
   * Check connection to Trello
   */
  async checkConnection() {
    try {
      await this.makeRequest('/members/me');
      return { status: 'connected', message: 'Trello connection successful' };
    } catch (error) {
      return { status: 'error', message: error.message };
    }
  }

  /**
   * Get user's boards (for testing)
   */
  async getUserBoards() {
    try {
      return await this.makeRequest('/members/me/boards');
    } catch (error) {
      logger.error('Error fetching user boards:', error);
      throw error;
    }
  }
}

module.exports = TrelloService;