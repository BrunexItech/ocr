const ACRONYMS = new Set(["id", "dob", "kra", "pin", "url", "ocr", "mrz", "ke"]);

// ISO 3166-1 alpha-3 -> name, mirroring the backend's list (app/pipeline/mrz.py
// COUNTRY_NAMES) - display-only, so a code this doesn't recognise just shows as-is
// rather than anything being guessed.
const COUNTRY_NAMES: Record<string, string> = {
  KEN: "Kenya", UGA: "Uganda", TZA: "Tanzania", RWA: "Rwanda", BDI: "Burundi",
  ETH: "Ethiopia", SOM: "Somalia", SSD: "South Sudan", SDN: "Sudan", ZMB: "Zambia",
  MWI: "Malawi", MOZ: "Mozambique", ZAF: "South Africa", NGA: "Nigeria", GHA: "Ghana",
  USA: "United States", GBR: "United Kingdom", CAN: "Canada", IND: "India", CHN: "China",
};

/** For a field known to hold an ISO 3166-1 alpha-3 country code (issuing_country,
 * nationality), show the country name next to the raw code when recognised - the
 * raw code alone ("KYA", "KEN") means nothing to someone reading the scan result. */
export function humanizeCountryCode(code: string): string {
  const name = COUNTRY_NAMES[code?.toUpperCase?.()];
  return name ? `${name} (${code.toUpperCase()})` : code;
}

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
