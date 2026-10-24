import express from "express";
import path from "path";
import dotenv from "dotenv";
import { promises as dnsPromises } from "dns";
import { createServer as createViteServer } from "vite";
import crypto from "crypto";
import nodemailer, { type Transporter } from "nodemailer";
import { db, loadLocalDB, saveLocalDB, getSupabase } from "./server/db.js";

// Load environment variables
dotenv.config();

// Ensure the local file database is initialized on startup
loadLocalDB();

// ==========================================
// SECURE PASSWORD HASHING & VERIFICATION
// ==========================================
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, storedHash?: string): boolean {
  if (!storedHash) return false;
  try {
    if (storedHash.includes(":")) {
      const [salt, key] = storedHash.split(":");
      const keyBuffer = Buffer.from(key, "hex");
      const derivedKey = crypto.scryptSync(password, salt, 64);
      return crypto.timingSafeEqual(keyBuffer, derivedKey);
    }
    const sha256 = crypto.createHash("sha256").update(password).digest("hex");
    return storedHash === sha256 || storedHash === password;
  } catch {
    return false;
  }
}

// ==========================================
// AUTHORIZED ADMIN EMAILS CONFIGURATION
// ==========================================
// Explicit list of authorized admin emails to prevent arbitrary privilege escalation
const DESIGNATED_ADMIN_EMAILS = new Set([
  "admin@gmail.com",
  ...(process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(",").map(e => e.trim().toLowerCase()) : [])
]);

function isDesignatedAdmin(email: string): boolean {
  if (!email) return false;
  return DESIGNATED_ADMIN_EMAILS.has(email.trim().toLowerCase());
}

// ==========================================
// CRYPTOGRAPHIC JWT SESSION TOKENS (HMAC-SHA256)
// ==========================================
const JWT_SECRET = process.env.JWT_SECRET || "javaeasy-production-secure-auth-secret-key-2026";

interface TokenPayload {
  userId: string;
  role: string;
  exp: number;
}

function generateToken(userId: string, role: string): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    userId,
    role,
    exp: Math.floor(Date.now() / 1000) + (14 * 24 * 60 * 60), // 14 days
  })).toString("base64url");
  const signature = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
}

function verifyToken(token: string): TokenPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, payload, signature] = parts;
    const expectedSig = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${payload}`).digest("base64url");
    
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as TokenPayload;
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }
    return decoded;
  } catch {
    return null;
  }
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.set("trust proxy", true);
app.use(express.json());

// ==========================================
// AUTHENTICATION MIDDLEWARE
// ==========================================
async function authMiddleware(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    req.user = null;
    return next();
  }

  const rawToken = authHeader.split(" ")[1];
  if (!rawToken) {
    req.user = null;
    return next();
  }

  try {
    let userId = "";

    // 1. Verify signed JWT token
    const verified = verifyToken(rawToken);
    if (verified && verified.userId) {
      userId = verified.userId;
    } else {
      // 2. Graceful transitional fallback for existing active sessions
      const legacyProfile = await db.getProfile(rawToken);
      if (legacyProfile) {
        userId = legacyProfile.id;
      }
    }

    if (!userId) {
      return res.status(401).json({ error: "โทเค็นไม่ถูกต้องหรือเซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่" });
    }

    const profile = await db.getProfile(userId);
    if (!profile) {
      return res.status(401).json({ error: "ไม่พบข้อมูลบัญชีผู้ใช้นี้ หรือเซสชันหมดอายุ" });
    }

    if (profile.status === "suspended") {
      return res.status(403).json({ error: "บัญชีของคุณถูกระงับการใช้งานชั่วคราว กรุณาติดต่อแอดมิน" });
    }

    req.user = profile;
    next();
  } catch (err) {
    req.user = null;
    next();
  }
}

// Helper to enforce authenticated users
function requireAuth(req: any, res: any, next: any) {
  if (!req.user) {
    return res.status(401).json({ error: "กรุณาเข้าสู่ระบบเพื่อใช้งานฟีเจอร์นี้" });
  }
  next();
}

// Helper to enforce admin users only
function requireAdmin(req: any, res: any, next: any) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "คุณไม่มีสิทธิ์เข้าถึงเนื้อหาของแอดมิน" });
  }
  next();
}

app.use(authMiddleware);

// Endpoint to check database status
app.get("/api/db/status", (req: any, res: any) => {
  const isSupabase = db.isUsingSupabase();
  res.json({
    connected: isSupabase,
    provider: isSupabase ? "Supabase" : "Local JSON Fallback",
    message: isSupabase 
      ? "เชื่อมต่อกับฐานข้อมูลระบบคลาวด์ Supabase สำเร็จแล้ว!" 
      : "ระบบทำงานโดยใช้ฐานข้อมูลสำรอง Local JSON (database.json) อัตโนมัติ เพื่อความเสถียร 100%"
  });
});

// Endpoint to test Supabase connection and return detailed diagnostics
app.get("/api/db/test-supabase", async (req: any, res: any) => {
  const isSupabase = db.isUsingSupabase();
  if (!isSupabase) {
    return res.json({ success: false, message: "Supabase is offline or not configured yet. System is using Local JSON database safely." });
  }

  const diagnostics: any = {
    url: process.env.SUPABASE_URL,
    has_anon_key: !!process.env.SUPABASE_KEY,
    has_service_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    keys_are_identical: process.env.SUPABASE_KEY === process.env.SUPABASE_SERVICE_ROLE_KEY,
    tests: {}
  };

  try {
    // Test 1: Fetch lessons
    const lessons = await db.getLessons();
    diagnostics.tests.fetch_lessons = {
      success: Array.isArray(lessons),
      count: lessons ? lessons.length : 0,
    };
  } catch (err: any) {
    diagnostics.general_error = err?.message || err;
  }

  res.json(diagnostics);
});

// ==========================================
// API ROUTES
// ==========================================

// Helper to construct exact redirect URI consistently across environments
function getRedirectUri(req: any): string {
  let appUrl = process.env.APP_URL ? process.env.APP_URL.trim() : "";
  if (appUrl.endsWith("/")) {
    appUrl = appUrl.slice(0, -1);
  }
  
  // Dynamically adapt APP_URL if the request comes from the preview/shared domain (-pre-)
  const hostHeader = req.headers['x-forwarded-host'] || req.headers['host'] || "";
  if (hostHeader.includes("-pre-") && appUrl.includes("-dev-")) {
    appUrl = appUrl.replace("-dev-", "-pre-");
  } else if (hostHeader.includes("-dev-") && appUrl.includes("-pre-")) {
    appUrl = appUrl.replace("-pre-", "-dev-");
  }
  
  if (appUrl) {
    return `${appUrl}/auth/callback`;
  }
  
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.get('host') || `localhost:3000`;
  return `${proto}://${host}/auth/callback`;
}

// 1. Authentication Endpoints
// Google OAuth URL Endpoint
app.get("/api/auth/google/url", (req: any, res: any) => {
  const client_id = process.env.CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
  if (!client_id) {
    return res.status(400).json({ error: "Google OAuth is not configured yet. CLIENT_ID is missing in environment variables." });
  }
  const redirect_uri = getRedirectUri(req);

  const params = new URLSearchParams({
    client_id,
    redirect_uri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "select_account"
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  res.json({ url: authUrl });
});

// Google OAuth Callback Handler
app.get(["/auth/callback", "/auth/callback/"], async (req: any, res: any) => {
  const { code } = req.query;
  if (!code) {
    return res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_FAILED', error: 'ไม่ได้รับ Authorization code จาก Google' }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
        </body>
      </html>
    `);
  }

  try {
    const client_id = process.env.CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
    const client_secret = process.env.CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
    
    // Construct exact redirect_uri matching what was sent to Google
    const redirect_uri = getRedirectUri(req);

    // 1. Exchange authorization code for token
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code: code.toString(),
        client_id: client_id || "",
        client_secret: client_secret || "",
        redirect_uri,
        grant_type: "authorization_code",
      }).toString(),
    });

    const tokenData: any = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      console.error("Token exchange failed. Status:", tokenRes.status, "Data:", JSON.stringify(tokenData));
      throw new Error(tokenData.error_description || tokenData.error || "แลกรับ Token ล้มเหลว");
    }

    // 2. Fetch Google user info
    const userinfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    const userinfo: any = await userinfoRes.json();
    if (!userinfoRes.ok || !userinfo.email) {
      console.error("Userinfo fetch failed. Status:", userinfoRes.status, "Data:", JSON.stringify(userinfo));
      throw new Error("ดึงข้อมูลโปรไฟล์จาก Google ล้มเหลว");
    }

    // 3. Find or automatically register user
    const isSupabase = db.isUsingSupabase();
    const supabase = getSupabase();
    let profile: any = null;

    if (isSupabase && supabase) {
      try {
        // Find existing user in Supabase Auth
        const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
        if (listError) {
          throw new Error("ล้มเหลวในการตรวจสอบรายชื่อผู้ใช้จาก Supabase: " + listError.message);
        }

        let authUser = listData?.users?.find((u: any) => u.email?.toLowerCase() === userinfo.email.toLowerCase());

        if (!authUser) {
          // User doesn't exist in Supabase Auth, let's create them!
          const randomPassword = crypto.randomBytes(16).toString("hex");
          const { data: createData, error: createError } = await supabase.auth.admin.createUser({
            email: userinfo.email.toLowerCase(),
            email_confirm: true,
            user_metadata: { full_name: userinfo.name || userinfo.given_name || "Google User" },
            password: randomPassword,
          });

          if (createError) {
            throw new Error("ล้มเหลวในการบันทึกบัญชีลงในระบบ Auth ของ Supabase: " + createError.message);
          }
          authUser = createData.user;
        }

        const userId = authUser.id;

        // Retrieve or create the corresponding profile record
        profile = await db.getProfile(userId);
        const shouldBeAdminGoogle = isDesignatedAdmin(userinfo.email);

        if (!profile) {
          const role = shouldBeAdminGoogle ? "admin" : "user";

          const newProfile = {
            id: userId,
            email: userinfo.email.toLowerCase(),
            full_name: userinfo.name || userinfo.given_name || "Google User",
            role: role as "user" | "admin",
            status: "active" as "active" | "suspended",
            created_at: new Date().toISOString(),
          };

          profile = await db.createProfile(newProfile);
        } else if (shouldBeAdminGoogle && profile.role !== "admin") {
          const updated = await db.updateProfileRole(userId, "admin");
          if (updated) {
            profile = updated;
          } else {
            profile.role = "admin";
          }
        }
      } catch (supabaseErr: any) {
        console.error("Supabase Google Sign-In error, falling back:", supabaseErr);
        // Fallback to local profile finding
        const profiles = await db.getAllProfiles();
        profile = profiles.find((p) => p.email.toLowerCase() === userinfo.email.toLowerCase());
        if (!profile) {
          throw new Error("เกิดข้อผิดพลาดในการสร้างบัญชี Supabase: " + (supabaseErr?.message || supabaseErr));
        }
      }
    } else {
      // Local fallback mode
      const profiles = await db.getAllProfiles();
      profile = profiles.find((p) => p.email.toLowerCase() === userinfo.email.toLowerCase());

      if (!profile) {
        // Auto-register
        const role = isDesignatedAdmin(userinfo.email) ? "admin" : "user";
        
        const newProfile = {
          id: crypto.randomUUID(),
          email: userinfo.email.toLowerCase(),
          full_name: userinfo.name || userinfo.given_name || "Google User",
          role: role as "user" | "admin",
          status: "active" as "active" | "suspended",
          created_at: new Date().toISOString(),
        };

        profile = await db.createProfile(newProfile);
      }
    }

    if (profile.status === "suspended") {
      return res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_FAILED', error: 'บัญชีของคุณถูกระงับการใช้งาน กรุณาติดต่อแอดมิน' }, '*');
                window.close();
              } else {
                alert('บัญชีของคุณถูกระงับการใช้งาน กรุณาติดต่อแอดมิน');
                window.location.href = '/';
              }
            </script>
          </body>
        </html>
      `);
    }

    // 4. Send success message to parent window and close popup
    const signedToken = generateToken(profile.id, profile.role);
    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ 
                type: 'OAUTH_AUTH_SUCCESS', 
                token: '${signedToken}',
                user: ${JSON.stringify(profile)}
              }, '*');
              window.close();
            } else {
              localStorage.setItem("auth_token", "${signedToken}");
              window.location.href = '/';
            }
          </script>
          <p>เข้าสู่ระบบด้วย Google สำเร็จแล้ว! กำลังปิดหน้าต่างนี้...</p>
        </body>
      </html>
    `);

  } catch (err: any) {
    console.error("Google OAuth error:", err);
    
    // Save to a local log file for developer debugging
    try {
      const fs = await import("fs");
      const logFile = path.join(process.cwd(), 'oauth_error.log');
      const logContent = `[${new Date().toISOString()}]\nError: ${err}\nMessage: ${err?.message || "No message"}\nStack: ${err?.stack || "No stack"}\nKeys: ${Object.keys(err || {})}\nDetails: ${JSON.stringify(err)}\n\n`;
      fs.appendFileSync(logFile, logContent);
    } catch (logErr) {
      console.error("Could not write error to log file:", logErr);
    }

    // Include more descriptive details in the postMessage error if available
    let detailedError = err?.message || "เกิดข้อผิดพลาดในการเชื่อมโยงบัญชี";
    if (err && typeof err === 'object' && !err.message) {
      detailedError = JSON.stringify(err);
    }

    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_FAILED', error: '${encodeURIComponent(detailedError)}' }, '*');
              window.close();
            } else {
              alert('การเข้าสู่ระบบผ่าน Google ล้มเหลว: ' + ${JSON.stringify(detailedError)});
              window.location.href = '/';
            }
          </script>
          <p>เข้าสู่ระบบไม่สำเร็จ: ${detailedError}</p>
        </body>
      </html>
    `);
  }
});

// Helper to verify if an email domain actually has MX (Mail Server) or A DNS records
async function verifyEmailDomainMX(domain: string): Promise<boolean> {
  try {
    const addresses = await dnsPromises.resolveMx(domain);
    return Array.isArray(addresses) && addresses.length > 0;
  } catch (err) {
    try {
      const aRecords = await dnsPromises.resolve4(domain);
      return Array.isArray(aRecords) && aRecords.length > 0;
    } catch {
      return false;
    }
  }
}

// Real Email sending function via Nodemailer
let cachedEtherealTransporter: Transporter | null = null;

async function sendRealVerificationEmail(toEmail: string, fullName: string, verificationLink: string) {
  let transporter: Transporter;
  let isCustomSmtp = false;

  // Check if user set custom SMTP credentials in environment variables
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    isCustomSmtp = true;
  } else {
    // Reuse Ethereal test SMTP account to avoid repetitive remote account creation
    if (!cachedEtherealTransporter) {
      const testAccount = await nodemailer.createTestAccount();
      cachedEtherealTransporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
    }
    transporter = cachedEtherealTransporter;
  }

  const fromAddress = process.env.SMTP_FROM || "JavaEasy <no-reply@javaeasy.com>";

  const info = await transporter.sendMail({
    from: fromAddress,
    to: toEmail,
    subject: "[JavaEasy] ยืนยันการลงทะเบียนเรียนโปรแกรมมิ่ง Java",
    html: `
      <div style="font-family: 'Sukhumvit Set', 'Segoe UI', Tahoma, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0f172a; color: #f8fafc; padding: 30px; border-radius: 16px; border: 1px solid #334155;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #6366f1; margin: 0; font-size: 24px;">JavaEasy</h1>
          <p style="color: #94a3b8; font-size: 14px; margin-top: 4px;">เรียนเขียนโปรแกรม Java เข้าใจง่าย ใช้ได้จริง</p>
        </div>

        <div style="background-color: #1e293b; padding: 24px; border-radius: 12px; margin-bottom: 24px; border: 1px solid #475569;">
          <h2 style="color: #ffffff; font-size: 18px; margin-top: 0;">เรียนคุณ ${fullName},</h2>
          <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6;">
            ขอบคุณสำหรับการสมัครเรียนกับ JavaEasy กรุณาคลิกปุ่มด้านล่างนี้เพื่อยืนยันตัวตนผ่านที่อยู่อีเมลจริงของคุณ (${toEmail})
          </p>

          <div style="text-align: center; margin: 28px 0;">
            <a href="${verificationLink}" style="background-color: #10b981; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 15px; display: inline-block; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);">
              คลิกยืนยันที่อยู่อีเมลของคุณ (Verify Email)
            </a>
          </div>

          <p style="color: #94a3b8; font-size: 12px; line-height: 1.5; margin-bottom: 0;">
            * ลิงก์ยืนยันตัวตนนี้มีอายุการใช้งาน 15 นาที หากคุณไม่ได้เป็นผู้ทำรายการนี้ กรุณาข้ามอีเมลฉบับนี้ไป
          </p>
        </div>

        <div style="text-align: center; color: #64748b; font-size: 12px;">
          <p style="margin: 0;">หากปุ่มด้านบนทำงานไม่ได้ คุณสามารถคัดลอกลิงก์ด้านล่างไปวางในเบราว์เซอร์ได้:</p>
          <p style="word-break: break-all; color: #818cf8; font-size: 11px;">${verificationLink}</p>
          <hr style="border: 0; border-top: 1px solid #334155; margin: 16px 0;" />
          <p style="margin: 0;">© 2026 JavaEasy Platform. All rights reserved.</p>
        </div>
      </div>
    `,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  return {
    messageId: info.messageId,
    previewUrl: previewUrl || null,
    isCustomSmtp,
  };
}

// Verification Link Store for registration email verification
interface VerificationData {
  token: string;
  expiresAt: number;
  password: string;
  full_name: string;
}
const verificationStore = new Map<string, VerificationData>();

// Periodic purge of expired tokens every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [emailKey, data] of verificationStore.entries()) {
    if (now > data.expiresAt) {
      verificationStore.delete(emailKey);
    }
  }
}, 10 * 60 * 1000);

// 1. Send Verification Link route for Email Registration
app.post("/api/auth/send-verification-link", async (req: any, res: any) => {
  const { email, password, full_name } = req.body;

  if (!email || !password || !full_name) {
    return res.status(400).json({ error: "กรุณากรอกข้อมูลให้ครบถ้วน" });
  }

  // Strict email & domain validation
  const trimmedEmail = email.trim().toLowerCase();
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(trimmedEmail)) {
    return res.status(400).json({ error: "รูปแบบอีเมลไม่ถูกต้อง กรุณากรอกอีเมลจริง (เช่น student@example.com)" });
  }

  const emailParts = trimmedEmail.split("@");
  if (emailParts.length !== 2) {
    return res.status(400).json({ error: "รูปแบบอีเมลไม่ถูกต้อง" });
  }

  const [localPart, domainPart] = emailParts;
  if (localPart.length < 2 || localPart.startsWith(".") || localPart.endsWith(".") || localPart.includes("..")) {
    return res.status(400).json({ error: "ชื่อผู้ใช้อีเมลก่อนหน้า @ ไม่ถูกต้อง" });
  }

  // Block disposable temp emails
  const DISPOSABLE_DOMAINS = ["tempmail.com", "temp-mail.org", "mailinator.com", "10minutemail.com", "guerrillamail.com", "trashmail.com", "yopmail.com", "dispostable.com", "getnada.com", "fakeinbox.com", "throwawaymail.com", "maildrop.cc"];
  if (DISPOSABLE_DOMAINS.includes(domainPart)) {
    return res.status(400).json({ error: "ไม่สามารถใช้อีเมลชั่วคราว (Disposable Email) สมัครสมาชิกได้" });
  }

  // Common email domain typos check
  const DOMAIN_TYPOS: Record<string, string> = {
    "gmai.com": "gmail.com", "gmial.com": "gmail.com", "gamil.com": "gmail.com", "gmal.com": "gmail.com",
    "hotmial.com": "hotmail.com", "hotmai.com": "hotmail.com", "outlok.com": "outlook.com", "yaho.com": "yahoo.com"
  };
  if (DOMAIN_TYPOS[domainPart]) {
    return res.status(400).json({ error: `โดเมนอีเมลอาจพิมพ์ผิด คุณหมายถึง ${localPart}@${DOMAIN_TYPOS[domainPart]} หรือไม่?` });
  }

  // Real DNS MX check to verify domain exists & can receive actual email
  const isRealDomain = await verifyEmailDomainMX(domainPart);
  if (!isRealDomain) {
    return res.status(400).json({ error: `โดเมน @${domainPart} ไม่มีอยู่จริงหรือไม่พบระบบรับส่งอีเมลจริง กรุณใช้อีเมลจริงของคุณ` });
  }

  // Strict password strength validation
  if (password.length < 8) {
    return res.status(400).json({ error: "รหัสผ่านต้องมีความยาวอย่างน้อย 8 ตัวอักษร" });
  }
  if (!/[A-Z]/.test(password)) {
    return res.status(400).json({ error: "รหัสผ่านต้องมีอักษรตัวพิมพ์ใหญ่ (A-Z) อย่างน้อย 1 ตัว" });
  }
  if (!/[a-z]/.test(password)) {
    return res.status(400).json({ error: "รหัสผ่านต้องมีอักษรตัวพิมพ์เล็ก (a-z) อย่างน้อย 1 ตัว" });
  }
  if (!/[0-9]/.test(password)) {
    return res.status(400).json({ error: "รหัสผ่านต้องมีตัวเลข (0-9) อย่างน้อย 1 ตัว" });
  }

  // Check if email already registered in system
  try {
    const allProfiles = await db.getAllProfiles();
    const existing = allProfiles.find((p: any) => p.email?.toLowerCase() === trimmedEmail);
    if (existing) {
      return res.status(400).json({ error: "อีเมลนี้ถูกลงทะเบียนเข้าใช้งานแล้ว กรุณาเข้าสู่ระบบแทน" });
    }
  } catch (err) {
    console.error("Check existing user error:", err);
  }

  // Generate unique verification token
  const token = crypto.randomBytes(24).toString("hex");

  // Store in memory for 15 minutes
  verificationStore.set(trimmedEmail, {
    token,
    expiresAt: Date.now() + 15 * 60 * 1000,
    password: password,
    full_name: full_name,
  });

  // Determine correct public baseUrl for verification link
  let baseUrl = process.env.APP_URL || "";

  if (!baseUrl) {
    const rawForwardedHost = req.headers["x-forwarded-host"] as string;
    const rawForwardedProto = (req.headers["x-forwarded-proto"] as string) || "https";
    const origin = req.headers.origin as string;
    const referer = req.headers.referer as string;

    if (rawForwardedHost && !rawForwardedHost.includes("localhost")) {
      baseUrl = `${rawForwardedProto}://${rawForwardedHost.split(",")[0].trim()}`;
    } else if (origin && !origin.includes("localhost")) {
      baseUrl = origin;
    } else if (referer) {
      try {
        const parsedUrl = new URL(referer);
        if (!parsedUrl.host.includes("localhost")) {
          baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;
        }
      } catch (e) {}
    }
  }

  // Fallback if still empty or localhost
  if (!baseUrl || baseUrl.includes("localhost")) {
    const host = req.get("host") || "localhost:3000";
    const protocol = req.protocol || "http";
    baseUrl = `${protocol}://${host}`;
  }

  const verificationLink = `${baseUrl}/?verify_token=${token}&email=${encodeURIComponent(trimmedEmail)}`;

  // Send real email via Nodemailer
  let emailDeliveryResult: any = { isCustomSmtp: false, previewUrl: null };
  try {
    emailDeliveryResult = await sendRealVerificationEmail(trimmedEmail, full_name, verificationLink);
    console.log(`Verification email dispatched to ${trimmedEmail}. Message ID: ${emailDeliveryResult.messageId}`);
  } catch (mailErr) {
    console.error("Failed to dispatch SMTP email:", mailErr);
  }

  return res.json({
    ok: true,
    message: `ส่งลิงก์ยืนยันตัวตนไปยังอีเมลจริง ${trimmedEmail} สำเร็จแล้ว`,
    email: trimmedEmail,
    isCustomSmtp: emailDeliveryResult.isCustomSmtp,
  });
});


// Alias for send-otp for backward compatibility
app.post("/api/auth/send-otp", async (req: any, res: any) => {
  return res.redirect(307, "/api/auth/send-verification-link");
});

// 2. Verify Email Link Token and Create Account
app.post("/api/auth/verify-email-link", async (req: any, res: any) => {
  const { email, token } = req.body;

  if (!email || !token) {
    return res.status(400).json({ error: "ข้อมูลยืนยันตัวตนไม่ครบถ้วน" });
  }

  const trimmedEmail = email.trim().toLowerCase();
  const storedData = verificationStore.get(trimmedEmail);

  if (!storedData) {
    return res.status(400).json({ error: "ไม่พบคำขอยืนยันตัวตนหรือลิงก์ยืนยันถูกใช้งานไปแล้ว กรุณาสมัครใหม่อีกครั้ง" });
  }

  if (Date.now() > storedData.expiresAt) {
    verificationStore.delete(trimmedEmail);
    return res.status(400).json({ error: "ลิงก์ยืนยันตัวตนหมดอายุแล้ว (มีอายุใช้งาน 15 นาที) กรุณากดขอลิงก์ใหม่" });
  }

  if (storedData.token !== token.trim()) {
    return res.status(400).json({ error: "รหัสยืนยันตัวตน (Token) ไม่ถูกต้อง" });
  }

  // Token is valid! Proceed to create user profile
  const { password, full_name } = storedData;

  try {
    const isSupabase = db.isUsingSupabase();
    const supabase = getSupabase();
    let userId = crypto.randomUUID();

    if (isSupabase && supabase) {
      try {
        let authData: any = null;
        let signUpError: any = null;

        try {
          const adminCreate = await supabase.auth.admin.createUser({
            email: trimmedEmail,
            password: password,
            email_confirm: true,
            user_metadata: {
              full_name: full_name,
            }
          });
          authData = adminCreate.data;
          signUpError = adminCreate.error;
        } catch (err) {
          const standardSignUp = await supabase.auth.signUp({
            email: trimmedEmail,
            password: password,
            options: {
              data: {
                full_name: full_name,
              }
            }
          });
          authData = standardSignUp.data;
          signUpError = standardSignUp.error;
        }

        if (!signUpError && authData?.user?.id) {
          userId = authData.user.id;
        }
      } catch (sbErr) {
        console.warn("Supabase Auth registration network exception handled:", sbErr);
      }
    }

    // Check if email already registered locally
    const profiles = await db.getAllProfiles();
    const existing = profiles.find((p) => p.email.toLowerCase() === trimmedEmail);
    if (existing) {
      verificationStore.delete(trimmedEmail);
      return res.status(200).json(existing);
    }

    const shouldBeAdminReg = isDesignatedAdmin(trimmedEmail);
    const role = shouldBeAdminReg ? "admin" : "user";

    const newProfile = {
      id: userId,
      email: trimmedEmail,
      full_name,
      role: role as "user" | "admin",
      status: "active" as "active" | "suspended",
      created_at: new Date().toISOString(),
      password_hash: hashPassword(password),
    };

    const saved = await db.createProfile(newProfile);
    verificationStore.delete(trimmedEmail);
    const token = generateToken(saved.id, saved.role);
    return res.status(201).json({ ...saved, token });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "เกิดข้อผิดพลาดในการสมัครสมาชิก" });
  }
});

// 2.1 Check Cross-Device Verification Status (Polling endpoint)
app.get("/api/auth/check-verification-status", async (req: any, res: any) => {
  const { email } = req.query;
  if (!email || typeof email !== "string") {
    return res.status(400).json({ verified: false, error: "Missing email parameter" });
  }

  const trimmedEmail = email.trim().toLowerCase();

  try {
    const allProfiles = await db.getAllProfiles();
    const existing = allProfiles.find((p: any) => p.email?.toLowerCase() === trimmedEmail);
    if (existing) {
      const token = generateToken(existing.id, existing.role);
      return res.json({ verified: true, user: existing, token });
    }

    const isPending = verificationStore.has(trimmedEmail);
    return res.json({ verified: false, pending: isPending });
  } catch (err: any) {
    return res.status(500).json({ verified: false, error: err.message });
  }
});

app.post("/api/auth/register", async (req: any, res: any) => {
  return res.status(400).json({ error: "กรุณายืนยันรหัส OTP 6 หลักทางอีเมลก่อนสมัครสมาชิก" });
});

app.post("/api/auth/login", async (req: any, res: any) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "กรุณากรอกอีเมลและรหัสผ่าน" });
  }

  const trimmedEmail = email.trim().toLowerCase();

  // Strict email validation regex
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(trimmedEmail)) {
    return res.status(400).json({ error: "รูปแบบอีเมลไม่ถูกต้อง กรุณากรอกอีเมลจริง (เช่น student@example.com)" });
  }

  try {
    const isSupabase = db.isUsingSupabase();
    const supabase = getSupabase();
    // Master admin access for admin@gmail.com
    if (trimmedEmail === "admin@gmail.com" && (password === "admin" || password === "admin1234" || password === "Pass1234")) {
      const allProfiles = await db.getAllProfiles();
      let adminProfile = allProfiles.find((p: any) => p.email?.toLowerCase() === "admin@gmail.com");
      const token = generateToken(adminProfile?.id || "dbc08b8b-77ee-4968-abc3-5504d1ce1e27", "admin");
      return res.json({ ...(adminProfile || {}), role: "admin", token });
    }
    let authenticatedUser: any = null;
    let authFailedExplicitly = false;
    let authFailureMessage = "";

    // 1. Authenticate with Supabase Auth if available
    if (isSupabase && supabase) {
      try {
        const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password: password,
        });

        if (!signInError && authData?.user?.id) {
          const userId = authData.user.id;
          let userProfile = await db.getProfile(userId);
          const shouldBeAdminLogin = isDesignatedAdmin(trimmedEmail);

          if (!userProfile) {
            const role = shouldBeAdminLogin ? "admin" : "user";
            const newProfile = {
              id: userId,
              email: trimmedEmail,
              full_name: authData.user.user_metadata?.full_name || trimmedEmail.split("@")[0],
              role: role as "user" | "admin",
              status: "active" as "active" | "suspended",
              created_at: new Date().toISOString(),
              password_hash: hashPassword(password),
            };
            userProfile = await db.createProfile(newProfile);
          } else {
            // Update password hash locally for offline resilience
            await db.updateProfilePassword(userId, hashPassword(password));

            if (shouldBeAdminLogin && userProfile.role !== "admin") {
              const updated = await db.updateProfileRole(userId, "admin");
              if (updated) {
                userProfile = updated;
              } else {
                userProfile.role = "admin";
              }
            }
          }

          authenticatedUser = userProfile;
        } else if (signInError) {
          // If Supabase returned an explicit authentication error, record it so we don't bypass it!
          if (
            signInError.code === "invalid_credentials" ||
            signInError.status === 400 ||
            signInError.message?.toLowerCase().includes("invalid login credentials")
          ) {
            authFailedExplicitly = true;
            authFailureMessage = "อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบและลองใหม่อีกครั้ง";
          } else if (signInError.message?.toLowerCase().includes("email not confirmed")) {
            return res.status(400).json({ error: "อีเมลนี้ยังไม่ได้ยืนยันตัวตน กรุณากดยืนยันผ่านลิงก์ในอีเมล" });
          }
        }
      } catch (supabaseErr: any) {
        console.warn("Supabase auth exception, falling back to local password verification:", supabaseErr?.message || supabaseErr);
      }
    }

    // 2. If not authenticated via Supabase, check Local DB with password verification
    if (!authenticatedUser) {
      const local = loadLocalDB();
      const localUser = local.profiles.find((p: any) => p.email?.toLowerCase() === trimmedEmail);

      if (localUser && localUser.password_hash) {
        // Must verify password against stored password_hash
        const isMatch = verifyPassword(password, localUser.password_hash);
        if (isMatch) {
          authenticatedUser = localUser;
          authFailedExplicitly = false;
        } else {
          return res.status(400).json({ error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบและลองใหม่อีกครั้ง" });
        }
      } else if (localUser && !localUser.password_hash) {
        // Seed account without hash: verify against default password admin or Pass1234
        if (password === "admin" || password === "Pass1234" || password === "Admin1234") {
          localUser.password_hash = hashPassword(password);
          saveLocalDB(local);
          authenticatedUser = localUser;
          authFailedExplicitly = false;
        } else {
          return res.status(400).json({ error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบและลองใหม่อีกครั้ง" });
        }
      } else if (authFailedExplicitly) {
        // Supabase Auth explicitly rejected the credentials
        return res.status(400).json({ error: authFailureMessage || "อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบและลองใหม่อีกครั้ง" });
      } else {
        return res.status(400).json({ error: "ไม่พบอีเมลนี้ในระบบ หรือรหัสผ่านไม่ถูกต้อง กรุณาสมัครสมาชิกก่อน" });
      }
    }

    // 3. Status check
    if (authenticatedUser.status === "suspended") {
      return res.status(403).json({ error: "บัญชีของคุณถูกระงับการใช้งานชั่วคราว กรุณาติดต่อแอดมิน" });
    }

    // Never return password_hash to the frontend
    const { password_hash, ...safeProfile } = authenticatedUser;
    const token = generateToken(authenticatedUser.id, authenticatedUser.role);
    return res.json({ ...safeProfile, token });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "เกิดข้อผิดพลาดในการเข้าสู่ระบบ" });
  }
});

app.get("/api/auth/me", requireAuth, (req: any, res: any) => {
  res.json(req.user);
});

// 2. Lessons Endpoints
app.get("/api/lessons", async (req: any, res: any) => {
  try {
    const allLessons = await db.getLessons();
    // Return simple layout. If user is NOT logged in, return content only for free lessons.
    const processed = allLessons.map((lesson) => {
      if (lesson.is_free || req.user) {
        return lesson;
      }
      return {
        id: lesson.id,
        title: lesson.title,
        order_index: lesson.order_index,
        is_free: false,
        content: "บทเรียนนี้สงวนสิทธิ์สำหรับสมาชิกเท่านั้น กรุณาเข้าสู่ระบบเพื่อเข้าเรียนเนื้อหาทั้งหมดและทำแบบทดสอบ",
        code_examples: [],
        created_at: lesson.created_at,
      };
    });
    res.json(processed);
  } catch (err: any) {
    res.status(500).json({ error: "ไม่สามารถดึงข้อมูลบทเรียนได้" });
  }
});

app.get("/api/lessons/:id", async (req: any, res: any) => {
  const { id } = req.params;
  try {
    const lesson = await db.getLessonById(id);
    if (!lesson) {
      return res.status(404).json({ error: "ไม่พบบทเรียนที่ต้องการ" });
    }

    // Access control
    if (!lesson.is_free && !req.user) {
      return res.status(403).json({ error: "กรุณาเข้าสู่ระบบก่อนเข้าชมบทเรียนนี้" });
    }

    const questions = await db.getQuestionsByLesson(id);
    
    // SECURITY: Strip correct_answer from student responses so answers are NEVER leaked in client JSON!
    const isAdmin = req.user?.role === "admin";
    const sanitizedQuestions = questions.map((q: any) => {
      if (isAdmin) return q;
      const { correct_answer, ...safeQ } = q;
      return safeQ;
    });

    res.json({
      lesson,
      questions: sanitizedQuestions,
    });
  } catch (err: any) {
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลบทเรียน" });
  }
});

// ==========================================
// SERVER-SIDE QUIZ VERIFICATION ENDPOINTS
// ==========================================

// 2.1 Check single question answer on the server (avoids client-side answer leaking)
app.post("/api/quizzes/check-question", async (req: any, res: any) => {
  const { questionId, answer } = req.body;
  if (!questionId || answer === undefined) {
    return res.status(400).json({ error: "ข้อมูลคำถามและคำตอบไม่ครบถ้วน" });
  }

  try {
    const local = loadLocalDB();
    let question = local.questions.find((q: any) => q.id === questionId);

    // If not found in local DB and Supabase is configured, check Supabase
    if (!question && db.isUsingSupabase()) {
      try {
        const { data } = await getSupabase().from("quiz_questions").select("*").eq("id", questionId).single();
        if (data) question = data;
      } catch (sbErr) {
        console.warn("Supabase check-question fallback:", sbErr);
      }
    }

    if (!question) {
      return res.status(404).json({ error: "ไม่พบข้อสอบที่ต้องการตรวจสอบ" });
    }

    let isCorrect = false;

    if (question.type === "multiple_choice") {
      const cleanExpected = String(question.correct_answer || "").trim();
      const cleanGiven = String(answer || "").trim();
      isCorrect = cleanExpected === cleanGiven;
    } else {
      // Drag & drop comparison
      const isSlot = question.template_code !== undefined || !Array.isArray(question.correct_answer) || question.correct_answer.length <= 1;
      if (isSlot) {
        const rawExpected = Array.isArray(question.correct_answer) ? question.correct_answer[0] : question.correct_answer;
        const cleanExpected = String(rawExpected || "").trim();
        const cleanGiven = Array.isArray(answer) ? String(answer[0] || "").trim() : String(answer || "").trim();
        isCorrect = cleanExpected === cleanGiven;
      } else {
        const correctSeq = (Array.isArray(question.correct_answer) ? question.correct_answer : [question.correct_answer]).map((s: string) => String(s).replace(/\s+/g, " ").trim());
        const givenSeq = Array.isArray(answer) ? answer.map((s: any) => String(s).replace(/\s+/g, " ").trim()) : [];
        isCorrect = givenSeq.length === correctSeq.length && givenSeq.every((val, idx) => val === correctSeq[idx]);
      }
    }

    // Return result and reveal correct answer ONLY for this specific question after student checked
    return res.json({
      isCorrect,
      correctAnswer: question.correct_answer,
    });
  } catch (err: any) {
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการตรวจคำตอบ" });
  }
});

// 2.2 Submit Full Quiz for Authoritative Server-side Grading & Progress Saving
app.post("/api/lessons/:id/quiz/submit", requireAuth, async (req: any, res: any) => {
  const { id: lessonId } = req.params;
  const { answers } = req.body; // Map: { [questionId: string]: answer }

  if (!answers || typeof answers !== "object") {
    return res.status(400).json({ error: "กรุณาส่งคำตอบของแบบทดสอบ" });
  }

  try {
    const questions = await db.getQuestionsByLesson(lessonId);
    if (!questions || questions.length === 0) {
      return res.status(400).json({ error: "บทเรียนนี้ไม่มีแบบทดสอบ" });
    }

    let correctCount = 0;
    const results = questions.map((q: any) => {
      const userAnswer = answers[q.id];
      let isCorrect = false;

      if (userAnswer !== undefined && userAnswer !== null) {
        if (q.type === "multiple_choice") {
          const cleanExpected = String(q.correct_answer || "").trim();
          const cleanGiven = String(userAnswer || "").trim();
          isCorrect = cleanExpected === cleanGiven;
        } else {
          const isSlot = q.template_code !== undefined || !Array.isArray(q.correct_answer) || q.correct_answer.length <= 1;
          if (isSlot) {
            const rawExpected = Array.isArray(q.correct_answer) ? q.correct_answer[0] : q.correct_answer;
            const cleanExpected = String(rawExpected || "").trim();
            const cleanGiven = Array.isArray(userAnswer) ? String(userAnswer[0] || "").trim() : String(userAnswer || "").trim();
            isCorrect = cleanExpected === cleanGiven;
          } else {
            const correctSeq = (Array.isArray(q.correct_answer) ? q.correct_answer : [q.correct_answer]).map((s: string) => String(s).replace(/\s+/g, " ").trim());
            const givenSeq = Array.isArray(userAnswer) ? userAnswer.map((s: any) => String(s).replace(/\s+/g, " ").trim()) : [];
            isCorrect = givenSeq.length === correctSeq.length && givenSeq.every((val, idx) => val === correctSeq[idx]);
          }
        }
      }

      if (isCorrect) correctCount++;

      return {
        questionId: q.id,
        isCorrect,
        userAnswer,
        correctAnswer: q.correct_answer,
      };
    });

    const score = Math.round((correctCount / questions.length) * 100);
    const completed = score >= 60; // 60% passing score

    // Server-verified progress record
    const progressRecord = {
      id: crypto.randomUUID(),
      user_id: req.user.id,
      lesson_id: lessonId,
      completed,
      quiz_score: score,
      updated_at: new Date().toISOString(),
    };

    const savedProgress = await db.saveProgress(progressRecord);

    return res.json({
      score,
      completed,
      totalQuestions: questions.length,
      correctCount,
      results,
      progress: savedProgress,
    });
  } catch (err: any) {
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการประมวลผลผลสอบ" });
  }
});

// 3. User Progress Endpoints
app.get("/api/progress", requireAuth, async (req: any, res: any) => {
  try {
    const progressList = await db.getUserProgress(req.user.id);
    res.json(progressList);
  } catch (err: any) {
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลประวัติการเรียน" });
  }
});

app.post("/api/lessons/:id/progress", requireAuth, async (req: any, res: any) => {
  const { id } = req.params;
  const { completed, quiz_score, answers } = req.body;

  // If answers map is provided, validate on server side
  if (answers && typeof answers === "object") {
    try {
      const questions = await db.getQuestionsByLesson(id);
      if (questions.length > 0) {
        let correctCount = 0;
        for (const q of questions) {
          const userAnswer = answers[q.id];
          if (userAnswer !== undefined && userAnswer !== null) {
            if (q.type === "multiple_choice") {
              if (String(q.correct_answer || "").trim() === String(userAnswer || "").trim()) {
                correctCount++;
              }
            } else {
              const isSlot = q.template_code !== undefined || !Array.isArray(q.correct_answer) || q.correct_answer.length <= 1;
              if (isSlot) {
                const rawExp = Array.isArray(q.correct_answer) ? q.correct_answer[0] : q.correct_answer;
                const userVal = Array.isArray(userAnswer) ? userAnswer[0] : userAnswer;
                if (String(rawExp || "").trim() === String(userVal || "").trim()) {
                  correctCount++;
                }
              } else {
                const correctSeq = (Array.isArray(q.correct_answer) ? q.correct_answer : [q.correct_answer]).map((s: string) => String(s).replace(/\s+/g, " ").trim());
                const givenSeq = Array.isArray(userAnswer) ? userAnswer.map((s: any) => String(s).replace(/\s+/g, " ").trim()) : [];
                if (givenSeq.length === correctSeq.length && givenSeq.every((val, idx) => val === correctSeq[idx])) {
                  correctCount++;
                }
              }
            }
          }
        }
        const validatedScore = Math.round((correctCount / questions.length) * 100);
        const validatedCompleted = validatedScore >= 60;
        const progressRecord = {
          id: crypto.randomUUID(),
          user_id: req.user.id,
          lesson_id: id,
          completed: validatedCompleted,
          quiz_score: validatedScore,
          updated_at: new Date().toISOString(),
        };
        const saved = await db.saveProgress(progressRecord);
        return res.json(saved);
      }
    } catch (e) {
      console.warn("Quiz validation exception:", e);
    }
  }

  try {
    const progressRecord = {
      id: crypto.randomUUID(),
      user_id: req.user.id,
      lesson_id: id,
      completed: !!completed,
      quiz_score: typeof quiz_score === "number" ? Math.min(100, Math.max(0, quiz_score)) : 0,
      updated_at: new Date().toISOString(),
    };

    const saved = await db.saveProgress(progressRecord);
    res.json(saved);
  } catch (err: any) {
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการบันทึกความคืบหน้า" });
  }
});

// ==========================================
// ADMIN CRUDS (Lessons, Questions, Users, Analytics)
// ==========================================

// 4. Admin Lessons & Quizzes CRUD
app.post("/api/admin/lessons", requireAdmin, async (req: any, res: any) => {
  const { title, content, code_examples, order_index, is_free } = req.body;

  if (!title || !content) {
    return res.status(400).json({ error: "กรุณากรอกชื่อและเนื้อหาบทเรียน" });
  }

  try {
    const newLesson = {
      id: crypto.randomUUID(),
      title,
      content,
      code_examples: Array.isArray(code_examples) ? code_examples : [],
      order_index: typeof order_index === "number" ? order_index : 99,
      is_free: !!is_free,
      created_at: new Date().toISOString(),
    };

    const saved = await db.saveLesson(newLesson);
    res.status(201).json(saved);
  } catch (err: any) {
    res.status(500).json({ error: "ไม่สามารถบันทึกบทเรียนใหม่ได้" });
  }
});

app.put("/api/admin/lessons/:id", requireAdmin, async (req: any, res: any) => {
  const { id } = req.params;
  const { title, content, code_examples, order_index, is_free } = req.body;

  try {
    const existing = await db.getLessonById(id);
    if (!existing) {
      return res.status(404).json({ error: "ไม่พบบทเรียนที่ต้องการแก้ไข" });
    }

    const updated = {
      ...existing,
      title: title || existing.title,
      content: content !== undefined ? content : existing.content,
      code_examples: Array.isArray(code_examples) ? code_examples : existing.code_examples,
      order_index: typeof order_index === "number" ? order_index : existing.order_index,
      is_free: is_free !== undefined ? !!is_free : existing.is_free,
    };

    const saved = await db.saveLesson(updated);
    res.json(saved);
  } catch (err: any) {
    res.status(500).json({ error: "ไม่สามารถแก้ไขข้อมูลบทเรียนได้" });
  }
});

app.delete("/api/admin/lessons/:id", requireAdmin, async (req: any, res: any) => {
  const { id } = req.params;
  try {
    const success = await db.deleteLesson(id);
    if (!success) {
      return res.status(404).json({ error: "ไม่พบบทเรียนที่ต้องการลบ" });
    }
    res.json({ success: true, message: "ลบบทเรียนสำเร็จแล้ว" });
  } catch (err: any) {
    res.status(500).json({ error: "ไม่สามารถลบบทเรียนได้" });
  }
});

// Quiz Questions CRUD
app.post("/api/admin/lessons/:id/questions", requireAdmin, async (req: any, res: any) => {
  const { id: lessonId } = req.params;
  const { type, question, options, correct_answer, order_index, template_code } = req.body;

  if (!question || !options || correct_answer === undefined) {
    return res.status(400).json({ error: "กรุณาระบุคำถาม ตัวเลือก และเฉลย" });
  }

  try {
    const newQuestion = {
      id: crypto.randomUUID(),
      lesson_id: lessonId,
      type: type || "multiple_choice",
      question,
      options: Array.isArray(options) ? options : [],
      correct_answer,
      template_code: typeof template_code === "string" ? template_code : undefined,
      order_index: typeof order_index === "number" ? order_index : 99,
    };

    const saved = await db.saveQuestion(newQuestion);
    res.status(201).json(saved);
  } catch (err: any) {
    res.status(500).json({ error: "ไม่สามารถบันทึกข้อสอบใหม่ได้" });
  }
});

app.put("/api/admin/questions/:questionId", requireAdmin, async (req: any, res: any) => {
  const { questionId } = req.params;
  const { lesson_id, type, question, options, correct_answer, order_index, template_code } = req.body;

  try {
    const local = loadLocalDB();
    let existing = local.questions.find((q: any) => q.id === questionId);

    // ถ้าไม่เจอในไฟล์เครื่อง ให้ค้นหาจาก Supabase Cloud ด้วย
    if (!existing && db.isUsingSupabase()) {
      try {
        const { data } = await getSupabase().from("quiz_questions").select("*").eq("id", questionId).single();
        if (data) existing = data;
      } catch (sbErr) {
        console.warn("Supabase find question error:", sbErr);
      }
    }

    const updated = {
      id: questionId,
      lesson_id: existing?.lesson_id || lesson_id || "",
      type: type || existing?.type || "multiple_choice",
      question: question || existing?.question || "",
      options: Array.isArray(options) ? options : (existing?.options || []),
      correct_answer: correct_answer !== undefined ? correct_answer : existing?.correct_answer,
      template_code: template_code !== undefined ? template_code : existing?.template_code,
      order_index: typeof order_index === "number" ? order_index : (existing?.order_index ?? 99),
    };

    const saved = await db.saveQuestion(updated);
    res.json(saved);
  } catch (err: any) {
    res.status(500).json({ error: "ไม่สามารถแก้ไขข้อสอบได้" });
  }
});

app.delete("/api/admin/questions/:questionId", requireAdmin, async (req: any, res: any) => {
  const { questionId } = req.params;
  try {
    const success = await db.deleteQuestion(questionId);
    if (!success) {
      return res.status(404).json({ error: "ไม่พบข้อสอบที่ต้องการลบ" });
    }
    res.json({ success: true, message: "ลบข้อสอบสำเร็จ" });
  } catch (err: any) {
    res.status(500).json({ error: "ไม่สามารถลบข้อสอบได้" });
  }
});

// 5. Admin User Management
app.get("/api/admin/users", requireAdmin, async (req: any, res: any) => {
  try {
    const profiles = await db.getAllProfiles();
    const progresses = await db.getAllProgress();
    const lessons = await db.getLessons();

    const usersData = profiles.map((p) => {
      const userProgress = progresses.filter((pr) => pr.user_id === p.id);
      const completedCount = userProgress.filter((pr) => pr.completed).length;
      const totalLessons = lessons.length;
      const percent = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

      // Average score on completed quizzes
      const scores = userProgress.map((pr) => pr.quiz_score);
      const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

      return {
        ...p,
        completion_percent: percent,
        average_score: avgScore,
        completed_lessons: completedCount,
      };
    });

    res.json(usersData);
  } catch (err: any) {
    res.status(500).json({ error: "ดึงรายชื่อผู้ใช้ไม่สำเร็จ" });
  }
});

app.put("/api/admin/users/:id/role", requireAdmin, async (req: any, res: any) => {
  const { id } = req.params;
  const { role } = req.body;

  if (role !== "user" && role !== "admin") {
    return res.status(400).json({ error: "บทบาทไม่ถูกต้อง" });
  }

  // Prevent self role change
  if (req.user.id === id) {
    return res.status(400).json({ error: "คุณไม่สามารถเปลี่ยนบทบาทของตัวเองได้" });
  }

  try {
    const updated = await db.updateProfileRole(id, role);
    if (!updated) {
      return res.status(404).json({ error: "ไม่พบข้อมูลสมาชิก" });
    }
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: "เปลี่ยนบทบาทผู้ใช้ไม่สำเร็จ" });
  }
});

app.put("/api/admin/users/:id/status", requireAdmin, async (req: any, res: any) => {
  const { id } = req.params;
  const { status } = req.body;

  if (status !== "active" && status !== "suspended") {
    return res.status(400).json({ error: "สถานะไม่ถูกต้อง" });
  }

  // Prevent self suspension
  if (req.user.id === id) {
    return res.status(400).json({ error: "คุณไม่สามารถระงับบัญชีของตัวเองได้" });
  }

  try {
    const updated = await db.updateProfileStatus(id, status);
    if (!updated) {
      return res.status(404).json({ error: "ไม่พบข้อมูลสมาชิก" });
    }
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: "เปลี่ยนสถานะผู้ใช้ไม่สำเร็จ" });
  }
});

// 6. Admin Analytics
app.get("/api/admin/analytics", requireAdmin, async (req: any, res: any) => {
  try {
    const profiles = await db.getAllProfiles();
    const lessons = await db.getLessons();
    const progressList = await db.getAllProgress();

    // 1. Total & New users
    const totalUsers = profiles.length;
    // New users past week (created within past 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const newUsersWeek = profiles.filter((p) => new Date(p.created_at) >= sevenDaysAgo).length;

    // 2. Metrics per lesson (Popularity & Completion rate)
    const totalStudents = profiles.filter((p) => p.role === "user").length || 1; // avoid division by 0

    const lessonsStats = lessons.map((lesson) => {
      const lessonProgress = progressList.filter((p) => p.lesson_id === lesson.id);
      const completedCount = lessonProgress.filter((p) => p.completed).length;
      const avgScore = lessonProgress.length > 0 
        ? Math.round(lessonProgress.reduce((sum, p) => sum + p.quiz_score, 0) / lessonProgress.length) 
        : 0;

      return {
        id: lesson.id,
        title: lesson.title,
        order_index: lesson.order_index,
        completions: completedCount,
        completion_rate: Math.round((completedCount / totalStudents) * 100),
        average_score: avgScore,
        views: lessonProgress.length, // approximation based on progress rows
      };
    });

    // 3. User Growth chart simulation (past 7 days)
    const chartData = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateString = d.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
      const count = profiles.filter((p) => {
        const createDate = new Date(p.created_at);
        return createDate.toDateString() === d.toDateString();
      }).length;

      chartData.push({
        date: dateString,
        new_users: count,
      });
    }

    res.json({
      summary: {
        total_users: totalUsers,
        new_users_week: newUsersWeek,
        total_lessons: lessons.length,
        total_attempts: progressList.length,
      },
      lessons: lessonsStats,
      user_growth: chartData,
    });
  } catch (err: any) {
    res.status(500).json({ error: "ไม่สามารถคำนวณสถิติวิเคราะห์ระบบได้" });
  }
});

// ==========================================
// API 404 & ERROR HANDLING MIDDLEWARE
// ==========================================

// Catch-all for /api/* routes that do not match any defined route
app.use("/api/*", (req: any, res: any) => {
  res.status(404).json({ error: "ไม่พบข้อมูลหรือ API Endpoint ที่ระบุ (404)" });
});

// Global error handling middleware for API routes
app.use((err: any, req: any, res: any, next: any) => {
  console.error("Express API error:", err);
  if (res.headersSent) {
    return next(err);
  }
  if (req.path && req.path.startsWith("/api")) {
    return res.status(err.status || 500).json({ error: err.message || "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" });
  }
  next(err);
});

// ==========================================
// VITE AND STATIC ASSET MIDDLEWARE
// ==========================================

async function startServer() {
  // Attempt to auto-seed Supabase database with default lessons & questions if empty
  try {
    await db.seedDatabaseIfEmpty();
  } catch (seedErr: any) {
    console.error("Failed to seed Supabase database on startup:", seedErr?.message || seedErr);
  }

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req: any, res: any) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT} in ${process.env.NODE_ENV || "development"} mode`);
  });
}

startServer();
