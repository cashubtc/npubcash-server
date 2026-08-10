export class ApiError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

export class LnurlError extends Error {
  constructor(
    readonly statusCode: number,
    readonly reason: string,
    readonly cause?: unknown,
  ) {
    super(reason);
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = "Unauthorized!") {
    super(401, message);
  }
}

export class NotFoundError extends ApiError {
  constructor(message = "Not Found") {
    super(404, message);
  }
}

export class UsernameTakenError extends ApiError {
  constructor(message = "Username already taken") {
    super(409, message);
  }
}

export class BadRequestError extends ApiError {
  constructor(message = "Bad Request") {
    super(400, message);
  }
}

export class InvalidRecipientError extends LnurlError {
  constructor() {
    super(200, "Invalid recipient.");
  }
}

export class RecipientUnavailableError extends LnurlError {
  constructor() {
    super(200, "Recipient unavailable.");
  }
}

export class LnurlServiceUnavailableError extends LnurlError {
  constructor(cause?: unknown) {
    super(500, "Service temporarily unavailable.", cause);
  }
}

export class InternalError extends ApiError {
  constructor(message = "Internal Server Error") {
    super(500, message);
  }
}

export class PaymentRequiredError extends ApiError {
  amount: number;
  mintUrl: string;
  constructor(amount: number, mintUrl: string, message?: string) {
    super(402, message || "Payment required");
    this.amount = amount;
    this.mintUrl = mintUrl;
  }
}
