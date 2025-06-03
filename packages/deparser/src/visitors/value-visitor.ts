import { BaseVisitor, DeparserContext } from './base';
import { Node } from '@pgsql/types';
import { QuoteUtils } from '../utils/quote-utils';

export class ValueVisitor extends BaseVisitor {
  visit(node: Node, context: DeparserContext = {}): string {
    const nodeType = this.getNodeType(node);
    const nodeData = this.getNodeData(node);

    switch (nodeType) {
      case 'String':
        return this.visitString(nodeData, context);
      case 'Integer':
        return this.visitInteger(nodeData, context);
      case 'Float':
        return this.visitFloat(nodeData, context);
      case 'Boolean':
        return this.visitBoolean(nodeData, context);
      case 'BitString':
        return this.visitBitString(nodeData, context);
      case 'Null':
        return this.visitNull(nodeData, context);
      default:
        throw new Error(`Value visitor does not handle node type: ${nodeType}`);
    }
  }

  private visitString(node: any, context: DeparserContext): string {
    return node.str || node.sval || '';
  }

  private visitInteger(node: any, context: DeparserContext): string {
    return node.ival?.toString() || '0';
  }

  private visitFloat(node: any, context: DeparserContext): string {
    return node.str || '0.0';
  }

  private visitBoolean(node: any, context: DeparserContext): string {
    return node.boolval ? 'true' : 'false';
  }

  private visitBitString(node: any, context: DeparserContext): string {
    return `B'${node.str}'`;
  }

  private visitNull(node: any, context: DeparserContext): string {
    return 'NULL';
  }
}
