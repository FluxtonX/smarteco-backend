import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { IotSqsConsumerService } from './iot-sqs-consumer.service';
import { BinsService } from './bins.service';

describe('IotSqsConsumerService', () => {
  let service: IotSqsConsumerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IotSqsConsumerService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              if (key === 'SQS_CONSUMER_ENABLED') return false; // Disable polling during unit tests
              return defaultValue;
            }),
          },
        },
        {
          provide: BinsService,
          useValue: {
            processLoraUplink: jest.fn().mockResolvedValue({ success: true }),
          },
        },
      ],
    }).compile();

    service = module.get<IotSqsConsumerService>(IotSqsConsumerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should correctly decode Milesight EM400 CayenneLPP payload (Battery, Temperature, Tilt)', () => {
    // Payload "AXVkA2cbAQUAAQ==" from Paraween's terminal screenshot:
    // HEX: 01 75 64 (Battery 100%) 03 67 1b 01 (Temp 28.3C) 05 00 01 (Tilt: Position 1)
    const rawBase64 = 'AXVkA2cbAQUAAQ==';
    const decoded = service.decodeMilesightPayload(rawBase64);

    expect(decoded.battery).toBe(100);
    expect(decoded.temperature).toBe(28.3);
    expect(decoded.position).toBe(1);
    expect(decoded.tilt).toBe(true);
  });
});
