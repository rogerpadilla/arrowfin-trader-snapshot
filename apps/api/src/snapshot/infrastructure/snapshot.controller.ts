import { Controller, Get, Header } from '@nestjs/common';
import type { TraderSnapshotView } from 'contracts';
import type { Principal } from '../../auth/principal.js';
import { CurrentPrincipal } from '../../auth/session.guard.js';
import { GetTraderSnapshot } from '../application/get-trader-snapshot.js';
import { toSnapshotView } from './snapshot.view.js';

/** No account or trader id in the route: whose snapshot this is comes only from the verified session, so there is nothing to tamper with. */
@Controller('me')
export class SnapshotController {
  constructor(private readonly getTraderSnapshot: GetTraderSnapshot) {}

  @Get('snapshot')
  @Header('Cache-Control', 'no-store')
  async snapshot(@CurrentPrincipal() trader: Principal): Promise<TraderSnapshotView> {
    return toSnapshotView(await this.getTraderSnapshot.execute(trader));
  }
}
