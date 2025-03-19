import 'dotenv/config';
import * as joi from 'joi';

interface EnvVars {
  PORT: number;
  PRODUCTS_MICROSERVICE_HOST: string;
  PRODUCTS_MICROSERVICE_PORT: number;
}

const envSchema = joi.object<EnvVars>({
  PORT: joi.number().required(),
  PRODUCTS_MICROSERVICE_HOST: joi.string().required(),
  PRODUCTS_MICROSERVICE_PORT: joi.number().required(),
});

function validateEnv<T>(
  schema: joi.ObjectSchema<T>,
  env: NodeJS.ProcessEnv,
): T {
  const result = schema.validate(env, {
    allowUnknown: true,
    convert: true,
  });

  if (result.error)
    throw new Error(`Config validation error: ${result.error.message}`);

  return result.value;
}

const validatedEnv = validateEnv(envSchema, process.env);

export const envs = {
  port: validatedEnv.PORT,
  microservices: {
    products: {
      host: validatedEnv.PRODUCTS_MICROSERVICE_HOST,
      port: validatedEnv.PRODUCTS_MICROSERVICE_PORT,
    },
  },
};
