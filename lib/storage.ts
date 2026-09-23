import { S3Client } from "@aws-sdk/client-s3";

export const s3Client = new S3Client({
  endpoint: process.env.AWS_ENDPOINT_URL_S3,
  forcePathStyle: true, // Needed for local MinIO path-based access (http://localhost:9000/bucket-name)
});