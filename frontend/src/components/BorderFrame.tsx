import type { ReactNode } from 'react';
import { BORDER_ART_SCALE, borderLayerUrl, isBorderKey, type BorderShape } from '../lib/borders';

interface Props {
  // The equipped reward's css_class (a key of BORDERS). Anything else - null,
  // or an unknown/retired value - draws no border at all.
  border: string | null | undefined;
  shape: BorderShape;
  // Sizing/margin classes for the wrapper, e.g. "h-28 w-28". The picture
  // (children) fills it; the border art is drawn around and over it, so give
  // it some breathing room - the decoration reaches about 60% of the
  // picture's width beyond each edge.
  className?: string;
  // Extra spacing (e.g. "m-3") added ONLY when a border is present, so the
  // decoration has room in tight lists without leaving gaps for people who
  // have no border.
  reserve?: string;
  children: ReactNode;
}

// Wraps an avatar (shape="circle") or a song marker (shape="square") with its
// animated border. The art never intercepts clicks.
export default function BorderFrame({ border, shape, className = '', reserve = '', children }: Props) {
  const key = isBorderKey(border) ? border : null;
  return (
    <div className={`relative shrink-0 ${className} ${key ? reserve : ''}`}>
      {children}
      {key && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 aspect-square -translate-x-1/2 -translate-y-1/2"
          style={{ width: `${BORDER_ART_SCALE * 100}%` }}
        >
          {([2, 1] as const).map((layer) => (
            <span key={layer} className={`wl-border-move wl-border-${shape}-${layer} absolute inset-0`}>
              <img
                src={borderLayerUrl(key, shape, layer)}
                alt=""
                draggable={false}
                className={`wl-border-breathe wl-border-breathe-${layer} h-full w-full select-none`}
              />
            </span>
          ))}
        </span>
      )}
    </div>
  );
}
