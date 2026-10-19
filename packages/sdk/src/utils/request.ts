import type { ErrorResponse } from "@npubcash/api-contract";
import { NullLogger, type Logger } from "../logger";
import { ApiError, type ApiResponse } from "../types";

export async function authenticatedRequest<T extends ApiResponse>(
  url: string,
  authToken: string,
  options: RequestInit = {},
  logger: Logger = new NullLogger(),
): Promise<T> {
  const urlObj = new URL(url);

  try {
    const urlForAuth = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
    logger.debug(
      `Auth token obtained for URL: ${urlForAuth} - METHOD: ${options.method || "GET"}`,
    );

    const res = await fetch(url.toString(), {
      ...options,
      headers: {
        ...options.headers,
        Authorization: authToken,
      },
    });

    if (!res.ok) {
      const errorData: ErrorResponse = await res.json();
      logger.error(`API Error: ${errorData.message || res.statusText}`, {
        status: res.status,
        url: url.toString(),
      });
      throw new ApiError(errorData.message || res.statusText, res.status);
    }

    const responseData = (await res.json()) as T;
    logger.debug("Request successful", { url: url.toString() });
    return responseData;
  } catch (error) {
    logger.error("Authenticated request failed:", error);
    throw error;
  }
}
