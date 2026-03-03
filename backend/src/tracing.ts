import { diag, DiagConsoleLogger, DiagLogLevel, trace, SpanStatusCode } from "@opentelemetry/api";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { TraceExporter } from "@google-cloud/opentelemetry-cloud-trace-exporter";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { ParentBasedSampler, TraceIdRatioBasedSampler } from "@opentelemetry/sdk-trace-base";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";

const serviceName = process.env.OTEL_SERVICE_NAME?.trim() || "eureka-studybuddy-backend";
const serviceVersion = process.env.npm_package_version?.trim() || "1.0.0";
const samplingRatio = clampSamplingRatio(process.env.OTEL_SAMPLING_RATIO);
const enableDebugLogs = process.env.OTEL_DEBUG === "true";

if (enableDebugLogs) {
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);
}

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: serviceName,
    [ATTR_SERVICE_VERSION]: serviceVersion,
  }),
  traceExporter: new TraceExporter(),
  instrumentations: [getNodeAutoInstrumentations()],
  sampler: new ParentBasedSampler({
    root: new TraceIdRatioBasedSampler(samplingRatio),
  }),
});

void sdk.start();

process.once("SIGTERM", () => {
  void sdk.shutdown();
});

process.once("SIGINT", () => {
  void sdk.shutdown();
});

function clampSamplingRatio(value: string | undefined): number {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return 0.5;
  return Math.min(1, Math.max(0, parsed));
}

export const aiTracer = trace.getTracer("ai-latency");

export async function withSpan<T>(
  name: string,
  attributes: Record<string, string | number | boolean | undefined>,
  fn: () => Promise<T>
): Promise<T> {
  const span = aiTracer.startSpan(name, {
    attributes: Object.fromEntries(Object.entries(attributes).filter(([, value]) => value !== undefined)),
  });

  try {
    const result = await fn();
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    span.recordException(error instanceof Error ? error : new Error(String(error)));
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    span.end();
  }
}
