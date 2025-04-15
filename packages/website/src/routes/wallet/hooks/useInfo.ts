import { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SdkContext } from "../../../hooks/providers/SdkProvider";

function useInfo() {
  const [info, setInfo] = useState<{
    mintUrl: string;
    npub: string;
    username?: string;
  }>();
  const navigate = useNavigate();
  const { sdk } = useContext(SdkContext);
  useEffect(() => {
    async function setup() {
      const info = await sdk!.getInfo();
      setInfo(info);
    }
    if (sdk) {
      setup();
    } else {
      navigate("/setup");
    }
  }, [sdk]);
  return info;
}

export default useInfo;
