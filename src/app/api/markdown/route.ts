import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import YAML from 'yaml'
import remarkFrontmatter from 'remark-frontmatter';
import remarkDirective from 'remark-directive';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import rehypeGithubEmoji from 'rehype-github-emoji';
import {visit} from 'unist-util-visit'
import {h} from 'hastscript';
import type { Root, Content, Text as MdastText } from 'mdast';
import type { Node as UnistNode, Data, Parent } from 'unist';
import type { Element as HastElement, Properties as HastProperties } from 'hast';
import OpenAI from 'openai';

import {fromMarkdown} from 'mdast-util-from-markdown'

import { lua, lauxlib, lualib, to_jsstring, to_luastring } from 'fengari';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function luaValueToString(L: any, idx: any) {
    // Always use luaL_tolstring, which pushes the string on top of the stack
    lauxlib.luaL_tolstring(L, idx);
    // Now top of stack is a string
    const s = lua.lua_tostring(L, -1); // Uint8Array or null
    let result;
    if (s === null) {
        result = '';
    } else {
        result = to_jsstring(s);
    }
    lua.lua_pop(L, 1); // Remove the string from the stack
    return result;
}

// Recursively push a JS object as a Lua table onto the stack
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pushJsToLua(L: any, obj: any) {
    if (Array.isArray(obj)) {
        lua.lua_createtable(L, obj.length, 0);
        obj.forEach((val, i) => {
            pushJsToLua(L, val);
            lua.lua_seti(L, -2, i + 1);
        });
    } else if (obj !== null && typeof obj === 'object') {
        lua.lua_createtable(L, 0, Object.keys(obj).length);
        Object.entries(obj).forEach(([key, val]) => {
            pushJsToLua(L, val);
            lua.lua_setfield(L, -2, to_luastring(key));
        });
    } else if (typeof obj === 'string') {
        lua.lua_pushstring(L, to_luastring(obj));
    } else if (typeof obj === 'number') {
        lua.lua_pushnumber(L, obj);
    } else if (typeof obj === 'boolean') {
        lua.lua_pushboolean(L, obj);
    } else {
        lua.lua_pushnil(L);
    }
}

// Safely convert Lua return value to JS
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function luaReturnToJs(L: any, idx: any) {
    switch (lua.lua_type(L, idx)) {
        case lua.LUA_TNIL:
            return null;
        case lua.LUA_TSTRING:
            return to_jsstring(lua.lua_tostring(L, idx));
        case lua.LUA_TNUMBER:
            return lua.lua_tonumber(L, idx);
        case lua.LUA_TBOOLEAN:
            return !!lua.lua_toboolean(L, idx);
        case lua.LUA_TTABLE:
            return '[Lua table]';
        default:
            return `[Lua type: ${lua.lua_typename(L, lua.lua_type(L, idx))}]`;
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function runLuaString(luaCode: any, inputObject: any) {
    const L = lauxlib.luaL_newstate();
    lualib.luaL_openlibs(L);

    // Buffer to capture Lua print output
    const outputBuffer: string[] = [];

    // Override the Lua print function
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    lua.lua_pushjsfunction(L, function(L: any) {
        const n = lua.lua_gettop(L);
        const parts = [];
        for (let i = 1; i <= n; i++) {
            parts.push(luaValueToString(L, i));
        }
        outputBuffer.push(parts.join('\t'));
        return 0;
    });
    lua.lua_setglobal(L, to_luastring('print'));

    // Push the JS object as a global Lua variable 'input'
    pushJsToLua(L, inputObject);
    lua.lua_setglobal(L, to_luastring('input'));

    // Load and run Lua code
    if (lauxlib.luaL_loadstring(L, to_luastring(luaCode)) === lua.LUA_OK) {
        if (lua.lua_pcall(L, 0, lua.LUA_MULTRET, 0) === lua.LUA_OK) {
            // Get return value (optional)
            let returnValue = null;
            const nResults = lua.lua_gettop(L);
            if (nResults > 0) {
                returnValue = luaReturnToJs(L, -1);
                lua.lua_pop(L, 1);
            }
            return {
                print: outputBuffer.join('\n'),
                return: returnValue
            };
        } else {
            // Error in lua_pcall
            const err = lua.lua_tojsstring(L, -1);
            lua.lua_pop(L, 1);
            throw new Error(err);
        }
    } else {
        // Error in luaL_loadstring
        const err = lua.lua_tojsstring(L, -1);
        lua.lua_pop(L, 1);
        throw new Error(err);
    }
}

// Define an interface for the directive nodes based on their structure
interface DirectiveNode extends Parent { // Extend Parent to include children
  type: 'containerDirective' | 'leafDirective' | 'textDirective';
  name: string;
  attributes?: Record<string, string>;
  children: Content[]; // Explicitly define children based on mdast Content
  // data is already part of UnistNode but can be extended
}

// Interface for frontmatter metadata
interface Metadata {
  story_genre?: string;
  story_location?: string;
  story_style?: string;
  story_interests?: string;
  story_required_words?: string | string[];
  [key: string]: unknown; // Allow other properties
}

// Interface for mdast Code_Block node
interface MdastCodeNode extends UnistNode {
  type: 'code';
  lang?: string;
  meta?: string;
  value: string;
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


    const processor = unified()
      .use(remarkParse)
      .use(sdMetadata)
      .use(luaProcessing)
      // .use(remarkGfm) // Optional: for GitHub Flavored Markdown
      .use(remarkFrontmatter, ['yaml'])
      .use(remarkDirective)
      .use(sdGenerateStory)
      .use(remarkRehype, { allowDangerousHtml: true }) // allowDangerousHtml is needed for rehype-raw
      .use(rehypeGithubEmoji)
      // .use(rehypeTwemojify)
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

// This plugin is an example to let users write HTML with directives.
// It’s informative but rather useless.
// See below for others examples.
function sdMetadata() {
  /**
   * @param {Root} tree
   *   Tree.
   * @returns {undefined}
   *   Nothing.
   */
  return function (tree: Root): void {
    let metadata: Metadata = {}; // Initialize with Metadata type
    if (tree.children.length > 0 && tree.children[0]?.type === 'yaml') {
      try {
        const yamlNode = tree.children[0] as UnistNode & { type: 'yaml', value: string }; // More specific type for YAML node
        metadata = YAML.parse(yamlNode.value) as Metadata; // Parse and assert
      } catch (e) {
        console.error('Error parsing YAML in sdMetadata:', e);
        metadata = {}; // Reset on error
      }
    }

    visit(tree, (node: UnistNode): void => {
      if (
        node.type === 'containerDirective' ||
        node.type === 'leafDirective' ||
        node.type === 'textDirective'
      ) {
        const directiveNode = node as DirectiveNode; // Assert node is DirectiveNode

        if (directiveNode.type === 'textDirective' && directiveNode.name === 'get') {
          const childValueNode = directiveNode.children?.[0];
          if (childValueNode?.type === 'text') {
            const key = (childValueNode as MdastText).value;
            // console.log(`:get directive found for key: ${key}`, metadata[key]);
            Object.assign(directiveNode, { // Transform node
              type: 'text',
              value: metadata[key] !== undefined ? String(metadata[key]) : `Error: Metadata key "${key}" not found`
            });
          } else {
            Object.assign(directiveNode, { type: 'text', value: 'Error: Invalid :get directive usage' });
          }
        } else {
          // Generic directive handling (transform to HAST)
          const data = (directiveNode.data || (directiveNode.data = {})) as Data & {
            hName?: string;
            hProperties?: HastProperties;
          };
          const hast: HastElement = h(directiveNode.name, directiveNode.attributes || {});
          data.hName = hast.tagName;
          data.hProperties = hast.properties;
        }
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
function sdGenerateStory() {
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

// This plugin handles Lua code blocks
function luaProcessing() {
  return function transformer(tree: Root) { // Kept async based on file content
    // No explicit promises.push/Promise.all needed here if luaScript.exec() is fully synchronous
    // and stream events resolve before visit callback returns.
    // If luaScript.exec() were async, this would need promise collection.
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

    console.log(metadata);

    visit(tree, (node: UnistNode) => {
      if (node.type === 'code') {
        const codeNode = node as MdastCodeNode; // Assert node is MdastCodeNode
        if (codeNode.lang === 'lua') {
          
            let result = '';
            try {
              const { print } = runLuaString(codeNode.value, metadata);
              result = print;
              if (result !== null) {
                console.log("Lua returned:", result);
              }
            } catch (err) { // Add type annotation for err
              const errorMessage = err instanceof Error ? err.message : String(err);
              result = "Lua Error:" + errorMessage;
              // Create a text node with the error message if needed, or handle as appropriate
              // For now, just logging, as the original code didn't replace the node on error.
              // If replacement is desired:
              // const errorNode: MdastText = { type: 'text', value: `Lua Error: ${errorMessage}` };
              // Object.assign(codeNode, { type: 'paragraph', children: [errorNode], value: undefined, lang: undefined, meta: undefined });
            }

            const root = fromMarkdown(result);
            
            // Transform the code node into a paragraph with the Lua output.
            // This assumes stream events have fired and accumulation is complete due to sync exec and .end()
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const transformedNode = node as any; // Cast to any for easier transformation
            transformedNode.type = 'containerDirective';
            transformedNode.name = 'div';
            transformedNode.children = root.children;
            delete transformedNode.value;
            delete transformedNode.lang;
            delete transformedNode.meta;
        }
      }
    });
  };
}
