
import type { Root, Content, Text as MdastText } from 'mdast';
import YAML from 'yaml';
import type { Node as UnistNode, Data, Parent } from 'unist';
import type { Element as HastElement, Properties as HastProperties } from 'hast';
import {h} from 'hastscript';
import {visit} from 'unist-util-visit';


interface DirectiveNode extends Parent {
  type: 'containerDirective' | 'leafDirective' | 'textDirective';
  name: string;
  attributes?: Record<string, string>;
  children: Content[];
}

export interface Metadata {
  story_genre?: string;
  story_location?: string;
  story_style?: string;
  story_interests?: string;
  story_required_words?: string | string[];
  [key: string]: unknown;
}

export function getMetaFromRoot(tree:Root) {
    let metadata: Metadata = {};
    if (tree.children.length > 0 && tree.children[0]?.type === 'yaml') {
        try {
        const yamlNode = tree.children[0] as UnistNode & { type: 'yaml', value: string };
        metadata = YAML.parse(yamlNode.value) as Metadata;
        } catch (e) {
        console.error('Error parsing YAML in sdMetadata:', e);
        metadata = {};
        }
    }

    return metadata;
}

export function sdMetadata() {
  /**
   * @param {Root} tree
   *   Tree.
   * @returns {undefined}
   *   Nothing.
   */
  return function (tree: Root): void {
    const metadata = getMetaFromRoot(tree);

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