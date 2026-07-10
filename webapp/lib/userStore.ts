import crypto from "crypto";
import { deleteJson, listJson, readJson, writeJson } from "@/lib/jsonStore";

export type UserRole = "admin" | "teacher" | "student";

export type User = {
  userId: string;
  name: string;
  role: UserRole;
  passwordHash: string;
  createdAt: string;
  lastLoginAt: string;
  studentIds?: string[]; // teacher 管理的 studentId 列表
  isDemo?: boolean;
};

const PBKDF2_ITERATIONS = 120_000;
const PBKDF2_KEYLEN = 32;
const PBKDF2_DIGEST = "sha256";

function legacyHash(pw: string): string {
  return Buffer.from(pw + "ai-coach-salt").toString("base64");
}

function hash(pw: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.pbkdf2Sync(pw, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST).toString("hex");
  return `pbkdf2$${PBKDF2_ITERATIONS}$${salt}$${derived}`;
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

function verifyPassword(password: string, stored: string): { ok: boolean; needsUpgrade: boolean } {
  if (stored.startsWith("pbkdf2$")) {
    const [, iterationsRaw, salt, expected] = stored.split("$");
    const iterations = parseInt(iterationsRaw, 10);
    if (!iterations || !salt || !expected) return { ok: false, needsUpgrade: false };
    const actual = crypto.pbkdf2Sync(password, salt, iterations, PBKDF2_KEYLEN, PBKDF2_DIGEST).toString("hex");
    return { ok: safeEqual(actual, expected), needsUpgrade: iterations < PBKDF2_ITERATIONS };
  }
  const ok = safeEqual(legacyHash(password), stored);
  return { ok, needsUpgrade: ok };
}

const userKey = (userId: string) => `users/${userId}.json`;
const readUser = (userId: string) => readJson<User>(userKey(userId));
const writeUser = (user: User) => writeJson(userKey(user.userId), user);
const userIndexKey = "indexes/users.json";

type UserIndexEntry = {
  userId: string;
  name: string;
  role: UserRole;
  isDemo?: boolean;
};

type UserIndex = {
  updatedAt: string;
  users: UserIndexEntry[];
};

const userIndexLocks = new Map<string, Promise<void>>();

async function withUserIndexLock<T>(task: () => Promise<T>): Promise<T> {
  const key = "users";
  const previous = userIndexLocks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => { release = resolve; });
  userIndexLocks.set(key, previous.then(() => current, () => current));
  await previous.catch(() => {});
  try {
    return await task();
  } finally {
    release();
    if (userIndexLocks.get(key) === current) userIndexLocks.delete(key);
  }
}

function userToIndexEntry(user: User): UserIndexEntry {
  return { userId: user.userId, name: user.name, role: user.role, isDemo: user.isDemo };
}

function persistUserInBackground(user: User): void {
  void writeUser(user)
    .then(() => upsertUserIndex(user))
    .catch((error) => console.warn("[userStore] background user persist failed:", error));
}

async function rebuildUserIndex(): Promise<UserIndex> {
  const users = (await listJson<User>("users/")).filter((u) => u?.userId && u?.passwordHash);
  const index: UserIndex = {
    updatedAt: new Date().toISOString(),
    users: users.map(userToIndexEntry),
  };
  await writeJson(userIndexKey, index);
  return index;
}

async function readUserIndex(): Promise<UserIndex> {
  const existing = await readJson<UserIndex>(userIndexKey);
  if (existing?.users && Array.isArray(existing.users)) return existing;
  return rebuildUserIndex();
}

async function upsertUserIndex(user: User): Promise<void> {
  const index = await readUserIndex();
  const entry = userToIndexEntry(user);
  const idx = index.users.findIndex((u) => u.userId === user.userId);
  if (idx >= 0) index.users[idx] = entry;
  else index.users.push(entry);
  index.updatedAt = new Date().toISOString();
  await writeJson(userIndexKey, index);
}

async function removeUserFromIndex(userId: string): Promise<void> {
  const index = await readUserIndex();
  index.users = index.users.filter((u) => u.userId !== userId);
  index.updatedAt = new Date().toISOString();
  await writeJson(userIndexKey, index);
}

async function listAllUsers(): Promise<User[]> {
  const index = await readUserIndex();
  const users: User[] = [];
  let stale = false;
  for (const entry of index.users) {
    const user = await readUser(entry.userId);
    if (user) users.push(user);
    else stale = true;
  }
  if (stale) {
    await writeJson(userIndexKey, {
      updatedAt: new Date().toISOString(),
      users: users.map(userToIndexEntry),
    } satisfies UserIndex);
  }
  return users;
}

async function findUserByName(name: string): Promise<User | null> {
  const index = await readUserIndex();
  const matches = index.users.filter((u) => u.name === name);
  for (const entry of matches) {
    const user = await readUser(entry.userId);
    if (user?.name === name) return user;
  }
  if (matches.length > 0) await rebuildUserIndex();
  return null;
}

// ---- API ----

export async function createUser(name: string, role: UserRole, password: string): Promise<User> {
  return withUserIndexLock(async () => {
    if (await findUserByName(name)) throw new Error("用户名已存在");
    const userId = role + "_" + Math.random().toString(36).slice(2, 8);
    const user: User = { userId, name, role, passwordHash: hash(password), createdAt: new Date().toISOString(), lastLoginAt: "" };
    await writeUser(user);
    await upsertUserIndex(user);
    return user;
  });
}

export async function createDemoUser(name: string, password: string): Promise<User> {
  return withUserIndexLock(async () => {
    if (await findUserByName(name)) throw new Error("用户名已存在");
    const existingDemo = await readUser("student_champion_demo");
    if (existingDemo) throw new Error("演示帐号已存在，如需重建请先删除当前演示帐号");
    const user: User = {
      userId: "student_champion_demo",
      name,
      role: "student",
      passwordHash: hash(password),
      createdAt: new Date().toISOString(),
      lastLoginAt: "",
      isDemo: true,
    };
    await writeUser(user);
    await upsertUserIndex(user);
    return user;
  });
}

export async function login(name: string, password: string): Promise<User | null> {
  const user = await findUserByName(name);
  if (user) {
    const check = verifyPassword(password, user.passwordHash);
    if (!check.ok) return null;
    if (check.needsUpgrade) user.passwordHash = hash(password);
    user.lastLoginAt = new Date().toISOString();
    persistUserInBackground(user);
    return user;
  }
  // 八冠王演示账号：兼容旧入口；若管理员已显式创建演示帐号，则不再覆盖其密码
  if (name === "\u516b\u51a0\u738b" && password === "champion") {
    const userId = "student_champion_demo";
    const existing = await readUser(userId);
    if (existing) {
      const check = verifyPassword(password, existing.passwordHash);
      if (!check.ok && existing.isDemo) {
        existing.passwordHash = hash("champion");
      } else if (!check.ok) {
        return null;
      } else if (check.needsUpgrade) {
        existing.passwordHash = hash(password);
      }
      existing.name = "\u516b\u51a0\u738b";
      existing.role = "student";
      existing.isDemo = true;
      existing.lastLoginAt = new Date().toISOString();
      await writeUser(existing);
      await upsertUserIndex(existing);
      return existing;
    }
    const champion: User = {
      userId,
      name: "\u516b\u51a0\u738b",
      role: "student",
      passwordHash: hash("champion"),
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      isDemo: true,
    };
    await writeUser(champion);
    await upsertUserIndex(champion);
    return champion;
  }
  return null;
}

export async function getAllUsers(): Promise<User[]> {
  return (await listAllUsers()).map(({ passwordHash, ...u }) => u as User);
}

export async function getUser(userId: string): Promise<User | null> {
  const user = await readUser(userId);
  if (!user) return null;
  const { passwordHash, ...safe } = user;
  return safe as User;
}

export async function getUsersByRole(role: UserRole): Promise<User[]> {
  return (await getAllUsers()).filter((u) => u.role === role);
}

export async function deleteUser(userId: string): Promise<void> {
  await withUserIndexLock(async () => {
    await deleteJson(userKey(userId));
    await removeUserFromIndex(userId);
  });
}

export async function assignStudentToTeacher(teacherId: string, studentId: string): Promise<User> {
  const user = await readUser(teacherId);
  if (!user || user.role !== "teacher") throw new Error("不是教师账号");
  if (!user.studentIds) user.studentIds = [];
  if (!user.studentIds.includes(studentId)) user.studentIds.push(studentId);
  await writeUser(user);
  await upsertUserIndex(user);
  return user;
}

export async function unassignStudentFromTeacher(teacherId: string, studentId: string): Promise<User> {
  const user = await readUser(teacherId);
  if (!user || user.role !== "teacher") throw new Error("不是教师账号");
  user.studentIds = (user.studentIds ?? []).filter((id) => id !== studentId);
  await writeUser(user);
  await upsertUserIndex(user);
  return user;
}

export function verifyAdmin(password: string): boolean {
  const adminPw = process.env.ADMIN_PASSWORD || "admin123";
  return password === adminPw;
}

export function isUsingDefaultAdminPassword(): boolean {
  return !process.env.ADMIN_PASSWORD;
}

export async function recordAdminLogin(password: string): Promise<void> {
  const admin = (await listAllUsers()).find((u) => u.role === "admin");
  if (!admin) return;
  const check = verifyPassword(password, admin.passwordHash);
  if (check.needsUpgrade || !check.ok) {
    admin.passwordHash = hash(password);
  }
  admin.lastLoginAt = new Date().toISOString();
  await writeUser(admin);
  await upsertUserIndex(admin);
}

export async function verifyTeacher(userId: string): Promise<boolean> {
  const user = await readUser(userId);
  return user?.role === "teacher";
}

/** 初始化默认管理员（首次调用时创建） */
export async function ensureAdmin() {
  const users = await listAllUsers();
  if (!users.find((u) => u.role === "admin")) {
    await createUser("admin", "admin", process.env.ADMIN_PASSWORD || "admin123");
  }
}
