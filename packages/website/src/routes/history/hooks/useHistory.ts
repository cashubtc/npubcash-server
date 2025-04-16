import { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SdkContext } from "../../../hooks/providers/SdkProvider";

type Withdrawal = {
  id: number;
  created_at: number;
  pubkey: string;
  amount: number;
};

function useHistory() {
  const [info, setInfo] = useState<Withdrawal[]>([]);
  const navigate = useNavigate();
  const { sdk } = useContext(SdkContext);
  useEffect(() => {
    async function setup() {
      const data = await sdk!.getLastWithdrawls();
      setInfo(data.withdrawals);
    }
    if (sdk) {
      setup();
    } else {
      navigate("/setup");
    }
  }, [sdk]);
  return info;
}

export default useHistory;
