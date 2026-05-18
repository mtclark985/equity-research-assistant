export default function PriceWindow({ priceWindow }) {
  if (!priceWindow) return null;

  const cells = [
    { label: 'Current', value: '$' + priceWindow.currentClose.toFixed(2) },
    { label: '5Y High', value: '$' + priceWindow.fiveYearHigh.toFixed(2) },
    { label: '5Y Low', value: '$' + priceWindow.fiveYearLow.toFixed(2) },
    { label: '5Y Return', value: priceWindow.fiveYearReturn },
  ];

  return (
    <div className="bg-stone-50 rounded-lg p-4 my-6 grid grid-cols-4 gap-4">
      {cells.map((cell) => (
        <div key={cell.label} className="text-center">
          <p className="text-stone-600 text-xs mb-1">{cell.label}</p>
          <p className="font-serif font-semibold text-stone-900">{cell.value}</p>
        </div>
      ))}
    </div>
  );
}
