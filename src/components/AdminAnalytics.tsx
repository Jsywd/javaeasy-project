import { AnalyticsData } from "../types";

interface AdminAnalyticsProps {
  analytics: AnalyticsData | null;
}

export default function AdminAnalytics({ analytics }: AdminAnalyticsProps) {
  if (!analytics) {
    return (
      <div className="p-8 text-center bg-[#1E293B] border border-slate-700/60 rounded-2xl">
        <p className="text-slate-400 text-xs">กำลังประมวลผลคำนวณสถิติระบบ...</p>
      </div>
    );
  }

  const { summary, lessons, user_growth } = analytics;
  const maxGrowthCount = Math.max(...user_growth.map((d) => d.new_users), 1);

  return (
    <div id="admin-analytics-container" className="space-y-6">
      <div>
        <h3 className="text-base font-bold text-slate-900 dark:text-white">
          สถิติภาพรวมและการเข้าเรียน (Analytics)
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          รายงานข้อมูลการใช้งาน อัตราการสอบผ่านแบบทดสอบ และการเติบโตของสมาชิกผู้เรียนในระบบ
        </p>
      </div>

      {/* KPI Cards (Clean Text & Numbers, No Icons) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Users */}
        <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700/60 p-5 rounded-2xl shadow-sm space-y-1.5">
          <span className="block text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">สมาชิกทั้งหมด</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">{summary.total_users}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">คน</span>
          </div>
          <span className="inline-block text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            Active ในระบบ
          </span>
        </div>

        {/* New Users This Week */}
        <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700/60 p-5 rounded-2xl shadow-sm space-y-1.5">
          <span className="block text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">สมาชิกใหม่สัปดาห์นี้</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">+{summary.new_users_week}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">คน</span>
          </div>
          <span className="inline-block text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
            สมัครใหม่รอบ 7 วัน
          </span>
        </div>

        {/* Total Lessons */}
        <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700/60 p-5 rounded-2xl shadow-sm space-y-1.5">
          <span className="block text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">บทเรียนวิชา Java</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">{summary.total_lessons}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">บท</span>
          </div>
          <span className="inline-block text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
            หลักสูตรพื้นฐาน
          </span>
        </div>

        {/* Total Attempts / Quiz Completions */}
        <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700/60 p-5 rounded-2xl shadow-sm space-y-1.5">
          <span className="block text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">ส่งกระดาษคำตอบ</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">{summary.total_attempts}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">ครั้ง</span>
          </div>
          <span className="inline-block text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            ตรวจประเมินผลแล้ว
          </span>
        </div>
      </div>

      {/* Analytics Content: Data Tables Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Growth Table (2/3 cols) */}
        <div className="lg:col-span-2 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700/60 p-6 rounded-2xl shadow-sm space-y-4">
          <div className="border-b border-slate-200 dark:border-slate-700/60 pb-3">
            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-200 uppercase tracking-wider">
              สถิติผู้สมัครสมาชิกใหม่รายวัน (ย้อนหลัง 7 วัน)
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">ยอดผู้ใช้ใหม่แยกตามวันที่เก็บข้อมูลล่าสุด</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700/50 text-slate-500 dark:text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                  <th className="py-2.5 px-3">วันที่</th>
                  <th className="py-2.5 px-3 text-right">จำนวนผู้สมัครใหม่</th>
                  <th className="py-2.5 px-3">สัดส่วน</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700/40 font-mono">
                {user_growth.map((d, index) => {
                  const percent = maxGrowthCount > 0 ? Math.round((d.new_users / maxGrowthCount) * 100) : 0;
                  return (
                    <tr key={index} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-3 text-slate-700 dark:text-slate-300 font-sans font-medium">{d.date}</td>
                      <td className="py-3 px-3 text-right text-indigo-600 dark:text-indigo-400 font-bold">
                        +{d.new_users} <span className="text-slate-400 dark:text-slate-500 text-[10px] font-normal">คน</span>
                      </td>
                      <td className="py-3 px-3 w-40">
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-indigo-500 h-full rounded-full"
                            style={{ width: `${Math.max(percent, d.new_users > 0 ? 8 : 0)}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Lesson Performance list (1/3 cols) */}
        <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700/60 p-6 rounded-2xl shadow-sm space-y-4">
          <div className="border-b border-slate-200 dark:border-slate-700/60 pb-3">
            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-200 uppercase tracking-wider">
              สถิติตอบคำถามเฉลี่ยรายบท
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">คะแนนสอบเฉลี่ยของแต่ละบทเรียน</p>
          </div>

          <div className="space-y-3 overflow-y-auto max-h-[340px] pr-1">
            {lessons.map((stat) => (
              <div key={stat.id} className="p-3 bg-slate-50 dark:bg-[#0F172A] rounded-xl border border-slate-200 dark:border-slate-700/50 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <span className="block text-xs font-bold text-slate-900 dark:text-slate-200 truncate">
                      {stat.title}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">เรียนจบแล้ว: {stat.completions} คน</span>
                  </div>
                  <span className="font-mono text-xs font-extrabold text-indigo-600 dark:text-indigo-400 flex-shrink-0">
                    เฉลี่ย {stat.average_score}%
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between text-[9px] text-slate-500 mb-1 font-bold">
                    <span>สัดส่วนผ่านเกณฑ์:</span>
                    <span>{stat.completion_rate}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${stat.completion_rate}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
