export interface MockEmail {
  id: string;
  sender: string;
  senderEmail: string;
  subject: string;
  snippet: string;
  body: string;
  timestamp: string;
  unread: boolean;
}

export interface ScheduledEmail {
  id: string;
  recipient: string;
  subject: string;
  scheduledTime: string;
  status: 'scheduled' | 'sent' | 'cancelled';
}

export const mockInboxEmails: MockEmail[] = [
  {
    id: '1',
    sender: 'Sarah Chen',
    senderEmail: 'sarah.chen@acme.co',
    subject: 'Q3 Project Timeline Update',
    snippet: 'Hi, I wanted to follow up on the project timeline we discussed last week...',
    body: 'Hi,\n\nI wanted to follow up on the project timeline we discussed last week. The design team has completed the initial mockups and we\'re ready to move into development.\n\nCan we schedule a meeting this Thursday to go over the milestones?\n\nBest regards,\nSarah Chen',
    timestamp: '2026-03-10T09:30:00Z',
    unread: true,
  },
  {
    id: '2',
    sender: 'Michael Torres',
    senderEmail: 'michael.t@globex.com',
    subject: 'Partnership Proposal - GlobEx',
    snippet: 'Dear team, I\'m reaching out regarding a potential partnership opportunity...',
    body: 'Dear team,\n\nI\'m reaching out regarding a potential partnership opportunity between our organizations. GlobEx has been expanding its research division and we believe there could be strong synergies.\n\nWould you be available for a brief call next week?\n\nRegards,\nMichael Torres\nBusiness Development, GlobEx',
    timestamp: '2026-03-10T08:15:00Z',
    unread: true,
  },
  {
    id: '3',
    sender: 'Priya Patel',
    senderEmail: 'priya@startup.io',
    subject: 'Re: Invoice #4821',
    snippet: 'Thanks for sending that over. I\'ve reviewed the invoice and everything looks...',
    body: 'Thanks for sending that over. I\'ve reviewed the invoice and everything looks correct.\n\nI\'ve forwarded it to our finance team for processing. You should expect payment within 30 days.\n\nLet me know if you have any questions.\n\nBest,\nPriya',
    timestamp: '2026-03-09T16:45:00Z',
    unread: false,
  },
  {
    id: '4',
    sender: 'DevOps Alerts',
    senderEmail: 'alerts@monitoring.internal',
    subject: 'Server CPU Usage Alert - Production',
    snippet: 'Alert: CPU usage on prod-web-03 has exceeded 85% threshold for the past...',
    body: 'Alert: CPU usage on prod-web-03 has exceeded 85% threshold for the past 15 minutes.\n\nCurrent usage: 92%\nThreshold: 85%\nDuration: 15 minutes\n\nPlease investigate and take necessary action.',
    timestamp: '2026-03-09T14:20:00Z',
    unread: false,
  },
  {
    id: '5',
    sender: 'James Wilson',
    senderEmail: 'j.wilson@university.edu',
    subject: 'Conference Presentation Slides',
    snippet: 'Hi! Attached are the final slides for our presentation at the ICML conference...',
    body: 'Hi!\n\nAttached are the final slides for our presentation at the ICML conference next month. I\'ve incorporated all the feedback from our last review session.\n\nPlease take a look and let me know if you\'d like any changes.\n\nCheers,\nJames',
    timestamp: '2026-03-08T11:00:00Z',
    unread: false,
  },
];

export const mockScheduledEmails: ScheduledEmail[] = [
  {
    id: 's1',
    recipient: 'sarah.chen@acme.co',
    subject: 'Follow-up: Q3 Timeline',
    scheduledTime: '2026-03-11T09:00:00Z',
    status: 'scheduled',
  },
  {
    id: 's2',
    recipient: 'team@company.com',
    subject: 'Weekly Status Report',
    scheduledTime: '2026-03-10T08:00:00Z',
    status: 'sent',
  },
];

export function generateMockDraft(topic: string, tone: string, iteration: number) {
  const toneMap: Record<string, { greeting: string; closing: string; style: string }> = {
    Professional: { greeting: 'Dear', closing: 'Best regards', style: 'formal and structured' },
    Friendly: { greeting: 'Hey', closing: 'Cheers', style: 'warm and approachable' },
    Casual: { greeting: 'Hi', closing: 'Talk soon', style: 'relaxed and conversational' },
    Formal: { greeting: 'Dear Sir/Madam', closing: 'Yours sincerely', style: 'very formal and respectful' },
    Concise: { greeting: 'Hi', closing: 'Thanks', style: 'brief and to the point' },
  };

  const t = toneMap[tone] || toneMap.Professional;
  const subject = `Re: ${topic.slice(0, 50)}${topic.length > 50 ? '...' : ''}`;

  const body = `${t.greeting},

I wanted to reach out regarding ${topic.toLowerCase()}.

${iteration > 1 ? `[Revised draft #${iteration} — incorporated your feedback]\n\n` : ''}I believe this is an important matter that deserves prompt attention. I've reviewed the relevant details and would like to propose we move forward with a structured approach.

Please let me know your thoughts on this, and I'm happy to discuss further at your convenience.

${t.closing}`;

  return { subject, body, iteration };
}
