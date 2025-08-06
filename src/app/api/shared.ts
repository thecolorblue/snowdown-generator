
import type { Content } from 'mdast';
import { Parent } from "unist";

export interface DirectiveNode extends Parent { // Extend Parent to include children
  type: 'containerDirective' | 'leafDirective' | 'textDirective';
  name: string;
  attributes?: Record<string, string>;
  children: Content[];
}