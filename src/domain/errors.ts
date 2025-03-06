export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends Error {
  constructor(
    message: string,
    public readonly resource?: string
  ) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class UnauthorizedError extends Error {
  constructor(
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class RateLimitError extends Error {
  constructor(
    message: string,
    public readonly limits?: {
      limit: string | undefined;
      remaining: string | undefined;
      reset: string | undefined;
    }
  ) {
    super(message);
    this.name = "RateLimitError";
  }
}

export class InternalError extends Error {
  constructor(
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "InternalError";
  }
}