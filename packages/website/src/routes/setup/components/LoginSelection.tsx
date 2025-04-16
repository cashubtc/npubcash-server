import { useContext, useState } from "react";
import { SdkContext } from "../../../hooks/providers/SdkProvider";
import { useNavigate } from "react-router-dom";
import { NCSDK, Nip07Signer } from "cashu-address-sdk";
import { FaShield, FaSignature } from "react-icons/fa6";
import AlbyModal from "../../../components/AlbyModal";
import { motion } from "framer-motion";

function LoginSelection({
  setMethod,
}: {
  setMethod: React.Dispatch<
    React.SetStateAction<"ncrypt" | "nip46" | undefined>
  >;
}) {
  const [modal, setModal] = useState(false);
  const { setSdk } = useContext(SdkContext);
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, translateX: -100 }}
      animate={{ opacity: 1, translateX: 0 }}
      exit={{ opacity: 0, translateX: 100 }}
      className="flex flex-col justify-center items-center gap-4 p-4 bg-zinc-800 rounded shadow-lg"
    >
      <h1>Choose a Login Method</h1>
      <div className="flex w-full flex-col justify-center gap-2">
        <button
          className="flex items-center justify-center gap-2 bg-pink-600 font-bold px-2 py-1 rounded hover:bg-pink-700 active:bg-pink-700"
          onClick={() => {
            if (!window.nostr?.signEvent) {
              setModal(true);
              return;
            }
            const sdk = new NCSDK(
              import.meta.env.NPC_SERVER_URL,
              new Nip07Signer(),
            );
            localStorage.setItem("sdk-method", "nip07");
            setSdk(sdk);
            navigate("/wallet");
          }}
        >
          <FaSignature />
          NIP-07
        </button>
        <button
          className="flex items-center justify-center gap-2 font-bold bg-fuchsia-600 px-2 py-1 rounded hover:bg-fuchsia-700 active:bg-fuchsia-700"
          onClick={() => {
            setMethod("nip46");
          }}
        >
          <FaShield />
          NIP-46
        </button>
        <button
          className="flex items-center justify-center gap-2 font-bold bg-purple-600 px-2 py-1 rounded hover:bg-purple-700 active:bg-purple-700"
          onClick={() => {
            setMethod("ncrypt");
          }}
        >
          <FaShield />
          nsec / ncrypt
        </button>
      </div>
      <AlbyModal isOpen={modal} />
    </motion.div>
  );
}

export default LoginSelection;
