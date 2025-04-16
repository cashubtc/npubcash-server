import { FaKey, FaSignature, FaCode } from "react-icons/fa6";
import FeatureCard from "./FeatureCard";

function FeatureCards() {
  return (
    <section className="mx-auto flex flex-col items-center justify-center p-4 gap-4 mt-24 max-w-4xl opacity-0 animate-fadein [animation-delay:400ms]">
      <div>
        <h2 className="text-center font-bold text-2xl bg-gradient-to-tr from-purple-500 to-pink-500 bg-clip-text text-transparent">
          A Lightning-Address powered by eCash and nostr
        </h2>
        <p className="text-center ">
          Receive Lightning payments on your npub.cash address. Either sign up
          and claim your username, or use any nostr public key (npub) without
          registration.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FeatureCard
          icon={<FaSignature />}
          title="No Sign-Up"
          body="Built on top of nostr identities and signatures"
        />
        <FeatureCard
          icon={<FaKey />}
          title="Trust Minimized"
          body="Balance can be locked to your public key"
        />
        <FeatureCard
          icon={<FaKey />}
          title="Offline Payments"
          body="Cashu acts as a layer for offline payments"
        />
        <FeatureCard
          icon={<FaCode />}
          title="Open Source"
          body="Based on on FOSS Cashu-Adress"
        />
      </div>
    </section>
  );
}

export default FeatureCards;
