import { getTranslations } from "next-intl/server";
import clsx from "clsx";
import { FulfillmentMethod, OrderStatus } from "@/generated/prisma/enums";
import {
  ORDER_STATUS_MESSAGE_KEY,
  statusSequenceFor,
} from "@/lib/order-status";

/**
 * Progress through the fulfilment pipeline.
 *
 * Rendered as an ordered list so the sequence is conveyed structurally
 * rather than only by colour, and the current step is marked with
 * `aria-current` so assistive technology can announce where the order is.
 * Pickup orders omit the "out for delivery" step entirely.
 */
export async function OrderStatusTimeline({
  status,
  fulfillmentMethod,
}: {
  status: OrderStatus;
  fulfillmentMethod: FulfillmentMethod;
}) {
  const t = await getTranslations("TrackOrder");

  // Cancellation is an exit from the pipeline, not a stage within it, so
  // it replaces the tracker rather than appearing as a step.
  if (status === OrderStatus.CANCELLED) {
    return (
      <p className="rounded-xl border border-berry/30 bg-berry/5 px-5 py-4 font-medium text-berry">
        {t("statusCancelled")}
      </p>
    );
  }

  const sequence = statusSequenceFor(fulfillmentMethod);
  const currentIndex = sequence.indexOf(status);

  return (
    <div>
      <h2 className="font-heading text-xl font-semibold text-cocoa">
        {t("statusLabel")}
      </h2>

      <ol className="mt-5 flex flex-col gap-0">
        {sequence.map((step, index) => {
          const isDone = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isLast = index === sequence.length - 1;

          return (
            <li key={step} className="flex gap-4">
              {/* Marker column: dot plus the connector to the next step. */}
              <div className="flex flex-col items-center">
                <span
                  aria-hidden="true"
                  className={clsx(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold",
                    isDone && "border-gold bg-gold text-cream",
                    isCurrent && "border-cocoa bg-cocoa text-cream",
                    !isDone && !isCurrent && "border-line bg-paper text-line",
                  )}
                >
                  {isDone ? "✓" : ""}
                </span>
                {!isLast && (
                  <span
                    aria-hidden="true"
                    className={clsx(
                      "w-0.5 flex-1",
                      index < currentIndex ? "bg-gold" : "bg-line",
                    )}
                  />
                )}
              </div>

              <p
                aria-current={isCurrent ? "step" : undefined}
                className={clsx(
                  "pb-6 text-sm",
                  isCurrent
                    ? "font-semibold text-cocoa"
                    : isDone
                      ? "text-cocoa-soft"
                      : "text-cocoa-soft/60",
                )}
              >
                {t(ORDER_STATUS_MESSAGE_KEY[step])}
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
