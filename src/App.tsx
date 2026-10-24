import React, { useEffect, useState, useMemo, FormEvent } from "react";
import { Lesson, Profile, UserProgress, AnalyticsData } from "./types";
import { safeFetchJson } from "./lib/api";
import { validateEmail } from "./lib/emailValidation";
import ThemeToggle from "./components/ThemeToggle";
import SyntaxHighlighter from "./components/SyntaxHighlighter";
import QuizView from "./components/QuizView";
import AdminLessons from "./components/AdminLessons";
import AdminQuizzes from "./components/AdminQuizzes";
import AdminUsers from "./components/AdminUsers";
import AdminAnalytics from "./components/AdminAnalytics";
import StudentAnalyticsChart from "./components/StudentAnalyticsChart";
import MobileChapterSwitcher from "./components/MobileChapterSwitcher";
import {
  BookOpen,
  GraduationCap,
  Sparkles,
  Unlock,
  Lock,
  ArrowLeft,
  ChevronRight,
  LogOut,
  User,
  Shield,
  LayoutDashboard,
  CheckCircle,
  HelpCircle,
  BookMarked,
  AlertCircle,
  Search,
  Check,
  X,
  Mail,
  FileText,
  ArrowRight,
  Play,
  Compass,
  Eye,
  EyeOff
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  // Navigation states
  const [currentView, setCurrentView] = useState<"home" | "lesson" | "admin">("home");
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [lessonStep, setLessonStep] = useState<"content" | "quiz">("content");

  // Authentication states
  const [user, setUser] = useState<Profile | null>(null);
  const [token, setToken] = useState<string>(() => localStorage.getItem("auth_token") || "");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fullNameInput, setFullNameInput] = useState("");
  const [authError, setAuthError] = useState("");

  // Password security criteria helpers
  const isMinLength = passwordInput.length >= 8;
  const hasUppercase = /[A-Z]/.test(passwordInput);
  const hasLowercase = /[a-z]/.test(passwordInput);
  const hasNumber = /[0-9]/.test(passwordInput);

  // Email validation helper
  const emailValResult = validateEmail(emailInput);

  // Email Verification Link States
  const [isLinkSentStep, setIsLinkSentStep] = useState(false);
  const [simulatedLinkToken, setSimulatedLinkToken] = useState<string | null>(null);
  const [simulatedVerificationLink, setSimulatedVerificationLink] = useState<string | null>(null);
  const [smtpPreviewUrl, setSmtpPreviewUrl] = useState<string | null>(null);
  const [isCustomSmtp, setIsCustomSmtp] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [isRequestingLink, setIsRequestingLink] = useState(false);
  const [isVerifyingLink, setIsVerifyingLink] = useState(false);
  const [verificationSuccessMsg, setVerificationSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer((prev) => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  // Data states
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [progressList, setProgressList] = useState<UserProgress[]>([]);
  const [adminUsers, setAdminUsers] = useState<Profile[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);

  // Admin active sub-view
  const [adminTab, setAdminTab] = useState<"lessons" | "quizzes" | "users" | "analytics">("analytics");
  const [activeAdminLessonForQuiz, setActiveAdminLessonForQuiz] = useState<Lesson | null>(null);

  // Search state for lessons
  const [searchQuery, setSearchQuery] = useState("");

  // Toast Notification state
  const [toast, setToast] = useState<{ message: string; type?: "success" | "error" | "info" } | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 4000);
  };

  // Database Connection Status state
  const [dbStatus, setDbStatus] = useState<{ connected: boolean; provider: string; message: string } | null>(null);

  // Check URL query params for verification link (e.g. ?verify_token=...&email=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const verifyToken = params.get("verify_token");
    const verifyEmail = params.get("email");

    if (verifyToken && verifyEmail) {
      handleVerifyEmailTokenDirect(verifyEmail, verifyToken);
      // Clean query params from URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Poll for verification completion when waiting for email verification (e.g. user verifies on mobile phone)
  useEffect(() => {
    let intervalId: any = null;

    if (showAuthModal && authMode === "register" && isLinkSentStep && emailInput) {
      intervalId = setInterval(async () => {
        try {
          const res = await fetch(`/api/auth/check-verification-status?email=${encodeURIComponent(emailInput.trim())}`);
          const data = await res.json();

          if (data && data.verified && data.user) {
            clearInterval(intervalId);
            setIsLinkSentStep(false);
            showToast("ยืนยันอีเมลเรียบร้อยแล้ว เข้าสู่ระบบสำเร็จ", "success");
            handleLoginFlow(data.token || data.user.id);
          }
        } catch (e) {
          // Ignore network errors during polling
        }
      }, 3000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [showAuthModal, authMode, isLinkSentStep, emailInput]);

  // Load basic state on startup
  useEffect(() => {
    fetchLessons();
    fetchDbStatus();
    if (token) {
      fetchCurrentUser();
    }
    // Initialize dark/light theme class from localStorage
    const savedTheme = localStorage.getItem("theme") || "dark";
    if (savedTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [token]);

  // Listen for message from Google OAuth popup window
  useEffect(() => {
    const handleOAuthMessage = (event: MessageEvent) => {
      const origin = event.origin;
      // อนุญาตโดเมนปัจจุบัน (Render, Custom Domain) และ Development domains
      if (
        origin !== window.location.origin &&
        !origin.endsWith(".onrender.com") &&
        !origin.endsWith(".run.app") &&
        !origin.includes("localhost") &&
        !origin.includes("127.0.0.1")
      ) {
        return;
      }

      if (event.data?.type === "OAUTH_AUTH_SUCCESS") {
        const oauthToken = event.data.token;
        if (oauthToken) {
          handleLoginFlow(oauthToken, event.data.user);
        }
      } else if (event.data?.type === "OAUTH_AUTH_FAILED") {
        const errorMsg = event.data.error;
        setAuthError(decodeURIComponent(errorMsg || "การเข้าสู่ระบบผ่าน Google ไม่สำเร็จ"));
      }
    };

    window.addEventListener("message", handleOAuthMessage);
    return () => {
      window.removeEventListener("message", handleOAuthMessage);
    };
  }, []);

  const handleGoogleLogin = async () => {
    setAuthError("");
    try {
      const origin = window.location.origin;
      const { ok, data, error } = await safeFetchJson(`/api/auth/google/url?origin=${encodeURIComponent(origin)}`);
      if (!ok || !data) {
        throw new Error(error || "ไม่สามารถดึงลิงก์เชื่อมต่อ Google OAuth ได้");
      }

      if (data.url) {
        const width = 500;
        const height = 620;
        const left = window.screenX + (window.innerWidth - width) / 2;
        const top = window.screenY + (window.innerHeight - height) / 2;
        const popup = window.open(
          data.url,
          "google_oauth",
          `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes`
        );

        if (!popup) {
          setAuthError("กรุณาเปิดการใช้งานหน้าต่างป็อปอัป (Popups) ในเบราว์เซอร์ของคุณเพื่อดำเนินการต่อด้วย Google");
        }
      }
    } catch (err: any) {
      setAuthError(err.message || "เกิดข้อผิดพลาดในการเริ่มต้น Google Login");
    }
  };

  const fetchDbStatus = async () => {
    const { ok, data } = await safeFetchJson("/api/db/status");
    if (ok && data) {
      setDbStatus(data);
    }
  };

  const fetchCurrentUser = async () => {
    const activeToken = localStorage.getItem("auth_token") || token;
    if (!activeToken) return;

    const { ok, data } = await safeFetchJson("/api/auth/me", {
      headers: {
        Authorization: `Bearer ${activeToken}`,
      },
    });
    if (ok && data) {
      setUser(data);
      fetchUserProgress(token);
      // If they are an admin, load admin statistics and lists
      if (data.role === "admin") {
        fetchAdminData();
      }
    } else {
      // Clear stale token
      handleLogout();
    }
  };

  const fetchLessons = async () => {
    const headers: any = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    const { ok, data } = await safeFetchJson("/api/lessons", { headers });
    if (ok && Array.isArray(data)) {
      setLessons(data);
    }
  };

  const fetchUserProgress = async (authToken: string) => {
    const { ok, data } = await safeFetchJson("/api/progress", {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });
    if (ok && Array.isArray(data)) {
      setProgressList(data);
    }
  };

  const fetchAdminData = async () => {
    // 1. Fetch Users List
    const resUsers = await safeFetchJson("/api/admin/users", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (resUsers.ok && Array.isArray(resUsers.data)) {
      setAdminUsers(resUsers.data);
    }

    // 2. Fetch Analytics
    const resAnalytics = await safeFetchJson("/api/admin/analytics", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (resAnalytics.ok && resAnalytics.data) {
      setAnalytics(resAnalytics.data);
    }
  };

  const handleRequestVerificationLink = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    setAuthError("");

    if (!emailInput || !passwordInput || !fullNameInput) {
      setAuthError("กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }

    // Comprehensive email validation
    const emailVal = validateEmail(emailInput);
    if (!emailVal.isValid) {
      setAuthError(emailVal.error || "รูปแบบอีเมลไม่ถูกต้อง");
      return;
    }

    // Password strength validation
    if (passwordInput.length < 8) {
      setAuthError("รหัสผ่านต้องมีความยาวอย่างน้อย 8 ตัวอักษร");
      return;
    }
    if (!/[A-Z]/.test(passwordInput)) {
      setAuthError("รหัสผ่านต้องมีอักษรตัวพิมพ์ใหญ่ (A-Z) อย่างน้อย 1 ตัว");
      return;
    }
    if (!/[a-z]/.test(passwordInput)) {
      setAuthError("รหัสผ่านต้องมีอักษรตัวพิมพ์เล็ก (a-z) อย่างน้อย 1 ตัว");
      return;
    }
    if (!/[0-9]/.test(passwordInput)) {
      setAuthError("รหัสผ่านต้องมีตัวเลข (0-9) อย่างน้อย 1 ตัว");
      return;
    }

    setIsRequestingLink(true);

    const { ok, data, error } = await safeFetchJson("/api/auth/send-verification-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: emailInput.trim(),
        password: passwordInput,
        full_name: fullNameInput,
      }),
    });

    setIsRequestingLink(false);

    if (!ok || !data) {
      setAuthError(error || "ไม่สามารถส่งลิงก์ยืนยันตัวตนได้ กรุณาตรวจสอบอีเมลและลองอีกครั้ง");
      return;
    }

    setIsLinkSentStep(true);
    setSimulatedLinkToken(data.token || null);
    setSimulatedVerificationLink(data.verificationLink || null);
    setSmtpPreviewUrl(data.previewUrl || null);
    setIsCustomSmtp(!!data.isCustomSmtp);
    setResendTimer(60);
  };

  const handleVerifyEmailTokenDirect = async (email: string, token: string) => {
    setAuthError("");
    setIsVerifyingLink(true);

    const { ok, data, error } = await safeFetchJson("/api/auth/verify-email-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email.trim(),
        token: token.trim(),
      }),
    });

    setIsVerifyingLink(false);

    if (!ok || !data) {
      setAuthError(error || "ลิงก์ยืนยันตัวตนไม่ถูกต้องหรือหมดอายุแล้ว กรุณากดขอลิงก์ใหม่อีกครั้ง");
      return;
    }

    // Success! Log user in
    setIsLinkSentStep(false);
    setSimulatedLinkToken(null);
    setSimulatedVerificationLink(null);
    setVerificationSuccessMsg(`ยืนยันที่อยู่อีเมล ${email} สำเร็จเรียบร้อยแล้ว!`);
    handleLoginFlow(data.token || data.id || data.profile?.id);
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError("");

    if (!emailInput || !passwordInput || !fullNameInput) {
      setAuthError("กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }

    const emailVal = validateEmail(emailInput);
    if (!emailVal.isValid) {
      setAuthError(emailVal.error || "รูปแบบอีเมลไม่ถูกต้อง");
      return;
    }

    if (passwordInput.length < 8) {
      setAuthError("รหัสผ่านต้องมีความยาวอย่างน้อย 8 ตัวอักษร");
      return;
    }

    setIsRequestingLink(true);

    const { ok, data, error } = await safeFetchJson("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: emailInput.trim(),
        password: passwordInput,
        full_name: fullNameInput.trim(),
      }),
    });

    setIsRequestingLink(false);

    if (!ok || !data) {
      setAuthError(error || "ไม่สามารถสมัครสมาชิกได้ กรุณาลองใหม่อีกครั้ง");
      return;
    }

    showToast("สมัครสมาชิกและเข้าสู่ระบบสำเร็จแล้ว!", "success");
    handleLoginFlow(data.token || data.id, data);
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError("");

    if (!emailInput || !passwordInput) {
      setAuthError("กรุณากรอกอีเมลและรหัสผ่าน");
      return;
    }

    // Strict email validation regex
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(emailInput.trim())) {
      setAuthError("รูปแบบอีเมลไม่ถูกต้อง กรุณากรอกอีเมลจริง (เช่น student@example.com)");
      return;
    }

    const { ok, data, error } = await safeFetchJson("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: emailInput.trim(),
        password: passwordInput,
      }),
    });

    if (!ok || !data) {
      setAuthError(error || "เข้าสู่ระบบไม่สำเร็จ");
      return;
    }

    handleLoginFlow(data.token || data.id, data);
  };

  const handleLoginFlow = (authToken: string, profileData?: any) => {
    localStorage.setItem("auth_token", authToken);
    setToken(authToken);
    if (profileData) {
      setUser(profileData);
      if (profileData.role === "admin") {
        fetchAdminData();
        setCurrentView("admin");
      }
    }
    setShowAuthModal(false);
    setEmailInput("");
    setPasswordInput("");
    setShowPassword(false);
    setFullNameInput("");
    setAuthError("");
    fetchCurrentUser();
  };

  const handleLogout = () => {
    localStorage.removeItem("auth_token");
    setToken("");
    setUser(null);
    setProgressList([]);
    setCurrentView("home");
    setSelectedLesson(null);
  };

  // Track last accessed lesson from localStorage
  const [lastAccessedId, setLastAccessedId] = useState<string | null>(() => {
    try {
      return localStorage.getItem("last_accessed_lesson_id");
    } catch {
      return null;
    }
  });

  const scrollToTop = () => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    const container = document.getElementById("main-scroll-container");
    if (container) {
      container.scrollTop = 0;
    }
  };

  // Scroll to top whenever entering or changing lesson views
  useEffect(() => {
    if (currentView === "lesson" || currentView === "home" || currentView === "admin") {
      scrollToTop();
      requestAnimationFrame(scrollToTop);
      setTimeout(scrollToTop, 50);
    }
  }, [currentView, selectedLesson?.id, lessonStep]);

  const handleSelectLesson = async (lesson: Lesson, targetStep: "content" | "quiz" = "content") => {
    if (!lesson.is_free && !user) {
      setAuthMode("login");
      setShowAuthModal(true);
      return;
    }

    // Instant reset scroll position to top
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    try {
      localStorage.setItem("last_accessed_lesson_id", lesson.id);
      setLastAccessedId(lesson.id);
    } catch {}

    const { ok, data, error } = await safeFetchJson(`/api/lessons/${lesson.id}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (ok && data) {
      setSelectedLesson(data.lesson);
      setQuestions(data.questions || []);
      setLessonStep(targetStep);
      setCurrentView("lesson");

      // Ensure immediate scroll to top of lesson without smooth lag
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      requestAnimationFrame(() => {
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      });
    } else {
      alert(error || "ไม่สามารถเปิดบทเรียนได้");
    }
  };

  const handleQuizCompleted = async (scorePercent: number, answersMap?: Record<string, any>) => {
    if (!selectedLesson || !user) return;

    let postBody: any = {
      completed: scorePercent >= 60,
      quiz_score: scorePercent,
    };
    let endpoint = `/api/lessons/${selectedLesson.id}/progress`;

    if (answersMap && Object.keys(answersMap).length > 0) {
      postBody = { answers: answersMap };
      endpoint = `/api/lessons/${selectedLesson.id}/quiz/submit`;
    }

    const { ok } = await safeFetchJson(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(postBody),
    });

    if (ok) {
      fetchUserProgress(token);
      fetchLessons();
      if (user.role === "admin") {
        fetchAdminData();
      }
    }
  };

  // Calculations for dynamic dashboard indicators
  const totalLessonsCount = lessons.length;
  const completedLessonsCount = progressList.filter((p) => p.completed).length;
  const completionPercentage = totalLessonsCount > 0
    ? Math.round((completedLessonsCount / totalLessonsCount) * 100)
    : 0;

  const currentProgressRecord = selectedLesson
    ? progressList.find((p) => p.lesson_id === selectedLesson.id)
    : null;

  const sortedLessons = [...lessons].sort((a, b) => a.order_index - b.order_index);
  const currentLessonIndex = selectedLesson
    ? sortedLessons.findIndex((l) => l.id === selectedLesson.id)
    : -1;
  const prevLesson =
    currentLessonIndex > 0
      ? sortedLessons[currentLessonIndex - 1]
      : null;
  const nextLesson =
    currentLessonIndex !== -1 && currentLessonIndex + 1 < sortedLessons.length
      ? sortedLessons[currentLessonIndex + 1]
      : null;

  const filteredLessons = searchQuery.trim() !== ""
    ? lessons.filter((lesson) =>
        lesson.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lesson.content.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : lessons;

  // Smart Continue Learning determination
  const continueLessonInfo = useMemo(() => {
    if (sortedLessons.length === 0) return null;

    let targetLesson: Lesson | null = null;
    let statusLabel = "";

    // 1. Check if user has a stored last accessed lesson
    if (lastAccessedId) {
      const stored = sortedLessons.find((l) => l.id === lastAccessedId);
      if (stored) {
        const prog = progressList.find((p) => p.lesson_id === stored.id);
        if (!prog?.completed) {
          targetLesson = stored;
          statusLabel = prog ? "กำลังเรียนค้างอยู่" : "เริ่มเรียนต่อจากบทนี้";
        } else {
          // If stored is completed, look for the next uncompleted lesson
          const storedIdx = sortedLessons.findIndex((l) => l.id === stored.id);
          if (storedIdx !== -1 && storedIdx + 1 < sortedLessons.length) {
            targetLesson = sortedLessons[storedIdx + 1];
            statusLabel = "บทเรียนถัดไปที่แนะนำ";
          } else {
            targetLesson = stored;
            statusLabel = "ทบทวนบทเรียนล่าสุด";
          }
        }
      }
    }

    // 2. If still no target lesson, find first incomplete lesson
    if (!targetLesson) {
      const firstIncomplete = sortedLessons.find((l) => {
        const prog = progressList.find((p) => p.lesson_id === l.id);
        return !prog?.completed;
      });
      if (firstIncomplete) {
        targetLesson = firstIncomplete;
        statusLabel = "บทเรียนถัดไปที่แนะนำ";
      } else {
        targetLesson = sortedLessons[0];
        statusLabel = "ทบทวนบทเรียน";
      }
    }

    if (!targetLesson) return null;

    const progress = progressList.find((p) => p.lesson_id === targetLesson!.id);
    return {
      lesson: targetLesson,
      progress,
      statusLabel,
    };
  }, [sortedLessons, lastAccessedId, progressList]);

  return (
    <div id="app-root-viewport" className="min-h-screen lg:h-screen lg:flex lg:overflow-hidden bg-slate-50 dark:bg-[#0F172A] text-slate-900 dark:text-slate-100 font-sans transition-all duration-300">
      
      {/* DESKTOP SIDEBAR NAV */}
      <aside className="hidden lg:flex w-64 bg-white dark:bg-[#1E293B] border-r border-slate-200 dark:border-slate-700/60 flex-col flex-shrink-0">
        <div className="p-6 border-b border-slate-700/60">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => { setCurrentView("home"); setSelectedLesson(null); }}>
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/20">
              <span className="font-mono text-xs font-bold tracking-tight">Java</span>
            </div>
            <div>
              <h1 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider leading-none">Java Easy Learn</h1>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider mt-1">เรียนรู้ภาษา Java</p>
            </div>
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 px-2">เมนูหลัก</div>
          
          <button
            id="sidebar-all-lessons-btn"
            onClick={() => { setCurrentView("home"); setSelectedLesson(null); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-xs font-bold transition-all cursor-pointer ${
              currentView === "home"
                ? "bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-xs dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-500/30"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-200 border border-transparent"
            }`}
          >
            <BookOpen className={`w-4 h-4 flex-shrink-0 ${currentView === "home" ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500 dark:text-slate-400"}`} />
            <span className={currentView === "home" ? "text-indigo-700 dark:text-indigo-300 font-bold" : ""}>บทเรียนทั้งหมด</span>
          </button>

          {continueLessonInfo && (
            <button
              id="sidebar-continue-learning-btn"
              onClick={() => handleSelectLesson(continueLessonInfo.lesson)}
              className="w-full flex items-start gap-3 px-3 py-2.5 rounded-xl text-left text-xs font-semibold transition-all cursor-pointer text-indigo-700 bg-indigo-50/80 hover:bg-indigo-100/90 border border-indigo-200/80 dark:text-indigo-300 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 dark:border-indigo-500/30 group shadow-xs"
              title={`เรียนต่อ: ${continueLessonInfo.lesson.title}`}
            >
              <Play className="w-4 h-4 text-indigo-500 fill-indigo-500/30 dark:text-indigo-400 dark:fill-indigo-400/40 mt-0.5 flex-shrink-0 group-hover:scale-110 transition-transform" />
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-wider flex items-center gap-1">
                  <span>เรียนต่อล่าสุด</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                </div>
                <div className="text-slate-900 dark:text-white truncate font-medium text-xs mt-0.5">
                  บทที่ {continueLessonInfo.lesson.order_index}: {continueLessonInfo.lesson.title}
                </div>
              </div>
            </button>
          )}

          {user && user.role === "admin" && (
            <>
              <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-6 mb-2 px-2">ผู้ดูแลระบบ</div>
              
              <button
                id="sidebar-admin-analytics-btn"
                onClick={() => { setCurrentView("admin"); setAdminTab("analytics"); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-xs font-bold transition-all cursor-pointer ${
                  currentView === "admin" && adminTab === "analytics"
                    ? "bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-xs dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-500/30"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-200 border border-transparent"
                }`}
              >
                <LayoutDashboard className={`w-4 h-4 flex-shrink-0 ${currentView === "admin" && adminTab === "analytics" ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500 dark:text-slate-400"}`} />
                <span className={currentView === "admin" && adminTab === "analytics" ? "text-indigo-700 dark:text-indigo-300 font-bold" : ""}>แผงรายงานภาพรวม</span>
              </button>

              <button
                id="sidebar-admin-lessons-btn"
                onClick={() => { setCurrentView("admin"); setAdminTab("lessons"); setActiveAdminLessonForQuiz(null); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-xs font-bold transition-all cursor-pointer ${
                  currentView === "admin" && adminTab === "lessons"
                    ? "bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-xs dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-500/30"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-200 border border-transparent"
                }`}
              >
                <BookMarked className={`w-4 h-4 flex-shrink-0 ${currentView === "admin" && adminTab === "lessons" ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500 dark:text-slate-400"}`} />
                <span className={currentView === "admin" && adminTab === "lessons" ? "text-indigo-700 dark:text-indigo-300 font-bold" : ""}>จัดการบทเรียน</span>
              </button>

              <button
                id="sidebar-admin-users-btn"
                onClick={() => { setCurrentView("admin"); setAdminTab("users"); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-xs font-bold transition-all cursor-pointer ${
                  currentView === "admin" && adminTab === "users"
                    ? "bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-xs dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-500/30"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-200 border border-transparent"
                }`}
              >
                <User className={`w-4 h-4 flex-shrink-0 ${currentView === "admin" && adminTab === "users" ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500 dark:text-slate-400"}`} />
                <span className={currentView === "admin" && adminTab === "users" ? "text-indigo-700 dark:text-indigo-300 font-bold" : ""}>สมาชิกผู้เรียน ({adminUsers.length})</span>
              </button>
            </>
          )}
        </nav>

        {user && (
          <div className="p-4 mt-auto border-t border-slate-200 dark:border-slate-700/50">
            <div className="bg-slate-50 dark:bg-[#0F172A] p-4 rounded-xl border border-slate-200 dark:border-slate-700/40">
              <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1.5">ความคืบหน้า</span>
              <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden mb-2">
                <div 
                  className="bg-indigo-600 dark:bg-indigo-500 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${completionPercentage}%` }}
                ></div>
              </div>
              <div className="flex justify-between items-center text-[11px] font-bold text-slate-600 dark:text-slate-400">
                <span>เรียนแล้ว {completionPercentage}%</span>
                <span>{completedLessonsCount}/{totalLessonsCount} บท</span>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* RIGHT SIDE MAIN SCREEN CONTENT */}
      <div className="flex-1 flex flex-col lg:h-screen lg:overflow-hidden">
        
        {/* HEADER BAR */}
        <header className="h-16 border-b border-slate-200 dark:border-slate-700/60 flex items-center justify-between px-4 sm:px-8 bg-white dark:bg-[#1E293B] sticky top-0 z-40">
          <div className="flex items-center gap-3">
            {/* Mobile Logo Block */}
            <div className="flex lg:hidden items-center gap-2.5 cursor-pointer" onClick={() => { setCurrentView("home"); setSelectedLesson(null); }}>
              <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-mono text-sm font-black">J</div>
              <div>
                <h1 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider leading-none">Java Easy Learn</h1>
                <p className="text-[9px] text-slate-500 dark:text-slate-400 font-bold tracking-wider mt-0.5">เรียนรู้ง่าย ภาษาไทย</p>
              </div>
            </div>

            {/* Desktop Welcome Breadcrumb */}
            <h2 className="hidden lg:block text-slate-500 dark:text-slate-400 text-xs font-medium">
              {user ? (
                <>
                  ยินดีต้อนรับกลับมา, <span className="text-slate-900 dark:text-white font-bold">{user.full_name}</span>
                  {user.role === "admin" && (
                    <span className="ml-2 px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 text-[10px] font-black rounded-md dark:border-indigo-500/20">แอดมิน</span>
                  )}
                </>
              ) : (
                "เข้าเรียนเขียนโปรแกรมภาษา Java ฟรี เรียนง่ายสไตล์โต้ตอบ!"
              )}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {/* Quick search input (visible on home screen) */}
            {currentView === "home" && (
              <div className="relative hidden sm:flex items-center bg-slate-50 dark:bg-[#0F172A] rounded-xl px-3 py-1.5 border border-slate-200 dark:border-slate-700/60 text-xs text-slate-500 dark:text-slate-400 w-44 md:w-56 focus-within:w-64 focus-within:border-indigo-500/50 transition-all duration-200">
                <Search size={13} className="mr-2 text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  placeholder="ค้นหาบทเรียนอย่างรวดเร็ว..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent border-none outline-none text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 w-full text-xs"
                />
              </div>
            )}

            <ThemeToggle />

            {/* Database connection status badge */}
            {dbStatus && (
              <div 
                id="db-status-badge"
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-all ${
                  dbStatus.connected 
                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/20" 
                    : "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400 dark:border-amber-500/20"
                }`}
                title={dbStatus.message}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${dbStatus.connected ? "bg-emerald-500 dark:bg-emerald-400 animate-pulse" : "bg-amber-500 dark:bg-amber-400"}`}></span>
                <span className="hidden sm:inline">{dbStatus.connected ? "Supabase Cloud (เชื่อมต่อแล้ว)" : "Local JSON (ฐานข้อมูลในเครื่อง)"}</span>
                <span className="sm:hidden">{dbStatus.connected ? "Cloud" : "Local"}</span>
              </div>
            )}

            {/* If Logged In: show Profile and Control buttons */}
            {user ? (
              <div className="flex items-center gap-2">
                {/* Mobile Admin Shortcut Button */}
                {user.role === "admin" && (
                  <button
                    id="nav-admin-dashboard-btn"
                    onClick={() => {
                      if (currentView === "admin") {
                        setCurrentView("home");
                      } else {
                        setCurrentView("admin");
                        fetchAdminData();
                      }
                    }}
                    className={`lg:hidden px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 border ${
                      currentView === "admin"
                        ? "bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-600/20 dark:border-indigo-500/40 dark:text-indigo-400"
                        : "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200 dark:bg-[#0F172A] dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    }`}
                  >
                    <Shield size={12} />
                    {currentView === "admin" ? "หน้าหลัก" : "แอดมิน"}
                  </button>
                )}

                {/* Profile Widget */}
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-700 font-semibold dark:bg-[#0F172A] dark:border-slate-700/60 dark:text-slate-200">
                  <User size={12} className="text-indigo-600 dark:text-indigo-400" />
                  <span className="max-w-[120px] truncate">{user.full_name}</span>
                </div>

                {/* Logout Button */}
                <button
                  id="nav-logout-btn"
                  onClick={() => setShowLogoutConfirm(true)}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200 dark:bg-[#0F172A] dark:hover:bg-rose-950/20 dark:text-slate-400 dark:hover:text-rose-400 dark:border-slate-700/60 transition-colors cursor-pointer"
                  title="ออกจากระบบ"
                >
                  <LogOut size={14} />
                </button>
              </div>
            ) : (
              /* If Anonymous: show Login Trigger */
              <button
                id="nav-login-btn"
                onClick={() => {
                  setAuthMode("login");
                  setShowAuthModal(true);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-md shadow-indigo-600/10"
              >
                เข้าสู่ระบบ / สมัครเรียน
              </button>
            )}
          </div>
        </header>

        {/* SCROLLABLE MAIN VIEWPORT */}
        <div id="main-scroll-container" className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-8 bg-[#0F172A]">
          
          {/* ==========================================
              VIEW 1: HOME PAGE / LEARNER DASHBOARD
              ========================================== */}
          {currentView === "home" && (
            <div id="home-view" className="space-y-8 animate-fade-in">
              
              {/* HERO SECTION (Only shown when not logged in) */}
              {!user && (
                <div
                  id="hero-banner"
                  className="relative overflow-hidden bg-gradient-to-br from-indigo-50/90 via-white to-purple-50/40 border border-indigo-200/80 shadow-xl shadow-indigo-100/40 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950 dark:border dark:border-slate-700/50 dark:shadow-md rounded-3xl p-8 md:p-12 transition-all"
                >
                  <div className="absolute right-0 top-0 w-1/3 h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-500/10 via-transparent to-transparent opacity-60 pointer-events-none"></div>
                  <div className="relative max-w-2xl space-y-4">
                    <span className="hero-badge inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-100/80 border border-indigo-300/80 text-indigo-700 dark:bg-indigo-500/15 dark:border-indigo-400/20 dark:text-indigo-400 rounded-full text-xs font-bold uppercase tracking-widest shadow-xs">
                      <Sparkles size={12} className="text-indigo-600 dark:text-indigo-400" />
                      หลักสูตรภาษา Java สำหรับผู้เริ่มต้น
                    </span>
                    <h2 className="text-3xl md:text-5xl font-black tracking-tight leading-tight text-slate-900 dark:text-white">
                      เรียนรู้การเขียนโปรแกรมภาษา Java{" "}
                      <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-300">
                        ตั้งแต่พื้นฐาน
                      </span>
                    </h2>
                    <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-xl font-medium">
                      เนื้อหาภาษาไทย สรุปกระชับ พร้อมตัวอย่างโค้ดและแบบฝึกหัดท้ายบทเพื่อทบทวนความเข้าใจ
                    </p>
                    <div className="pt-2 flex flex-wrap gap-3">
                      <button
                        id="hero-start-learning-btn"
                        onClick={() => {
                          if (sortedLessons.length > 0) {
                            handleSelectLesson(sortedLessons[0]);
                          } else {
                            setAuthMode("register");
                            setShowAuthModal(true);
                          }
                        }}
                        className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white rounded-2xl text-xs font-bold transition-all cursor-pointer shadow-md shadow-indigo-600/25 active:scale-95 flex items-center gap-2"
                      >
                        <Play size={14} className="fill-white" />
                        <span>เริ่มเรียนบทแรกฟรีทันที</span>
                      </button>
                      <button
                        id="hero-login-btn"
                        onClick={() => {
                          setAuthMode("login");
                          setShowAuthModal(true);
                        }}
                        className="px-6 py-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 dark:bg-[#1E293B] dark:hover:bg-slate-800 dark:text-slate-200 dark:border-slate-700/60 rounded-2xl text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95"
                      >
                        เข้าสู่ระบบ
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* STUDENT COMPACT STATS BOARD (Shown when logged in) */}
              {user && (
                <div id="learner-stats-card" className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700/60 p-6 rounded-2xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 dark:bg-[#0F172A] dark:border-slate-700/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                      <GraduationCap size={28} />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-900 dark:text-white">ข้อมูลการเรียนของคุณ, {user.full_name}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-semibold">
                        ติดตามความก้าวหน้าและทบทวนบทเรียนของคุณได้ตลอดเวลา
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-6">
                    <div className="flex items-center gap-3">
                      <div>
                        <span className="block text-right text-[10px] text-slate-500 font-bold uppercase">เรียนสำเร็จแล้ว</span>
                        <span className="block text-right text-lg font-extrabold font-mono text-slate-900 dark:text-white">
                          {completedLessonsCount} / {totalLessonsCount} บท
                        </span>
                      </div>
                      <div className="relative w-12 h-12 flex items-center justify-center bg-indigo-50 dark:bg-[#0F172A] rounded-full border border-indigo-200 dark:border-slate-700/60">
                        <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 font-mono">
                          {completionPercentage}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STUDENT RECHARTS DATA VISUALIZATION SECTION */}
              {user && lessons.length > 0 && (
                <StudentAnalyticsChart
                  lessons={lessons}
                  progressList={progressList}
                  onSelectLesson={handleSelectLesson}
                />
              )}

              {/* CURRICULUM CHAPTERS LIST */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <BookMarked size={18} className="text-indigo-600 dark:text-indigo-400" />
                      สารบัญบทเรียน (Course Outline)
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      เลือกบทเรียนด้านล่างเพื่อเริ่มอ่านเนื้อหาและทำโจทย์ทดสอบความสามารถ
                    </p>
                  </div>
                  {/* Mobile Search input bar */}
                  <div className="sm:hidden relative w-full flex items-center bg-white dark:bg-[#1E293B] rounded-xl px-3 py-2 border border-slate-200 dark:border-slate-700/60 text-xs text-slate-500 dark:text-slate-400 shadow-xs">
                    <Search size={13} className="mr-2 text-slate-400 dark:text-slate-500" />
                    <input
                      type="text"
                      placeholder="ค้นหาบทเรียนที่นี่..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="bg-transparent border-none outline-none text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 w-full text-xs"
                    />
                  </div>
                </div>

                {filteredLessons.length === 0 ? (
                  <div className="p-12 text-center bg-white dark:bg-[#1E293B] rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-2">
                    <BookOpen size={36} className="text-slate-400 dark:text-slate-600 mx-auto" />
                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">ไม่พบบทเรียนที่ค้นหา</h4>
                    <p className="text-xs text-slate-500">กรุณาลองค้นหาด้วยคำอื่น เช่น "ตัวแปร" หรือ "Loop"</p>
                  </div>
                ) : (
                  <div id="lessons-grid" className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredLessons.map((lesson) => {
                      const lessonProgress = progressList.find((p) => p.lesson_id === lesson.id);
                      const isCompleted = lessonProgress?.completed;
                      const isLocked = !lesson.is_free && !user;
                      const isContinueTarget = continueLessonInfo?.lesson.id === lesson.id;

                      return (
                        <div
                          key={lesson.id}
                          id={`lesson-card-${lesson.id}`}
                          onClick={() => handleSelectLesson(lesson)}
                          className={`group p-5 bg-white dark:bg-[#1E293B] rounded-2xl border transition-all duration-200 cursor-pointer text-left flex items-start justify-between gap-4 shadow-xs ${
                            isContinueTarget
                              ? "ring-2 ring-indigo-500/50 border-indigo-400 dark:border-indigo-500/60 shadow-md shadow-indigo-500/10"
                              : ""
                          } ${
                            isCompleted
                              ? "border-emerald-300 dark:border-emerald-500/40 bg-emerald-50/40 dark:bg-emerald-500/5 hover:border-emerald-400 dark:hover:border-emerald-500/60"
                              : isLocked
                              ? "border-slate-200 dark:border-slate-800 opacity-60 hover:border-slate-300 dark:hover:border-slate-700"
                              : "border-slate-200 dark:border-slate-700/60 hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:shadow-md hover:shadow-indigo-500/5"
                          }`}
                        >
                          <div className="space-y-3 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[10px] font-mono font-extrabold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 dark:bg-[#0F172A] dark:text-slate-400 dark:border-slate-700/40">
                                บทที่ {lesson.order_index}
                              </span>

                              {isContinueTarget && (
                                <span className="text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/40 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                                  <Play size={9} className="fill-current text-indigo-600 dark:text-indigo-400" />
                                  บทเรียนล่าสุด
                                </span>
                              )}

                              {lesson.is_free ? (
                                <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20 px-2 py-0.5 rounded flex items-center gap-0.5">
                                  <Unlock size={10} /> เรียนฟรี
                                </span>
                              ) : (
                                <span className="text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20 px-2 py-0.5 rounded flex items-center gap-0.5">
                                  {isLocked ? <Lock size={10} /> : <Unlock size={10} />} ล็อกอินเพื่อเปิดบทเรียน
                                </span>
                              )}
                            </div>

                            <div>
                              <h4 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors leading-snug">
                                {lesson.title}
                              </h4>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                                {lesson.content.replace(/[#*`-]/g, "")}
                              </p>
                            </div>

                            {/* Complete badge status or score */}
                            {lessonProgress && (
                              <div className="pt-1">
                                {lessonProgress.completed ? (
                                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                    <CheckCircle size={14} />
                                    <span>ผ่านบทเรียนนี้แล้ว (คะแนนล่าสุด: {lessonProgress.quiz_score}%)</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                                    <AlertCircle size={14} />
                                    <span>ยังไม่ผ่านบทเรียน (คะแนนล่าสุด: {lessonProgress.quiz_score}%)</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="flex-shrink-0 self-center">
                            {isLocked ? (
                              <div className="p-2.5 rounded-xl bg-slate-100 text-slate-400 border border-slate-200 dark:bg-[#0F172A] dark:text-slate-500 dark:border-slate-850">
                                <Lock size={15} />
                              </div>
                            ) : (
                              <div className="p-2.5 rounded-xl bg-slate-100 group-hover:bg-indigo-50 text-slate-500 group-hover:text-indigo-600 border border-slate-200 dark:bg-[#0F172A] dark:group-hover:bg-[#151D2A] dark:text-slate-400 dark:group-hover:text-indigo-400 dark:border-slate-700/60 transition-all">
                                <ChevronRight size={15} />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==========================================
              VIEW 2: LESSON DETAILS & QUIZ VIEWER (2-STEP FLOW)
              ========================================== */}
          {currentView === "lesson" && selectedLesson && (
            <div id="lesson-view" className="space-y-6 animate-fade-in max-w-4xl mx-auto pb-24 sm:pb-6">
              
              {/* Mobile Chapter Switcher (Top Strip, Sticky Bottom Bar, and Slide-up Drawer) */}
              <MobileChapterSwitcher
                lessons={lessons}
                currentLesson={selectedLesson}
                progressList={progressList}
                isLoggedIn={!!user}
                onSelectLesson={(lesson) => handleSelectLesson(lesson)}
                prevLesson={prevLesson}
                nextLesson={nextLesson}
              />

              {/* Back to Home toolbar & 2-Step Interactive Stepper */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-700/60">
                <button
                  id="back-to-home-btn"
                  onClick={() => {
                    setCurrentView("home");
                    setSelectedLesson(null);
                    setLessonStep("content");
                    window.scrollTo({ top: 0 });
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-white hover:bg-slate-100 text-xs font-semibold cursor-pointer transition-colors text-slate-700 dark:bg-[#1E293B] dark:hover:bg-slate-800 dark:text-slate-300 w-fit shadow-xs"
                >
                  <ArrowLeft size={13} />
                  กลับหน้าหลัก
                </button>

                {/* 2-Step Segmented Bar */}
                <div className="flex items-center bg-slate-100 dark:bg-[#0F172A] p-1 rounded-2xl border border-slate-200 dark:border-slate-700/60">
                  {/* Step 1 Tab Button */}
                  <button
                    id="step-content-tab"
                    onClick={() => {
                      setLessonStep("content");
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      lessonStep === "content"
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900 hover:bg-white dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/60"
                    }`}
                  >
                    <BookOpen size={13} />
                    <span>1. เนื้อหาบทเรียน</span>
                  </button>

                  <ChevronRight size={14} className="text-slate-400 dark:text-slate-600 mx-0.5" />

                  {/* Step 2 Tab Button */}
                  <button
                    id="step-quiz-tab"
                    onClick={() => {
                      setLessonStep("quiz");
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      lessonStep === "quiz"
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900 hover:bg-white dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/60"
                    }`}
                  >
                    <HelpCircle size={13} />
                    <span>2. แบบทดสอบ</span>
                    {questions.length > 0 && (
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                          lessonStep === "quiz"
                            ? "bg-indigo-700 text-white"
                            : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400"
                        }`}
                      >
                        {questions.length} ข้อ
                      </span>
                    )}
                    {currentProgressRecord?.completed && (
                      <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400"></span>
                    )}
                  </button>
                </div>

                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono font-bold tracking-wider uppercase hidden sm:block">
                  บทที่ {selectedLesson.order_index} / {lessons.length}
                </div>
              </div>

              {/* STEP 1: LESSON CONTENT ARTICLE */}
              {lessonStep === "content" && (
                <div className="space-y-6 animate-fade-in">
                  <article className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700/60 p-6 sm:p-10 rounded-2xl shadow-xs space-y-6">
                    <div className="space-y-2 border-b border-slate-200 dark:border-slate-700/60 pb-5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-widest bg-indigo-50 dark:bg-indigo-500/10 px-2.5 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-500/20">
                          เนื้อหาบทเรียน
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono font-semibold">
                          บทที่ {selectedLesson.order_index}
                        </span>
                      </div>

                      <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-snug pt-1">
                        {selectedLesson.title}
                      </h2>

                      {currentProgressRecord && (
                        currentProgressRecord.completed ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20 text-[10px] font-black uppercase">
                            ผ่านแบบทดสอบแล้ว ({currentProgressRecord.quiz_score}%)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20 text-[10px] font-semibold">
                            คะแนนล่าสุด {currentProgressRecord.quiz_score}% (ยังไม่ผ่านเกณฑ์ 60%)
                          </span>
                        )
                      )}
                    </div>

                    {/* Render Main Content Text */}
                    <div className="text-sm sm:text-base leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap space-y-4">
                      {selectedLesson.content}
                    </div>

                    {/* Source Code Examples block */}
                    {selectedLesson.code_examples && selectedLesson.code_examples.map((ce, index) => (
                      <div key={index} className="pt-4 space-y-2">
                        <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          โค้ดตัวอย่างที่ {index + 1}: {ce.title}
                        </h4>
                        <SyntaxHighlighter code={ce.code} language={ce.language} title={ce.title} />
                      </div>
                    ))}
                  </article>

                  {/* BOTTOM STEP 1 -> STEP 2 NAVIGATION CTA CARD */}
                  <div className="bg-gradient-to-r from-indigo-50/80 via-white to-slate-50 border border-indigo-200/80 dark:from-slate-900 dark:via-indigo-950/40 dark:to-slate-900 dark:border-indigo-500/30 p-6 sm:p-8 rounded-2xl shadow-xl flex flex-col sm:flex-row items-center justify-between gap-6">
                    <div className="space-y-1.5 text-center sm:text-left">
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                        {questions.length > 0
                          ? `แบบทดสอบท้ายบทเรียน (${questions.length} ข้อ)`
                          : "อ่านเนื้อหาครบถ้วนแล้ว"}
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md">
                        {questions.length > 0
                          ? "เมื่ออ่านเนื้อหาเข้าใจแล้ว สามารถเริ่มทำแบบทดสอบเพื่อวัดผลและบันทึกคะแนน"
                          : "สามารถเลือกบทเรียนอื่นหรือกลับสู่หน้าหลักเพื่อเรียนรู้ต่อ"}
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                      {questions.length > 0 ? (
                        <button
                          id="goto-step2-quiz-btn"
                          onClick={() => {
                            setLessonStep("quiz");
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                          className="w-full sm:w-auto px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 !text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/30 transition-all"
                        >
                          <span className="!text-white">เริ่มทำแบบทดสอบ</span>
                          <ArrowRight size={14} className="!text-white" />
                        </button>
                      ) : (
                        nextLesson && (
                          <button
                            onClick={() => handleSelectLesson(nextLesson)}
                            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/30 transition-all"
                          >
                            <span>ไปบทเรียนถัดไป</span>
                            <ArrowRight size={14} />
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: QUIZ ASSESSMENT VIEWER */}
              {lessonStep === "quiz" && (
                <div className="space-y-4 animate-fade-in">
                  {questions.length > 0 ? (
                    <QuizView
                      lessonId={selectedLesson.id}
                      questions={questions}
                      savedProgress={currentProgressRecord || null}
                      onQuizCompleted={handleQuizCompleted}
                      onBackToContent={() => {
                        setLessonStep("content");
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      onNextLesson={nextLesson ? () => handleSelectLesson(nextLesson) : undefined}
                      hasNextLesson={!!nextLesson}
                      isLoggedIn={!!user}
                      onRequireLogin={() => {
                        setAuthMode("login");
                        setShowAuthModal(true);
                      }}
                    />
                  ) : (
                    <div className="bg-[#1E293B] border border-slate-700/60 rounded-2xl p-8 text-center space-y-4">
                      <HelpCircle size={40} className="mx-auto text-slate-500" />
                      <h3 className="text-lg font-bold text-white">บทเรียนนี้ยังไม่มีข้อสอบ</h3>
                      <p className="text-xs text-slate-400">
                        ยังไม่มีแบบทดสอบสำหรับบทนี้ สามารถกลับไปอ่านเนื้อหาหรือเรียนบทถัดไปได้เลย
                      </p>
                      <div className="pt-2 flex justify-center gap-3">
                        <button
                          onClick={() => setLessonStep("content")}
                          className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold cursor-pointer"
                        >
                          กลับไปอ่านเนื้อหา
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ==========================================
              VIEW 3: ADMIN DASHBOARD CONTROL PANEL
              ========================================== */}
          {currentView === "admin" && user?.role === "admin" && (
            <div id="admin-view" className="space-y-8 animate-fade-in">
              {/* Admin Header with Internal Sub Tabs Navigation */}
              <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-700/60 gap-4">
                <div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">แผงควบคุมระบบดูแลเว็บ (Admin Panel)</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">จัดการบทเรียน สมาชิกผู้เรียน และดูสถิติภาพรวมผู้เข้าใช้งานจริง</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    id="tab-analytics"
                    onClick={() => { setAdminTab("analytics"); setActiveAdminLessonForQuiz(null); }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                      adminTab === "analytics"
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                        : "bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 dark:bg-[#1E293B] dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                    }`}
                  >
                    รายงานภาพรวม
                  </button>
                  <button
                    id="tab-lessons"
                    onClick={() => { setAdminTab("lessons"); setActiveAdminLessonForQuiz(null); }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                      adminTab === "lessons" && !activeAdminLessonForQuiz
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                        : "bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 dark:bg-[#1E293B] dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                    }`}
                  >
                    จัดการบทเรียน
                  </button>
                  <button
                    id="tab-users"
                    onClick={() => { setAdminTab("users"); setActiveAdminLessonForQuiz(null); }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                      adminTab === "users"
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                        : "bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 dark:bg-[#1E293B] dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                    }`}
                  >
                    สมาชิกผู้เรียน
                  </button>
                </div>
              </div>

              {/* Tab Contents Renders */}
              <div id="admin-tab-viewport" className="space-y-6">
                {adminTab === "analytics" && (
                  <AdminAnalytics analytics={analytics} />
                )}

                {adminTab === "lessons" && !activeAdminLessonForQuiz && (
                  <AdminLessons
                    lessons={lessons}
                    onRefresh={() => { fetchLessons(); fetchAdminData(); }}
                    token={token}
                    onSelectLessonForQuiz={(lesson) => {
                      setActiveAdminLessonForQuiz(lesson);
                      setAdminTab("quizzes");
                    }}
                    showToast={showToast}
                  />
                )}

                {adminTab === "quizzes" && activeAdminLessonForQuiz && (
                  <AdminQuizzes
                    lesson={activeAdminLessonForQuiz}
                    onBack={() => {
                      setActiveAdminLessonForQuiz(null);
                      setAdminTab("lessons");
                    }}
                    token={token}
                    showToast={showToast}
                  />
                )}

                {adminTab === "users" && (
                  <AdminUsers
                    users={adminUsers}
                    onRefresh={fetchAdminData}
                    token={token}
                    currentUserId={user?.id || ""}
                  />
                )}
              </div>
            </div>
          )}

          {/* INTERNAL COMPACT FOOTER */}
          <footer className="pt-12 border-t border-slate-700/40 text-center space-y-2">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Java Easy Learn &copy; 2026</p>
            <p className="text-[11px] text-slate-400 leading-relaxed max-w-lg mx-auto">
              ออกแบบมาเพื่อส่งเสริมการเรียนเขียนโปรแกรมพื้นฐานด้วยภาษาจาวาในประเทศไทยอย่างมีประสิทธิภาพ สรุปกระชับ พร้อมระบบลากวางโต้ตอบในตัว
            </p>
          </footer>
        </div>
      </div>

      {/* ==========================================
          MODALS AREA: LOGOUT CONFIRMATION & AUTH
          ========================================== */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <div
            id="logout-confirm-modal"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm"
            onClick={() => setShowLogoutConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#1E293B] border border-slate-700/80 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-5"
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center flex-shrink-0">
                  <LogOut size={20} />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-white">ต้องการออกจากระบบหรือไม่?</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    คุณต้องการออกจากระบบหรือไม่ ข้อมูลความคืบหน้าและคะแนนที่บันทึกไว้จะยังคงอยู่
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  id="cancel-logout-btn"
                  onClick={() => setShowLogoutConfirm(false)}
                  className="px-4 py-2 rounded-xl bg-[#0F172A] hover:bg-slate-800 text-slate-300 border border-slate-700/60 text-xs font-semibold cursor-pointer transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  id="confirm-logout-btn"
                  onClick={() => {
                    setShowLogoutConfirm(false);
                    handleLogout();
                    showToast("ออกจากระบบเรียบร้อยแล้ว", "info");
                  }}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer transition-colors shadow-md shadow-rose-600/20 flex items-center gap-1.5"
                >
                  <LogOut size={13} />
                  <span>ออกจากระบบ</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAuthModal && (
          <div id="auth-modal" className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md max-h-[90vh] bg-[#1E293B] border border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col relative"
            >
              {/* Close Button */}
              <button
                id="close-modal-btn"
                onClick={() => {
                  setShowAuthModal(false);
                  setShowPassword(false);
                  setAuthError("");
                }}
                className="absolute top-4 right-4 z-20 text-slate-400 hover:text-white font-bold text-xs cursor-pointer bg-slate-800/80 hover:bg-slate-800 px-2.5 py-1 rounded-lg transition-colors border border-slate-700/50"
              >
                ปิด
              </button>

              {/* Scrollable Container */}
              <div className="p-5 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto custom-scrollbar">
                <div className="text-center pt-1">
                  <span className="inline-flex p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-2">
                    <GraduationCap size={22} />
                  </span>
                  <h3 className="text-base sm:text-lg font-black text-white">
                    {authMode === "login"
                      ? "เข้าสู่ระบบนักเรียน"
                      : isLinkSentStep
                      ? "ตรวจสอบกล่องข้อความอีเมลของคุณ"
                      : "สมัครสมาชิกร่วมเรียน"}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed max-w-xs mx-auto">
                    {authMode === "login"
                      ? "ล็อกอินเพื่อเรียนต่อเนื้อหาทั้งหมดและเก็บคะแนนสอบของคุณ"
                      : isLinkSentStep
                      ? `ส่งลิงก์ยืนยันทางอีเมลของคุณแล้ว: ${emailInput}`
                      : "สร้างบัญชีใหม่ ยืนยันตัวตนด้วย Verification Link ทางอีเมลจริง"}
                  </p>
                </div>

                {authError && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs flex items-center gap-2">
                    <AlertCircle size={14} className="flex-shrink-0" />
                    <span>{authError}</span>
                  </div>
                )}

                {/* Form Controls */}
                {authMode === "register" && isLinkSentStep ? (
                  <div className="space-y-4">
                    {/* Sleek Minimalist Email Instruction Card */}
                    <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-2xl text-left space-y-4 shadow-xl">
                      <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 flex-shrink-0">
                          <Mail size={18} />
                        </div>
                        <div className="space-y-1 flex-1 min-w-0">
                          <h4 className="text-white font-bold text-sm">
                            ส่งลิงก์ยืนยันทางอีเมลของคุณแล้ว
                          </h4>
                          <p className="text-xs text-emerald-300 font-semibold break-all">
                            {emailInput}
                          </p>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2 text-emerald-400 font-medium text-[11px]">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                          </span>
                          กำลังรอการกดลิงก์ยืนยัน...
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setIsLinkSentStep(false);
                          setAuthError("");
                        }}
                        className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                      >
                        ← เปลี่ยนอีเมล / แก้ไขข้อมูล
                      </button>

                      <button
                        type="button"
                        disabled={resendTimer > 0 || isRequestingLink}
                        onClick={() => handleRequestVerificationLink()}
                        className="text-indigo-400 font-bold hover:underline disabled:text-slate-500 disabled:no-underline cursor-pointer"
                      >
                        {resendTimer > 0 ? `ขอลิงก์ใหม่ (${resendTimer}s)` : "ขอส่งลิงก์ยืนยันอีกครั้ง"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={authMode === "login" ? handleLogin : handleRegister} className="space-y-3.5">
                    {authMode === "register" && (
                      <div>
                        <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">ชื่อ-นามสกุล *</label>
                        <input
                          type="text"
                          placeholder="เช่น สมชาย สุขสบาย"
                          value={fullNameInput}
                          onChange={(e) => setFullNameInput(e.target.value)}
                          className="w-full px-3.5 py-2 border border-slate-700 bg-[#0F172A] text-white rounded-xl text-xs focus:outline-none focus:border-indigo-500 transition-all"
                          required
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">
                        {authMode === "login" ? "อีเมล *" : "อีเมลจริงที่รับ Verification Link ได้ *"}
                      </label>
                      <input
                        type="email"
                        placeholder="เช่น yourname@gmail.com, hotmail.com"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        className="w-full px-3.5 py-2 border border-slate-700 bg-[#0F172A] text-white rounded-xl text-xs focus:outline-none focus:border-indigo-500 transition-all"
                        required
                      />
                      {authMode === "register" && emailInput.trim() !== "" && (
                        <div className="mt-1.5 text-[11px]">
                          {emailValResult.isValid ? (
                            <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                              <Check size={12} className="flex-shrink-0" />
                              <span>รูปแบบอีเมลถูกต้อง (จะตรวจสอบ MX Server และส่ง Verification Link)</span>
                            </div>
                          ) : emailValResult.suggestion ? (
                            <div className="p-2 bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-lg space-y-1">
                              <div className="flex items-center gap-1.5">
                                <AlertCircle size={12} className="flex-shrink-0 text-amber-400" />
                                <span>คุณหมายถึง <strong>{emailValResult.suggestion}</strong> หรือไม่?</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setEmailInput(emailValResult.suggestion!)}
                                className="text-[10px] bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-bold px-2 py-0.5 rounded transition-colors cursor-pointer"
                              >
                                คลิกเพื่อเปลี่ยนเป็น {emailValResult.suggestion}
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-rose-400">
                              <X size={12} className="flex-shrink-0" />
                              <span>{emailValResult.error}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">รหัสผ่าน *</label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          placeholder={authMode === "login" ? "กรอกรหัสผ่านของคุณ" : "ตั้งรหัสผ่าน เช่น Pass1234"}
                          value={passwordInput}
                          onChange={(e) => setPasswordInput(e.target.value)}
                          className="w-full pl-3.5 pr-10 py-2 border border-slate-700 bg-[#0F172A] text-white rounded-xl text-xs focus:outline-none focus:border-indigo-500 transition-all font-sans"
                          required
                        />
                        <button
                          type="button"
                          id="toggle-password-visibility-btn"
                          onClick={() => setShowPassword(!showPassword)}
                          aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                          title={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200 dark:hover:text-white rounded-lg transition-colors cursor-pointer flex items-center justify-center focus:outline-none"
                        >
                          {showPassword ? (
                            <EyeOff size={16} className="text-slate-400 hover:text-indigo-400 transition-colors" />
                          ) : (
                            <Eye size={16} className="text-slate-400 hover:text-indigo-400 transition-colors" />
                          )}
                        </button>
                      </div>
                      {authMode === "register" && (
                        <div className="mt-2 p-2.5 bg-slate-900/90 border border-slate-800 rounded-xl text-[11px] space-y-1.5">
                          <div className="text-slate-400 font-semibold text-[10px] uppercase tracking-wider">ข้อกำหนดความปลอดภัยของรหัสผ่าน:</div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            <div className={`flex items-center gap-1.5 transition-colors ${isMinLength ? "text-emerald-400 font-medium" : "text-slate-500"}`}>
                              {isMinLength ? <Check size={12} className="text-emerald-400 flex-shrink-0" /> : <X size={12} className="text-slate-500 flex-shrink-0" />}
                              <span>ยาวอย่างน้อย 8 ตัวอักษร</span>
                            </div>
                            <div className={`flex items-center gap-1.5 transition-colors ${hasUppercase ? "text-emerald-400 font-medium" : "text-slate-500"}`}>
                              {hasUppercase ? <Check size={12} className="text-emerald-400 flex-shrink-0" /> : <X size={12} className="text-slate-500 flex-shrink-0" />}
                              <span>พิมพ์ใหญ่ (A-Z) 1+</span>
                            </div>
                            <div className={`flex items-center gap-1.5 transition-colors ${hasLowercase ? "text-emerald-400 font-medium" : "text-slate-500"}`}>
                              {hasLowercase ? <Check size={12} className="text-emerald-400 flex-shrink-0" /> : <X size={12} className="text-slate-500 flex-shrink-0" />}
                              <span>พิมพ์เล็ก (a-z) 1+</span>
                            </div>
                            <div className={`flex items-center gap-1.5 transition-colors ${hasNumber ? "text-emerald-400 font-medium" : "text-slate-500"}`}>
                              {hasNumber ? <Check size={12} className="text-emerald-400 flex-shrink-0" /> : <X size={12} className="text-slate-500 flex-shrink-0" />}
                              <span>ตัวเลข (0-9) 1+</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <button
                      id="auth-submit-btn"
                      type="submit"
                      disabled={isRequestingLink}
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl cursor-pointer transition-all shadow-md shadow-indigo-600/20 mt-1 flex items-center justify-center gap-2"
                    >
                      {authMode === "login"
                        ? "เข้าสู่ระบบและเริ่มเรียน"
                        : isRequestingLink
                        ? "กำลังสร้าง Verification Link..."
                        : "ส่ง Verification Link ยืนยันทางอีเมล"}
                    </button>
                  </form>
                )}

                {/* Google OAuth Option */}
                <div className="space-y-2.5">
                  <div className="relative flex py-0.5 items-center">
                    <div className="flex-grow border-t border-slate-700/60"></div>
                    <span className="flex-shrink mx-3 text-slate-500 text-[10px] font-bold uppercase">หรือดำเนินการด้วย</span>
                    <div className="flex-grow border-t border-slate-700/60"></div>
                  </div>

                  <button
                    id="google-login-btn"
                    type="button"
                    onClick={handleGoogleLogin}
                    className="w-full py-2 bg-white hover:bg-slate-50 text-slate-900 font-bold text-xs rounded-xl cursor-pointer transition-all shadow-sm flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" width="16" height="16" xmlns="http://www.w3.org/2000/svg">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
                    </svg>
                    <span>เข้าสู่ระบบด้วย Google</span>
                  </button>
                </div>

                {/* Form Switch Options */}
                <div className="text-center text-xs pt-1">
                  {authMode === "login" ? (
                    <p className="text-slate-400">
                      ยังไม่มีบัญชีสมาชิกใช่หรือไม่?{" "}
                      <button
                        id="switch-to-register-btn"
                        onClick={() => {
                          setAuthMode("register");
                          setIsLinkSentStep(false);
                          setShowPassword(false);
                          setAuthError("");
                        }}
                        className="text-indigo-400 font-bold hover:underline cursor-pointer"
                      >
                        สมัครสมาชิกฟรีที่นี่
                      </button>
                    </p>
                  ) : (
                    <p className="text-slate-400">
                      มีบัญชีสมาชิกอยู่แล้ว?{" "}
                      <button
                        id="switch-to-login-btn"
                        onClick={() => {
                          setAuthMode("login");
                          setIsLinkSentStep(false);
                          setShowPassword(false);
                          setAuthError("");
                        }}
                        className="text-indigo-400 font-bold hover:underline cursor-pointer"
                      >
                        เข้าสู่ระบบได้ที่นี่
                      </button>
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* FLOATING TOAST NOTIFICATION BANNER */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-5 right-5 z-50 flex items-center gap-3.5 px-4 py-3.5 rounded-2xl bg-[#1E293B] border border-emerald-500/40 text-white shadow-2xl shadow-emerald-500/20 backdrop-blur-md max-w-sm"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0 border border-emerald-500/30">
              <CheckCircle size={20} />
            </div>
            <div className="flex-1 pr-1">
              <h5 className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-400">แจ้งเตือนระบบ</h5>
              <p className="text-xs font-bold text-slate-100 mt-0.5 leading-snug">{toast.message}</p>
            </div>
            <button
              onClick={() => setToast(null)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              title="ปิดการแจ้งเตือน"
            >
              <X size={15} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
