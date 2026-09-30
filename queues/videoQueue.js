const { Queue } = require("bullmq");
const connection = require("../config/redis");

const videoQueue = new Queue("video-processing", { connection });

module.exports = videoQueue;