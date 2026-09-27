import { motion } from 'framer-motion';

const bubbles = [
  { x: 3, y: 82, size: 80, delay: 0.00, drift: 16 },
  { x: 10, y: 55, size: 150, delay: 0.05, drift: -12 },
  { x: 6, y: 18, size: 95, delay: 0.11, drift: 14 },

  { x: 19, y: 91, size: 230, delay: 0.02, drift: 18 },
  { x: 24, y: 39, size: 120, delay: 0.09, drift: -15 },
  { x: 31, y: 11, size: 175, delay: 0.14, drift: 13 },

  { x: 37, y: 72, size: 285, delay: 0.04, drift: -18 },
  { x: 45, y: 33, size: 165, delay: 0.12, drift: 17 },
  { x: 50, y: 88, size: 115, delay: 0.06, drift: -12 },

  { x: 58, y: 55, size: 250, delay: 0.08, drift: 17 },
  { x: 63, y: 14, size: 135, delay: 0.15, drift: -13 },

  { x: 71, y: 85, size: 205, delay: 0.03, drift: 14 },
  { x: 78, y: 42, size: 300, delay: 0.10, drift: -18 },

  { x: 88, y: 68, size: 155, delay: 0.06, drift: 13 },
  { x: 94, y: 22, size: 205, delay: 0.13, drift: -12 },

  // Gap fillers
  { x: 15, y: 19, size: 48, delay: 0.08, drift: 8 },
  { x: 29, y: 62, size: 58, delay: 0.13, drift: -8 },
  { x: 43, y: 94, size: 42, delay: 0.05, drift: 9 },
  { x: 54, y: 19, size: 64, delay: 0.11, drift: -9 },
  { x: 69, y: 48, size: 46, delay: 0.16, drift: 7 },
  { x: 84, y: 10, size: 55, delay: 0.09, drift: -8 },
  { x: 97, y: 89, size: 68, delay: 0.12, drift: 9 },
];

const tinyBubbles = [
  { x: 8, delay: 0.02, size: 12 },
  { x: 17, delay: 0.09, size: 7 },
  { x: 28, delay: 0.04, size: 15 },
  { x: 39, delay: 0.12, size: 9 },
  { x: 51, delay: 0.06, size: 13 },
  { x: 62, delay: 0.15, size: 7 },
  { x: 73, delay: 0.03, size: 11 },
  { x: 84, delay: 0.10, size: 16 },
  { x: 94, delay: 0.07, size: 8 },
];

export default function WaveTransition() {
  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Underwater cover */}
      <motion.div
        className="
          absolute inset-0
          bg-gradient-to-b
          from-[#0b5b7d]
          via-[#064263]
          to-[#02182b]
        "
        initial={{ opacity: 0 }}
        animate={{
          opacity: [0, 0, 1, 1, 1, 0],
        }}
        transition={{
          duration: 1.75,
          times: [0, 0.25, 0.40, 0.66, 0.76, 1],
          ease: 'easeInOut',
        }}
      />

      {/* Soft light from water surface */}
      <motion.div
        className="
          absolute -top-[30%] left-1/2
          h-[70vh] w-[110vw]
          -translate-x-1/2
          rounded-[50%]
          bg-cyan-200/10
          blur-[90px]
        "
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.9, 0.7, 0] }}
        transition={{
          duration: 1.75,
          times: [0, 0.38, 0.7, 1],
        }}
      />

      {/* Light shafts */}
      <motion.div
        className="
          absolute -top-40 left-[22%]
          h-[90vh] w-24 rotate-[14deg]
          bg-gradient-to-b
          from-cyan-100/10
          to-transparent
          blur-xl
        "
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.7, 0.4, 0] }}
        transition={{ duration: 1.75 }}
      />

      <motion.div
        className="
          absolute -top-40 right-[25%]
          h-[85vh] w-32 rotate-[18deg]
          bg-gradient-to-b
          from-sky-100/[0.08]
          to-transparent
          blur-2xl
        "
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.6, 0.3, 0] }}
        transition={{ duration: 1.75, delay: 0.05 }}
      />

      {/* Main bubble field */}
      {bubbles.map((bubble, index) => (
        <motion.div
          key={index}
          className="absolute"
          style={{
            left: `${bubble.x}%`,
            top: `${bubble.y}%`,
            width: bubble.size,
            height: bubble.size,
            marginLeft: -bubble.size / 2,
            marginTop: -bubble.size / 2,
          }}
          initial={{
            scale: 0,
            opacity: 0,
            y: 45,
          }}
          animate={{
            scale: [0, 0.12, 0.75, 1.25, 2.15],
            opacity: [0, 0.85, 1, 0.95, 0],
            x: [
              0,
              bubble.drift,
              -bubble.drift * 0.35,
              bubble.drift * 0.2,
            ],
            y: [45, 12, -12, -42, -90],
            rotate: [0, 3, -2, 2],
          }}
          transition={{
            duration: 1.3,
            delay: bubble.delay,
            ease: [0.16, 1, 0.3, 1],
          }}
        >
          <div
            className="
              relative h-full w-full
              rounded-[48%_52%_46%_54%/52%_46%_54%_48%]
              border border-cyan-50/50
              bg-gradient-to-br
              from-white/18
              via-cyan-200/12
              to-blue-500/16
              shadow-[inset_10px_12px_22px_rgba(255,255,255,0.15),inset_-12px_-16px_26px_rgba(0,20,60,0.18),0_0_20px_rgba(103,232,249,0.13)]
              backdrop-blur-[2px]
            "
          >
            {/* Curved glass reflection */}
            <div
              className="
                absolute left-[15%] top-[12%]
                h-[24%] w-[40%]
                -rotate-[28deg]
                rounded-[50%]
                border-t-2 border-white/60
                bg-white/10
              "
            />

            {/* Bright specular point */}
            <div
              className="
                absolute right-[20%] top-[24%]
                h-[7%] w-[7%]
                rounded-full bg-white/65
              "
            />

            {/* Bottom rim */}
            <div
              className="
                absolute bottom-[11%] right-[16%]
                h-[18%] w-[31%]
                -rotate-[20deg]
                rounded-[50%]
                border-b border-cyan-100/30
              "
            />
          </div>
        </motion.div>
      ))}

      {/* Fast tiny rising bubbles */}
      {tinyBubbles.map((bubble, index) => (
        <motion.div
          key={`tiny-${index}`}
          className="
            absolute rounded-full
            border border-cyan-50/50
            bg-white/[0.06]
            shadow-[inset_2px_2px_4px_rgba(255,255,255,0.25)]
          "
          style={{
            left: `${bubble.x}%`,
            bottom: -30,
            width: bubble.size,
            height: bubble.size,
          }}
          initial={{
            y: 0,
            opacity: 0,
          }}
          animate={{
            y: [0, -350, -750, -1150],
            x: [
              0,
              index % 2 === 0 ? 18 : -18,
              index % 2 === 0 ? -8 : 8,
            ],
            opacity: [0, 0.75, 0.6, 0],
          }}
          transition={{
            duration: 1.45,
            delay: bubble.delay,
            ease: 'easeOut',
          }}
        />
      ))}

      {/* Expanding water ripple */}
      <motion.div
        className="
          absolute left-1/2 top-1/2
          h-24 w-24
          -translate-x-1/2 -translate-y-1/2
          rounded-full
          border-2 border-cyan-100/25
        "
        initial={{
          scale: 0,
          opacity: 0,
        }}
        animate={{
          scale: [0, 0, 1, 10],
          opacity: [0, 0, 0.45, 0],
        }}
        transition={{
          duration: 1.75,
          times: [0, 0.35, 0.48, 0.82],
          ease: 'easeOut',
        }}
      />

      {/* Final soft reveal */}
      <motion.div
        className="absolute inset-0 bg-cyan-100/[0.04]"
        initial={{ opacity: 0 }}
        animate={{
          opacity: [0, 0, 0.7, 0],
        }}
        transition={{
          duration: 1.75,
          times: [0, 0.60, 0.72, 1],
          ease: 'easeOut',
        }}
      />
    </motion.div>
  );
}