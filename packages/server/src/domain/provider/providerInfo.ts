import { createCashuPaymentTerms } from "@/domain/payment/paymentRequest";
import type { ProviderInfo } from "npubcash-types";

type UsernameConfig =
  | { enabled: false }
  | { enabled: true; amount: number; mintUrl: string };

export function createProviderInfo(
  usernameConfig: UsernameConfig,
): ProviderInfo {
  return {
    version: 2,
    features: {
      username: usernameConfig.enabled
        ? {
            enabled: true,
            payment: createCashuPaymentTerms(usernameConfig.amount, [
              usernameConfig.mintUrl,
            ]),
          }
        : { enabled: false },
    },
  };
}
