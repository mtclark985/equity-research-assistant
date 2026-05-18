import { formatCurrency } from '../lib/format';

export default function KeyFiguresTable({ figures }) {
  if (!figures || figures.length === 0) return null;

  return (
    <div className="bg-stone-50 rounded-lg p-4 my-6">
      <table className="w-full">
        <tbody>
          {figures.map((fig, i) => (
            <tr key={i} className="border-b border-stone-100 last:border-b-0">
              <td className="py-2 pr-4 text-stone-600 text-sm">{fig.label}</td>
              <td className="py-2 text-right">
                <span className="font-serif font-semibold text-stone-900">
                  {formatCurrency(fig.value, fig.unit)}
                </span>
                {fig.period && (
                  <span className="block text-stone-500 text-xs">{fig.period}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
