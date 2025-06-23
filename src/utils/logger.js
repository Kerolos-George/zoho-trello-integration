const fs = require('fs');
const path = require('path');

class Logger {
  constructor() {
    this.logLevel = process.env.LOG_LEVEL || 'info';
    this.logLevels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
    
    // Ensure logs directory exists
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    this.logFile = path.join(logsDir, 'integration.log');
  }

  shouldLog(level) {
    return this.logLevels[level] <= this.logLevels[this.logLevel];
  }

  formatMessage(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      ...(data && { data })
    };
    
    return JSON.stringify(logEntry);
  }

  writeToFile(logEntry) {
    try {
      fs.appendFileSync(this.logFile, logEntry + '\n');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  log(level, message, data = null) {
    if (!this.shouldLog(level)) return;

    const formattedMessage = this.formatMessage(level, message, data);
    const consoleMessage = `[${new Date().toISOString()}] ${level.toUpperCase()}: ${message}`;
    
    // Console output with colors
    switch (level) {
      case 'error':
        console.error('\x1b[31m%s\x1b[0m', consoleMessage);
        break;
      case 'warn':
        console.warn('\x1b[33m%s\x1b[0m', consoleMessage);
        break;
      case 'info':
        console.info('\x1b[36m%s\x1b[0m', consoleMessage);
        break;
      case 'debug':
        console.log('\x1b[35m%s\x1b[0m', consoleMessage);
        break;
      default:
        console.log(consoleMessage);
    }

    if (data) {
      console.log(data);
    }

    // Write to file
    this.writeToFile(formattedMessage);
  }

  error(message, data = null) {
    this.log('error', message, data);
  }

  warn(message, data = null) {
    this.log('warn', message, data);
  }

  info(message, data = null) {
    this.log('info', message, data);
  }

  debug(message, data = null) {
    this.log('debug', message, data);
  }
}

module.exports = new Logger();