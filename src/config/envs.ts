import 'dotenv/config';
import * as joi from 'joi';

interface EnvVars {
  PORT: number;
  NATS_SERVERS: string[];
}

const envSchema = joi.object<EnvVars>({
  PORT: joi.number().required(),

  NATS_SERVERS: joi.array().items(joi.string()).required(),
});

function validateEnv<T>(
  schema: joi.ObjectSchema<T>,
  env: NodeJS.ProcessEnv,
): T {
  const result = schema.validate(
    {
      ...env,
      NATS_SERVERS: env.NATS_SERVERS?.split(','),
    },
    {
      allowUnknown: true,
      convert: true,
    },
  );

  if (result.error)
    throw new Error(`Config validation error: ${result.error.message}`);

  return result.value;
}

const validatedEnv = validateEnv(envSchema, process.env);

export const envs = {
  port: validatedEnv.PORT,
  natsServers: validatedEnv.NATS_SERVERS,
};
