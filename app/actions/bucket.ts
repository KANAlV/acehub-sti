import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { fileTypeFromBuffer } from 'file-type';
import { readFile } from 'fs/promises';

const s3 = new S3Client({
  region: process.env.AWS_REGION!,
  endpoint: process.env.AWS_ENDPOINT_URL_S3!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
});

async function uploadFile(localPath: string, bucket: string, key?: string) {
  const fileBuffer = await readFile(localPath);

  const detected = await fileTypeFromBuffer(fileBuffer);
  const contentType = detected?.mime ?? 'application/octet-stream';

  const objectKey = key ?? localPath.replace(/\\/g, '/');

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: fileBuffer,
      ContentType: contentType,
    })
  );

  console.log(`Uploaded: ${objectKey} (${contentType})`);
}

// Usage
// await uploadFile('./report.pdf', 'my-bucket');
// await uploadFile('./photo.png', 'my-bucket', 'images/photo.png');