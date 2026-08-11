import mongoose, { Schema } from 'mongoose';
import { ISavedJobDocument } from '../types';

const savedJobSchema = new Schema<ISavedJobDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    jobId: { type: Schema.Types.ObjectId, ref: 'Job', required: true },
    savedAt: { type: Date, default: Date.now },
    notes: { type: String, maxlength: 500 },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        const r = ret as Record<string, unknown>;
        r['id'] = r['_id'];
        delete r['_id'];
        delete r['__v'];
        return ret;
      },
    },
  }
);

savedJobSchema.index({ userId: 1, jobId: 1 }, { unique: true });

export default mongoose.model<ISavedJobDocument>('SavedJob', savedJobSchema);
