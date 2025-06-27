import { LoggerService } from '@nestjs/common';
import { Client } from '@elastic/elasticsearch';

export class BonsaiLogger implements LoggerService {
  private client: Client;
  private index: string;

  constructor(
    bonsaiUrl: string = 'https://srkpejt94t:oj9db58y8x@growidea-llc-search-5157941282.eu-central-1.bonsaisearch.net:443',
    index: string = 'morrochat-logs'
  ) {
    this.client = new Client({ node: bonsaiUrl });
    this.index = index;

    // Optional: test connection on startup
    this.client.ping({}, { requestTimeout: 30000 })
      .then(() => console.log('Bonsai/Elasticsearch is up!'))
      .catch(() => console.error('Bonsai/Elasticsearch cluster is down!'));
  }

  private async send(log: any) {
    try {
      await this.client.index({
        index: this.index,
        document: log,
      });
    } catch (e) {
      console.error('BonsaiLogger error:', e?.meta?.body?.error || e.message || e);
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