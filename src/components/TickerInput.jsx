import { useState } from 'react';

export default function TickerInput({ onSubmit, loading }) {
  const [value, setValue] = useState('');

  const isValid = /^[A-Za-z]{1,5}$/.test(value);

  function handleSubmit(e) {
    e.preventDefault();
    if (isValid && !loading) {
      onSubmit(value.toUpperCase());
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto px-6 mb-12">
      <div className="flex gap-3">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value.toUpperCase())}
          placeholder="Enter ticker"
          maxLength={5}
          className="flex-1 text-lg px-4 py-3 border border-stone-300 rounded-lg
                     focus:outline-none focus:ring-2 focus:ring-stone-400 focus:border-transparent
                     bg-white placeholder:text-stone-400"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !isValid}
          className="px-6 py-3 bg-stone-900 text-white font-sans font-medium text-sm
                     rounded-lg hover:bg-stone-800 disabled:bg-stone-300
                     disabled:cursor-not-allowed transition-colors whitespace-nowrap"
        >
          {loading ? 'Generating\u2026' : 'Generate Memo'}
        </button>
      </div>
      <p className="text-center text-stone-500 text-sm mt-3">
        Try AAPL, MSFT, ALLY, or JPM
      </p>
    </form>
  );
}
