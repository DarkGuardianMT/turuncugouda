import { getSecret } from 'astro:env/server';
import { getDatabasePool } from '../db/pool';
import { createRateLimiter } from './core';

// Configuratie blijft lui en server-only; openbare statische pagina's hebben geen secrets nodig.
const limiter = createRateLimiter(getDatabasePool, () => getSecret('RATE_LIMIT_SECRET'));
export const consumeRateLimit = limiter.consume;
export const resetRateLimit = limiter.reset;
