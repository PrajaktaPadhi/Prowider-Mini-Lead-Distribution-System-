import mongoose from 'mongoose';

const LeadAssignmentSchema = new mongoose.Schema({
  leadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lead',
    required: true,
  },
  providerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Provider',
    required: true,
  },
  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: true,
  },
  assignedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Prevent same provider being assigned the same lead twice
LeadAssignmentSchema.index({ leadId: 1, providerId: 1 }, { unique: true });

export default mongoose.models.LeadAssignment || mongoose.model('LeadAssignment', LeadAssignmentSchema);
