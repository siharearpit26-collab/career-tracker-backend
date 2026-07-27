import mongoose, { Schema } from 'mongoose';
import { ICompanyDocument } from '../types';

const companySchema = new Schema<ICompanyDocument>(
  {
    name: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
      maxlength: [200, 'Company name cannot exceed 200 characters'],
    },
    website: {
      type: String,
      trim: true,
    },
    industry: {
      type: String,
      trim: true,
      maxlength: [100, 'Industry cannot exceed 100 characters'],
    },
    size: {
      type: String,
      enum: ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'],
    },
    location: {
      type: String,
      trim: true,
      maxlength: [200, 'Location cannot exceed 200 characters'],
    },
    logoUrl: { type: String },
    description: {
      type: String,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    notes: {
      type: String,
      maxlength: [5000, 'Notes cannot exceed 5000 characters'],
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        const record = ret as Record<string, unknown>;
        record['id'] = record['_id'];
        delete record['_id'];
        delete record['__v'];
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

companySchema.index({ userId: 1, name: 1 });
companySchema.index({ name: 'text' });

const CompanyModel = mongoose.model<ICompanyDocument>('Company', companySchema);

export default CompanyModel;
