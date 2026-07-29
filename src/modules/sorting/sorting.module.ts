import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { WebSocketModule } from '../../websocket/websocket.module';
import { SortingController } from './sorting.controller';
import { SortingService } from './sorting.service';

@Module({
  imports: [DatabaseModule, WebSocketModule],
  controllers: [SortingController],
  providers: [SortingService],
  exports: [SortingService],
})
export class SortingModule {}
