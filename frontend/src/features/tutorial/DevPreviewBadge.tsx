import { exitPreviewMode, PREVIEW_MODE } from '../../lib/devPreview';

// Small floating toolbar shown only in DEV preview mode.
export default function DevPreviewBadge({ onReplayTutorial }: { onReplayTutorial: () => void }) {
  if (!import.meta.env.DEV || !PREVIEW_MODE) return null;
  return (
    <div className="fixed bottom-3 left-3 z-50 flex items-center gap-2 rounded-full border border-amber-400/40 bg-[#02182b]/90 px-3 py-1.5 text-xs text-amber-200 shadow-lg backdrop-blur">
      <span className="font-semibold">DEV PREVIEW</span>
      <span className="text-amber-200/50">fake login + data</span>
      <button type="button" onClick={onReplayTutorial} className="rounded-full bg-amber-400/15 px-2 py-0.5 font-medium hover:bg-amber-400/25">
        Replay tutorial
      </button>
      <button type="button" onClick={exitPreviewMode} className="rounded-full px-2 py-0.5 font-medium text-amber-200/70 hover:text-amber-100">
        Exit
      </button>
    </div>
  );
}
