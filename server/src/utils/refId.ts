/**
 * A Mongoose reference is either a raw ObjectId or a populated document, and only the document has an
 * `id` virtual that reads as hex. Reading `id` off a raw ObjectId returns the binary buffer instead,
 * so every public mapping goes through here.
 */
export function refId(value: unknown): string {
  if (!value) return '';
  const withId = value as { _id?: unknown };
  return String(withId._id ?? value);
}
