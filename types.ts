
export type Priority = 'High' | 'Normal' | 'Low';

export enum Bucket {
  UNASSIGNED = 'Unassigned',
  SALES = 'Sales',
  PROJECTS = 'Active Projects',
  INTERNAL = 'Internal',
  WAITING = 'Waiting on Others',
  CLEARED = 'Cleared'
}

export type ProjectStatus = 'Installation' | 'Shipping' | 'Support' | 'Change Order';

export type DateRange = 'Today' | '7 Days' | '30 Days' | '60 Days';

export interface MessageAttachment {
  filename: string;
  mimeType?: string;
  size?: number;
  attachmentId?: string;
  inline?: boolean;
}

export interface Message {
  id: string;
  sender: string;
  senderEmail: string;
  content: string;
  timestamp: string;
  subject?: string;
  to?: string;
  cc?: string;
  snippet?: string;
  htmlContent?: string;
  attachments?: MessageAttachment[];
}

export interface RoutingRule {
  senderEmail: string;
  targetBucket: Bucket;
}

export interface Thread {
  id: string;
  fromName: string;
  fromEmail: string;
  fromCompany?: string;
  fromDomain?: string;
  subject: string;
  project: string;
  actionPhrase?: string;
  contextTag: 'Architect' | 'Installer' | 'Client' | 'Internal' | 'Lead';
  projectStatus?: ProjectStatus;
  snippet: string;
  unread: boolean;
  priority: Priority;
  bucket: Bucket;
  messages: Message[];
  suggestedDraft?: string;
  labels: string[];
  reason?: string;
  lastInboundAt: string;
  lastOutboundAt: string | null;
  awaitingSawyerReply: boolean;
  daysUnresponded: number;
  followUpAt: string | null; 
  pinned?: boolean;
  hasAttachments?: boolean;
  answeredQuestionIds?: string[]; // Tracking answered questions for Sawyer
  manuallyCleared?: boolean;
  originalBucket?: Bucket | null;
  lastActionableAt?: string | null;
  daysSinceLastActionable?: number;
}

export type ViewType = 
  | { type: 'DASHBOARD' }
  | { type: 'BUCKET'; bucket: Bucket }
  | { type: 'FOCUS' };

export interface ManualClearedMap {
  [threadId: string]: {
    bucket: Bucket;
  };
}

export interface AppState {
  isAuthenticated: boolean;
  threads: Thread[];
  routingRules: RoutingRule[];
  selectedThreadId: string | null;
  currentView: ViewType;
  isSyncing: boolean;
  lastSyncTime: string;
  searchQuery: string;
  dateRange: DateRange;
  isDraftModalOpen: boolean;
  expandedBuckets: Set<Bucket>;
  darkMode: boolean;
  manualClearedMap: ManualClearedMap;
  detailPanelWidth: number;
  isDetailPanelCollapsed: boolean;
}

export type Action =
  | { type: 'SET_THREADS'; payload: Thread[] }
  | { type: 'SET_THREAD_MESSAGES'; payload: { threadId: string; messages: Message[] } }
  | { type: 'MOVE_THREAD'; payload: { id: string; bucket: Bucket; applyRule?: boolean } }
  | { type: 'SELECT_THREAD'; payload: string | null }
  | { type: 'NAVIGATE'; payload: ViewType }
  | { type: 'SET_SYNCING'; payload: boolean }
  | { type: 'SET_SEARCH'; payload: string }
  | { type: 'SET_DATE_RANGE'; payload: DateRange }
  | { type: 'TOGGLE_DRAFT_MODAL'; payload: boolean }
  | { type: 'TOGGLE_BUCKET_EXPAND'; payload: Bucket }
  | { type: 'ARCHIVE_THREAD'; payload: string }
  | { type: 'SET_FOLLOW_UP'; payload: { id: string; date: string | null } }
  | { type: 'SET_PRIORITY'; payload: { id: string; priority: Priority } }
  | { type: 'TOGGLE_PIN'; payload: string }
  | { type: 'PERFORM_SYNC' }
  | { type: 'ADD_ROUTING_RULE'; payload: RoutingRule }
  | { type: 'TOGGLE_DARK_MODE' }
  | { type: 'LOGIN' }
  | { type: 'LOGOUT' }
  | { type: 'TOGGLE_QUESTION_ANSWERED'; payload: { threadId: string; messageId: string } }
  | { type: 'SET_LAST_SYNC_TIME'; payload: string }
  | { type: 'SET_DETAIL_PANEL_WIDTH'; payload: number }
  | { type: 'SET_DETAIL_PANEL_OPEN'; payload: boolean }
  | { type: 'TOGGLE_DETAIL_PANEL' }
  | { type: 'TOGGLE_MANUAL_CLEAR'; payload: { threadId: string } };



