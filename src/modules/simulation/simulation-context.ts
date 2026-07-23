import { AsyncLocalStorage } from 'async_hooks';

export const simulationLocalStorage = new AsyncLocalStorage<string>();
