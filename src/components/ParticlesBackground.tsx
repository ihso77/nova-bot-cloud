import { motion } from 'framer-motion';

export default function ParticlesBackground() {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
      {/* Base gradient - subtle blue tint */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#020a1a] via-[#040d1f] to-[#030b18]" />

      {/* Large primary blue orb - top right */}
      <motion.div
        animate={{
          x: [0, 40, -30, 0],
          y: [0, -50, 25, 0],
          scale: [1, 1.3, 0.9, 1],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -top-[15%] -right-[5%] w-[70vw] h-[70vw] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(0, 43, 134, 0.35) 0%, rgba(0, 43, 134, 0.12) 40%, transparent 70%)',
          filter: 'blur(60px)',
        }}
      />

      {/* Secondary cyan-blue orb - bottom left */}
      <motion.div
        animate={{
          x: [0, -40, 25, 0],
          y: [0, 40, -30, 0],
          scale: [1, 0.9, 1.2, 1],
        }}
        transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -bottom-[15%] -left-[5%] w-[60vw] h-[60vw] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(0, 96, 255, 0.30) 0%, rgba(0, 96, 255, 0.10) 40%, transparent 70%)',
          filter: 'blur(70px)',
        }}
      />

      {/* Mid blue orb - center */}
      <motion.div
        animate={{
          x: [0, 25, -20, 0],
          y: [0, -25, 35, 0],
        }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-[30%] left-[25%] w-[40vw] h-[40vw] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(0, 64, 193, 0.25) 0%, rgba(0, 64, 193, 0.08) 40%, transparent 70%)',
          filter: 'blur(50px)',
        }}
      />

      {/* Small bright blue accent - top left */}
      <motion.div
        animate={{
          x: [0, -20, 30, 0],
          y: [0, 30, -15, 0],
          scale: [1, 1.15, 0.85, 1],
        }}
        transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-[10%] left-[15%] w-[25vw] h-[25vw] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(0, 96, 255, 0.20) 0%, transparent 65%)',
          filter: 'blur(40px)',
        }}
      />

      {/* Small cyan accent - bottom right */}
      <motion.div
        animate={{
          x: [0, 20, -10, 0],
          y: [0, -20, 15, 0],
          scale: [1, 0.85, 1.15, 1],
        }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute bottom-[20%] right-[10%] w-[30vw] h-[30vw] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(0, 64, 193, 0.22) 0%, transparent 65%)',
          filter: 'blur(45px)',
        }}
      />

      {/* Tiny bright spot - center right */}
      <motion.div
        animate={{
          x: [0, 15, -25, 0],
          y: [0, -15, 20, 0],
        }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-[50%] right-[20%] w-[18vw] h-[18vw] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(0, 120, 255, 0.18) 0%, transparent 60%)',
          filter: 'blur(35px)',
        }}
      />

      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0, 96, 255, 0.25) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 96, 255, 0.25) 1px, transparent 1px)
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
