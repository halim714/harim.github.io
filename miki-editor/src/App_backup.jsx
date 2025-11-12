import './App.css';
import './index.css';

// 간단한 테스트 컴포넌트
function App() {
  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <header className="p-4 bg-blue-500 text-white text-center font-bold">
        Miki Editor v7 Tailwind CSS 테스트
      </header>
      
      <main className="flex-grow flex p-4">
        <div className="w-1/2 p-4 bg-white rounded-lg shadow-md mr-2">
          <h2 className="text-xl font-bold text-gray-800 mb-4">왼쪽 패널</h2>
          <p className="text-gray-600">Tailwind CSS가 정상적으로 적용되었습니다.</p>
          <button className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors">
            테스트 버튼
          </button>
        </div>
        
        <div className="w-1/2 p-4 bg-white rounded-lg shadow-md ml-2">
          <h2 className="text-xl font-bold text-gray-800 mb-4">오른쪽 패널</h2>
          <div className="p-3 bg-yellow-100 border border-yellow-300 rounded-md">
            <p className="text-yellow-800">Tailwind CSS 적용 테스트 알림</p>
          </div>
          <div className="mt-4 flex space-x-2">
            <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-sm">태그 1</span>
            <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">태그 2</span>
            <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-sm">태그 3</span>
          </div>
        </div>
      </main>
      
      <footer className="p-4 bg-gray-200 text-center text-gray-600">
        Miki Editor 테스트 페이지 © 2024
      </footer>
    </div>
  );
}

export default App;

