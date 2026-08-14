import { useStore } from '../store/store'
import PositionRow from './PositionRow'

export default function Blotter() {
  const syms = useStore((s) => Object.keys(s.positions).join(','))
  return (
    <table className="blotter">
      <thead>
        <tr>
          <th>SYM</th><th>QTY</th><th>AVG</th><th>LAST</th><th></th>
          <th>uPNL $</th><th>uPNL %</th><th>DAY $</th><th></th>
        </tr>
      </thead>
      <tbody>{syms ? syms.split(',').map((s) => <PositionRow key={s} sym={s} />) : null}</tbody>
    </table>
  )
}
