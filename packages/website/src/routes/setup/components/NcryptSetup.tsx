import { AnimatePresence, motion } from "framer-motion";
import { useContext, useEffect, useRef, useState } from "react";
import CardWrapper from "../../../components/CardWrapper";
import * as nip49 from "nostr-tools/nip49";
import { nip19 } from "nostr-tools";
import { NCSDK, NsecSigner } from "cashu-address-sdk";
import { SdkContext } from "../../../hooks/providers/SdkProvider";
import { useNavigate } from "react-router-dom";
import { hexToBytes } from "@noble/hashes/utils";

const hexRegex = /^[0-9a-fA-F]{64}$/g;

function NcryptSetup({
  setMethod,
}: {
  setMethod: React.Dispatch<
    React.SetStateAction<"ncrypt" | "nip46" | undefined>
  >;
}) {
  const [skInput, setSkInput] = useState("");
  const [sk, setSk] = useState<Uint8Array>();
  const [isValid, setIsValid] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);
  const passRef2 = useRef<HTMLInputElement>(null);
  const { setSdk } = useContext(SdkContext);
  const navigate = useNavigate();

  useEffect(() => {
    setIsValid(false);
    setError("");
    setSk(undefined);
    if (!skInput) {
      return;
    }
    const timer = setTimeout(() => {
      if (skInput.startsWith("ncryptsec")) {
        setIsValid(true);
      } else if (skInput.startsWith("nsec")) {
        try {
          const bytes = nip19.decode(skInput as `nsec1${string}`).data;
          setSk(bytes);
          setIsValid(true);
        } catch (e) {
          setError("Error while parsing");
        }
      } else if (skInput.match(hexRegex)) {
        const bytes = hexToBytes(skInput);
        setSk(bytes);
        setIsValid(true);
      } else {
        setError("Invalid private key. Expected nsec / ncrypt / hex");
      }
    }, 500);
    return () => {
      clearTimeout(timer);
    };
  }, [skInput]);

  async function loginHandler() {
    if (sk) {
      setError("");
      if (!passRef?.current || !passRef2.current) {
        return;
      }
      if (passRef.current.value !== passRef2.current.value) {
        setError("Passphrases do not match");
        return;
      }
      const encrypted = nip49.encrypt(sk!, passRef.current.value);
      localStorage.setItem("sdk-method", "ncrypt");
      localStorage.setItem("ncrypt-config", encrypted);
      const sdk = new NCSDK(
        import.meta.env.NPC_SERVER_URL,
        new NsecSigner(sk!),
      );
      navigate("/wallet");
      setSdk(sdk);
    } else {
      localStorage.setItem("sdk-method", "ncrypt");
      localStorage.setItem("ncrypt-config", skInput);
      navigate("/setup?unlock");
    }
  }

  return (
    <div className="w-full flex justify-center ">
      <CardWrapper>
        <h2>Login with nsec / ncrypt </h2>
        <div className="flex flex-col gap-2 w-full">
          <div className="flex w-full flex-col gap-1 justify-center">
            <label className="text-xs">Private Key</label>
            <input
              ref={inputRef}
              type="password"
              className="p-1 bg-zinc-900 rounded"
              onChange={(e) => {
                setSkInput(e.target.value);
              }}
              placeholder="nsec / ncrypt / hex"
            />
          </div>
          <AnimatePresence>
            {sk && isValid ? (
              <motion.div
                initial={{ opacity: 0, translateY: -50 }}
                animate={{ opacity: 1, translateY: 0 }}
                exit={{ opacity: 0 }}
                className="flex flex-col gap-1 "
              >
                <label className="text-xs">Choose Passphrase</label>
                <input
                  ref={passRef}
                  className="p-1 bg-zinc-900 rounded"
                  type="password"
                />

                <label className="text-xs">Confirm Passphrase</label>
                <input
                  ref={passRef2}
                  className="p-1 bg-zinc-900 rounded"
                  type="password"
                />
              </motion.div>
            ) : undefined}
          </AnimatePresence>
        </div>
        {error ? <p className="text-sm text-red-500">{error}</p> : undefined}
        <div className="flex flex-col gap-4">
          <button
            onClick={loginHandler}
            className="px-2 py-1 bg-purple-600 rounded disabled:bg-purple-400/50"
            disabled={!isValid}
          >
            Login
          </button>
          <button
            onClick={() => {
              setMethod(undefined);
            }}
            className="border-2 border-zinc-400 px-2 py-1 rounded"
          >
            Back
          </button>
        </div>
      </CardWrapper>
    </div>
  );
}

export default NcryptSetup;
