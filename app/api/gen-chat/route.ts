import { anthropic } from '@ai-sdk/anthropic';
// import { openai } from '@ai-sdk/openai';
import { streamText, smoothStream, Message, CreateMessage } from 'ai';
import { tools } from '@/app/tools/gen-chat/utils/tools';
import { logTokenUsage } from '@/utils/logTokenUsage';
import { createClient } from "@/utils/supabase/server";
import {
  SCIENCE_TEACHER_PROMPT,
  MATH_TEACHER_PROMPT,
  ENGLISH_TEACHER_PROMPT,
  GENERIC_TEACHER_PROMPT,
  TEACHER_BUDDY_PROMPT,
  SCIENCE_TEACHER_PROMPT_HINDI,
  MATH_TEACHER_PROMPT_HINDI,
  ENGLISH_TEACHER_PROMPT_HINDI,
  GENERIC_TEACHER_PROMPT_HINDI
} from '@/app/utils/systemPrompt';

export const runtime = 'edge';

if (!process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY) {
  throw new Error('Missing DEEPGRAM_API_KEY environment variable');
}

type Subject = 'science' | 'math' | 'english' | 'generic';
type Language = 'english' | 'hindi';

const prompts: Record<Language, Record<Subject, string>> = {
  english: {
    science: SCIENCE_TEACHER_PROMPT,
    math: MATH_TEACHER_PROMPT,
    english: ENGLISH_TEACHER_PROMPT,
    generic: GENERIC_TEACHER_PROMPT
  },
  hindi: {
    science: SCIENCE_TEACHER_PROMPT_HINDI,
    math: MATH_TEACHER_PROMPT_HINDI,
    english: ENGLISH_TEACHER_PROMPT_HINDI,
    generic: GENERIC_TEACHER_PROMPT_HINDI
  }
};

function detectSubject(messages: any[]): Subject {
  const lastUserMessage = messages
    .slice()
    .reverse()
    .find(m => m.role === 'user')?.content.toLowerCase() || '';

  if (lastUserMessage.includes('math') || lastUserMessage.includes('calculation')) {
    return 'math';
  }
  if (lastUserMessage.includes('science') || lastUserMessage.includes('experiment')) {
    return 'science';
  }
  if (lastUserMessage.includes('english') || lastUserMessage.includes('writing')) {
    return 'english';
  }
  return 'generic';
}

interface UserDetails {
  name?: string;
  age?: number;
  grade?: number;
  subjects?: string[];
}

interface ThreadMessage extends Message {
  toolCalls?: Array<{
    id: string;
    tool: string;
    parameters: Record<string, any>;
    result?: any;
    state?: string;
  }>;
}

function getSystemPrompt(messages: any[], userRole?: string, language: Language = 'english'): string {
  // For teachers, only use teacher buddy prompt
  if (userRole === 'Teacher') {
    return TEACHER_BUDDY_PROMPT;
  }

  // For students, use existing subject-specific logic
  const subject = detectSubject(messages);
  const basePrompt = prompts[language][subject];
  
  const userDetailsMessage = messages.find(m => 
    m.toolCalls?.some((t: any) => t.tool === 'collectUserDetails' && t.state === 'result')
  );
  
  // Only process user details for students
  let userDetailsPrompt;
  
  if (language === 'english') {
    userDetailsPrompt = `
I haven't collected the student's details yet. Start by asking about:
- Name of the student
- Age and grade level
- Subjects they're interested in
Use the collectUserDetails tool to store this information.
`;
  } else {
    userDetailsPrompt = `
मैंने अभी तक छात्र का विवरण एकत्र नहीं किया है। निम्न के बारे में पूछकर प्रारंभ करें:
- छात्र का नाम
- आयु और कक्षा का स्तर
- वे किन विषयों में रुचि रखते हैं
इस जानकारी को स्टोर करने के लिए collectUserDetails टूल का उपयोग करें।
`;
  }

  if (userDetailsMessage) {
    const toolCall = userDetailsMessage.toolCalls.find((t: any) => t.tool === 'collectUserDetails');
    const userDetails: UserDetails = toolCall.result;
    
    if (userDetails.age) {
      if (language === 'english') {
        userDetailsPrompt = `
Student Profile:
- Name: ${userDetails.name}
- Age: ${userDetails.age}
- Grade: ${userDetails.grade}
- Interests: ${userDetails.subjects?.join(', ')}

Adapt your teaching style according to this student's profile. Give short replies whenever possible.
`;
      } else {
        userDetailsPrompt = `
छात्र प्रोफ़ाइल:
- नाम: ${userDetails.name}
- आयु: ${userDetails.age}
- कक्षा: ${userDetails.grade}
- रुचियाँ: ${userDetails.subjects?.join(', ')}

इस छात्र की प्रोफ़ाइल के अनुसार अपनी शिक्षण शैली को अपनाएं। छोटे उत्तर दें जब भी संभव हो.
`;
      }
    }
  }
  
  if (language === 'english') {
    return `${basePrompt}
${userDetailsPrompt}

You can use various tools to enhance the learning experience:
- Generate interactive math problems
- Create quizzes
- Generate educational images
- Create concept visualizations
- Generate mind maps

Always provide clear explanations and encourage active learning. Give short responses whenever possible.`;
  } else {
    return `${basePrompt}
${userDetailsPrompt}

आप सीखने के अनुभव को बढ़ाने के लिए विभिन्न उपकरणों का उपयोग कर सकते हैं:
- इंटरैक्टिव गणित समस्याएँ उत्पन्न करें
- क्विज़ बनाएँ
- शैक्षिक छवियाँ उत्पन्न करें
- अवधारणा विज़ुअलाइज़ेशन बनाएँ
- माइंड मैप उत्पन्न करें

हमेशा स्पष्ट व्याख्या प्रदान करें और सक्रिय सीखने को प्रोत्साहित करें। संभव हो तो छोटे उत्तर दें।`;
  }
}

async function saveToolOutputs(
  supabase: any,
  messageId: string,
  toolCalls: Array<{
    id: string;
    tool: string;
    parameters: Record<string, any>;
    result?: any;
    state?: string;
  }>
) {
  const outputs = toolCalls.map(call => ({
    message_id: messageId,
    tool_name: call.tool,
    tool_call_id: call.id,
    parameters: call.parameters,
    result: call.result,
    state: call.state || 'pending'
  }));

  const { error } = await supabase
    .from('tool_outputs')
    .insert(outputs);

  if (error) {
    console.error('Error saving tool outputs:', error);
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return Response.json({ error: error?.message || 'User not found' }, { status: 401 });
    }

    // Get user role from metadata
    const userRole = user.user_metadata?.role;

    const { messages, id: threadId, language = 'english' } = await request.json();

    // Add logging to debug language toggle
    console.log('Thread ID:', threadId);
    console.log('User ID:', user.id);
    console.log('Language selected:', language);

    // Verify thread belongs to user
    if (threadId) {
      const { data: thread, error: threadError } = await supabase
        .from('chat_threads')
        .select('user_id')
        .eq('id', threadId)
        .single();

      console.log('Thread data:', thread);
      console.log('Thread error:', threadError);

      if (threadError) {
        return Response.json({ error: 'Thread not found' }, { status: 404 });
      }

      if (thread?.user_id !== user.id) {
        return Response.json({ 
          error: 'Unauthorized thread access',
          details: {
            threadUserId: thread?.user_id,
            currentUserId: user.id
          }
        }, { status: 403 });
      }
    }

    const result = streamText({
      // model: openai('gpt-4o'),
      model: anthropic('claude-3-5-sonnet-20240620'),
      system: getSystemPrompt(messages, userRole, language as Language),
      messages: messages as CreateMessage[],
      maxSteps: 5,
      tools,
      temperature: 0.5,
      maxTokens: 500,
      experimental_transform: smoothStream({
        delayInMs: 5,
        chunking: 'word',
      }),
      onStepFinish: async ({ text, toolCalls, toolResults }) => {
        if (!toolCalls?.length) return;

        // Generate a message ID for this step
        const messageId = crypto.randomUUID();

        // Save the message first
        const { error: messageError } = await supabase
          .from('chat_messages')
          .insert({
            id: messageId,
            thread_id: threadId,
            role: 'assistant',
            content: text
          });

        if (messageError) {
          console.error('Error saving message:', messageError);
          return;
        }

        // Map tool results to their corresponding calls
        const toolCallsWithResults = toolCalls.map(call => {
          const result = toolResults?.find(r => r.toolCallId === call.toolCallId);
          return {
            id: call.toolCallId,
            tool: call.toolName,
            parameters: call.args,
            result: result?.result || undefined,
            state: result ? 'result' : 'pending'
          };
        });

        // Save tool outputs
        await saveToolOutputs(supabase, messageId, toolCallsWithResults);
      },
      onFinish: async ({ usage }) => {
        if (usage) {
          await logTokenUsage(
            'Learning Buddy',
            'Claude 3.5 Sonnet',
            usage.promptTokens,
            usage.completionTokens,
            user.email || undefined
          );
        }
      }
    });

    return result.toDataStreamResponse();
  } catch (err: any) {
    console.error('Error in POST /api/gen-chat:', err);
    return Response.json({ error: err.message || 'An unknown error occurred.' }, { status: 500 });
  }
}