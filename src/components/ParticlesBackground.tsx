import { motion } from 'framer-motion';

export default function ParticlesBackground() {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
      {/* Base gradient - subtle blue tint */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#020a1a] via-[#040d1f] to-[#030b18]" />

      {/* Large primary blue orb - top right */}
      <motion.div
        animate={{
          x: [0, 30, -20, 0],
          y: [0, -40, 20, 0],
          scale: [1, 1.2, 0.9, 1],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -top-[20%] -right-[10%] w-[60vw] h-[60vw] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(0, 43, 134, 0.18) 0%, transparent 70%)',
          filter: 'blur(80px)',
        }}
      />

      {/* Secondary blue orb - bottom left */}
      <motion.div
        animate={{
          x: [0, -30, 20, 0],
          y: [0, 30, -20, 0],
          scale: [1, 0.9, 1.15, 1],
        }}
        transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -bottom-[20%] -left-[10%] w-[50vw] h-[50vw] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(0, 96, 255, 0.15) 0%, transparent 70%)',
          filter: 'blur(80px)',
        }}
      />

      {/* Mid blue orb - center left */}
      <motion.div
        animate={{
          x: [0, 20, -15, 0],
          y: [0, -20, 30, 0],
        }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-[35%] left-[20%] w-[30vw] h-[30vw] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(0, 64, 193, 0.10) 0%, transparent 65%)',
          filter: 'blur(60px)',
        }}
      />

      {/* Small accent - bottom right */}
      <motion.div
        animate={{
          x: [0, 15, -10, 0],
          y: [0, -15, 12, 0],
          scale: [1, 1.1, 0.9, 1],
        }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute bottom-[15%] right-[15%] w-[22vw] h-[22vw] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(0, 80, 255, 0.08) 0%, transparent 60%)',
          filter: 'blur(50px)',
        }}
      />

      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0, 96, 255, 0.2) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 96, 255, 0.2) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />

      {/* Top fade */}
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-[#020a1a] to-transparent" />
      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#020a1a] to-transparent" />
    </div>
  );
}
