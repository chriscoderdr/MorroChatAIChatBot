import { LoggerService } from '@nestjs/common';
import { CloudWatchLogs } from 'aws-sdk';

export class CloudWatchLogger implements LoggerService {
  private cloudwatch: CloudWatchLogs;
  private logGroupName: string;
  private logStreamName: string;
  private sequenceToken?: string;

  constructor(logGroupName?: string, logStreamName?: string) {
    this.logGroupName =
      logGroupName || process.env.CLOUDWATCH_LOG_GROUP || 'morrochat-logs';
    this.logStreamName =
      logStreamName || process.env.CLOUDWATCH_LOG_STREAM || 'app';
    this.cloudwatch = new CloudWatchLogs({
      region: process.env.AWS_REGION || 'eu-central-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    });
    void this.ensureLogGroupAndStream();
  }

  private async ensureLogGroupAndStream(): Promise<void> {
    // Ensure log group exists
    try {
      await this.cloudwatch
        .createLogGroup({ logGroupName: this.logGroupName })
        .promise();
    } catch (e: unknown) {
      if ((e as { code: string }).code !== 'ResourceAlreadyExistsException') {
        console.error('CloudWatch createLogGroup error:', e);
      }
    }
    // Ensure log stream exists
    try {
      await this.cloudwatch
        .createLogStream({
          logGroupName: this.logGroupName,
          logStreamName: this.logStreamName,
        })
        .promise();
    } catch (e: unknown) {
      if ((e as { code: string }).code !== 'ResourceAlreadyExistsException') {
        console.error('CloudWatch createLogStream error:', e);
      }
    }
    // Get the current sequence token
    try {
      const streams = await this.cloudwatch
        .describeLogStreams({
          logGroupName: this.logGroupName,
          logStreamNamePrefix: this.logStreamName,
        })
        .promise();
      const stream = streams.logStreams?.find(
        (s) => s.logStreamName === this.logStreamName,
      );
      this.sequenceToken = stream?.uploadSequenceToken;
    } catch (e) {
      console.error('CloudWatch describeLogStreams error:', e);
    }
  }

  private async send(log: unknown): Promise<void> {
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
    } catch (e: unknown) {
      if (
        (e as { code: string }).code === 'InvalidSequenceTokenException' &&
        (e as { expectedSequenceToken: string }).expectedSequenceToken
      ) {
        this.sequenceToken = (
          e as { expectedSequenceToken: string }
        ).expectedSequenceToken;
        await this.send(log); // retry once
        return;
      }
      console.error('CloudWatchLogger error:', e);
    }
  }

  async log(message: string, context?: string): Promise<void> {
    await this.send({ level: 'log', message, context, timestamp: new Date() });
  }
  async error(
    message: string,
    trace?: string,
    context?: string,
  ): Promise<void> {
    await this.send({
      level: 'error',
      message,
      trace,
      context,
      timestamp: new Date(),
    });
  }
  async warn(message: string, context?: string): Promise<void> {
    await this.send({ level: 'warn', message, context, timestamp: new Date() });
  }
  async debug(message: string, context?: string): Promise<void> {
    await this.send({
      level: 'debug',
      message,
      context,
      timestamp: new Date(),
    });
  }
  async verbose(message: string, context?: string): Promise<void> {
    await this.send({
      level: 'verbose',
      message,
      context,
      timestamp: new Date(),
    });
  }
}
