import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import WaveTransition from './WaveTransition';

interface WaveTransitionContextValue {
  waveNavigate: (path: string) => void;
}

const WaveTransitionContext =
  createContext<WaveTransitionContextValue | null>(null);

export function WaveTransitionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const [transitioning, setTransitioning] = useState(false);

  function waveNavigate(path: string) {
    if (transitioning) return;

    setTransitioning(true);

    // Change page while the wave is covering the screen.
    setTimeout(() => {
      navigate(path);
    }, 760);

    // Remove the transition after the wave has passed.
    setTimeout(() => {
      setTransitioning(false);
    }, 1800);
  }

  return (
    <WaveTransitionContext.Provider value={{ waveNavigate }}>
      {children}

      {transitioning && <WaveTransition />}
    </WaveTransitionContext.Provider>
  );
}

export function useWaveTransition() {
  const context = useContext(WaveTransitionContext);

  if (!context) {
    throw new Error(
      'useWaveTransition must be used inside WaveTransitionProvider'
    );
  }

  return context;
}