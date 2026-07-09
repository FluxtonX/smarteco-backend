import { Module } from '@nestjs/common';
import { MomoService } from './momo.service';

@Module({
  providers: [MomoService],
  exports: [MomoService],
})
export class MomoModule {}
