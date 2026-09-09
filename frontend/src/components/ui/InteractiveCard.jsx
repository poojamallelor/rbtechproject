import React, { useState, useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

export default function InteractiveCard({ children, className = '' }) {
  const ref = useRef(null);
  const [isHovered, setIsHovered] = useState(false);
  
  // Mouse position relative to center of card
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  
  // Smooth out the movement
  const mouseXSpring = useSpring(x, { stiffness: 150, damping: 20 });
  const mouseYSpring = useSpring(y, { stiffness: 150, damping: 20 });
  
  // Transform mouse position to rotation
  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["5deg", "-5deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-5deg", "5deg"]);

  const handleMouseMove = (e) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    
    // Normalize mouse position from -0.5 to 0.5
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    x.set(mouseX / width - 0.5);
    y.set(mouseY / height - 0.5);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX,
        rotateY,
        transformStyle: "preserve-3d"
      }}
      whileHover={{ scale: 1.02 }}
      className={`relative rounded-xl bg-surface border border-white/10 overflow-hidden shadow-2xl transition-shadow duration-300 ${isHovered ? 'shadow-accent/20' : ''} ${className}`}
    >
      {/* Animated glowing border effect */}
      <motion.div 
        className="absolute inset-0 pointer-events-none rounded-xl"
        style={{
          background: isHovered 
            ? 'radial-gradient(400px circle at calc(50% + ' + x.get() * 400 + 'px) calc(50% + ' + y.get() * 400 + 'px), rgba(139, 92, 246, 0.15), transparent 40%)' 
            : 'none'
        }}
      />
      
      {/* Subtle top highlight */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-50" />
      
      <div className="relative z-10" style={{ transform: "translateZ(20px)" }}>
        {children}
      </div>
    </motion.div>
  );
}
