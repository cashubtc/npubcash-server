import { Proof, getEncodedToken } from "@cashu/cashu-ts";
import { SdkContext } from "../../../hooks/providers/SdkProvider";
import { useContext, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useStopScroll } from "../../../hooks/useStopScroll";
import ModalWrapper from "../../../components/ModalWrapper";
import Button from "../../../components/Button";
import QRCodeElement from "../../wallet/components/QRCodeElement";
import CoinButton from "../../../components/CoinButton";
import { FaCopy } from "react-icons/fa6";
import { createPortal } from "react-dom";

function WithdrawalDetails({ id }: { id: string }) {
  const [proofs, setProofs] = useState<Proof[]>();
  const [mintUrl, setMintUrl] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [, setParams] = useSearchParams();
  const { sdk } = useContext(SdkContext);

  useStopScroll();

  useEffect(() => {
    if (sdk) {
      sdk
        .getWithdrawlDetails(parseInt(id))
        .then((data) => {
          setProofs(data.proofs);
          setMintUrl(data.mintUrl);
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [sdk]);

  if (loading) {
    return (
      <ModalWrapper>
        <div className="flex flex-col gap-2 items-center">
          <p className="text-white">Loading Token...</p>
          <Button text="Close" onClick={() => setParams(undefined)} />
        </div>
      </ModalWrapper>
    );
  }

  if (error) {
    return (
      <ModalWrapper>
        <div className="flex flex-col gap-2 items-center">
          <p className="text-white">{error}</p>
          <Button text="Close" onClick={() => setParams(undefined)} />
        </div>
      </ModalWrapper>
    );
  }

  if (!proofs || proofs.length < 1 || !mintUrl) {
    return (
      <ModalWrapper>
        <div className="flex flex-col gap-2 items-center">
          <p className="text-white">{error}</p>
          <Button text="Close" onClick={() => setParams(undefined)} />
        </div>
      </ModalWrapper>
    );
  }

  const token = getEncodedToken({
    memo: "",
    token: [{ mint: mintUrl, proofs: proofs }],
  });

  return (
    <ModalWrapper>
      <div className="flex flex-col gap-4 items-center">
        <div>
          <QRCodeElement value={token} />
          <p className="text-center text-zinc-500 text-xs">
            Long-press for QR options
          </p>
        </div>
        <div>
          <div className="max-h-20 p-2 text-xs max-w-xs lg:max-w-lg bg-zinc-900 break-words overflow-auto rounded overflow-x-hidden text-white font-xs">
            <p>{token}</p>
          </div>
          <div className="flex gap-2 w-full justify-around mt-4 text-white">
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
    </ModalWrapper>
  );
}

function WithdrawalDetailsModal({ id }: { id: string }) {
  return createPortal(
    <WithdrawalDetails id={id} />,
    document.getElementById("modal")!,
  );
}

export default WithdrawalDetailsModal;
