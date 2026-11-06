const ACRONYMS = new Set(["id", "dob", "kra", "pin", "url", "ocr", "mrz", "ke"]);

/** Turns a raw field key ("id_number", "date_of_birth") into a human label
 * ("ID Number", "Date Of Birth") instead of showing the schema's internal snake_case
 * key verbatim - that key is a programming identifier, not something meant to be read. */
export function humanizeFieldKey(key: string): string {
  return key
    .split("_")
    .filter(Boolean)
    .map((word) => (ACRONYMS.has(word.toLowerCase()) ? word.toUpperCase() : word[0].toUpperCase() + word.slice(1)))
    .join(" ");
}
