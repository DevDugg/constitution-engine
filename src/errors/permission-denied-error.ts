import { CustomError } from "./custom-error";

export class PermissionDeniedError extends CustomError {
  statusCode = 403; // Forbidden

  constructor(
    public override message: string = "Permission Denied",
    public action?: string
  ) {
    super(message);
    Object.setPrototypeOf(this, PermissionDeniedError.prototype);
  }

  serializeErrors() {
    return [{ message: this.message, action: this.action }];
  }
}
