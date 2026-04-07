import { Module } from '@nestjs/common';
import { EcoPointsController } from './eco-points.controller';
import { EcoPointsService } from './eco-points.service';

@Module({
    controllers: [EcoPointsController],
    providers: [EcoPointsService],
    exports: [EcoPointsService],
})
export class EcoPointsModule {}
