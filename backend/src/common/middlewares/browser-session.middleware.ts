import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class BrowserSessionMiddleware implements NestMiddleware {
  private readonly logger = new Logger(BrowserSessionMiddleware.name);

  use(req: Request, res: Response, next: NextFunction) {
    // Check if the user already has a browser session ID
    if (!req.cookies?.browserSessionId) {
      // Generate a new session ID
      const browserSessionId = uuidv4();

      // Set a cookie that expires in 1 year with path set to root
      res.cookie('browserSessionId', browserSessionId, {
        maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // secure in production
        sameSite: 'lax',
        path: '/', // Ensure cookie is available for all paths
      });

      // Also make it available in the request object for this request
      req.browserSessionId = browserSessionId;
    } else {
      // Use the existing session ID
      req.browserSessionId = req.cookies.browserSessionId;
    }

    next();
  }
}
