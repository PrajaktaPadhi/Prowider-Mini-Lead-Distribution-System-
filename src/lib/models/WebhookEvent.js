import mongoose from 'mongoose';

const WebhookEventSchema = new mongoose.Schema({
  idempotencyKey: {
    type: String,
    required: true,
    unique: true,
  },
  action: {
    type: String,
    required: true,
  },
  processedAt: {
    type: Date,
    default: Date.now,
  },
  result: {
    type: mongoose.Schema.Types.Mixed,
  },
}, {
  timestamps: true,
});

export default mongoose.models.WebhookEvent || mongoose.model('WebhookEvent', WebhookEventSchema);
