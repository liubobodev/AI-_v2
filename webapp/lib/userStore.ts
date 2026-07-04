import fs from "fs";
import path from "path";

const DATA_DIR = process.env.VERCEL
  ? path.join("/tmp", "ai-coach-users")
  : path.join(process.cwd(), "data", "users");

export type UserRole = "admin" | "teacher" | "student";

export type User = {
  userId: string;
  name: string;
  role: UserRole;
  passwordHash: string;
  createdAt: string;
  lastLoginAt: string;
  studentIds?: string[]; // teacher 管理的 studentId 列表
};

// ---- 简易密码哈希（非生产级，训练营够用）----
function hash(pw: string): string {
  return Buffer.from(pw + "ai-coach-salt").toString("base64");
}

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function userPath(userId: string) { return path.join(DATA_DIR, `${userId}.json`); }

function readUser(userId: string): User | null {
  try { return JSON.parse(fs.readFileSync(userPath(userId), "utf-8")) as User; }
  catch { return null; }
}

function writeUser(user: User) { ensureDir(); fs.writeFileSync(userPath(user.userId), JSON.stringify(user, null, 2), "utf-8"); }

function listAllUsers(): User[] {
  ensureDir();
  return fs.readdirSync(DATA_DIR).filter((f) => f.endsWith(".json")).map((f) => {
    try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), "utf-8")) as User; }
    catch { return null; }
  }).filter(Boolean) as User[];
}

// ---- API ----

export function createUser(name: string, role: UserRole, password: string): User {
  if (listAllUsers().find((u) => u.name === name)) throw new Error("用户名已存在");
  const userId = role + "_" + Math.random().toString(36).slice(2, 8);
  const user: User = { userId, name, role, passwordHash: hash(password), createdAt: new Date().toISOString(), lastLoginAt: "" };
  writeUser(user);
  return user;
}

export function login(name: string, password: string): User | null {
  const users = listAllUsers();
  const user = users.find((u) => u.name === name && u.passwordHash === hash(password));
  if (user) {
    user.lastLoginAt = new Date().toISOString();
    writeUser(user);
    return user;
  }
  return null;
}

export function getAllUsers(): User[] {
  return listAllUsers().map(({ passwordHash, ...u }) => u as User);
}

export function getUsersByRole(role: UserRole): User[] {
  return getAllUsers().filter((u) => u.role === role);
}

export function deleteUser(userId: string): void {
  const p = userPath(userId);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

export function assignStudentToTeacher(teacherId: string, studentId: string): User {
  const user = readUser(teacherId);
  if (!user || user.role !== "teacher") throw new Error("不是教师账号");
  if (!user.studentIds) user.studentIds = [];
  if (!user.studentIds.includes(studentId)) user.studentIds.push(studentId);
  writeUser(user);
  return user;
}

export function verifyAdmin(password: string): boolean {
  const adminPw = process.env.ADMIN_PASSWORD || "admin123";
  return password === adminPw;
}

export function verifyTeacher(userId: string): boolean {
  const user = readUser(userId);
  return user?.role === "teacher";
}

/** 初始化默认管理员（首次调用时创建） */
export function ensureAdmin() {
  const users = listAllUsers();
  if (!users.find((u) => u.role === "admin")) {
    createUser("admin", "admin", process.env.ADMIN_PASSWORD || "admin123");
  }
}

// 启动时自动初始化
ensureAdmin();
