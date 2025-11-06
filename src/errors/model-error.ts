import { CustomError } from "./custom-error";

export class ModelError extends CustomError {
  statusCode = 500;

  constructor(public override message: string) {
    super(message);
    Object.setPrototypeOf(this, ModelError.prototype);
    this.name = "ModelError";
  }

  serializeErrors() {
    return [{ message: this.message }];
  }
}
