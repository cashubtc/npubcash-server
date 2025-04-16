import { useContext, useEffect, useState } from "react";
import { SdkContext } from "../../../hooks/providers/SdkProvider";

function Balance() {
  const [balance, setBalance] = useState<number>();
  const [error, setError] = useState<string>();
  const { sdk } = useContext(SdkContext);
  useEffect(() => {
    if (sdk) {
      sdk
        .getBalance()
        .then((data) => setBalance(data))
        .catch((err) => setError(err));
    }
  }, [sdk]);
  if (error) {
    return (
      <div className="p-2 bg-zinc-800 rounded w-full m-2 max-w-xl flex flex-col items-center">
        <p>Unable to get balance...</p>
      </div>
    );
  }
  return (
    <div className="flex bg-zinc-800 p-2 py-4 rounded">
      <p className="flex items-start gap-2 jutext text-zinc-50 text-white inline-block rounded font-bold text-5xl bg-clip-text shadow-black">
        {`${balance ? balance : 0}`}
        <span className="text-lg text-zinc-500">
          {balance && balance > 1 ? "SATS" : "SAT"}
        </span>
      </p>
    </div>
  );
}

export default Balance;
