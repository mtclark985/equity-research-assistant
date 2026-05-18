export default function MemoSection({ title, children }) {
  return (
    <section className="mb-10">
      <h3 className="font-sans font-semibold text-xl text-stone-900 border-b border-stone-200 pb-2 mb-4">
        {title}
      </h3>
      {children}
    </section>
  );
}
