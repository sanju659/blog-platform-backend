const { S3Client } = require("@aws-sdk/client-s3");

// Credentials are picked up automatically from
// AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY in the environment
const s3 = new S3Client({ region: process.env.AWS_REGION });

module.exports = s3;
