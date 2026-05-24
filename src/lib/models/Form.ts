import mongoose, { Schema, Document, Model } from "mongoose";

// ─── Sub-schema ───────────────────────────────────────────

export interface IFormField {
  fieldId: string;
  type: "TEXT" | "TEXTAREA" | "RADIO" | "CHECKBOX" | "NUMBER" | "URL" | "DATE";
  label: string;
  required: boolean;
  placeholder: string;
  options: string[];
  correctAnswers: string[];
  isAutoScored: boolean;
  marks: number;
  order: number;
}

export interface IForm extends Document {
  contestId: mongoose.Types.ObjectId;
  title: string;
  description: string;
  totalMarks: number;
  fields: IFormField[];
  createdBy: mongoose.Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const formFieldSchema = new Schema(
  {
    fieldId: { type: String, required: true },
    type: {
      type: String,
      enum: ["TEXT", "TEXTAREA", "RADIO", "CHECKBOX", "NUMBER", "URL", "DATE"],
      required: true,
    },
    label: { type: String, required: true },
    required: { type: Boolean, default: false },
    placeholder: { type: String, default: "" },
    options: [{ type: String }],
    correctAnswers: [{ type: String }],
    isAutoScored: { type: Boolean, default: false },
    marks: { type: Number, default: 0 },
    order: { type: Number, default: 0 },
  },
  { _id: false }
);

const formSchema = new Schema<IForm>(
  {
    contestId: { type: Schema.Types.ObjectId, ref: "Contest", required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    totalMarks: { type: Number, default: 0 },
    fields: [formFieldSchema],
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Calculate total marks before saving
formSchema.pre("save", function () {
  this.totalMarks = this.fields.reduce((sum, field) => sum + (field.marks || 0), 0);
});

const Form: Model<IForm> =
  mongoose.models.Form || mongoose.model<IForm>("Form", formSchema);

export default Form;
