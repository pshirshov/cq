/**
 * attachment.ts — converts a browser File to the wire attachment shape.
 *
 * The kind is determined by the MIME type prefix:
 *   "image/*" → "image"
 *   everything else → "file"
 *
 * dataBase64 is produced via FileReader.readAsDataURL and the data-URI prefix
 * is stripped, leaving only the raw base64 payload.
 */

export interface Attachment {
  kind: "image" | "file";
  mimeType: string;
  name: string;
  dataBase64: string;
}

/**
 * Read a File and return an Attachment ready to include in a ChatInput frame.
 * Uses FileReader so it works in all browsers (avoids TextDecoder/ArrayBuffer
 * path that requires extra base64 encoding of binary).
 */
export function fileToAttachment(file: File): Promise<Attachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // data-URI format: "data:<mime>;base64,<payload>"
      const comma = result.indexOf(",");
      if (comma === -1) {
        reject(new Error("FileReader returned unexpected data-URI format"));
        return;
      }
      const dataBase64 = result.slice(comma + 1);
      const kind: "image" | "file" = file.type.startsWith("image/") ? "image" : "file";
      resolve({
        kind,
        mimeType: file.type || "application/octet-stream",
        name: file.name,
        dataBase64,
      });
    };
    reader.onerror = () => reject(reader.error ?? new Error("FileReader error"));
    reader.readAsDataURL(file);
  });
}
