
import { Thread, Bucket } from './types';

const now = new Date();
const subtractDays = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000).toISOString();
const subtractHours = (h: number) => new Date(now.getTime() - h * 60 * 60 * 1000).toISOString();

export const MOCK_THREADS: Thread[] = [
  {
    id: 't1',
    fromName: 'Marcus Aurelius',
    fromEmail: 'm.aurelius@design.com',
    subject: 'Material Approval for Westside Plaza',
    project: 'Westside Plaza',
    actionPhrase: 'Pricing sign-off needed',
    contextTag: 'Architect',
    projectStatus: 'Installation',
    snippet: 'Sawyer, we need your final sign-off on the textured resin samples...',
    unread: true,
    priority: 'High',
    bucket: Bucket.PROJECTS,
    messages: [
      {
        id: 'm1_1',
        sender: 'Marcus Aurelius',
        senderEmail: 'm.aurelius@design.com',
        content: "Hi Sawyer, hope you're having a good week. We're finalizing the material pallet for Westside.",
        timestamp: subtractDays(2)
      },
      {
        id: 'm1_2',
        sender: 'Sawyer (You)',
        senderEmail: 'sawyer@mrwalls.com',
        content: "Thanks Marcus. I'll take a look at the resin samples by EOD.",
        timestamp: subtractDays(1)
      },
      {
        id: 'm1_3',
        sender: 'Marcus Aurelius',
        senderEmail: 'm.aurelius@design.com',
        content: "Sawyer, we need your final sign-off on the textured resin samples by EOD. Can you confirm if Ref: LM-04 is the right choice?",
        timestamp: subtractHours(4)
      }
    ],
    suggestedDraft: "Approved. Proceed with Ref: LM-04.",
    labels: ['Design', 'Approval'],
    lastInboundAt: subtractHours(4),
    lastOutboundAt: subtractDays(2),
    awaitingSawyerReply: true,
    daysUnresponded: 0,
    followUpAt: null,
    hasAttachments: true,
    answeredQuestionIds: []
  },
  {
    id: 't2',
    fromName: 'Sarah Higgins',
    fromEmail: 's.higgins@residential.com',
    subject: 'Gate code issues',
    project: 'Pacific Heights',
    actionPhrase: 'Installer blocked',
    contextTag: 'Client',
    projectStatus: 'Support',
    snippet: 'Hey Sawyer, the crew is sitting in the driveway and the code isn\'t working...',
    unread: true,
    priority: 'High',
    bucket: Bucket.PROJECTS,
    messages: [
      {
        id: 'm2_1',
        sender: 'Sarah Higgins',
        senderEmail: 's.higgins@residential.com',
        content: "Hey Sawyer, the crew is sitting in the driveway and the code isn't working. Do you have the new entry code handy?",
        timestamp: subtractDays(5)
      }
    ],
    suggestedDraft: "Code is 4492.",
    labels: ['Urgent', 'Access'],
    lastInboundAt: subtractDays(5),
    lastOutboundAt: subtractDays(6),
    awaitingSawyerReply: true,
    daysUnresponded: 5,
    followUpAt: subtractDays(-1),
    answeredQuestionIds: []
  },
  {
    id: 't3',
    fromName: 'Devon Port',
    fromEmail: 'd.port@supply.io',
    subject: 'Liquid Marble Order #882',
    project: 'Liquid Marble',
    contextTag: 'Internal',
    projectStatus: 'Shipping',
    snippet: 'Cleared customs, expected Wednesday.',
    unread: false,
    priority: 'Normal',
    bucket: Bucket.PROJECTS,
    messages: [
      {
        id: 'm3_1',
        sender: 'Devon Port',
        senderEmail: 'd.port@supply.io',
        content: "Sawyer, just letting you know the marble cleared customs. What do you think about the lead time for the next batch?",
        timestamp: subtractDays(2)
      }
    ],
    labels: ['Logistics'],
    lastInboundAt: subtractDays(2),
    lastOutboundAt: subtractDays(2.1),
    awaitingSawyerReply: true,
    daysUnresponded: 2,
    followUpAt: null,
    answeredQuestionIds: []
  },
  {
    id: 't7',
    fromName: 'New Architect',
    fromEmail: 'j.arch@studio.com',
    subject: 'Pricing for Westside project',
    project: 'Unassigned',
    contextTag: 'Lead',
    snippet: 'Hey Sawyer, can you send over a quote for the new lobby project?',
    unread: true,
    priority: 'Normal',
    bucket: Bucket.UNASSIGNED,
    messages: [
      {
        id: 'm7_1',
        sender: 'New Architect',
        senderEmail: 'j.arch@studio.com',
        content: "Hi Sawyer, Marcus mentioned your work on the Plaza. Can you send over a quote for the new lobby project? We're waiting on you to finalize the bid.",
        timestamp: subtractHours(2)
      }
    ],
    labels: ['Referral'],
    lastInboundAt: subtractHours(2),
    lastOutboundAt: null,
    awaitingSawyerReply: true,
    daysUnresponded: 0,
    followUpAt: null,
    hasAttachments: false,
    answeredQuestionIds: []
  }
];
