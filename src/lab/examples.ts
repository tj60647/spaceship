export type Example = {
  title: string
  input: string
  question: string
  type: "score" | "noul"
  criteria: string[]
  answer: number
  explanation: string
  next: string
}
export const examples: Record<string, Example> = {
  relevance: {
    title: "Spaceship · find a relevant detail",
    input:
      'TIP (the sentence being written now)\nThe pilot followed the faint signal to the sealed door.\n\nKEYWORDS\n[1] signal (in "A faint signal pulses behind the sealed door.")',
    question: 'How relevant is keyword [1] "signal" to the TIP?',
    type: "score",
    criteria: [
      "Not relevant",
      "Weak: shares the setting or a passing detail",
      "Moderate: bears on what the tip is about",
      "Strong: the tip is about it, or turns on it",
    ],
    answer: 3,
    explanation:
      "The signal directly motivates the pilot’s action. An app could use a high relevance score to highlight this detail while you write. This uses the original relevance question and rubric with a new teaching passage.",
    next: "Replace the TIP with ‘The pilot polished a boot.’ Keep the keyword and question fixed. Would you expect relevance to fall?",
  },
  instruction: {
    title: "Writing · check an instruction",
    input: "CANDIDATE SENTENCE\nThe pilot checked the empty corridor twice before opening the door.\n\nWRITING INSTRUCTION\nShow the pilot acting cautiously.",
    question: "Does the candidate sentence show the pilot acting cautiously?",
    type: "noul",
    criteria: [],
    answer: 0.9,
    explanation:
      "Checking twice suggests caution. A writing tool could use this judgment to flag a draft for review when it appears not to follow an instruction. A high probability is the model’s judgment, not proof.",
    next: "Change the sentence to ‘The pilot kicked the door open without looking.’ Predict how the answer will change, then run it again.",
  },
  support: {
    title: "Inbox · spot a refund request",
    input: "My subscription renewed yesterday, but I meant to cancel. Can you return the payment?",
    question: "Is the sender asking for a refund?",
    type: "noul",
    criteria: [],
    answer: 0.95,
    explanation:
      "‘Return the payment’ expresses a refund request without using the word ‘refund’. An app might suggest a billing label or route this message to a person; this score should not automatically authorize a payment.",
    next: "Try ‘Where can I download my invoice?’ A billing topic is not necessarily a refund request. See whether the model distinguishes them.",
  },
}
export function loadExample(form: HTMLFormElement, example: Example) {
  for (const [name, value] of Object.entries({ input: example.input, question: example.question, type: example.type, criteria: example.criteria.join("\n") }))
    (form.elements.namedItem(name) as HTMLInputElement).value = value
}
