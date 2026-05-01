import { motion } from 'framer-motion';

const variants = {
  initial: { opacity: 0 },
  enter:   { opacity: 1 },
  exit:    { opacity: 0 },
};

export default function PageTransition({ children, className = '' }) {
  return (
    <motion.div
      initial="initial"
      animate="enter"
      exit="exit"
      variants={variants}
      transition={{ duration: 0.12, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
