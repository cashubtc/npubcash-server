import { vi } from "vitest";
import cashuMock from "../__mocks__/cashu-ts";

vi.mock("@cashu/cashu-ts", () => cashuMock);
