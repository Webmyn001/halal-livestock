import type { UserRole } from '../models/User';

declare global {
  namespace Express {
    interface Request {
      user?: { userId: string; role: UserRole };
      /** The bytes behind a JSON body, kept so a webhook signature can be checked. */
      rawBody?: Buffer;
    }
  }
}

export {};
