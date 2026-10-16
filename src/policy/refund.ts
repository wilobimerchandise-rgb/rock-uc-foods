import { type Kobo, percentOfBps } from "../lib/money";

export function computeRefund(
  orderType: "fresh" | "bulk",
  hoursBeforeEvent: number,
  foodKobo: Kobo,
  deliveryKobo: Kobo,
  verifiedPaidKobo: Kobo,
  isWeCancel: boolean
): { refundKobo: Kobo; foodRefundKobo: Kobo; deliveryRefundKobo: Kobo } {
  if (isWeCancel) {
    return { 
      refundKobo: verifiedPaidKobo, 
      foodRefundKobo: foodKobo, 
      deliveryRefundKobo: deliveryKobo 
    };
  }

  if (orderType === "fresh") {
    // 30 mins = 0.5 hours
    if (hoursBeforeEvent <= 0.5) {
      return { 
        refundKobo: verifiedPaidKobo, 
        foodRefundKobo: foodKobo, 
        deliveryRefundKobo: deliveryKobo 
      };
    }
    return { refundKobo: 0n, foodRefundKobo: 0n, deliveryRefundKobo: 0n };
  }

  // Bulk orders: >=72h 80%, >=48h 50%, >=24h 25%, else 0%
  let bps = 0;
  if (hoursBeforeEvent >= 72) bps = 8000;
  else if (hoursBeforeEvent >= 48) bps = 5000;
  else if (hoursBeforeEvent >= 24) bps = 2500;

  const foodRefundKobo = percentOfBps(foodKobo, bps);
  
  // Cap refund at the verified amount actually paid by the customer
  const cappedRefund = foodRefundKobo > verifiedPaidKobo ? verifiedPaidKobo : foodRefundKobo;

  return { 
    refundKobo: cappedRefund, 
    foodRefundKobo: cappedRefund, 
    deliveryRefundKobo: 0n 
  };
}
