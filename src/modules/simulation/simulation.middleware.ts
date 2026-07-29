import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { simulationLocalStorage } from './simulation-context';

@Injectable()
export class SimulationMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const simulationId = req.headers['x-simulation-id'] as string;
    if (simulationId) {
      simulationLocalStorage.run(simulationId, () => {
        next();
      });
    } else {
      next();
    }
  }
}
