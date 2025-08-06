import { NextRequest, NextResponse } from 'next/server';
import remarkFrontmatter from 'remark-frontmatter';
import remarkDirective from 'remark-directive';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import rehypeGithubEmoji from 'rehype-github-emoji';

import { sdMetadata } from './plugins/metadata';
import luaProcessing from './plugins/lua_procesor';
import { sdGenerateStory } from './plugins/story_generator';

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

    const { unified } = await import('unified');
    const remarkParse = (await import('remark-parse')).default;
    const remarkRehype = (await import('remark-rehype')).default;
    const rehypeStringify = (await import('rehype-stringify')).default;


    const processor = unified()
      .use(remarkParse)
      .use(sdMetadata)
      .use(luaProcessing)
      // .use(remarkGfm) // Optional: for GitHub Flavored Markdown
      .use(remarkFrontmatter, ['yaml'])
      .use(remarkDirective)
      .use(sdGenerateStory)
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeGithubEmoji)
      .use(rehypeRaw)
      .use(rehypeKatex)
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
    if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
        message = error.message;
    }
    return NextResponse.json({ error: 'Error processing MDX', details: message }, { status: 500 });
  }
}
