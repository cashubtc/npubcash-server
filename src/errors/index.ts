export class ApiError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
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
