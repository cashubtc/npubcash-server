import { NCSDK } from "cashu-address-sdk";
import {
  Dispatch,
  ReactNode,
  SetStateAction,
  createContext,
  useState,
} from "react";

type SdkContext = {
  sdk: NCSDK | undefined;
  setSdk: Dispatch<SetStateAction<NCSDK | undefined>>;
};

const SdkContext = createContext<SdkContext>({} as SdkContext);

function SdkProvider({ children }: { children: ReactNode }) {
  const [sdk, setSdk] = useState<NCSDK>();
  return (
    <SdkContext.Provider value={{ sdk, setSdk }}>
      {children}
    </SdkContext.Provider>
  );
}

export { SdkProvider, SdkContext };
