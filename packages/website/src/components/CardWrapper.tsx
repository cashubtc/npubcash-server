import { motion } from "framer-motion";
import { ReactNode } from "react";
import { useLocation } from "react-router-dom";

function CardWrapper({ children }: { children: ReactNode }) {
  const location = useLocation();
  return (
    <motion.main
      className="relative p-0.5 w-full mx-4 md:max-w-md shadow-lg bg-gradient-to-tr from-purple-500 to-pink-500 rounded-xl items-center mt-6"
      initial={{ opacity: 0, translateX: -50 }}
      animate={{ opacity: 1, translateX: 0 }}
      exit={{ opacity: 0, translateX: 50 }}
      key={location.pathname}
    >
      <div className="bg-zinc-800 p-8 flex flex-col gap-8 rounded-xl items-center">
        {children}
      </div>
    </motion.main>
  );
}

export default CardWrapper;
