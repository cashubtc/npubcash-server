import { config } from "@/config/index";
import { createProviderInfo } from "@/domain/provider/providerInfo";
import type { ProviderInfoResponse } from "npubcash-types";
import type { Request, Response } from "express";

export function getProviderInfo(_req: Request, res: Response) {
  const response: ProviderInfoResponse = {
    error: false,
    data: createProviderInfo(config.usernameConfig),
  };

  res.setHeader("Cache-Control", "public, max-age=300");
  res.json(response);
}
