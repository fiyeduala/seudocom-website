/*
 * Careers content. Edit this file to change the careers and assessment pages; no HTML changes are needed.
 *
 * ADD A POSITION: copy an entry in "jobs" and give it a unique lowercase "id".
 * REMOVE A POSITION: delete its entry. With no entries, the page shows an empty-state message.
 * ASSESSMENT: each position has its own "assignments" and "questions". Each item gets its own Google Drive link field.
 * INTERVIEW: "interviewQuestions" is the separate recorded interview, opened only after the identity check.
 */
window.SEUDOCOM_CAREERS = {
  jobs: [
    {
      id: 'customer-support-personnel',
      title: 'Customer Support Personnel',
      pay: '$40 per hour',
      location: 'Remote',
      employmentType: 'Full-time',
      category: 'Customer Support',
      summary: 'Be the first point of contact for clients: answer inquiries, keep requests moving and make sure people know where things stand.',
      overview: 'Customer Support Personnel help clients get clear answers about their requests and keep each request moving until it is resolved, passing issues to the right colleagues when needed.',
      responsibilities: [
        'Respond to client inquiries clearly and courteously',
        'Record each request and keep clients updated on its progress',
        'Work through basic issues and escalate those that need specialist attention',
        'Follow up to confirm that issues have been resolved'
      ],
      requirements: [
        'Strong written and spoken communication',
        'Patience and professionalism with frustrated clients',
        'Organized, with attention to detail',
        'Comfortable using computers and learning new tools'
      ],
      assignments: [
        { type: 'Assignment', title: 'Client update email', text: 'A client\'s scheduled work has been delayed by three days because of bad weather. Write the email you would send them. Explain the delay, apologize where appropriate and set out what happens next.' },
        { type: 'Activity', title: 'Plain-language guide', text: 'Write a short step-by-step guide that helps a non-technical person restart their router and check whether their connection has returned. Keep it to one page.' },
        { type: 'Test', title: 'Prioritize the queue', text: 'Five requests arrive at once: (A) a business reports that its whole office is offline, (B) a client asks for a copy of an old document, (C) a client complains about a late reply, (D) a client reports intermittent slow speeds, (E) a client wants to reschedule next month\'s visit. Put them in the order you would handle them and give one sentence of reasoning for each.' }
      ],
      questions: [
        'Introduce yourself. What customer support experience do you have, and why does this role interest you?',
        'A client calls, angry that a network problem has disrupted their business for two days. Show us how you would respond in the first minute.',
        'Explain what "bandwidth" means, as you would to a client with no technical background.',
        'A client asks something you don\'t know the answer to. What do you do?',
        'Tell us about a time you turned an unhappy customer around. What did you do, and what happened?',
        'You have several open requests and a new urgent one arrives. How do you decide what to do first and keep everyone informed?'
      ],
      interviewQuestions: [
        'Please state your full name and the position you applied for, then tell us what you learned from your customer support training or certificate.',
        'A client insists you promised something that your records do not show. Role-play how you would respond.',
        'A client shares a password with you in a support chat. What do you do, and why?',
        'Our clients may be in other time zones. Describe your remote work setup and how you would stay reliable on a full-time schedule.',
        'What does excellent customer support mean to you? Give one example from your own experience.'
      ]
    },
    {
      id: 'customer-support-manager',
      title: 'Customer Support Manager',
      pay: '$60 per hour',
      location: 'Remote',
      employmentType: 'Full-time',
      category: 'Customer Support',
      summary: 'Lead customer support: set up how the team works, handle escalations and keep service standards consistent.',
      overview: 'The Customer Support Manager leads the support function, including its processes, its people and the quality of its service, and is the point of escalation for complex or sensitive client issues.',
      responsibilities: [
        'Lead, coach and schedule the customer support team',
        'Create and improve support processes and service standards',
        'Handle escalated client issues through to resolution',
        'Track support performance and report on trends and improvements'
      ],
      requirements: [
        'Experience leading or supervising a customer support team',
        'Strong communication and conflict-resolution skills',
        'Ability to build processes and use data to improve them',
        'Calm, sound judgment under pressure'
      ],
      assignments: [
        { type: 'Assignment', title: 'Escalation process', text: 'Design a one-page escalation process for a small support team at a telecommunications company. Show who handles what, when an issue moves up and how the client is kept informed.' },
        { type: 'Activity', title: 'Coach through a weak reply', text: 'A team member sent this to a client: "We got your complaint. The team is busy so you will have to wait." Rewrite the reply, then write the feedback you would give the team member.' },
        { type: 'Test', title: '90-day plan', text: 'You are asked to set up customer support at a young company with no existing process. Write your plan for the first 90 days, including your priorities and the measures you would use to judge progress.' }
      ],
      questions: [
        'Introduce yourself. What is your experience leading customer support teams, and why does this role interest you?',
        'How would you build a support function at a young company with little process in place?',
        'A major client threatens to leave after repeated service problems. Walk us through what you would do in the first 24 hours.',
        'One of your team members is consistently underperforming. How do you handle it?',
        'Which support measures do you rely on most, and how have you used them to improve a team\'s results?',
        'Tell us about a difficult decision you made as a manager. What did you decide, and what did you learn?'
      ],
      interviewQuestions: [
        'Please state your full name and the position you applied for, then tell us what you learned from your customer support training or certificate.',
        'Two team members give a client conflicting answers and the client complains to you. Walk us through how you resolve it.',
        'How would you keep a remote support team across different time zones motivated and accountable?',
        'A team member shares client information in the wrong place. What do you do in the first hour, and what do you change afterward?',
        'What would you want your team to achieve in your first six months, and how would you show that progress?'
      ]
    }
  ],

  // The steps shown under "The application process". Reword, add or remove freely.
  process: [
    { title: 'Apply', text: 'Submit your application and resume. You then receive a unique access code. Keep it safe: you need it to view your status. Turn on notifications on your dashboard so you hear about your progress.' },
    { title: 'Assessment', text: 'Complete the assignments and record your answers, then submit your Google Drive links. Seudocom reviews your work and approves or declines it.' },
    { title: 'Certificate', text: 'If approved, upload a customer support or customer relations certificate from any recognized provider. If you do not have one, your dashboard lists options.' },
    { title: 'Identity check and recorded interview', text: 'If approved, confirm your identity on your dashboard. Once it is confirmed, record your answers to the interview questions and submit your Google Drive links.' },
    { title: 'Notarized affidavit', text: 'If your interview is approved, download the Seudocom affidavit, have it notarized by any licensed notary, and upload the signed copy to your dashboard.' },
    { title: 'Decision', text: 'Seudocom makes its recruitment decision. Your dashboard shows each decision. If you are hired, you are also told by email.' }
  ]
};
