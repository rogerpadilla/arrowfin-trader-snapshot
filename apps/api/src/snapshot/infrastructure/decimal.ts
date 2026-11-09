import { Decimal } from 'decimal.js';
import type { Prisma } from '../../generated/prisma/client.js';

/** Prisma ships its own Decimal class; the domain only knows decimal.js. Converting through the string keeps every digit. */
export const toDecimal = (value: Prisma.Decimal): Decimal => new Decimal(value.toString());
