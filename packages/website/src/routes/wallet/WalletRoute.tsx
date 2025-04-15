import InfoBox from "./components/InfoBox.tsx";
import Balance from "./components/Balance.tsx";
import { FaDoorOpen } from "react-icons/fa6";
import { useSearchParams } from "react-router-dom";
import useInfo from "./hooks/useInfo.ts";
import useLogout from "../../hooks/useLogout.ts";
import { useProfile } from "../../hooks/useProfile.ts";
import { motion } from "framer-motion";
import ActionButtons from "./components/ActionButtons.tsx";
import ConfirmationModal from "./components/ConfirmationModal.tsx";

function WalletRoute() {
  const [searchParams] = useSearchParams();
  const displayConfirmation = searchParams.get("confirm");
  const info = useInfo();
  const logout = useLogout();
  const profile = useProfile(info?.npub);
  let username = "Stranger";
  if (profile && profile.name) {
    username = profile.name;
  }
  return (
    <motion.main
      className="w-full h-full flex flex-col justify-between items-center"
      initial={{ opacity: 0, translateX: -50 }}
      animate={{ opacity: 1, translateX: 0 }}
      exit={{ opacity: 0, translateX: 50 }}
      key={location.pathname}
    >
      <div className="flex flex-col w-full gap-2 max-w-screen-md">
        <div className="flex justify-between">
          <p>Welcome, {username}!</p>
          <button
            className="text-xs text-zinc-500 flex items-center gap-1 active:text-purple-500 hover:text-purple-500"
            onClick={logout}
          >
            <FaDoorOpen />
            <p>Logout</p>
          </button>
        </div>
        <Balance />
        <InfoBox info={info} />
      </div>
      <ActionButtons />
      {displayConfirmation ? <ConfirmationModal /> : undefined}
    </motion.main>
  );
}

export default WalletRoute;
