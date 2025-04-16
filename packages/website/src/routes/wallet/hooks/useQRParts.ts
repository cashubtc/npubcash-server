import { UR, UREncoder } from "@gandlaf21/bc-ur";
import { useEffect, useState } from "react";

export const useQRParts = (isBig: boolean, isFast: boolean, value?: string) => {
  const [tokenPart, setTokenPart] = useState("");

  useEffect(() => {
    // @ts-ignore
    let interval: NodeJS.Timeout;
    if (value) {
      const ur = UR.from(value);
      const maxFragmentLength = isBig ? 150 : 75;
      const firstSeqNum = 0;
      const urEncoder = new UREncoder(ur, maxFragmentLength, firstSeqNum);
      interval = setInterval(
        () => {
          setTokenPart(urEncoder.nextPart());
        },
        isFast ? 100 : 250,
      );
    }
    return () => {
      clearInterval(interval);
    };
  }, [value, isFast, isBig]);
  return tokenPart;
};
