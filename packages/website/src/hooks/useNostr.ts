import { useEffect, useState } from "react";

export const useNostr = () => {
  const [nostr, setNostr] = useState(false);
  useEffect(() => {
    if (window.nostr) {
      setNostr(true);
    } else {
      const int = setInterval(() => {
        if (window.nostr) {
          setNostr(true);
        }
      }, 1000);
      setTimeout(() => {
        clearInterval(int);
      }, 10000);
    }
  }, []);
  return nostr;
};
