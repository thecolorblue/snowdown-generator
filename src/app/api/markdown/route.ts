import { NextRequest, NextResponse } from 'next/server';
import remarkDirective from 'remark-directive';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import {visit} from 'unist-util-visit'
import {h} from 'hastscript'
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
  return function (tree) {
    visit(tree, function (node) {
      if (
        node.type === 'containerDirective' ||
        node.type === 'leafDirective' ||
        node.type === 'textDirective'
      ) {
        const data = node.data || (node.data = {})
        const hast = h(node.name, node.attributes || {})
        console.log(data, hast)
        data.hName = hast.tagName
        data.hProperties = hast.properties
      }
    })
  }
}
