
export interface FacebookPage {
  id: string;
  fb_id: string;
  name: string;
  access_token: string;
  category: string;
  account_id: string;
  health_status?: 'healthy' | 'warning' | 'critical';
  last_post_at?: string;
}

export type AccountGroup = string;

export interface FacebookAccount {
  id: string;
  name: string;
  token: string;
  apiKey?: string;
  isValid: boolean;
  group: AccountGroup;
  status: 'active' | 'expired' | 'rate_limited';
  pages: FacebookPage[];
  created_at?: string;
}

export interface PostImage {
  id: string;
  file: File;
  previewUrl: string;
  description: string;
}

export interface PostVideo {
  id: string;
  file: File;
  previewUrl: string;
  description: string;
}

export interface PageGroup {
  id: string;
  name: string;
  page_ids: string[]; // Array of fb_id
}

export type PostType = 'ALBUM' | 'SINGLE' | 'VIDEO' | 'STORY';

export type QueueStatus = 'pending' | 'processing' | 'done' | 'error';

export interface QueueItem {
  id: string;
  status: QueueStatus;
  label: string; // e.g. "Receitas – SINGLE"
  type: PostType;
  caption: string;
  comments: { text: string; delay: number }[];
  autoReplyText?: string;
  storyLink: string;
  isScheduled: boolean;
  scheduledDate: string;
  useAI: boolean;
  pages: { fb_id: string; name: string; access_token: string; parentToken: string }[];
  media: { id: string; file: File; preview: string; type: 'IMAGE' | 'VIDEO'; description: string }[];
  progress: { current: number; total: number };
  logs: string[];
  createdAt: string;
}

export enum Tab {
  DASHBOARD = 'DASHBOARD',
  GATEWAYS = 'GATEWAYS',
  EDITOR_STEALTH = 'EDITOR_STEALTH',
  LEADS = 'LEADS',
  SEGURANCA = 'SEGURANCA'
}

export interface Lead {
  id: string;
  page_id: string;
  psid: string;
  name: string;
  profile_pic: string;
  last_interaction: string;
  status: 'new' | 'interested' | 'follow_up' | 'converted';
  notes: string;
  created_at: string;
}

export interface Message {
  id: string;
  lead_id: string;
  sender_id: string;
  text: string;
  created_at: string;
}
