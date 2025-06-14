import { Deparser } from '../src/deparser';
import { DeparserContext } from '../src/visitors/base';

describe('Notification Statement Deparsers', () => {
  const deparser = new Deparser([]);
  const context: DeparserContext = {};

  describe('NotifyStmt', () => {
    it('should deparse NOTIFY statement without payload', () => {
      const ast = {
        NotifyStmt: {
          conditionname: 'channel_name',
          payload: null as string | null
        }
      };
      
      expect(deparser.visit(ast, context)).toBe('NOTIFY channel_name');
    });

    it('should deparse NOTIFY statement with payload', () => {
      const ast = {
        NotifyStmt: {
          conditionname: 'user_updates',
          payload: 'User data changed'
        }
      };
      
      expect(deparser.visit(ast, context)).toBe("NOTIFY user_updates , 'User data changed'");
    });

    it('should deparse NOTIFY statement with empty payload', () => {
      const ast = {
        NotifyStmt: {
          conditionname: 'empty_channel',
          payload: ''
        }
      };
      
      expect(deparser.visit(ast, context)).toBe("NOTIFY empty_channel , ''");
    });
  });

  describe('ListenStmt', () => {
    it('should deparse LISTEN statement', () => {
      const ast = {
        ListenStmt: {
          conditionname: 'channel_name'
        }
      };
      
      expect(deparser.visit(ast, context)).toBe('LISTEN channel_name');
    });

    it('should deparse LISTEN statement with quoted channel name', () => {
      const ast = {
        ListenStmt: {
          conditionname: 'user-updates'
        }
      };
      
      expect(deparser.visit(ast, context)).toBe('LISTEN user-updates');
    });
  });

  describe('UnlistenStmt', () => {
    it('should deparse UNLISTEN statement for specific channel', () => {
      const ast = {
        UnlistenStmt: {
          conditionname: 'channel_name'
        }
      };
      
      expect(deparser.visit(ast, context)).toBe('UNLISTEN channel_name');
    });

    it('should deparse UNLISTEN statement for all channels', () => {
      const ast = {
        UnlistenStmt: {
          conditionname: null as string | null
        }
      };
      
      expect(deparser.visit(ast, context)).toBe('UNLISTEN *');
    });
  });
});
