import { useContext, useRef, useState } from "react";
import ConfettiExplosion, { ConfettiProps } from "react-confetti-explosion";
import { createPortal } from "react-dom";
import { FaCheckCircle } from "react-icons/fa";
import QRCode from "react-qr-code";
import { useNavigate } from "react-router-dom";
import ModalWrapper from "../../../components/ModalWrapper";
import { useStopScroll } from "../../../hooks/useStopScroll";
import Button from "../../../components/Button";
import { SdkContext } from "../../../hooks/providers/SdkProvider";

const confettiProps: ConfettiProps = {
  force: 0.6,
  duration: 3000,
  particleCount: 300,
  width: 1000,
  colors: ["#9A0023", "#FF003C", "#AF739B", "#FAC7F3", "#F7DBF4"],
};

function ModalContent({
  invoice,
  paymentToken,
  username,
  onCancel,
}: {
  invoice: string;
  username: string;
  paymentToken: string;
  onCancel: () => void;
}) {
  const [showInvoice, setShowInvoice] = useState(false);
  const [paid, setPaid] = useState(false);
  const navigate = useNavigate();
  const intervalRef = useRef<NodeJS.Timeout>();
  const { sdk } = useContext(SdkContext);
  useStopScroll();

  async function checkPayment() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    if (!sdk) {
      return;
    }
    intervalRef.current = setInterval(async () => {
      const payRes = await sdk.setUsername(username, paymentToken);
      if (!payRes.error) {
        setPaid(true);
        clearInterval(intervalRef.current);
      }
    }, 6000);
  }

  function cancelHandler() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    onCancel();
  }
  return (
    <ModalWrapper>
      <div className="flex flex-col items-center justify-center w-full md:max-w-md gap-4 min-w-0">
        <p className="text-sm text-zinc-400 text-center">
          Pay this invoice to claim your username
        </p>
        {paid ? <ConfettiExplosion {...confettiProps} /> : undefined}
        <div className="p-4 bg-white rounded relative">
          {paid ? (
            <div className="absolute inset-0 flex justify-center items-center z-2 bg-white/80">
              <FaCheckCircle
                className="text-9xl bg-white rounded-full"
                style={{ fill: "url(#blue-gradient)" }}
              />
            </div>
          ) : undefined}
          <a href={`lightning:${invoice}`}>
            <QRCode
              value={invoice}
              size={176}
              onClick={() => {
                navigator.clipboard.writeText(invoice);
              }}
            />
          </a>
        </div>
        <div className="flex w-full justify-center">
          {showInvoice ? (
            <p className="flex w-full text-[8px] p-2 bg-zinc-900 text-zinc-400 break-all">
              {invoice}
            </p>
          ) : (
            <button
              className="text-sm text-purple-500"
              onClick={() => {
                setShowInvoice(true);
              }}
            >
              Display Invoice
            </button>
          )}
        </div>
        {paid ? (
          <Button
            text="Continue"
            onClick={() => {
              navigate("/wallet");
            }}
          />
        ) : (
          <div className="flex gap-2 ">
            <Button text="Check Payment" onClick={checkPayment} />
            <Button text="Cancel" onClick={cancelHandler} />
          </div>
        )}
      </div>
    </ModalWrapper>
  );
}

function PaymentModal({
  invoice,
  paymentToken,
  username,
  onCancel,
}: {
  invoice?: string;
  paymentToken?: string;
  username?: string;
  onCancel: () => void;
}) {
  if (!invoice || !paymentToken || !username) {
    return null;
  }
  return createPortal(
    <ModalContent
      invoice={invoice}
      onCancel={onCancel}
      username={username}
      paymentToken={paymentToken}
    />,
    document.getElementById("modal")!,
  );
}

export default PaymentModal;
