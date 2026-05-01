import { motion } from 'framer-motion';

const variants = {
  initial: { opacity: 0, y: 8 },
  enter: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
};

export default function PageTransition({ children, className = '' }) {
  return (
    <motion.div
      initial="initial"
      animate="enter"
      exit="exit"
      variants={variants}
      transition={{ duration: 0.24, ease: [0.32, 0.72, 0.32, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
