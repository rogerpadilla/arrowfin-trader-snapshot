import { Inject, Logger } from '@nestjs/common';
import {
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  type OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { FILL_EVENT, type FillEvent, SOCKET_UNAUTHORIZED } from 'contracts';
import type { Server, Socket } from 'socket.io';
import type { Principal } from '../../auth/principal.js';
import { authenticate } from '../../auth/session-cookie.js';
import { APP_CONFIG, type AppConfig } from '../../config/app-config.js';
import { FillPublisher } from '../application/ports.js';
import type { Fill } from '../domain/model.js';
import { toFillEvent } from './snapshot.view.js';

interface ServerToClientEvents {
  [FILL_EVENT]: (event: FillEvent) => void;
}

interface SocketData {
  principal: Principal;
  expiresAt: Date;
}

type FillsServer = Server<
  Record<string, never>,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;
type FillsSocket = Socket<
  Record<string, never>,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

/** One room per trader, namespaced by tenant. Only the server ever decides which room a socket is in. */
const traderRoom = ({ brokerId, traderId }: Principal) => `broker:${brokerId}:trader:${traderId}`;

/**
 * Authenticated once, at the handshake (connection-level middleware, before any event is handled).
 * Clients send no subscribe messages, so there is no channel name for them to forge.
 */
@WebSocketGateway({ transports: ['websocket'], serveClient: false })
export class FillsGateway
  extends FillPublisher
  implements
    OnGatewayInit<FillsServer>,
    OnGatewayConnection<FillsSocket>,
    OnGatewayDisconnect<FillsSocket>
{
  @WebSocketServer()
  private readonly server!: FillsServer;

  readonly #logger = new Logger(FillsGateway.name);
  readonly #expiryTimers = new WeakMap<FillsSocket, NodeJS.Timeout>();

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {
    super();
  }

  afterInit(server: FillsServer): void {
    server.use((socket, next) => {
      void authenticate(socket.handshake.headers.cookie, this.config.jwtSecret).then((session) => {
        // oxlint-disable-next-line promise/no-callback-in-promise -- socket.io middleware only offers a callback
        if (!session) return next(new Error(SOCKET_UNAUTHORIZED));
        socket.data.principal = session.principal;
        socket.data.expiresAt = session.expiresAt;
        // oxlint-disable-next-line promise/no-callback-in-promise -- as above
        return next();
      });
    });
  }

  async handleConnection(socket: FillsSocket): Promise<void> {
    const { principal, expiresAt } = socket.data;
    await socket.join(traderRoom(principal));
    // A socket must not outlive the session that opened it.
    const timer = setTimeout(() => socket.disconnect(true), expiresAt.getTime() - Date.now());
    this.#expiryTimers.set(socket, timer);
    this.#logger.log({
      event: 'socket_connected',
      traderId: principal.traderId,
      brokerId: principal.brokerId,
    });
  }

  handleDisconnect(socket: FillsSocket): void {
    clearTimeout(this.#expiryTimers.get(socket));
  }

  publish(trader: Principal, fill: Fill): void {
    this.server.to(traderRoom(trader)).emit(FILL_EVENT, toFillEvent(fill));
  }
}
