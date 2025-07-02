// Test examples for the unified /chat endpoint

export const chatExamples = {
  // Code analysis with code blocks
  codeAnalysis: {
    message: `Optimize this function:
\`\`\`javascript
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n-1) + fibonacci(n-2);
}
\`\`\`
How can I make this more efficient?`,
  },

  // Research questions
  research: {
    message:
      'What are the latest developments in artificial intelligence in 2025?',
  },

  // Code-related questions without code blocks
  codeQuestion: {
    message: 'What is the best way to optimize JavaScript performance?',
  },

  // Document questions
  documentQuestion: {
    message: 'What are the key points mentioned in my uploaded PDF?',
  },

  // Time questions
  timeQuestion: {
    message: 'What time is it in Santo Domingo, Dominican Republic?',
  },

  // Weather questions
  weatherQuestion: {
    message: "What's the weather like in New York?",
  },

  // General chat
  generalChat: {
    message: 'Tell me about traditional Dominican food',
  },
};

/*
Usage examples:

POST /chat
{
  "message": "Optimize this function:\n```javascript\nfunction slow() {\n  // slow code\n}\n```"
}
→ Routes to code_interpreter agent automatically

POST /chat
{
  "message": "Research the latest AI trends"
}
→ Routes to research agent automatically

POST /chat
{
  "message": "What does my uploaded document say about security?"
}
→ Routes to document_search agent automatically

All through the same /chat endpoint - no need for frontend to know which agent to use!
*/
