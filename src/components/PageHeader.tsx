import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function PageHeader({ title }: { title: string }) {
  const navigate = useNavigate();

  return (
    <header className="px-5 pt-4">
      <div
        className="
          mx-auto flex min-h-16 w-full items-center gap-4
          rounded-2xl border border-cyan-400/20
          bg-[#071330]/40 px-5 py-3
          text-white
          shadow-[0_12px_40px_rgba(2,10,25,0.4)]
          backdrop-blur-xl
        "
      >
        {/* Back to Ocean */}
        <button
          type="button"
          onClick={() => navigate('/')}
          className="
            flex items-center gap-2 rounded-full
            px-3 py-2
            text-sm font-medium text-cyan-100/80
            transition
            hover:bg-cyan-500/10 hover:text-white
          "
        >
          <ArrowLeft className="h-4 w-4" />
          Home
        </button>

        {/* Divider */}
        <div className="h-6 w-px bg-cyan-400/20" />

        {/* Current section */}
        <div>
          <p className="text-base font-semibold tracking-wide text-white">
            {title}
          </p>
          <p className="text-[11px] text-cyan-200/60">
            WaveLength
          </p>
        </div>

        {/* Brand mark */}
        <div
          className="
            ml-auto flex h-10 w-10 items-center justify-center
            rounded-full border border-cyan-300/30
            bg-cyan-400/10
            shadow-[0_0_12px_rgba(34,211,238,0.2)]
          "
        >
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M2 14c2-3 4-3 6 0s4 3 6 0 4-3 6 0"
              stroke="#38bdf8"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>
    </header>
  );
}