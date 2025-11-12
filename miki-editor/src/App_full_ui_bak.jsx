import { useRef, useState, useCallback } from 'react';
import './App.css';
import './index.css';
import Split from 'react-split';

import MikiEditor from './MikiEditor';
import AiPanel from './AiPanel';

function App() {
  const editorRef = useRef(null);
  const aiPanelRef = useRef(null);
  const [editorContext, setEditorContext] = useState({
    fullContent: '',
    selection: null
  });

  // 에디터 컨텍스트 업데이트 핸들러
  const handleEditorContextUpdate = useCallback((context) => {
    setEditorContext(context);
  }, []);

  // AI 명령 처리 핸들러
  const handleAiCommand = useCallback((command) => {
    if (editorRef.current && command) {
      editorRef.current.applyStructuredAiCommand(command);
    }
  }, []);

  // AI 제안 표시 핸들러
  const handleAiSuggestion = useCallback((suggestion) => {
    if (editorRef.current && suggestion) {
      editorRef.current.displayAiSuggestion(suggestion);
    }
  }, []);

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <header className="p-4 bg-blue-500 text-white text-center font-bold">
        Miki Editor v7 AI 연동
      </header>
      
      <Split 
        className="flex-grow flex p-4"
        sizes={[60, 40]}
        minSize={300}
        gutterSize={10}
        gutterAlign="center"
      >
        <div className="p-2 bg-white rounded shadow mr-2 h-full overflow-y-auto flex flex-col">
          <h2 className="text-lg font-bold mb-4">에디터 영역</h2>
          <div className="flex-grow border rounded">
            <MikiEditor
              ref={editorRef}
              onContextUpdate={handleEditorContextUpdate}
            />
          </div>
        </div>
        
        <div className="p-2 bg-white rounded shadow ml-2 h-full overflow-y-auto flex flex-col">
          <h2 className="text-lg font-bold mb-4">AI 패널 영역</h2>
          <AiPanel
            ref={aiPanelRef}
            editorContext={editorContext}
            onCommand={handleAiCommand}
            onSuggestion={handleAiSuggestion}
          />
        </div>
      </Split>
    </div>
  );
}

export default App;

