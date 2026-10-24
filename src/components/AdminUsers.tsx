import { useState } from "react";
import { Profile } from "../types";
import { safeFetchJson } from "../lib/api";
import { Search, ShieldAlert, ShieldCheck, UserMinus, UserCheck, Users } from "lucide-react";

interface AdminUsersProps {
  users: Profile[];
  onRefresh: () => void;
  token: string;
  currentUserId: string;
}

export default function AdminUsers({ users, onRefresh, token, currentUserId }: AdminUsersProps) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleRoleChange = async (userId: string, currentRole: "user" | "admin") => {
    const newRole = currentRole === "admin" ? "user" : "admin";
    const msg = newRole === "admin"
      ? "คุณแน่ใจว่าต้องการตั้งผู้ใช้นี้เป็น แอดมิน (Admin) ใช่หรือไม่? เขาสามารถเข้าถึงหน้าแผงควบคุมระบบและจัดการเนื้อหาทั้งหมดได้!"
      : "คุณแน่ใจว่าต้องการลดบทบาทของแอดมินท่านนี้กลับมาเป็น สมาชิกทั่วไป (User) ใช่หรือไม่?";

    if (!confirm(msg)) return;

    setActionLoading(userId);
    try {
      const { ok, error: reqError } = await safeFetchJson(`/api/admin/users/${userId}/role`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: newRole }),
      });

      if (!ok) {
        throw new Error(reqError || "ดำเนินการล้มเหลว");
      }

      onRefresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleStatusChange = async (userId: string, currentStatus: "active" | "suspended") => {
    const newStatus = currentStatus === "suspended" ? "active" : "suspended";
    const msg = newStatus === "suspended"
      ? "ระงับสิทธิ์บัญชีผู้ใช้นี้ชั่วคราว? ผู้ใช้รายนี้จะไม่สามารถเข้าสู่ระบบและทำแบบทดสอบได้จนกว่าจะเปิดใช้งานอีกครั้ง!"
      : "ต้องการเปิดใช้งานบัญชีผู้ใช้นี้อีกครั้ง?";

    if (!confirm(msg)) return;

    setActionLoading(userId);
    try {
      const { ok, error: reqError } = await safeFetchJson(`/api/admin/users/${userId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!ok) {
        throw new Error(reqError || "ดำเนินการล้มเหลว");
      }

      onRefresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Filter and Search users
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());

    const matchesRole = roleFilter === "all" || u.role === roleFilter;
    const matchesStatus = statusFilter === "all" || u.status === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });

  return (
    <div id="admin-users-container" className="space-y-6">
      <div>
        <h3 className="text-base font-bold text-slate-900 dark:text-white">
          จัดการสมาชิกผู้เรียน ({users.length} คน)
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          ตรวจสอบความก้าวหน้าการเรียน ค้นหา ปรับบทบาทแอดมิน และระงับ/เปิดใช้งานผู้ใช้
        </p>
      </div>

      {/* Filter Toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-white dark:bg-[#1E293B] p-4 border border-slate-200 dark:border-slate-700/60 rounded-2xl shadow-sm">
        <div className="sm:col-span-2 relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
            <Search size={15} />
          </span>
          <input
            type="text"
            placeholder="ค้นหาชื่อผู้ใช้ หรือ อีเมล..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-700/60 bg-white dark:bg-[#0F172A] text-slate-900 dark:text-white text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>

        <div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700/60 bg-white dark:bg-[#0F172A] text-slate-900 dark:text-white text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
          >
            <option value="all">บทบาท: ทั้งหมด</option>
            <option value="user">สมาชิกทั่วไป (Student)</option>
            <option value="admin">ผู้ดูแลระบบ (Admin)</option>
          </select>
        </div>

        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700/60 bg-white dark:bg-[#0F172A] text-slate-900 dark:text-white text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
          >
            <option value="all">สถานะ: ทั้งหมด</option>
            <option value="active">ใช้งานปกติ (Active)</option>
            <option value="suspended">ระงับใช้งาน (Suspended)</option>
          </select>
        </div>
      </div>

      {/* Users List Table */}
      <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700/60 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-[#0F172A] text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700/60">
                <th className="py-4 px-6">ข้อมูลผู้เรียน</th>
                <th className="py-4 px-6 text-center w-28">บทบาท</th>
                <th className="py-4 px-6 text-center w-28">ความคืบหน้า</th>
                <th className="py-4 px-6 text-center w-28">คะแนนสอบเฉลี่ย</th>
                <th className="py-4 px-6 text-center w-32">สถานะสิทธิ์</th>
                <th className="py-4 px-6 text-right px-6 w-56">การดำเนินการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700/50 text-xs">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 px-6 text-center text-slate-500">
                    ไม่พบข้อมูลผู้เรียนตามเงื่อนไขการค้นหาข้างต้น
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isSelf = u.id === currentUserId;

                  return (
                    <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-[#0F172A]/30 transition-all">
                      <td className="py-4 px-6">
                        <div className="font-bold text-slate-900 dark:text-white leading-snug flex items-center gap-1.5">
                          {u.full_name}
                          {isSelf && (
                            <span className="text-[9px] bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded font-semibold">
                              คุณ
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">{u.email}</div>
                      </td>
                      <td className="py-4 px-6 text-center">
                        {u.role === "admin" ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                            Admin
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700/50">
                            Student
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                            {u.completion_percent}%
                          </span>
                          <span className="text-[10px] text-slate-500">({u.completed_lessons} บท)</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-center font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {u.average_score}%
                      </td>
                      <td className="py-4 px-6 text-center">
                        {u.status === "active" ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            ปกติ
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                            ระงับใช้งาน
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right space-x-2">
                        {isSelf ? (
                          <span className="text-xs text-slate-500 italic">บัญชีปัจจุบัน</span>
                        ) : (
                          <>
                            <button
                              id={`toggle-role-${u.id}`}
                              onClick={() => handleRoleChange(u.id, u.role)}
                              disabled={actionLoading === u.id}
                              className={`p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-[#0F172A] transition-all cursor-pointer inline-flex items-center justify-center ${u.role === "admin" ? "text-amber-500 dark:text-amber-400 hover:text-amber-600" : "text-indigo-600 dark:text-indigo-400 hover:text-indigo-700"}`}
                              title={u.role === "admin" ? "ลดสิทธิ์เป็นสมาชิก" : "แต่งตั้งเป็นแอดมิน"}
                            >
                              {u.role === "admin" ? <ShieldAlert size={14} /> : <ShieldCheck size={14} />}
                            </button>

                            <button
                              id={`toggle-status-${u.id}`}
                              onClick={() => handleStatusChange(u.id, u.status)}
                              disabled={actionLoading === u.id}
                              className={`p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-[#0F172A] transition-all cursor-pointer inline-flex items-center justify-center ${u.status === "suspended" ? "text-emerald-600 dark:text-emerald-400 hover:text-emerald-700" : "text-rose-500 dark:text-rose-400 hover:text-rose-600"}`}
                              title={u.status === "suspended" ? "กู้คืนสิทธิ์บัญชี" : "ระงับสิทธิ์บัญชี"}
                            >
                              {u.status === "suspended" ? <UserCheck size={14} /> : <UserMinus size={14} />}
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
