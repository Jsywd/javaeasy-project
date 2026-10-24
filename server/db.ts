import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

// Database File Path for Local Fallback
const DB_FILE = path.join(process.cwd(), "database.json");

// Define TypeScript Interfaces for Database Entities
export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: "user" | "admin";
  status: "active" | "suspended";
  created_at: string;
  password_hash?: string;
}

export interface CodeExample {
  title: string;
  code: string;
  language: string;
}

export interface Lesson {
  id: string;
  title: string;
  content: string; // Markdown / HTML text
  code_examples: CodeExample[];
  order_index: number;
  is_free: boolean;
  created_at: string;
}

export interface QuizQuestion {
  id: string;
  lesson_id: string;
  type: "multiple_choice" | "drag_drop";
  question: string;
  template_code?: string;
  options: string[]; // For MCQ, list of choices. For Drag & Drop, list of draggable blocks
  correct_answer: any; // For MCQ: string (correct option index/text). For Drag & Drop: string[] (correct sequence)
  order_index: number;
}

export interface UserProgress {
  id: string;
  user_id: string;
  lesson_id: string;
  completed: boolean;
  quiz_score: number; // Percentage score (0 - 100)
  updated_at: string;
}

// Check if Supabase credentials are provided
let isSupabaseConfigured = false;
let supabase: any = null;
let supabaseOnline = true;
let lastSupabaseErrorTime = 0;
const SUPABASE_COOLDOWN_MS = 30000; // 30s cooldown before retrying after network failure

export function initSupabase() {
  if (supabase) return supabase;

  const supabaseUrl = process.env.SUPABASE_URL || "";
  const supabaseKey = process.env.SUPABASE_KEY || "";
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  const configured = 
    supabaseUrl.length > 0 && 
    (supabaseServiceKey.length > 0 || supabaseKey.length > 0);

  if (configured) {
    try {
      // Prefer service role key for backend administrative operations, fallback to anon key
      const activeKey = supabaseServiceKey || supabaseKey;
      supabase = createClient(supabaseUrl, activeKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
      if (supabase) {
        isSupabaseConfigured = true;
        console.log("Supabase Client initialized!");
      }
    } catch (err: any) {
      console.warn("Supabase info: initialization failed, using local fallback store:", err?.message || err);
    }
  }
  return supabase;
}

export function getSupabase() {
  initSupabase();
  return supabase;
}

// Timeout helper for Supabase operations (default 3.5 seconds)
async function withTimeout<T = any>(promise: any, timeoutMs = 3500): Promise<any> {
  let timeoutHandle: any;
  const timeoutPromise = new Promise<any>((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error("Supabase operation timed out")), timeoutMs);
  });
  return Promise.race([
    Promise.resolve(promise).then((res: any) => {
      clearTimeout(timeoutHandle);
      return res;
    }),
    timeoutPromise,
  ]);
}

function isSupabaseAvailable(): boolean {
  initSupabase();
  if (!isSupabaseConfigured || !supabase) return false;
  if (!supabaseOnline && Date.now() - lastSupabaseErrorTime < SUPABASE_COOLDOWN_MS) {
    return false;
  }
  return true;
}

function handleSupabaseError(err: any, context: string) {
  lastSupabaseErrorTime = Date.now();
  supabaseOnline = false;
  const msg = err?.message || err?.details || String(err);
  console.warn(`[Supabase Fallback] ${context} error (${msg}). Seamlessly using Local JSON database.`);
}

function markSupabaseSuccess() {
  supabaseOnline = true;
}

// Load Default Data if database.json doesn't exist
const DEFAULT_PROFILES: Profile[] = [
  {
    id: "dbc08b8b-77ee-4968-abc3-5504d1ce1e27",
    email: "admin@gmail.com",
    full_name: "Admin",
    role: "admin",
    status: "active",
    created_at: new Date().toISOString(),
    password_hash: "9ac1bdcf382d35c44be29282e58904bf:c1c42dead06a9362c154e1e13c0b17c3eac3073a1a84532c3a3b36669984923a2652ef883ba7bd61fe7cb1e7c543dab388b9506e6f3234bd698dd6f19b15cd63",
  },
];

const DEFAULT_LESSONS: Lesson[] = [
  {
    id: "da100000-0000-0000-0000-000000000001",
    title: "บทที่ 1: แนะนำภาษา Java และ Hello World",
    content: `# ยินดีต้อนรับสู่โลกของ Java!

ภาษา Java เป็นหนึ่งในภาษาโปรแกรมมิ่งที่ได้รับความนิยมมากที่สุดในโลก พัฒนาขึ้นโดย James Gosling แห่ง Sun Microsystems ในปี 1995 ปัจจุบันอยู่ภายใต้การดูแลของ Oracle

## จุดเด่นของภาษา Java
1. **Write Once, Run Anywhere (WORA)**: เขียนครั้งเดียว นำไปรันได้ทุกที่ที่มี Java Virtual Machine (JVM)
2. **Object-Oriented Programming (OOP)**: สนับสนุนการเขียนโปรแกรมเชิงวัตถุอย่างเต็มรูปแบบ
3. **Strongly-Typed**: มีการระบุประเภทข้อมูลของตัวแปรอย่างเข้มงวด ช่วยลดข้อผิดพลาดขณะรัน

---

## โครงสร้างพื้นฐานของโปรแกรม Java
ในภาษา Java ทุกโค้ดจะทำงานอยู่ภายใต้คลาส (Class) และมีเมธอดหลักชื่อ \`main\` เป็นจุดเริ่มต้นในการทำงานของโปรแกรม ดังตัวอย่างต่อไปนี้:`,
    code_examples: [
      {
        title: "HelloWorld.java",
        code: `public class HelloWorld {
    public static void main(String[] args) {
        // แสดงข้อความออกทางหน้าจอ
        System.out.println("Hello, World!");
    }
}`,
        language: "java"
      }
    ],
    order_index: 1,
    is_free: true,
    created_at: new Date().toISOString(),
  },
  {
    id: "da200000-0000-0000-0000-000000000002",
    title: "บทที่ 2: ตัวแปรและชนิดข้อมูลพื้นฐาน",
    content: `# ตัวแปรและชนิดข้อมูลในภาษา Java

ก่อนที่เราจะคำนวณหรือจัดการข้อมูลในโปรแกรม เราต้องรู้จักวิธีการเก็บข้อมูลในหน่วยความจำ ซึ่งเรียกว่า **ตัวแปร (Variables)**

ในภาษา Java ซึ่งเป็นภาษาประเภท Strongly-typed เราต้องประกาศประเภทข้อมูลก่อนใช้งานตัวแปรเสมอ

## ชนิดข้อมูลพื้นฐาน (Primitive Data Types)
ภาษา Java มีชนิดข้อมูลหลักๆ ดังนี้:
- **int**: ใช้เก็บตัวเลขจำนวนเต็ม เช่น \`10\`, \`-450\`
- **double**: ใช้เก็บตัวเลขทศนิยม เช่น \`3.14\`, \`99.99\`
- **boolean**: ใช้เก็บค่าความจริง มีเพียงสองค่าคือ \`true\` หรือ \`false\`
- **char**: ใช้เก็บตัวอักษรเดี่ยวๆ ตัวเดียว เช่น \`'A'\`, \`'ก'\` (เขียนในเครื่องหมาย '...')

## ชนิดข้อมูลประเภทอ้างอิง (Reference Data Types)
- **String**: ใช้เก็บข้อความยาวๆ เช่น \`"Hello Java"\` (เขียนในเครื่องหมาย "...")

---

## ตัวอย่างการประกาศและการสร้างตัวแปร
เราสามารถกำหนดค่าให้ตัวแปรได้ตอนประกาศ หรือกำหนดภายหลังก็ได้:`,
    code_examples: [
      {
        title: "VariablesDemo.java",
        code: `public class VariablesDemo {
    public static void main(String[] args) {
        int age = 20;
        double price = 129.50;
        boolean isJavaFun = true;
        char grade = 'A';
        String studentName = "สมศรี";

        System.out.println("ชื่อ: " + studentName);
        System.out.println("อายุ: " + age + " ปี");
        System.out.println("เกรด: " + grade);
    }
}`,
        language: "java"
      }
    ],
    order_index: 2,
    is_free: true,
    created_at: new Date().toISOString(),
  },
  {
    id: "da300000-0000-0000-0000-000000000003",
    title: "บทที่ 3: โครงสร้างควบคุมแบบเงื่อนไข (if-else & switch)",
    content: `# โครงสร้างควบคุมแบบมีเงื่อนไข (Control Flow)

การควบคุมทิศทางการทำงานของโปรแกรมตามเงื่อนไขที่กำหนด ช่วยให้โปรแกรมตัดสินใจได้ฉลาดขึ้นเหมือนมีความคิด!

## 1. การใช้งาน if-else
คำสั่ง \`if\` จะทำงานเมื่อเงื่อนไขเป็นจริง หากมีเงื่อนไขอื่นให้ตรวจเช็กจะใช้ \`else if\` และหากไม่ตรงกับเงื่อนไขใดเลยจะทำงานในบล็อก \`else\`

## 2. การใช้งาน switch case
เหมาะสำหรับการเปรียบเทียบตัวแปรหนึ่งตัวที่มีค่าเป็นตัวเลือกที่แน่นอน เช่น วันในสัปดาห์ หรือเมนูตัวเลือก

---

## ตัวอย่างคำสั่งตัดสินใจเปรียบเทียบคะแนนเพื่อตัดเกรด:`,
    code_examples: [
      {
        title: "GradeCalculator.java",
        code: `public class GradeCalculator {
    public static void main(String[] args) {
        int score = 78;

        if (score >= 80) {
            System.out.println("เกรด A");
        } else if (score >= 70) {
            System.out.println("เกรด B");
        } else if (score >= 60) {
            System.out.println("เกรด C");
        } else {
            System.out.println("เกรด F");
        }
    }
}`,
        language: "java"
      }
    ],
    order_index: 3,
    is_free: false,
    created_at: new Date().toISOString(),
  },
  {
    id: "da400000-0000-0000-0000-000000000004",
    title: "บทที่ 4: การวนซ้ำ (Loops in Java)",
    content: `# การวนซ้ำซ้ำๆ เพื่อลดเวลาการเขียนโค้ด (Loops)

การวนซ้ำ (Loops) เป็นเครื่องมืออันทรงพลังในการสั่งให้โปรแกรมทำงานเดิมๆ ซ้ำหลายๆ ครั้ง เช่น การแสดงตัวเลข 1 ถึง 100 หรือการประมวลผลข้อมูลใน List

ในภาษา Java มีลูปหลักๆ อยู่ 3 ชนิด:

1. **for loop**: เหมาะสำหรับกรณีที่รู้จำนวนรอบการทำงานล่วงหน้าอย่างแน่นอน
2. **while loop**: ทำงานซ้ำตราบใดที่เงื่อนไขยังเป็นจริง (เช็กเงื่อนไขก่อนเริ่มแต่ละรอบ)
3. **do-while loop**: ทำงานก่อน 1 รอบเสมอ จากนั้นค่อยตรวจสอบเงื่อนไข

---

## ตัวอย่างการเปรียบเทียบการรันลูปพิมพ์ตัวเลข:`,
    code_examples: [
      {
        title: "LoopComparison.java",
        code: `public class LoopComparison {
    public static void main(String[] args) {
        System.out.println("--- for loop ---");
        for (int i = 1; i <= 5; i++) {
            System.out.println("รอบที่ " + i);
        }

        System.out.println("--- while loop ---");
        int j = 1;
        while (j <= 5) {
            System.out.println("รอบที่ " + j);
            j++;
        }
    }
}`,
        language: "java"
      }
    ],
    order_index: 4,
    is_free: false,
    created_at: new Date().toISOString(),
  }
];

const DEFAULT_QUESTIONS: QuizQuestion[] = [
  // Lesson 1 Questions
  {
    id: "10100000-0000-0000-0000-000000000101",
    lesson_id: "da100000-0000-0000-0000-000000000001",
    type: "multiple_choice",
    question: "คีย์เวิร์ดใดที่ใช้ในการสร้างหรือประกาศคลาส (Class) ในภาษา Java?",
    options: ["class", "Class", "new", "struct"],
    correct_answer: "class",
    order_index: 1,
  },
  {
    id: "10200000-0000-0000-0000-000000000102",
    lesson_id: "da100000-0000-0000-0000-000000000001",
    type: "drag_drop",
    question: "Drag and drop the correct method to print Hello World in Java.",
    template_code: "System.out.___(\"Hello World\");",
    options: ["println", "echo", "printline"],
    correct_answer: ["println"],
    order_index: 2,
  },
  {
    id: "10300000-0000-0000-0000-000000000103",
    lesson_id: "da100000-0000-0000-0000-000000000001",
    type: "drag_drop",
    question: "จงเรียงลำดับโค้ดภาษา Java ต่อไปนี้ให้แสดงคำว่า \"Hello World\" ได้อย่างถูกต้อง",
    options: [
      "public class Hello {",
      "    public static void main(String[] args) {",
      "        System.out.println(\"Hello World\");",
      "    }",
      "}"
    ],
    correct_answer: [
      "public class Hello {",
      "    public static void main(String[] args) {",
      "        System.out.println(\"Hello World\");",
      "    }",
      "}"
    ],
    order_index: 3,
  },
  // Lesson 2 Questions
  {
    id: "20100000-0000-0000-0000-000000000201",
    lesson_id: "da200000-0000-0000-0000-000000000002",
    type: "multiple_choice",
    question: "ชนิดข้อมูลใดใน Java ที่ใช้เก็บทศนิยมอย่างแม่นยำ?",
    options: ["int", "double", "boolean", "char"],
    correct_answer: "double",
    order_index: 1,
  },
  {
    id: "20200000-0000-0000-0000-000000000202",
    lesson_id: "da200000-0000-0000-0000-000000000002",
    type: "drag_drop",
    question: "จงเรียงการประกาศตัวแปรแต่ละชนิดให้ถูกต้องตามหลักภาษา Java (ชนิดข้อมูล ชื่อตัวแปร = ค่า;)",
    options: [
      "int score = 100;",
      "double temp = 37.5;",
      "String text = \"Java\";",
      "boolean ok = true;"
    ],
    correct_answer: [
      "int score = 100;",
      "double temp = 37.5;",
      "String text = \"Java\";",
      "boolean ok = true;"
    ],
    order_index: 2,
  },
  // Lesson 3 Questions
  {
    id: "30100000-0000-0000-0000-000000000301",
    lesson_id: "da300000-0000-0000-0000-000000000003",
    type: "multiple_choice",
    question: "หากต้องการตรวจสอบเงื่อนไขหลายทางเลือกต่อจาก if จะใช้คีย์เวิร์ดใด?",
    options: ["else if", "elseif", "else", "switch"],
    correct_answer: "else if",
    order_index: 1,
  },
  {
    id: "30200000-0000-0000-0000-000000000302",
    lesson_id: "da300000-0000-0000-0000-000000000003",
    type: "drag_drop",
    question: "จงเรียงลำดับชุดคำสั่งตรวจเช็กค่าของตัวแปร x ว่ามีค่ามากกว่า 10 หรือไม่ หากมากกว่าให้พิมพ์คำว่า \"Big\" นอกนั้นพิมพ์ \"Small\"",
    options: [
      "if (x > 10) {",
      "    System.out.println(\"Big\");",
      "} else {",
      "    System.out.println(\"Small\");",
      "}"
    ],
    correct_answer: [
      "if (x > 10) {",
      "    System.out.println(\"Big\");",
      "} else {",
      "    System.out.println(\"Small\");",
      "}"
    ],
    order_index: 2,
  },
  // Lesson 4 Questions
  {
    id: "40100000-0000-0000-0000-000000000401",
    lesson_id: "da400000-0000-0000-0000-000000000004",
    type: "multiple_choice",
    question: "การวนซ้ำข้อใดที่จะต้องประมวลผลโค้ดในบล็อกก่อนอย่างน้อย 1 รอบก่อนจะเช็กเงื่อนไข?",
    options: ["do-while", "while", "for", "foreach"],
    correct_answer: "do-while",
    order_index: 1,
  },
  {
    id: "40200000-0000-0000-0000-000000000402",
    lesson_id: "da400000-0000-0000-0000-000000000004",
    type: "drag_drop",
    question: "จงเรียงลำดับคำสั่ง For Loop เพื่อแสดงตัวเลข 1 ถึง 5 ออกหน้าจอ",
    options: [
      "for (int i = 1; i <= 5; i++) {",
      "    System.out.println(i);",
      "}"
    ],
    correct_answer: [
      "for (int i = 1; i <= 5; i++) {",
      "    System.out.println(i);",
      "}"
    ],
    order_index: 2,
  }
];

const DEFAULT_USER_PROGRESS: UserProgress[] = [
  {
    id: "00000000-0000-0000-0000-000000000003",
    user_id: "00000000-0000-0000-0000-000000000002",
    lesson_id: "da100000-0000-0000-0000-000000000001",
    completed: true,
    quiz_score: 100,
    updated_at: new Date().toISOString(),
  }
];

// Helper to write to JSON DB File
export function saveLocalDB(data: {
  profiles: Profile[];
  lessons: Lesson[];
  questions: QuizQuestion[];
  progress: UserProgress[];
}) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
}

// Helper to load or initialize JSON DB File
export function loadLocalDB() {
  if (!fs.existsSync(DB_FILE)) {
    const defaultData = {
      profiles: DEFAULT_PROFILES,
      lessons: DEFAULT_LESSONS,
      questions: DEFAULT_QUESTIONS,
      progress: DEFAULT_USER_PROGRESS,
    };
    saveLocalDB(defaultData);
    return defaultData;
  }
  try {
    const content = fs.readFileSync(DB_FILE, "utf-8");
    return JSON.parse(content);
  } catch (err) {
    console.error("Error reading JSON database, resetting:", err);
    const defaultData = {
      profiles: DEFAULT_PROFILES,
      lessons: DEFAULT_LESSONS,
      questions: DEFAULT_QUESTIONS,
      progress: DEFAULT_USER_PROGRESS,
    };
    saveLocalDB(defaultData);
    return defaultData;
  }
}

// ==========================================
// UNIFIED DATABASE OPERATIONS ENGINE
// ==========================================

export const db = {
  // Database Status
  isUsingSupabase(): boolean {
    return isSupabaseAvailable();
  },

  // Auto-Seeding Engine
  async seedDatabaseIfEmpty() {
    if (!isSupabaseAvailable() || !supabase) return;
    try {
      // 1. Check if lessons table has any items with timeout
      const checkPromise = supabase
        .from("lessons")
        .select("id")
        .limit(1);

      const { data: lessons, error: checkError } = await withTimeout(checkPromise, 3000);

      if (checkError) {
        handleSupabaseError(checkError, "Seed Check");
        return;
      }

      markSupabaseSuccess();

      // If the database has no lessons, seed default lessons and questions
      if (!lessons || lessons.length === 0) {
        console.log("Supabase empty, seeding default lessons...");
        
        // Seed Lessons
        for (const lesson of DEFAULT_LESSONS) {
          try {
            await withTimeout(supabase.from("lessons").insert(lesson), 3000);
          } catch (e: any) {
            console.warn(`Lesson seed skipped for ${lesson.title}:`, e?.message || e);
          }
        }

        // Seed Quiz Questions
        for (const question of DEFAULT_QUESTIONS) {
          try {
            await withTimeout(supabase.from("quiz_questions").insert(question), 3000);
          } catch (e: any) {
            console.warn(`Question seed skipped for ${question.question}:`, e?.message || e);
          }
        }
      }
    } catch (err: any) {
      handleSupabaseError(err, "Auto-seeding");
    }
  },

  // Profiles CRUD
  async getProfile(userId: string): Promise<Profile | null> {
    if (isSupabaseAvailable()) {
      try {
        const queryPromise = supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .single();
        const { data, error } = await withTimeout(queryPromise, 3500);
        if (error) {
          if (error.code === "PGRST116") {
            // Not found in Supabase, also check local DB
            const local = loadLocalDB();
            return local.profiles.find((p: Profile) => p.id === userId) || null;
          }
          throw error;
        }
        markSupabaseSuccess();
        if (data) return data;
      } catch (err) {
        handleSupabaseError(err, "getProfile");
      }
    }
    const local = loadLocalDB();
    return local.profiles.find((p: Profile) => p.id === userId) || null;
  },

  async getAllProfiles(): Promise<Profile[]> {
    if (isSupabaseAvailable()) {
      try {
        const queryPromise = supabase.from("profiles").select("*");
        const { data, error } = await withTimeout(queryPromise, 3500);
        if (error) throw error;
        markSupabaseSuccess();
        if (data && data.length > 0) return data;
      } catch (err) {
        handleSupabaseError(err, "getAllProfiles");
      }
    }
    const local = loadLocalDB();
    return local.profiles || [];
  },

  async createProfile(profile: Profile): Promise<Profile> {
    // 1. Always save to Local DB first to guarantee zero data loss
    const local = loadLocalDB();
    local.profiles = local.profiles.filter(
      (p: Profile) => p.email.toLowerCase() !== profile.email.toLowerCase() && p.id !== profile.id
    );
    local.profiles.push(profile);
    saveLocalDB(local);

    // 2. Attempt sync to Supabase if available
    if (isSupabaseAvailable()) {
      try {
        await withTimeout(
          supabase.from("profiles").delete().eq("email", profile.email.toLowerCase()),
          3000
        );
        const { password_hash, ...supabaseProfile } = profile;
        const { data, error } = await withTimeout(
          supabase.from("profiles").insert(supabaseProfile).select().single(),
          3000
        );
        if (!error && data) {
          markSupabaseSuccess();
          return { ...data, password_hash };
        }
      } catch (err: any) {
        handleSupabaseError(err, "createProfile");
      }
    }
    
    return profile;
  },

  async updateProfilePassword(userId: string, passwordHash: string): Promise<boolean> {
    const local = loadLocalDB();
    const profile = local.profiles.find((p: Profile) => p.id === userId);
    if (profile) {
      profile.password_hash = passwordHash;
      saveLocalDB(local);
      return true;
    }
    return false;
  },

  async updateProfileRole(userId: string, role: "user" | "admin"): Promise<Profile | null> {
    // Update local DB
    const local = loadLocalDB();
    const profile = local.profiles.find((p: Profile) => p.id === userId);
    if (profile) {
      profile.role = role;
      saveLocalDB(local);
    }

    if (isSupabaseAvailable()) {
      try {
        const updatePromise = supabase
          .from("profiles")
          .update({ role })
          .eq("id", userId)
          .select()
          .single();
        const { data, error } = await withTimeout(updatePromise, 3000);
        if (!error && data) {
          markSupabaseSuccess();
          return data;
        }
      } catch (err) {
        handleSupabaseError(err, "updateProfileRole");
      }
    }
    
    return profile || null;
  },

  async updateProfileStatus(userId: string, status: "active" | "suspended"): Promise<Profile | null> {
    // Update local DB
    const local = loadLocalDB();
    const profile = local.profiles.find((p: Profile) => p.id === userId);
    if (profile) {
      profile.status = status;
      saveLocalDB(local);
    }

    if (isSupabaseAvailable()) {
      try {
        const updatePromise = supabase
          .from("profiles")
          .update({ status })
          .eq("id", userId)
          .select()
          .single();
        const { data, error } = await withTimeout(updatePromise, 3000);
        if (!error && data) {
          markSupabaseSuccess();
          return data;
        }
      } catch (err) {
        handleSupabaseError(err, "updateProfileStatus");
      }
    }
    
    return profile || null;
  },

  // Lessons CRUD
  async getLessons(): Promise<Lesson[]> {
    if (isSupabaseAvailable()) {
      try {
        const queryPromise = supabase
          .from("lessons")
          .select("*")
          .order("order_index", { ascending: true });
        const { data, error } = await withTimeout(queryPromise, 3500);
        if (error) throw error;
        markSupabaseSuccess();
        if (data && data.length > 0) return data;
      } catch (err) {
        handleSupabaseError(err, "getLessons");
      }
    }
    const local = loadLocalDB();
    const localLessons = local.lessons || [];
    return [...localLessons].sort((a: Lesson, b: Lesson) => a.order_index - b.order_index);
  },

  async getLessonById(id: string): Promise<Lesson | null> {
    if (isSupabaseAvailable()) {
      try {
        const queryPromise = supabase
          .from("lessons")
          .select("*")
          .eq("id", id)
          .single();
        const { data, error } = await withTimeout(queryPromise, 3500);
        if (!error && data) {
          markSupabaseSuccess();
          return data;
        }
        if (error && error.code !== "PGRST116") {
          throw error;
        }
      } catch (err) {
        handleSupabaseError(err, "getLessonById");
      }
    }
    const local = loadLocalDB();
    return local.lessons.find((l: Lesson) => l.id === id) || null;
  },

  async saveLesson(lesson: Lesson): Promise<Lesson> {
    // 1. Save to Local DB
    const local = loadLocalDB();
    const idx = local.lessons.findIndex((l: Lesson) => l.id === lesson.id);
    if (idx !== -1) {
      local.lessons[idx] = lesson;
    } else {
      local.lessons.push(lesson);
    }
    saveLocalDB(local);

    // 2. Sync to Supabase if available
    if (isSupabaseAvailable()) {
      try {
        const upsertPromise = supabase
          .from("lessons")
          .upsert(lesson)
          .select()
          .single();
        const { data, error } = await withTimeout(upsertPromise, 3500);
        if (!error && data) {
          markSupabaseSuccess();
          return data;
        }
      } catch (err) {
        handleSupabaseError(err, "saveLesson");
      }
    }
    
    return lesson;
  },

  async deleteLesson(id: string): Promise<boolean> {
    // 1. Delete from Local DB
    const local = loadLocalDB();
    const lenBefore = local.lessons.length;
    local.lessons = local.lessons.filter((l: Lesson) => l.id !== id);
    local.questions = local.questions.filter((q: QuizQuestion) => q.lesson_id !== id);
    local.progress = local.progress.filter((p: UserProgress) => p.lesson_id !== id);
    saveLocalDB(local);

    // 2. Delete from Supabase if available
    if (isSupabaseAvailable()) {
      try {
        const delPromise = supabase.from("lessons").delete().eq("id", id);
        const { error } = await withTimeout(delPromise, 3000);
        if (!error) markSupabaseSuccess();
      } catch (err) {
        handleSupabaseError(err, "deleteLesson");
      }
    }
    
    return local.lessons.length < lenBefore;
  },

  // Questions CRUD
  async getQuestionsByLesson(lessonId: string): Promise<QuizQuestion[]> {
    const local = loadLocalDB();
    const localQuestions = local.questions.filter((q: QuizQuestion) => q.lesson_id === lessonId);

    if (isSupabaseAvailable()) {
      try {
        const queryPromise = supabase
          .from("quiz_questions")
          .select("*")
          .eq("lesson_id", lessonId)
          .order("order_index", { ascending: true });
        const { data, error } = await withTimeout(queryPromise, 3500);
        if (error) throw error;
        markSupabaseSuccess();
        if (data && data.length > 0) {
          // Merge with local questions to restore template_code that may not exist as a column in Supabase
          return data.map((q: any) => {
            const matchedLocal = localQuestions.find((l: any) => l.id === q.id) ||
              local.questions.find((l: any) => l.id === q.id);
            let template_code = q.template_code || matchedLocal?.template_code;

            // Smart fallback if template_code is missing for printing slot questions
            if (!template_code && q.type === "drag_drop") {
              const opts = Array.isArray(q.options) ? q.options : [];
              const correct = Array.isArray(q.correct_answer) ? q.correct_answer : [q.correct_answer];
              if (
                opts.some((o: string) => ["print", "println", "Print"].includes(o)) ||
                correct.some((c: string) => ["print", "println"].includes(c))
              ) {
                template_code = 'System.out.___("Hello World");';
              }
            }

            return {
              ...(matchedLocal || {}),
              ...q,
              template_code: template_code || undefined,
            };
          });
        }
      } catch (err) {
        handleSupabaseError(err, "getQuestionsByLesson");
      }
    }
    return localQuestions;
  },

  async saveQuestion(question: QuizQuestion): Promise<QuizQuestion> {
    // 1. Save to Local DB
    const local = loadLocalDB();
    const idx = local.questions.findIndex((q: QuizQuestion) => q.id === question.id);
    if (idx !== -1) {
      local.questions[idx] = question;
    } else {
      local.questions.push(question);
    }
    saveLocalDB(local);

    // 2. Sync to Supabase if available
    if (isSupabaseAvailable()) {
      try {
        // Strip template_code before upserting if it might not exist in Supabase schema
        const { template_code, ...supabasePayload } = question;
        const upsertPromise = supabase
          .from("quiz_questions")
          .upsert(supabasePayload)
          .select()
          .single();
        const { data, error } = await withTimeout(upsertPromise, 3500);
        if (!error && data) {
          markSupabaseSuccess();
          return { ...data, template_code: question.template_code };
        }
      } catch (err) {
        handleSupabaseError(err, "saveQuestion");
      }
    }
    
    return question;
  },

  async deleteQuestion(id: string): Promise<boolean> {
    // 1. Delete from Local DB
    const local = loadLocalDB();
    const lenBefore = local.questions.length;
    local.questions = local.questions.filter((q: QuizQuestion) => q.id !== id);
    saveLocalDB(local);

    // 2. Delete from Supabase if available
    if (isSupabaseAvailable()) {
      try {
        const delPromise = supabase.from("quiz_questions").delete().eq("id", id);
        const { error } = await withTimeout(delPromise, 3000);
        if (!error) markSupabaseSuccess();
      } catch (err) {
        handleSupabaseError(err, "deleteQuestion");
      }
    }
    
    return local.questions.length < lenBefore;
  },

  // User Progress & Score Tracking
  async getUserProgress(userId: string): Promise<UserProgress[]> {
    if (isSupabaseAvailable()) {
      try {
        const queryPromise = supabase
          .from("user_progress")
          .select("*")
          .eq("user_id", userId);
        const { data, error } = await withTimeout(queryPromise, 3500);
        if (error) throw error;
        markSupabaseSuccess();
        if (data) return data;
      } catch (err) {
        handleSupabaseError(err, "getUserProgress");
      }
    }
    
    const local = loadLocalDB();
    return local.progress.filter((p: UserProgress) => p.user_id === userId);
  },

  async getAllProgress(): Promise<UserProgress[]> {
    if (isSupabaseAvailable()) {
      try {
        const queryPromise = supabase.from("user_progress").select("*");
        const { data, error } = await withTimeout(queryPromise, 3500);
        if (error) throw error;
        markSupabaseSuccess();
        if (data) return data;
      } catch (err) {
        handleSupabaseError(err, "getAllProgress");
      }
    }
    const local = loadLocalDB();
    return local.progress || [];
  },

  async saveProgress(progress: UserProgress): Promise<UserProgress> {
    // 1. Save to Local DB
    const local = loadLocalDB();
    const idx = local.progress.findIndex(
      (p: UserProgress) => p.user_id === progress.user_id && p.lesson_id === progress.lesson_id
    );
    let updatedProgress = { ...progress };
    if (idx !== -1) {
      local.progress[idx] = { ...local.progress[idx], ...progress, updated_at: new Date().toISOString() };
      updatedProgress = local.progress[idx];
    } else {
      local.progress.push(progress);
    }
    saveLocalDB(local);

    // 2. Sync to Supabase if available
    if (isSupabaseAvailable()) {
      try {
        const { id, ...progressPayload } = progress;
        const upsertPromise = supabase
          .from("user_progress")
          .upsert(progressPayload, { onConflict: "user_id,lesson_id" })
          .select()
          .single();
        const { data, error } = await withTimeout(upsertPromise, 3500);
        if (!error && data) {
          markSupabaseSuccess();
          return data;
        } else if (error) {
          console.error("Supabase upsert error in saveProgress:", error);
        }
      } catch (err: any) {
        handleSupabaseError(err, "saveProgress");
      }
    }
    
    return updatedProgress;
  }
};
