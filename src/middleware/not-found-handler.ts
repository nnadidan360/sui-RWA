import { Request, Response, NextFunction } from 'express';
import { CustomError } from './error-handler';

export const notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
  const error = new CustomError(`Route ${req.originalUrl} not found`, 404);
  next(error);
};