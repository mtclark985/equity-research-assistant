export default function Sources({ sources }) {
  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-8 pt-4 border-t border-stone-200">
      <p className="text-stone-500 text-sm">
        <span className="font-semibold">Sources: </span>
        {sources.map((src, i) => (
          <span key={i}>
            {i > 0 && ', '}
            {src.url ? (
              <a
                href={src.url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-stone-700"
              >
                {src.name}
              </a>
            ) : (
              src.name
            )}
          </span>
        ))}
      </p>
    </div>
  );
}
