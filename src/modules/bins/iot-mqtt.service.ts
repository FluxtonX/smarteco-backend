import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mqtt from 'mqtt';
import { BinsService } from './bins.service';

@Injectable()
export class IotMqttService implements OnModuleInit, OnModuleDestroy {
  private mqttClient: mqtt.MqttClient;
  private readonly logger = new Logger(IotMqttService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly binsService: BinsService,
  ) {}

  onModuleInit() {
    const brokerUrl = this.configService.get<string>(
      'MQTT_BROKER_URL',
      'mqtt://localhost:1883',
    );
    const topic = this.configService.get<string>(
      'MQTT_SUBSCRIBE_TOPIC',
      'smarteco/iot/up',
    );
    const username = this.configService.get<string>('MQTT_USERNAME');
    const password = this.configService.get<string>('MQTT_PASSWORD');

    const options: mqtt.IClientOptions = {};
    if (username) {
      options.username = username;
    }
    if (password) {
      options.password = password;
    }

    this.logger.log(`Connecting to MQTT Broker at ${brokerUrl}...`);
    this.mqttClient = mqtt.connect(brokerUrl, options);

    this.mqttClient.on('connect', () => {
      this.logger.log(
        `Connected to MQTT Broker. Subscribing to topic: ${topic}`,
      );
      this.mqttClient.subscribe(topic, (err) => {
        if (err) {
          this.logger.error(
            `Failed to subscribe to topic ${topic}: ${err.message}`,
          );
        } else {
          this.logger.log(`Successfully subscribed to topic: ${topic}`);
        }
      });
    });

    this.mqttClient.on('error', (err) => {
      this.logger.error(`MQTT client error: ${err.message}`);
    });

    this.mqttClient.on('message', (recvTopic, message) => {
      const payloadString = message.toString();
      this.logger.debug(
        `Received MQTT payload on topic ${recvTopic}: ${payloadString}`,
      );

      try {
        const payload = JSON.parse(payloadString) as Record<string, unknown>;
        this.binsService.processLoraUplink(payload).catch((err: unknown) => {
          const errMsg = err instanceof Error ? err.message : String(err);
          this.logger.error(`Error processing MQTT message: ${errMsg}`);
        });
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Error parsing MQTT message: ${errMsg}`);
      }
    });
  }

  onModuleDestroy() {
    if (this.mqttClient) {
      this.mqttClient.end();
      this.logger.log('MQTT Client disconnected.');
    }
  }
}
