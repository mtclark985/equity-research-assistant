export default function DataCaveats({ caveats }) {
  if (!caveats || caveats.length === 0) return null;

  return (
    <div className="bg-amber-50 border-l-4 border-amber-300 p-4 my-8 rounded-r-lg">
      <h4 className="font-sans font-semibold text-sm uppercase tracking-wide text-amber-900 mb-2">
        Data Caveats
      </h4>
      <ul className="list-disc list-inside space-y-1">
        {caveats.map((caveat, i) => (
          <li key={i} className="text-sm text-amber-900 leading-relaxed">
            {caveat}
          </li>
        ))}
      </ul>
    </div>
  );
}
