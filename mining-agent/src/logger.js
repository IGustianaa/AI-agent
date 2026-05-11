const chalk = require('chalk');

/**
 * Logger - Simple colorful logger
 * 
 * Levels: debug < info < warn < error
 */
class Logger {
  constructor(level = 'info') {
    this.levels = { debug: 0, info: 1, warn: 2, error: 3 };
    this.currentLevel = this.levels[level] || 1;
  }

  getTimestamp() {
    return new Date().toLocaleTimeString('en-GB', { hour12: false });
  }

  debug(msg) {
    if (this.currentLevel <= 0) {
      console.log(chalk.gray(`[${this.getTimestamp()}] [DBG] ${msg}`));
    }
  }

  info(msg) {
    if (this.currentLevel <= 1) {
      console.log(chalk.cyan(`[${this.getTimestamp()}] [INF] `) + msg);
    }
  }

  warn(msg) {
    if (this.currentLevel <= 2) {
      console.log(chalk.yellow(`[${this.getTimestamp()}] [WRN] ⚠️  ${msg}`));
    }
  }

  error(msg) {
    if (this.currentLevel <= 3) {
      console.log(chalk.red(`[${this.getTimestamp()}] [ERR] ❌ ${msg}`));
    }
  }

  success(msg) {
    console.log(chalk.green(`[${this.getTimestamp()}] [OK]  ✅ ${msg}`));
  }

  mining(msg) {
    console.log(chalk.magenta(`[${this.getTimestamp()}] [⛏️ ] ${msg}`));
  }

  ai(msg) {
    console.log(chalk.blue(`[${this.getTimestamp()}] [🧠] ${msg}`));
  }
}

module.exports = Logger;
