import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class BrowserSessionMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Check if the user already has a browser session ID
    if (!req.cookies.browserSessionId) {
      // Generate a new session ID
      const browserSessionId = uuidv4();
      
      // Set a cookie that expires in 1 year (or adjust as needed)
      res.cookie('browserSessionId', browserSessionId, {
        maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // secure in production
        sameSite: 'lax',
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
