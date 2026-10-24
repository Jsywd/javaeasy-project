import { useState } from "react";
import { Lesson, UserProgress } from "../types";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  AreaChart,
  Area,
  Cell,
} from "recharts";
import {
  BarChart3,
  TrendingUp,
  Award,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Target,
} from "lucide-react";

interface StudentAnalyticsChartProps {
  lessons: Lesson[];
  progressList: UserProgress[];
  onSelectLesson?: (lesson: Lesson) => void;
}

export default function StudentAnalyticsChart({
  lessons,
  progressList,
  onSelectLesson,
}: StudentAnalyticsChartProps) {
  const [activeTab, setActiveTab] = useState<"scores" | "progress">("scores");

  // Sort lessons by order_index
  const sortedLessons = [...lessons].sort((a, b) => a.order_index - b.order_index);

  // Prepare chart data
  let cumulativePassed = 0;
  const chartData = sortedLessons.map((lesson, idx) => {
    const progress = progressList.find((p) => p.lesson_id === lesson.id);
    const hasAttempted = !!progress;
    const score = progress ? progress.quiz_score : 0;
    const isCompleted = progress?.completed || false;

    if (isCompleted) {
      cumulativePassed += 1;
    }

    const cumulativeRate = sortedLessons.length > 0
      ? Math.round((cumulativePassed / sortedLessons.length) * 100)
      : 0;

    return {
      lessonId: lesson.id,
      index: lesson.order_index,
      name: `บทที่ ${lesson.order_index}`,
      shortName: `บ.${lesson.order_index}`,
      title: lesson.title,
      score: score,
      hasAttempted,
      completed: isCompleted,
      cumulativeRate,
      rawLesson: lesson,
    };
  });

  // Calculate summary metrics
  const attemptedItems = chartData.filter((d) => d.hasAttempted);
  const completedCount = chartData.filter((d) => d.completed).length;
  const totalCount = sortedLessons.length;
  const averageScore = attemptedItems.length > 0
    ? Math.round(attemptedItems.reduce((acc, curr) => acc + curr.score, 0) / attemptedItems.length)
    : 0;
  const highestScore = attemptedItems.length > 0
    ? Math.max(...attemptedItems.map((d) => d.score))
    : 0;
  const overallProgressPercent = totalCount > 0
    ? Math.round((completedCount / totalCount) * 100)
    : 0;

  // Custom Tooltip for Bar Chart (Scores)
  const CustomScoreTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-[#0F172A] border border-slate-700/90 p-3 rounded-xl shadow-xl text-xs space-y-1.5 min-w-[180px]">
          <div className="text-[10px] font-bold text-slate-400 font-mono uppercase">
            {data.name}
          </div>
          <div className="font-bold text-white leading-snug">
            {data.title}
          </div>
          <div className="pt-1.5 border-t border-slate-800 flex items-center justify-between">
            <span className="text-slate-400">คะแนนที่ได้:</span>
            <span
              className={`font-mono font-extrabold ${
                data.hasAttempted
                  ? data.score >= 60
                    ? "text-emerald-400"
                    : "text-amber-400"
                  : "text-slate-500"
              }`}
            >
              {data.hasAttempted ? `${data.score}%` : "ยังไม่ได้สอบ"}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400">สถานะ:</span>
            <span
              className={`font-semibold ${
                data.completed
                  ? "text-emerald-400"
                  : data.hasAttempted
                  ? "text-amber-400"
                  : "text-slate-500"
              }`}
            >
              {data.completed ? "ผ่านเกณฑ์" : data.hasAttempted ? "ยังไม่ผ่าน (ต่ำกว่า 60%)" : "ยังไม่เริ่ม"}
            </span>
          </div>
          {onSelectLesson && (
            <div className="text-[10px] text-indigo-400 pt-1 font-medium text-center">
              คลิกเพื่อเปิดบทเรียนนี้
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  // Custom Tooltip for Area Chart (Progress)
  const CustomProgressTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-[#0F172A] border border-slate-700/90 p-3 rounded-xl shadow-xl text-xs space-y-1.5 min-w-[180px]">
          <div className="text-[10px] font-bold text-slate-400 font-mono uppercase">
            {data.name}
          </div>
          <div className="font-bold text-white leading-snug">
            {data.title}
          </div>
          <div className="pt-1.5 border-t border-slate-800 flex items-center justify-between">
            <span className="text-slate-400">ความก้าวหน้ารวมสะสม:</span>
            <span className="font-mono font-extrabold text-indigo-400">
              {data.cumulativeRate}%
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400">ผลการเรียนบทนี้:</span>
            <span className={data.completed ? "text-emerald-400 font-semibold" : "text-slate-500 font-semibold"}>
              {data.completed ? "เรียนผ่านแล้ว" : "ยังไม่ผ่าน"}
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div
      id="student-analytics-section"
      className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700/60 rounded-2xl p-5 sm:p-7 shadow-xs space-y-6"
    >
      {/* Top Header & Tab Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="text-indigo-600 dark:text-indigo-400" size={18} />
            สถิติและการพัฒนาการเรียน (Learning Analytics)
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            ติดตามผลคะแนนแบบทดสอบรายบทและอัตราความก้าวหน้าตลอดหลักสูตร
          </p>
        </div>

        {/* Chart View Switcher */}
        <div className="flex items-center bg-slate-100 dark:bg-[#0F172A] p-1 rounded-xl border border-slate-200 dark:border-slate-700/60 w-fit">
          <button
            onClick={() => setActiveTab("scores")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === "scores"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <BarChart3 size={13} />
            <span>คะแนนรายบท</span>
          </button>
          <button
            onClick={() => setActiveTab("progress")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === "progress"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <TrendingUp size={13} />
            <span>ความก้าวหน้าสะสม</span>
          </button>
        </div>
      </div>

      {/* 4 Summary Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Average Score */}
        <div className="bg-slate-50 border border-slate-200 dark:bg-[#0F172A] dark:border-slate-700/50 p-3.5 rounded-xl space-y-1">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider">
            <span>คะแนนเฉลี่ย</span>
            <Target size={13} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="text-lg font-mono font-extrabold text-slate-900 dark:text-white flex items-baseline gap-1">
            <span>{averageScore}%</span>
            {attemptedItems.length > 0 && (
              <span className="text-[10px] font-sans text-slate-500 dark:text-slate-400 font-normal">
                ({attemptedItems.length} บทที่สอบ)
              </span>
            )}
          </div>
        </div>

        {/* Lessons Completed */}
        <div className="bg-slate-50 border border-slate-200 dark:bg-[#0F172A] dark:border-slate-700/50 p-3.5 rounded-xl space-y-1">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider">
            <span>ผ่านการทดสอบ</span>
            <CheckCircle2 size={13} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-lg font-mono font-extrabold text-slate-900 dark:text-white flex items-baseline gap-1">
            <span>{completedCount} / {totalCount}</span>
            <span className="text-[10px] font-sans text-slate-500 dark:text-slate-400 font-normal">บท</span>
          </div>
        </div>

        {/* Highest Score */}
        <div className="bg-slate-50 border border-slate-200 dark:bg-[#0F172A] dark:border-slate-700/50 p-3.5 rounded-xl space-y-1">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider">
            <span>คะแนนสูงสุด</span>
            <Award size={13} className="text-amber-500 dark:text-amber-400" />
          </div>
          <div className="text-lg font-mono font-extrabold text-slate-900 dark:text-white">
            {highestScore}%
          </div>
        </div>

        {/* Total Course Progress */}
        <div className="bg-slate-50 border border-slate-200 dark:bg-[#0F172A] dark:border-slate-700/50 p-3.5 rounded-xl space-y-1">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider">
            <span>ความก้าวหน้ารวม</span>
            <TrendingUp size={13} className="text-violet-600 dark:text-violet-400" />
          </div>
          <div className="text-lg font-mono font-extrabold text-slate-900 dark:text-white">
            {overallProgressPercent}%
          </div>
        </div>
      </div>

      {/* Chart Canvas Container */}
      <div className="pt-2">
        {totalCount === 0 ? (
          <div className="h-56 flex flex-col items-center justify-center text-slate-500 text-xs bg-[#0F172A]/50 rounded-xl border border-slate-800">
            <HelpCircle size={28} className="mb-2 opacity-50" />
            <span>ยังไม่มีข้อมูลบทเรียนในระบบ</span>
          </div>
        ) : activeTab === "scores" ? (
          /* TAB 1: BAR CHART (SCORES PER LESSON) */
          <div>
            <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 mb-3 px-1 gap-2">
              <span className="font-semibold text-slate-300">
                คะแนนแบบทดสอบรายบทเรียน (%)
              </span>
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block"></span>
                  ผ่านเกณฑ์ (≥60%)
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded bg-amber-500 inline-block"></span>
                  ยังไม่ผ่าน (&lt;60%)
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded bg-slate-700 inline-block"></span>
                  ยังไม่ได้สอบ
                </span>
              </div>
            </div>

            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                  onClick={(e: any) => {
                    if (e && e.activePayload && e.activePayload.length && onSelectLesson) {
                      onSelectLesson(e.activePayload[0].payload.rawLesson);
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke="#64748B"
                    tick={{ fill: "#94A3B8", fontSize: 11 }}
                    tickLine={false}
                    interval={0}
                  />
                  <YAxis
                    domain={[0, 100]}
                    stroke="#64748B"
                    tick={{ fill: "#94A3B8", fontSize: 11 }}
                    tickLine={false}
                    ticks={[0, 20, 40, 60, 80, 100]}
                    unit="%"
                  />
                  <Tooltip content={<CustomScoreTooltip />} cursor={{ fill: "rgba(99, 102, 241, 0.08)" }} />
                  
                  {/* Passing Grade Benchmark Reference Line */}
                  <ReferenceLine
                    y={60}
                    stroke="#10B981"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    label={{
                      value: "เกณฑ์ผ่าน 60%",
                      position: "insideTopRight",
                      fill: "#10B981",
                      fontSize: 10,
                      fontWeight: "bold",
                    }}
                  />

                  <Bar dataKey="score" radius={[6, 6, 0, 0]} maxBarSize={48}>
                    {chartData.map((entry, index) => {
                      let fillColor = "#334155"; // not attempted
                      if (entry.hasAttempted) {
                        fillColor = entry.score >= 60 ? "#10B981" : "#F59E0B";
                      }
                      return (
                        <Cell
                          key={`cell-${index}`}
                          fill={fillColor}
                          className="transition-all duration-200 cursor-pointer hover:opacity-85"
                        />
                      );
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          /* TAB 2: AREA CHART (CUMULATIVE PROGRESS RATE) */
          <div>
            <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 mb-3 px-1 gap-2">
              <span className="font-semibold text-slate-300">
                อัตราความก้าวหน้าสะสมของหลักสูตร (%)
              </span>
              <span className="text-indigo-400 font-mono font-bold">
                เป้าหมาย: 100%
              </span>
            </div>

            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                  onClick={(e: any) => {
                    if (e && e.activePayload && e.activePayload.length && onSelectLesson) {
                      onSelectLesson(e.activePayload[0].payload.rawLesson);
                    }
                  }}
                >
                  <defs>
                    <linearGradient id="progressGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366F1" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#6366F1" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke="#64748B"
                    tick={{ fill: "#94A3B8", fontSize: 11 }}
                    tickLine={false}
                    interval={0}
                  />
                  <YAxis
                    domain={[0, 100]}
                    stroke="#64748B"
                    tick={{ fill: "#94A3B8", fontSize: 11 }}
                    tickLine={false}
                    ticks={[0, 25, 50, 75, 100]}
                    unit="%"
                  />
                  <Tooltip content={<CustomProgressTooltip />} />
                  <ReferenceLine
                    y={100}
                    stroke="#6366F1"
                    strokeDasharray="3 3"
                    opacity={0.4}
                  />
                  <Area
                    type="monotone"
                    dataKey="cumulativeRate"
                    stroke="#6366F1"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#progressGradient)"
                    dot={{ fill: "#6366F1", stroke: "#0F172A", strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, fill: "#818CF8" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
