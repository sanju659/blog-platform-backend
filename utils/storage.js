const { PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { Upload } = require("@aws-sdk/lib-storage");
const fs = require("fs");
const path = require("path");
const s3 = require("../config/s3");

const publicBaseUrl = () =>
  process.env.S3_PUBLIC_URL ||
  `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com`;

// Uploads an in-memory buffer (used for images). Returns the public URL.
const uploadBuffer = async (buffer, key, contentType) => {
  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  return `${publicBaseUrl()}/${key}`;
};

// Streams a file from disk to S3 using multipart upload (used for videos).
const uploadFile = async (filePath, key, contentType) => {
  const upload = new Upload({
    client: s3,
    params: {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
      Body: fs.createReadStream(filePath),
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    },
  });
  await upload.done();
  return `${publicBaseUrl()}/${key}`;
};

// Deletes a stored file by URL. Handles S3 URLs and legacy local /uploads URLs.
// Never throws: a failed cleanup shouldn't break the user's request.
const deleteByUrl = async (url) => {
  if (!url) return;

  try {
    const base = publicBaseUrl();

    if (url.startsWith(`${base}/`)) {
      const key = url.slice(base.length + 1);
      await s3.send(
        new DeleteObjectCommand({
          Bucket: process.env.S3_BUCKET_NAME,
          Key: key,
        }),
      );
      return;
    }

    // Legacy: file stored locally under /uploads
    if (url.includes("uploads/")) {
      const filePath = path.join(
        __dirname,
        "..",
        url.replace(`${process.env.BASE_URL}/`, ""),
      );
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  } catch (err) {
    console.error("Failed to delete file:", url, err.message);
  }
};

module.exports = { uploadBuffer, uploadFile, deleteByUrl };
