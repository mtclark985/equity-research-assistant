import { useState } from 'react';
import Header from './components/Header';
import TickerInput from './components/TickerInput';
import Memo from './components/Memo';
import MemoSkeleton from './components/MemoSkeleton';
import ErrorMessage from './components/ErrorMessage';

export default function App() {
  const [state, setState] = useState({ status: 'idle' });
  // status: 'idle' | 'loading' | 'success' | 'error'

  async function handleSubmit(ticker) {
    setState({ status: 'loading' });
    try {
      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'memo', ticker }),
      });
      const data = await res.json();
      if (data.error) {
        setState({ status: 'error', error: data.error });
      } else {
        setState({ status: 'success', data });
      }
    } catch (err) {
      setState({ status: 'error', error: err.message });
    }
  }

  function handleReset() {
    setState({ status: 'idle' });
  }

  return (
    <div className="min-h-screen">
      <Header />
      <main className="py-12">
        <TickerInput onSubmit={handleSubmit} loading={state.status === 'loading'} />
        {state.status === 'loading' && <MemoSkeleton />}
        {state.status === 'success' && <Memo data={state.data} />}
        {state.status === 'error' && (
          <ErrorMessage message={state.error} onReset={handleReset} />
        )}
      </main>
    </div>
  );
}
