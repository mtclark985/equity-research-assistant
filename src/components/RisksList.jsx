export default function RisksList({ risks }) {
  if (!risks || risks.length === 0) return null;

  return (
    <ol className="list-none p-0">
      {risks.map((risk, i) => (
        <li key={i} className="my-6 flex gap-4">
          <span className="font-mono text-stone-500 text-sm pt-0.5 shrink-0">
            {i + 1}.
          </span>
          <div>
            <p className="font-sans font-semibold text-base text-stone-900 mb-1">
              {risk.title}
            </p>
            <p className="font-serif text-base leading-relaxed text-stone-800">
              {risk.summary}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
