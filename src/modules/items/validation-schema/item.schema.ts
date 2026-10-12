import Joi from 'joi';

export const createItemSchema = Joi.object({
  name: Joi.string().trim().min(1).max(255).required(),
}).options({ abortEarly: false });

export const itemIdSchema = Joi.object({
  id: Joi.string().guid({ version: 'uuidv4' }).required(),
});
