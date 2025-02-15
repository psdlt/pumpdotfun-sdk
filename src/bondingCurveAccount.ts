import { struct, bool, u64, Layout } from "@coral-xyz/borsh";

const TERMINAL_VIRTUAL_TOKENS_AMOUNT = BigInt(279900000000000);

export class BondingCurveAccount {
  public discriminator: bigint;
  public virtualTokenReserves: bigint;
  public virtualSolReserves: bigint;
  public realTokenReserves: bigint;
  public realSolReserves: bigint;
  public tokenTotalSupply: bigint;
  public complete: boolean;

  constructor(
    discriminator: bigint,
    virtualTokenReserves: bigint,
    virtualSolReserves: bigint,
    realTokenReserves: bigint,
    realSolReserves: bigint,
    tokenTotalSupply: bigint,
    complete: boolean
  ) {
    this.discriminator = discriminator;
    this.virtualTokenReserves = virtualTokenReserves;
    this.virtualSolReserves = virtualSolReserves;
    this.realTokenReserves = realTokenReserves;
    this.realSolReserves = realSolReserves;
    this.tokenTotalSupply = tokenTotalSupply;
    this.complete = complete;
  }

  getBuyPrice(amount: bigint): bigint {
    if (this.complete) {
      throw new Error("Curve is complete");
    }

    if (amount <= 0n) {
      return 0n;
    }

    // Calculate the product of virtual reserves
    let n = this.virtualSolReserves * this.virtualTokenReserves;

    // Calculate the new virtual sol reserves after the purchase
    let i = this.virtualSolReserves + amount;

    // Calculate the new virtual token reserves after the purchase
    let r = n / i + 1n;

    // Calculate the amount of tokens to be purchased
    let s = this.virtualTokenReserves - r;

    // Return the minimum of the calculated tokens and real token reserves
    return s < this.realTokenReserves ? s : this.realTokenReserves;
  }

  howMuchToComplete() {
    if (this.complete) {
      throw new Error('Curve is compelte');
    }

    // Tokens available above TERMINAL_VIRTUAL_TOKENS_AMOUNT
    const tokensToBuy = this.virtualTokenReserves - TERMINAL_VIRTUAL_TOKENS_AMOUNT;

    // Constant k = xy
    const k = this.virtualSolReserves * this.virtualTokenReserves;

    // New virtualTokenReserves after buyout
    const newVirtualTokenReserves = TERMINAL_VIRTUAL_TOKENS_AMOUNT;

    // Compute new virtualSolReserves using k = xy / new y
    const newVirtualSolReserves = k / newVirtualTokenReserves;

    // SOL to spend = Initial reserves - New reserves
    const solToSpend = newVirtualSolReserves - this.virtualSolReserves;

    return { tokensToBuy, solToSpend };
  }

  getSellPrice(amount: bigint, feeBasisPoints: bigint): bigint {
    if (this.complete) {
      throw new Error("Curve is complete");
    }

    if (amount <= 0n) {
      return 0n;
    }

    // Calculate the proportional amount of virtual sol reserves to be received
    let n =
      (amount * this.virtualSolReserves) / (this.virtualTokenReserves + amount);

    // Calculate the fee amount in the same units
    let a = (n * feeBasisPoints) / 10000n;

    // Return the net amount after deducting the fee
    return n - a;
  }

  getMarketCapSOL(): bigint {
    if (this.virtualTokenReserves === 0n) {
      return 0n;
    }

    return (
      (this.tokenTotalSupply * this.virtualSolReserves) /
      this.virtualTokenReserves
    );
  }

  getFinalMarketCapSOL(feeBasisPoints: bigint): bigint {
    let totalSellValue = this.getBuyOutPrice(
      this.realTokenReserves,
      feeBasisPoints
    );
    let totalVirtualValue = this.virtualSolReserves + totalSellValue;
    let totalVirtualTokens = this.virtualTokenReserves - this.realTokenReserves;

    if (totalVirtualTokens === 0n) {
      return 0n;
    }

    return (this.tokenTotalSupply * totalVirtualValue) / totalVirtualTokens;
  }

  getBuyOutPrice(amount: bigint, feeBasisPoints: bigint): bigint {
    let solTokens =
      amount < this.realSolReserves ? this.realSolReserves : amount;
    let totalSellValue =
      (solTokens * this.virtualSolReserves) /
        (this.virtualTokenReserves - solTokens) +
      1n;
    let fee = (totalSellValue * feeBasisPoints) / 10000n;
    return totalSellValue + fee;
  }

  public static fromBuffer(buffer: Buffer): BondingCurveAccount {
    const structure: Layout<BondingCurveAccount> = struct([
      u64("discriminator"),
      u64("virtualTokenReserves"),
      u64("virtualSolReserves"),
      u64("realTokenReserves"),
      u64("realSolReserves"),
      u64("tokenTotalSupply"),
      bool("complete"),
    ]);

    let value = structure.decode(buffer);
    return new BondingCurveAccount(
      BigInt(value.discriminator),
      BigInt(value.virtualTokenReserves),
      BigInt(value.virtualSolReserves),
      BigInt(value.realTokenReserves),
      BigInt(value.realSolReserves),
      BigInt(value.tokenTotalSupply),
      value.complete
    );
  }
}
