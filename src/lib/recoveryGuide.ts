/**
 * Built-in recovery guidance for important lost items in Pakistan / AJK.
 * Used for instant answers in the assistant, and given to the AI as its reference.
 * Keep wording general: offices, fees and procedures change, so users are told to confirm locally.
 */

export type GuideAction = { label: string; href: string };
export type GuideTopic = {
  id: string;
  label: string;
  emoji: string;
  keywords: string[];
  answer: string; // light markdown: **bold**, "- " bullets, "1. " steps
  actions?: GuideAction[];
};

const REPORT_HERE: GuideAction = { label: "Report it on this site", href: "/report-lost" };
const SEARCH_FOUND: GuideAction = { label: "Search found items", href: "/" };

export const GUIDE: GuideTopic[] = [
  {
    id: "cnic",
    label: "Lost CNIC / ID card",
    emoji: "🪪",
    keywords: ["cnic", "id card", "identity card", "shanakhti", "nic", "nadra", "smart card", "b-form", "bform", "شناختی"],
    answer: `Losing your **CNIC** is serious because someone could misuse it. Do this:

1. **Report the loss at your nearest police station.** Ask for a written loss report (an entry in the daily diary / roznamcha). Keep a copy; banks and offices may ask for it.
2. **Check SIMs on your CNIC:** send your CNIC number (without dashes) by SMS to **668** (PTA service). If you see a SIM you don't own, ask that mobile company to block it.
3. **Get a duplicate (reprint) from NADRA:** apply online through the **Pak-ID** app/website, or visit any **NADRA Registration Centre** (there is one in every AJK district). Bring a copy of the old CNIC if you have one.
4. **Tell your bank** so they watch for misuse of your identity.
5. **Post it here** as a lost item. Someone may have found it and handed it to the admin office.

NADRA helpline: **1777**. Fees and processing times change, so confirm with NADRA.`,
    actions: [REPORT_HERE, SEARCH_FOUND],
  },
  {
    id: "licence",
    label: "Lost driving licence",
    emoji: "🚗",
    keywords: ["licence", "license", "driving", "dl ", "lisance", "lisence", "driving licence"],
    answer: `To replace a lost **driving licence**:

1. **Get a police loss report** from your nearest police station.
2. **Go to the licensing office that issued it.** In AJK this is the district **Traffic Police licensing branch**.
3. Usually you need: the **police report**, a **copy of your CNIC**, recent **photographs**, and the **duplicate-licence fee**. Your old licence number helps a lot if you have a photo or copy of it.
4. Until you get the duplicate, carry the police report while driving and avoid long trips.

Requirements differ by district, so call or visit the licensing branch first.`,
    actions: [REPORT_HERE],
  },
  {
    id: "passport",
    label: "Lost passport",
    emoji: "🛂",
    keywords: ["passport", "pasport", "visa"],
    answer: `For a lost **passport**:

1. **Report it to the police** straight away and get a written loss report. It is required for a new passport.
2. **Apply for a replacement** at your nearest **Passport Office** (Directorate General of Immigration & Passports), or online where available. Bring your **CNIC** and the **police report**. A lost-passport case usually has a higher fee than a normal renewal.
3. **If you are abroad:** report to local police and contact the **Pakistan Embassy / Consulate** for an emergency travel document.
4. If it had a valid visa, inform the embassy of that country too.`,
    actions: [REPORT_HERE],
  },
  {
    id: "phone",
    label: "Lost mobile phone",
    emoji: "📱",
    keywords: ["phone", "mobile", "smartphone", "iphone", "samsung", "sim", "imei", "fone"],
    answer: `If your **mobile phone** is lost or stolen:

1. **Block your SIM** at once: call your mobile company's helpline or visit their franchise. Get a **duplicate SIM** with the same number (biometric check with your CNIC).
2. **Report to the police** and get a written report. Note your phone's **IMEI** number (it's on the box or bill; dial *#06# on a phone to see it).
3. **Ask PTA to block the IMEI** using the police report, so the phone cannot be used on Pakistani networks.
4. **Secure your accounts:** change passwords for WhatsApp, email, banking apps. Use "Find My Device" (Android) or "Find My" (iPhone) to locate or erase it.
5. **Post it here** with the brand, colour and cover details.`,
    actions: [REPORT_HERE, SEARCH_FOUND],
  },
  {
    id: "bank",
    label: "Lost bank / ATM card",
    emoji: "💳",
    keywords: ["atm", "debit", "credit", "bank", "card", "cheque", "check book", "chequebook", "wallet"],
    answer: `For a lost **ATM / debit / credit card** or **cheque book**, act fast:

1. **Call your bank's 24/7 helpline right now** and block the card (the number is on the bank's website, app or statement). Most bank apps also let you block a card yourself.
2. For a **cheque book**, ask the bank to **stop payment** on the missing cheque numbers.
3. **Check recent transactions** and report any you don't recognise.
4. Ask for a **replacement card**. Some banks may ask for a police report for a cheque book.
5. If your **wallet** had your CNIC too, see the CNIC steps.`,
    actions: [REPORT_HERE],
  },
  {
    id: "certificates",
    label: "Lost degree / certificates",
    emoji: "🎓",
    keywords: ["degree", "certificate", "marksheet", "result card", "transcript", "matric", "intermediate", "domicile", "prc", "diploma", "documents"],
    answer: `For lost **degrees, certificates or official documents**:

1. **Get a police loss report.**
2. **Apply for a duplicate from the office that issued it:**
   - Matric / Inter: your **Board** (e.g. BISE Mirpur in AJK)
   - Degree / transcript: your **university's examinations department**
   - Domicile / PRC: the **Deputy Commissioner's office** of your district
3. Some offices also ask for a **newspaper advertisement** about the loss and an **affidavit**, so ask them what they need.
4. Keep scanned copies of new documents in a safe place (e.g. email to yourself).`,
    actions: [REPORT_HERE],
  },
  {
    id: "vehicle",
    label: "Lost vehicle documents",
    emoji: "🏍️",
    keywords: ["registration", "vehicle", "car", "bike", "motorcycle", "number plate", "excise", "file", "smart card vehicle"],
    answer: `For a lost **vehicle registration book / card**:

1. **Get a police loss report.**
2. Apply for a **duplicate at the Excise & Taxation office** where the vehicle is registered. Bring your **CNIC**, the **police report**, and vehicle details (registration, chassis and engine numbers).
3. If the **vehicle itself was stolen**, register an **FIR** at the police station immediately and inform your insurance company.`,
    actions: [REPORT_HERE],
  },
  {
    id: "general",
    label: "Something else",
    emoji: "📦",
    keywords: ["bag", "keys", "laptop", "watch", "jewelry", "gold", "money", "purse", "book"],
    answer: `For other lost items:

1. **Retrace your steps** and ask at places you visited (shops, transport stand, mosque, office reception).
2. **Report it on this site** with a clear description and photo. We compare it with found items across all ten districts, and you're notified on a match.
3. **Check the found items** list regularly.
4. For **valuable items** (gold, cash, laptop) or if you think it was **stolen**, report to the police. Call **15** in an emergency.`,
    actions: [REPORT_HERE, SEARCH_FOUND],
  },
];

/** Best topic for a free-text question, or null. */
export function matchTopic(text: string): GuideTopic | null {
  const t = ` ${text.toLowerCase()} `;
  let best: GuideTopic | null = null;
  let bestScore = 0;
  for (const g of GUIDE) {
    const score = g.keywords.reduce((s, k) => s + (t.includes(k) ? k.length : 0), 0);
    if (score > bestScore) {
      best = g;
      bestScore = score;
    }
  }
  return best;
}

/** Reference text for the AI's system prompt. */
export const GUIDE_FOR_AI = GUIDE.map((g) => `### ${g.label}\n${g.answer}`).join("\n\n");
