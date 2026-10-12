import type { RequestHandler } from 'express';
import type Joi from 'joi';
import { HttpError } from '../common/http-error';

export function validationMiddleware(schema: Joi.Schema, target: 'body' | 'query' | 'params' = 'body'): RequestHandler {
  return (req, _res, next) => {
    const { value, error } = schema.validate(req[target], { abortEarly: false });
    if (error) return next(new HttpError(422, error.details.map((detail) => detail.message).join('; ')));

    if (target === 'body') req.body = value;
    else if (target === 'query') req.query = value;
    else req.params = value;
    return next();
  };
}
