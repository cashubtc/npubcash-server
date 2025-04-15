import { ReactNode } from "react";
import { motion } from "framer-motion";

function ModalWrapper({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="inset-0 bg-black opacity-80 fixed " />
      <div className="fixed inset-0 w-full flex justify-center items-center">
        <motion.dialog
          open
          className="flex flex-col justify-center items-center p-8 rounded bg-zinc-800"
          initial={{ opacity: 0, translateY: -50 }}
          animate={{ opacity: 1, translateY: 0 }}
          exit={{ opacity: 0, translateY: 50 }}
        >
          {children}
        </motion.dialog>
      </div>
    </>
  );
}

export default ModalWrapper;
