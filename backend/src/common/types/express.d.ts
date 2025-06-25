declare namespace Express {
  export interface Request {
    browserSessionId?: string;
    res?: Response;  // Response object reference for easy access
    cookies: {
      [key: string]: string;
    };
  }
}
