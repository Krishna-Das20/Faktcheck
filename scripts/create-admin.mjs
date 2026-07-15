/**
 * Admin bootstrap script — creates the first ADMIN user (or promotes an
 * existing user to ADMIN) on a fresh database.
 *
 * Usage:
 *   node scripts/create-admin.mjs <email> [name]
 *
 * Examples:
 *   node scripts/create-admin.mjs admin@example.com "Platform Admin"
 *   ADMIN_PASSWORD=mysecret node scripts/create-admin.mjs admin@example.com
 *
 * - If a user with <email> exists, they are promoted to ADMIN (and verified).
 * - Otherwise a new verified ADMIN account is created. The password comes from
 *   the ADMIN_PASSWORD env var, or a random one is generated and printed ONCE.
 *
 * Reads MONGODB_URI from .env.local / .env in the project root.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

// ── Load env from .env.local / .env (no dotenv dependency) ──────────────────
function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const key = match[1];
    let value = match[2];
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

const root = path.resolve(process.cwd());
loadEnvFile(path.join(root, ".env.local"));
loadEnvFile(path.join(root, ".env"));

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("❌ MONGODB_URI is not set (checked .env.local and .env).");
  process.exit(1);
}

const email = process.argv[2]?.toLowerCase().trim();
const name = process.argv[3] || "Platform Admin";
if (!email || !email.includes("@")) {
  console.error("Usage: node scripts/create-admin.mjs <email> [name]");
  process.exit(1);
}

// Minimal User schema — only the fields this script touches. Using the real
// collection name keeps it compatible with the app's Mongoose models.
const userSchema = new mongoose.Schema(
  {
    name: String,
    email: { type: String, unique: true, lowercase: true, trim: true },
    password: String,
    role: { type: String, enum: ["USER", "ORGANISER", "ADMIN"], default: "USER" },
    isVerified: { type: Boolean, default: false },
    authProvider: { type: String, default: "local" },
  },
  { timestamps: true, strict: false }
);
const User = mongoose.models.User || mongoose.model("User", userSchema);

try {
  await mongoose.connect(MONGODB_URI);
  const dbName = mongoose.connection.name;
  console.log(`Connected to MongoDB (database: "${dbName}")`);
  if (dbName === "test") {
    console.warn(
      '⚠️  You are writing to the default "test" database. For production, use a dedicated database name in MONGODB_URI.'
    );
  }

  const existing = await User.findOne({ email });

  if (existing) {
    if (existing.role === "ADMIN") {
      console.log(`✅ ${email} is already an ADMIN. Nothing to do.`);
    } else {
      existing.role = "ADMIN";
      existing.isVerified = true;
      await existing.save();
      console.log(`✅ Promoted existing user ${email} to ADMIN.`);
    }
  } else {
    const password =
      process.env.ADMIN_PASSWORD || crypto.randomBytes(9).toString("base64url");
    const hashed = await bcrypt.hash(password, 12);

    await User.create({
      name,
      email,
      password: hashed,
      role: "ADMIN",
      isVerified: true,
      authProvider: "local",
    });

    console.log(`✅ Created ADMIN account: ${email}`);
    if (!process.env.ADMIN_PASSWORD) {
      console.log(`   Generated password (shown once, change it after login): ${password}`);
    }
  }
} catch (err) {
  console.error("❌ Failed:", err.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
