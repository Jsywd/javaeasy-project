import React, { useState, useEffect, FormEvent } from "react";
import { Lesson, QuizQuestion } from "../types";
import { safeFetchJson } from "../lib/api";
import { Plus, Edit2, Trash2, ArrowLeft, Check, AlertCircle, HelpCircle, Trash, ChevronUp, ChevronDown } from "lucide-react";

interface AdminQuizzesProps {
  lesson: Lesson;
  onBack: () => void;
  token: string;
  showToast?: (message: string, type?: "success" | "error" | "info") => void;
}

export default function AdminQuizzes({ lesson, onBack, token, showToast }: AdminQuizzesProps) {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // Form states
  const [type, setType] = useState<"multiple_choice" | "drag_drop">("multiple_choice");
  const [dragDropMode, setDragDropMode] = useState<"slot" | "lines">("slot");
  const [templateCode, setTemplateCode] = useState("");
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", "", ""]);
  const [correctAnswerMcq, setCorrectAnswerMcq] = useState("");
  const [correctAnswerSlot, setCorrectAnswerSlot] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchQuestions = async () => {
    const { ok, data } = await safeFetchJson(`/api/lessons/${lesson.id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (ok && data) {
      setQuestions(data.questions || []);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, [lesson.id]);

  const resetForm = () => {
    setType("multiple_choice");
    setDragDropMode("slot");
    setTemplateCode("");
    setQuestion("");
    setOptions(["", "", ""]);
    setCorrectAnswerMcq("");
    setCorrectAnswerSlot("");
    setEditId(null);
    setIsEditing(false);
    setError("");
    setSuccess("");
  };

  const handleOpenAdd = () => {
    resetForm();
    setIsEditing(true);
  };

  const handleOpenEdit = (q: QuizQuestion) => {
    setType(q.type);
    setQuestion(q.question);
    setTemplateCode(q.template_code || "");
    setOptions([...q.options]);
    if (q.type === "multiple_choice") {
      setCorrectAnswerMcq(q.correct_answer as string);
    } else {
      if (q.template_code || (Array.isArray(q.correct_answer) && q.correct_answer.length === 1)) {
        setDragDropMode("slot");
        setCorrectAnswerSlot(Array.isArray(q.correct_answer) ? q.correct_answer[0] : (q.correct_answer as string));
      } else {
        setDragDropMode("lines");
      }
    }
    setEditId(q.id);
    setIsEditing(true);
    setError("");
    setSuccess("");
  };

  const handleAddOption = () => {
    setOptions([...options, ""]);
  };

  const handleRemoveOption = (idx: number) => {
    if (options.length <= 2) return;
    setOptions(options.filter((_, i) => i !== idx));
  };

  const handleMoveOption = (idx: number, direction: "up" | "down") => {
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= options.length) return;
    const updated = [...options];
    const temp = updated[idx];
    updated[idx] = updated[targetIdx];
    updated[targetIdx] = temp;
    setOptions(updated);
  };

  const handleOptionChange = (idx: number, val: string) => {
    const updated = [...options];
    updated[idx] = val;
    setOptions(updated);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const filteredOptions = options.map((o) => o.trim()).filter((o) => o.length > 0);
    if (!question.trim()) {
      setError("กรุณากรอกโจทย์คำถาม");
      return;
    }

    if (filteredOptions.length < 2) {
      setError("กรุณากรอกตัวเลือกอย่างน้อย 2 ตัวเลือก");
      return;
    }

    let correct_answer: any = null;

    if (type === "multiple_choice") {
      if (!correctAnswerMcq.trim()) {
        setError("กรุณาเลือกหรือระบุเฉลยที่ถูกต้องสำหรับตัวเลือกปรนัย");
        return;
      }
      correct_answer = correctAnswerMcq.trim();
    } else {
      if (dragDropMode === "slot") {
        if (!correctAnswerSlot.trim()) {
          setError("กรุณาเลือกตัวเลือกที่เป็นคำตอบที่ถูกต้องสำหรับช่องว่าง");
          return;
        }
        correct_answer = [correctAnswerSlot.trim()];
      } else {
        correct_answer = filteredOptions;
      }
    }

    setLoading(true);
    setError("");
    setSuccess("");

    const payload: any = {
      type,
      question: question.trim(),
      options: filteredOptions,
      correct_answer,
      order_index: questions.length + 1,
    };

    if (type === "drag_drop" && dragDropMode === "slot" && templateCode.trim()) {
      payload.template_code = templateCode.trim();
    }

    try {
      const url = editId
        ? `/api/admin/questions/${editId}`
        : `/api/admin/lessons/${lesson.id}/questions`;
      const method = editId ? "PUT" : "POST";

      const { ok, error: reqError } = await safeFetchJson(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!ok) {
        throw new Error(reqError || "เกิดข้อผิดพลาดในการบันทึกข้อสอบ");
      }

      const msg = editId ? "บันทึกการแก้ไขข้อสอบสำเร็จแล้ว!" : "บันทึกข้อสอบใหม่สำเร็จแล้ว!";
      setSuccess(msg);
      if (showToast) {
        showToast(msg, "success");
      }
      fetchQuestions();
      setTimeout(() => {
        resetForm();
      }, 1500);
    } catch (err: any) {
      setError(err.message || "ล้มเหลวในการเชื่อมต่อเซิร์ฟเวอร์");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (qId: string) => {
    if (!confirm("คุณแน่ใจว่าต้องการลบคำถามข้อนี้?")) {
      return;
    }

    try {
      const { ok, error: reqError } = await safeFetchJson(`/api/admin/questions/${qId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!ok) {
        throw new Error(reqError || "ลบข้อสอบไม่สำเร็จ");
      }

      if (showToast) {
        showToast("ลบข้อสอบเรียบร้อยแล้ว", "info");
      }
      fetchQuestions();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div id="admin-quizzes-container" className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          id="back-to-lessons-btn"
          onClick={onBack}
          className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-[#1E293B] dark:hover:bg-slate-800 dark:text-slate-200 rounded-xl cursor-pointer transition-all border border-slate-200 dark:border-slate-700/60"
        >
          <ArrowLeft size={15} />
        </button>
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            แบบทดสอบ: {lesson.title}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            จัดการข้อสอบปรนัยและเรียงลำดับโค้ดท้ายบทเรียนเพื่อวัดทักษะผู้เรียน
          </p>
        </div>
      </div>

      {isEditing ? (
        /* CREATE / EDIT QUESTION FORM */
        <div id="question-form-card" className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700/60 rounded-2xl p-6 shadow-xl">
          <h4 className="font-bold text-slate-900 dark:text-white pb-4 border-b border-slate-200 dark:border-slate-700/50 mb-6 text-sm">
            {editId ? "แก้ไขโจทย์คำถาม" : "เพิ่มข้อสอบใหม่"}
          </h4>

          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs flex items-center gap-2 mb-4">
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs flex items-center gap-2 mb-4">
              <Check size={15} />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Question Type Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-400 uppercase mb-2">
                  ประเภทคำถาม
                </label>
                <div className="flex rounded-xl bg-slate-100 dark:bg-[#0F172A] p-1 border border-slate-200 dark:border-slate-700/60">
                  <button
                    id="mcq-type-btn"
                    type="button"
                    onClick={() => { setType("multiple_choice"); setCorrectAnswerMcq(""); }}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      type === "multiple_choice"
                        ? "bg-white text-indigo-600 shadow-sm border border-slate-200/80 dark:bg-[#1E293B] dark:text-indigo-400 dark:border-indigo-500/30"
                        : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                    }`}
                  >
                    Multiple Choice (เลือกตอบ)
                  </button>
                  <button
                    id="dragdrop-type-btn"
                    type="button"
                    onClick={() => setType("drag_drop")}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      type === "drag_drop"
                        ? "bg-white text-indigo-600 shadow-sm border border-slate-200/80 dark:bg-[#1E293B] dark:text-indigo-400 dark:border-indigo-500/30"
                        : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                    }`}
                  >
                    Drag & Drop
                  </button>
                </div>
              </div>

              {type === "drag_drop" && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-400 uppercase mb-2">
                    รูปแบบ Drag & Drop
                  </label>
                  <div className="flex rounded-xl bg-slate-100 dark:bg-[#0F172A] p-1 border border-slate-200 dark:border-slate-700/60">
                    <button
                      id="dragdrop-slot-mode-btn"
                      type="button"
                      onClick={() => setDragDropMode("slot")}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        dragDropMode === "slot"
                          ? "bg-white text-indigo-600 shadow-sm border border-slate-200/80 dark:bg-[#1E293B] dark:text-indigo-400 dark:border-indigo-500/30"
                          : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                      }`}
                    >
                      เติมคำในช่องว่าง (Fill-in-the-Blank)
                    </button>
                    <button
                      id="dragdrop-lines-mode-btn"
                      type="button"
                      onClick={() => setDragDropMode("lines")}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        dragDropMode === "lines"
                          ? "bg-white text-indigo-600 shadow-sm border border-slate-200/80 dark:bg-[#1E293B] dark:text-indigo-400 dark:border-indigo-500/30"
                          : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                      }`}
                    >
                      เรียงบรรทัดโค้ด (Multi-line)
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Template Code for Slot Mode */}
            {type === "drag_drop" && dragDropMode === "slot" && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-400 uppercase">
                    โค้ดต้นแบบพร้อมช่องว่าง (ใช้เครื่องหมาย ___ 3 ขีด แทนจุดที่จะให้ผู้เรียนลากคำตอบมาเติม)
                  </label>
                  <span className="text-[10px] text-indigo-500 dark:text-indigo-400 font-semibold">จำเป็นต้องมี ___</span>
                </div>
                <input
                  type="text"
                  value={templateCode}
                  onChange={(e) => setTemplateCode(e.target.value)}
                  placeholder='เช่น System.out.___("Hello World"); หรือ System.out.___("A");'
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700/60 bg-white dark:bg-[#0F172A] text-indigo-700 dark:text-indigo-300 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  required
                />
                {/* Quick Presets */}
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="text-[10px] text-slate-500 font-medium">กดเพื่อเลือกตัวอย่างด่วน:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setTemplateCode('System.out.___("Hello World");');
                      if (!question) setQuestion("Drag and drop the correct method to print Hello World in Java.");
                    }}
                    className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-300 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                  >
                    System.out.___("Hello World");
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTemplateCode('System.out.___("A");');
                      if (!question) setQuestion("จงลากคำสั่งที่ถูกต้องเพื่อแสดงผลตัวอักษร A ออกทางหน้าจอ");
                    }}
                    className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-300 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                  >
                    System.out.___("A");
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTemplateCode("public static void ___(String[] args)");
                    }}
                    className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-300 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                  >
                    main method
                  </button>
                </div>
              </div>
            )}

            {/* Question Text */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-400 uppercase mb-2">
                โจทย์คำถาม *
              </label>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder={type === "multiple_choice" ? "เช่น ชนิดข้อมูลใดต่อไปนี้เก็บตัวอักษรเดียวใน Java?" : "เช่น จงเรียงคำสั่งลูป For เพื่อพิมพ์ข้อความ 5 รอบ"}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700/60 bg-white dark:bg-[#0F172A] text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 min-h-[80px]"
                required
              />
            </div>

            {/* Options Management */}
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700/50">
                <div>
                  <h5 className="text-xs font-bold text-slate-900 dark:text-slate-300">
                    {type === "multiple_choice"
                      ? "รายการตัวเลือกคำตอบ"
                      : dragDropMode === "slot"
                      ? "รายการตัวเลือกสำหรับเติมในช่องว่าง"
                      : "บล็อกคำตอบในลำดับที่ถูกต้อง (ล่าง-บน)"}
                  </h5>
                  <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-1">
                    {type === "multiple_choice"
                      ? "กรอกตัวเลือกทั้งหมด และเลือกเฉลยโดยการคลิกปุ่มวิทยุด้านข้าง"
                      : dragDropMode === "slot"
                      ? "กรอกตัวเลือกทั้งหมด (เช่น 3 ตัวเลือก) และคลิกปุ่มวิทยุเพื่อเลือกข้อที่เป็นเฉลยถูกต้อง"
                      : "กรอกข้อความแยกเป็นข้อๆ ตามลำดับโค้ดที่ถูกต้องจากบนลงล่าง (ระบบจะสลับตัวเลือกให้ผู้เรียนอัตโนมัติ)"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddOption}
                  className="px-2.5 py-1 text-xs bg-indigo-500/10 text-indigo-400 rounded-lg font-bold hover:bg-indigo-500/20 transition-all cursor-pointer border border-indigo-500/20"
                >
                  + เพิ่มตัวเลือก
                </button>
              </div>

              <div className="space-y-3">
                {options.map((option, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    {/* If MCQ or Drag & Drop Slot Mode, show radio button to select correct answer */}
                    {(type === "multiple_choice" || (type === "drag_drop" && dragDropMode === "slot")) && (
                      <input
                        type="radio"
                        name="correct_choice"
                        checked={
                          type === "multiple_choice"
                            ? correctAnswerMcq === option && option.trim() !== ""
                            : correctAnswerSlot === option && option.trim() !== ""
                        }
                        disabled={option.trim() === ""}
                        onChange={() => {
                          if (type === "multiple_choice") {
                            setCorrectAnswerMcq(option);
                          } else {
                            setCorrectAnswerSlot(option);
                          }
                        }}
                        className="w-4 h-4 text-indigo-500 bg-slate-900 border-slate-700 focus:ring-indigo-500 cursor-pointer"
                        title="ทำเครื่องหมายว่าเป็นข้อเฉลยที่ถูกต้อง"
                      />
                    )}

                    {type === "drag_drop" && dragDropMode === "lines" && (
                      <span className="font-mono text-xs font-bold text-indigo-400 w-6 text-center">
                        #{idx + 1}
                      </span>
                    )}

                    <input
                      type="text"
                      value={option}
                      onChange={(e) => handleOptionChange(idx, e.target.value)}
                      placeholder={
                        type === "multiple_choice"
                          ? `ตัวเลือกที่ ${idx + 1}`
                          : dragDropMode === "slot"
                          ? `ตัวเลือกที่ ${idx + 1} (เช่น println)`
                          : `คำสั่งบรรทัดที่ ${idx + 1}`
                      }
                      className="flex-1 px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700/60 bg-white dark:bg-[#0F172A] text-slate-900 dark:text-white text-xs focus:outline-none"
                      required
                    />

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleMoveOption(idx, "up")}
                        disabled={idx === 0}
                        className={`p-1.5 rounded-lg border transition-all ${
                          idx === 0
                            ? "opacity-20 cursor-not-allowed border-transparent text-slate-400 dark:text-slate-600"
                            : "border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                        }`}
                        title="เลื่อนขึ้น"
                      >
                        <ChevronUp size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveOption(idx, "down")}
                        disabled={idx === options.length - 1}
                        className={`p-1.5 rounded-lg border transition-all ${
                          idx === options.length - 1
                            ? "opacity-20 cursor-not-allowed border-transparent text-slate-400 dark:text-slate-600"
                            : "border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                        }`}
                        title="เลื่อนลง"
                      >
                        <ChevronDown size={13} />
                      </button>
                    </div>

                    {options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveOption(idx)}
                        className="p-2 text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                        title="ลบตัวเลือกนี้"
                      >
                        <Trash size={15} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Answer Reminder */}
            {(type === "multiple_choice" || (type === "drag_drop" && dragDropMode === "slot")) && (
              <div className="text-xs text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5 bg-indigo-500/10 p-2.5 rounded-lg border border-indigo-500/20">
                <Check size={14} />
                <span>
                  คำตอบที่เป็นเฉลยในระบบขณะนี้:{" "}
                  {type === "multiple_choice" ? (
                    correctAnswerMcq ? (
                      <strong className="text-slate-900 dark:text-white font-bold">{correctAnswerMcq}</strong>
                    ) : (
                      <em className="text-slate-500">ยังไม่ระบุ (คลิกเครื่องหมายวงกลมด้านซ้ายเพื่อเลือกเฉลย)</em>
                    )
                  ) : correctAnswerSlot ? (
                    <strong className="text-slate-900 dark:text-white font-bold">{correctAnswerSlot}</strong>
                  ) : (
                    <em className="text-slate-500">ยังไม่ระบุ (คลิกเครื่องหมายวงกลมด้านซ้ายเพื่อเลือกเฉลย)</em>
                  )}
                </span>
              </div>
            )}

            {/* Form actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700/50">
              <button
                id="cancel-question-btn"
                type="button"
                onClick={resetForm}
                className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-[#0F172A] text-slate-700 dark:text-slate-300 font-semibold text-xs cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                id="submit-question-btn"
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all shadow-md cursor-pointer"
              >
                {loading ? "กำลังบันทึก..." : editId ? "อัปเดตข้อมูลข้อสอบ" : "สร้างและเพิ่มข้อสอบ"}
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* LIST OF QUESTIONS */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-400 uppercase tracking-wider">รายการคำถามท้ายบทเรียน ({questions.length} ข้อ)</h4>
            <button
              id="add-question-btn"
              onClick={handleOpenAdd}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-indigo-600/20"
            >
              <Plus size={13} />
              เพิ่มคำถามข้อถัดไป
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {questions.length === 0 ? (
              <div className="p-8 text-center bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700/60 rounded-2xl shadow-xs">
                <p className="text-xs text-slate-500 dark:text-slate-400">ยังไม่มีข้อสอบท้ายบทเรียนสำหรับบทนี้ สร้างข้อแรกได้โดยปุ่มขวาบน</p>
              </div>
            ) : (
              questions.map((q, idx) => (
                <div key={q.id} className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700/60 p-5 rounded-2xl flex flex-col md:flex-row md:items-start justify-between gap-4 shadow-sm">
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                        คำถามที่ {idx + 1}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-[#0F172A] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700/60">
                        {q.type === "multiple_choice" ? "Multiple Choice" : "Drag & Drop (เรียงโค้ด)"}
                      </span>
                    </div>

                    <h5 className="font-bold text-slate-900 dark:text-white text-xs">
                      {q.question}
                    </h5>

                    {/* Show Options Overview */}
                    <div className="space-y-2 pl-3 border-l-2 border-slate-200 dark:border-slate-700">
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider mb-1">ตัวเลือกตอบ:</div>
                      {q.type === "multiple_choice" ? (
                        q.options.map((option, oIdx) => (
                          <div key={oIdx} className="text-xs text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            <span className="w-4 h-4 rounded-full bg-slate-100 dark:bg-[#0F172A] text-[10px] flex items-center justify-center font-bold text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">{oIdx + 1}</span>
                            <span className={option === q.correct_answer ? "text-emerald-600 dark:text-emerald-400 font-bold" : ""}>
                              {option} {option === q.correct_answer && " (เฉลยที่ถูกต้อง)"}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="space-y-1">
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block mb-1">ลำดับโค้ดที่เฉลยถูกต้อง:</span>
                          {(q.correct_answer as string[]).map((val, cIdx) => (
                            <code key={cIdx} className="block text-[11px] text-indigo-700 dark:text-indigo-400 font-mono bg-slate-100 dark:bg-[#0F172A] px-2 py-1 rounded border border-slate-200 dark:border-slate-700/60 w-fit">
                              {cIdx + 1}. {val}
                            </code>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-start flex-shrink-0">
                    <button
                      id={`edit-question-${q.id}`}
                      onClick={() => handleOpenEdit(q)}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-[#0F172A] transition-all cursor-pointer"
                      title="แก้ไขข้อสอบ"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      id={`delete-question-${q.id}`}
                      onClick={() => handleDelete(q.id)}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-[#0F172A] transition-all cursor-pointer"
                      title="ลบข้อสอบ"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
