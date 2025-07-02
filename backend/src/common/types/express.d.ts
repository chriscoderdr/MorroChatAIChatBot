import 'express';

declare module 'express' {
  export interface Request {
    browserSessionId?: string;
  }
}
