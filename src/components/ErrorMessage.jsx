export default function ErrorMessage({ message, onReset }) {
  return (
    <div className="max-w-md mx-auto px-6">
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h3 className="font-serif font-semibold text-lg text-red-900 mb-2">
          Couldn't generate memo
        </h3>
        <p className="text-red-800 text-sm leading-relaxed mb-4">
          {message}
        </p>
        <button
          onClick={onReset}
          className="px-4 py-2 bg-white border border-red-200 rounded-lg text-sm
                     font-sans font-medium text-red-800 hover:bg-red-50
                     transition-colors"
        >
          Try another ticker
        </button>
      </div>
    </div>
  );
}
