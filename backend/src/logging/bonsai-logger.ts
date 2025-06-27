import { LoggerService } from '@nestjs/common';
import axios from 'axios';

export class BonsaiLogger implements LoggerService {
  private bonsaiUrl: string;
  private index: string;

  constructor(
    bonsaiUrl: string = 'https://srkpejt94t:oj9db58y8x@growidea-llc-search-5157941282.eu-central-1.bonsaisearch.net:443',
    index: string = 'morrochat-logs'
  ) {
    this.bonsaiUrl = bonsaiUrl;
    this.index = index;
  }

  private async send(log: any) {
    try {
      await axios.post(
        `${this.bonsaiUrl}/${this.index}/_doc`,
        log,
        { headers: { 'Content-Type': 'application/json' } }
      );
    } catch (e) {
      // Optionally handle send errors
    }
  }

  log(message: any, context?: string) {
    this.send({ level: 'log', message, context, timestamp: new Date() });
  }
  error(message: any, trace?: string, context?: string) {
    this.send({ level: 'error', message, trace, context, timestamp: new Date() });
  }
  warn(message: any, context?: string) {
    this.send({ level: 'warn', message, context, timestamp: new Date() });
  }
  debug(message: any, context?: string) {
    this.send({ level: 'debug', message, context, timestamp: new Date() });
  }
  verbose(message: any, context?: string) {
    this.send({ level: 'verbose', message, context, timestamp: new Date() });
  }
}
