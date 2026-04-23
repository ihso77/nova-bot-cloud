import { motion } from 'framer-motion';

export default function ParticlesBackground() {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
      {/* Base gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-background" />
      
      {/* Gradient orbs */}
      <motion.div
        animate={{
          x: [0, 30, -20, 0],
          y: [0, -40, 20, 0],
          scale: [1, 1.2, 0.9, 1],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -top-[20%] -right-[10%] w-[60vw] h-[60vw] rounded-full"
        style={{
          background: 'radial-gradient(circle, hsl(215 90% 55% / 0.12) 0%, transparent 70%)',
          filter: 'blur(80px)',
        }}
      />
      <motion.div
        animate={{
          x: [0, -30, 20, 0],
          y: [0, 30, -20, 0],
          scale: [1, 0.9, 1.15, 1],
        }}
        transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -bottom-[20%] -left-[10%] w-[50vw] h-[50vw] rounded-full"
        style={{
          background: 'radial-gradient(circle, hsl(195 85% 55% / 0.10) 0%, transparent 70%)',
          filter: 'blur(80px)',
        }}
      />
      <motion.div
        animate={{
          x: [0, 20, -15, 0],
          y: [0, -20, 30, 0],
        }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-[40%] left-[30%] w-[30vw] h-[30vw] rounded-full"
        style={{
          background: 'radial-gradient(circle, hsl(215 90% 55% / 0.06) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }}
      />

      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(hsl(215 90% 55% / 0.3) 1px, transparent 1px),
            linear-gradient(90deg, hsl(215 90% 55% / 0.3) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />

      {/* Top fade */}
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-background to-transparent" />
      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
    </div>
  );
}
