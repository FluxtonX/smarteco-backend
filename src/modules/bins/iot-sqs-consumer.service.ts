import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  Message,
} from '@aws-sdk/client-sqs';
import { BinsService } from './bins.service';

interface SqsWirelessPayload {
  WirelessDeviceId?: string;
  PayloadData?: string;
  devEUI?: string;
  devEui?: string;
  WirelessMetadata?: {
    LoRaWAN?: {
      DevEUI?: string;
      FPort?: number;
      Timestamp?: string;
      Gateways?: Array<{
        GatewayEui?: string;
        Rssi?: number;
        Snr?: number;
      }>;
    };
  };
  object?: {
    distance?: number;
    battery?: number;
    temperature?: number;
    position?: number;
    tilt?: boolean;
  };
  decoded?: {
    distance?: number;
    battery?: number;
    temperature?: number;
    position?: number;
    tilt?: boolean;
  };
  rssi?: number;
  snr?: number;
}

@Injectable()
export class IotSqsConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IotSqsConsumerService.name);
  private sqsClient: SQSClient | null = null;
  private isPolling = false;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly binsService: BinsService,
  ) {}

  onModuleInit() {
    const queueUrl = this.configService.get<string>('AWS_SQS_QUEUE_URL');
    const enabled = this.configService.get<boolean>(
      'SQS_CONSUMER_ENABLED',
      true,
    );

    if (!enabled || !queueUrl) {
      this.logger.log(
        'AWS SQS Consumer disabled or AWS_SQS_QUEUE_URL not configured. Skipping SQS polling.',
      );
      return;
    }

    const region = this.configService.get<string>('AWS_REGION', 'us-east-1');
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>(
      'AWS_SECRET_ACCESS_KEY',
    );

    const credentials =
      accessKeyId && secretAccessKey
        ? { accessKeyId, secretAccessKey }
        : undefined;

    this.sqsClient = new SQSClient({ region, credentials });
    this.logger.log(
      `AWS SQS Consumer initialized for queue: ${queueUrl} (Region: ${region})`,
    );

    this.isPolling = true;
    this.startPollingLoop();
  }

  onModuleDestroy() {
    this.isPolling = false;
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.logger.log('AWS SQS Consumer stopped.');
  }

  private startPollingLoop() {
    if (!this.isPolling) return;

    const intervalMs = this.configService.get<number>(
      'AWS_SQS_POLL_INTERVAL_MS',
      5000,
    );

    this.pollMessages()
      .catch((err) => {
        const errMsg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Error polling AWS SQS: ${errMsg}`);
      })
      .finally(() => {
        if (this.isPolling) {
          this.timer = setTimeout(() => this.startPollingLoop(), intervalMs);
        }
      });
  }

  private async pollMessages() {
    if (!this.sqsClient) return;

    const queueUrl = this.configService.get<string>('AWS_SQS_QUEUE_URL');
    if (!queueUrl) return;

    const receiveCmd = new ReceiveMessageCommand({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: 10,
      WaitTimeSeconds: 10, // Long polling
    });

    const response = await this.sqsClient.send(receiveCmd);
    if (!response.Messages || response.Messages.length === 0) {
      return;
    }

    this.logger.log(
      `Received ${response.Messages.length} message(s) from SQS queue`,
    );

    for (const msg of response.Messages) {
      await this.handleSingleSqsMessage(msg, queueUrl);
    }
  }

  private async handleSingleSqsMessage(msg: Message, queueUrl: string) {
    if (!msg.Body) return;

    try {
      const parsedBody = JSON.parse(msg.Body) as SqsWirelessPayload;

      // Extract DevEUI
      const devEui =
        parsedBody.WirelessMetadata?.LoRaWAN?.DevEUI ||
        parsedBody.devEUI ||
        parsedBody.devEui ||
        parsedBody.WirelessDeviceId;

      if (!devEui) {
        this.logger.warn(
          `SQS Message missing devEUI (MessageId: ${msg.MessageId}). Skipping.`,
        );
        await this.deleteSqsMessage(msg.ReceiptHandle, queueUrl);
        return;
      }

      // Extract or decode sensor values
      let decodedObject = parsedBody.object || parsedBody.decoded;

      if (!decodedObject && parsedBody.PayloadData) {
        decodedObject = this.decodeMilesightPayload(parsedBody.PayloadData);
      }

      const gateway = parsedBody.WirelessMetadata?.LoRaWAN?.Gateways?.[0];
      const rssi = gateway?.Rssi ?? parsedBody.rssi;
      const snr = gateway?.Snr ?? parsedBody.snr;

      const normalizedPayload = {
        devEUI: devEui,
        object: decodedObject || {},
        rxInfo: [
          {
            rssi,
            snr,
          },
        ],
        rssi,
      };

      this.logger.debug(
        `Processing SQS message for EUI ${devEui}: ${JSON.stringify(normalizedPayload.object)}`,
      );

      await this.binsService.processLoraUplink(normalizedPayload);
      await this.deleteSqsMessage(msg.ReceiptHandle, queueUrl);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Failed to process SQS MessageId ${msg.MessageId}: ${errMsg}`,
      );
    }
  }

  private async deleteSqsMessage(
    receiptHandle: string | undefined,
    queueUrl: string,
  ) {
    if (!receiptHandle || !this.sqsClient) return;
    try {
      await this.sqsClient.send(
        new DeleteMessageCommand({
          QueueUrl: queueUrl,
          ReceiptHandle: receiptHandle,
        }),
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to delete SQS message: ${errMsg}`);
    }
  }

  /**
   * Decodes Milesight CayenneLPP Base64 payloads (EM400 series)
   * Channel 0x01, Type 0x75 -> Battery %
   * Channel 0x03, Type 0x67 -> Temp °C (Int16 / 10)
   * Channel 0x04, Type 0x82 -> Distance mm (UInt16 LE)
   * Channel 0x05, Type 0x00 -> Position / Tilt (0 = Normal, 1 = Tilt)
   */
  public decodeMilesightPayload(base64Payload: string) {
    const buffer = Buffer.from(base64Payload, 'base64');
    let battery: number | undefined = undefined;
    let temperature: number | undefined = undefined;
    let distance: number | undefined = undefined;
    let position: number | undefined = undefined;

    let i = 0;
    while (i < buffer.length) {
      const channel = buffer[i++];
      const type = buffer[i++];

      if (channel === 0x01 && type === 0x75) {
        battery = buffer[i++];
      } else if (channel === 0x03 && type === 0x67) {
        if (i + 1 < buffer.length) {
          temperature = buffer.readInt16LE(i) / 10;
          i += 2;
        }
      } else if (channel === 0x04 && type === 0x82) {
        if (i + 1 < buffer.length) {
          distance = buffer.readUInt16LE(i);
          i += 2;
        }
      } else if (channel === 0x05 && type === 0x00) {
        position = buffer[i++];
      } else {
        break; // Stop parsing on unknown TLV channel to prevent offset mismatch
      }
    }

    return {
      battery,
      temperature,
      distance,
      position,
      tilt: position === 1,
    };
  }
}
