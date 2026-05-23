import mongoose from 'mongoose';
import { DEFAULT_MONTHLY_QUOTA } from '../config.js';

const ProviderSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  monthlyQuota: {
    type: Number,
    default: DEFAULT_MONTHLY_QUOTA,
  },
  leadsReceived: {
    type: Number,
    default: 0,
  },
  quotaResetMonth: {
    type: String,
    default: () => {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    },
  },
}, {
  timestamps: true,
});

export default mongoose.models.Provider || mongoose.model('Provider', ProviderSchema);
