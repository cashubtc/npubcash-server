import type { MintRequestExecutor } from "@/infrastructure/MintRequestExecutor";
import { normalizeUrl } from "@/utils/utils";
import {
  HttpResponseError,
  MintOperationError,
  NetworkError,
} from "@cashu/cashu-ts";

type CashuRequestOptions = {
  endpoint: string;
  requestBody?: Record<string, unknown>;
  headers?: Record<string, string>;
} & Omit<RequestInit, "body" | "headers">;

export type CashuMintRequest = <T>(options: CashuRequestOptions) => Promise<T>;

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

interface CashuMintRequestOptions {
  mintUrl: string;
  requestExecutor: MintRequestExecutor;
  fetch?: FetchLike;
}

/** Adapts cashu-ts requests to the server's shared per-mint request executor. */
export function createCashuMintRequest(
  options: CashuMintRequestOptions,
): CashuMintRequest {
  const mintUrl = normalizeUrl(options.mintUrl);
  const fetchImpl = options.fetch ?? fetch;

  return <T>(requestOptions: CashuRequestOptions): Promise<T> => {
    const callerSignal = requestOptions.signal ?? undefined;
    return options.requestExecutor.run(
      mintUrl,
      callerSignal,
      async (requestSignal) =>
        performCashuRequest<T>(fetchImpl, requestOptions, requestSignal),
    );
  };
}

async function performCashuRequest<T>(
  fetchImpl: FetchLike,
  options: CashuRequestOptions,
  signal: AbortSignal,
): Promise<T> {
  const {
    endpoint,
    requestBody,
    headers,
    signal: _callerSignal,
    ...requestInit
  } = options;
  const body =
    requestBody === undefined ? undefined : JSON.stringify(requestBody);
  const requestHeaders = {
    Accept: "application/json, text/plain, */*",
    ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    ...headers,
  };

  let response: Response;
  try {
    response = await fetchImpl(endpoint, {
      ...requestInit,
      body,
      headers: requestHeaders,
      signal,
    });
  } catch (cause) {
    if (signal.aborted) {
      throw signal.reason ?? cause;
    }
    throw new NetworkError(
      cause instanceof Error ? cause.message : "Network request failed",
    );
  }

  if (!response.ok) {
    const error = await parseErrorResponse(response);
    if (
      response.status === 400 &&
      typeof error.code === "number" &&
      typeof error.detail === "string"
    ) {
      throw new MintOperationError(error.code, error.detail);
    }
    const message =
      typeof error.error === "string"
        ? error.error
        : typeof error.detail === "string"
          ? error.detail
          : "HTTP request failed";
    throw new HttpResponseError(message, response.status);
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new HttpResponseError("bad response", response.status);
  }
}

async function parseErrorResponse(
  response: Response,
): Promise<Record<string, unknown>> {
  try {
    const body = (await response.json()) as unknown;
    return body && typeof body === "object"
      ? (body as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}
