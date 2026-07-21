import { S3Client } from "@aws-sdk/client-s3";

export function createObjectClient(env) {
  const required = [
    "PUSTAKAOBAT_OBJECT_ENDPOINT",
    "PUSTAKAOBAT_OBJECT_ACCESS_KEY_ID",
    "PUSTAKAOBAT_OBJECT_SECRET_ACCESS_KEY",
    "PUSTAKAOBAT_OBJECT_BUCKET",
  ];
  const missing = required.filter((key) => !env[key]);
  if (missing.length) throw new Error(`Missing object-storage settings: ${missing.join(", ")}`);
  return {
    bucket: env.PUSTAKAOBAT_OBJECT_BUCKET,
    client: new S3Client({
      endpoint: env.PUSTAKAOBAT_OBJECT_ENDPOINT,
      region: env.PUSTAKAOBAT_OBJECT_REGION || "auto",
      forcePathStyle: env.PUSTAKAOBAT_OBJECT_FORCE_PATH_STYLE === "true",
      credentials: {
        accessKeyId: env.PUSTAKAOBAT_OBJECT_ACCESS_KEY_ID,
        secretAccessKey: env.PUSTAKAOBAT_OBJECT_SECRET_ACCESS_KEY,
      },
    }),
  };
}
