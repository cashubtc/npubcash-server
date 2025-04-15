import { useContext, useEffect, useRef, useState } from "react";
import PaymentModal from "./components/PaymentModal";
import UsernameInput from "./components/UsernameInput";
import { SdkContext } from "../../hooks/providers/SdkProvider";
import { useNavigate } from "react-router-dom";

function UsernameRoute() {
  const [username, setUsername] = useState("");
  const [invoice, setInvoice] = useState<string>();
  const [paymentToken, setPaymentToken] = useState("");
  const [error, setError] = useState<string>("");
  const { sdk } = useContext(SdkContext);
  const navigate = useNavigate();

  const intervalRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (!sdk) {
      navigate("/setup");
    }
  }, [sdk]);

  async function clickHandler() {
    if (!sdk || !username) {
      return;
    }
    const storedPayment = localStorage.getItem(`purchase:${username}`);
    try {
      if (!storedPayment) {
        const res = await sdk.setUsername(username, undefined);
        if (!res.data?.paymentRequest && res.error) {
          throw new Error(res.message);
        }
        localStorage.setItem(
          `purchase:${username}`,
          JSON.stringify({
            paymentToken: res.data.paymentToken,
            paymentRequest: res.data.paymentRequest,
          }),
        );
        setInvoice(res.data.paymentRequest);
        setPaymentToken(res.data.paymentToken);
      } else {
        const { paymentToken, paymentRequest } = JSON.parse(storedPayment);
        setInvoice(paymentRequest);
        setPaymentToken(paymentToken);
      }
    } catch (e) {
      if (e instanceof Error) {
        setError(e.message);
      }
    }
  }

  return (
    <main className="flex flex-col justify-center items-center mt-16 gap-8 mx-4">
      <div className="flex flex-col gap-2 max-w-3xl">
        <h2 className="text-center font-bold text-4xl md:text-5xl bg-gradient-to-tr from-purple-500 to-pink-500 bg-clip-text text-transparent">
          npub.cash Username
        </h2>
        <p className="text-center">
          npub.cash works with your nostr public key out of the box. But you can
          claim an additional, human-readable username and receive payments on
          both your public key and username.
        </p>
      </div>
      <div className="flex flex-col items-center gap-8">
        <div className="flex flex-col items-center">
          <label htmlFor="username">Choose your username:</label>
          <UsernameInput username={username} setUsername={setUsername} />
        </div>
        {error ? <p className="font-bold text-red-500">{error}</p> : undefined}
        <button
          className="px-4 py-2 bg-gradient-to-tr from-purple-500 to-pink-500 rounded hover:from-purple-700 hover:to-pink-700 transition"
          onClick={clickHandler}
        >
          Claim Username (5000 SATS)
        </button>
        <p className="text-xs text-zinc-400">
          Purchases are cached in your browser. If something goes wrong during
          payment simply try to claim the same username again
        </p>
      </div>
      <PaymentModal
        invoice={invoice}
        paymentToken={paymentToken}
        username={username}
        onCancel={() => {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
          }
          setInvoice("");
        }}
      />
    </main>
  );
}

export default UsernameRoute;
