import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import remarkDirective from 'remark-directive';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import {visit} from 'unist-util-visit'
import {h} from 'hastscript';
import type { Root, Content, Text as MdastText } from 'mdast';
import type { Node as UnistNode, Data, Parent } from 'unist';
import type { Element as HastElement, Properties as HastProperties } from 'hast';
import OpenAI from 'openai';

// Define an interface for the directive nodes based on their structure
interface DirectiveNode extends Parent { // Extend Parent to include children
  type: 'containerDirective' | 'leafDirective' | 'textDirective';
  name: string;
  attributes?: Record<string, string>;
  children: Content[]; // Explicitly define children based on mdast Content
  // data is already part of UnistNode but can be extended
}
// Import remarkGfm if you want GitHub Flavored Markdown (tables, strikethrough, etc.)
// import remarkGfm from 'remark-gfm'; // This will be imported dynamically below

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const markdownText = body.markdown;

    if (typeof markdownText !== 'string') {
      return NextResponse.json({ error: 'Invalid markdown input' }, { status: 400 });
    }

    if (!markdownText.trim()) {
      return NextResponse.json({ html: '' });
    }

    // To return HTML from MDX server-side:
    const { unified } = await import('unified');
    const remarkParse = (await import('remark-parse')).default;
    const remarkRehype = (await import('remark-rehype')).default;
    const rehypeStringify = (await import('rehype-stringify')).default;
    // remarkGfm might be useful too
    const remarkGfm = (await import('remark-gfm')).default;


    const processor = unified()
      .use(remarkParse)
      .use(remarkGfm) // Optional: for GitHub Flavored Markdown
      .use(remarkDirective)
      .use(myRemarkPlugin)
      .use(storyPlugin)
      .use(remarkRehype, { allowDangerousHtml: true }) // allowDangerousHtml is needed for rehype-raw
      .use(rehypeRaw) // Process raw HTML
      .use(rehypeKatex) // Process LaTeX
      .use(rehypeStringify);

    const result = await processor.process(markdownText);
    const htmlOutput = String(result);

    return NextResponse.json({ html: htmlOutput });

  } catch (error) {
    console.error('API error:', error);
    let message = 'Internal Server Error';
    if (error instanceof Error) {
        message = error.message;
    }
    // Provide more specific error if it's from MDX processing
    if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
        message = error.message;
    }
    return NextResponse.json({ error: 'Error processing MDX', details: message }, { status: 500 });
  }
}

interface StoryParams {
  genre: string;
  location: string;
  style: string;
  interests: string;
  friend: string;
  // Assuming user_name and user_age will be passed or sourced differently,
  // for now, I'll add them as params.
  user_name: string;
  user_age: number;
  paragraphs: number; // Added from original call, though not in template
}

const CACHE_FILE_PATH = path.join(process.cwd(), 'src', 'app', 'api', 'markdown', 'story-cache.json');
let storyCache = new Map<string, string>();

// Load cache from file
function loadCache() {
  try {
    if (fs.existsSync(CACHE_FILE_PATH)) {
      const data = fs.readFileSync(CACHE_FILE_PATH, 'utf-8');
      const parsedData = JSON.parse(data);
      if (parsedData && typeof parsedData === 'object' && !Array.isArray(parsedData)) {
        storyCache = new Map(Object.entries(parsedData));
      } else if (Array.isArray(parsedData)) { // For older format if it was an array of [key, value]
        storyCache = new Map(parsedData);
      }
      console.log('Story cache loaded from file.');
    }
  } catch (error) {
    console.error('Failed to load story cache:', error);
    // Initialize with an empty map if loading fails
    storyCache = new Map<string, string>();
  }
}

// Save cache to file
function saveCache() {
  try {
    // Convert Map to a simple object for JSON serialization
    const objectToSave = Object.fromEntries(storyCache);
    fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(objectToSave, null, 2), 'utf-8');
    console.log('Story cache saved to file.');
  } catch (error) {
    console.error('Failed to save story cache:', error);
  }
}

// Load the cache when the module starts
loadCache();

async function generateStory(storyTopic: string, params: StoryParams): Promise<string> {
  const cacheKey = JSON.stringify({ storyTopic, params });

  if (storyCache.has(cacheKey)) {
    return storyCache.get(cacheKey)!;
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY, // Ensure your API key is set in environment variables
  });

  const { genre, location, style, interests, friend, user_name, user_age } = params;

  const interests_string = interests;

  const prompt = `
Write an ${genre} story located in ${location} in the style of ${style} for ${user_name} who is ${user_age} years old. It should be very silly. Over the top silly.
She likes ${interests_string}, and her best friend is ${friend}. The story should be about: ${storyTopic}.

Make the story about 4 paragraphs long.
`;

  try {
    const completion = await openai.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'gpt-4o-mini',
    });

    const storyResult = completion.choices[0]?.message?.content || 'Failed to generate story.';
    storyCache.set(cacheKey, storyResult);
    saveCache(); // Save cache after updating
    return storyResult;
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    return 'Error generating story due to API failure.';
  }
}

// This plugin is an example to let users write HTML with directives.
// It’s informative but rather useless.
// See below for others examples.
function myRemarkPlugin() {
  /**
   * @param {Root} tree
   *   Tree.
   * @returns {undefined}
   *   Nothing.
   */
  return function (tree: Root): void {
    visit(tree, (node: UnistNode): void => {
      if (
        node.type === 'containerDirective' ||
        node.type === 'leafDirective' ||
        node.type === 'textDirective'
      ) {
        // After this check, node is known to be one of the directive types.
        const directiveNode = node as DirectiveNode;

        // Ensure 'data' exists and correctly typed for hName/hProperties.
        const data = (directiveNode.data || (directiveNode.data = {})) as Data & {
          hName?: string;
          hProperties?: HastProperties;
        };
        
        const hast: HastElement = h(directiveNode.name, directiveNode.attributes || {});
        
        data.hName = hast.tagName;
        data.hProperties = hast.properties;
      }
    });
  };
}

async function validateParagraph(story: string, requiredWords: string[]): Promise<string> {
  const cacheKey = JSON.stringify({ story, requiredWords, function: 'validateParagraph' });

  if (storyCache.has(cacheKey)) {
    return storyCache.get(cacheKey)!;
  }

  const lowerCaseStory = story.toLowerCase();
  const missing_words = requiredWords.filter(
    (word) => !lowerCaseStory.includes(word.toLowerCase())
  );

  if (missing_words.length === 0) {
    // Even if no words are missing, we can cache this outcome,
    // especially if the "story" itself is a result of a previous generation
    // and we want to avoid re-processing if the same validation is requested.
    storyCache.set(cacheKey, story);
    saveCache();
    return story; // All required words are present
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const prompt = `
Rewrite the following paragraph to include the words: ${missing_words.join(', ')}.
Keep the meaning and tone of the original paragraph as much as possible.

Original paragraph:
"${story}"

Rewritten paragraph:
`;

  try {
    const completion = await openai.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'gpt-4o-mini',
    });

    const rewrittenParagraph = completion.choices[0]?.message?.content?.trim() || story;
    storyCache.set(cacheKey, rewrittenParagraph);
    saveCache();
    return rewrittenParagraph;
  } catch (error) {
    console.error('Error calling OpenAI API in validateParagraph:', error);
    // Fallback to original story in case of error, do not cache errors.
    return story;
  }
}

function annotateWordCount(story: string): string {
  if (!story || story.trim() === '') {
    return '';
  }

  // Helper to count words in a given text string
  const countWordsInText = (text: string): number => {
    if (!text || text.trim() === '') {
      return 0;
    }
    // A word is a sequence of alphanumeric characters
    const words = text.match(/\b[a-zA-Z0-9]+\b/g);
    return words ? words.length : 0;
  };

  // Split the story by sentence terminators (. ! ?), keeping the terminators with the preceding text.
  // The lookbehind `(?<=[.!?])` splits *after* the delimiter.
  const parts = story.split(/(?<=[.!?])/);
  
  let resultText = '';
  let currentTotalWords = 0;

  for (const part of parts) {
    if (part === '') {
      continue;
    }

    const wordsInThisPart = countWordsInText(part);
    currentTotalWords += wordsInThisPart;

    // Find the actual content and any trailing whitespace for this part
    // to place the count correctly before trailing whitespace.
    const matchTrailing = part.match(/(\s*)$/);
    const trailingWhitespace = matchTrailing ? matchTrailing[0] : '';
    const contentOfPart = part.substring(0, part.length - trailingWhitespace.length);

    if (contentOfPart.length > 0) {
      // If there's actual content (not just whitespace)
      resultText += contentOfPart + `(${currentTotalWords})` + trailingWhitespace;
    } else {
      // If the part was only whitespace (e.g. story = "Hi.   . Bye"), preserve it without annotation
      resultText += part;
    }
  }

  return resultText;
}

// This plugin handles the :::story directive by generating a story using OpenAI.
function storyPlugin() {
  // The plugin returns an async transformer function
  return async function transformer(tree: Root): Promise<void> {
    const promises: Promise<void>[] = []; // To store promises from async operations

    visit(tree, (node: UnistNode) => { // The visitor itself is synchronous
      if (
        (node.type === 'containerDirective' ||
         node.type === 'leafDirective' ||
         node.type === 'textDirective') &&
        (node as DirectiveNode).name === 'generate_story'
      ) {
        const dn = node as DirectiveNode;

        // Create a promise for the async story generation and modification
        const promise = (async () => {
          const storyParams: StoryParams = {
            genre: dn.attributes?.genre || 'fantasy',
            location: dn.attributes?.location || 'a magical forest',
            style: dn.attributes?.style || 'Dr. Seuss',
            interests: dn.attributes?.interests || 'reading and adventure',
            friend: dn.attributes?.friends || 'a talking squirrel',
            user_name: dn.attributes?.user_name || 'Alex',
            user_age: parseInt(dn.attributes?.user_age || '10', 10),
            paragraphs: parseInt(dn.attributes?.paragraphs || '4', 10)
          };

          let storyTopic = "a surprising event";
          if (dn.children && dn.children.length > 0) {
            const firstChild = dn.children[0];
            if (firstChild.type === 'text') {
              storyTopic = (firstChild as MdastText).value;
            } else if ('value' in firstChild && typeof (firstChild as any).value === 'string') {
              storyTopic = (firstChild as any).value;
            }
          }

          const requiredWordsString = dn.attributes?.requiredWords || '';
          const requiredWords = requiredWordsString ? requiredWordsString.split(',').map(word => word.trim()).filter(word => word.length > 0) : [];

          let storyText = await generateStory(storyTopic, storyParams);

          if (requiredWords.length > 0) {
            storyText = await validateParagraph(storyText, requiredWords);
          }

          storyText = annotateWordCount(storyText);

          const data = (dn.data || (dn.data = {})) as Data & {
            hName?: string;
            hProperties?: HastProperties;
          };
          
          // The directive node itself will be transformed into a div.
          data.hName = 'div';
          data.hProperties = { className: 'generated-story' }; // Add a class for styling.

          // The children of this div will be paragraphs generated from the story text.
          // We need to create MDAST paragraph nodes.
          const newMdastChildren: Content[] = storyText.split('\n\n').map(paragraphText => {
            return {
              type: 'paragraph',
              children: [{ type: 'text', value: paragraphText } as MdastText]
            } as Content; // Ensure the constructed object conforms to Content
          });

          // Replace the original children of the directive node with the new paragraphs.
          dn.children = newMdastChildren;

        })();
        promises.push(promise);
      }
    });

    await Promise.all(promises); // Wait for all story generations to complete
  };
}

