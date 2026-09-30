const IORedis = require("ioredis");

// BullMQ requires this specific option to be null (not undefined) for blocking commands to work correctly
const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
}); 

module.exports = connection;