import mongoose from 'mongoose';

const LeadSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
    required: true,
  },
  city: {
    type: String,
    required: true,
  },
  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: true,
  },
  description: {
    type: String,
    default: '',
  },
  status: {
    type: String,
    enum: ['pending', 'assigned', 'partial'],
    default: 'pending',
  },
}, {
  timestamps: true,
});

// Database-level duplicate enforcement: same phone + same service is not allowed
LeadSchema.index({ phone: 1, serviceId: 1 }, { unique: true });

export default mongoose.models.Lead || mongoose.model('Lead', LeadSchema);
