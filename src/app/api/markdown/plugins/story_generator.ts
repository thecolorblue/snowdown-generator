
import path from 'path';
import fs from 'fs';
import OpenAI from 'openai';
import type { Root, Content, Text as MdastText } from 'mdast';
import YAML from 'yaml'
import type { Node as UnistNode, Data, Parent } from 'unist';
import {visit} from 'unist-util-visit'
import type { Properties as HastProperties } from 'hast';

import { Metadata } from './metadata';

const CACHE_FILE_PATH = path.join(process.cwd(), 'src', 'app', 'api', 'markdown', 'story-cache.json');
let storyCache = new Map<string, string>();

interface DirectiveNode extends Parent { // Extend Parent to include children
  type: 'containerDirective' | 'leafDirective' | 'textDirective';
  name: string;
  attributes?: Record<string, string>;
  children: Content[];
}

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

export interface StoryParams {
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
export async function generateStory(storyTopic: string, params: StoryParams): Promise<string> {
  const cacheKey = JSON.stringify({ storyTopic, params });

  if (storyCache.has(cacheKey)) {
    return storyCache.get(cacheKey)!;
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
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
      model: 'gpt-4.1-nano',
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


async function validateParagraph(story: string, requiredWords: string[]): Promise<string> {
  const cacheKey = JSON.stringify({ story, requiredWords, function: 'validateParagraph' });

  if (storyCache.has(cacheKey)) {
    return storyCache.get(cacheKey)!;
  }

  const lowerCaseStory = story.toLowerCase();
  const missing_words = requiredWords.filter(
    (word: string) => !lowerCaseStory.includes(word.toLowerCase()) // Typed word
  );

  if (missing_words.length === 0) {
    storyCache.set(cacheKey, story);
    saveCache();
    return story;
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
    return story;
  }
}

function annotateWordCount(story: string): string {
  if (!story || story.trim() === '') {
    return '';
  }
  const countWordsInText = (text: string): number => {
    if (!text || text.trim() === '') {
      return 0;
    }
    const words = text.match(/\b[a-zA-Z0-9]+\b/g);
    return words ? words.length : 0;
  };
  const parts = story.split(/(?<=[.!?])/);
  let resultText = '';
  let currentTotalWords = 0;
  for (const part of parts) {
    if (part === '') {
      continue;
    }
    const wordsInThisPart = countWordsInText(part);
    currentTotalWords += wordsInThisPart;
    const matchTrailing = part.match(/(\s*)$/);
    const trailingWhitespace = matchTrailing ? matchTrailing[0] : '';
    const contentOfPart = part.substring(0, part.length - trailingWhitespace.length);
    if (contentOfPart.length > 0) {
      resultText += contentOfPart + `(${currentTotalWords})` + trailingWhitespace;
    } else {
      resultText += part;
    }
  }
  return resultText;
}

// This plugin handles the :::generate_story directive
export function sdGenerateStory() {
  return async function transformer(tree: Root): Promise<void> { // Added 'file' for context if needed by remark/rehype
    const promises: Promise<void>[] = [];
    let metadata: Metadata = {}; // Initialize with Metadata type
    if (tree.children.length > 0 && tree.children[0]?.type === 'yaml') {
      try {
        const yamlNode = tree.children[0] as UnistNode & { type: 'yaml', value: string };
        metadata = YAML.parse(yamlNode.value) as Metadata;
      } catch (e) {
        console.error('Error parsing YAML in sdGenerateStory:', e);
        metadata = {};
      }
    }

    visit(tree, (node: UnistNode, index?: number, parent?: Parent) => { // Added index and parent
      if (
        (node.type === 'containerDirective' ||
         node.type === 'leafDirective' ||
         node.type === 'textDirective') &&
        (node as DirectiveNode).name === 'generate_story'
      ) {
        const dn = node as DirectiveNode;
        const promise = (async () => {
          const storyParams: StoryParams = {
            genre: dn.attributes?.genre || metadata.story_genre || 'fantasy',
            location: dn.attributes?.location || metadata.story_location || 'a magical forest',
            style: dn.attributes?.style || metadata.story_style || 'Dr. Seuss',
            interests: dn.attributes?.interests || metadata.story_interests || 'reading and adventure',
            friend: dn.attributes?.friend || (metadata.friends as string) || 'a talking squirrel', // Corrected 'friends'
            user_name: dn.attributes?.user_name || (metadata.user_name as string) || 'Alex',
            user_age: parseInt(dn.attributes?.user_age || (metadata.user_age as string) || '10', 10),
            paragraphs: parseInt(dn.attributes?.paragraphs || (metadata.paragraphs as string) || '4', 10)
          };
          const storyClasses = dn.attributes?.style ?
            `generated-story ${dn.attributes?.style.split(' ').map((c: string) => c.trim()).join(' ')}` : // Typed 'c'
            'generated-story';

          let storyTopic = "a surprising event";
          if (dn.children && dn.children.length > 0) {
            const firstChild = dn.children[0];
            if (firstChild.type === 'text') {
              storyTopic = (firstChild as MdastText).value;
            } else if ('value' in firstChild && typeof (firstChild as { value: unknown }).value === 'string') {
              storyTopic = (firstChild as { value: string }).value;
            }
          }

          const requiredWordsString = dn.attributes?.requiredWords || '';
          let requiredWords: string[] = []; // Initialize as string array

          if (metadata.story_required_words) {
            if (Array.isArray(metadata.story_required_words)) {
              requiredWords = metadata.story_required_words.filter((word: unknown): word is string => typeof word === 'string'); // Ensure elements are strings
            } else if (typeof metadata.story_required_words === 'string') {
              requiredWords = metadata.story_required_words.split(',')
                .map((word: string) => word.trim()) // Typed word
                .filter((word: string) => word.length > 0); // Typed word
            }
          } else if (requiredWordsString) {
            requiredWords = requiredWordsString.split(',')
              .map((word: string) => word.trim()) // Typed word
              .filter((word: string) => word.length > 0); // Typed word
          }
          
          let storyText = await generateStory(storyTopic, storyParams);
          if (requiredWords.length > 0) {
            storyText = await validateParagraph(storyText, requiredWords);
          }
          storyText = annotateWordCount(storyText);

          const data = (dn.data || (dn.data = {})) as Data & {
            hName?: string;
            hProperties?: HastProperties;
          };
          data.hName = 'div';
          data.hProperties = { className: storyClasses };
          const newMdastChildren: Content[] = storyText.split('\n\n').map(paragraphText => {
            return {
              type: 'paragraph',
              children: [{ type: 'text', value: paragraphText } as MdastText]
            } as Content;
          });

          // Replace node content or structure
          if (parent && typeof index === 'number' && (dn.type === 'containerDirective' || dn.type === 'leafDirective')) {
             // For block directives, replace the node in parent
            parent.children.splice(index, 1, {
                type: dn.type, // Keep original directive type or change if needed
                name: dn.name,
                attributes: dn.attributes,
                data: data, // Include HAST data
                children: newMdastChildren
            } as DirectiveNode);
          } else {
            // For textDirective or if parent/index not available, modify node directly
            dn.children = newMdastChildren; // This might be okay if rehype handles it
          }
        })();
        promises.push(promise);
      }
    });
    await Promise.all(promises);
  };
}