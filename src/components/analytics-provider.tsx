import { Suspense } from "react";
import { AnalyticsBeacon } from "@/components/analytics-beacon";

export function AnalyticsProvider() {
  return (
    <Suspense fallback={null}>
      <AnalyticsBeacon />
    </Suspense>
  );
}
