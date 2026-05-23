import mongoose from 'mongoose';

const RoundRobinStateSchema = new mongoose.Schema({
  serviceSlug: {
    type: String,
    required: true,
    unique: true,
  },
  nextIndex: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

export default mongoose.models.RoundRobinState || mongoose.model('RoundRobinState', RoundRobinStateSchema);
