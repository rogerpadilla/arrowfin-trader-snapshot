import {
  Body,
  Controller,
  HttpCode,
  Inject,
  NotFoundException,
  Post,
  Res,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { type DevFillRequest, type DevLoginRequest, type FillEvent, SIDES } from 'contracts';
import type { Response } from 'express';
import { z } from 'zod';
import type { Principal } from '../auth/principal.js';
import { sessionCookie } from '../auth/session-cookie.js';
import { issueSessionToken } from '../auth/session-token.js';
import { CurrentPrincipal, Public } from '../auth/session.guard.js';
import { APP_CONFIG, type AppConfig } from '../config/app-config.js';
import { AccountNotFoundError, RecordFill } from '../snapshot/application/record-fill.js';
import { UnknownInstrumentError } from '../snapshot/domain/snapshot.js';
import { toFillEvent } from '../snapshot/infrastructure/snapshot.view.js';
import { Database } from '../tenancy/database.js';

const identifier = z.string().regex(/^[A-Z0-9-]{1,32}$/);

const devLoginSchema = z.object({
  brokerId: identifier,
  traderId: identifier,
}) satisfies z.ZodType<DevLoginRequest, DevLoginRequest>;
type DevLogin = z.infer<typeof devLoginSchema>;

/** A `commission_usd` as in dataset/simulate-fills.md is dropped: the server prices commission from the fee schedule. */
const devFillSchema = z.object({
  account_id: identifier,
  instrument_symbol: identifier,
  side: z.enum(SIDES),
  quantity: z.number().int().min(1).max(1000),
  price: z
    .union([z.number().positive().finite(), z.string().regex(/^\d{1,12}(\.\d{1,8})?$/)])
    .transform(String),
}) satisfies z.ZodType<unknown, DevFillRequest>;
type DevFill = z.infer<typeof devFillSchema>;

/** Development stand-ins for the identity provider and the exchange fill feed. Only mounted when ENABLE_DEV_TOOLS is set outside production. */
@Controller('dev')
export class DevController {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly database: Database,
    private readonly recordFill: RecordFill,
  ) {}

  /** The portal (broker) is part of the login, as with a white-label realm: the trader is looked up inside that tenant only. */
  @Public()
  @Post('login')
  @HttpCode(204)
  async login(
    @Body({ schema: devLoginSchema }) body: DevLogin,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const trader = await this.database.withTenant(body, (tx) =>
      tx.trader.findFirst({
        where: { id: body.traderId, brokerId: body.brokerId },
        select: { id: true },
      }),
    );
    if (!trader) throw new UnauthorizedException();
    const token = await issueSessionToken(body, this.config.jwtSecret, new Date());
    response.setHeader('Set-Cookie', sessionCookie(token, this.config.production));
  }

  /** Fills can only be simulated on the caller's own accounts. */
  @Post('fills')
  async fill(
    @CurrentPrincipal() trader: Principal,
    @Body({ schema: devFillSchema }) body: DevFill,
  ): Promise<FillEvent> {
    try {
      const fill = await this.recordFill.execute(trader, {
        accountId: body.account_id,
        symbol: body.instrument_symbol,
        side: body.side,
        quantity: body.quantity,
        price: body.price,
      });
      return toFillEvent(fill);
    } catch (error) {
      if (error instanceof AccountNotFoundError) throw new NotFoundException();
      if (error instanceof UnknownInstrumentError)
        throw new UnprocessableEntityException(error.message);
      throw error;
    }
  }
}
