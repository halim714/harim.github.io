import { renderHook, act } from '@testing-library/react';

import { useDocumentStore, useStore } from '../../stores';

// 각 테스트 전에 스토어 초기화
beforeEach(() => {
  useStore.getState().reset();
});

describe('DocumentStore', () => {
  describe('초기 상태', () => {
    test('초기 상태가 올바르게 설정되어야 함', () => {
      const { result } = renderHook(() => useDocumentStore());
      
      expect(result.current.currentDocument).toBeNull();
      expect(result.current.documents).toEqual([]);
    });
  });

  describe('문서 설정', () => {
    test('현재 문서를 설정할 수 있어야 함', () => {
      const { result } = renderHook(() => useDocumentStore());
      
      const testDocument = {
        id: 'test-1',
        title: '테스트 문서',
        content: '테스트 내용',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      };

      act(() => {
        result.current.addDocument(testDocument);
        result.current.setCurrentDocument(testDocument);
      });

      expect(result.current.currentDocument).toEqual(testDocument);
    });

    test('null로 현재 문서를 초기화할 수 있어야 함', () => {
      const { result } = renderHook(() => useDocumentStore());
      
      const testDocument = {
        id: 'test-1',
        title: '테스트 문서',
        content: '테스트 내용'
      };

      act(() => {
        result.current.addDocument(testDocument);
        result.current.setCurrentDocument(testDocument);
      });

      expect(result.current.currentDocument).toEqual(testDocument);

      act(() => {
        result.current.setCurrentDocument(null);
      });

      expect(result.current.currentDocument).toBeNull();
    });
  });

  describe('문서 목록 관리', () => {
    test('문서를 추가할 수 있어야 함', () => {
      const { result } = renderHook(() => useDocumentStore());
      
      const newDocument = {
        id: 'test-new',
        title: '새 문서',
        content: '새 내용',
        createdAt: '2024-01-03T00:00:00.000Z',
        updatedAt: '2024-01-03T00:00:00.000Z'
      };

      act(() => {
        result.current.addDocument(newDocument);
      });

      expect(result.current.documents).toContainEqual(newDocument);
      expect(result.current.documents).toHaveLength(1);
    });

    test('기존 문서를 업데이트할 수 있어야 함', () => {
      const { result } = renderHook(() => useDocumentStore());
      
      const originalDocument = {
        id: 'test-1',
        title: '원본 문서',
        content: '원본 내용',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      };

      act(() => {
        result.current.addDocument(originalDocument);
      });

      expect(result.current.documents).toHaveLength(1);

      act(() => {
        result.current.updateDocument('test-1', {
          title: '수정된 문서',
          content: '수정된 내용'
        });
      });

      expect(result.current.documents).toHaveLength(1);
      expect(result.current.documents[0].title).toBe('수정된 문서');
      expect(result.current.documents[0].content).toBe('수정된 내용');
    });

    test('문서를 삭제할 수 있어야 함', () => {
      const { result } = renderHook(() => useDocumentStore());
      
      const document1 = {
        id: 'test-1',
        title: '문서 1',
        content: '내용 1'
      };

      const document2 = {
        id: 'test-2',
        title: '문서 2',
        content: '내용 2'
      };

      act(() => {
        result.current.addDocument(document1);
        result.current.addDocument(document2);
      });

      expect(result.current.documents).toHaveLength(2);

      act(() => {
        result.current.deleteDocument('test-1');
      });

      expect(result.current.documents).toHaveLength(1);
      expect(result.current.documents[0].id).toBe('test-2');
    });

    test('존재하지 않는 문서 삭제 시 아무 변화가 없어야 함', () => {
      const { result } = renderHook(() => useDocumentStore());
      
      const document1 = {
        id: 'test-1',
        title: '문서 1',
        content: '내용 1'
      };

      act(() => {
        result.current.addDocument(document1);
      });

      expect(result.current.documents).toHaveLength(1);

      act(() => {
        result.current.deleteDocument('non-existent');
      });

      expect(result.current.documents).toHaveLength(1);
      expect(result.current.documents[0]).toEqual(document1);
    });
  });

  describe('복합 시나리오', () => {
    test('문서 CRUD 전체 플로우가 정상 작동해야 함', () => {
      const { result } = renderHook(() => useDocumentStore());
      
      // 1. 문서 생성
      const newDocument = {
        id: 'flow-test',
        title: '플로우 테스트',
        content: '테스트 내용',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      };

      act(() => {
        result.current.addDocument(newDocument);
        result.current.setCurrentDocument(newDocument);
      });

      expect(result.current.documents).toHaveLength(1);
      expect(result.current.currentDocument).toEqual(newDocument);

      // 2. 문서 수정
      act(() => {
        result.current.updateDocument('flow-test', {
          title: '수정된 제목',
          content: '수정된 내용'
        });
      });

      expect(result.current.documents[0].title).toBe('수정된 제목');
      expect(result.current.documents[0].content).toBe('수정된 내용');

      // 3. 문서 삭제
      act(() => {
        result.current.deleteDocument('flow-test');
      });

      expect(result.current.documents).toHaveLength(0);
      expect(result.current.currentDocument).toBeNull();
    });
  });
}); 