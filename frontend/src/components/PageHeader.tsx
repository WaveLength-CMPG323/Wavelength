import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function PageHeader({ title }: { title: string }) {
  const navigate = useNavigate();
  return (
    <div className="flex items-center gap-3 border-b border-cyan-500/20 bg-[#02182b] px-4 py-3">
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium text-cyan-200 hover:bg-cyan-500/10"
        type="button"
      >
        <ArrowLeft className="h-4 w-4" />
        Home
      </button>
      <span className="text-base font-semibold text-cyan-100">{title}</span>
    </div>
  );
}
