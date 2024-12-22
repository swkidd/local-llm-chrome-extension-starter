import React, { useEffect } from "react";
import ReactDOM from "react-dom/client";
import "./index.css";

function ContentApp() {
    useEffect(() => {
        // Extract main content from the page
        const extractPageContent = () => {
            // Get text from main content areas, prioritizing article content
            const mainContent = document.querySelector('main, article, .content, #content');
            let content = '';

            if (mainContent) {
                content = mainContent.innerText;
            } else {
                // Fallback to body content, excluding scripts and styles
                content = Array.from(document.body.children)
                    .filter(el => !['script', 'style'].includes(el.tagName.toLowerCase()))
                    .map(el => el.innerText)
                    .join('\n');
            }

            // Clean up the content
            content = content
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, 4000); // Limit content length

            return content;
        };

        // Send content to service worker
        const sendContentToServiceWorker = () => {
            const content = extractPageContent();
            chrome.runtime.sendMessage({
                type: "PAGE_CONTENT",
                content: content
            });
        };

        // Send content when page loads and on significant DOM changes
        sendContentToServiceWorker();

        const observer = new MutationObserver(sendContentToServiceWorker);
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
        });

        return () => observer.disconnect();
    }, []);

    return null; // This component doesn't render anything visible
}

// Create root element and render
const root = document.createElement("div");
root.id = "crx-root";
document.body.appendChild(root);
ReactDOM.createRoot(root).render(
    <React.StrictMode>
        <ContentApp />
    </React.StrictMode>
);