import React, { useState, useEffect, DragEvent } from "react";
import { QuizQuestion, UserProgress } from "../types";
import {
  CheckCircle2,
  XCircle,
  ArrowRight,
  RotateCcw,
  HelpCircle,
  GraduationCap,
  MoveHorizontal,
  BookOpen,
  ListChecks,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Check,
  X,
  Lock,
  Unlock,
  KeyRound,
  AlertCircle,
  Shuffle,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// Helper function to shuffle array items
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Prepare fresh quiz with shuffled questions order and shuffled choices
function prepareShuffledQuiz(rawQuestions: QuizQuestion[]): QuizQuestion[] {
  if (!rawQuestions || rawQuestions.length === 0) return [];

  // 1. Shuffle order of questions
  const shuffledQuestions = shuffleArray(rawQuestions);

  // 2. For each question, shuffle options / choices if applicable
  return shuffledQuestions.map((q) => {
    if (q.type === "multiple_choice" && Array.isArray(q.options) && q.options.length > 0) {
      return {
        ...q,
        options: shuffleArray(q.options),
      };
    }
    if (q.type === "drag_drop" && Array.isArray(q.options) && q.options.length > 0) {
      return {
        ...q,
        options: shuffleArray(q.options),
      };
    }
    return { ...q };
  });
}

interface QuizViewProps {
  questions: QuizQuestion[];
  onQuizCompleted: (score: number, answersMap?: Record<string, any>) => void;
  onNextLesson?: () => void;
  onBackToContent?: () => void;
  onRequireLogin?: () => void;
  isLoggedIn?: boolean;
  lessonId: string;
  savedProgress?: UserProgress;
  hasNextLesson?: boolean;
}

export default function QuizView({
  questions,
  onQuizCompleted,
  onNextLesson,
  onBackToContent,
  onRequireLogin,
  isLoggedIn = false,
  lessonId,
  savedProgress,
  hasNextLesson,
}: QuizViewProps) {
  // Shuffled questions state
  const [activeQuestions, setActiveQuestions] = useState<QuizQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);

  // MCQ state
  const [selectedMcq, setSelectedMcq] = useState<string | null>(null);

  // Drag & drop state
  const [placedBlocks, setPlacedBlocks] = useState<string[]>([]);
  const [availableBlocks, setAvailableBlocks] = useState<string[]>([]);
  const [isDragOverSlot, setIsDragOverSlot] = useState(false);

  // Quiz evaluation state
  const [isAnswerChecked, setIsAnswerChecked] = useState(false);
  const [isCheckingAnswer, setIsCheckingAnswer] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [questionResults, setQuestionResults] = useState<Record<number, boolean>>({});
  const [userAnswers, setUserAnswers] = useState<
    Record<number, { userAnswer: string | string[]; isCorrect: boolean; serverCorrectAnswer?: string | string[] }>
  >({});
  const [isQuizFinished, setIsQuizFinished] = useState(false);
  const [finalCalculatedScore, setFinalCalculatedScore] = useState(0);

  // Failed attempts tracking for answer reveal unlock
  const [failedAttempts, setFailedAttempts] = useState<number>(() => {
    try {
      const stored = localStorage.getItem(`quiz_failed_attempts_${lessonId}`);
      return stored ? parseInt(stored, 10) : 0;
    } catch {
      return 0;
    }
  });

  // State to toggle revealing correct answers when unlocked
  const [isAnswersRevealed, setIsAnswersRevealed] = useState(false);

  // Review breakdown state
  const [showReviewDetails, setShowReviewDetails] = useState(true);
  const [reviewFilter, setReviewFilter] = useState<"all" | "wrong" | "correct">("all");

  // Initialize or reset quiz on load or lesson change with shuffled questions and shuffled options
  useEffect(() => {
    if (!questions || questions.length === 0) return;
    const shuffled = prepareShuffledQuiz(questions);
    setActiveQuestions(shuffled);
    setCurrentIdx(0);
    setQuestionResults({});
    setUserAnswers({});
    setFinalCalculatedScore(0);
    setIsQuizFinished(false);
    setSelectedMcq(null);
    setIsAnswerChecked(false);
    setIsCorrect(false);
    setShowReviewDetails(true);
    setReviewFilter("all");
    setIsAnswersRevealed(false);

    try {
      const stored = localStorage.getItem(`quiz_failed_attempts_${lessonId}`);
      setFailedAttempts(stored ? parseInt(stored, 10) : 0);
    } catch {
      setFailedAttempts(0);
    }
  }, [questions, lessonId]);

  // Set up question state when moving to a new question
  useEffect(() => {
    if (activeQuestions.length === 0) return;
    const q = activeQuestions[currentIdx];
    if (!q) return;

    setSelectedMcq(null);
    setIsAnswerChecked(false);
    setIsCorrect(false);

    if (q.type === "drag_drop") {
      const shuffledOptions = [...q.options].sort(() => Math.random() - 0.5);
      setAvailableBlocks(shuffledOptions);
      setPlacedBlocks([]);
    } else {
      setAvailableBlocks([]);
      setPlacedBlocks([]);
    }
  }, [currentIdx, activeQuestions]);

  if (!questions || questions.length === 0 || activeQuestions.length === 0) {
    return (
      <div className="p-8 text-center bg-[#1E293B] border border-slate-700/60 rounded-2xl">
        <HelpCircle size={40} className="mx-auto text-slate-500 mb-3" />
        <h3 className="text-lg font-bold text-white mb-2">ไม่มีแบบทดสอบสำหรับบทเรียนนี้</h3>
        <p className="text-slate-400 text-xs mb-6">คุณสามารถศึกษาเนื้อหาและก้าวสู่บทถัดไปได้ทันที</p>
        {onNextLesson && (
          <button
            onClick={onNextLesson}
            className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 mx-auto cursor-pointer"
          >
            <span>บทเรียนถัดไป</span>
            <ArrowRight size={14} />
          </button>
        )}
      </div>
    );
  }

  const currentQuestion = activeQuestions[currentIdx];
  if (!currentQuestion) return null;

  // Determine if drag_drop is slot-fill or reorder
  // Slot-fill is ONLY when there is an explicit fill-in-the-blank template (containing ___),
  // OR when explicitly marked or has single slot.
  const hasTemplateWithBlank = Boolean(currentQuestion.template_code && currentQuestion.template_code.includes("___"));
  const isExplicitReorder = currentQuestion.is_reorder === true || (Array.isArray(currentQuestion.correct_answer) && currentQuestion.correct_answer.length > 1);
  const isSlotDragDrop =
    currentQuestion.type === "drag_drop" &&
    !isExplicitReorder &&
    (hasTemplateWithBlank || (!currentQuestion.template_code && currentQuestion.options && currentQuestion.options.length <= 1));

  // Fallback template_code if not specified but is a slot drag_drop question about printing
  const effectiveTemplateCode = currentQuestion.template_code || (
    isSlotDragDrop && currentQuestion.options?.some((o: string) => ["print", "println", "Print"].includes(o))
      ? 'System.out.___("Hello World");'
      : ""
  );

  // Parse template_code into prefix and suffix if slot-fill
  const hasTemplate = Boolean(effectiveTemplateCode && effectiveTemplateCode.includes("___"));
  const [prefixCode, suffixCode] = hasTemplate && effectiveTemplateCode
    ? effectiveTemplateCode.split("___")
    : ["", ""];

  // Handle tap-to-place / tap-to-remove for mobile accessibility
  const handleBlockClick = (block: string, source: "available" | "placed") => {
    if (isAnswerChecked) return;

    if (isSlotDragDrop) {
      if (source === "available") {
        const newAvailable = availableBlocks.filter((b) => b !== block);
        if (placedBlocks.length > 0) {
          newAvailable.push(placedBlocks[0]);
        }
        setAvailableBlocks(newAvailable);
        setPlacedBlocks([block]);
      } else {
        setPlacedBlocks([]);
        if (!availableBlocks.includes(block)) {
          setAvailableBlocks([...availableBlocks, block]);
        }
      }
      return;
    }

    // Multi-line code drag & drop
    if (source === "available") {
      setAvailableBlocks(availableBlocks.filter((b) => b !== block));
      setPlacedBlocks([...placedBlocks, block]);
    } else {
      setPlacedBlocks(placedBlocks.filter((b) => b !== block));
      setAvailableBlocks([...availableBlocks, block]);
    }
  };

  // Drag operations
  const handleDragStart = (
    e: DragEvent,
    block: string,
    source: "available" | "placed",
    index?: number
  ) => {
    if (isAnswerChecked) return;
    e.dataTransfer.setData("text/plain", JSON.stringify({ block, source, index }));
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
  };

  const handleSlotDragOver = (e: DragEvent) => {
    e.preventDefault();
    if (!isDragOverSlot && !isAnswerChecked) {
      setIsDragOverSlot(true);
    }
  };

  const handleSlotDragLeave = () => {
    setIsDragOverSlot(false);
  };

  const handleDrop = (e: DragEvent, target: "available" | "placed", targetIndex?: number) => {
    e.preventDefault();
    setIsDragOverSlot(false);
    if (isAnswerChecked) return;

    try {
      const data = JSON.parse(e.dataTransfer.getData("text/plain"));
      const { block, source, index: sourceIndex } = data;

      if (isSlotDragDrop) {
        if (source === target) return;
        if (target === "placed") {
          const newAvailable = availableBlocks.filter((b) => b !== block);
          if (placedBlocks.length > 0) {
            newAvailable.push(placedBlocks[0]);
          }
          setAvailableBlocks(newAvailable);
          setPlacedBlocks([block]);
        } else {
          setPlacedBlocks([]);
          if (!availableBlocks.includes(block)) {
            setAvailableBlocks([...availableBlocks, block]);
          }
        }
        return;
      }

      // Multi-line drop: reordering within placed list
      if (source === "placed" && target === "placed") {
        if (
          typeof sourceIndex === "number" &&
          typeof targetIndex === "number" &&
          sourceIndex !== targetIndex
        ) {
          const newPlaced = [...placedBlocks];
          const [moved] = newPlaced.splice(sourceIndex, 1);
          newPlaced.splice(targetIndex, 0, moved);
          setPlacedBlocks(newPlaced);
        }
        return;
      }

      if (source === target) return;

      if (target === "placed") {
        setAvailableBlocks(availableBlocks.filter((b) => b !== block));
        if (typeof targetIndex === "number") {
          const newPlaced = [...placedBlocks];
          newPlaced.splice(targetIndex, 0, block);
          setPlacedBlocks(newPlaced);
        } else {
          setPlacedBlocks([...placedBlocks, block]);
        }
      } else {
        setPlacedBlocks(placedBlocks.filter((b) => b !== block));
        setAvailableBlocks([...availableBlocks, block]);
      }
    } catch (err) {
      console.error("Error handling drop", err);
    }
  };

  const movePlacedBlock = (index: number, direction: "up" | "down", e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    if (isAnswerChecked) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= placedBlocks.length) return;
    const newPlaced = [...placedBlocks];
    const temp = newPlaced[index];
    newPlaced[index] = newPlaced[targetIndex];
    newPlaced[targetIndex] = temp;
    setPlacedBlocks(newPlaced);
  };

  const handleCheckAnswer = async () => {
    if (isCheckingAnswer) return;

    const answerGiven = currentQuestion.type === "multiple_choice"
      ? selectedMcq || ""
      : isSlotDragDrop
      ? placedBlocks[0] || ""
      : [...placedBlocks];

    if (!answerGiven || (Array.isArray(answerGiven) && answerGiven.length === 0)) return;

    setIsCheckingAnswer(true);

    try {
      // 1. Call authoritative Server API to verify without exposing answers in advance
      const res = await fetch("/api/quizzes/check-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: currentQuestion.id,
          answer: answerGiven,
        }),
      });

      if (!res.ok) throw new Error("ตรวจคำตอบไม่สำเร็จ");
      const data = await res.json();
      const currentIsCorrect = Boolean(data.isCorrect);

      setIsCorrect(currentIsCorrect);
      setQuestionResults((prev) => ({ ...prev, [currentIdx]: currentIsCorrect }));
      setUserAnswers((prev) => ({
        ...prev,
        [currentIdx]: {
          userAnswer: answerGiven,
          isCorrect: currentIsCorrect,
          serverCorrectAnswer: data.correctAnswer,
        },
      }));
      setIsAnswerChecked(true);
    } catch (err) {
      console.warn("Check answer server call error, falling back locally:", err);
      // Fallback if question happens to have correct_answer (e.g. admin preview or offline test)
      let currentIsCorrect = false;
      if (currentQuestion.correct_answer !== undefined) {
        if (currentQuestion.type === "multiple_choice") {
          const cleanAnswer = String(currentQuestion.correct_answer || "").trim();
          currentIsCorrect = String(selectedMcq || "").trim() === cleanAnswer;
        } else if (isSlotDragDrop) {
          const rawExpected = Array.isArray(currentQuestion.correct_answer)
            ? currentQuestion.correct_answer[0]
            : currentQuestion.correct_answer;
          currentIsCorrect = String(rawExpected || "").trim() === String(placedBlocks[0] || "").trim();
        } else {
          const correctSeq = (Array.isArray(currentQuestion.correct_answer) ? currentQuestion.correct_answer : [currentQuestion.correct_answer]).map((s: string) => String(s).replace(/\s+/g, " ").trim());
          const placedTrimmed = placedBlocks.map((s) => s.replace(/\s+/g, " ").trim());
          currentIsCorrect = placedTrimmed.length === correctSeq.length && placedTrimmed.every((val, index) => val === correctSeq[index]);
        }
      }

      setIsCorrect(currentIsCorrect);
      setQuestionResults((prev) => ({ ...prev, [currentIdx]: currentIsCorrect }));
      setUserAnswers((prev) => ({
        ...prev,
        [currentIdx]: {
          userAnswer: answerGiven,
          isCorrect: currentIsCorrect,
          serverCorrectAnswer: currentQuestion.correct_answer,
        },
      }));
      setIsAnswerChecked(true);
    } finally {
      setIsCheckingAnswer(false);
    }
  };

  const handleNextQuestion = () => {
    if (currentIdx < activeQuestions.length - 1) {
      setCurrentIdx((prev) => prev + 1);
    } else {
      // Calculate final score accurately from all results
      let correctCount = 0;
      const answersMap: Record<string, any> = {};

      for (let i = 0; i < activeQuestions.length; i++) {
        const q = activeQuestions[i];
        const isQCorrect = userAnswers[i]?.isCorrect ?? questionResults[i] ?? false;
        if (isQCorrect) {
          correctCount++;
        }
        if (q && userAnswers[i]) {
          answersMap[q.id] = userAnswers[i].userAnswer;
        }
      }

      const scorePercent = activeQuestions.length > 0
        ? Math.round((correctCount / activeQuestions.length) * 100)
        : 0;
      setFinalCalculatedScore(scorePercent);
      setIsQuizFinished(true);
      onQuizCompleted(scorePercent, answersMap);

      // Track failed attempt count if score < 60%
      if (scorePercent < 60) {
        setFailedAttempts((prev) => {
          const nextCount = prev + 1;
          try {
            localStorage.setItem(`quiz_failed_attempts_${lessonId}`, String(nextCount));
          } catch {}
          return nextCount;
        });
      }
    }
  };

  const handleResetQuiz = () => {
    // Reshuffle both questions order and choices for each question
    const reshuffled = prepareShuffledQuiz(questions);
    setActiveQuestions(reshuffled);
    setCurrentIdx(0);
    setQuestionResults({});
    setUserAnswers({});
    setFinalCalculatedScore(0);
    setIsQuizFinished(false);
    setSelectedMcq(null);
    setIsAnswerChecked(false);
    setIsCorrect(false);
    setShowReviewDetails(true);
    setReviewFilter("all");
    setIsAnswersRevealed(false);
    if (reshuffled[0]?.type === "drag_drop") {
      const shuffled = [...reshuffled[0].options].sort(() => Math.random() - 0.5);
      setAvailableBlocks(shuffled);
      setPlacedBlocks([]);
    }
  };

  if (isQuizFinished) {
    let totalCorrect = 0;
    for (let i = 0; i < activeQuestions.length; i++) {
      const isQCorrect = userAnswers[i]?.isCorrect ?? questionResults[i] ?? false;
      if (isQCorrect) {
        totalCorrect++;
      }
    }
    const totalWrong = activeQuestions.length - totalCorrect;
    const finalScore = finalCalculatedScore;
    const passed = finalScore >= 60;
    const canUnlockAnswers = passed || failedAttempts >= 2;
    const shouldShowAnswers = passed || (failedAttempts >= 2 && isAnswersRevealed);

    const filteredQuestions = activeQuestions
      .map((q, idx) => ({
        question: q,
        idx,
        result: userAnswers[idx] || {
          userAnswer: "",
          isCorrect: questionResults[idx] ?? false,
        },
      }))
      .filter(({ result }) => {
        if (reviewFilter === "wrong") return !result.isCorrect;
        if (reviewFilter === "correct") return result.isCorrect;
        return true;
      });

    return (
      <div id="quiz-finished-card" className="space-y-6">
        {/* Main Result Summary Card */}
        <div className="p-8 text-center bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700/60 rounded-2xl shadow-xl transition-colors">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            {passed ? (
              <CheckCircle2 size={54} className="mx-auto text-emerald-500 mb-4" />
            ) : (
              <XCircle size={54} className="mx-auto text-rose-500 mb-4" />
            )}

            <h3 className="text-xl font-bold mb-2 text-slate-900 dark:text-white">
              {passed ? "ผ่านการทดสอบ" : "ยังไม่ผ่านเกณฑ์"}
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mb-6 text-xs">
              ตอบถูก {totalCorrect} จาก {activeQuestions.length} ข้อ
            </p>

            <div className="inline-flex items-center justify-center p-6 bg-slate-50 dark:bg-[#0F172A] rounded-2xl border border-slate-200 dark:border-slate-700/50 mb-8 min-w-[200px] shadow-xs">
              <div>
                <span className="block text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">คะแนนที่ได้</span>
                <span className={`text-3xl font-extrabold ${passed ? "text-emerald-500 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400"}`}>
                  {finalScore}%
                </span>
              </div>
            </div>

            <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-6 max-w-md mx-auto">
              {passed ? (
                isLoggedIn ? null : (
                  <div className="space-y-2">
                    <span className="text-amber-600 dark:text-amber-300 font-medium block">
                      ผ่านเกณฑ์การทดสอบแล้ว แต่คุณยังไม่ได้เข้าสู่ระบบ ผลคะแนนจึงยังไม่ถูกบันทึก
                    </span>
                    {onRequireLogin && (
                      <button
                        onClick={onRequireLogin}
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
                      >
                        เข้าสู่ระบบเพื่อบันทึกผลการเรียนและปลดล็อกบทถัดไป
                      </button>
                    )}
                  </div>
                )
              ) : failedAttempts < 2 ? (
                "เกณฑ์ผ่านคือ 60% ขึ้นไป (ทำไม่ผ่าน 1 ครั้ง) แนะนำให้กลับไปทบทวนเนื้อหาแล้วลองทำใหม่อีกครั้ง หากทำไม่ผ่านครบ 2 ครั้ง ระบบจะปลดล็อกเฉลยให้"
              ) : (
                "เกณฑ์ผ่านคือ 60% ขึ้นไป (ทำไม่ผ่านครบ 2 ครั้งแล้ว) คุณสามารถกดปุ่ม 'เปิดดูเฉลยคำตอบ' ด้านล่างเพื่อศึกษาจุดที่ผิดได้"
              )}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                id="retry-quiz-btn"
                onClick={handleResetQuiz}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-indigo-600/20 transition-all"
              >
                <Shuffle size={14} />
                <span>ทำแบบทดสอบใหม่อีกครั้ง</span>
              </button>

              {onBackToContent && (
                <button
                  id="review-content-btn"
                  onClick={onBackToContent}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-[#0F172A] hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700/60 transition-all font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <BookOpen size={14} />
                  กลับไปอ่านเนื้อหาบทเรียน
                </button>
              )}

              {passed && onNextLesson && (
                <button
                  id="next-lesson-btn"
                  onClick={onNextLesson}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-all font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-600/20"
                >
                  <span>บทเรียนถัดไป</span>
                  <ArrowRight size={14} />
                </button>
              )}
            </div>
          </motion.div>
        </div>

        {/* Detailed Question Review Breakdown Section */}
        <div id="quiz-review-section" className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700/60 rounded-2xl p-5 sm:p-7 shadow-lg space-y-5 transition-colors">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-700/60">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ListChecks className="text-indigo-600 dark:text-indigo-400" size={18} />
                ตรวจดูคำตอบรายข้อ ({totalCorrect}/{activeQuestions.length} ข้อ)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                ตรวจสอบคำตอบที่คุณเลือกและเฉลยที่ถูกต้องเพื่อทบทวนความเข้าใจ
              </p>
            </div>

            <button
              id="toggle-review-details-btn"
              onClick={() => setShowReviewDetails(!showReviewDetails)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-[#0F172A] hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60 text-xs font-semibold transition-colors cursor-pointer w-fit"
            >
              <Eye size={13} />
              <span>{showReviewDetails ? "ซ่อนรายการ" : "แสดงรายการ"}</span>
              {showReviewDetails ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          </div>

          {/* Unlock Answer Notice / Controller */}
          {passed ? (
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 flex items-center gap-3 text-xs text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 size={18} className="text-emerald-500 dark:text-emerald-400 flex-shrink-0" />
              <div>
                <span className="font-bold block text-sm">ยินดีด้วย! คุณสอบผ่านเกณฑ์แล้ว</span>
                <p className="text-emerald-700 dark:text-emerald-200/80 mt-0.5">
                  ระบบแสดงเฉลยคำตอบทุกข้อเพื่อช่วยให้คุณทบทวนความเข้าใจได้อย่างครบถ้วน
                </p>
              </div>
            </div>
          ) : failedAttempts < 2 ? (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 flex items-start gap-3 text-xs text-amber-800 dark:text-amber-300">
              <Lock size={18} className="text-amber-500 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm text-amber-900 dark:text-amber-200">
                    เฉลยคำตอบยังถูกล็อคไว้ (สอบไม่ผ่าน {failedAttempts}/2 ครั้ง)
                  </span>
                  <span className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-500/20 text-[10px] font-bold text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30">
                    ต้องทำไม่ผ่านครบ 2 ครั้งเพื่อปลดล็อก
                  </span>
                </div>
                <p className="text-amber-800/90 dark:text-amber-200/80 leading-relaxed">
                  เพื่อกระตุ้นการคิดวิเคราะห์ด้วยตนเอง ระบบจะยังไม่แสดงเฉลยคำตอบในรอบแรก แนะนำให้กลับไปอ่านเนื้อหา หรือกด <strong>"สุ่มทำแบบทดสอบใหม่อีกครั้ง"</strong> (ระบบจะสลับข้อและตัวเลือกใหม่) หากสอบไม่ผ่านครบ 2 ครั้ง ระบบจะปลดล็อกปุ่มดูเฉลยให้ทันที
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
              <div className="flex items-start gap-3">
                <KeyRound size={18} className="text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">
                      ปลดล็อกสิทธิ์ดูเฉลยแล้ว ({failedAttempts} ครั้งที่สอบไม่ผ่าน)
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-500/20 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30">
                      ปลดล็อกแล้ว
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 mt-0.5">
                    คุณทำแบบทดสอบไม่ผ่านครบ 2 ครั้งแล้ว สามารถกดปุ่มเพื่อเปิดดูเฉลยคำตอบและลำดับโค้ดที่ถูกต้องได้
                  </p>
                </div>
              </div>

              <button
                id="reveal-quiz-answers-btn"
                onClick={() => setIsAnswersRevealed(!isAnswersRevealed)}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md flex-shrink-0 ${
                  isAnswersRevealed
                    ? "bg-slate-100 dark:bg-[#0F172A] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-800"
                    : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30"
                }`}
              >
                {isAnswersRevealed ? <EyeOff size={14} /> : <Unlock size={14} />}
                <span>{isAnswersRevealed ? "ซ่อนเฉลยคำตอบ" : "เปิดดูเฉลยคำตอบทั้งหมด"}</span>
              </button>
            </div>
          )}

          {/* Quick Overview Strip */}
          <div className="flex flex-wrap items-center gap-2 pt-1 pb-1">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mr-1">
              สรุปรายข้อ:
            </span>
            {activeQuestions.map((_, i) => {
              const isQCorrect = userAnswers[i]?.isCorrect ?? questionResults[i] ?? false;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setShowReviewDetails(true);
                    const el = document.getElementById(`review-question-${i}`);
                    if (el) {
                      el.scrollIntoView({ behavior: "smooth", block: "center" });
                    }
                  }}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-bold border transition-all cursor-pointer ${
                    isQCorrect
                      ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/30 hover:bg-emerald-100 dark:hover:bg-emerald-500/20"
                      : "bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-500/30 hover:bg-rose-100 dark:hover:bg-rose-500/20"
                  }`}
                  title={`ข้อ ${i + 1}: ${isQCorrect ? "ตอบถูก" : "ตอบผิด"}`}
                >
                  <span>ข้อ {i + 1}</span>
                  {isQCorrect ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                </button>
              );
            })}
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center bg-slate-100 dark:bg-[#0F172A] p-1 rounded-xl border border-slate-200 dark:border-slate-700/60 text-xs">
              <button
                id="filter-review-all"
                onClick={() => setReviewFilter("all")}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  reviewFilter === "all"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                ทั้งหมด ({activeQuestions.length})
              </button>
              <button
                id="filter-review-wrong"
                onClick={() => setReviewFilter("wrong")}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  reviewFilter === "wrong"
                    ? "bg-rose-600 text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-300"
                }`}
              >
                ตอบผิด ({totalWrong})
              </button>
              <button
                id="filter-review-correct"
                onClick={() => setReviewFilter("correct")}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  reviewFilter === "correct"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-300"
                }`}
              >
                ตอบถูก ({totalCorrect})
              </button>
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-400">
              แสดง {filteredQuestions.length} จาก {activeQuestions.length} ข้อ
            </div>
          </div>

          {/* Question Cards List */}
          {showReviewDetails && (
            <div className="space-y-4 pt-2">
              {filteredQuestions.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 dark:bg-[#0F172A]/40 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-xs">
                  {reviewFilter === "wrong"
                    ? "ยอดเยี่ยม! ไม่มีข้อที่ตอบผิดในชุดนี้"
                    : "ไม่มีข้อที่ตรงกับเงื่อนไขที่เลือก"}
                </div>
              ) : (
                filteredQuestions.map(({ question: q, idx, result }) => {
                  const isQCorrect = result.isCorrect;
                  const isSlot = q.type === "drag_drop" && (q.template_code || (!Array.isArray(q.correct_answer) || q.correct_answer.length <= 1));
                  const isMultiLine = q.type === "drag_drop" && !isSlot;
                  const qTemplate = q.template_code || (
                    isSlot && (
                      q.correct_answer === "print" ||
                      q.correct_answer === "println" ||
                      (Array.isArray(q.correct_answer) && (q.correct_answer.includes("print") || q.correct_answer.includes("println"))) ||
                      q.options?.some((o: string) => ["print", "println", "Print"].includes(o))
                    )
                      ? 'System.out.___("Hello World");'
                      : ""
                  );

                  const resolvedCorrectAnswer = result.serverCorrectAnswer || q.correct_answer;
                  const correctStr = Array.isArray(resolvedCorrectAnswer)
                    ? resolvedCorrectAnswer.join(" ")
                    : String(resolvedCorrectAnswer || "");

                  const userStr = Array.isArray(result.userAnswer)
                    ? result.userAnswer.join(" ")
                    : String(result.userAnswer || "");

                  return (
                    <div
                      key={q.id || idx}
                      id={`review-question-${idx}`}
                      className={`p-5 sm:p-6 rounded-2xl border transition-all space-y-4 shadow-sm ${
                        isQCorrect
                          ? "bg-white dark:bg-[#1E293B] border-emerald-300 dark:border-emerald-500/30"
                          : "bg-white dark:bg-[#1E293B] border-rose-300 dark:border-rose-500/35 ring-1 ring-rose-500/20"
                      }`}
                    >
                      {/* Top Header of Question Card */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold bg-slate-100 dark:bg-[#0F172A] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200">
                            ข้อที่ {idx + 1}
                          </span>
                          <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                            {q.type === "multiple_choice"
                              ? "ปรนัย (Choice)"
                              : isSlot
                              ? "เติมโค้ดในช่องว่าง"
                              : "จัดเรียงลำดับโค้ด"}
                          </span>
                        </div>

                        {isQCorrect ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/25 text-xs font-bold">
                            <CheckCircle2 size={13} />
                            ตอบถูกต้อง
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-500/25 text-xs font-bold">
                            <XCircle size={13} />
                            ตอบยังไม่ถูกต้อง
                          </span>
                        )}
                      </div>

                      {/* Question Text */}
                      <div className="text-sm font-semibold text-slate-900 dark:text-white leading-relaxed">
                        {q.question}
                      </div>

                      {/* Optional Template Code Display */}
                      {qTemplate && (
                        <div className="bg-slate-50 dark:bg-[#0F172A] border border-slate-200 dark:border-slate-700/60 rounded-xl p-3 font-mono text-xs text-slate-800 dark:text-slate-200 overflow-x-auto font-bold">
                          {qTemplate}
                        </div>
                      )}

                      {/* Answer Comparison Section */}
                      {!isMultiLine ? (
                        /* Single-value answers (MCQ or Slot Fill) */
                        <div className="space-y-2 pt-1 border-t border-slate-200 dark:border-slate-800">
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="text-slate-700 dark:text-slate-300 font-medium min-w-[110px]">คำตอบของคุณ:</span>
                            {userStr ? (
                              <span
                                className={`px-2.5 py-1 rounded-lg font-mono font-bold text-xs border ${
                                  isQCorrect
                                    ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/25"
                                    : "bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-500/25 line-through"
                                }`}
                              >
                                {userStr}
                              </span>
                            ) : (
                              <span className="text-slate-400 dark:text-slate-500 italic text-xs">(ไม่ได้ระบุคำตอบ)</span>
                            )}
                          </div>

                          {!isQCorrect && (
                            shouldShowAnswers ? (
                              <div className="flex flex-wrap items-center gap-2 text-xs pt-1">
                                <span className="text-slate-700 dark:text-slate-300 font-medium min-w-[110px]">เฉลยที่ถูกต้อง:</span>
                                <span className="px-2.5 py-1 rounded-lg font-mono font-bold text-xs bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30">
                                  {correctStr}
                                </span>
                              </div>
                            ) : (
                              <div className="mt-2 p-2.5 rounded-xl bg-slate-50 dark:bg-[#0F172A] border border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-medium">
                                  <Lock size={13} />
                                  <span>เฉลยถูกล็อคไว้</span>
                                </div>
                                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                  {failedAttempts < 2
                                    ? `สอบไม่ผ่านแล้ว ${failedAttempts}/2 ครั้ง (สอบใหม่อีก ${2 - failedAttempts} ครั้งเพื่อปลดล็อก)`
                                    : "คลิกปุ่ม 'เปิดดูเฉลยคำตอบ' ด้านบนเพื่อดูคำตอบ"}
                                </span>
                              </div>
                            )
                          )}
                        </div>
                      ) : (
                        /* Multi-line reorder answers */
                        <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                            {/* User Arrangement */}
                            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 space-y-2">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block">
                                ลำดับที่คุณจัดวาง:
                              </span>
                              {Array.isArray(result.userAnswer) && result.userAnswer.length > 0 ? (
                                <div className="space-y-1 font-mono text-xs">
                                  {result.userAnswer.map((line, lIdx) => (
                                    <div
                                      key={lIdx}
                                      className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold ${
                                        isQCorrect
                                          ? "bg-white dark:bg-[#1E293B] text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/20"
                                          : "bg-white dark:bg-[#1E293B] text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-500/20"
                                      }`}
                                    >
                                      {line}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-slate-400 dark:text-slate-500 italic text-xs block pt-1">
                                  (ไม่มีบล็อกที่จัดวาง)
                                </span>
                              )}
                            </div>

                            {/* Correct Arrangement */}
                            <div className="p-3.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-500/20 space-y-2">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">
                                ลำดับเฉลยที่ถูกต้อง:
                              </span>
                              {shouldShowAnswers ? (
                                <div className="space-y-1 font-mono text-xs">
                                  {(Array.isArray(resolvedCorrectAnswer)
                                    ? resolvedCorrectAnswer
                                    : [resolvedCorrectAnswer]
                                  ).map((line, lIdx) => (
                                    <div
                                      key={lIdx}
                                      className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#1E293B] text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/25 text-[11px] font-semibold"
                                    >
                                      {line}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 text-center space-y-1">
                                  <Lock size={16} className="text-amber-500 dark:text-amber-400 mx-auto" />
                                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">เฉลยถูกล็อคไว้</span>
                                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                                    {failedAttempts < 2
                                      ? `สอบไม่ผ่านแล้ว ${failedAttempts}/2 ครั้ง (สอบใหม่อีก ${2 - failedAttempts} ครั้งเพื่อปลดล็อก)`
                                      : "คลิกปุ่ม 'เปิดดูเฉลยคำตอบ' ด้านบนเพื่อดูคำตอบ"}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Render question text with highlighted inline badges if applicable
  const renderQuestionTitle = (qText: string) => {
    if (qText.includes("Hello World")) {
      const parts = qText.split("Hello World");
      return (
        <span>
          {parts[0]}
          <code className="px-2 py-0.5 mx-1 rounded bg-[#0F172A] text-indigo-300 font-mono text-xs sm:text-sm font-bold border border-slate-700/80">
            Hello World
          </code>
          {parts.slice(1).join("Hello World")}
        </span>
      );
    }
    return qText;
  };

  return (
    <div id="quiz-active-container" className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700/60 rounded-2xl p-6 md:p-8 shadow-xl transition-colors">
      {/* Quiz Progress Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
              <HelpCircle size={14} />
              แบบทดสอบท้ายบทเรียน
            </span>
            <span className="text-[10px] text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-[#0F172A] border border-slate-200 dark:border-slate-700/60 px-2 py-0.5 rounded-full flex items-center gap-1 font-mono">
              <Shuffle size={10} className="text-indigo-500 dark:text-indigo-400" />
              สุ่มข้อ & ช้อยส์
            </span>
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-1">
            ข้อที่ {currentIdx + 1} จาก {activeQuestions.length}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {onBackToContent && (
            <button
              onClick={onBackToContent}
              className="text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 px-3 py-1 rounded-lg bg-slate-100 dark:bg-[#0F172A] border border-slate-200 dark:border-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600 transition-colors flex items-center gap-1.5 cursor-pointer font-medium"
              title="สลับกลับไปดูเนื้อหาบทเรียน"
            >
              <BookOpen size={12} />
              <span>ดูเนื้อหาบทเรียน</span>
            </button>
          )}
          <div className="text-xs font-mono px-3 py-1 bg-slate-100 dark:bg-[#0F172A] text-slate-700 dark:text-slate-300 rounded-full font-bold border border-slate-200 dark:border-slate-700/50">
            คะแนนสะสม: {Object.values(questionResults).filter(Boolean).length}/{activeQuestions.length}
          </div>
        </div>
      </div>

      {/* Progress Line */}
      <div className="w-full h-1.5 bg-slate-100 dark:bg-[#0F172A] rounded-full overflow-hidden mb-8 border border-slate-200 dark:border-slate-700/30">
        <div
          className="h-full bg-indigo-600 dark:bg-indigo-500 rounded-full transition-all duration-300"
          style={{ width: `${((currentIdx + 1) / activeQuestions.length) * 100}%` }}
        ></div>
      </div>

      {/* Question Text */}
      <div className="mb-6 text-center sm:text-left">
        <span className="inline-block text-[10px] font-bold px-2.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20 mb-3">
          {currentQuestion.type === "multiple_choice"
            ? "เลือกคำตอบที่ถูกต้อง (Multiple Choice)"
            : isSlotDragDrop
            ? "ลากหรือแตะวางตัวเลือกใส่ในช่องว่าง (Drag & Drop)"
            : "จัดเรียงโค้ดให้ถูกต้อง (Drag & Drop)"}
        </span>
        <h4 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-relaxed font-sans">
          {renderQuestionTitle(currentQuestion.question)}
        </h4>
      </div>

      {/* Interactive Question Body */}
      <div className="mb-8">
        {currentQuestion.type === "multiple_choice" ? (
          /* MCQ OPTIONS */
          <div className="grid grid-cols-1 gap-3">
            {currentQuestion.options.map((option, idx) => {
              const isSelected = selectedMcq === option;

              let cardStyle = "border-slate-200 dark:border-slate-700/60 hover:border-indigo-500 bg-white dark:bg-[#0F172A]/40 text-slate-800 dark:text-slate-300 shadow-xs";
              if (isSelected && !isAnswerChecked) {
                cardStyle = "border-indigo-500 bg-indigo-50/80 dark:bg-indigo-500/10 text-indigo-900 dark:text-indigo-300 ring-2 ring-indigo-500/20";
              } else if (isAnswerChecked) {
                if (isSelected) {
                  cardStyle = isCorrect
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 ring-2 ring-emerald-500/20"
                    : "border-rose-500 bg-rose-50 dark:bg-rose-500/10 text-rose-800 dark:text-rose-400 ring-2 ring-rose-500/20";
                } else {
                  cardStyle = "border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 text-slate-400 dark:text-slate-500 opacity-50";
                }
              }

              return (
                <button
                  key={idx}
                  onClick={() => !isAnswerChecked && setSelectedMcq(option)}
                  disabled={isAnswerChecked}
                  className={`w-full flex items-center justify-between text-left p-4 rounded-xl border text-xs font-semibold transition-all duration-200 ${cardStyle} ${!isAnswerChecked ? "cursor-pointer" : "cursor-default"}`}
                >
                  <span className="flex-1 pr-4">{option}</span>
                  <div className="flex-shrink-0">
                    {isAnswerChecked && isSelected && isCorrect && <CheckCircle2 size={18} className="text-emerald-500 dark:text-emerald-400" />}
                    {isAnswerChecked && isSelected && !isCorrect && <XCircle size={18} className="text-rose-500 dark:text-rose-400" />}
                    {!isAnswerChecked && (
                      <span className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-bold transition-all ${isSelected ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-[#0F172A] text-slate-600 dark:text-slate-400"}`}>
                        {idx + 1}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ) : isSlotDragDrop ? (
          /* ==========================================================
             SLOT-BASED / FILL-IN-THE-BLANK DRAG & DROP
             ========================================================== */
          <div className="space-y-6">
            {/* Top Box with Target Drop Slot (Theme mode aware) */}
            <div
              className={`p-5 sm:p-7 rounded-2xl border transition-all shadow-inner flex flex-col items-center justify-center ${
                isAnswerChecked
                  ? isCorrect
                    ? "border-emerald-400 dark:border-emerald-500/50 bg-emerald-50/70 dark:bg-emerald-950/20"
                    : "border-rose-400 dark:border-rose-500/50 bg-rose-50/70 dark:bg-rose-950/20"
                  : isDragOverSlot
                  ? "border-indigo-500 ring-4 ring-indigo-500/20 bg-indigo-50/80 dark:bg-[#1E2638]"
                  : "bg-slate-50 dark:bg-[#243044] border-slate-200 dark:border-indigo-400/40 hover:border-indigo-400/60"
              }`}
              onDragOver={handleSlotDragOver}
              onDragLeave={handleSlotDragLeave}
              onDrop={(e) => handleDrop(e, "placed")}
            >
              {hasTemplate ? (
                <div className="flex flex-wrap items-center justify-center gap-2 font-mono text-sm sm:text-base text-slate-900 dark:text-slate-100 font-bold select-none">
                  {prefixCode && <span>{prefixCode}</span>}

                  {/* The Drop / Click Target Slot */}
                  <div
                    onClick={() => placedBlocks.length > 0 && handleBlockClick(placedBlocks[0], "placed")}
                    className={`inline-flex items-center justify-center px-4 py-2 min-w-[130px] sm:min-w-[140px] h-[44px] rounded-xl transition-all select-none ${
                      placedBlocks.length === 0
                        ? isDragOverSlot
                          ? "bg-indigo-100 dark:bg-indigo-600/30 border-2 border-indigo-500 border-dashed text-indigo-700 dark:text-indigo-200"
                          : "bg-indigo-50/80 dark:bg-indigo-950/60 border-2 border-dashed border-indigo-400 dark:border-indigo-400/80 text-indigo-700 dark:text-indigo-300 hover:border-indigo-600 hover:bg-indigo-100/70"
                        : isAnswerChecked
                        ? isCorrect
                          ? "bg-emerald-600 dark:bg-emerald-500/30 border-2 border-emerald-500 text-white dark:text-emerald-300 shadow-md"
                          : "bg-rose-600 dark:bg-rose-500/30 border-2 border-rose-500 text-white dark:text-rose-300 shadow-md"
                        : "bg-indigo-600 border-2 border-indigo-500 text-white shadow-md hover:bg-indigo-500 cursor-pointer"
                    }`}
                    title={placedBlocks.length > 0 && !isAnswerChecked ? "แตะเพื่อนำออก" : "แตะหรือลากตัวเลือกมาวางที่นี่"}
                  >
                    {placedBlocks.length > 0 ? (
                      <span className="font-mono font-bold text-white tracking-wide flex items-center gap-1.5">
                        <span>{placedBlocks[0]}</span>
                        {!isAnswerChecked && <X size={12} className="text-rose-200 hover:text-white" />}
                      </span>
                    ) : (
                      <span className="text-xs font-sans font-bold flex items-center gap-1 text-indigo-600 dark:text-indigo-300">
                        <MoveHorizontal size={14} className="text-indigo-500 dark:text-indigo-400" />
                        วางคำตอบที่นี่
                      </span>
                    )}
                  </div>

                  {suffixCode && <span>{suffixCode}</span>}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-2">
                  <span className="text-xs text-slate-600 dark:text-slate-400 font-sans">
                    ลากหรือแตะคำตอบมาวางในช่องนี้:
                  </span>
                  <div
                    onClick={() => placedBlocks.length > 0 && handleBlockClick(placedBlocks[0], "placed")}
                    className={`inline-flex items-center justify-center px-6 py-2 min-w-[160px] sm:min-w-[200px] h-[46px] rounded-xl transition-all select-none ${
                      placedBlocks.length === 0
                        ? isDragOverSlot
                          ? "bg-indigo-100 dark:bg-indigo-600/30 border-2 border-indigo-500 border-dashed text-indigo-700 dark:text-indigo-200"
                          : "bg-indigo-50/80 dark:bg-indigo-950/60 border-2 border-dashed border-indigo-400 dark:border-indigo-400/80 text-indigo-700 dark:text-indigo-300 hover:border-indigo-600 hover:bg-indigo-100/70"
                        : isAnswerChecked
                        ? isCorrect
                          ? "bg-emerald-600 dark:bg-emerald-500/30 border-2 border-emerald-500 text-white dark:text-emerald-300 shadow-md"
                          : "bg-rose-600 dark:bg-rose-500/30 border-2 border-rose-500 text-white dark:text-rose-300 shadow-md"
                        : "bg-indigo-600 border-2 border-indigo-500 text-white shadow-md hover:bg-indigo-500 cursor-pointer"
                    }`}
                    title={placedBlocks.length > 0 && !isAnswerChecked ? "แตะเพื่อนำออก" : "แตะหรือลากตัวเลือกมาวางที่นี่"}
                  >
                    {placedBlocks.length > 0 ? (
                      <span className="font-mono font-bold text-white tracking-wide flex items-center gap-1.5">
                        <span>{placedBlocks[0]}</span>
                        {!isAnswerChecked && <X size={12} className="text-rose-200 hover:text-white" />}
                      </span>
                    ) : (
                      <span className="text-xs font-sans font-bold flex items-center gap-1 text-indigo-600 dark:text-indigo-300">
                        <MoveHorizontal size={14} className="text-indigo-500 dark:text-indigo-400" />
                        วางคำตอบที่นี่
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Draggable Choice Pills Options Container */}
            <div className="pt-2">
              <span className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                เลือกคำตอบ (แตะหรือลากเพื่อวาง):
              </span>
              <div
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, "available")}
                className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3 py-2"
              >
                {currentQuestion.options.map((option, idx) => {
                  const isPlaced = placedBlocks.includes(option);

                  return (
                    <button
                      key={idx}
                      type="button"
                      draggable={!isAnswerChecked && !isPlaced}
                      onDragStart={(e) => handleDragStart(e, option, "available")}
                      onClick={() => !isPlaced && handleBlockClick(option, "available")}
                      disabled={isAnswerChecked || isPlaced}
                      className={`px-5 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm font-mono font-bold transition-all select-none shadow-xs flex items-center gap-2 cursor-pointer ${
                        isPlaced
                          ? "bg-slate-100 dark:bg-slate-900/50 text-slate-400 dark:text-slate-600 border border-slate-200 dark:border-slate-800 opacity-40 cursor-not-allowed scale-95"
                          : "bg-white dark:bg-[#2A364F] hover:bg-indigo-50/70 dark:hover:bg-[#3B4A6B] active:scale-95 text-slate-800 dark:text-white border-2 border-slate-300 dark:border-indigo-400/50 hover:border-indigo-500 dark:hover:border-indigo-400 shadow-sm hover:shadow-md transition-all"
                      }`}
                    >
                      <span>{option}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* ==========================================================
             MULTI-LINE DRAG & DROP OPTIONS (CODE REORDERING)
             ========================================================== */
          <div className="space-y-6">
            {/* Answer Area (Placed blocks) */}
            <div>
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center justify-between">
                <span>คำตอบของคุณ (แตะปุ่ม ▲ / ▼ หรือลากเพื่อสลับลำดับ):</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  เรียงจากบนลงล่าง {placedBlocks.length > 0 && `(${placedBlocks.length} บรรทัด)`}
                </span>
              </div>
              <div
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, "placed")}
                className={`min-h-[100px] p-4 rounded-xl border-2 border-dashed bg-slate-50 dark:bg-[#0F172A] transition-all flex flex-col gap-2.5 ${
                  isAnswerChecked
                    ? "border-slate-200 dark:border-slate-800"
                    : placedBlocks.length === 0
                    ? "border-indigo-400/50 sm:border-slate-300 dark:sm:border-slate-700/60 hover:border-indigo-400"
                    : "border-indigo-400/60 sm:border-indigo-500/40"
                }`}
              >
                {placedBlocks.length === 0 ? (
                  <div className="flex items-center justify-center h-20 text-slate-500 dark:text-slate-400 text-xs text-center font-medium">
                    แตะหรือลากบล็อกโค้ดด้านล่างมาวางที่นี่
                  </div>
                ) : (
                  placedBlocks.map((block, idx) => (
                    <div
                      key={idx}
                      draggable={!isAnswerChecked}
                      onDragStart={(e) => handleDragStart(e, block, "placed", idx)}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onDrop={(e) => {
                        e.stopPropagation();
                        handleDrop(e, "placed", idx);
                      }}
                      className={`p-2.5 sm:p-3 rounded-xl border text-xs font-mono transition-all flex items-center justify-between gap-3 shadow-xs select-none ${
                        isAnswerChecked
                          ? isCorrect
                            ? "bg-white dark:bg-[#1E293B] text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30"
                            : "bg-white dark:bg-[#1E293B] text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-500/30"
                          : "border-slate-300 dark:border-slate-700/80 bg-white dark:bg-[#1E293B] text-slate-800 dark:text-white hover:border-indigo-400"
                      }`}
                    >
                      {/* Left: Sequence badge + block content */}
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <span className="w-5 h-5 rounded-md flex-shrink-0 flex items-center justify-center text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                          {idx + 1}
                        </span>
                        <span className="whitespace-pre overflow-x-auto flex-1 font-semibold">{block}</span>
                      </div>

                      {/* Right: Move Up / Move Down buttons + Remove button */}
                      {!isAnswerChecked && (
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {/* Move Up Button */}
                          <button
                            type="button"
                            onClick={(e) => movePlacedBlock(idx, "up", e)}
                            disabled={idx === 0}
                            title="เลื่อนขึ้น (Move Up)"
                            aria-label="เลื่อนขึ้น"
                            className={`p-1.5 rounded-lg border transition-all flex items-center justify-center ${
                              idx === 0
                                ? "opacity-20 cursor-not-allowed border-transparent text-slate-300 dark:text-slate-700"
                                : "border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 active:scale-90 cursor-pointer shadow-2xs"
                            }`}
                          >
                            <ChevronUp size={15} className="stroke-[2.5]" />
                          </button>

                          {/* Move Down Button */}
                          <button
                            type="button"
                            onClick={(e) => movePlacedBlock(idx, "down", e)}
                            disabled={idx === placedBlocks.length - 1}
                            title="เลื่อนลง (Move Down)"
                            aria-label="เลื่อนลง"
                            className={`p-1.5 rounded-lg border transition-all flex items-center justify-center ${
                              idx === placedBlocks.length - 1
                                ? "opacity-20 cursor-not-allowed border-transparent text-slate-300 dark:text-slate-700"
                                : "border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 active:scale-90 cursor-pointer shadow-2xs"
                            }`}
                          >
                            <ChevronDown size={15} className="stroke-[2.5]" />
                          </button>

                          {/* Remove Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleBlockClick(block, "placed");
                            }}
                            title="นำออกจากคำตอบ"
                            aria-label="นำออก"
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 hover:border-rose-300 dark:hover:border-rose-800/80 active:scale-90 transition-all cursor-pointer ml-1 shadow-2xs"
                          >
                            <X size={15} className="stroke-[2.5]" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Available Blocks Pool */}
            <div className="pt-2">
              <span className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                บล็อกตัวเลือกที่ยังไม่ได้เลือก:
              </span>
              <div
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, "available")}
                className="min-h-[80px] p-4 rounded-xl bg-slate-50 dark:bg-[#0F172A] border border-slate-200 dark:border-slate-700/60 flex flex-wrap gap-2.5 items-center"
              >
                {availableBlocks.length === 0 && placedBlocks.length > 0 ? (
                  <div className="w-full text-center text-slate-500 text-xs py-2">
                    เลือกครบทุกตัวบล็อกแล้ว
                  </div>
                ) : availableBlocks.length === 0 ? (
                  <div className="w-full text-center text-slate-500 text-xs py-2">
                    ไม่มีตัวบล็อกให้เลือก
                  </div>
                ) : (
                  availableBlocks.map((block, idx) => (
                    <div
                      key={idx}
                      draggable={!isAnswerChecked}
                      onDragStart={(e) => handleDragStart(e, block, "available")}
                      onClick={() => handleBlockClick(block, "available")}
                      className="p-2.5 rounded-lg border-2 border-slate-300 dark:border-indigo-400/50 bg-white dark:bg-[#2A364F] hover:bg-indigo-50/70 dark:hover:bg-[#3B4A6B] text-xs font-mono font-bold text-slate-800 dark:text-white hover:border-indigo-400 shadow-xs cursor-pointer select-none transition-all active:scale-95"
                    >
                      <span className="whitespace-pre">{block}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Answer Feedback Banner */}
      <AnimatePresence>
        {isAnswerChecked && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className={`p-4 rounded-xl border mb-6 flex items-start gap-3 ${
              isCorrect
                ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-800 dark:text-emerald-300"
                : "bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20 text-rose-800 dark:text-rose-300"
            }`}
          >
            <div className="flex-shrink-0 mt-0.5">
              {isCorrect ? <CheckCircle2 size={18} className="text-emerald-500 dark:text-emerald-400" /> : <XCircle size={18} className="text-rose-500 dark:text-rose-400" />}
            </div>
            <div>
              <h5 className="font-bold text-xs mb-1 uppercase tracking-wide">{isCorrect ? "ถูกต้อง" : "ยังไม่ถูกต้อง"}</h5>
              <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                {isCorrect
                  ? "คำตอบถูกต้อง เยี่ยมมาก!"
                  : "คำตอบยังไม่ถูกต้อง กด 'ข้อถัดไป' เพื่อทำข้อต่อไป (คุณสามารถตรวจดูเฉลยได้หลังทำแบบทดสอบเสร็จตามเกณฑ์)"}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-2">
        <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
          {!isAnswerChecked && (
            <span>แตะหรือลากตัวเลือกเพื่อวางในช่องคำตอบ</span>
          )}
        </div>
        <div className="flex justify-end">
          {!isAnswerChecked ? (
            <button
              id="check-answer-btn"
              onClick={handleCheckAnswer}
              disabled={isCheckingAnswer || (currentQuestion.type === "multiple_choice" ? !selectedMcq : placedBlocks.length === 0)}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-600 text-white font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed shadow-md"
            >
              {isCheckingAnswer ? "กำลังตรวจสอบคำตอบ..." : "ตรวจสอบคำตอบ"}
            </button>
          ) : (
            <button
              id="next-question-btn"
              onClick={handleNextQuestion}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              {currentIdx === activeQuestions.length - 1 ? "ดูผลคะแนนสอบ" : "ข้อถัดไป"}
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
