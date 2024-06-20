/**
 * A class representing a task queue that processes tasks sequentially.
 * The TaskQueue class maintains a queue of tasks to be processed one by one.
 * It allows tasks to be added to the queue and processes them in the order they were added.
 */
const Logger = require('./logger');
const logger = new Logger();
class TaskQueue {
    constructor() {
      this.queue = [];
      this.processing = false;
    }
    /**
     * Adds a task to the queue and returns a promise that resolves or rejects based on task completion.
     *
     * @param {Function} task - The task function to be added to the queue.
     * @returns {Promise} A promise that resolves with the result of the task or rejects with an error.
     */
    async add(task) {
      return new Promise((resolve, reject) => {
        this.queue.push({ task, resolve, reject });
        if (!this.processing) {
          this.processNext();
        }
      });
    }
    /**
     * Processes the next task in the queue.
     * If the queue is empty, sets the processing flag to false.
     * If a task is being processed, attempts to resolve or reject the promise based on task completion.
     */ 
    async processNext() {
      if (this.queue.length === 0) {
        this.processing = false;
        return;
      }
  
      this.processing = true;
      const { task, resolve, reject } = this.queue.shift();
  
      try {
        const result = await task();
        resolve(result);
      } catch (error) {
        logger.logError({ msg: error.message }, 'TASK_QUEUE_ERROR');
        //reject(error);
      } finally {
        this.processNext();
      }
    }
  }
  
  module.exports = TaskQueue;
  