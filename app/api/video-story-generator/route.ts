import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

// Check if environment variables are set
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false
    }
  }
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function POST(req: Request) {
  try {
    const { inputs, generateScenes, numScenes, historyId } = await req.json();

    // Add handling for history loading
    if (historyId) {
      const { data: historyData, error } = await supabase
        .from('story_history')
        .select('*')
        .eq('id', historyId)
        .single();

      if (error) throw error;

      return NextResponse.json({
        success: true,
        ...historyData
      });
    }

    if (generateScenes) {
      const prompt = `Create exactly ${numScenes} scenes for a ${inputs.storyDuration}-second video storyboard.
Genre: ${inputs.storyGenre}
Setting: ${inputs.storyLocation}
Characters: ${inputs.mainCharacters}

Story: ${inputs.story}

Follow this EXACT format for each scene (maintain the exact symbols and spacing):
Scene 1: [Main action happening] | Visual: [camera angle, lighting, setting details] | Focus: [key elements]
...continue for all ${numScenes} scenes...

Make each scene approximately 5 seconds long and ensure they flow naturally.`;

      console.log("Sending prompt to GPT:", prompt);

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ 
          role: "user", 
          content: prompt 
        }],
        temperature: 0.7,
        max_tokens: 1500,
        presence_penalty: 0.3,
        frequency_penalty: 0.3
      });

      const sceneText = completion.choices[0]?.message?.content;
      if (!sceneText) {
        throw new Error('No content received from GPT');
      }

      console.log("Received scene text:", sceneText);

      const scenes = parseScenes(sceneText);
      console.log("Parsed scenes:", scenes);

      if (scenes.length === 0) {
        console.error("Scene parsing failed. Raw text:", sceneText);
        throw new Error('Scene parsing failed - no scenes detected');
      }

      if (scenes.length < numScenes) {
        console.error(`Only ${scenes.length} scenes generated. Raw text:`, sceneText);
        throw new Error(`Insufficient scenes generated (${scenes.length}/${numScenes})`);
      }

      return NextResponse.json({
        success: true,
        scenes,
        debug: {
          rawSceneText: sceneText,
          parsedSceneCount: scenes.length
        }
      });
    }

    // Updated story generation prompt
    const prompt = `Create an engaging ${inputs.storyDuration}-second story following these requirements:

Title: ${inputs.storyTitle}
Genre: ${inputs.storyGenre}
Main Characters: ${inputs.mainCharacters}
Setting: ${inputs.storyLocation}
Opening Scene: ${inputs.openingScene}

Write a complete, detailed story that:
1. Has a clear beginning, middle, and end
2. Fits the ${inputs.storyDuration}-second duration when told
3. Focuses on character development and vivid descriptions
4. Matches the ${inputs.storyGenre} genre style
5. Incorporates all main characters meaningfully
6. Uses rich, descriptive language
7. Creates immersive scenes and atmosphere
8. Avoids any screenplay formatting or dialogue markers
9. Flows naturally as a narrative story
10. Has approximately ${Math.floor(inputs.storyDuration * 4)} words (averaging 4 words per second)

Write in a clear, engaging narrative style. Do not include any stage directions, camera angles, or screenplay elements.
Format the story as continuous paragraphs with proper spacing.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 2000, // Increased for longer stories
    });

    const refinedStory = completion.choices[0]?.message?.content;
    if (!refinedStory) {
      throw new Error('Failed to generate story content');
    }

    return NextResponse.json({
      success: true,
      refinedStory
    });

  } catch (error) {
    console.error('Error in video-story-generator:', error);
    return NextResponse.json({
      error: 'Failed to process request',
      details: error instanceof Error ? error.message : 'Unknown error',
      success: false
    }, { 
      status: 500 
    });
  }
}

function parseScenes(sceneText: string) {
  const scenes = [];
  const sceneRegex = /Scene\s*(\d+)\s*:\s*([^|]+)\|\s*Visual:\s*([^|]+)\|\s*Focus:\s*([^\n]+)/g;
  let match;

  while ((match = sceneRegex.exec(sceneText)) !== null) {
    const sceneNumber = match[1];
    const description = match[2].trim();
    const visualDetails = match[3].trim();
    const focusElements = match[4].trim();

    // Updated manga-style prompt
    const imagePrompt = `Professional line-art illustration of: ${description}. Scene details: ${visualDetails}. Style: Black and white line art, Grayscale Image.`;

    scenes.push({
      id: `scene-${sceneNumber}`,
      number: parseInt(sceneNumber),
      text: description,
      visualDetails,
      focusElements,
      imagePrompt, // Add the constructed prompt
      imageUrl: '' // Will be generated by SDXL
    });
  }

  return scenes.sort((a, b) => a.number - b.number);
}
