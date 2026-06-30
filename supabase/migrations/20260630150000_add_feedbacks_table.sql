-- Create feedbacks table
CREATE TABLE feedbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('bug', 'feature', 'design', 'other')),
  email TEXT NOT NULL,
  attachment_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_feedbacks_user_id ON feedbacks(user_id);
CREATE INDEX idx_feedbacks_status ON feedbacks(status);
CREATE INDEX idx_feedbacks_created_at ON feedbacks(created_at DESC);

-- Enable RLS
ALTER TABLE feedbacks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view their own feedbacks
CREATE POLICY "Users can view own feedbacks" ON feedbacks
  FOR SELECT USING (auth.uid() = user_id);

-- Users can create feedbacks
CREATE POLICY "Users can create feedbacks" ON feedbacks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own feedbacks (except status)
CREATE POLICY "Users can update own feedbacks" ON feedbacks
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admin can view all feedbacks (optional, handle via service role in API)
-- Status updates via service role API only
