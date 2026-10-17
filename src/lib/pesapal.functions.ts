import { createServerFn } from "@tanstack/react-start";

export const pesapalCreateOrder = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      reference: string;
      amount: number;
      currency: string;
      description: string;
      callbackUrl: string;
      ipnUrl: string;
      email?: string;
      phone?: string;
      firstName?: string;
    }) => input,
  )
  .handler(async ({ data }) => {
    const { submitOrder } = await import("./pesapal.server");
    return submitOrder(data);
  });

export const pesapalStatus = createServerFn({ method: "POST" })
  .inputValidator((input: { orderTrackingId: string }) => input)
  .handler(async ({ data }) => {
    const { transactionStatus } = await import("./pesapal.server");
    try {
      return await transactionStatus(data.orderTrackingId);
    } catch (e) {
      return {
        state: "pending" as const,
        message: e instanceof Error ? e.message : "Checking payment…",
      };
    }
  });
