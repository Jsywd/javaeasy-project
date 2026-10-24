import React, { useState, useEffect } from "react";
import { Lesson, UserProgress } from "../types";
import {
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  X,
  BookOpen,
  CheckCircle2,
  Lock,
  Search,
  Sparkles,
  Layers,
  ArrowRight
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface MobileChapterSwitcherProps {
  lessons: Lesson[];
  currentLesson: Lesson;
  progressList: UserProgress[];
  isLoggedIn: boolean;
  onSelectLesson: (lesson: Lesson) => void;
  prevLesson: Lesson | null;
  nextLesson: Lesson | null;
}

export default function MobileChapterSwitcher({
  lessons,
  currentLesson,
  progressList,
  isLoggedIn,
  onSelectLesson,
  prevLesson,
  nextLesson,
}: MobileChapterSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const sortedLessons = [...lessons].sort((a, b) => a.order_index - b.order_index);
  const currentIndex = sortedLessons.findIndex((l) => l.id === currentLesson.id);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Filter lessons in the drawer
  const filteredLessons = sortedLessons.filter((l) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      l.title.toLowerCase().includes(q) ||
      `บทที่ ${l.order_index}`.toLowerCase().includes(q)
    );
  });

  const getProgress = (lessonId: string) => {
    return progressList.find((p) => p.lesson_id === lessonId);
  };

  const handleLessonPick = (lesson: Lesson) => {
    setIsOpen(false);
    onSelectLesson(lesson);
  };

  return (
    <>
      {/* 1. TOP MOBILE CHAPTER STRIP (Directly under lesson navigation header) */}
      <div className="sm:hidden w-full bg-white dark:bg-[#1E293B]/80 border border-slate-200 dark:border-slate-700/60 rounded-xl p-2.5 flex items-center justify-between gap-2 shadow-xs">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-200 dark:bg-indigo-500/10 dark:border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 flex-shrink-0 text-xs font-bold font-mono">
            {currentLesson.order_index}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 font-medium">
              <span>บทที่ {currentLesson.order_index} จาก {sortedLessons.length}</span>
              {getProgress(currentLesson.id)?.completed && (
                <>
                  <span>·</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">ผ่านแล้ว</span>
                </>
              )}
            </div>
            <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
              {currentLesson.title}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 dark:bg-indigo-600/20 dark:hover:bg-indigo-600/30 dark:border-indigo-500/30 dark:text-indigo-300 text-xs font-semibold cursor-pointer transition-colors flex-shrink-0 shadow-xs"
        >
          <Layers size={13} />
          <span>สลับบทเรียน</span>
        </button>
      </div>

      {/* 2. STICKY BOTTOM MOBILE QUICK SWITCHER BAR */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#0F172A]/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 p-2.5 px-3 flex items-center justify-between gap-2 shadow-lg dark:shadow-2xl safe-area-bottom">
        {/* Prev Chapter Button */}
        <button
          type="button"
          disabled={!prevLesson}
          onClick={() => prevLesson && onSelectLesson(prevLesson)}
          className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold transition-colors min-h-[44px] ${
            prevLesson
              ? "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 dark:bg-[#1E293B] dark:hover:bg-slate-800 dark:text-slate-200 dark:border-slate-700/60 cursor-pointer active:scale-95"
              : "bg-slate-50 text-slate-400 border border-slate-100 dark:bg-slate-900/50 dark:text-slate-600 dark:border-slate-800/40 cursor-not-allowed opacity-50"
          }`}
          title={prevLesson ? `บทก่อนหน้า: ${prevLesson.title}` : "ไม่มีบทก่อนหน้า"}
        >
          <ChevronLeft size={16} />
          <span className="hidden xs:inline">ก่อนหน้า</span>
        </button>

        {/* Center Chapter Trigger: Opens Full Drawer */}
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex-1 mx-1 px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 dark:bg-indigo-600/15 dark:hover:bg-indigo-600/25 dark:border-indigo-500/30 text-left flex items-center justify-between gap-2 cursor-pointer transition-colors min-h-[44px] active:scale-[0.98]"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 text-[10px] text-indigo-700 dark:text-indigo-300/80 font-mono font-medium">
              <span>บทที่ {currentLesson.order_index}/{sortedLessons.length}</span>
              <span>·</span>
              <span className="text-slate-500 dark:text-slate-400 truncate">แตะเพื่อเปลี่ยนบท</span>
            </div>
            <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
              {currentLesson.title}
            </div>
          </div>
          <div className="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-700 dark:text-indigo-300 flex-shrink-0">
            <ChevronUp size={14} />
          </div>
        </button>

        {/* Next Chapter Button */}
        <button
          type="button"
          disabled={!nextLesson}
          onClick={() => nextLesson && onSelectLesson(nextLesson)}
          className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold transition-colors min-h-[44px] ${
            nextLesson
              ? "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 dark:bg-[#1E293B] dark:hover:bg-slate-800 dark:text-slate-200 dark:border-slate-700/60 cursor-pointer active:scale-95"
              : "bg-slate-50 text-slate-400 border border-slate-100 dark:bg-slate-900/50 dark:text-slate-600 dark:border-slate-800/40 cursor-not-allowed opacity-50"
          }`}
          title={nextLesson ? `บทถัดไป: ${nextLesson.title}` : "บทเรียนสุดท้ายแล้ว"}
        >
          <span className="hidden xs:inline">ถัดไป</span>
          <ChevronRight size={16} />
        </button>
      </div>

      {/* 3. SLIDE-UP BOTTOM SHEET DRAWER */}
      <AnimatePresence>
        {isOpen && (
          <div className="sm:hidden fixed inset-0 z-50 flex flex-col justify-end">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/70 backdrop-blur-xs"
            />

            {/* Sheet Container */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="relative w-full max-h-[85vh] bg-white dark:bg-[#0F172A] border-t border-slate-200 dark:border-slate-700/80 rounded-t-3xl shadow-2xl flex flex-col overflow-hidden z-10"
            >
              {/* Drag Handle */}
              <div className="pt-3 pb-1 flex justify-center cursor-pointer" onClick={() => setIsOpen(false)}>
                <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full" />
              </div>

              {/* Drawer Header */}
              <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 dark:bg-indigo-500/10 dark:border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                    <BookOpen size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">
                      สลับบทเรียน (Chapters)
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      ทั้งหมด {sortedLessons.length} บทเรียน · กำลังเรียนบทที่ {currentLesson.order_index}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                  aria-label="ปิดเมนู"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Search filter if there are several lessons */}
              {sortedLessons.length > 3 && (
                <div className="p-3 px-5 border-b border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-[#141E33]">
                  <div className="relative flex items-center bg-white dark:bg-[#0F172A] rounded-xl px-3 py-2 border border-slate-200 dark:border-slate-700/70 text-xs shadow-xs">
                    <Search size={14} className="text-slate-400 mr-2 flex-shrink-0" />
                    <input
                      type="text"
                      placeholder="พิมพ์ค้นหาชื่อบทเรียน หรือบทที่..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-transparent text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 p-0.5"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Lesson Items List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2.5 max-h-[60vh] overscroll-contain">
                {filteredLessons.length === 0 ? (
                  <div className="py-8 text-center text-slate-500 text-xs">
                    ไม่พบบทเรียนที่ค้นหา
                  </div>
                ) : (
                  filteredLessons.map((lesson) => {
                    const isCurrent = lesson.id === currentLesson.id;
                    const prog = getProgress(lesson.id);
                    const isPassed = prog?.completed;
                    const isLocked = !isLoggedIn && !lesson.is_free;

                    return (
                      <button
                        key={lesson.id}
                        type="button"
                        onClick={() => handleLessonPick(lesson)}
                        className={`w-full text-left p-3.5 rounded-2xl border transition-all flex items-center gap-3 cursor-pointer min-h-[56px] active:scale-[0.99] ${
                          isCurrent
                            ? "bg-indigo-50 border-indigo-300 dark:bg-indigo-600/15 dark:border-indigo-500/60 shadow-xs"
                            : isLocked
                            ? "bg-slate-50 border-slate-200 opacity-60 hover:opacity-80 dark:bg-slate-900/40 dark:border-slate-800/60"
                            : "bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300 dark:bg-[#1E293B]/70 dark:hover:bg-[#1E293B] dark:border-slate-700/50 dark:hover:border-slate-600 shadow-xs"
                        }`}
                      >
                        {/* Order Index or Status Icon */}
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-bold font-mono transition-colors ${
                            isCurrent
                              ? "bg-indigo-600 text-white shadow-xs"
                              : isPassed
                              ? "bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30"
                              : isLocked
                              ? "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
                              : "bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                          }`}
                        >
                          {isPassed ? (
                            <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />
                          ) : isLocked ? (
                            <Lock size={14} className="text-slate-400 dark:text-slate-500" />
                          ) : (
                            lesson.order_index
                          )}
                        </div>

                        {/* Lesson Info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[10px] font-mono font-semibold text-slate-500 dark:text-slate-400">
                              บทที่ {lesson.order_index}
                            </span>
                            {isCurrent && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-700 border border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/30">
                                กำลังเรียนอยู่นี้
                              </span>
                            )}
                            {lesson.is_free && (
                              <span className="text-[9px] font-medium text-emerald-600 dark:text-emerald-400">
                                ฟรี
                              </span>
                            )}
                            {isLocked && (
                              <span className="text-[9px] font-medium text-amber-600 dark:text-amber-400">
                                เฉพาะสมาชิก
                              </span>
                            )}
                          </div>
                          <h4
                            className={`text-xs sm:text-sm font-bold truncate ${
                              isCurrent
                                ? "text-indigo-700 dark:text-indigo-200"
                                : "text-slate-900 dark:text-slate-100"
                            }`}
                          >
                            {lesson.title}
                          </h4>
                          {prog && (
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
                              {isPassed ? (
                                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                  ผ่านแบบทดสอบแล้ว ({prog.quiz_score}%)
                                </span>
                              ) : (
                                <span className="text-amber-600 dark:text-amber-400">
                                  คะแนนล่าสุด {prog.quiz_score}% (ยังไม่ผ่านเกณฑ์)
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Right Action Indicator */}
                        <div className="flex-shrink-0 text-slate-400 dark:text-slate-500 pl-1">
                          {isCurrent ? (
                            <div className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400 animate-pulse" />
                          ) : (
                            <ArrowRight size={14} className="text-slate-400 dark:text-slate-500" />
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              {/* Drawer Footer Safe Area */}
              <div className="p-3 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-[#0F172A] text-center text-[11px] text-slate-500">
                แตะบทเรียนที่ต้องการ เพื่อสลับไปยังเนื้อหาและแบบทดสอบทันที
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
