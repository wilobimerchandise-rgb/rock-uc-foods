import { type Kobo, percentOfBps } from "../lib/money";

export interface RefundInput {
  orderClass: "fresh" | "bulk";
  cancelledBy: "customer" | "us";
  foodKobo: Kobo;
  deliveryFeeKobo: Kobo;
  verifiedPaidKobo: Kobo;
  placedAt: Date;
  cancelRequestedAt: Date;
  cookingStartedAt: Date | null;
  eventAt: Date | null;
}

export function classifyOrder(packs: number, opts?: { isTray?: boolean; isLiveCooking?: boolean }): "fresh" | "bulk" {
  if (packs <= 0 || !Number.isInteger(packs)) {
    throw new Error("Invalid pack count");
  }
  if (opts?.isTray || opts?.isLiveCooking) return "bulk";
  return packs >= 21 ? "bulk" : "fresh";
}

export function bulkRefundBps(msBeforeEvent: number): number {
  if (Number.isNaN(msBeforeEvent)) return 0;
  if (msBeforeEvent < 0) return 0;
  const hours = msBeforeEvent / (1000 * 60 * 60);
  if (hours >= 72) return 8000;
  if (hours >= 48) return 5000;
  if (hours >= 24) return 2500;
  return 0;
}

export function computeRefund(input: RefundInput): { refundKobo: Kobo; foodRefundKobo: Kobo; deliveryRefundKobo: Kobo } {
  if (input.foodKobo < 0n || input.deliveryFeeKobo < 0n || input.verifiedPaidKobo < 0n) {
    throw new Error("Negative amounts not allowed");
  }
  if (!input.eventAt && input.orderClass === "bulk") {
    throw new Error("Missing event date for bulk order");
  }
  if (input.cancelRequestedAt < input.placedAt) {
    throw new Error("Cancel requested before order placed");
  }

  if (input.cancelledBy === "us") {
    return {
      refundKobo: input.verifiedPaidKobo,
      foodRefundKobo: input.foodKobo,
      deliveryRefundKobo: input.deliveryFeeKobo,
    };
  }

  if (input.orderClass === "fresh") {
    const timeSincePlaced = input.cancelRequestedAt.getTime() - input.placedAt.getTime();
    const thirtyMinutesMs = 30 * 60 * 1000;
    
    if (input.cookingStartedAt !== null && input.cookingStartedAt <= input.cancelRequestedAt) {
      return { refundKobo: 0n, foodRefundKobo: 0n, deliveryRefundKobo: 0n };
    }
    
    if (timeSincePlaced <= thirtyMinutesMs) {
      return {
        refundKobo: input.verifiedPaidKobo,
        foodRefundKobo: input.foodKobo,
        deliveryRefundKobo: input.deliveryFeeKobo,
      };
    }
    
    return { refundKobo: 0n, foodRefundKobo: 0n, deliveryRefundKobo: 0n };
  }

  const msBeforeEvent = input.eventAt!.getTime() - input.cancelRequestedAt.getTime();
  const bps = bulkRefundBps(msBeforeEvent);
  const foodRefundKobo = percentOfBps(input.foodKobo, bps);
  const refundKobo = foodRefundKobo > input.verifiedPaidKobo ? input.verifiedPaidKobo : foodRefundKobo;

  return {
    refundKobo,
    foodRefundKobo: refundKobo,
    deliveryRefundKobo: 0n,
  };
}

export function canMarkDeliveredAfterFailedContact(calls: number, placedAt: Date, reportedAt: Date): boolean {
  const minutesWaited = (reportedAt.getTime() - placedAt.getTime()) / (1000 * 60);
  return calls >= 2 && minutesWaited >= 15;
}

export function isWithinQualityWindow(deliveredAt: Date, reportedAt: Date): boolean {
  const diff = reportedAt.getTime() - deliveredAt.getTime();
  return diff >= 0 && diff <= 2 * 60 * 60 * 1000;
}
