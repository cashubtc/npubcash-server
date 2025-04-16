import { useContext, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { SdkContext } from "../../hooks/providers/SdkProvider";
import Button from "../../components/Button";
import WarningBox from "../../components/WarningBox";
import { getDecodedToken } from "@cashu/cashu-ts";
import QRCodeElement from "../wallet/components/QRCodeElement";
import CoinButton from "../../components/CoinButton";
import { FaCopy } from "react-icons/fa6";

function ClaimRoute() {
  const [token, setToken] = useState<string>();
  const decodedToken = useMemo(() => {
    if (token) {
      return getDecodedToken(token);
    }
  }, [token]);
  const [totalPending, setTotalPending] = useState<number>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [, setParams] = useSearchParams();
  const { sdk } = useContext(SdkContext);
  const navigate = useNavigate();

  async function copyHandler() {
    if (!token) {
      return;
    }
    try {
      await navigator.clipboard.writeText(token);
    } catch (error) {
      console.error(error);
    }
  }

  useEffect(() => {
    if (sdk) {
      sdk
        .getTokenAndCount()
        .then((data) => {
          setToken(data.token);
          setTotalPending(data.totalPending);
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [sdk]);

  if (loading) {
    return (
      <div className="size-full flex flex-col gap-2 justify-center items-center">
        <p className="text-white animate-pulse">Loading Token...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="size-full flex flex-col gap-2 justify-center items-center">
        <p className="text-white">{error}</p>
        <Button
          text="Back"
          onClick={() => {
            navigate("/wallet");
          }}
        />
      </div>
    );
  }

  if (token && decodedToken && totalPending) {
    const proofs = decodedToken.token.map((t) => t.proofs).flat();
    const amount = proofs.reduce((a, c) => a + c.amount, 0);
    return (
      <div className="size-full flex flex-col gap-4 justify-center items-center">
        {totalPending > 100 ? (
          <WarningBox
            text={`Attention: Too many proofs to claim at once. Claiming ${amount} SATS (100 of ${totalPending} proofs pending).`}
          />
        ) : undefined}
        <div>
          <QRCodeElement value={token} />
          <p className="text-center text-zinc-500 text-xs">
            Long-press for QR options
          </p>
        </div>
        <div>
          <div className="max-h-20 p-2 text-[8px] max-w-xs lg:max-w-lg bg-zinc-900 break-words overflow-auto rounded overflow-x-hidden text-zinc-500">
            <p>{token}</p>
          </div>
          <div className="flex gap-2 w-full justify-around mt-4 text-white">
            <CoinButton
              icon={<FaCopy style={{ fill: "white" }} />}
              title="Copy"
              onClick={copyHandler}
            />
            <CoinButton
              icon={<FaCopy style={{ fill: "white" }} />}
              title="Open In Wallet"
              onClick={() => {
                window.location.href = `cashu:${token}`;
              }}
            />
          </div>
        </div>
        <Button
          text="Close"
          onClick={() => {
            setParams(undefined);
          }}
        />
      </div>
    );
  }
}

export default ClaimRoute;
