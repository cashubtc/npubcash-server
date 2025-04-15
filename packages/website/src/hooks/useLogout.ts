import { useContext } from "react";
import { SdkContext } from "./providers/SdkProvider";

function useLogout() {
  const { setSdk } = useContext(SdkContext);
  function logout() {
    setSdk(undefined);
    localStorage.clear();
  }
  return logout;
}

export default useLogout;
