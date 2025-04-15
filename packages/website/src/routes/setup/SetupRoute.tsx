import { useState } from "react";
import LoginSelection from "./components/LoginSelection";
import ConnectSigner from "./components/ConnectSigner";
import { motion } from "framer-motion";
import { useLocation, useSearchParams } from "react-router-dom";
import NcryptUnlock from "./components/NcryptUnlock";
import NcryptSetup from "./components/NcryptSetup";

function SetupRoute() {
  const [method, setMethod] = useState<"nip46" | "ncrypt" | undefined>();
  const [params] = useSearchParams();
  const unlock = params.has("unlock");
  const location = useLocation();

  let content;
  if (unlock) {
    content = <NcryptUnlock />;
  } else if (method === "nip46") {
    content = <ConnectSigner setMethod={setMethod} />;
  } else if (method === "ncrypt") {
    content = <NcryptSetup setMethod={setMethod} />;
  } else {
    content = <LoginSelection setMethod={setMethod} />;
  }

  return (
    <motion.main
      initial={{ opacity: 0, translateX: -100 }}
      animate={{ opacity: 1, translateX: 0 }}
      exit={{ opacity: 0, translateX: 100 }}
      className="flex justify-center items-center mt-16 w-full"
      key={location.pathname}
    >
      {content}
    </motion.main>
  );
}

export default SetupRoute;
