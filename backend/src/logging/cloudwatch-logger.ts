import { LoggerService } from '@nestjs/common';
import { CloudWatchLogs } from 'aws-sdk';

export class CloudWatchLogger implements LoggerService {
  private cloudwatch: CloudWatchLogs;
  private logGroupName: string;
  private logStreamName: string;
  private sequenceToken?: string;

  constructor(
    logGroupName?: string,
    logStreamName?: string
  ) {
    this.logGroupName = logGroupName || process.env.CLOUDWATCH_LOG_GROUP || 'morrochat-logs';
    this.logStreamName = logStreamName || process.env.CLOUDWATCH_LOG_STREAM || 'app';
    this.cloudwatch = new CloudWatchLogs({
      region: process.env.AWS_REGION || 'eu-central-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    });
    this.ensureLogGroupAndStream();
  }

  private async ensureLogGroupAndStream() {
    // Ensure log group exists
    try {
      await this.cloudwatch.createLogGroup({ logGroupName: this.logGroupName }).promise();
    } catch (e: any) {
      if (e.code !== 'ResourceAlreadyExistsException') {
        console.error('CloudWatch createLogGroup error:', e);
      }
    }
    // Ensure log stream exists
    try {
      await this.cloudwatch.createLogStream({ logGroupName: this.logGroupName, logStreamName: this.logStreamName }).promise();
    } catch (e: any) {
      if (e.code !== 'ResourceAlreadyExistsException') {
        console.error('CloudWatch createLogStream error:', e);
      }
    }
    // Get the current sequence token
    try {
      const streams = await this.cloudwatch.describeLogStreams({
        logGroupName: this.logGroupName,
        logStreamNamePrefix: this.logStreamName,
      }).promise();
      const stream = streams.logStreams?.find(s => s.logStreamName === this.logStreamName);
      this.sequenceToken = stream?.uploadSequenceToken;
    } catch (e) {
      console.error('CloudWatch describeLogStreams error:', e);
    }
  }

  private async send(log: any) {
    try {
      const params: CloudWatchLogs.Types.PutLogEventsRequest = {
        logGroupName: this.logGroupName,
        logStreamName: this.logStreamName,
        logEvents: [
          {
            message: JSON.stringify(log),
            timestamp: Date.now(),
          },
        ],
        sequenceToken: this.sequenceToken,
      };
      const result = await this.cloudwatch.putLogEvents(params).promise();
      this.sequenceToken = result.nextSequenceToken;
    } catch (e: any) {
      if (e.code === 'InvalidSequenceTokenException' && e.expectedSequenceToken) {
        this.sequenceToken = e.expectedSequenceToken;
        return this.send(log); // retry once
      }
      console.error('CloudWatchLogger error:', e);
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
