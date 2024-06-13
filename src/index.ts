import { useWebSocketImplementation } from "nostr-tools";
import { checkEnvVars } from "./utils/general";
import app from "./app";

useWebSocketImplementation(require("ws"));

checkEnvVars(["LNURL_MAX_AMOUNT", "LNURL_MIN_AMOUNT", "MINTURL"]);

app.listen(process.env.PORT || 8000);
