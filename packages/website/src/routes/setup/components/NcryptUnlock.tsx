import { motion } from "framer-motion";
import { useContext, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as nip49 from "nostr-tools/nip49";
import { NCSDK, NsecSigner } from "cashu-address-sdk";
import { SdkContext } from "../../../hooks/providers/SdkProvider";

function NcryptUnlock() {
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { setSdk } = useContext(SdkContext);
  return (
    <motion.div
      initial={{ opacity: 0, translateX: -100 }}
      animate={{ opacity: 1, translateX: 0 }}
      exit={{ opacity: 0, translateX: 100 }}
      className="flex flex-col justify-center items-center gap-4 p-4 bg-zinc-800 rounded container max-w-md mx-4"
    >
      <h2>Enter your passphrase</h2>
      <div className="flex w-full flex-col justify-center gap-2">
        <input
          ref={inputRef}
          className="p-1 bg-zinc-900 rounded"
          type="password"
        />
      </div>
      {error ? <p className="text-sm text-red-500">{error}</p> : undefined}
      <div className="flex flex-col gap-4">
        <button
          onClick={() => {
            try {
              const ncrypt = localStorage.getItem("ncrypt-config");
              if (!ncrypt) {
                throw new Error("No config found...");
              }
              try {
                const decrypted = nip49.decrypt(
                  ncrypt,
                  inputRef.current!.value,
                );
                const sdk = new NCSDK(
                  import.meta.env.NPC_SERVER_URL,
                  new NsecSigner(decrypted),
                );
                setSdk(sdk);
                navigate("/wallet");
              } catch {
                throw new Error(
                  "Failed to decrypt. Did you enter the right passphrase?",
                );
              }
            } catch (e) {
              if (e instanceof Error) {
                setError(e.message);
              }
            }
          }}
          className="px-2 py-1 bg-purple-600 from-purple-500 to-pink-500 rounded"
        >
          Unlock
        </button>
        <button
          onClick={() => {
            navigate("/setup");
          }}
          className="border-2 border-zinc-400 px-2 py-1 rounded"
        >
          Back
        </button>
      </div>
    </motion.div>
  );
}

export default NcryptUnlock;
