// Comprehensive Email Validation Utility

const DISPOSABLE_DOMAINS = new Set([
  "tempmail.com",
  "temp-mail.org",
  "mailinator.com",
  "10minutemail.com",
  "guerrillamail.com",
  "trashmail.com",
  "yopmail.com",
  "dispostable.com",
  "getnada.com",
  "fakeinbox.com",
  "throwawaymail.com",
  "maildrop.cc",
  "sharklasers.com",
  "boun.cr",
  "0815.ru",
  "10minutemail.net"
]);

const DOMAIN_TYPOS: Record<string, string> = {
  "gmai.com": "gmail.com",
  "gmial.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gmal.com": "gmail.com",
  "gmaill.com": "gmail.com",
  "hotmial.com": "hotmail.com",
  "hotmai.com": "hotmail.com",
  "hotmali.com": "hotmail.com",
  "outlok.com": "outlook.com",
  "outloo.com": "outlook.com",
  "yaho.com": "yahoo.com",
  "yahooo.com": "yahoo.com",
  "iclou.com": "icloud.com",
  "iclod.com": "icloud.com"
};

export interface EmailValidationResult {
  isValid: boolean;
  error?: string;
  suggestion?: string;
  isDisposable?: boolean;
}

export function validateEmail(email: string): EmailValidationResult {
  const trimmed = email.trim().toLowerCase();

  if (!trimmed) {
    return { isValid: false, error: "กรุณากรอกอีเมล" };
  }

  // Basic regex check for format
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(trimmed)) {
    return { isValid: false, error: "รูปแบบอีเมลไม่ถูกต้อง (เช่น student@example.com)" };
  }

  const parts = trimmed.split("@");
  if (parts.length !== 2) {
    return { isValid: false, error: "อีเมลต้องมีสัญลักษณ์ @ เพียง 1 ตัว" };
  }

  const [localPart, domainPart] = parts;

  if (localPart.length < 2) {
    return { isValid: false, error: "ชื่อหน้า @ สั้นเกินไป" };
  }

  if (localPart.startsWith(".") || localPart.endsWith(".") || localPart.includes("..")) {
    return { isValid: false, error: "ชื่อหน้า @ มีจุดซ้ำหรือวางผิดตำแหน่ง" };
  }

  // Check disposable domains
  if (DISPOSABLE_DOMAINS.has(domainPart)) {
    return {
      isValid: false,
      isDisposable: true,
      error: "ไม่สามารถใช้อีเมลชั่วคราว (Disposable Email) สมัครสมาชิกได้"
    };
  }

  // Check typo suggestions
  if (DOMAIN_TYPOS[domainPart]) {
    const suggestedDomain = DOMAIN_TYPOS[domainPart];
    const suggestedEmail = `${localPart}@${suggestedDomain}`;
    return {
      isValid: false,
      suggestion: suggestedEmail,
      error: `โดเมนอีเมลอาจพิมพ์ผิด คุณหมายถึง ${suggestedEmail} หรือไม่?`
    };
  }

  // Check valid TLD structure
  const domainParts = domainPart.split(".");
  const tld = domainParts[domainParts.length - 1];
  if (tld.length < 2) {
    return { isValid: false, error: "นามสกุลโดเมนอีเมลไม่ถูกต้อง" };
  }

  return { isValid: true };
}
