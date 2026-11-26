/**
 * Shared form checks. Each function returns an error message, or "" when the value is fine.
 * Messages are written for the user, so they say what to type instead.
 */

const hasLetters = (v: string) => /\p{L}/u.test(v);
const onlyDigitsAndSymbols = (v: string) => !hasLetters(v);
const isOneRepeatedChar = (v: string) => /^(.)\1+$/u.test(v.replace(/\s/g, ""));
const words = (v: string) => v.trim().split(/\s+/).filter((w) => hasLetters(w));

/** Turns "0300-123 4567" or "+92 300 1234567" into "03001234567" / "+923001234567". */
export const normalizePhone = (v: string) => v.trim().replace(/[\s\-().]/g, "");

export function validatePhone(raw: string, { required = false } = {}): string {
  const v = raw.trim();
  if (!v) return required ? "Please enter your phone number." : "";
  if (hasLetters(v)) return "A phone number can only contain digits. Write it like 03001234567 or +923001234567.";

  const p = normalizePhone(v);
  if (/[^\d+]/.test(p) || p.indexOf("+") > 0) return "Use digits only, for example 03001234567 or +923001234567.";
  if (p.startsWith("0092")) return "Write +92 instead of 0092, for example +923001234567.";
  if (p.startsWith("+")) {
    if (!p.startsWith("+92")) return "Only Pakistani numbers are accepted. Start with +92 or 03.";
    if (p[3] !== "3") return "After +92 a mobile number starts with 3, for example +923001234567.";
    if (p.length !== 13) return `A +92 number has 12 digits after the + (you typed ${p.length - 1}). Example: +923001234567.`;
    return "";
  }
  if (p.startsWith("92") && p.length === 12) return "Add a + at the start: +" + p + ".";
  if (!p.startsWith("03")) return "A phone number must start with 03 or +92, for example 03001234567.";
  if (p.length !== 11) return `A number starting with 03 has 11 digits (you typed ${p.length}). Example: 03001234567.`;
  return "";
}

export function validateEmail(raw: string, { required = true } = {}): string {
  const v = raw.trim();
  if (!v) return required ? "Please enter your email address." : "";
  if (/\s/.test(v)) return "An email address cannot contain spaces.";
  const at = (v.match(/@/g) || []).length;
  if (at === 0) return "Your email is missing the @ sign. It should look like name@gmail.com.";
  if (at > 1) return "An email address can only have one @ sign.";
  const [user, domain] = v.split("@");
  if (!user) return "Add your name before the @, for example ali@gmail.com.";
  if (!domain) return "Add the email provider after the @, for example @gmail.com.";
  if (!domain.includes(".")) return `"${domain}" is not complete. Did you mean ${domain}.com? Example: name@gmail.com.`;
  if (/\.\./.test(v) || domain.startsWith(".") || domain.endsWith(".")) return "Check the dots in your email address. Example: name@gmail.com.";
  const tld = domain.split(".").pop() || "";
  if (tld.length < 2 || !/^[a-z]+$/i.test(tld)) return `".${tld}" is not a valid ending. Use something like .com or .pk.`;
  const typos: Record<string, string> = {
    "gmial.com": "gmail.com", "gmal.com": "gmail.com", "gmail.co": "gmail.com", "gamil.com": "gmail.com",
    "gmail.con": "gmail.com", "yahoo.co": "yahoo.com", "yaho.com": "yahoo.com", "hotmial.com": "hotmail.com",
    "outlok.com": "outlook.com",
  };
  const fix = typos[domain.toLowerCase()];
  if (fix) return `Did you mean ${user}@${fix}?`;
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v)) return "Please enter a valid email address, like name@gmail.com.";
  return "";
}

export function validateItemName(raw: string): string {
  const v = raw.trim();
  if (!v) return "Please enter the name of the item.";
  if (onlyDigitsAndSymbols(v)) return "The item name must contain words, not only numbers. Example: Black leather wallet.";
  if (v.length < 3) return "The item name is too short. Use at least 3 letters, like \"Keys\" or \"Phone\".";
  if (isOneRepeatedChar(v)) return "Please write the real name of the item.";
  if (v.length > 60) return "Keep the item name under 60 characters. Put extra details in the description.";
  return "";
}

export function validateDescription(raw: string): string {
  const v = raw.trim();
  if (!v) return "Please describe the item.";
  if (onlyDigitsAndSymbols(v)) return "The description must contain words, not only numbers or symbols.";
  if (isOneRepeatedChar(v)) return "Please write a real description of the item.";
  if (v.length < 10 || words(v).length < 2)
    return "Add a little more detail (at least 10 characters): colour, brand, size or any marks.";
  return "";
}

export function validatePlace(raw: string): string {
  const v = raw.trim();
  if (!v) return "Please enter where it happened.";
  if (onlyDigitsAndSymbols(v)) return "Write the place in words, for example \"Main bazaar bus stand\".";
  if (v.length < 3) return "The place is too short. Name a landmark people know.";
  if (isOneRepeatedChar(v)) return "Please write a real place or landmark.";
  return "";
}

export function validateDate(value: string, label = "date"): string {
  if (!value) return `Please choose the ${label}.`;
  const d = new Date(value + "T00:00:00");
  if (isNaN(d.getTime())) return `Please choose a valid ${label}.`;
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (d > today) return `The ${label} cannot be in the future.`;
  const oldest = new Date();
  oldest.setFullYear(oldest.getFullYear() - 2);
  if (d < oldest) return `The ${label} is more than 2 years ago. Please check it.`;
  return "";
}

export function validateFullName(raw: string): string {
  const v = raw.trim();
  if (!v) return "Please enter your full name.";
  if (/\d/.test(v)) return "Your name cannot contain numbers.";
  if (!/^[\p{L}\s.'-]+$/u.test(v)) return "Your name can only contain letters, spaces, dots and hyphens.";
  if (v.replace(/\s/g, "").length < 3) return "Your name is too short. Please enter your full name.";
  if (isOneRepeatedChar(v)) return "Please enter your real name.";
  if (v.length > 50) return "Your name is too long (50 characters maximum).";
  return "";
}

export function validatePassword(v: string): string {
  if (!v) return "Please enter a password.";
  if (v.length < 8) return "Your password must have at least 8 characters.";
  if (!/[A-Za-z]/.test(v) || !/\d/.test(v)) return "Use both letters and numbers in your password.";
  if (/^(.)\1+$/.test(v) || /^(12345678|password|qwerty)/i.test(v)) return "This password is too easy to guess. Choose a stronger one.";
  return "";
}

const MAX_IMAGE_MB = 5;
export function validateImageFile(f: File): string {
  if (!f.type.startsWith("image/")) return `"${f.name}" is not an image. Please choose a JPG or PNG photo.`;
  if (f.size > MAX_IMAGE_MB * 1024 * 1024) return `"${f.name}" is larger than ${MAX_IMAGE_MB} MB. Please choose a smaller photo.`;
  return "";
}

/** Used when the category is "Other": the user says what kind of item it is. */
export function validateOtherType(raw: string): string {
  const v = raw.trim();
  if (!v) return "You picked \"Other\". Please tell us what kind of item it is, e.g. Umbrella, Watch, Toy.";
  if (onlyDigitsAndSymbols(v)) return "Write the type of item in words, for example \"Umbrella\" or \"Water bottle\".";
  if (v.replace(/\s/g, "").length < 3) return "That is too short. Use at least 3 letters, like \"Cap\" or \"Toy car\".";
  if (isOneRepeatedChar(v)) return "Please write what the item really is.";
  if (v.length > 40) return "Keep it short (under 40 characters). Put the details in the description below.";
  return "";
}

/** A date `yearsAgo` years before today, as YYYY-MM-DD (default 2 = oldest allowed report date; 0 = today). */
export const oldestReportDate = (yearsAgo = 2) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - yearsAgo);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

/** Why the reporter is using an AI-generated photo instead of a real one. */
export function validateAiReason(raw: string): string {
  const v = raw.trim();
  if (!v) return "Please explain why you are using an AI-generated image.";
  if (onlyDigitsAndSymbols(v) || isOneRepeatedChar(v)) return "Please write a real explanation in words.";
  if (v.length < 15 || words(v).length < 3) return "Please explain a little more (at least 15 characters).";
  if (v.length > 300) return "Keep the explanation under 300 characters.";
  return "";
}

/** Public comments under an item. Contact details are blocked to keep users safe. */
export function validateComment(raw: string): string {
  const v = raw.trim();
  if (!v) return "Write something before posting.";
  if (onlyDigitsAndSymbols(v) || isOneRepeatedChar(v)) return "Please write your comment in words.";
  if (v.length < 2) return "Your comment is too short.";
  if (v.length > 1000) return "Comments can be at most 1000 characters.";
  const digits = v.replace(/[\s\-().]/g, "");
  if (/(\+92|0092|\b0)3\d{9}/.test(digits) || /\b3\d{9}\b/.test(digits))
    return "For your safety, don't post phone numbers in public comments. Use Messages to contact the admin instead.";
  if (/[^\s@]+@[^\s@]+\.[a-z]{2,}/i.test(v))
    return "For your safety, don't post email addresses in public comments. Use Messages to contact the admin instead.";
  return "";
}
