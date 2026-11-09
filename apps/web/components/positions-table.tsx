import type { PositionView } from 'contracts';
import { formatPrice, formatSignedUsd, formatUsd, pnlTone } from '@/lib/format';
import { LiveValue } from './live-value';

const head = 'caption px-4 py-2.5 font-medium';
const cell = 'figure px-4 py-3 whitespace-nowrap text-right';

export function PositionsTable({ positions }: { positions: PositionView[] }) {
  if (positions.length === 0) {
    return <p className="px-5 py-4 text-sm text-muted sm:px-6">Flat. No open positions.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-rule">
            <th scope="col" className={`${head} pl-5 text-left sm:pl-6`}>
              Contract
            </th>
            <th scope="col" className={`${head} text-right`}>
              Position
            </th>
            <th scope="col" className={`${head} text-right`}>
              Avg price
            </th>
            <th scope="col" className={`${head} text-right`}>
              Mark
            </th>
            <th scope="col" className={`${head} text-right`}>
              Notional
            </th>
            <th scope="col" className={`${head} pr-5 text-right sm:pr-6`}>
              Unrealized
            </th>
          </tr>
        </thead>
        <tbody>
          {positions.map((position) => (
            <tr
              key={position.symbol}
              className="border-b border-rule/60 last:border-0 hover:bg-raised/50"
            >
              <th scope="row" className="py-3 pr-4 pl-5 text-left font-normal sm:pl-6">
                <span className="figure font-semibold">{position.symbol}</span>
                <span className="ml-2 text-xs text-muted">{position.description}</span>
              </th>
              <td className={`${cell} ${position.netQuantity > 0 ? 'text-up' : 'text-down'}`}>
                <LiveValue value={position.netQuantity}>
                  {position.netQuantity > 0 ? 'Long' : 'Short'} {Math.abs(position.netQuantity)}
                </LiveValue>
              </td>
              <td className={cell}>
                <LiveValue value={Number(position.averagePrice)}>
                  {formatPrice(position.averagePrice)}
                </LiveValue>
              </td>
              <td className={`${cell} text-muted`}>{formatPrice(position.markPrice)}</td>
              <td className={cell}>
                <LiveValue value={Number(position.notionalUsd)}>
                  {formatUsd(position.notionalUsd)}
                </LiveValue>
              </td>
              <td className={`${cell} pr-5 sm:pr-6 ${pnlTone(position.unrealizedPnlUsd)}`}>
                <LiveValue value={Number(position.unrealizedPnlUsd)} meaning="up-is-good">
                  {formatSignedUsd(position.unrealizedPnlUsd)}
                </LiveValue>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
