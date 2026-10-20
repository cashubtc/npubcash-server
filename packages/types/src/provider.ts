export type UsernamePaymentTerms = {
  amount: number;
  unit: "sat";
  mints: string[];
};

export type UsernameFeature =
  | { enabled: false }
  | {
      enabled: true;
      payment: UsernamePaymentTerms;
    };

export type ProviderInfo = {
  version: 2;
  features: {
    username: UsernameFeature;
  };
};

export type ProviderInfoResponse = {
  error: false;
  data: ProviderInfo;
};
