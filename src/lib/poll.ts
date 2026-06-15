export class TryOnError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TryOnError";
  }
}
