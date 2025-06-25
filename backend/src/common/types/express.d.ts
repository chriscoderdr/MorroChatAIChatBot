declare namespace Express {
  export interface Request {
    browserSessionId?: string;
    res?: Response;  // Adding response object reference for easy access
  }
}
