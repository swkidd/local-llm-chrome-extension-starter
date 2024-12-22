import { useState, useEffect, useRef } from 'react';

function App() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isModelReady, setIsModelReady] = useState(false);
  const [error, setError] = useState('');
  const [initProgress, setInitProgress] = useState('');
  const [debugInfo, setDebugInfo] = useState('');
  const portRef = useRef<any>(null);

  useEffect(() => {
    portRef.current = chrome.runtime.connect({ name: "popup" });

    const sendPageContent = async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab.id) {
          setDebugInfo('No active tab found');
          return;
        }

        // Execute content extraction with Readability injected inline
        const [{ result: article }] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['assets/extract-text.js']
        }).then(async () => {
          return await chrome.scripting.executeScript({
            target: { tabId: tab.id! },
            func: () => {
              return (window as any).runReadability();
            }
          });
        }) as any;

        if (!article) {
          throw new Error('No content extracted');
        }

        portRef.current.postMessage({
          type: "PAGE_CONTENT",
          content: article.textContent
            .replace(/\s+/g, ' ')
            .trim(),
        });
      } catch (err: any) {
        console.error('Error getting page content:', err);
        setError('Error accessing page content: ' + (err.message || 'Unknown error'));
        setDebugInfo(`Error: ${err.message}`);
      }
    };

    sendPageContent();

    portRef.current.onMessage.addListener((message: any) => {
      console.log("Received message:", message);
      if (message.type === "ANSWER") {
        setAnswer(message.answer);
        setIsLoading(false);
        setError('');
      } else if (message.type === "ERROR") {
        setError(message.error);
        setIsLoading(false);
      } else if (message.type === "MODEL_READY") {
        setIsModelReady(true);
        setInitProgress('');
      } else if (message.type === "INIT_PROGRESS") {
        setInitProgress(message.progress);
      }
    });

    return () => {
      if (portRef.current) {
        portRef.current.disconnect();
      }
    };
  }, []);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (!question.trim() || !portRef.current) return;
    setIsLoading(true);
    setError('');

    try {
      portRef.current.postMessage({
        type: "QUERY",
        question: question.trim(),
      });
    } catch (err: any) {
      setError("Failed to send query: " + (err.message || "Unknown error"));
      setIsLoading(false);
    }
  };

  return (
    <div className="w-96 p-4 bg-gray-100 min-h-[400px] flex flex-col">
      <h1 className="text-xl font-bold mb-4">Page Assistant</h1>

      {error && (
        <div className="bg-red-100 text-red-700 p-2 mb-4 rounded">
          {error}
          {debugInfo && (
            <div className="text-sm mt-1 text-gray-700">
              Debug info: {debugInfo}
            </div>
          )}
        </div>
      )}

      {!isModelReady ? (
        <div className="text-center py-4">
          <div className="mb-2">Loading model... This may take a few minutes.</div>
          {initProgress && (
            <div className="text-sm text-gray-600">{initProgress}</div>
          )}
        </div>
      ) : (
        <>
          <form onSubmit={handleSubmit} className="mb-4">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask a question about this page..."
              className="w-full p-2 border rounded mb-2"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !question.trim()}
              className="w-full bg-blue-500 text-white p-2 rounded disabled:bg-gray-300"
            >
              {isLoading ? "Thinking..." : "Ask"}
            </button>
          </form>

          {answer && (
            <div className="bg-white p-3 rounded shadow">
              <h2 className="font-bold mb-2">Answer:</h2>
              <p className="whitespace-pre-wrap">{answer}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default App;