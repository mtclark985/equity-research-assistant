import { formatDate } from '../lib/format';

const LABEL_STYLES = {
  Overweight: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  'Equal-weight': 'bg-stone-200 text-stone-700 border-stone-300',
  Underweight: 'bg-amber-100 text-amber-900 border-amber-300',
};

export default function ThesisBlock({ thesis, companyName, ticker, asOfDate }) {
  const pillClass = LABEL_STYLES[thesis.label] || LABEL_STYLES['Equal-weight'];

  return (
    <section className="mb-10">
      <h2 className="font-serif font-semibold text-3xl text-stone-900">
        {companyName} ({ticker})
      </h2>
      <p className="text-stone-500 text-sm mt-1 mb-4">
        As of {formatDate(asOfDate)}
      </p>
      <span
        className={`inline-block rounded-full px-3 py-1 border text-sm font-sans font-medium mb-4 ${pillClass}`}
      >
        {thesis.label}
      </span>
      <p className="font-serif text-lg leading-relaxed text-stone-800">
        {thesis.summary}
      </p>
    </section>
  );
}
