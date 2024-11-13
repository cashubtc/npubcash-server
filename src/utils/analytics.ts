export class Analyzer {
  private paymentsInflight = 0;
  private paymentsSettled = 0;
  private paymentsExpired = 0;
  private startTime: number;
  private timers: { [paymentHash: string]: NodeJS.Timeout } = {};
  private static instance?: Analyzer;

  constructor() {
    this.startTime = Date.now();
  }

  static getInstance() {
    if (this.instance) {
      return this.instance;
    }
    this.instance = new Analyzer();
    return this.instance;
  }

  logPaymentCreated(paymentHash: string, expiresIn: number) {
    console.log("Analytics - Payment created... Expires in: ", expiresIn);
    this.paymentsInflight++;
    this.timers[paymentHash] = setTimeout(() => {
      this.logPaymentExpired(paymentHash);
    }, expiresIn * 1000);
  }

  logPaymentExpired(paymentHash: string) {
    console.log("Analytics - Payment expired...");
    this.paymentsInflight--;
    this.paymentsExpired++;
    delete this.timers[paymentHash];
  }

  logPaymentSettled(paymentHash: string) {
    console.log("Analytics - Payment settled...");
    this.paymentsInflight--;
    this.paymentsSettled++;
    clearTimeout(this.timers[paymentHash]);
    delete this.timers[paymentHash];
  }

  logAnalytics() {
    const hoursPassed = (Date.now() - this.startTime) / (1000 * 60 * 60);
    console.log("Analytics - Currently in flight: ", this.paymentsInflight);
    console.log(
      `Analytics - Expired per hour: ${(this.paymentsExpired / hoursPassed).toFixed(2)}`,
    );
    console.log(
      `Analytics - Settled per hour: ${(this.paymentsSettled / hoursPassed).toFixed(2)}`,
    );
  }
}
