import type { PriceGateway } from "@concord/incentive";

export class MockPriceGateway implements PriceGateway {
  private prices: Record<string, Record<string, string>>;

  constructor(prices?: Record<string, Record<string, string>>) {
    // Defaults: USDC → USD = 1, ETH → USD = 3000
    this.prices = prices ?? {
      USDC: { USD: "1", USDC: "1" },
      ETH: { USD: "3000", USDC: "3000" },
    };
  }

  async getPrice(asset: string, denominatedIn: string): Promise<string> {
    return this.prices[asset]?.[denominatedIn] ?? "0";
  }
}
