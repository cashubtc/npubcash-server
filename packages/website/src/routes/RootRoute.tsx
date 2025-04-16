import { Outlet, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useContext, useEffect, useState } from "react";
import { SdkContext } from "../hooks/providers/SdkProvider";
import { AnimatePresence } from "framer-motion";
import { setupSdk } from "../sdk";

function RootRoute() {
  const [ready, setReady] = useState(false);
  const { setSdk } = useContext(SdkContext);
  const navigate = useNavigate();

  useEffect(() => {
    async function setup() {
      const newSdk = await setupSdk();
      if (newSdk) {
        if (newSdk.method === "ncrypt") {
          navigate("/setup?unlock");
        }
        setSdk(newSdk.sdk);
        setReady(true);
      }
      setReady(true);
    }
    setup();
  }, []);
  if (!ready) {
    return <p>Loading...</p>;
  }
  return (
    <div className="absolute inset-0 flex flex-col justify-between">
      <div>
        <svg width="0" height="0">
          <linearGradient id="blue-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop stopColor="#a855f7" offset="0%" />
            <stop stopColor="#d946ef" offset="100%" />
          </linearGradient>
        </svg>
        <Navbar />
      </div>
      <div className="flex grow p-2 items-start justify-center">
        <AnimatePresence>
          <Outlet />
        </AnimatePresence>
      </div>
    </div>
  );
}

export default RootRoute;
