import mongoose, { Schema, Document, Model } from "mongoose";

/**
 * Durable rate-limit counter backed by MongoDB.
 *
 * Used for auth-sensitive routes (login, register, OTP, password reset) where
 * an in-memory counter is useless on serverless/multi-instance deployments —
 * every cold start would reset the window and brute-force protection with it.
 *
 * High-frequency API routes keep the in-memory limiter (see lib/rate-limit.ts);
 * one Mongo write per auth attempt is cheap, one per ordinary API call is not.
 */
export interface IRateLimit extends Document {
  key: string;
  count: number;
  resetAt: Date;
}

const rateLimitSchema = new Schema<IRateLimit>({
  key: { type: String, required: true, unique: true },
  count: { type: Number, default: 0 },
  resetAt: { type: Date, required: true },
});

// TTL index — MongoDB deletes expired windows automatically
rateLimitSchema.index({ resetAt: 1 }, { expireAfterSeconds: 0 });

const RateLimit: Model<IRateLimit> =
  mongoose.models.RateLimit || mongoose.model<IRateLimit>("RateLimit", rateLimitSchema);

export default RateLimit;
