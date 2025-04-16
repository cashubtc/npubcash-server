import { useRef } from "react";
import { createPortal } from "react-dom";
import Button from "../../../components/Button";
import ModalWrapper from "../../../components/ModalWrapper";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useStopScroll } from "../../../hooks/useStopScroll";

function Confirmation() {
  const [, setParams] = useSearchParams();

  const checkRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useStopScroll();

  return (
    <ModalWrapper>
      <div className="max-w-screen-sm flex flex-col items-center gap-8 text-white text-center">
        <p className="text-xl font-bold">Create Token?</p>
        <div className="flex flex-col gap-4 items-center">
          <p className="text-center text-zinc-400">
            In order to optimize mint operations npub.cash will mark your proofs
            as spent once the token is displayed. You can always display it
            again in the History Tab
          </p>
          <p className="text-center text-zinc-400">
            You need a{" "}
            <a
              className="text-purple-600 hover:text-purple-400"
              href="https://docs.cashu.space/wallets"
            >
              Cashu Wallet
            </a>{" "}
            to receive the generated token
          </p>
        </div>

        <div className="flex gap-2 ">
          <label htmlFor="check">Don't show this again</label>
          <input type="checkbox" id="check" ref={checkRef} />
        </div>
        <div className="flex justify-around gap-8">
          <Button
            text="Confirm"
            onClick={() => {
              if (checkRef.current?.checked) {
                localStorage.setItem("npc_auto_confirm", "true");
              }
              navigate("/claim");
            }}
          />
          <button
            className="px-4 py-2 text-white bg-zinc-700 rounded hover:from-purple-700 hover:to-pink-700 transition"
            onClick={() => {
              setParams("");
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
}

function ConfirmationModal() {
  return createPortal(<Confirmation />, document.getElementById("modal")!);
}

export default ConfirmationModal;
