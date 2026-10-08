import {
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react';
import {
  AnimatePresence,
  motion,
  type HTMLMotionProps,
} from 'framer-motion';

interface OceanButtonProps extends HTMLMotionProps<'button'> {
  children: ReactNode;
}

export default function OceanButton({
  children,
  className = '',
  onMouseEnter,
  ...props
}: OceanButtonProps) {
  const [animation, setAnimation] = useState(0);

  function handleMouseEnter(event: MouseEvent<HTMLButtonElement>) {
    setAnimation((current) => (current + 1) % 3);

    if (onMouseEnter) {
      onMouseEnter(event);
    }
  }

  return (
    <motion.button
      {...props}
      type={props.type ?? 'button'}
      onMouseEnter={handleMouseEnter}
      whileTap={{ scale: 0.94 }}
      className={`
        relative isolate overflow-visible
        rounded-full px-3 py-2
        text-sm font-medium text-wl-cyan/80
        transition-colors
        hover:bg-cyan-500/10 hover:text-wl-title
        ${className}
      `}
    >
      {/* Ripple */}
      <AnimatePresence>
        {animation === 1 && (
          <motion.span
            key="ripple"
            className="
              pointer-events-none absolute
              left-1/2 top-1/2 -z-10
              h-8 w-8
              -translate-x-1/2 -translate-y-1/2
              rounded-full border border-cyan-300/50
            "
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{
              scale: [0.4, 1.4, 2.2],
              opacity: [0, 0.65, 0],
            }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 0.75,
              ease: 'easeOut',
            }}
          />
        )}
      </AnimatePresence>

      {/* Bubbles */}
      <AnimatePresence>
        {animation === 2 && (
          <>
            <motion.span
              key="bubble-one"
              className="
                pointer-events-none absolute
                right-1 top-1
                h-2.5 w-2.5
                rounded-full
                border border-cyan-100/70
                bg-cyan-200/10
              "
              initial={{
                y: 4,
                scale: 0,
                opacity: 0,
              }}
              animate={{
                y: -20,
                x: 5,
                scale: [0, 1, 0.75],
                opacity: [0, 0.9, 0],
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
            />

            <motion.span
              key="bubble-two"
              className="
                pointer-events-none absolute
                right-6 top-2
                h-1.5 w-1.5
                rounded-full
                border border-sky-100/60
                bg-white/10
              "
              initial={{
                y: 3,
                scale: 0,
                opacity: 0,
              }}
              animate={{
                y: -15,
                x: -4,
                scale: [0, 1, 0.7],
                opacity: [0, 0.8, 0],
              }}
              exit={{ opacity: 0 }}
              transition={{
                duration: 0.7,
                delay: 0.08,
              }}
            />

            <motion.span
              key="bubble-three"
              className="
                pointer-events-none absolute
                right-3 top-3
                h-1 w-1
                rounded-full
                border border-cyan-100/60
              "
              initial={{
                scale: 0,
                opacity: 0,
              }}
              animate={{
                y: -12,
                x: -8,
                scale: [0, 1, 0],
                opacity: [0, 0.7, 0],
              }}
              exit={{ opacity: 0 }}
              transition={{
                duration: 0.6,
                delay: 0.15,
              }}
            />
          </>
        )}
      </AnimatePresence>

      {/* Water shine */}
      <AnimatePresence>
        {animation === 0 && (
          <motion.span
            key="shine"
            className="
              pointer-events-none absolute
              inset-y-1 -left-5
              w-4 rotate-[18deg]
              bg-gradient-to-r
              from-transparent
              via-cyan-100/30
              to-transparent
              blur-sm
            "
            initial={{
              x: 0,
              opacity: 0,
            }}
            animate={{
              x: 100,
              opacity: [0, 0.9, 0],
            }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 0.65,
              ease: 'easeOut',
            }}
          />
        )}
      </AnimatePresence>

      {/* Button contents */}
      <motion.span
        className="relative z-10 flex items-center gap-2"
        animate={
          animation === 2
            ? {
                y: [0, -2, 0],
              }
            : animation === 1
              ? {
                  scale: [1, 1.05, 1],
                }
              : {
                  x: [0, 1.5, 0],
                }
        }
        transition={{
          duration: 0.45,
          ease: 'easeOut',
        }}
      >
        {children}
      </motion.span>
    </motion.button>
  );
}