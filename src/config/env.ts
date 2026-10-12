import 'dotenv/config';
import Joi from 'joi';

const schema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().integer().min(1).max(65535).default(3000),
  DATABASE_URL: Joi.string().uri({ scheme: ['postgres', 'postgresql'] }).required(),
  REDIS_URL: Joi.string().uri({ scheme: ['redis', 'rediss'] }).default('redis://127.0.0.1:6384/0'),
  CORS_ORIGIN: Joi.string().uri({ scheme: ['http', 'https'] }).allow('').default(''),
  RATE_LIMIT_WINDOW_MS: Joi.number().integer().min(1000).default(60_000),
  RATE_LIMIT_MAX: Joi.number().integer().min(1).default(100),
  TRUST_PROXY: Joi.number().integer().min(0).default(0),
  FILES_API_KEY: Joi.string().min(32).allow('').default(''),
  FILES_KEY_PREFIX: Joi.string().pattern(/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*\/$/).default('standalone/'),
  WASABI_BUCKET: Joi.string().allow('').default(''),
  WASABI_REGION: Joi.string().default('us-east-1'),
  WASABI_URL: Joi.string().hostname().default('wasabisys.com'),
  WASABI_ENDPOINT: Joi.string().uri({ scheme: ['http', 'https'] }).allow('').default(''),
  WASABI_ACCESS_KEY_ID: Joi.string().allow('').default(''),
  WASABI_SECRET_ACCESS_KEY: Joi.string().allow('').default(''),
  WASABI_PUBLIC_BUCKET: Joi.string().allow('').default(''),
  WASABI_PUBLIC_REGION: Joi.string().default('us-east-1'),
  WASABI_PUBLIC_ACCESS_KEY_ID: Joi.string().allow('').default(''),
  WASABI_PUBLIC_SECRET_ACCESS_KEY: Joi.string().allow('').default(''),
}).unknown(true);

const { value, error } = schema.validate(process.env, { abortEarly: false });
if (error) throw new Error(`Invalid environment: ${error.message}`);

export const env = {
  nodeEnv: value.NODE_ENV as string,
  port: value.PORT as number,
  databaseUrl: value.DATABASE_URL as string,
  redisUrl: value.REDIS_URL as string,
  corsOrigin: value.CORS_ORIGIN as string,
  rateLimitWindowMs: value.RATE_LIMIT_WINDOW_MS as number,
  rateLimitMax: value.RATE_LIMIT_MAX as number,
  trustProxy: value.TRUST_PROXY as number,
  filesApiKey: value.FILES_API_KEY as string,
  filesKeyPrefix: value.FILES_KEY_PREFIX as string,
  wasabiBucket: value.WASABI_BUCKET as string,
  wasabiRegion: value.WASABI_REGION as string,
  wasabiUrl: value.WASABI_URL as string,
  wasabiEndpoint: value.WASABI_ENDPOINT as string,
  wasabiAccessKeyId: value.WASABI_ACCESS_KEY_ID as string,
  wasabiSecretAccessKey: value.WASABI_SECRET_ACCESS_KEY as string,
  wasabiPublicBucket: value.WASABI_PUBLIC_BUCKET as string,
  wasabiPublicRegion: value.WASABI_PUBLIC_REGION as string,
  wasabiPublicAccessKeyId: value.WASABI_PUBLIC_ACCESS_KEY_ID as string,
  wasabiPublicSecretAccessKey: value.WASABI_PUBLIC_SECRET_ACCESS_KEY as string,
};
