import { Module } from '@nestjs/common';
import { AirtelService } from './airtel.service';

@Module({
    providers: [AirtelService],
    exports: [AirtelService],
})
export class AirtelModule {}
