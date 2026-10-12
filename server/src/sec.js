import { cached, HOUR } from "./yahoo.js";

// SEC EDGAR asks every client to identify itself in the User-Agent.
export const SEC_HEADERS = {
  "User-Agent": process.env.SEC_USER_AGENT || "mi-portafolio/1.0 (personal finance app)",
  Accept: "application/json",
};

const FILING_LABELS = {
  "10-Q": "Informe trimestral (10-Q)",
  "10-K": "Informe anual (10-K)",
  "6-K": "Informe de emisor extranjero (6-K)",
  "20-F": "Informe anual extranjero (20-F)",
  "40-F": "Informe anual extranjero (40-F)",
  "8-K": "Hecho relevante (8-K)",
};

async function secJson(url) {
  const res = await fetch(url, { headers: SEC_HEADERS, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`SEC HTTP ${res.status}`);
  return res.json();
}

// Ticker -> CIK (the SEC company id), from the SEC's public ticker list.
function cikFor(symbol) {
  return cached("sec:tickers", 24 * HOUR, async () => {
    const data = await secJson("https://www.sec.gov/files/company_tickers.json");
    return new Map(Object.values(data).map((c) => [String(c.ticker).toUpperCase(), c.cik_str]));
  }).then((map) => map.get(symbol.toUpperCase()) ?? map.get(symbol.toUpperCase().replace(".", "-")) ?? null);
}

// Yahoo suffixes of non-US listings (BNP.PA, SAN.MC, SAP.DE…). Share classes
// such as BRK.B use other letters, so they still go to the SEC lookup.
const FOREIGN_SUFFIX = /\.(PA|MC|DE|F|L|AS|BR|MI|LS|SW|ST|OL|CO|HE|VI|IR|TO|V|AX|HK|T|SS|SZ|KS|NS|BO|SA|MX|BA|SN|JO|TW|SI|NZ|TA)$/i;
const NOT_SEC = "Empresa no sujeta a regulación SEC de EE.UU.";

// Latest periodic reports and material events filed with the SEC. Companies
// without a CIK (most non-US listings) get `available: false` instead of an error.
export async function secFilings(symbol) {
  if (FOREIGN_SUFFIX.test(symbol)) return { available: false, reason: NOT_SEC, filings: [] };
  const cik = await cikFor(symbol);
  if (!cik) return { available: false, reason: NOT_SEC, filings: [] };
  const filings = await cached(`sec:filings:${cik}`, 6 * HOUR, async () => {
    const data = await secJson(`https://data.sec.gov/submissions/CIK${String(cik).padStart(10, "0")}.json`);
    const r = data.filings?.recent ?? {};
    const out = [];
    for (let i = 0; i < (r.form?.length ?? 0) && out.length < 20; i++) {
      const type = r.form[i];
      if (!FILING_LABELS[type]) continue;
      const acc = r.accessionNumber[i];
      const base = `https://www.sec.gov/Archives/edgar/data/${cik}/${acc.replace(/-/g, "")}`;
      out.push({
        date: r.filingDate[i],
        type,
        label: FILING_LABELS[type],
        title: r.primaryDocDescription?.[i] || type,
        documentUrl: r.primaryDocument?.[i] ? `${base}/${r.primaryDocument[i]}` : null,
        viewUrl: `${base}/${acc}-index.htm`,
      });
    }
    return out;
  });
  return { available: true, reason: null, filings };
}

// Download proxy only accepts documents from the SEC archive.
export const isSecDocument = (url) => /^https:\/\/www\.sec\.gov\/Archives\/edgar\/data\/[\w/.-]+$/.test(url);
