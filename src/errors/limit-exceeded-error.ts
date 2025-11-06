import { CustomError } from "./custom-error";

export class LimitExceededError extends CustomError {
  statusCode = 403; // Forbidden

  constructor(
    public override message = "The limit for this resource has been exceeded."
  ) {
    super(message);
    Object.setPrototypeOf(this, LimitExceededError.prototype);
  }

  serializeErrors() {
    return [{ message: this.message }];
  }
}
