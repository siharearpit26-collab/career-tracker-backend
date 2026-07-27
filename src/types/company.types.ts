import { Document, Types } from 'mongoose';

export interface ICompany {
  name: string;
  website?: string;
  industry?: string;
  size?: string;
  location?: string;
  logoUrl?: string;
  description?: string;
  notes?: string;
  userId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICompanyDocument extends ICompany, Document {
  _id: Types.ObjectId;
}

export interface CreateCompanyDTO {
  name: string;
  website?: string;
  industry?: string;
  size?: string;
  location?: string;
  logoUrl?: string;
  description?: string;
  notes?: string;
}

export interface UpdateCompanyDTO extends Partial<CreateCompanyDTO> {}
