import React, { useState, FormEvent } from "react";
import { Lesson, CodeExample } from "../types";
import { safeFetchJson } from "../lib/api";
import { Plus, Edit2, Trash2, Eye, FileText, Check, AlertCircle, Layers } from "lucide-react";

interface AdminLessonsProps {
  lessons: Lesson[];
  onRefresh: () => void;
  token: string;
  onSelectLessonForQuiz: (lesson: Lesson) => void;
  showToast?: (message: string, type?: "success" | "error" | "info") => void;
}

export default function AdminLessons({ lessons, onRefresh, token, onSelectLessonForQuiz, showToast }: AdminLessonsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // Form states
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [orderIndex, setOrderIndex] = useState(1);
  const [isFree, setIsFree] = useState(false);
  const [codeExamples, setCodeExamples] = useState<CodeExample[]>([
    { title: "Main.java", code: "public class Main {\n    public static void main(String[] args) {\n        \n    }\n}", language: "java" }
  ]);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  const resetForm = () => {
    setTitle("");
    setContent("");
    setOrderIndex(lessons.length + 1);
    setIsFree(false);
    setCodeExamples([{ title: "Main.java", code: "public class Main {\n    public static void main(String[] args) {\n        \n    }\n}", language: "java", output: ""  }]);
    setEditId(null);
    setIsEditing(false);
    setError("");
    setSuccess("");
  };

  const handleOpenAdd = () => {
    resetForm();
    setIsEditing(true);
  };

  const handleOpenEdit = (lesson: Lesson) => {
    setTitle(lesson.title);
    setContent(lesson.content);
    setOrderIndex(lesson.order_index);
    setIsFree(lesson.is_free);
    setCodeExamples(lesson.code_examples && lesson.code_examples.length > 0 ? [...lesson.code_examples] : [
      { title: "Main.java", code: "", language: "java", output: "" }
    ]);
    setEditId(lesson.id);
    setIsEditing(true);
    setError("");
    setSuccess("");
  };

  const handleAddCodeExample = () => {
    setCodeExamples([...codeExamples, { title: "Example.java", code: "", language: "java", output: ""  }]);
  };

  const handleRemoveCodeExample = (idx: number) => {
    setCodeExamples(codeExamples.filter((_, i) => i !== idx));
  };

  const handleCodeExampleChange = (idx: number, field: "title" | "code"| "output", val: string) => {
    const updated = [...codeExamples];
    updated[idx] = { ...updated[idx], [field]: val };
    setCodeExamples(updated);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title || !content) {
      setError("กรุณากรอกชื่อบทเรียนและเนื้อหา");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    const payload = {
      title,
      content,
      order_index: Number(orderIndex),
      is_free: isFree,
      code_examples: codeExamples.filter((ce) => ce.title.trim() && ce.code.trim()),
    };

    try {
      const url = editId ? `/api/admin/lessons/${editId}` : "/api/admin/lessons";
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
        throw new Error(reqError || "เกิดข้อผิดพลาดในการบันทึกบทเรียน");
      }

      const successMsg = editId ? "บันทึกการแก้ไขบทเรียนสำเร็จแล้ว!" : "บันทึกบทเรียนใหม่สำเร็จแล้ว!";
      setSuccess(successMsg);
      if (showToast) {
        showToast(successMsg, "success");
      }
      onRefresh();
      setTimeout(() => {
        resetForm();
      }, 1500);
    } catch (err: any) {
      setError(err.message || "เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("คุณแน่ใจหรือไม่ที่จะลบบทเรียนนี้? การลบนี้จะลบแบบทดสอบและประวัติผู้ใช้ที่เข้าเรียนบทนี้ด้วย!")) {
      return;
    }

    try {
      const { ok, error: reqError } = await safeFetchJson(`/api/admin/lessons/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!ok) {
        throw new Error(reqError || "ลบบทเรียนไม่สำเร็จ");
      }

      if (showToast) {
        showToast("ลบบทเรียนเรียบร้อยแล้ว", "info");
      }
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div id="admin-lessons-container" className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            จัดการบทเรียนคอร์ส Java ({lessons.length} บท)
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            เพิ่ม ลบ แก้ไข ลำดับเนื้อหา และกำหนดสิทธิ์การเข้าถึงฟรี/ต้องเข้าสู่ระบบ
          </p>
        </div>
        {!isEditing && (
          <button
            id="add-lesson-btn"
            onClick={handleOpenAdd}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-indigo-600/20"
          >
            <Plus size={14} />
            เพิ่มบทเรียนใหม่
          </button>
        )}
      </div>

      {isEditing ? (
        /* EDIT / CREATE LESSON FORM */
        <div id="lesson-form-card" className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700/60 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700/50 pb-4 mb-6">
            <h4 className="font-bold text-slate-900 dark:text-white text-sm">
              {editId ? "แก้ไขข้อมูลบทเรียน" : "สร้างบทเรียนใหม่"}
            </h4>
            <div className="flex items-center gap-2">
              <button
                id="toggle-preview-btn"
                type="button"
                onClick={() => setPreviewMode(!previewMode)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-[#0F172A] text-xs text-slate-700 dark:text-slate-300 font-semibold cursor-pointer flex items-center gap-1 transition-all"
              >
                <Eye size={13} />
                {previewMode ? "กลับไปแก้ไข" : "ดูตัวอย่างผลลัพธ์"}
              </button>
              <button
                id="cancel-form-btn"
                onClick={resetForm}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#0F172A] dark:hover:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 font-semibold cursor-pointer border border-slate-200 dark:border-slate-700/40 transition-all"
              >
                ยกเลิก
              </button>
            </div>
          </div>

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

          {previewMode ? (
            /* MARKDOWN PREVIEW MODE */
            <div id="lesson-preview" className="prose prose-invert max-w-none border border-slate-700/50 p-6 rounded-xl bg-[#0F172A] min-h-[300px]">
              <h2 className="text-xl font-bold mb-3 text-white">{title || "ไม่ได้ระบุหัวข้อบทเรียน"}</h2>
              <div className="text-xs text-slate-400 mb-6">
                ลำดับที่: {orderIndex} | {isFree ? "บทเรียนเรียนฟรี" : "ต้องล็อกอินเข้าชม"}
              </div>
              <div className="text-xs space-y-4 whitespace-pre-wrap leading-relaxed text-slate-300">
                {content || "ไม่มีคำอธิบายเนื้อหา"}
              </div>

              {codeExamples.length > 0 && codeExamples[0].code && (
                <div className="mt-8">
                  <h4 className="text-xs font-semibold mb-2 uppercase tracking-wider text-slate-400">ตัวอย่างซอร์สโค้ดที่จะแสดง:</h4>
                  {codeExamples.map((ce, i) => (
                    <div key={i} className="mb-4">
                      <div className="text-xs font-mono font-bold text-indigo-400 mb-1">{ce.title}</div>
                      <pre className="p-4 rounded-lg bg-[#0F172A] text-slate-200 border border-slate-700/50 font-mono text-xs overflow-x-auto">
                        {ce.code}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* FORM CONTROLS */
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-400 uppercase mb-2">
                    ชื่อบทเรียน *
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="เช่น บทที่ 5: การโปรแกรมเชิงวัตถุ OOP"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700/60 bg-white dark:bg-[#0F172A] text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-400 uppercase mb-2">
                    จัดเรียงลำดับบทเรียน (Order Index)
                  </label>
                  <input
                    type="number"
                    value={orderIndex}
                    onChange={(e) => setOrderIndex(Number(e.target.value))}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700/60 bg-white dark:bg-[#0F172A] text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center gap-6 p-4 bg-slate-50 dark:bg-[#0F172A] rounded-xl border border-slate-200 dark:border-slate-700/50">
                <label className="relative flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isFree}
                    onChange={(e) => setIsFree(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 rounded focus:ring-indigo-500 cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-200">บทเรียนฟรี (Free Content)</span>
                    <span className="block text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">อนุญาตให้บุคคลทั่วไปที่ไม่ได้ Login สามารถเข้ามาเรียนอ่านและทดลองทำโจทย์ได้</span>
                  </div>
                </label>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-400 uppercase mb-2 flex items-center justify-between">
                  <span>เนื้อหาบทเรียน *</span>
                  <span className="text-[10px] font-normal text-slate-500">แนะนำ: รองรับการขึ้นบรรทัดใหม่ และเครื่องมือจัดรูปข้อความ</span>
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="พิมพ์เนื้อหาการสอนทฤษฎี อธิบายคำสั่ง ข้อดีของการใช้คำสั่ง และข้อควรระวังในบทเรียน..."
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700/60 bg-white dark:bg-[#0F172A] text-slate-900 dark:text-white text-xs font-sans min-h-[220px] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 leading-relaxed"
                  required
                />
              </div>

              {/* Code Examples Section */}
              <div className="border border-slate-200 dark:border-slate-700/50 p-4 rounded-xl space-y-4 bg-slate-50 dark:bg-[#1E293B]">
                <div className="flex items-center justify-between">
                  <h5 className="text-[11px] font-bold text-slate-700 dark:text-slate-400 uppercase">
                    ตัวอย่างซอร์สโค้ดภาษา Java ประกอบบทเรียน
                  </h5>
                  <button
                    type="button"
                    onClick={handleAddCodeExample}
                    className="px-2.5 py-1 text-xs bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-lg font-bold transition-all cursor-pointer border border-indigo-500/20"
                  >
                    + เพิ่มโค้ดตัวอย่างอีกตัว
                  </button>
                </div>

                {codeExamples.map((ce, idx) => (
                  <div key={idx} className="p-4 bg-[#0F172A] rounded-xl border border-slate-700/50 space-y-3 relative">
                    {codeExamples.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveCodeExample(idx)}
                        className="absolute top-3 right-3 text-slate-400 hover:text-rose-400 transition-colors text-xs font-bold cursor-pointer"
                      >
                        ลบออก
                      </button>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-1">ชื่อไฟล์ (เช่น Main.java)</label>
                        <input
                          type="text"
                          value={ce.title}
                          onChange={(e) => handleCodeExampleChange(idx, "title", e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-700 bg-[#0F172A] text-white text-xs focus:outline-none focus:border-indigo-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-1">ภาษาไฮไลท์ syntax (Java เท่านั้น)</label>
                        <input
                          type="text"
                          value={ce.language}
                          disabled
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-850 text-slate-500 text-xs cursor-not-allowed"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">ซอร์สโค้ดภาษา Java</label>
                      <textarea
                        value={ce.code}
                        onChange={(e) => handleCodeExampleChange(idx, "code", e.target.value)}
                        placeholder="public class Demo { ... }"
                        className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-[#0F172A] text-slate-200 text-xs font-mono min-h-[100px] focus:outline-none focus:border-indigo-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">
                        <span>ผลลัพธ์ของโปรแกรม (Output ที่ต้องการให้แสดง)</span>
                        <span className="text-slate-500 font-normal">(เว้นว่างได้ถ้าไม่มี)</span>
                      </label>
                      <textarea
                        value={ce.output || ""}
                        onChange={(e) => handleCodeExampleChange(idx, "output", e.target.value)}
                        placeholder={"เช่น:\nสวัสดีชาว Java!\nผลลัพธ์คือ: 100"}
                        className="w-full px-3 py-2 rounded-lg border border-slate-700/80 bg-[#0B1120] text-slate-200
                         placeholder-slate-600 text-xs font-mono 
                        min-h-[64px] focus:outline-none focus:border-indigo-500 transition-colors"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-700/50">
                <button
                  id="submit-lesson-btn"
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all shadow-md cursor-pointer"
                >
                  {loading ? "กำลังบันทึก..." : editId ? "บันทึกข้อมูลการแก้ไข" : "บันทึกและสร้างบทเรียน"}
                </button>
              </div>
            </form>
          )}
        </div>
      ) : (
        /* LIST OF LESSONS TABLE/GRID */
        <div id="lessons-list-card" className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700/60 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-[#0F172A] text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700/60">
                  <th className="py-4 px-6 text-center w-16">ลำดับ</th>
                  <th className="py-4 px-6">ชื่อหัวข้อบทเรียน</th>
                  <th className="py-4 px-6 w-32">สิทธิ์เข้าถึง</th>
                  <th className="py-4 px-6 w-32">โค้ดตัวอย่าง</th>
                  <th className="py-4 px-6 text-right px-6 w-80">การดำเนินการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700/50 text-xs">
                {lessons.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 px-6 text-center text-slate-500">
                      ไม่มีวิชาเรียนที่สร้างไว้ในระบบขณะนี้ ลองเริ่มสร้างบทแรกกันเถอะ!
                    </td>
                  </tr>
                ) : (
                  lessons.map((lesson) => (
                    <tr key={lesson.id} className="hover:bg-slate-50 dark:hover:bg-[#0F172A]/30 transition-all">
                      <td className="py-4 px-6 text-center font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        #{lesson.order_index}
                      </td>
                      <td className="py-4 px-6">
                        <div className="font-bold text-slate-900 dark:text-white leading-snug">
                          {lesson.title}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                          {lesson.content.length > 60 ? `${lesson.content.substring(0, 60)}...` : lesson.content}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        {lesson.is_free ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            เรียนฟรี
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                            ต้องล็อกอิน
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 font-mono text-slate-500 dark:text-slate-400">
                        {lesson.code_examples ? lesson.code_examples.length : 0} ไฟล์
                      </td>
                      <td className="py-4 px-6 text-right space-x-2">
                        <button
                          id={`manage-quiz-${lesson.id}`}
                          onClick={() => onSelectLessonForQuiz(lesson)}
                          className="px-3 py-1.5 rounded-lg border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 text-[11px] font-bold cursor-pointer transition-all inline-flex items-center gap-1"
                        >
                          จัดการข้อสอบ
                        </button>
                        <button
                          id={`edit-lesson-${lesson.id}`}
                          onClick={() => handleOpenEdit(lesson)}
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-[#0F172A] transition-all cursor-pointer inline-flex items-center justify-center"
                          title="แก้ไขบทเรียน"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          id={`delete-lesson-${lesson.id}`}
                          onClick={() => handleDelete(lesson.id)}
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-[#0F172A] transition-all cursor-pointer inline-flex items-center justify-center"
                          title="ลบบทเรียน"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
