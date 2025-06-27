import { LoggerService } from '@nestjs/common';
import * as net from 'net';

export class LogstashLogger implements LoggerService {
  private logstashHost: string;
  private logstashPort: number;
  private socket: net.Socket;

  constructor(host: string = 'logstash', port: number = 5000) {
    this.logstashHost = host;
    this.logstashPort = port;
    this.socket = new net.Socket();
    this.socket.connect(this.logstashPort, this.logstashHost, () => {
      // Connected
    });
    this.socket.on('error', (err) => {
      // Optionally handle connection errors
      // console.error('Logstash connection error:', err);
    });
  }

  log(message: any, context?: string) {
    this.send({ level: 'log', message, context });
  }
  error(message: any, trace?: string, context?: string) {
    this.send({ level: 'error', message, trace, context });
  }
  warn(message: any, context?: string) {
    this.send({ level: 'warn', message, context });
  }
  debug(message: any, context?: string) {
    this.send({ level: 'debug', message, context });
  }
  verbose(message: any, context?: string) {
    this.send({ level: 'verbose', message, context });
  }

  private send(log: any) {
    try {
      this.socket.write(JSON.stringify(log) + '\n');
    } catch (e) {
      // Optionally handle send errors
    }
  }
}
